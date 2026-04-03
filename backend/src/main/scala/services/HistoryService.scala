package services

import models._
import io.circe.parser.decode
import io.circe.syntax._
import java.nio.file.{Files, Paths}
import java.io.File
import scala.util.{Try, Success, Failure}

object HistoryService:
  private val historyDir = "poll-history"

  private def init(): Unit =
    val dir = new File(historyDir)
    if !dir.exists() then dir.mkdirs()

  private def historyFile(pollId: String) = Paths.get(historyDir, s"$pollId.json")

  def getHistory(pollId: String): Try[PollHistory] =
    Try {
      init()
      val path = historyFile(pollId)
      if Files.exists(path) then
        decode[PollHistory](new String(Files.readAllBytes(path))).toTry.get
      else
        PollHistory(version = "1", pollId = pollId, pollTitle = "", snapshots = List.empty)
    }

  def appendSnapshot(pollId: String, pollTitle: String, snapshot: PollSnapshot): Try[Unit] =
    Try {
      init()
      val existing = getHistory(pollId).getOrElse(
        PollHistory(version = "1", pollId = pollId, pollTitle = pollTitle, snapshots = List.empty)
      )
      val updated = existing.copy(
        pollTitle = pollTitle,
        snapshots = (snapshot :: existing.snapshots).sortBy(_.timestamp)
      )
      Files.write(historyFile(pollId), updated.asJson.spaces2.getBytes)
    }

  def mergeAndSave(pollId: String, pollTitle: String, incoming: PollHistory): Try[PollHistory] =
    Try {
      init()
      val existing = getHistory(pollId).getOrElse(
        PollHistory(version = "1", pollId = pollId, pollTitle = pollTitle, snapshots = List.empty)
      )
      val merged = existing.copy(
        pollId    = pollId,
        pollTitle = if pollTitle.nonEmpty then pollTitle else existing.pollTitle,
        version   = if incoming.version > existing.version then incoming.version else existing.version,
        snapshots = (existing.snapshots ++ incoming.snapshots)
          .groupBy(_.snapshotId)
          .values
          .map(_.head)
          .toList
          .sortBy(_.timestamp)
      )
      Files.write(historyFile(pollId), merged.asJson.spaces2.getBytes)
      merged
    }

  def listAllHistories(): Try[List[PollHistory]] =
    Try {
      init()
      val dir = new java.io.File(historyDir)
      if !dir.exists() then List.empty
      else
        dir.listFiles()
          .filter(_.getName.endsWith(".json"))
          .flatMap { file =>
            scala.util.Try {
              decode[PollHistory](new String(Files.readAllBytes(file.toPath))).toTry.get
            }.toOption
          }
          .filter(_.snapshots.nonEmpty)
          .toList
          .sortBy(h => -h.snapshots.map(_.timestamp).max)
    }

  def deleteHistory(pollId: String): Try[Unit] =
    Try {
      val path = historyFile(pollId)
      if Files.exists(path) then Files.delete(path)
    }

  def deleteSnapshot(pollId: String, snapshotId: String): Try[Unit] =
    Try {
      init()
      val path = historyFile(pollId)
      if Files.exists(path) then
        val history = decode[PollHistory](new String(Files.readAllBytes(path))).toTry.get
        val updated = history.copy(snapshots = history.snapshots.filter(_.snapshotId != snapshotId))
        if updated.snapshots.isEmpty then Files.delete(path)
        else Files.write(path, updated.asJson.spaces2.getBytes)
    }
