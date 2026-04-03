package models

import io.circe.{Decoder, Encoder}
import io.circe.generic.semiauto.{deriveDecoder, deriveEncoder}

case class HashedPassword(hash: String, salt: String)

case class User(username: String, passwordHash: String, salt: String, createdAt: Long)
object User:
  given Encoder[User] = deriveEncoder
  given Decoder[User] = deriveDecoder

case class LoginRequest(username: String, password: String)
object LoginRequest:
  given Encoder[LoginRequest] = deriveEncoder
  given Decoder[LoginRequest] = deriveDecoder

case class RegisterRequest(username: String, password: String)
object RegisterRequest:
  given Encoder[RegisterRequest] = deriveEncoder
  given Decoder[RegisterRequest] = deriveDecoder

case class AuthResponse(token: String, username: String)
object AuthResponse:
  given Encoder[AuthResponse] = deriveEncoder
  given Decoder[AuthResponse] = deriveDecoder

case class CheckUserRequest(username: String)
object CheckUserRequest:
  given Encoder[CheckUserRequest] = deriveEncoder
  given Decoder[CheckUserRequest] = deriveDecoder

case class CheckUserResponse(exists: Boolean)
object CheckUserResponse:
  given Encoder[CheckUserResponse] = deriveEncoder
  given Decoder[CheckUserResponse] = deriveDecoder

case class ForgotPasswordRequest(username: String, newPassword: String)
object ForgotPasswordRequest:
  given Encoder[ForgotPasswordRequest] = deriveEncoder
  given Decoder[ForgotPasswordRequest] = deriveDecoder

case class ForgotPasswordResponse(requestId: String, expiresAt: Long)
object ForgotPasswordResponse:
  given Encoder[ForgotPasswordResponse] = deriveEncoder
  given Decoder[ForgotPasswordResponse] = deriveDecoder

case class ResetRequest(
  id: String,
  username: String,
  newPasswordHash: String,
  newSalt: String,
  requestedAt: Long,
  votes: Set[String]
)

case class ResetStatusResponse(
  requestId: String,
  username: String,
  votes: Int,
  threshold: Int,
  status: String,
  expiresAt: Long
)
object ResetStatusResponse:
  given Encoder[ResetStatusResponse] = deriveEncoder
  given Decoder[ResetStatusResponse] = deriveDecoder
