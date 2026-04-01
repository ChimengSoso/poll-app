#!/bin/bash

# Start OpenPoll Backend
# Usage: ./start-backend.sh

JAVA_OPTS="-Xmx512m -Xms256m"
JAR_FILE="openpoll.jar"

echo "Starting OpenPoll Backend..."
java $JAVA_OPTS -jar $JAR_FILE
