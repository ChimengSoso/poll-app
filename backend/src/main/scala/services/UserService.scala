package services

import models.User
import io.circe.parser.decode
import io.circe.syntax._
import java.nio.file.{Files, Paths, StandardOpenOption}
import scala.util.{Try, Failure}

object UserService:
  private val usersFile = "users.json"

  private def readUsers(): List[User] =
    val path = Paths.get(usersFile)
    if !Files.exists(path) then List.empty
    else decode[List[User]](new String(Files.readAllBytes(path))).getOrElse(List.empty)

  private def writeUsers(users: List[User]): Try[Unit] = Try {
    Files.write(
      Paths.get(usersFile),
      users.asJson.spaces2.getBytes,
      StandardOpenOption.CREATE,
      StandardOpenOption.TRUNCATE_EXISTING
    )
  }

  def findUser(username: String): Option[User] =
    readUsers().find(_.username == username)

  def createUser(username: String, passwordHash: String, salt: String): Try[Unit] =
    val users = readUsers()
    if users.exists(_.username == username) then
      Failure(Exception(s"Username $username already taken"))
    else
      writeUsers(User(username, passwordHash, salt, System.currentTimeMillis()) :: users)

  def updatePassword(username: String, newHash: String, newSalt: String): Try[Unit] =
    writeUsers(readUsers().map { u =>
      if u.username == username then u.copy(passwordHash = newHash, salt = newSalt)
      else u
    })
