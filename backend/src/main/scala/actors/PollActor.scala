package actors

import org.apache.pekko.actor.typed.{ActorRef, Behavior}
import org.apache.pekko.actor.typed.scaladsl.Behaviors
import models._
import java.time.LocalDate

object PollActor:
  sealed trait Command
  case class GetPoll(replyTo: ActorRef[PollResponse]) extends Command
  case class Vote(choiceId: String, username: String, replyTo: ActorRef[VoteResponse]) extends Command
  case class RemoveVote(choiceId: String, username: String, replyTo: ActorRef[RemoveVoteResponse]) extends Command
  case class UpdatePoll(poll: Poll, replyTo: ActorRef[PollResponse]) extends Command
  case class EditPoll(title: String, choices: List[Choice], dailyReset: Boolean, titleTemplate: Option[String], replyTo: ActorRef[EditPollResponse]) extends Command
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
      poll.choices,
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
          choices = poll.choices.map(_.copy(votes = 0, voters = List.empty)),
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

        case Vote(choiceId, username, replyTo) =>
          val current = applyDailyReset(poll)
          current.choices.find(_.id == choiceId) match
            case None =>
              replyTo ! VoteFailure(s"Choice with id $choiceId not found")
              active(current)

            case Some(choice) =>
              current.votingMode match
                case VotingMode.Single =>
                  if current.voters.contains(username) then
                    replyTo ! VoteFailure(s"User $username has already voted in this poll (single vote mode)")
                    active(current)
                  else
                    val updatedChoices = current.choices.map { r =>
                      if r.id == choiceId then r.copy(votes = r.votes + 1, voters = username :: r.voters)
                      else r
                    }
                    val updatedPoll = current.copy(
                      choices = updatedChoices,
                      totalVotes = current.totalVotes + 1,
                      voters = current.voters + username
                    )
                    replyTo ! VoteSuccess(toPollResponse(updatedPoll))
                    active(updatedPoll)

                case VotingMode.Multiple =>
                  if choice.voters.contains(username) then
                    replyTo ! VoteFailure(s"User $username has already voted for this choice")
                    active(current)
                  else
                    val updatedChoices = current.choices.map { r =>
                      if r.id == choiceId then r.copy(votes = r.votes + 1, voters = username :: r.voters)
                      else r
                    }
                    val updatedPoll = current.copy(
                      choices = updatedChoices,
                      totalVotes = current.totalVotes + 1,
                      voters = current.voters + username
                    )
                    replyTo ! VoteSuccess(toPollResponse(updatedPoll))
                    active(updatedPoll)

        case RemoveVote(choiceId, username, replyTo) =>
          poll.choices.find(_.id == choiceId) match
            case None =>
              replyTo ! RemoveVoteFailure(s"Choice with id $choiceId not found")
              Behaviors.same
            case Some(choice) =>
              if !choice.voters.contains(username) then
                replyTo ! RemoveVoteFailure(s"User $username has not voted for this choice")
                Behaviors.same
              else
                val updatedChoices = poll.choices.map { r =>
                  if r.id == choiceId then
                    r.copy(votes = r.votes - 1, voters = r.voters.filterNot(_ == username))
                  else r
                }
                val stillVotingElsewhere = updatedChoices.exists(_.voters.contains(username))
                val updatedVoters = if stillVotingElsewhere then poll.voters else poll.voters - username
                val updatedPoll = poll.copy(
                  choices = updatedChoices,
                  totalVotes = poll.totalVotes - 1,
                  voters = updatedVoters
                )
                replyTo ! RemoveVoteSuccess(toPollResponse(updatedPoll))
                active(updatedPoll)

        case UpdatePoll(newPoll, replyTo) =>
          replyTo ! toPollResponse(newPoll)
          active(newPoll)

        case EditPoll(title, choices, dailyReset, titleTemplate, replyTo) =>
          val updatedChoices = choices.map { newChoice =>
            poll.choices.find(_.name == newChoice.name) match
              case Some(existingChoice) =>
                newChoice.copy(votes = existingChoice.votes, voters = existingChoice.voters)
              case None =>
                newChoice
          }
          val updatedPoll = poll.copy(
            title = title,
            choices = updatedChoices,
            dailyReset = dailyReset,
            titleTemplate = titleTemplate
          )
          replyTo ! EditSuccess(toPollResponse(updatedPoll))
          active(updatedPoll)

        case ResetVotes(replyTo) =>
          val resetPoll = poll.copy(
            choices = poll.choices.map(_.copy(votes = 0, voters = List.empty)),
            totalVotes = 0,
            voters = Set.empty
          )
          replyTo ! toPollResponse(resetPoll)
          active(resetPoll)
    }
