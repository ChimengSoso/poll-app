package models

import java.util.UUID

// Voting mode enum
enum VotingMode:
  case Single   // Each user can vote for only one choice
  case Multiple // Each user can vote for multiple choices

case class Choice(
  id: String = UUID.randomUUID().toString,
  name: String,
  description: Option[String] = None,
  votes: Int = 0,
  voters: List[String] = List.empty  // List of usernames who voted for this
)

case class Poll(
  id: String = UUID.randomUUID().toString,
  title: String,
  choices: List[Choice] = List.empty,
  totalVotes: Int = 0,
  active: Boolean = true,
  votingMode: VotingMode = VotingMode.Multiple,
  createdBy: String = "anonymous",
  voters: Set[String] = Set.empty,       // All users who have voted in this poll
  dailyReset: Boolean = false,
  titleTemplate: Option[String] = None,  // e.g. "Lunch Poll {date}"
  lastResetDate: Option[String] = None,  // ISO date of last auto-reset
  requireApproval: Boolean = false,
  approvedVoters: Set[String] = Set.empty,
  pendingVoters: Set[String] = Set.empty
)

case class CreatePollRequest(
  title: String,
  choices: List[ChoiceInput],
  votingMode: String = "multiple",  // "single" or "multiple"
  createdBy: String,
  dailyReset: Boolean,
  titleTemplate: Option[String],
  requireApproval: Boolean
)

case class ChoiceInput(
  name: String,
  description: Option[String]
)

case class VoteRequest(
  choiceId: String,
  username: String
)

case class RemoveVoteRequest(
  choiceId: String,
  username: String
)

case class EditPollRequest(
  title: String,
  choices: List[ChoiceInput],
  dailyReset: Boolean,
  titleTemplate: Option[String],
  requireApproval: Boolean
)

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
  pendingVoters: List[String] = List.empty
)

case class ErrorResponse(message: String)
case class VoterActionRequest(username: String)
