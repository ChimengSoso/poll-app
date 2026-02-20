# Poll App - Build & Deployment Guide

## Quick Start

### Build for Linux (Run on your development machine):

```bash
chmod +x build.sh
./build.sh
```

This creates a `deploy/` directory with everything needed.

### Deploy to Linux Server:

```bash
# 1. Transfer to server
scp -r deploy/ user@your-server:/tmp/poll-app-deploy

# 2. On server, run quick install
cd /tmp/poll-app-deploy
sudo chmod +x install.sh
sudo ./install.sh
```

That's it! Your app is running.

## What Gets Built

### Backend:
- **File:** `deploy/backend/poll-app.jar`
- **Type:** Executable fat JAR with all dependencies
- **Size:** ~30MB
- **Runs on:** Any Linux with Java 11+

### Frontend:
- **Files:** `deploy/frontend/*` (HTML, CSS, JS)
- **Type:** Static files for Nginx
- **Size:** ~2MB

## Build Components

### Backend (Scala + SBT):
```bash
cd backend
sbt clean assembly
```
Output: `backend/target/scala-3.3.1/poll-app.jar`

### Frontend (React + Vite):
```bash
cd frontend
npm install
npm run build
```
Output: `frontend/dist/`

## Deployment Architecture

```
┌─────────────────────────────────────────┐
│          Linux Server                    │
│                                          │
│  ┌────────────┐      ┌───────────────┐ │
│  │   Nginx    │─────▶│   Frontend    │ │
│  │  (Port 80) │      │  (Static)     │ │
│  └─────┬──────┘      └───────────────┘ │
│        │                                 │
│        │ /api/*                          │
│        │                                 │
│  ┌─────▼──────────────────────────────┐ │
│  │   Backend Service                  │ │
│  │   (poll-app.jar)                   │ │
│  │   Port 8080                        │ │
│  │   Managed by systemd               │ │
│  └────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

## Files Generated

```
deploy/
├── backend/
│   └── poll-app.jar          # Backend executable
├── frontend/
│   ├── index.html
│   ├── assets/
│   └── ...                   # Static files
├── scripts/
│   └── start-backend.sh      # Manual start script
├── systemd/
│   └── poll-app-backend.service  # Systemd service
├── nginx.conf                # Nginx configuration
└── install.sh               # Quick install script
```

## Manual Build Steps

If `build.sh` doesn't work:

### Backend:
```bash
cd backend
sbt clean assembly
mkdir -p ../deploy/backend
cp target/scala-3.3.1/poll-app.jar ../deploy/backend/
```

### Frontend:
```bash
cd frontend
npm install
npm run build
mkdir -p ../deploy/frontend
cp -r dist/* ../deploy/frontend/
```

## Testing Locally

### Test Backend JAR:
```bash
cd deploy/backend
java -jar poll-app.jar
```
Access: http://localhost:8080/api/polls

### Test Frontend Build:
```bash
cd deploy/frontend
python3 -m http.server 8000
```
Access: http://localhost:8000

## Requirements

### Development Machine:
- Java 11+ and SBT
- Node.js 18+ and npm
- Bash (for build script)

### Linux Server:
- Java 11+ (runtime only)
- Nginx
- Systemd
- Ubuntu 20.04+ or similar

## Build Troubleshooting

### SBT Assembly fails:
```bash
cd backend
sbt clean
sbt compile
sbt assembly
```

### NPM build fails:
```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Permission denied on build.sh:
```bash
chmod +x build.sh
```

## Production Optimization

### Backend JVM Options:
Edit `deploy/poll-app-backend.service`:
```
ExecStart=/usr/bin/java -Xmx1g -Xms512m -XX:+UseG1GC -jar /opt/poll-app/backend/poll-app.jar
```

### Frontend Optimization:
Already minified by Vite build process.

## Deployment Checklist

- [ ] Run `./build.sh` successfully
- [ ] Transfer `deploy/` to server
- [ ] Run `sudo ./install.sh` on server
- [ ] Edit nginx config with your domain/IP
- [ ] Check service status: `sudo systemctl status poll-app-backend`
- [ ] Test access in browser
- [ ] Setup firewall rules if needed
- [ ] Setup SSL certificate (optional)

## Getting Help

- Build issues: Check `build.sh` output
- Deployment issues: See `DEPLOYMENT.md`
- Runtime issues: Check logs with `sudo journalctl -u poll-app-backend -f`

## Advanced

For detailed deployment instructions, see: **DEPLOYMENT.md**

For development setup, see: **README.md** (if exists)
