package models

case class ChoiceSummary(
  name: String,
  votes: Int,
  voters: List[String] = List.empty
)

case class SnapshotSummary(
  title: String,
  totalVotes: Int,
  votingMode: String,
  anonymousVoting: Boolean = false,
  choices: List[ChoiceSummary],
  winner: Option[String] = None
)

case class PollSnapshot(
  snapshotId: String,
  timestamp: Long,
  event: String,
  closedBy: String,
  summary: SnapshotSummary
)

case class PollHistory(
  version: String,
  pollId: String,
  pollTitle: String,
  snapshots: List[PollSnapshot]
)
