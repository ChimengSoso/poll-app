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
  case class EditPoll(title: String,
                      choices: List[Choice],
                      dailyReset: Boolean,
                      titleTemplate: Option[String],
                      requireApproval: Boolean,
                      anonymousVoting: Boolean,
                      replyTo: ActorRef[EditPollResponse]
  ) extends Command
  case class ResetVotes(replyTo: ActorRef[PollResponse]) extends Command
  case class RequestToVote(username: String, replyTo: ActorRef[VoterRequestResponse]) extends Command
  case class ApproveVoter(username: String, replyTo: ActorRef[VoterActionResponse]) extends Command
  case class RejectVoter(username: String, replyTo: ActorRef[VoterActionResponse]) extends Command
  case class RevokeVoter(username: String, replyTo: ActorRef[VoterActionResponse]) extends Command
  case class ClosePoll(replyTo: ActorRef[EditPollResponse]) extends Command
  case class ReopenPoll(replyTo: ActorRef[EditPollResponse]) extends Command
  case class ForceReset(replyTo: ActorRef[EditPollResponse]) extends Command

  sealed trait VoteResponse
  case class VoteSuccess(poll: PollResponse) extends VoteResponse
  case class VoteFailure(message: String) extends VoteResponse

  sealed trait RemoveVoteResponse
  case class RemoveVoteSuccess(poll: PollResponse) extends RemoveVoteResponse
  case class RemoveVoteFailure(message: String) extends RemoveVoteResponse

  sealed trait EditPollResponse
  case class EditSuccess(poll: PollResponse) extends EditPollResponse
  case class EditFailure(message: String) extends EditPollResponse

  sealed trait VoterRequestResponse
  case class VoterRequestSuccess(poll: PollResponse) extends VoterRequestResponse
  case class VoterRequestFailure(message: String) extends VoterRequestResponse

  sealed trait VoterActionResponse
  case class VoterActionSuccess(poll: PollResponse) extends VoterActionResponse
  case class VoterActionFailure(message: String) extends VoterActionResponse

  def apply(initialPoll: Poll): Behavior[Command] =
    active(initialPoll)

  // ── Pure helpers ────────────────────────────────────────────────────────────

  def votingModeString(mode: VotingMode): String = mode match
    case VotingMode.Single   => "single"
    case VotingMode.Multiple => "multiple"

  private def isBlockedByApproval(poll: Poll, username: String): Boolean =
    poll.requireApproval &&
    !poll.approvedVoters.contains(username) &&
    username != poll.createdBy

  private def clearVotes(poll: Poll): Poll =
    poll.copy(
      choices    = poll.choices.map(_.copy(votes = 0, voters = List.empty)),
      totalVotes = 0,
      voters     = Set.empty
    )

  private def castVote(poll: Poll, choiceId: String, username: String): Poll =
    val updatedChoices = poll.choices.map { c =>
      if c.id == choiceId then c.copy(votes = c.votes + 1, voters = username :: c.voters)
      else c
    }
    poll.copy(choices = updatedChoices, totalVotes = poll.totalVotes + 1, voters = poll.voters + username)

  private def removeVote(poll: Poll, choiceId: String, username: String): Poll =
    val updatedChoices = poll.choices.map { c =>
      if c.id == choiceId then c.copy(votes = c.votes - 1, voters = c.voters.filterNot(_ == username))
      else c
    }
    val stillVotingElsewhere = updatedChoices.exists(_.voters.contains(username))
    val updatedVoters        = if stillVotingElsewhere then poll.voters else poll.voters - username
    poll.copy(choices = updatedChoices, totalVotes = poll.totalVotes - 1, voters = updatedVoters)

  private def mergeChoices(oldChoices: List[Choice], newChoices: List[Choice]): List[Choice] =
    newChoices.map { newChoice =>
      oldChoices.find(_.name == newChoice.name) match
        case Some(existing) => newChoice.copy(votes = existing.votes, voters = existing.voters)
        case None           => newChoice
    }

  private def migrateApprovedVoters(poll: Poll, requireApproval: Boolean): Set[String] =
    if requireApproval && !poll.requireApproval then poll.approvedVoters ++ poll.voters
    else poll.approvedVoters

  private def toPollResponse(poll: Poll, deleted: Boolean = false): PollResponse =
    PollResponse(
      poll.id,
      poll.title,
      poll.choices,
      poll.totalVotes,
      poll.active,
      votingModeString(poll.votingMode),
      poll.createdBy,
      poll.voters.toList,
      deleted,
      poll.dailyReset,
      poll.titleTemplate,
      poll.requireApproval,
      poll.approvedVoters.toList,
      poll.pendingVoters.toList,
      poll.anonymousVoting
    )

  def resolveTitle(titleTemplate: Option[String], fallback: String): String =
    titleTemplate
      .map { t =>
        val date = LocalDate.now()
        t.replace("{date_en}", formatDateEn(date))
          .replace("{date_th}", formatDateTh(date))
          .replace("{date}", formatDateTh(date))
      }
      .getOrElse(fallback)

  private val thaiMonths = Array(
    "มกราคม",
    "กุมภาพันธ์",
    "มีนาคม",
    "เมษายน",
    "พฤษภาคม",
    "มิถุนายน",
    "กรกฎาคม",
    "สิงหาคม",
    "กันยายน",
    "ตุลาคม",
    "พฤศจิกายน",
    "ธันวาคม"
  )
  private val enMonths = Array(
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December"
  )

  private def formatDateEn(date: LocalDate): String =
    val day = f"${date.getDayOfMonth}%02d"
    val month = enMonths(date.getMonthValue - 1)
    val year = date.getYear
    s"$day $month $year"

  private def formatDateTh(date: LocalDate): String =
    val day = date.getDayOfMonth
    val month = thaiMonths(date.getMonthValue - 1)
    val year = date.getYear + 543
    s"วันที่ $day $month $year"

  // Returns poll with votes reset and title updated if today is a new day
  private def applyDailyReset(poll: Poll): Poll =
    if !poll.dailyReset then poll
    else
      val today = LocalDate.now().toString // ISO key e.g. "2026-04-02"
      if poll.lastResetDate.contains(today) then poll
      else
        val newTitle = resolveTitle(poll.titleTemplate, poll.title)
        clearVotes(poll).copy(title = newTitle, lastResetDate = Some(today))

  private def active(poll: Poll): Behavior[Command] =
    Behaviors.receiveMessage {
        case GetPoll(replyTo) =>
          val current = applyDailyReset(poll)
          replyTo ! toPollResponse(current)
          active(current)

        case Vote(choiceId, username, replyTo) =>
          val current = applyDailyReset(poll)
          if !current.active then
            replyTo ! VoteFailure("This poll is closed")
            active(current)
          else if isBlockedByApproval(current, username) then
            replyTo ! VoteFailure(s"User $username is not approved to vote in this poll")
            active(current)
          else
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
                      val updated = castVote(current, choiceId, username)
                      replyTo ! VoteSuccess(toPollResponse(updated))
                      active(updated)

                  case VotingMode.Multiple =>
                    if choice.voters.contains(username) then
                      replyTo ! VoteFailure(s"User $username has already voted for this choice")
                      active(current)
                    else
                      val updated = castVote(current, choiceId, username)
                      replyTo ! VoteSuccess(toPollResponse(updated))
                      active(updated)

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
                val updated = removeVote(poll, choiceId, username)
                replyTo ! RemoveVoteSuccess(toPollResponse(updated))
                active(updated)

        case UpdatePoll(newPoll, replyTo) =>
          replyTo ! toPollResponse(newPoll)
          active(newPoll)

        case EditPoll(title, choices, dailyReset, titleTemplate, requireApproval, anonymousVoting, replyTo) =>
          val updatedPoll = poll.copy(
            title           = title,
            choices         = mergeChoices(poll.choices, choices),
            dailyReset      = dailyReset,
            titleTemplate   = titleTemplate,
            requireApproval = requireApproval,
            approvedVoters  = migrateApprovedVoters(poll, requireApproval),
            anonymousVoting = anonymousVoting
          )
          replyTo ! EditSuccess(toPollResponse(updatedPoll))
          active(updatedPoll)

        case ResetVotes(replyTo) =>
          val resetPoll = clearVotes(poll).copy(active = true)
          replyTo ! toPollResponse(resetPoll)
          active(resetPoll)

        case RequestToVote(username, replyTo) =>
          if poll.approvedVoters.contains(username) then
            replyTo ! VoterRequestFailure(s"User $username is already approved")
            Behaviors.same
          else if poll.pendingVoters.contains(username) then
            replyTo ! VoterRequestFailure(s"User $username already has a pending request")
            Behaviors.same
          else
            val updatedPoll = poll.copy(pendingVoters = poll.pendingVoters + username)
            replyTo ! VoterRequestSuccess(toPollResponse(updatedPoll))
            active(updatedPoll)

        case ApproveVoter(username, replyTo) =>
          if !poll.pendingVoters.contains(username) then
            replyTo ! VoterActionFailure(s"User $username does not have a pending request")
            Behaviors.same
          else
            val updatedPoll = poll.copy(
              pendingVoters = poll.pendingVoters - username,
              approvedVoters = poll.approvedVoters + username
            )
            replyTo ! VoterActionSuccess(toPollResponse(updatedPoll))
            active(updatedPoll)

        case RejectVoter(username, replyTo) =>
          if !poll.pendingVoters.contains(username) then
            replyTo ! VoterActionFailure(s"User $username does not have a pending request")
            Behaviors.same
          else
            val updatedPoll = poll.copy(pendingVoters = poll.pendingVoters - username)
            replyTo ! VoterActionSuccess(toPollResponse(updatedPoll))
            active(updatedPoll)

        case RevokeVoter(username, replyTo) =>
          if !poll.approvedVoters.contains(username) then
            replyTo ! VoterActionFailure(s"User $username is not in the approved list")
            Behaviors.same
          else
            val updatedPoll = poll.copy(approvedVoters = poll.approvedVoters - username)
            replyTo ! VoterActionSuccess(toPollResponse(updatedPoll))
            active(updatedPoll)

        case ClosePoll(replyTo) =>
          val updated = poll.copy(active = false)
          replyTo ! EditSuccess(toPollResponse(updated))
          active(updated)

        case ReopenPoll(replyTo) =>
          val updated = poll.copy(active = true)
          replyTo ! EditSuccess(toPollResponse(updated))
          active(updated)

        case ForceReset(replyTo) =>
          val withClearedDate = poll.copy(lastResetDate = None)
          val reset = applyDailyReset(withClearedDate).copy(active = true)
          replyTo ! EditSuccess(toPollResponse(reset))
          active(reset)
    }
