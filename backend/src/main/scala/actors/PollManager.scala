package actors

import org.apache.pekko.actor.typed.{ActorRef, Behavior}
import org.apache.pekko.actor.typed.scaladsl.Behaviors
import models._
import services.TemplateService
import scala.collection.mutable

object PollManager:
  sealed trait Command
  case class CreatePoll(request: CreatePollRequest, replyTo: ActorRef[CreatePollResponse]) extends Command
  case class GetPoll(pollId: String, replyTo: ActorRef[GetPollResponse]) extends Command
  case class GetAllPolls(replyTo: ActorRef[GetAllPollsResponse]) extends Command
  case class VotePoll(pollId: String, restaurantId: String, username: String, replyTo: ActorRef[VotePollResponse]) extends Command
  case class EditPoll(pollId: String, title: String, restaurants: List[Restaurant], replyTo: ActorRef[EditPollResponse]) extends Command
  case class ResetPollVotes(pollId: String, replyTo: ActorRef[ResetPollResponse]) extends Command
  case class DeletePoll(pollId: String, replyTo: ActorRef[DeletePollResponse]) extends Command
  case class Subscribe(subscriber: ActorRef[PollUpdate]) extends Command
  case class Unsubscribe(subscriber: ActorRef[PollUpdate]) extends Command

  case class PollUpdate(poll: PollResponse)

  private case class WrappedVoteResponse(
    pollId: String,
    response: PollActor.VoteResponse,
    originalReplyTo: ActorRef[VotePollResponse]
  ) extends Command

  private case class WrappedPollResponse(
    response: PollResponse,
    originalReplyTo: ActorRef[GetPollResponse]
  ) extends Command

  private case class WrappedResetResponse(
    response: PollResponse,
    originalReplyTo: ActorRef[ResetPollResponse]
  ) extends Command

  private case class WrappedEditResponse(
    response: PollActor.EditPollResponse,
    originalReplyTo: ActorRef[EditPollResponse]
  ) extends Command

  sealed trait CreatePollResponse
  case class PollCreated(poll: PollResponse) extends CreatePollResponse
  case class PollCreationFailed(message: String) extends CreatePollResponse

  sealed trait GetPollResponse
  case class PollFound(poll: PollResponse) extends GetPollResponse
  case class PollNotFound(message: String) extends GetPollResponse

  case class GetAllPollsResponse(polls: List[PollResponse])

  sealed trait VotePollResponse
  case class VoteSuccess(poll: PollResponse) extends VotePollResponse
  case class VoteFailure(message: String) extends VotePollResponse

  sealed trait ResetPollResponse
  case class ResetSuccess(poll: PollResponse) extends ResetPollResponse
  case class ResetFailure(message: String) extends ResetPollResponse

  sealed trait EditPollResponse
  case class EditSuccess(poll: PollResponse) extends EditPollResponse
  case class EditFailure(message: String) extends EditPollResponse

  sealed trait DeletePollResponse
  case class DeleteSuccess(message: String) extends DeletePollResponse
  case class DeleteFailure(message: String) extends DeletePollResponse

  def apply(): Behavior[Command] =
    Behaviors.setup { context =>
      val polls = mutable.Map[String, ActorRef[PollActor.Command]]()
      val subscribers = mutable.Set[ActorRef[PollUpdate]]()

      def notifySubscribers(poll: PollResponse): Unit =
        subscribers.foreach(_ ! PollUpdate(poll))

      def behavior(): Behavior[Command] =
        Behaviors.receiveMessage {
          case Subscribe(subscriber) =>
            subscribers += subscriber
            Behaviors.same

          case Unsubscribe(subscriber) =>
            subscribers -= subscriber
            Behaviors.same

          case CreatePoll(request, replyTo) =>
            val votingMode = request.votingMode.toLowerCase match
              case "single" => VotingMode.Single
              case _ => VotingMode.Multiple

            val poll = Poll(
              title = request.title,
              restaurants = request.restaurants.map(r => Restaurant(name = r.name, description = r.description)),
              votingMode = votingMode,
              createdBy = request.createdBy
            )
            val pollActor = context.spawn(PollActor(poll), s"poll-${poll.id}")
            polls += (poll.id -> pollActor)

            val votingModeStr = votingMode match
              case VotingMode.Single => "single"
              case VotingMode.Multiple => "multiple"

            val pollResponse = PollResponse(
              poll.id,
              poll.title,
              poll.restaurants,
              poll.totalVotes,
              poll.active,
              votingModeStr,
              poll.createdBy,
              List.empty,
              false
            )
            replyTo ! PollCreated(pollResponse)
            notifySubscribers(pollResponse)  // Notify all subscribers about new poll
            Behaviors.same

          case GetPoll(pollId, replyTo) =>
            polls.get(pollId) match
              case Some(pollActor) =>
                val responseAdapter = context.messageAdapter[PollResponse] { response =>
                  WrappedPollResponse(response, replyTo)
                }
                pollActor ! PollActor.GetPoll(responseAdapter)
                Behaviors.same
              case None =>
                replyTo ! PollNotFound(s"Poll with id $pollId not found")
                Behaviors.same

          case WrappedPollResponse(response, originalReplyTo) =>
            originalReplyTo ! PollFound(response)
            Behaviors.same

          case GetAllPolls(replyTo) =>
            if polls.isEmpty then
              replyTo ! GetAllPollsResponse(List.empty)
              Behaviors.same
            else
              // Collect all poll responses
              var responses = List[PollResponse]()
              var remaining = polls.size

              polls.foreach { case (_, pollActor) =>
                pollActor ! PollActor.GetPoll(context.messageAdapter { response =>
                  responses = response :: responses
                  remaining -= 1
                  if remaining == 0 then
                    replyTo ! GetAllPollsResponse(responses)
                  WrappedPollResponse(response, context.system.ignoreRef)
                })
              }
              Behaviors.same

          case VotePoll(pollId, restaurantId, username, replyTo) =>
            polls.get(pollId) match
              case Some(pollActor) =>
                val responseAdapter = context.messageAdapter[PollActor.VoteResponse] { response =>
                  WrappedVoteResponse(pollId, response, replyTo)
                }
                pollActor ! PollActor.Vote(restaurantId, username, responseAdapter)
                Behaviors.same
              case None =>
                replyTo ! VoteFailure(s"Poll with id $pollId not found")
                Behaviors.same

          case WrappedVoteResponse(_, response, originalReplyTo) =>
            response match
              case PollActor.VoteSuccess(poll) =>
                originalReplyTo ! VoteSuccess(poll)
                notifySubscribers(poll)  // Notify all subscribers about the update
              case PollActor.VoteFailure(message) =>
                originalReplyTo ! VoteFailure(message)
            Behaviors.same

          case ResetPollVotes(pollId, replyTo) =>
            polls.get(pollId) match
              case Some(pollActor) =>
                val responseAdapter = context.messageAdapter[PollResponse] { response =>
                  WrappedResetResponse(response, replyTo)
                }
                pollActor ! PollActor.ResetVotes(responseAdapter)
                Behaviors.same
              case None =>
                replyTo ! ResetFailure(s"Poll with id $pollId not found")
                Behaviors.same

          case WrappedResetResponse(response, originalReplyTo) =>
            originalReplyTo ! ResetSuccess(response)
            notifySubscribers(response)  // Notify all subscribers about the reset
            Behaviors.same

          case EditPoll(pollId, title, restaurants, replyTo) =>
            polls.get(pollId) match
              case Some(pollActor) =>
                val responseAdapter = context.messageAdapter[PollActor.EditPollResponse] { response =>
                  WrappedEditResponse(response, replyTo)
                }
                pollActor ! PollActor.EditPoll(title, restaurants, responseAdapter)
                Behaviors.same
              case None =>
                replyTo ! EditFailure(s"Poll with id $pollId not found")
                Behaviors.same

          case WrappedEditResponse(response, originalReplyTo) =>
            response match
              case PollActor.EditSuccess(poll) =>
                originalReplyTo ! EditSuccess(poll)
                notifySubscribers(poll)  // Notify all subscribers about the edit
              case PollActor.EditFailure(message) =>
                originalReplyTo ! EditFailure(message)
            Behaviors.same

          case DeletePoll(pollId, replyTo) =>
            polls.get(pollId) match
              case Some(pollActor) =>
                // Get poll data before deleting
                val responseAdapter = context.messageAdapter[PollResponse] { response =>
                  // Save as template
                  TemplateService.saveTemplate(response) match
                    case scala.util.Success(fileName) =>
                      println(s"Saved template: $fileName")
                    case scala.util.Failure(ex) =>
                      println(s"Failed to save template: ${ex.getMessage}")

                  // Create deleted poll response
                  val deletedResponse = response.copy(deleted = true)
                  notifySubscribers(deletedResponse)
                  WrappedPollResponse(response, context.system.ignoreRef)
                }
                pollActor ! PollActor.GetPoll(responseAdapter)

                context.stop(pollActor)
                polls -= pollId
                replyTo ! DeleteSuccess(s"Poll $pollId deleted successfully")
                Behaviors.same
              case None =>
                replyTo ! DeleteFailure(s"Poll with id $pollId not found")
                Behaviors.same
        }

      behavior()
    }
