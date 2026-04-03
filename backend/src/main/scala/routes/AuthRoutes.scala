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
import services.{AuthService, UserService, ResetService, HistoryService, DeleteHistoryService}
import models._
import json.CirceSupport.given
import io.circe.syntax._
import io.circe.Json
import org.apache.pekko.http.scaladsl.marshalling.sse.EventStreamMarshalling._
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

  private def commitApprovedReset(requestId: String, updated: ResetRequest): Unit =
    UserService.updatePassword(updated.username, updated.newPasswordHash, updated.newSalt)
    ResetService.remove(requestId)
    val payload = Json.obj(
      "requestId" -> Json.fromString(requestId),
      "username"  -> Json.fromString(updated.username)
    ).noSpaces
    broadcast("reset-approved", payload)

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
                  val hp = AuthService.hashPassword(req.password)
                  UserService.createUser(req.username, hp.hash, hp.salt) match
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
                    // Cancel any pending reset request for this user (they remembered their password)
                    ResetService.findPendingForUsername(req.username).foreach { r =>
                      ResetService.remove(r.id)
                      val payload = Json.obj(
                        "requestId" -> Json.fromString(r.id),
                        "username"  -> Json.fromString(r.username)
                      ).noSpaces
                      broadcast("reset-cancelled", payload)
                    }
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
                      val hp = AuthService.hashPassword(req.newPassword)
                      val r = ResetService.create(req.username, hp.hash, hp.salt)
                      broadcast("reset-update", ResetService.toStatusResponse(r).asJson.noSpaces)
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
                        if ResetService.isApproved(updated) then commitApprovedReset(requestId, updated)
                        else broadcast("reset-update", ResetService.toStatusResponse(updated).asJson.noSpaces)
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
        path("reset-request" / Segment) { requestId =>
          delete {
            ResetService.getStatus(requestId) match
              case None =>
                complete(StatusCodes.NotFound, ErrorResponse("Reset request not found or expired"))
              case Some(r) =>
                ResetService.remove(requestId)
                val payload = Json.obj(
                  "requestId" -> Json.fromString(requestId),
                  "username"  -> Json.fromString(r.username)
                ).noSpaces
                broadcast("reset-cancelled", payload)
                complete(StatusCodes.OK, Json.obj("ok" -> Json.fromBoolean(true)).noSpaces)
          }
        } ~
        path("pending-resets") {
          get {
            authenticated { _ =>
              val active = ResetService.listActive().map(ResetService.toStatusResponse)
              complete(StatusCodes.OK, active)
            }
          }
        } ~
        path("history-delete") {
          get {
            authenticated { _ =>
              val all = DeleteHistoryService.listAll().map(DeleteHistoryService.toStatus)
              complete(StatusCodes.OK, all)
            }
          } ~
          post {
            authenticated { requester =>
              entity(as[CreateDeleteHistoryRequest]) { req =>
                HistoryService.getHistory(req.pollId) match
                  case scala.util.Failure(_) =>
                    complete(StatusCodes.NotFound, ErrorResponse("History not found"))
                  case scala.util.Success(history) =>
                    history.snapshots.find(_.snapshotId == req.snapshotId) match
                      case None =>
                        complete(StatusCodes.NotFound, ErrorResponse("Snapshot not found"))
                      case Some(snapshot) =>
                        val threshold = math.max(1, snapshot.summary.choices.map(_.votes).maxOption.getOrElse(0))
                        val existing = DeleteHistoryService.findForSnapshot(req.pollId, req.snapshotId)
                        if snapshot.closedBy == requester then
                          complete(StatusCodes.Forbidden, ErrorResponse("The poll closer cannot vote — they can only approve once the threshold is reached"))
                        else
                          val base = existing.getOrElse(
                            DeleteHistoryService.create(req.pollId, req.snapshotId, snapshot.closedBy, threshold)
                          )
                          val updated =
                            if base.votes.contains(requester) then base
                            else DeleteHistoryService.addVote(base.requestId, requester).getOrElse(base)
                          broadcast("history-delete-update", DeleteHistoryService.toStatus(updated).asJson.noSpaces)
                          complete(StatusCodes.OK, DeleteHistoryService.toStatus(updated))
              }
            }
          }
        } ~
        path("history-delete" / Segment / "vote") { requestId =>
          delete {
            authenticated { voter =>
              DeleteHistoryService.get(requestId) match
                case None =>
                  complete(StatusCodes.NotFound, ErrorResponse("Delete request not found"))
                case Some(r) =>
                  if r.closedBy == voter then
                    complete(StatusCodes.Forbidden, ErrorResponse("The poll closer cannot vote on this request"))
                  else if !r.votes.contains(voter) then
                    complete(StatusCodes.BadRequest, ErrorResponse("You have not voted on this request"))
                  else
                    val updated = DeleteHistoryService.removeVote(requestId, voter).getOrElse(r)
                    if updated.votes.isEmpty then
                      DeleteHistoryService.remove(requestId)
                      broadcast("history-delete-rejected", Json.obj(
                        "requestId"  -> Json.fromString(requestId),
                        "snapshotId" -> Json.fromString(r.snapshotId)
                      ).noSpaces)
                    else
                      broadcast("history-delete-update", DeleteHistoryService.toStatus(updated).asJson.noSpaces)
                    complete(StatusCodes.OK, DeleteHistoryService.toStatus(updated))
            }
          }
        } ~
        path("history-delete" / Segment / "approve") { requestId =>
          post {
            authenticated { approver =>
              DeleteHistoryService.get(requestId) match
                case None =>
                  complete(StatusCodes.NotFound, ErrorResponse("Delete request not found"))
                case Some(r) =>
                  if r.closedBy != approver then
                    complete(StatusCodes.Forbidden, ErrorResponse("Only the poll closer can approve this deletion"))
                  else if !DeleteHistoryService.isReady(r) then
                    complete(StatusCodes.BadRequest, ErrorResponse("Not enough votes yet"))
                  else
                    HistoryService.deleteSnapshot(r.pollId, r.snapshotId)
                    DeleteHistoryService.remove(requestId)
                    broadcast("history-delete-done", Json.obj(
                      "requestId"  -> Json.fromString(requestId),
                      "pollId"     -> Json.fromString(r.pollId),
                      "snapshotId" -> Json.fromString(r.snapshotId)
                    ).noSpaces)
                    complete(StatusCodes.OK, Json.obj("ok" -> Json.fromBoolean(true)).noSpaces)
            }
          }
        } ~
        path("history-delete" / Segment / "reject") { requestId =>
          post {
            authenticated { rejecter =>
              DeleteHistoryService.get(requestId) match
                case None =>
                  complete(StatusCodes.NotFound, ErrorResponse("Delete request not found"))
                case Some(r) =>
                  if r.closedBy != rejecter then
                    complete(StatusCodes.Forbidden, ErrorResponse("Only the poll closer can reject this deletion"))
                  else
                    DeleteHistoryService.remove(requestId)
                    broadcast("history-delete-rejected", Json.obj(
                      "requestId"  -> Json.fromString(requestId),
                      "snapshotId" -> Json.fromString(r.snapshotId)
                    ).noSpaces)
                    complete(StatusCodes.OK, Json.obj("ok" -> Json.fromBoolean(true)).noSpaces)
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
