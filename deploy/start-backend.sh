#!/bin/bash

# Start Poll App Backend
# Usage: ./start-backend.sh

JAVA_OPTS="-Xmx512m -Xms256m"
JAR_FILE="poll-app.jar"

echo "Starting Poll App Backend..."
java $JAVA_OPTS -jar $JAR_FILE
