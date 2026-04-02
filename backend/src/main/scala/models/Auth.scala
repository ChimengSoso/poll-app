package models

case class User(
  username: String,
  passwordHash: String,
  salt: String,
  createdAt: Long
)

case class LoginRequest(username: String, password: String)
case class RegisterRequest(username: String, password: String)
case class AuthResponse(token: String, username: String)
case class CheckUserRequest(username: String)
case class CheckUserResponse(exists: Boolean)
case class ForgotPasswordRequest(username: String, newPassword: String)
case class ForgotPasswordResponse(requestId: String, expiresAt: Long)

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
