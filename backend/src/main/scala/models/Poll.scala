package models

import java.util.UUID

// Voting mode enum
enum VotingMode:
  case Single   // Each user can vote for only one restaurant
  case Multiple // Each user can vote for multiple restaurants

case class Restaurant(
  id: String = UUID.randomUUID().toString,
  name: String,
  description: Option[String] = None,
  votes: Int = 0,
  voters: List[String] = List.empty  // List of usernames who voted for this
)

case class Poll(
  id: String = UUID.randomUUID().toString,
  title: String,
  restaurants: List[Restaurant] = List.empty,
  totalVotes: Int = 0,
  active: Boolean = true,
  votingMode: VotingMode = VotingMode.Multiple,
  createdBy: String = "anonymous",
  voters: Set[String] = Set.empty,       // All users who have voted in this poll
  dailyReset: Boolean = false,
  titleTemplate: Option[String] = None,  // e.g. "Lunch Poll {date}"
  lastResetDate: Option[String] = None   // ISO date of last auto-reset
)

case class CreatePollRequest(
  title: String,
  restaurants: List[RestaurantInput],
  votingMode: String = "multiple",  // "single" or "multiple"
  createdBy: String,
  dailyReset: Boolean,
  titleTemplate: Option[String]
)

case class RestaurantInput(
  name: String,
  description: Option[String]
)

case class VoteRequest(
  restaurantId: String,
  username: String
)

case class RemoveVoteRequest(
  restaurantId: String,
  username: String
)

case class EditPollRequest(
  title: String,
  restaurants: List[RestaurantInput],
  dailyReset: Boolean,
  titleTemplate: Option[String]
)

case class PollResponse(
  id: String,
  title: String,
  restaurants: List[Restaurant],
  totalVotes: Int,
  active: Boolean,
  votingMode: String,
  createdBy: String,
  voters: List[String],
  deleted: Boolean = false,
  dailyReset: Boolean = false,
  titleTemplate: Option[String] = None
)

case class ErrorResponse(message: String)
