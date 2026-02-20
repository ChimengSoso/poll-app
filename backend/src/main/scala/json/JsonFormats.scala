package json

import spray.json._
import models._
import services.PollTemplate

case class DeleteSuccessResponse(message: String)
case class PollTemplateListItem(fileName: String, pollId: String, title: String, savedAt: Long)

object JsonFormats extends DefaultJsonProtocol:
  implicit val restaurantInputFormat: RootJsonFormat[RestaurantInput] = jsonFormat2(RestaurantInput.apply)
  implicit val createPollRequestFormat: RootJsonFormat[CreatePollRequest] = jsonFormat4(CreatePollRequest.apply)
  implicit val restaurantFormat: RootJsonFormat[Restaurant] = jsonFormat5(Restaurant.apply)
  implicit val pollResponseFormat: RootJsonFormat[PollResponse] = jsonFormat9(PollResponse.apply)
  implicit val voteRequestFormat: RootJsonFormat[VoteRequest] = jsonFormat2(VoteRequest.apply)
  implicit val editPollRequestFormat: RootJsonFormat[EditPollRequest] = jsonFormat2(EditPollRequest.apply)
  implicit val errorResponseFormat: RootJsonFormat[ErrorResponse] = jsonFormat1(ErrorResponse.apply)
  implicit val deleteSuccessResponseFormat: RootJsonFormat[DeleteSuccessResponse] = jsonFormat1(DeleteSuccessResponse.apply)
  implicit val pollTemplateListItemFormat: RootJsonFormat[PollTemplateListItem] = jsonFormat4(PollTemplateListItem.apply)
