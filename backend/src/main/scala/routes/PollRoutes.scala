package routes

import org.apache.pekko.actor.typed.{ActorRef, ActorSystem, Behavior}
import org.apache.pekko.actor.typed.scaladsl.{AskPattern, Behaviors}
import org.apache.pekko.actor.typed.scaladsl.AskPattern._
import org.apache.pekko.http.scaladsl.server.Directives._
import org.apache.pekko.http.scaladsl.server.Route
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
import services.TemplateService
import json.JsonFormats.{_, given}
import json.{DeleteSuccessResponse, PollTemplateListItem}
import org.apache.pekko.http.scaladsl.marshallers.sprayjson.SprayJsonSupport._
import org.apache.pekko.http.scaladsl.marshalling.sse.EventStreamMarshalling._
import spray.json._
import scala.util.{Success, Failure}

class PollRoutes(pollManager: ActorRef[PollManager.Command])(using system: ActorSystem[_]):
  given timeout: Timeout = 5.seconds
  import system.executionContext

  // CORS headers
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
              complete(StatusCodes.OK, result.polls.toJson)
            }
          } ~
          post {
            entity(as[CreatePollRequest]) { request =>
              val response: Future[PollManager.CreatePollResponse] =
                pollManager.ask(PollManager.CreatePoll(request, _))
              onSuccess(response) {
                case PollManager.PollCreated(poll) =>
                  complete(StatusCodes.Created, poll)
                case PollManager.PollCreationFailed(message) =>
                  complete(StatusCodes.BadRequest, ErrorResponse(message))
              }
            }
          }
        } ~
        path("updates") {
          get {
            val (queue, source) = Source.queue[PollManager.PollUpdate](100, OverflowStrategy.dropHead)
              .map { update =>
                ServerSentEvent(update.poll.toJson.compactPrint, eventType = Some("poll-update"))
              }
              .keepAlive(15.seconds, () => ServerSentEvent.heartbeat)
              .preMaterialize()

            val subscriberActor = system.systemActorOf(
              Behaviors.receive[PollManager.PollUpdate] { (ctx, update) =>
                queue.offer(update)
                Behaviors.same
              },
              s"sse-subscriber-${System.currentTimeMillis()}"
            )

            pollManager ! PollManager.Subscribe(subscriberActor)

            complete(source)
          }
        } ~
        path(Segment / "vote") { pollId =>
          post {
            entity(as[VoteRequest]) { voteRequest =>
              val response: Future[PollManager.VotePollResponse] =
                pollManager.ask(PollManager.VotePoll(pollId, voteRequest.choiceId, voteRequest.username, _))
              onSuccess(response) {
                case PollManager.VoteSuccess(poll) =>
                  complete(StatusCodes.OK, poll)
                case PollManager.VoteFailure(message) =>
                  complete(StatusCodes.BadRequest, ErrorResponse(message))
              }
            }
          } ~
          delete {
            entity(as[RemoveVoteRequest]) { removeRequest =>
              val response: Future[PollManager.RemovePollVoteResponse] =
                pollManager.ask(PollManager.RemovePollVote(pollId, removeRequest.choiceId, removeRequest.username, _))
              onSuccess(response) {
                case PollManager.RemoveVoteSuccess(poll) =>
                  complete(StatusCodes.OK, poll)
                case PollManager.RemoveVoteFailure(message) =>
                  complete(StatusCodes.BadRequest, ErrorResponse(message))
              }
            }
          }
        } ~
        path(Segment / "request-vote") { pollId =>
          post {
            entity(as[VoterActionRequest]) { req =>
              val response: Future[PollManager.VoterRequestPollResponse] =
                pollManager.ask(PollManager.RequestPollVote(pollId, req.username, _))
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
        } ~
        path(Segment / "reject-voter") { pollId =>
          post {
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
        } ~
        path(Segment / "voters" / Segment) { (pollId, voterUsername) =>
          delete {
            val response: Future[PollManager.VoterActionPollResponse] =
              pollManager.ask(PollManager.RevokePollVoter(pollId, voterUsername, _))
            onSuccess(response) {
              case PollManager.VoterActionSuccess(poll) =>
                complete(StatusCodes.OK, poll)
              case PollManager.VoterActionFailure(message) =>
                complete(StatusCodes.BadRequest, ErrorResponse(message))
            }
          }
        } ~
        path(Segment / "reset") { pollId =>
          post {
            val response: Future[PollManager.ResetPollResponse] =
              pollManager.ask(PollManager.ResetPollVotes(pollId, _))
            onSuccess(response) {
              case PollManager.ResetSuccess(poll) =>
                complete(StatusCodes.OK, poll)
              case PollManager.ResetFailure(message) =>
                complete(StatusCodes.NotFound, ErrorResponse(message))
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
            entity(as[EditPollRequest]) { editRequest =>
              val choices = editRequest.choices.map(r => Choice(name = r.name, description = r.description))
              val response: Future[PollManager.EditPollResponse] =
                pollManager.ask(PollManager.EditPoll(pollId, editRequest.title, choices, editRequest.dailyReset, editRequest.titleTemplate, editRequest.requireApproval, _))
              onSuccess(response) {
                case PollManager.EditSuccess(poll) =>
                  complete(StatusCodes.OK, poll)
                case PollManager.EditFailure(message) =>
                  complete(StatusCodes.BadRequest, ErrorResponse(message))
              }
            }
          } ~
          delete {
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
      } ~
      pathPrefix("api" / "templates") {
        pathEnd {
          get {
            TemplateService.listTemplates() match
              case Success(templates) =>
                val items = templates.map(t => PollTemplateListItem(t.fileName, t.pollId, t.title, t.savedAt))
                complete(StatusCodes.OK, items.toJson)
              case Failure(ex) =>
                complete(StatusCodes.InternalServerError, ErrorResponse(s"Failed to list templates: ${ex.getMessage}"))
          }
        } ~
        path(Segment / "recover") { fileName =>
          post {
            TemplateService.loadTemplate(fileName) match
              case Success(template) =>
                val choices = template.choices.map(r => ChoiceInput(r.name, r.description))
                val request = CreatePollRequest(
                  title = s"${template.title} (Recovered)",
                  choices = choices,
                  votingMode = template.votingMode,
                  createdBy = template.createdBy,
                  dailyReset = false,
                  titleTemplate = None,
                  requireApproval = false
                )
                val response: Future[PollManager.CreatePollResponse] =
                  pollManager.ask(PollManager.CreatePoll(request, _))
                onSuccess(response) {
                  case PollManager.PollCreated(poll) =>
                    complete(StatusCodes.Created, poll)
                  case PollManager.PollCreationFailed(message) =>
                    complete(StatusCodes.BadRequest, ErrorResponse(message))
                }
              case Failure(ex) =>
                complete(StatusCodes.NotFound, ErrorResponse(s"Template not found: ${ex.getMessage}"))
          }
        } ~
        path(Segment) { fileName =>
          delete {
            TemplateService.deleteTemplate(fileName) match
              case Success(true) =>
                complete(StatusCodes.OK, DeleteSuccessResponse(s"Template $fileName deleted"))
              case Success(false) =>
                complete(StatusCodes.NotFound, ErrorResponse("Template not found"))
              case Failure(ex) =>
                complete(StatusCodes.InternalServerError, ErrorResponse(s"Failed to delete: ${ex.getMessage}"))
          }
        }
      }
    }
