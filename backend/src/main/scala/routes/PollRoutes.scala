package routes

import org.apache.pekko.actor.typed.{ActorRef, ActorSystem, Behavior}
import org.apache.pekko.actor.typed.scaladsl.{AskPattern, Behaviors}
import org.apache.pekko.actor.typed.scaladsl.AskPattern._
import org.apache.pekko.http.scaladsl.server.Directives._
import org.apache.pekko.http.scaladsl.server.{Route, Directive1}
import org.apache.pekko.http.scaladsl.model.{StatusCodes, HttpEntity, ContentTypes}
import org.apache.pekko.http.scaladsl.model.headers._
import org.apache.pekko.http.scaladsl.model.sse.ServerSentEvent
import org.apache.pekko.stream.scaladsl.{Source, SourceQueueWithComplete}
import org.apache.pekko.stream.{OverflowStrategy, QueueOfferResult}
import org.apache.pekko.util.Timeout
import scala.concurrent.duration._
import scala.concurrent.Future
import actors.PollManager
import models._
import services.{TemplateService, HistoryService}
import json.CirceSupport.given
import io.circe.syntax._
import org.apache.pekko.http.scaladsl.marshalling.sse.EventStreamMarshalling._
import scala.util.{Success, Failure}
import java.util.UUID

class PollRoutes(pollManager: ActorRef[PollManager.Command], authenticated: Directive1[String])(using system: ActorSystem[_]):
  given timeout: Timeout = 5.seconds
  import system.executionContext

  private def pollUpdateToSse(update: PollManager.PollUpdate): ServerSentEvent =
    ServerSentEvent(update.poll.asJson.noSpaces, eventType = Some("poll-update"))

  private def forwardToPollQueue(queue: SourceQueueWithComplete[PollManager.PollUpdate]): Behavior[PollManager.PollUpdate] =
    Behaviors.receiveMessage { update => queue.offer(update); Behaviors.same }

  private def recoveredTitle(original: String): String =
    if original.endsWith(" (Recovered)") then original else s"$original (Recovered)"

  private def toChoiceInputs(choices: List[Choice]): List[ChoiceInput] =
    choices.map(c => ChoiceInput(c.name, c.description))

  private def completeHistoryMerge(pollId: String, title: String, incoming: PollHistory): Route =
    HistoryService.mergeAndSave(pollId, title, incoming) match
      case Success(merged) => complete(StatusCodes.OK, merged)
      case Failure(ex)     => complete(StatusCodes.BadRequest, ErrorResponse(ex.getMessage))

  private def computeWinners(choices: List[Choice]): List[Choice] =
    val maxVotes = choices.map(_.votes).maxOption.getOrElse(0)
    if maxVotes == 0 then List.empty
    else choices.filter(_.votes == maxVotes)

  private def buildCloseSnapshot(poll: PollResponse, closedBy: String): PollSnapshot =
    val winners = computeWinners(poll.choices)
    PollSnapshot(
      snapshotId = UUID.randomUUID().toString,
      timestamp  = System.currentTimeMillis(),
      event      = "closed",
      closedBy   = closedBy,
      summary    = SnapshotSummary(
        title           = poll.title,
        totalVotes      = poll.totalVotes,
        votingMode      = poll.votingMode,
        anonymousVoting = poll.anonymousVoting,
        choices         = poll.choices.map(c => ChoiceSummary(c.name, c.votes, c.voters)),
        winner          = if winners.size == 1 then Some(winners.head.name) else None
      )
    )

  private val corsHeaders = List(
    `Access-Control-Allow-Origin`.*,
    `Access-Control-Allow-Methods`(
      org.apache.pekko.http.scaladsl.model.HttpMethods.GET,
      org.apache.pekko.http.scaladsl.model.HttpMethods.POST,
      org.apache.pekko.http.scaladsl.model.HttpMethods.PUT,
      org.apache.pekko.http.scaladsl.model.HttpMethods.DELETE,
      org.apache.pekko.http.scaladsl.model.HttpMethods.OPTIONS
    ),
    `Access-Control-Allow-Headers`("Content-Type", "Authorization")
  )

  val routes: Route =
    respondWithHeaders(corsHeaders) {
      options {
        complete(StatusCodes.OK)
      } ~
      pathPrefix("api" / "polls") {
        pathEnd {
          get {
            val response: Future[PollManager.GetAllPollsResponse] =
              pollManager.ask(PollManager.GetAllPolls.apply)
            onSuccess(response) { result =>
              complete(StatusCodes.OK, result.polls)
            }
          } ~
          post {
            authenticated { username =>
              entity(as[CreatePollRequest]) { request =>
                val response: Future[PollManager.CreatePollResponse] =
                  pollManager.ask(PollManager.CreatePoll(request, username, _))
                onSuccess(response) {
                  case PollManager.PollCreated(poll) =>
                    complete(StatusCodes.Created, poll)
                  case PollManager.PollCreationFailed(message) =>
                    complete(StatusCodes.BadRequest, ErrorResponse(message))
                }
              }
            }
          }
        } ~
        path("updates") {
          get {
            val (queue, source) = Source.queue[PollManager.PollUpdate](100, OverflowStrategy.dropHead)
              .map(pollUpdateToSse)
              .keepAlive(15.seconds, () => ServerSentEvent.heartbeat)
              .preMaterialize()

            val subscriberActor = system.systemActorOf(
              forwardToPollQueue(queue),
              s"sse-subscriber-${System.nanoTime()}"
            )

            pollManager ! PollManager.Subscribe(subscriberActor)
            complete(source)
          }
        } ~
        path(Segment / "vote") { pollId =>
          post {
            authenticated { username =>
              entity(as[VoteRequest]) { voteRequest =>
                val response: Future[PollManager.VotePollResponse] =
                  pollManager.ask(PollManager.VotePoll(pollId, voteRequest.choiceId, username, _))
                onSuccess(response) {
                  case PollManager.VoteSuccess(poll) =>
                    complete(StatusCodes.OK, poll)
                  case PollManager.VoteFailure(message) =>
                    complete(StatusCodes.BadRequest, ErrorResponse(message))
                }
              }
            }
          } ~
          delete {
            authenticated { username =>
              entity(as[RemoveVoteRequest]) { removeRequest =>
                val response: Future[PollManager.RemovePollVoteResponse] =
                  pollManager.ask(PollManager.RemovePollVote(pollId, removeRequest.choiceId, username, _))
                onSuccess(response) {
                  case PollManager.RemoveVoteSuccess(poll) =>
                    complete(StatusCodes.OK, poll)
                  case PollManager.RemoveVoteFailure(message) =>
                    complete(StatusCodes.BadRequest, ErrorResponse(message))
                }
              }
            }
          }
        } ~
        path(Segment / "request-vote") { pollId =>
          post {
            authenticated { username =>
              val response: Future[PollManager.VoterRequestPollResponse] =
                pollManager.ask(PollManager.RequestPollVote(pollId, username, _))
              onSuccess(response) {
                case PollManager.VoterRequestSuccess(poll) =>
                  complete(StatusCodes.OK, poll)
                case PollManager.VoterRequestFailure(message) =>
                  complete(StatusCodes.BadRequest, ErrorResponse(message))
              }
            }
          }
        } ~
        path(Segment / "approve-voter") { pollId =>
          post {
            authenticated { _ =>
              entity(as[VoterActionRequest]) { req =>
                val response: Future[PollManager.VoterActionPollResponse] =
                  pollManager.ask(PollManager.ApprovePollVoter(pollId, req.username, _))
                onSuccess(response) {
                  case PollManager.VoterActionSuccess(poll) =>
                    complete(StatusCodes.OK, poll)
                  case PollManager.VoterActionFailure(message) =>
                    complete(StatusCodes.BadRequest, ErrorResponse(message))
                }
              }
            }
          }
        } ~
        path(Segment / "reject-voter") { pollId =>
          post {
            authenticated { _ =>
              entity(as[VoterActionRequest]) { req =>
                val response: Future[PollManager.VoterActionPollResponse] =
                  pollManager.ask(PollManager.RejectPollVoter(pollId, req.username, _))
                onSuccess(response) {
                  case PollManager.VoterActionSuccess(poll) =>
                    complete(StatusCodes.OK, poll)
                  case PollManager.VoterActionFailure(message) =>
                    complete(StatusCodes.BadRequest, ErrorResponse(message))
                }
              }
            }
          }
        } ~
        path(Segment / "voters" / Segment) { (pollId, voterUsername) =>
          delete {
            authenticated { _ =>
              val response: Future[PollManager.VoterActionPollResponse] =
                pollManager.ask(PollManager.RevokePollVoter(pollId, voterUsername, _))
              onSuccess(response) {
                case PollManager.VoterActionSuccess(poll) =>
                  complete(StatusCodes.OK, poll)
                case PollManager.VoterActionFailure(message) =>
                  complete(StatusCodes.BadRequest, ErrorResponse(message))
              }
            }
          }
        } ~
        path(Segment / "reset") { pollId =>
          post {
            authenticated { _ =>
              val response: Future[PollManager.ResetPollResponse] =
                pollManager.ask(PollManager.ResetPollVotes(pollId, _))
              onSuccess(response) {
                case PollManager.ResetSuccess(poll) =>
                  complete(StatusCodes.OK, poll)
                case PollManager.ResetFailure(message) =>
                  complete(StatusCodes.NotFound, ErrorResponse(message))
              }
            }
          }
        } ~
        path(Segment / "force-reset") { pollId =>
          post {
            authenticated { username =>
              entity(as[ReopenRequest]) { req =>
                val getResponse: Future[PollManager.GetPollResponse] =
                  pollManager.ask(PollManager.GetPoll(pollId, _))
                onSuccess(getResponse) {
                  case PollManager.PollFound(poll) =>
                    if poll.createdBy != username then
                      complete(StatusCodes.Forbidden, ErrorResponse("Only the poll owner can force reset this poll"))
                    else if !poll.dailyReset then
                      complete(StatusCodes.BadRequest, ErrorResponse("This poll does not have daily reset enabled"))
                    else
                      services.UserService.findUser(username) match
                        case Some(user) if services.AuthService.verifyPassword(req.password, user.passwordHash, user.salt) =>
                          val response: Future[PollManager.EditPollResponse] =
                            pollManager.ask(PollManager.ForceResetPollCmd(pollId, _))
                          onSuccess(response) {
                            case PollManager.EditSuccess(updated) => complete(StatusCodes.OK, updated)
                            case PollManager.EditFailure(message) => complete(StatusCodes.BadRequest, ErrorResponse(message))
                          }
                        case _ =>
                          complete(StatusCodes.Unauthorized, ErrorResponse("Incorrect password"))
                  case PollManager.PollNotFound(message) =>
                    complete(StatusCodes.NotFound, ErrorResponse(message))
                }
              }
            }
          }
        } ~
        path(Segment / "close") { pollId =>
          post {
            authenticated { username =>
              val getResponse: Future[PollManager.GetPollResponse] =
                pollManager.ask(PollManager.GetPoll(pollId, _))
              onSuccess(getResponse) {
                case PollManager.PollFound(poll) =>
                  if poll.createdBy != username then
                    complete(StatusCodes.Forbidden, ErrorResponse("Only the poll owner can close this poll"))
                  else
                    val response: Future[PollManager.EditPollResponse] =
                      pollManager.ask(PollManager.ClosePollCmd(pollId, _))
                    onSuccess(response) {
                      case PollManager.EditSuccess(updated) =>
                        HistoryService.appendSnapshot(pollId, updated.title, buildCloseSnapshot(updated, username))
                        complete(StatusCodes.OK, updated)
                      case PollManager.EditFailure(message) => complete(StatusCodes.BadRequest, ErrorResponse(message))
                    }
                case PollManager.PollNotFound(message) =>
                  complete(StatusCodes.NotFound, ErrorResponse(message))
              }
            }
          }
        } ~
        path(Segment / "reopen") { pollId =>
          post {
            authenticated { username =>
              entity(as[ReopenRequest]) { req =>
                val getResponse: Future[PollManager.GetPollResponse] =
                  pollManager.ask(PollManager.GetPoll(pollId, _))
                onSuccess(getResponse) {
                  case PollManager.PollFound(poll) =>
                    if poll.createdBy != username then
                      complete(StatusCodes.Forbidden, ErrorResponse("Only the poll owner can reopen this poll"))
                    else
                      services.UserService.findUser(username) match
                        case Some(user) if services.AuthService.verifyPassword(req.password, user.passwordHash, user.salt) =>
                          val response: Future[PollManager.EditPollResponse] =
                            pollManager.ask(PollManager.ReopenPollCmd(pollId, _))
                          onSuccess(response) {
                            case PollManager.EditSuccess(updated) => complete(StatusCodes.OK, updated)
                            case PollManager.EditFailure(message) => complete(StatusCodes.BadRequest, ErrorResponse(message))
                          }
                        case _ =>
                          complete(StatusCodes.Unauthorized, ErrorResponse("Incorrect password"))
                  case PollManager.PollNotFound(message) =>
                    complete(StatusCodes.NotFound, ErrorResponse(message))
                }
              }
            }
          }
        } ~
        path(Segment / "results") { pollId =>
          get {
            val response: Future[PollManager.GetPollResponse] =
              pollManager.ask(PollManager.GetPoll(pollId, _))
            onSuccess(response) {
              case PollManager.PollFound(poll) =>
                complete(StatusCodes.OK, poll)
              case PollManager.PollNotFound(message) =>
                complete(StatusCodes.NotFound, ErrorResponse(message))
            }
          }
        } ~
        path(Segment) { pollId =>
          get {
            val response: Future[PollManager.GetPollResponse] =
              pollManager.ask(PollManager.GetPoll(pollId, _))
            onSuccess(response) {
              case PollManager.PollFound(poll) =>
                complete(StatusCodes.OK, poll)
              case PollManager.PollNotFound(message) =>
                complete(StatusCodes.NotFound, ErrorResponse(message))
            }
          } ~
          put {
            authenticated { _ =>
              entity(as[EditPollRequest]) { editRequest =>
                val choices = editRequest.choices.map(r => Choice(name = r.name, description = r.description))
                val response: Future[PollManager.EditPollResponse] =
                  pollManager.ask(PollManager.EditPoll(pollId, editRequest.title, choices, editRequest.dailyReset, editRequest.titleTemplate, editRequest.requireApproval, editRequest.anonymousVoting, _))
                onSuccess(response) {
                  case PollManager.EditSuccess(poll) =>
                    complete(StatusCodes.OK, poll)
                  case PollManager.EditFailure(message) =>
                    complete(StatusCodes.BadRequest, ErrorResponse(message))
                }
              }
            }
          } ~
          delete {
            authenticated { _ =>
              val response: Future[PollManager.DeletePollResponse] =
                pollManager.ask(PollManager.DeletePoll(pollId, _))
              onSuccess(response) {
                case PollManager.DeleteSuccess(message) =>
                  complete(StatusCodes.OK, DeleteSuccessResponse(message))
                case PollManager.DeleteFailure(message) =>
                  complete(StatusCodes.NotFound, ErrorResponse(message))
              }
            }
          }
        }
      } ~
      pathPrefix("api" / "history") {
        pathEnd {
          get {
            HistoryService.listAllHistories() match
              case Success(histories) => complete(StatusCodes.OK, histories)
              case Failure(ex)        => complete(StatusCodes.InternalServerError, ErrorResponse(ex.getMessage))
          } ~
          post {
            authenticated { _ =>
              entity(as[List[PollHistory]]) { incoming =>
                val merged = incoming.flatMap { h =>
                  HistoryService.mergeAndSave(h.pollId, h.pollTitle, h).toOption
                }
                HistoryService.listAllHistories() match
                  case Success(all) => complete(StatusCodes.OK, all)
                  case Failure(ex)  => complete(StatusCodes.InternalServerError, ErrorResponse(ex.getMessage))
              }
            }
          }
        }
      } ~
      pathPrefix("api" / "polls") {
        path(Segment / "history" / "import") { pollId =>
          post {
            authenticated { _ =>
              entity(as[PollHistory]) { incoming =>
                val titleFuture: Future[PollManager.GetPollResponse] =
                  pollManager.ask(PollManager.GetPoll(pollId, _))
                onSuccess(titleFuture) {
                  case PollManager.PollFound(poll)   => completeHistoryMerge(pollId, poll.title, incoming)
                  case PollManager.PollNotFound(_)   => completeHistoryMerge(pollId, incoming.pollTitle, incoming)
                }
              }
            }
          }
        } ~
        path(Segment / "history") { pollId =>
          get {
            HistoryService.getHistory(pollId) match
              case Success(history) => complete(StatusCodes.OK, history)
              case Failure(ex)      => complete(StatusCodes.InternalServerError, ErrorResponse(ex.getMessage))
          }
        }
      } ~
      pathPrefix("api" / "templates") {
        pathEnd {
          get {
            TemplateService.listTemplates() match
              case Success(templates) =>
                val items = templates.map(t => PollTemplateListItem(t.fileName, t.pollId, t.title, t.savedAt))
                complete(StatusCodes.OK, items)
              case Failure(ex) =>
                complete(StatusCodes.InternalServerError, ErrorResponse(s"Failed to list templates: ${ex.getMessage}"))
          }
        } ~
        path(Segment / "recover") { fileName =>
          post {
            authenticated { username =>
              TemplateService.loadTemplate(fileName) match
                case Success(template) =>
                  val request = CreatePollRequest(
                    title = recoveredTitle(template.title),
                    choices = toChoiceInputs(template.choices),
                    votingMode = template.votingMode,
                    dailyReset = false,
                    titleTemplate = None,
                    requireApproval = false,
                    anonymousVoting = template.anonymousVoting
                  )
                  val response: Future[PollManager.CreatePollResponse] =
                    pollManager.ask(PollManager.CreatePoll(request, username, _))
                  onSuccess(response) {
                    case PollManager.PollCreated(poll) =>
                      TemplateService.deleteTemplate(fileName)
                      pollManager ! PollManager.BroadcastTemplateUpdate
                      complete(StatusCodes.Created, poll)
                    case PollManager.PollCreationFailed(message) =>
                      complete(StatusCodes.BadRequest, ErrorResponse(message))
                  }
                case Failure(ex) =>
                  complete(StatusCodes.NotFound, ErrorResponse(s"Template not found: ${ex.getMessage}"))
            }
          }
        } ~
        path(Segment) { fileName =>
          delete {
            authenticated { _ =>
              TemplateService.deleteTemplate(fileName) match
                case Success(true) =>
                  pollManager ! PollManager.BroadcastTemplateUpdate
                  complete(StatusCodes.OK, DeleteSuccessResponse(s"Template $fileName deleted"))
                case Success(false) =>
                  complete(StatusCodes.NotFound, ErrorResponse("Template not found"))
                case Failure(ex) =>
                  complete(StatusCodes.InternalServerError, ErrorResponse(s"Failed to delete: ${ex.getMessage}"))
            }
          }
        }
      }
    }
