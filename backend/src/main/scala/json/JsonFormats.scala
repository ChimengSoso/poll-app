package json

import spray.json._
import models._
import services.PollTemplate

case class DeleteSuccessResponse(message: String)
case class PollTemplateListItem(fileName: String, pollId: String, title: String, savedAt: Long)

object JsonFormats extends DefaultJsonProtocol:
  implicit val choiceInputFormat: RootJsonFormat[ChoiceInput] = jsonFormat2(ChoiceInput.apply)
  implicit val createPollRequestFormat: RootJsonFormat[CreatePollRequest] = jsonFormat7(CreatePollRequest.apply)
  implicit val choiceFormat: RootJsonFormat[Choice] = jsonFormat5(Choice.apply)
  implicit val pollResponseFormat: RootJsonFormat[PollResponse] = new RootJsonFormat[PollResponse]:
    def write(p: PollResponse): JsValue = JsObject(
      "id"             -> p.id.toJson,
      "title"          -> p.title.toJson,
      "choices"        -> p.choices.toJson,
      "totalVotes"     -> p.totalVotes.toJson,
      "active"         -> p.active.toJson,
      "votingMode"     -> p.votingMode.toJson,
      "createdBy"      -> p.createdBy.toJson,
      "voters"         -> p.voters.toJson,
      "deleted"        -> p.deleted.toJson,
      "dailyReset"     -> p.dailyReset.toJson,
      "titleTemplate"  -> p.titleTemplate.toJson,
      "requireApproval"  -> p.requireApproval.toJson,
      "approvedVoters"   -> p.approvedVoters.toJson,
      "pendingVoters"    -> p.pendingVoters.toJson,
      "anonymousVoting"  -> p.anonymousVoting.toJson
    )
    def read(v: JsValue): PollResponse =
      val o = v.asJsObject
      def field[T: JsonReader](key: String, default: T): T =
        o.fields.get(key).map(_.convertTo[T]).getOrElse(default)
      PollResponse(
        id             = o.fields("id").convertTo[String],
        title          = o.fields("title").convertTo[String],
        choices        = o.fields("choices").convertTo[List[Choice]],
        totalVotes     = o.fields("totalVotes").convertTo[Int],
        active         = o.fields("active").convertTo[Boolean],
        votingMode     = o.fields("votingMode").convertTo[String],
        createdBy      = field("createdBy", "anonymous"),
        voters         = field("voters", List.empty[String]),
        deleted        = field("deleted", false),
        dailyReset     = field("dailyReset", false),
        titleTemplate  = field("titleTemplate", Option.empty[String]),
        requireApproval  = field("requireApproval", false),
        approvedVoters   = field("approvedVoters", List.empty[String]),
        pendingVoters    = field("pendingVoters", List.empty[String]),
        anonymousVoting  = field("anonymousVoting", false)
      )
  implicit val voteRequestFormat: RootJsonFormat[VoteRequest] = jsonFormat1(VoteRequest.apply)
  implicit val removeVoteRequestFormat: RootJsonFormat[RemoveVoteRequest] = jsonFormat1(RemoveVoteRequest.apply)
  implicit val editPollRequestFormat: RootJsonFormat[EditPollRequest] = jsonFormat6(EditPollRequest.apply)
  implicit val errorResponseFormat: RootJsonFormat[ErrorResponse] = jsonFormat1(ErrorResponse.apply)
  implicit val deleteSuccessResponseFormat: RootJsonFormat[DeleteSuccessResponse] = jsonFormat1(DeleteSuccessResponse.apply)
  implicit val pollTemplateListItemFormat: RootJsonFormat[PollTemplateListItem] = jsonFormat4(PollTemplateListItem.apply)
  implicit val voterActionRequestFormat: RootJsonFormat[VoterActionRequest] = jsonFormat1(VoterActionRequest.apply)
