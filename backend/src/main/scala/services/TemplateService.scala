package services

import models._
import io.circe.parser.decode
import io.circe.syntax._
import java.nio.file.{Files, Paths, StandardOpenOption}
import java.io.File
import scala.util.Try

object TemplateService:
  private val templatesDir = "poll-templates"

  def init(): Unit =
    val dir = new File(templatesDir)
    if !dir.exists() then
      dir.mkdirs()
      println(s"Created templates directory: ${dir.getAbsolutePath}")

  def saveTemplate(poll: PollResponse): Try[String] =
    Try {
      init()
      val fileName = s"${poll.id}_${System.currentTimeMillis()}.json"
      val filePath = Paths.get(templatesDir, fileName)
      Files.write(filePath, poll.asJson.spaces2.getBytes, StandardOpenOption.CREATE)
      println(s"Saved poll template: ${filePath.toString}")
      fileName
    }

  private def parseTemplateFile(file: File): Option[PollTemplate] =
    Try {
      val content = new String(Files.readAllBytes(file.toPath))
      val poll    = decode[PollResponse](content).toTry.get
      PollTemplate(file.getName, poll.id, poll.title, file.lastModified(), poll)
    }.toOption

  def listTemplates(): Try[List[PollTemplate]] =
    Try {
      init()
      val dir = new File(templatesDir)
      if !dir.exists() then List.empty
      else
        dir.listFiles()
          .filter(_.getName.endsWith(".json"))
          .flatMap(parseTemplateFile)
          .toList
          .sortBy(-_.savedAt)
    }

  def loadTemplate(fileName: String): Try[PollResponse] =
    Try {
      val filePath = Paths.get(templatesDir, fileName)
      val content  = new String(Files.readAllBytes(filePath))
      decode[PollResponse](content).toTry.get
    }

  def deleteTemplate(fileName: String): Try[Boolean] =
    Try {
      val filePath = Paths.get(templatesDir, fileName)
      Files.deleteIfExists(filePath)
    }

case class PollTemplate(
  fileName: String,
  pollId: String,
  title: String,
  savedAt: Long,
  poll: PollResponse
)
