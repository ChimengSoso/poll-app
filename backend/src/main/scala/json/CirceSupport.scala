package json

import org.apache.pekko.http.scaladsl.marshalling.{Marshaller, ToEntityMarshaller}
import org.apache.pekko.http.scaladsl.unmarshalling.{Unmarshaller, FromEntityUnmarshaller}
import org.apache.pekko.http.scaladsl.model.{ContentTypes, HttpEntity}
import io.circe.{Decoder, Encoder}
import io.circe.parser.decode
import io.circe.syntax._
import scala.concurrent.Future

object CirceSupport:

  given [A: Encoder]: ToEntityMarshaller[A] =
    Marshaller.withFixedContentType(ContentTypes.`application/json`) { value =>
      HttpEntity(ContentTypes.`application/json`, value.asJson.noSpaces)
    }

  // Explicit List marshaller to avoid ambiguity between encodeList and encodeSeq
  given [A: Encoder]: ToEntityMarshaller[List[A]] =
    Marshaller.withFixedContentType(ContentTypes.`application/json`) { list =>
      HttpEntity(ContentTypes.`application/json`, Encoder.encodeList[A].apply(list).noSpaces)
    }

  given [A: Decoder]: FromEntityUnmarshaller[A] =
    Unmarshaller.stringUnmarshaller.flatMap { _ => _ => body =>
      decode[A](body).fold(
        error => Future.failed(error),
        value => Future.successful(value)
      )
    }
