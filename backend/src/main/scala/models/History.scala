package models

import io.circe.{Decoder, Encoder}
import io.circe.generic.semiauto.{deriveDecoder, deriveEncoder}

case class ChoiceSummary(name: String, votes: Int, voters: List[String] = List.empty)
object ChoiceSummary:
  given Encoder[ChoiceSummary] = deriveEncoder
  given Decoder[ChoiceSummary] = Decoder.instance { c =>
    for
      name   <- c.downField("name").as[String]
      votes  <- c.downField("votes").as[Int]
      voters <- c.getOrElse[List[String]]("voters")(List.empty)
    yield ChoiceSummary(name, votes, voters)
  }

case class SnapshotSummary(
  title: String,
  totalVotes: Int,
  votingMode: String,
  anonymousVoting: Boolean = false,
  choices: List[ChoiceSummary],
  winner: Option[String] = None
)
object SnapshotSummary:
  given Encoder[SnapshotSummary] = deriveEncoder
  given Decoder[SnapshotSummary] = Decoder.instance { c =>
    for
      title           <- c.downField("title").as[String]
      totalVotes      <- c.downField("totalVotes").as[Int]
      votingMode      <- c.downField("votingMode").as[String]
      anonymousVoting <- c.getOrElse[Boolean]("anonymousVoting")(false)
      choices         <- c.downField("choices").as[List[ChoiceSummary]]
      winner          <- c.getOrElse[Option[String]]("winner")(None)
    yield SnapshotSummary(title, totalVotes, votingMode, anonymousVoting, choices, winner)
  }

case class PollSnapshot(
  snapshotId: String,
  timestamp: Long,
  event: String,
  closedBy: String,
  summary: SnapshotSummary
)
object PollSnapshot:
  given Encoder[PollSnapshot] = deriveEncoder
  given Decoder[PollSnapshot] = Decoder.instance { c =>
    for
      snapshotId <- c.downField("snapshotId").as[String]
      timestamp  <- c.downField("timestamp").as[Long]
      event      <- c.downField("event").as[String]
      closedBy   <- c.getOrElse[String]("closedBy")("unknown")
      summary    <- c.downField("summary").as[SnapshotSummary]
    yield PollSnapshot(snapshotId, timestamp, event, closedBy, summary)
  }

case class PollHistory(
  version: String,
  pollId: String,
  pollTitle: String,
  snapshots: List[PollSnapshot]
)
object PollHistory:
  given Encoder[PollHistory] = deriveEncoder
  given Decoder[PollHistory] = Decoder.instance { c =>
    for
      version   <- c.getOrElse[String]("version")("1")
      pollId    <- c.downField("pollId").as[String]
      pollTitle <- c.getOrElse[String]("pollTitle")("")
      snapshots <- c.downField("snapshots").as[List[PollSnapshot]]
    yield PollHistory(version, pollId, pollTitle, snapshots)
  }

case class DeleteHistoryStatus(
  requestId: String,
  pollId: String,
  snapshotId: String,
  closedBy: String,
  threshold: Int,
  votes: Int,
  voters: List[String],
  ready: Boolean
)
object DeleteHistoryStatus:
  given Encoder[DeleteHistoryStatus] = deriveEncoder
  given Decoder[DeleteHistoryStatus] = deriveDecoder

case class CreateDeleteHistoryRequest(pollId: String, snapshotId: String)
object CreateDeleteHistoryRequest:
  given Encoder[CreateDeleteHistoryRequest] = deriveEncoder
  given Decoder[CreateDeleteHistoryRequest] = deriveDecoder
