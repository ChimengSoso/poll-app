import org.apache.pekko.actor.typed.ActorSystem
import org.apache.pekko.actor.typed.scaladsl.Behaviors
import org.apache.pekko.http.scaladsl.Http
import scala.concurrent.{ExecutionContext, Await}
import scala.concurrent.duration._
import scala.util.{Failure, Success}
import scala.io.StdIn
import actors.PollManager
import routes.PollRoutes

object Main:
  def main(args: Array[String]): Unit =
    given system: ActorSystem[PollManager.Command] = ActorSystem(PollManager(), "poll-system")
    given executionContext: ExecutionContext = system.executionContext

    val pollManager = system
    val routes = PollRoutes(pollManager)

    val host = "0.0.0.0"
    val port = 8080

    val bindingFuture = Http()
      .newServerAt(host, port)
      .bind(routes.routes)

    bindingFuture.onComplete {
      case Success(binding) =>
        val address = binding.localAddress
        println(s"========================================")
        println(s"Server online at http://${address.getHostString}:${address.getPort}/")
        println(s"API endpoints: http://${address.getHostString}:${address.getPort}/api/polls")
        println(s"========================================")
        println(s"Press RETURN to stop...")
      case Failure(ex) =>
        println(s"Failed to bind HTTP server: ${ex.getMessage}")
        system.terminate()
    }

    // Keep the server running until user presses RETURN
    StdIn.readLine()

    println("Shutting down server...")
    bindingFuture
      .flatMap(_.unbind())
      .onComplete(_ => system.terminate())
