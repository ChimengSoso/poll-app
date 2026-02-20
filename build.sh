#!/bin/bash

# Poll App Build Script for Linux Deployment
# This script builds both backend and frontend for production

set -e  # Exit on error

echo "======================================"
echo "Building Poll App for Linux"
echo "======================================"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Build Backend
echo -e "${BLUE}Building Backend...${NC}"
cd backend
sbt clean assembly
echo -e "${GREEN}✓ Backend JAR created: backend/target/scala-3.3.1/poll-app.jar${NC}"
cd ..

# Build Frontend
echo -e "${BLUE}Building Frontend...${NC}"
cd frontend
npm install
npm run build
echo -e "${GREEN}✓ Frontend built: frontend/dist/${NC}"
cd ..

# Create deployment directory structure
echo -e "${BLUE}Creating deployment package...${NC}"
mkdir -p deploy/backend
mkdir -p deploy/frontend
mkdir -p deploy/scripts
mkdir -p deploy/systemd

# Copy backend files
cp backend/target/scala-3.3.1/poll-app.jar deploy/backend/
echo -e "${GREEN}✓ Backend JAR copied${NC}"

# Copy frontend files
cp -r frontend/dist/* deploy/frontend/
echo -e "${GREEN}✓ Frontend files copied${NC}"

# Copy deployment scripts
cp deploy/*.sh deploy/scripts/ 2>/dev/null || true
cp deploy/*.service deploy/systemd/ 2>/dev/null || true

echo ""
echo -e "${GREEN}======================================"
echo "Build Complete!"
echo "======================================${NC}"
echo ""
echo "Deployment files are in: ./deploy/"
echo ""
echo "Backend JAR: deploy/backend/poll-app.jar"
echo "Frontend: deploy/frontend/"
echo ""
echo "Next steps:"
echo "  1. Copy ./deploy directory to your Linux server"
echo "  2. Follow instructions in DEPLOYMENT.md"
