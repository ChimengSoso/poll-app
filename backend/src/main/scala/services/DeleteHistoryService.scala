package services

import models.DeleteHistoryStatus
import scala.collection.mutable
import java.util.UUID

case class DeleteHistoryRequest(
  requestId: String,
  pollId: String,
  snapshotId: String,
  closedBy: String,
  threshold: Int,
  votes: Set[String],
  requestedAt: Long
)

object DeleteHistoryService:
  private val requests = mutable.Map[String, DeleteHistoryRequest]()

  def findForSnapshot(pollId: String, snapshotId: String): Option[DeleteHistoryRequest] =
    requests.values.find(r => r.pollId == pollId && r.snapshotId == snapshotId)

  def create(pollId: String, snapshotId: String, closedBy: String, threshold: Int): DeleteHistoryRequest =
    requests.filterInPlace((_, r) => !(r.pollId == pollId && r.snapshotId == snapshotId))
    val r = DeleteHistoryRequest(
      requestId    = UUID.randomUUID().toString,
      pollId       = pollId,
      snapshotId   = snapshotId,
      closedBy     = closedBy,
      threshold    = threshold,
      votes        = Set.empty,
      requestedAt  = System.currentTimeMillis()
    )
    requests(r.requestId) = r
    r

  def addVote(requestId: String, voter: String): Option[DeleteHistoryRequest] =
    requests.get(requestId).map { r =>
      if r.votes.contains(voter) then r
      else
        val updated = r.copy(votes = r.votes + voter)
        requests(requestId) = updated
        updated
    }

  def removeVote(requestId: String, voter: String): Option[DeleteHistoryRequest] =
    requests.get(requestId).map { r =>
      val updated = r.copy(votes = r.votes - voter)
      requests(requestId) = updated
      updated
    }

  def isReady(r: DeleteHistoryRequest): Boolean =
    r.votes.size >= r.threshold

  def get(requestId: String): Option[DeleteHistoryRequest] =
    requests.get(requestId)

  def listAll(): List[DeleteHistoryRequest] =
    requests.values.toList

  def remove(requestId: String): Unit =
    requests.remove(requestId)
    ()

  def toStatus(r: DeleteHistoryRequest): DeleteHistoryStatus =
    DeleteHistoryStatus(
      requestId  = r.requestId,
      pollId     = r.pollId,
      snapshotId = r.snapshotId,
      closedBy   = r.closedBy,
      threshold  = r.threshold,
      votes      = r.votes.size,
      voters     = r.votes.toList,
      ready      = isReady(r)
    )
