package json

import spray.json._
import models._
import services.PollTemplate

case class DeleteSuccessResponse(message: String)
case class PollTemplateListItem(fileName: String, pollId: String, title: String, savedAt: Long)

object JsonFormats extends DefaultJsonProtocol:
  implicit val choiceInputFormat: RootJsonFormat[ChoiceInput] = jsonFormat2(ChoiceInput.apply)
  implicit val createPollRequestFormat: RootJsonFormat[CreatePollRequest] = jsonFormat6(CreatePollRequest.apply)
  implicit val choiceFormat: RootJsonFormat[Choice] = jsonFormat5(Choice.apply)
  implicit val pollResponseFormat: RootJsonFormat[PollResponse] = jsonFormat14(PollResponse.apply)
  implicit val voteRequestFormat: RootJsonFormat[VoteRequest] = jsonFormat1(VoteRequest.apply)
  implicit val removeVoteRequestFormat: RootJsonFormat[RemoveVoteRequest] = jsonFormat1(RemoveVoteRequest.apply)
  implicit val editPollRequestFormat: RootJsonFormat[EditPollRequest] = jsonFormat5(EditPollRequest.apply)
  implicit val errorResponseFormat: RootJsonFormat[ErrorResponse] = jsonFormat1(ErrorResponse.apply)
  implicit val deleteSuccessResponseFormat: RootJsonFormat[DeleteSuccessResponse] = jsonFormat1(DeleteSuccessResponse.apply)
  implicit val pollTemplateListItemFormat: RootJsonFormat[PollTemplateListItem] = jsonFormat4(PollTemplateListItem.apply)
  implicit val voterActionRequestFormat: RootJsonFormat[VoterActionRequest] = jsonFormat1(VoterActionRequest.apply)
