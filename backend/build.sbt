name := "poll-app-backend"

version := "1.0.0"

scalaVersion := "3.3.1"

val PekkoVersion = "1.0.2"
val PekkoHttpVersion = "1.0.1"

libraryDependencies ++= Seq(
  "org.apache.pekko" %% "pekko-actor-typed" % PekkoVersion,
  "org.apache.pekko" %% "pekko-stream" % PekkoVersion,
  "org.apache.pekko" %% "pekko-http" % PekkoHttpVersion,
  "org.apache.pekko" %% "pekko-http-spray-json" % PekkoHttpVersion,
  "ch.qos.logback" % "logback-classic" % "1.4.11"
)

Compile / run / mainClass := Some("Main")

// Assembly settings for fat JAR
assembly / mainClass := Some("Main")
assembly / assemblyJarName := "poll-app.jar"

// Merge strategy for assembly
assembly / assemblyMergeStrategy := {
  case PathList("META-INF", xs @ _*) => MergeStrategy.discard
  case "reference.conf" => MergeStrategy.concat
  case x => MergeStrategy.first
}
