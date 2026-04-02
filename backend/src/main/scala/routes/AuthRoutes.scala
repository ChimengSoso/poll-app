package routes

import org.apache.pekko.actor.typed.{ActorRef, ActorSystem}
import org.apache.pekko.actor.typed.scaladsl.Behaviors
import org.apache.pekko.http.scaladsl.server.Directives._
import org.apache.pekko.http.scaladsl.server.{Route, Directive1}
import org.apache.pekko.http.scaladsl.model.StatusCodes
import org.apache.pekko.http.scaladsl.model.headers._
import org.apache.pekko.http.scaladsl.model.sse.ServerSentEvent
import org.apache.pekko.stream.scaladsl.Source
import org.apache.pekko.stream.OverflowStrategy
import scala.concurrent.duration._
import services.{AuthService, UserService, ResetService}
import models._
import json.JsonFormats.{_, given}
import json.AuthJsonFormats.{_, given}
import org.apache.pekko.http.scaladsl.marshallers.sprayjson.SprayJsonSupport._
import org.apache.pekko.http.scaladsl.marshalling.sse.EventStreamMarshalling._
import spray.json._
import scala.collection.mutable

class AuthRoutes()(using system: ActorSystem[_]):

  private val corsHeaders = List(
    `Access-Control-Allow-Origin`.*,
    `Access-Control-Allow-Methods`(
      org.apache.pekko.http.scaladsl.model.HttpMethods.GET,
      org.apache.pekko.http.scaladsl.model.HttpMethods.POST,
      org.apache.pekko.http.scaladsl.model.HttpMethods.PUT,
      org.apache.pekko.http.scaladsl.model.HttpMethods.DELETE,
      org.apache.pekko.http.scaladsl.model.HttpMethods.OPTIONS
    ),
    `Access-Control-Allow-Headers`("Content-Type", "Authorization")
  )

  private val subscribers = mutable.Set[ActorRef[String]]()

  private def rawEventToSse(raw: String): ServerSentEvent =
    val colonAt   = raw.indexOf(':')
    val eventType = raw.substring(0, colonAt)
    val data      = raw.substring(colonAt + 1)
    ServerSentEvent(data, eventType = Some(eventType))

  private def broadcast(eventType: String, data: String): Unit =
    subscribers.synchronized {
      subscribers.foreach { sub =>
        try sub ! s"$eventType:$data" catch case _: Exception => ()
      }
    }

  def authenticated: Directive1[String] =
    optionalHeaderValueByName("Authorization").flatMap {
      case Some(header) =>
        AuthService.validateToken(header.stripPrefix("Bearer ")) match
          case Some(username) => provide(username)
          case None           => complete(StatusCodes.Unauthorized, ErrorResponse("Invalid or expired token"))
      case None =>
        complete(StatusCodes.Unauthorized, ErrorResponse("Authentication required"))
    }

  val routes: Route =
    respondWithHeaders(corsHeaders) {
      pathPrefix("api" / "auth") {
        path("check") {
          post {
            entity(as[CheckUserRequest]) { req =>
              val exists = UserService.findUser(req.username).isDefined
              complete(StatusCodes.OK, CheckUserResponse(exists))
            }
          }
        } ~
        path("register") {
          post {
            entity(as[RegisterRequest]) { req =>
              UserService.findUser(req.username) match
                case Some(_) =>
                  complete(StatusCodes.Conflict, ErrorResponse(s"Username '${req.username}' is already taken"))
                case None =>
                  val (hash, salt) = AuthService.hashPassword(req.password)
                  UserService.createUser(req.username, hash, salt) match
                    case scala.util.Success(_) =>
                      val token = AuthService.generateToken(req.username)
                      complete(StatusCodes.Created, AuthResponse(token, req.username))
                    case scala.util.Failure(ex) =>
                      complete(StatusCodes.InternalServerError, ErrorResponse(ex.getMessage))
            }
          }
        } ~
        path("login") {
          post {
            entity(as[LoginRequest]) { req =>
              UserService.findUser(req.username) match
                case None =>
                  complete(StatusCodes.Unauthorized, ErrorResponse("Invalid username or password"))
                case Some(user) =>
                  if AuthService.verifyPassword(req.password, user.passwordHash, user.salt) then
                    val token = AuthService.generateToken(req.username)
                    complete(StatusCodes.OK, AuthResponse(token, req.username))
                  else
                    complete(StatusCodes.Unauthorized, ErrorResponse("Invalid username or password"))
            }
          }
        } ~
        path("forgot-password") {
          post {
            entity(as[ForgotPasswordRequest]) { req =>
              UserService.findUser(req.username) match
                case None =>
                  complete(StatusCodes.NotFound, ErrorResponse(s"User '${req.username}' not found"))
                case Some(_) =>
                  ResetService.findPendingForUsername(req.username) match
                    case Some(_) =>
                      complete(StatusCodes.Conflict, ErrorResponse("A reset request is already pending for this user"))
                    case None =>
                      val (newHash, newSalt) = AuthService.hashPassword(req.newPassword)
                      val r = ResetService.create(req.username, newHash, newSalt)
                      broadcast("reset-update", ResetService.toStatusResponse(r).toJson.compactPrint)
                      complete(StatusCodes.OK, ForgotPasswordResponse(r.id, r.requestedAt + ResetService.EXPIRY_MS))
            }
          }
        } ~
        path("reset-votes" / Segment) { requestId =>
          post {
            authenticated { voter =>
              ResetService.getStatus(requestId) match
                case None =>
                  complete(StatusCodes.NotFound, ErrorResponse("Reset request not found or expired"))
                case Some(r) =>
                  if r.username == voter then
                    complete(StatusCodes.BadRequest, ErrorResponse("You cannot vote on your own reset request"))
                  else if r.votes.contains(voter) then
                    complete(StatusCodes.BadRequest, ErrorResponse("You have already voted on this request"))
                  else
                    ResetService.addVote(requestId, voter) match
                      case None =>
                        complete(StatusCodes.NotFound, ErrorResponse("Reset request not found or expired"))
                      case Some(updated) =>
                        if ResetService.isApproved(updated) then
                          UserService.updatePassword(updated.username, updated.newPasswordHash, updated.newSalt)
                          ResetService.remove(requestId)
                          val payload = JsObject(
                            "requestId" -> JsString(requestId),
                            "username"  -> JsString(updated.username)
                          ).compactPrint
                          broadcast("reset-approved", payload)
                        else
                          broadcast("reset-update", ResetService.toStatusResponse(updated).toJson.compactPrint)
                        complete(StatusCodes.OK, ResetService.toStatusResponse(updated))
            }
          }
        } ~
        path("reset-status" / Segment) { requestId =>
          get {
            ResetService.getStatus(requestId) match
              case None    => complete(StatusCodes.NotFound, ErrorResponse("Reset request not found or expired"))
              case Some(r) => complete(StatusCodes.OK, ResetService.toStatusResponse(r))
          }
        } ~
        path("pending-resets") {
          get {
            authenticated { _ =>
              val active = ResetService.listActive().map(ResetService.toStatusResponse)
              complete(StatusCodes.OK, active.toJson)
            }
          }
        } ~
        path("updates") {
          get {
            val (queue, source) = Source.queue[String](100, OverflowStrategy.dropHead)
              .map(rawEventToSse)
              .keepAlive(15.seconds, () => ServerSentEvent.heartbeat)
              .preMaterialize()

            val actor = system.systemActorOf(
              Behaviors.receive[String] { (_, msg) =>
                queue.offer(msg)
                Behaviors.same
              },
              s"reset-sse-${System.nanoTime()}"
            )
            subscribers.synchronized { subscribers += actor }
            complete(source)
          }
        }
      }
    }
