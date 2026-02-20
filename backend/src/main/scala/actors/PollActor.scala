package actors

import org.apache.pekko.actor.typed.{ActorRef, Behavior}
import org.apache.pekko.actor.typed.scaladsl.Behaviors
import models._

object PollActor:
  sealed trait Command
  case class GetPoll(replyTo: ActorRef[PollResponse]) extends Command
  case class Vote(restaurantId: String, username: String, replyTo: ActorRef[VoteResponse]) extends Command
  case class UpdatePoll(poll: Poll, replyTo: ActorRef[PollResponse]) extends Command
  case class EditPoll(title: String, restaurants: List[Restaurant], replyTo: ActorRef[EditPollResponse]) extends Command
  case class ResetVotes(replyTo: ActorRef[PollResponse]) extends Command

  sealed trait VoteResponse
  case class VoteSuccess(poll: PollResponse) extends VoteResponse
  case class VoteFailure(message: String) extends VoteResponse

  sealed trait EditPollResponse
  case class EditSuccess(poll: PollResponse) extends EditPollResponse
  case class EditFailure(message: String) extends EditPollResponse

  def apply(initialPoll: Poll): Behavior[Command] =
    active(initialPoll)

  private def toPollResponse(poll: Poll, deleted: Boolean = false): PollResponse =
    val votingModeStr = poll.votingMode match
      case VotingMode.Single => "single"
      case VotingMode.Multiple => "multiple"

    PollResponse(
      poll.id,
      poll.title,
      poll.restaurants,
      poll.totalVotes,
      poll.active,
      votingModeStr,
      poll.createdBy,
      poll.voters.toList,
      deleted
    )

  private def active(poll: Poll): Behavior[Command] =
    Behaviors.receive { (context, message) =>
      message match
        case GetPoll(replyTo) =>
          replyTo ! toPollResponse(poll)
          Behaviors.same

        case Vote(restaurantId, username, replyTo) =>
          // Check if restaurant exists
          poll.restaurants.find(_.id == restaurantId) match
            case None =>
              replyTo ! VoteFailure(s"Restaurant with id $restaurantId not found")
              Behaviors.same

            case Some(restaurant) =>
              // Check voting mode restrictions
              poll.votingMode match
                case VotingMode.Single =>
                  // Single vote mode: user can only vote once for one restaurant
                  if poll.voters.contains(username) then
                    replyTo ! VoteFailure(s"User $username has already voted in this poll (single vote mode)")
                    Behaviors.same
                  else
                    // Allow vote
                    val updatedRestaurants = poll.restaurants.map { r =>
                      if r.id == restaurantId then
                        r.copy(votes = r.votes + 1, voters = username :: r.voters)
                      else r
                    }
                    val updatedPoll = poll.copy(
                      restaurants = updatedRestaurants,
                      totalVotes = poll.totalVotes + 1,
                      voters = poll.voters + username
                    )
                    replyTo ! VoteSuccess(toPollResponse(updatedPoll))
                    active(updatedPoll)

                case VotingMode.Multiple =>
                  // Multiple vote mode: user can vote for multiple restaurants
                  // but only once per restaurant
                  if restaurant.voters.contains(username) then
                    replyTo ! VoteFailure(s"User $username has already voted for this restaurant")
                    Behaviors.same
                  else
                    val updatedRestaurants = poll.restaurants.map { r =>
                      if r.id == restaurantId then
                        r.copy(votes = r.votes + 1, voters = username :: r.voters)
                      else r
                    }
                    val updatedPoll = poll.copy(
                      restaurants = updatedRestaurants,
                      totalVotes = poll.totalVotes + 1,
                      voters = poll.voters + username
                    )
                    replyTo ! VoteSuccess(toPollResponse(updatedPoll))
                    active(updatedPoll)

        case UpdatePoll(newPoll, replyTo) =>
          replyTo ! toPollResponse(newPoll)
          active(newPoll)

        case EditPoll(title, restaurants, replyTo) =>
          // Preserve existing votes when editing
          val updatedRestaurants = restaurants.map { newRest =>
            // Try to find matching restaurant by name to preserve votes
            poll.restaurants.find(_.name == newRest.name) match
              case Some(existingRest) =>
                newRest.copy(
                  votes = existingRest.votes,
                  voters = existingRest.voters
                )
              case None =>
                newRest // New restaurant, keep as is
          }

          val updatedPoll = poll.copy(
            title = title,
            restaurants = updatedRestaurants
          )
          replyTo ! EditSuccess(toPollResponse(updatedPoll))
          active(updatedPoll)

        case ResetVotes(replyTo) =>
          val resetRestaurants = poll.restaurants.map { r =>
            r.copy(votes = 0, voters = List.empty)
          }
          val resetPoll = poll.copy(
            restaurants = resetRestaurants,
            totalVotes = 0,
            voters = Set.empty
          )
          replyTo ! toPollResponse(resetPoll)
          active(resetPoll)
    }
