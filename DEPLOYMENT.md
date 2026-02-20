# Poll App - Linux Deployment Guide

This guide will help you deploy the Poll App to a Linux server.

## Prerequisites

- Linux server (Ubuntu 20.04+ or similar)
- Java 11 or higher
- Node.js 18+ and npm (for building only)
- Nginx (for serving frontend and proxying backend)
- Sudo access

## Building the Application

### On Your Development Machine:

1. **Build both backend and frontend:**
   ```bash
   chmod +x build.sh
   ./build.sh
   ```

   This creates a `deploy/` directory with all necessary files.

2. **Transfer to Linux server:**
   ```bash
   scp -r deploy/ user@your-server:/tmp/poll-app-deploy
   ```

## Server Installation

### 1. Install Java (if not installed)

```bash
sudo apt update
sudo apt install openjdk-11-jre-headless -y
java -version
```

### 2. Install Nginx (if not installed)

```bash
sudo apt install nginx -y
```

### 3. Create Application Directory

```bash
sudo mkdir -p /opt/poll-app/{backend,frontend}
sudo useradd -r -s /bin/false pollapp
```

### 4. Copy Application Files

```bash
# Copy backend JAR
sudo cp /tmp/poll-app-deploy/backend/poll-app.jar /opt/poll-app/backend/

# Copy frontend files
sudo cp -r /tmp/poll-app-deploy/frontend/* /opt/poll-app/frontend/

# Set permissions
sudo chown -R pollapp:pollapp /opt/poll-app
sudo chmod +x /opt/poll-app/backend/poll-app.jar
```

### 5. Setup Backend Service

```bash
# Copy systemd service file
sudo cp /tmp/poll-app-deploy/systemd/poll-app-backend.service /etc/systemd/system/

# Reload systemd and enable service
sudo systemctl daemon-reload
sudo systemctl enable poll-app-backend
sudo systemctl start poll-app-backend

# Check status
sudo systemctl status poll-app-backend
```

### 6. Setup Nginx

```bash
# Copy nginx config
sudo cp /tmp/poll-app-deploy/nginx.conf /etc/nginx/sites-available/poll-app

# Update server_name in the config
sudo nano /etc/nginx/sites-available/poll-app
# Change "your-domain.com" to your actual domain or server IP

# Enable site
sudo ln -s /etc/nginx/sites-available/poll-app /etc/nginx/sites-enabled/

# Test nginx config
sudo nginx -t

# Restart nginx
sudo systemctl restart nginx
```

## Accessing the Application

Open your browser and go to:
- `http://your-server-ip` or `http://your-domain.com`

The backend API will be available at:
- `http://your-server-ip/api/polls`

## Managing the Application

### Backend Service Commands

```bash
# Start
sudo systemctl start poll-app-backend

# Stop
sudo systemctl stop poll-app-backend

# Restart
sudo systemctl restart poll-app-backend

# View logs
sudo journalctl -u poll-app-backend -f

# Check status
sudo systemctl status poll-app-backend
```

### View Backend Logs

```bash
# Real-time logs
sudo journalctl -u poll-app-backend -f

# Last 100 lines
sudo journalctl -u poll-app-backend -n 100

# Logs from today
sudo journalctl -u poll-app-backend --since today
```

## Updating the Application

### Update Backend:

```bash
# Stop service
sudo systemctl stop poll-app-backend

# Copy new JAR
sudo cp /path/to/new/poll-app.jar /opt/poll-app/backend/

# Start service
sudo systemctl start poll-app-backend
```

### Update Frontend:

```bash
# Copy new frontend files
sudo rm -rf /opt/poll-app/frontend/*
sudo cp -r /path/to/new/frontend/dist/* /opt/poll-app/frontend/

# Restart nginx
sudo systemctl restart nginx
```

## Data Storage

Poll templates are stored in:
```
/opt/poll-app/backend/poll-templates/
```

To backup:
```bash
sudo tar -czf poll-templates-backup.tar.gz /opt/poll-app/backend/poll-templates/
```

## Firewall Configuration

If you have a firewall enabled:

```bash
# Allow HTTP
sudo ufw allow 80/tcp

# Allow HTTPS (if using SSL)
sudo ufw allow 443/tcp
```

## Troubleshooting

### Backend not starting:

```bash
# Check if port 8080 is in use
sudo lsof -i :8080

# Check Java version
java -version

# Check service logs
sudo journalctl -u poll-app-backend -n 50
```

### Frontend not loading:

```bash
# Check nginx status
sudo systemctl status nginx

# Check nginx error logs
sudo tail -f /var/log/nginx/error.log

# Verify frontend files exist
ls -la /opt/poll-app/frontend/
```

### API calls failing:

```bash
# Test backend directly
curl http://localhost:8080/api/polls

# Check nginx proxy configuration
sudo nginx -t

# Check backend logs
sudo journalctl -u poll-app-backend -f
```

## SSL/HTTPS Setup (Optional)

To enable HTTPS with Let's Encrypt:

```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx -y

# Get certificate
sudo certbot --nginx -d your-domain.com

# Auto-renewal is setup automatically
```

## Performance Tuning

### Backend JVM Options

Edit `/etc/systemd/system/poll-app-backend.service`:

```ini
ExecStart=/usr/bin/java -Xmx1g -Xms512m -XX:+UseG1GC -jar /opt/poll-app/backend/poll-app.jar
```

Then reload:
```bash
sudo systemctl daemon-reload
sudo systemctl restart poll-app-backend
```

### Nginx Performance

Add to nginx config:
```nginx
gzip on;
gzip_types text/plain text/css application/json application/javascript text/xml application/xml;
```

## Monitoring

### Check Resource Usage

```bash
# CPU and Memory
top

# Disk usage
df -h

# Check backend process
ps aux | grep poll-app.jar
```

## Support

For issues or questions, check the logs first:
```bash
sudo journalctl -u poll-app-backend -n 200
sudo tail -f /var/log/nginx/error.log
```
