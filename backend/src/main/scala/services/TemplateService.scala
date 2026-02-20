package services

import models._
import spray.json._
import json.JsonFormats._
import java.nio.file.{Files, Paths, Path, StandardOpenOption}
import java.io.File
import scala.util.{Try, Success, Failure}
import scala.jdk.CollectionConverters._

object TemplateService:
  private val templatesDir = "poll-templates"
  
  // Initialize templates directory
  def init(): Unit =
    val dir = new File(templatesDir)
    if !dir.exists() then
      dir.mkdirs()
      println(s"Created templates directory: ${dir.getAbsolutePath}")
  
  // Save poll as template
  def saveTemplate(poll: PollResponse): Try[String] =
    Try {
      init()
      val fileName = s"${poll.id}_${System.currentTimeMillis()}.json"
      val filePath = Paths.get(templatesDir, fileName)
      
      val jsonContent = poll.toJson.prettyPrint
      Files.write(filePath, jsonContent.getBytes, StandardOpenOption.CREATE)
      
      println(s"Saved poll template: ${filePath.toString}")
      fileName
    }
  
  // List all templates
  def listTemplates(): Try[List[PollTemplate]] =
    Try {
      init()
      val dir = new File(templatesDir)
      if !dir.exists() then
        List.empty
      else
        dir.listFiles()
          .filter(_.getName.endsWith(".json"))
          .map { file =>
            val content = new String(Files.readAllBytes(file.toPath))
            val poll = content.parseJson.convertTo[PollResponse]
            PollTemplate(
              fileName = file.getName,
              pollId = poll.id,
              title = poll.title,
              savedAt = file.lastModified(),
              poll = poll
            )
          }
          .toList
          .sortBy(-_.savedAt)
    }
  
  // Load template by filename
  def loadTemplate(fileName: String): Try[PollResponse] =
    Try {
      val filePath = Paths.get(templatesDir, fileName)
      val content = new String(Files.readAllBytes(filePath))
      content.parseJson.convertTo[PollResponse]
    }
  
  // Delete template file
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
