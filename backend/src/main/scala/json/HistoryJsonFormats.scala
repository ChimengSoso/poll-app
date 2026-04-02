package json

import spray.json._
import models._

object HistoryJsonFormats extends DefaultJsonProtocol:

  // Custom reader helper — same pattern as PollResponse
  private def field[T: JsonReader](o: JsObject, key: String, default: T): T =
    o.fields.get(key).map(_.convertTo[T]).getOrElse(default)

  implicit val choiceSummaryFormat: RootJsonFormat[ChoiceSummary] = new RootJsonFormat[ChoiceSummary]:
    def write(c: ChoiceSummary): JsValue = JsObject(
      "name"   -> c.name.toJson,
      "votes"  -> c.votes.toJson,
      "voters" -> c.voters.toJson
    )
    def read(v: JsValue): ChoiceSummary =
      val o = v.asJsObject
      ChoiceSummary(
        name   = o.fields("name").convertTo[String],
        votes  = o.fields("votes").convertTo[Int],
        voters = field(o, "voters", List.empty[String])
      )

  implicit val snapshotSummaryFormat: RootJsonFormat[SnapshotSummary] = new RootJsonFormat[SnapshotSummary]:
    def write(s: SnapshotSummary): JsValue = JsObject(
      "title"           -> s.title.toJson,
      "totalVotes"      -> s.totalVotes.toJson,
      "votingMode"      -> s.votingMode.toJson,
      "anonymousVoting" -> s.anonymousVoting.toJson,
      "choices"         -> s.choices.toJson,
      "winner"          -> s.winner.toJson
    )
    def read(v: JsValue): SnapshotSummary =
      val o = v.asJsObject
      SnapshotSummary(
        title           = o.fields("title").convertTo[String],
        totalVotes      = o.fields("totalVotes").convertTo[Int],
        votingMode      = o.fields("votingMode").convertTo[String],
        anonymousVoting = field(o, "anonymousVoting", false),
        choices         = o.fields("choices").convertTo[List[ChoiceSummary]],
        winner          = field(o, "winner", Option.empty[String])
      )

  implicit val pollSnapshotFormat: RootJsonFormat[PollSnapshot] = new RootJsonFormat[PollSnapshot]:
    def write(s: PollSnapshot): JsValue = JsObject(
      "snapshotId" -> s.snapshotId.toJson,
      "timestamp"  -> s.timestamp.toJson,
      "event"      -> s.event.toJson,
      "closedBy"   -> s.closedBy.toJson,
      "summary"    -> s.summary.toJson
    )
    def read(v: JsValue): PollSnapshot =
      val o = v.asJsObject
      PollSnapshot(
        snapshotId = o.fields("snapshotId").convertTo[String],
        timestamp  = o.fields("timestamp").convertTo[Long],
        event      = o.fields("event").convertTo[String],
        closedBy   = field(o, "closedBy", "unknown"),
        summary    = o.fields("summary").convertTo[SnapshotSummary]
      )

  implicit val pollHistoryFormat: RootJsonFormat[PollHistory] = new RootJsonFormat[PollHistory]:
    def write(h: PollHistory): JsValue = JsObject(
      "version"   -> h.version.toJson,
      "pollId"    -> h.pollId.toJson,
      "pollTitle" -> h.pollTitle.toJson,
      "snapshots" -> h.snapshots.toJson
    )
    def read(v: JsValue): PollHistory =
      val o = v.asJsObject
      PollHistory(
        version   = field(o, "version", "1"),
        pollId    = o.fields("pollId").convertTo[String],
        pollTitle = field(o, "pollTitle", ""),
        snapshots = o.fields("snapshots").convertTo[List[PollSnapshot]]
      )
