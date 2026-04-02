package services

import models.{ResetRequest, ResetStatusResponse}
import scala.collection.mutable
import java.util.UUID

object ResetService:
  val THRESHOLD = 5
  val EXPIRY_MS: Long = 24L * 60 * 60 * 1000

  private val requests = mutable.Map[String, ResetRequest]()

  def isExpired(r: ResetRequest): Boolean =
    System.currentTimeMillis() - r.requestedAt > EXPIRY_MS

  def isApproved(r: ResetRequest): Boolean =
    r.votes.size >= THRESHOLD

  def create(username: String, newPasswordHash: String, newSalt: String): ResetRequest =
    requests.filterInPlace((_, r) => r.username != username)
    val r = ResetRequest(
      id = UUID.randomUUID().toString,
      username = username,
      newPasswordHash = newPasswordHash,
      newSalt = newSalt,
      requestedAt = System.currentTimeMillis(),
      votes = Set.empty
    )
    requests(r.id) = r
    r

  def addVote(requestId: String, voter: String): Option[ResetRequest] =
    requests.get(requestId).flatMap { r =>
      if isExpired(r) then
        requests.remove(requestId)
        None
      else if r.votes.contains(voter) then None
      else
        val updated = r.copy(votes = r.votes + voter)
        requests(requestId) = updated
        Some(updated)
    }

  def getStatus(requestId: String): Option[ResetRequest] =
    requests.get(requestId).filter(!isExpired(_))

  def findPendingForUsername(username: String): Option[ResetRequest] =
    requests.values.find(r => r.username == username && !isExpired(r))

  def listActive(): List[ResetRequest] =
    cleanup()
    requests.values.toList

  def remove(requestId: String): Unit =
    requests.remove(requestId)
    ()

  def cleanup(): Unit =
    requests.filterInPlace((_, r) => !isExpired(r))

  def toStatusResponse(r: ResetRequest): ResetStatusResponse =
    val status =
      if isApproved(r) then "approved"
      else if isExpired(r) then "expired"
      else "pending"
    ResetStatusResponse(
      requestId = r.id,
      username = r.username,
      votes = r.votes.size,
      threshold = THRESHOLD,
      status = status,
      expiresAt = r.requestedAt + EXPIRY_MS
    )
