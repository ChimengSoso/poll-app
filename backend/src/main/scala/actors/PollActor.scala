package actors

import org.apache.pekko.actor.typed.{ActorRef, Behavior}
import org.apache.pekko.actor.typed.scaladsl.Behaviors
import models._
import java.time.LocalDate

object PollActor:
  sealed trait Command
  case class GetPoll(replyTo: ActorRef[PollResponse]) extends Command
  case class Vote(restaurantId: String, username: String, replyTo: ActorRef[VoteResponse]) extends Command
  case class RemoveVote(restaurantId: String, username: String, replyTo: ActorRef[RemoveVoteResponse]) extends Command
  case class UpdatePoll(poll: Poll, replyTo: ActorRef[PollResponse]) extends Command
  case class EditPoll(title: String, restaurants: List[Restaurant], dailyReset: Boolean, titleTemplate: Option[String], replyTo: ActorRef[EditPollResponse]) extends Command
  case class ResetVotes(replyTo: ActorRef[PollResponse]) extends Command

  sealed trait VoteResponse
  case class VoteSuccess(poll: PollResponse) extends VoteResponse
  case class VoteFailure(message: String) extends VoteResponse

  sealed trait RemoveVoteResponse
  case class RemoveVoteSuccess(poll: PollResponse) extends RemoveVoteResponse
  case class RemoveVoteFailure(message: String) extends RemoveVoteResponse

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
      deleted,
      poll.dailyReset,
      poll.titleTemplate
    )

  // Returns poll with votes reset and title updated if today is a new day
  private def applyDailyReset(poll: Poll): Poll =
    if !poll.dailyReset then poll
    else
      val today = LocalDate.now().toString  // e.g. "2026-04-01"
      if poll.lastResetDate.contains(today) then poll
      else
        val newTitle = poll.titleTemplate
          .map(_.replace("{date}", today))
          .getOrElse(poll.title)
        poll.copy(
          title = newTitle,
          restaurants = poll.restaurants.map(_.copy(votes = 0, voters = List.empty)),
          totalVotes = 0,
          voters = Set.empty,
          lastResetDate = Some(today)
        )

  private def active(poll: Poll): Behavior[Command] =
    Behaviors.receive { (context, message) =>
      message match
        case GetPoll(replyTo) =>
          val current = applyDailyReset(poll)
          replyTo ! toPollResponse(current)
          active(current)

        case Vote(restaurantId, username, replyTo) =>
          val current = applyDailyReset(poll)
          current.restaurants.find(_.id == restaurantId) match
            case None =>
              replyTo ! VoteFailure(s"Restaurant with id $restaurantId not found")
              active(current)

            case Some(restaurant) =>
              current.votingMode match
                case VotingMode.Single =>
                  if current.voters.contains(username) then
                    replyTo ! VoteFailure(s"User $username has already voted in this poll (single vote mode)")
                    active(current)
                  else
                    val updatedRestaurants = current.restaurants.map { r =>
                      if r.id == restaurantId then r.copy(votes = r.votes + 1, voters = username :: r.voters)
                      else r
                    }
                    val updatedPoll = current.copy(
                      restaurants = updatedRestaurants,
                      totalVotes = current.totalVotes + 1,
                      voters = current.voters + username
                    )
                    replyTo ! VoteSuccess(toPollResponse(updatedPoll))
                    active(updatedPoll)

                case VotingMode.Multiple =>
                  if restaurant.voters.contains(username) then
                    replyTo ! VoteFailure(s"User $username has already voted for this restaurant")
                    active(current)
                  else
                    val updatedRestaurants = current.restaurants.map { r =>
                      if r.id == restaurantId then r.copy(votes = r.votes + 1, voters = username :: r.voters)
                      else r
                    }
                    val updatedPoll = current.copy(
                      restaurants = updatedRestaurants,
                      totalVotes = current.totalVotes + 1,
                      voters = current.voters + username
                    )
                    replyTo ! VoteSuccess(toPollResponse(updatedPoll))
                    active(updatedPoll)

        case RemoveVote(restaurantId, username, replyTo) =>
          poll.restaurants.find(_.id == restaurantId) match
            case None =>
              replyTo ! RemoveVoteFailure(s"Restaurant with id $restaurantId not found")
              Behaviors.same
            case Some(restaurant) =>
              if !restaurant.voters.contains(username) then
                replyTo ! RemoveVoteFailure(s"User $username has not voted for this restaurant")
                Behaviors.same
              else
                val updatedRestaurants = poll.restaurants.map { r =>
                  if r.id == restaurantId then
                    r.copy(votes = r.votes - 1, voters = r.voters.filterNot(_ == username))
                  else r
                }
                val stillVotingElsewhere = updatedRestaurants.exists(_.voters.contains(username))
                val updatedVoters = if stillVotingElsewhere then poll.voters else poll.voters - username
                val updatedPoll = poll.copy(
                  restaurants = updatedRestaurants,
                  totalVotes = poll.totalVotes - 1,
                  voters = updatedVoters
                )
                replyTo ! RemoveVoteSuccess(toPollResponse(updatedPoll))
                active(updatedPoll)

        case UpdatePoll(newPoll, replyTo) =>
          replyTo ! toPollResponse(newPoll)
          active(newPoll)

        case EditPoll(title, restaurants, dailyReset, titleTemplate, replyTo) =>
          val updatedRestaurants = restaurants.map { newRest =>
            poll.restaurants.find(_.name == newRest.name) match
              case Some(existingRest) =>
                newRest.copy(votes = existingRest.votes, voters = existingRest.voters)
              case None =>
                newRest
          }
          val updatedPoll = poll.copy(
            title = title,
            restaurants = updatedRestaurants,
            dailyReset = dailyReset,
            titleTemplate = titleTemplate
          )
          replyTo ! EditSuccess(toPollResponse(updatedPoll))
          active(updatedPoll)

        case ResetVotes(replyTo) =>
          val resetPoll = poll.copy(
            restaurants = poll.restaurants.map(_.copy(votes = 0, voters = List.empty)),
            totalVotes = 0,
            voters = Set.empty
          )
          replyTo ! toPollResponse(resetPoll)
          active(resetPoll)
    }
