#!/bin/bash

# Quick Installation Script for Poll App on Linux
# Run this script on your Linux server after transferring the deploy directory

set -e

echo "======================================"
echo "Poll App - Quick Install"
echo "======================================"

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo "Please run as root (use sudo)"
    exit 1
fi

# Check Java
if ! command -v java &> /dev/null; then
    echo "Installing Java..."
    apt update
    apt install -y openjdk-11-jre-headless
fi

echo "Java version:"
java -version

# Check Nginx
if ! command -v nginx &> /dev/null; then
    echo "Installing Nginx..."
    apt install -y nginx
fi

# Create user
if ! id "pollapp" &>/dev/null; then
    echo "Creating pollapp user..."
    useradd -r -s /bin/false pollapp
fi

# Create directories
echo "Creating application directories..."
mkdir -p /opt/poll-app/backend
mkdir -p /opt/poll-app/frontend

# Copy files
echo "Copying application files..."
cp ../backend/poll-app.jar /opt/poll-app/backend/
cp -r ui/* /opt/poll-app/frontend/

# Set permissions
chown -R pollapp:pollapp /opt/poll-app
chmod +x /opt/poll-app/backend/poll-app.jar

# Setup systemd service
echo "Setting up backend service..."
cp ./poll-app-backend.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable poll-app-backend
systemctl start poll-app-backend

# Setup nginx
echo "Setting up Nginx..."
cp nginx.conf /etc/nginx/sites-available/poll-app

echo ""
echo "IMPORTANT: Edit /etc/nginx/sites-available/poll-app"
echo "Change 'your-domain.com' to your actual domain or server IP"
read -p "Press enter after editing the nginx config..."

# Enable nginx site
ln -sf /etc/nginx/sites-available/poll-app /etc/nginx/sites-enabled/
nginx -t && systemctl restart nginx

# Status check
echo ""
echo "======================================"
echo "Installation Complete!"
echo "======================================"
echo ""
systemctl status poll-app-backend --no-pager
echo ""
echo "Access your app at: http://YOUR_SERVER_IP"
echo ""
echo "Useful commands:"
echo "  sudo systemctl status poll-app-backend"
echo "  sudo journalctl -u poll-app-backend -f"
echo "  sudo systemctl restart poll-app-backend"
