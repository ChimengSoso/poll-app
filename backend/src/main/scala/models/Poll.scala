package models

import java.util.UUID
import io.circe.{Decoder, Encoder}
import io.circe.generic.semiauto.{deriveDecoder, deriveEncoder}

enum VotingMode:
  case Single, Multiple

object VotingMode:
  given Encoder[VotingMode] = Encoder[String].contramap {
    case VotingMode.Single   => "single"
    case VotingMode.Multiple => "multiple"
  }
  given Decoder[VotingMode] = Decoder[String].emap {
    case "single"   => Right(VotingMode.Single)
    case "multiple" => Right(VotingMode.Multiple)
    case other      => Left(s"Unknown voting mode: $other")
  }

case class Choice(
  id: String = UUID.randomUUID().toString,
  name: String,
  description: Option[String] = None,
  votes: Int = 0,
  voters: List[String] = List.empty
)
object Choice:
  given Encoder[Choice] = deriveEncoder
  given Decoder[Choice] = Decoder.instance { c =>
    for
      id          <- c.getOrElse[String]("id")(UUID.randomUUID().toString)
      name        <- c.downField("name").as[String]
      description <- c.getOrElse[Option[String]]("description")(None)
      votes       <- c.getOrElse[Int]("votes")(0)
      voters      <- c.getOrElse[List[String]]("voters")(List.empty)
    yield Choice(id, name, description, votes, voters)
  }

case class Poll(
  id: String = UUID.randomUUID().toString,
  title: String,
  choices: List[Choice] = List.empty,
  totalVotes: Int = 0,
  active: Boolean = true,
  votingMode: VotingMode = VotingMode.Multiple,
  createdBy: String = "anonymous",
  voters: Set[String] = Set.empty,
  dailyReset: Boolean = false,
  titleTemplate: Option[String] = None,
  lastResetDate: Option[String] = None,
  requireApproval: Boolean = false,
  approvedVoters: Set[String] = Set.empty,
  pendingVoters: Set[String] = Set.empty,
  anonymousVoting: Boolean = false
)

case class ChoiceInput(name: String, description: Option[String])
object ChoiceInput:
  given Encoder[ChoiceInput] = deriveEncoder
  given Decoder[ChoiceInput] = deriveDecoder

case class CreatePollRequest(
  title: String,
  choices: List[ChoiceInput],
  votingMode: String = "multiple",
  dailyReset: Boolean,
  titleTemplate: Option[String],
  requireApproval: Boolean,
  anonymousVoting: Boolean
)
object CreatePollRequest:
  given Encoder[CreatePollRequest] = deriveEncoder
  given Decoder[CreatePollRequest] = deriveDecoder

// username comes from JWT — body only carries choiceId
case class VoteRequest(choiceId: String)
object VoteRequest:
  given Encoder[VoteRequest] = deriveEncoder
  given Decoder[VoteRequest] = deriveDecoder

case class RemoveVoteRequest(choiceId: String)
object RemoveVoteRequest:
  given Encoder[RemoveVoteRequest] = deriveEncoder
  given Decoder[RemoveVoteRequest] = deriveDecoder

case class EditPollRequest(
  title: String,
  choices: List[ChoiceInput],
  dailyReset: Boolean,
  titleTemplate: Option[String],
  requireApproval: Boolean,
  anonymousVoting: Boolean
)
object EditPollRequest:
  given Encoder[EditPollRequest] = deriveEncoder
  given Decoder[EditPollRequest] = deriveDecoder

case class PollResponse(
  id: String,
  title: String,
  choices: List[Choice],
  totalVotes: Int,
  active: Boolean,
  votingMode: String,
  createdBy: String,
  voters: List[String],
  deleted: Boolean = false,
  dailyReset: Boolean = false,
  titleTemplate: Option[String] = None,
  requireApproval: Boolean = false,
  approvedVoters: List[String] = List.empty,
  pendingVoters: List[String] = List.empty,
  anonymousVoting: Boolean = false
)
object PollResponse:
  given Encoder[PollResponse] = deriveEncoder
  // Custom decoder provides safe defaults for fields added in later versions
  given Decoder[PollResponse] = Decoder.instance { c =>
    for
      id              <- c.downField("id").as[String]
      title           <- c.downField("title").as[String]
      choices         <- c.downField("choices").as[List[Choice]]
      totalVotes      <- c.downField("totalVotes").as[Int]
      active          <- c.downField("active").as[Boolean]
      votingMode      <- c.downField("votingMode").as[String]
      createdBy       <- c.getOrElse[String]("createdBy")("anonymous")
      voters          <- c.getOrElse[List[String]]("voters")(List.empty)
      deleted         <- c.getOrElse[Boolean]("deleted")(false)
      dailyReset      <- c.getOrElse[Boolean]("dailyReset")(false)
      titleTemplate   <- c.getOrElse[Option[String]]("titleTemplate")(None)
      requireApproval <- c.getOrElse[Boolean]("requireApproval")(false)
      approvedVoters  <- c.getOrElse[List[String]]("approvedVoters")(List.empty)
      pendingVoters   <- c.getOrElse[List[String]]("pendingVoters")(List.empty)
      anonymousVoting <- c.getOrElse[Boolean]("anonymousVoting")(false)
    yield PollResponse(id, title, choices, totalVotes, active, votingMode,
      createdBy, voters, deleted, dailyReset, titleTemplate,
      requireApproval, approvedVoters, pendingVoters, anonymousVoting)
  }

case class ErrorResponse(message: String)
object ErrorResponse:
  given Encoder[ErrorResponse] = deriveEncoder
  given Decoder[ErrorResponse] = deriveDecoder

case class VoterActionRequest(username: String)
object VoterActionRequest:
  given Encoder[VoterActionRequest] = deriveEncoder
  given Decoder[VoterActionRequest] = deriveDecoder

case class ReopenRequest(password: String)
object ReopenRequest:
  given Encoder[ReopenRequest] = deriveEncoder
  given Decoder[ReopenRequest] = deriveDecoder

case class DeleteSuccessResponse(message: String)
object DeleteSuccessResponse:
  given Encoder[DeleteSuccessResponse] = deriveEncoder
  given Decoder[DeleteSuccessResponse] = deriveDecoder

case class PollTemplateListItem(fileName: String, pollId: String, title: String, savedAt: Long)
object PollTemplateListItem:
  given Encoder[PollTemplateListItem] = deriveEncoder
  given Decoder[PollTemplateListItem] = deriveDecoder
