package json

import spray.json._
import models._

object AuthJsonFormats extends DefaultJsonProtocol:
  implicit val loginRequestFormat: RootJsonFormat[LoginRequest] = jsonFormat2(LoginRequest.apply)
  implicit val registerRequestFormat: RootJsonFormat[RegisterRequest] = jsonFormat2(RegisterRequest.apply)
  implicit val authResponseFormat: RootJsonFormat[AuthResponse] = jsonFormat2(AuthResponse.apply)
  implicit val checkUserRequestFormat: RootJsonFormat[CheckUserRequest] = jsonFormat1(CheckUserRequest.apply)
  implicit val checkUserResponseFormat: RootJsonFormat[CheckUserResponse] = jsonFormat1(CheckUserResponse.apply)
  implicit val forgotPasswordRequestFormat: RootJsonFormat[ForgotPasswordRequest] = jsonFormat2(ForgotPasswordRequest.apply)
  implicit val forgotPasswordResponseFormat: RootJsonFormat[ForgotPasswordResponse] = jsonFormat2(ForgotPasswordResponse.apply)
  implicit val resetStatusResponseFormat: RootJsonFormat[ResetStatusResponse] = jsonFormat6(ResetStatusResponse.apply)
