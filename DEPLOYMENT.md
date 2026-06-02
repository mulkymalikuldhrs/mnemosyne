# Nanggroe IoT — Deployment Guide

> Comprehensive deployment guide for Nanggroe IoT across all supported platforms.

---

## Table of Contents

- [Web Deployment](#web-deployment)
- [Desktop Build (Tauri)](#desktop-build-tauri)
- [Android Build (Capacitor)](#android-build-capacitor)
- [Raspberry Pi Deployment](#raspberry-pi-deployment)
- [Environment Variables](#environment-variables)
- [Production Checklist](#production-checklist)
- [Security Hardening](#security-hardening)

---

## Web Deployment

### Vercel (Recommended)

The easiest way to deploy the web dashboard.

```bash
# Install Vercel CLI
bun add -g vercel

# Deploy
vercel

# Deploy to production
vercel --prod
```

**Configuration**:
- Framework Preset: Next.js
- Build Command: `bun run build`
- Output Directory: `.next`
- Install Command: `bun install`

**Environment Variables** (set in Vercel dashboard):
- `DATABASE_URL` — SQLite path (use Turso or PlanetScale for serverless)
- `NANGGROE_API_KEY` — API authentication key
- `ZAI_API_KEY` — Z-AI SDK key (optional)

### Docker

```dockerfile
FROM oven/bun:1 AS base
WORKDIR /app

# Install dependencies
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Copy source
COPY . .

# Generate Prisma client
RUN bun run db:generate

# Build
RUN bun run build

# Expose port
EXPOSE 3000

# Start
CMD ["bun", "run", "start"]
```

```bash
# Build image
docker build -t nanggroe-iot .

# Run container
docker run -p 3000:3000 \
  -e DATABASE_URL=file:./db/nanggroe-iot.db \
  -e NANGGROE_API_KEY=your-secret-key \
  -v nanggroe-data:/app/db \
  nanggroe-iot
```

### Docker Compose

```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=file:./db/nanggroe-iot.db
      - NANGGROE_API_KEY=${NANGGROE_API_KEY}
    volumes:
      - nanggroe-data:/app/db
    restart: unless-stopped

  caddy:
    image: caddy:2
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddy-data:/data
      - caddy-config:/config
    depends_on:
      - app

volumes:
  nanggroe-data:
  caddy-data:
  caddy-config:
```

### Standalone (Node.js)

```bash
# Build
bun run build

# Start production server
bun run start
```

The standalone server uses Next.js built-in server with output optimization.

---

## Desktop Build (Tauri)

### Prerequisites

#### Linux (Debian/Ubuntu)

```bash
sudo apt update
sudo apt install -y \
  libwebkit2gtk-4.1-dev \
  libgtk-3-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev \
  libssl-dev \
  libclang-dev \
  build-essential \
  pkg-config

# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env
```

#### Windows

1. Install **Visual Studio Build Tools** with C++ workload
2. Install **Rust**: `winget install Rustlang.Rustup`
3. Install **WebView2** (usually pre-installed on Windows 10+)

### Build Commands

```bash
# Development (hot-reload with WebView)
bun run tauri:dev

# Build for current platform
bun run tauri:build

# Linux only (DEB + AppImage)
bun run tauri:build:linux

# Windows only (MSI + NSIS)
bun run tauri:build:windows
```

### Build Output

| Platform | Output Path |
|----------|------------|
| Linux DEB | `src-tauri/target/release/bundle/deb/nanggroe-iot_2.0.0_amd64.deb` |
| Linux AppImage | `src-tauri/target/release/bundle/appimage/nanggroe-iot_2.0.0_amd64.AppImage` |
| Windows MSI | `src-tauri/target/release/bundle/msi/Nanggroe IoT_2.0.0_x64_en-US.msi` |
| Windows EXE | `src-tauri/target/release/bundle/nsis/Nanggroe IoT_2.0.0_x64-setup.exe` |

### Tauri Configuration

Key settings in `src-tauri/tauri.conf.json`:

| Setting | Value |
|---------|-------|
| Product Name | Nanggroe IoT |
| Identifier | com.nanggroe.iot |
| Window Size | 1440×900 (min: 1024×700) |
| Window Title | Nanggroe IoT — IoT & Robotics Platform |

### CSP Headers (Tauri)

Content Security Policy is configured in the Tauri capabilities file for the desktop build to prevent XSS and injection attacks.

---

## Android Build (Capacitor)

### Prerequisites

- **Android Studio** with SDK 33+
- **Java Development Kit** (JDK 17)
- **Android SDK Command-Line Tools**

### Setup

```bash
# Initialize Android project (first time only)
bun run android:init

# Build web assets and sync
bun run android:build

# Open in Android Studio
bun run android:open
```

### Build APK

```bash
# Build web assets
bun run build

# Sync to Android project
bun run android:sync

# Build APK via Android Studio or command line
cd android
./gradlew assembleDebug
# APK: android/app/build/outputs/apk/debug/app-debug.apk

# Build release APK
./gradlew assembleRelease
# APK: android/app/build/outputs/apk/release/app-release.apk
```

### Capacitor Configuration

| Setting | Value |
|---------|-------|
| App ID | com.nanggroe.iot |
| App Name | Nanggroe IoT |
| Web Dir | out |
| Splash Duration | 2000ms |
| Status Bar | Dark |

### Android Manifest Permissions

The Android app requires:
- `INTERNET` — API communication
- `ACCESS_FINE_LOCATION` — GPS tracking
- `BLUETOOTH` — Hardware communication
- `USB_PERMISSION` — USB device access

---

## Raspberry Pi Deployment

### Hardware Requirements

| Component | Specification |
|-----------|--------------|
| Raspberry Pi | 4B (4GB+ RAM recommended) |
| Storage | 32GB+ microSD (Class 10) |
| Power | USB-C 5V/3A |
| OS | Raspberry Pi OS 64-bit (Lite recommended) |

### Installation

```bash
# SSH into Raspberry Pi
ssh pi@raspberrypi.local

# Install Bun
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc

# Clone repository
git clone https://github.com/mulkymalikuldhrs/nanggroe-iot.git
cd nanggroe-iot

# Install dependencies
bun install

# Initialize database
bun run db:push
bun run db:generate

# Set up environment
cp .env.example .env
# Edit .env:
# DATABASE_URL=file:./db/nanggroe-iot.db
# NANGGROE_API_KEY=your-secure-key
# SERIAL_PORT=/dev/ttyACM0
```

### Systemd Service

Create `/etc/systemd/system/nanggroe-iot.service`:

```ini
[Unit]
Description=Nanggroe IoT Platform
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/nanggroe-iot
ExecStart=/home/pi/.bun/bin/bun run start
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=3000

[Install]
WantedBy=multi-user.target
```

```bash
# Enable and start
sudo systemctl enable nanggroe-iot
sudo systemctl start nanggroe-iot

# Check status
sudo systemctl status nanggroe-iot

# View logs
sudo journalctl -u nanggroe-iot -f
```

### Caddy Reverse Proxy

Install Caddy for HTTPS:

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install caddy
```

Edit `/etc/caddy/Caddyfile`:

```
nanggroe-iot.local {
    reverse_proxy localhost:3000
}
```

```bash
sudo systemctl restart caddy
```

### Hardware Access

```bash
# Add pi user to dialout group (serial port access)
sudo usermod -a -G dialout pi

# Enable I2C
sudo raspi-config nonint do_i2c 0

# Enable SPI
sudo raspi-config nonint do_spi 0

# Enable serial port
sudo raspi-config nonint do_serial 0

# Reboot for changes
sudo reboot
```

### USB Device Rules

Create `/etc/udev/rules.d/99-pixhawk.rules` for automatic Pixhawk detection:

```
# Pixhawk 4 (FMUv5)
SUBSYSTEM=="tty", ATTRS{idVendor}=="26ac", ATTRS{idProduct}=="0012", MODE="0666", SYMLINK+="pixhawk"

# Arduino Uno
SUBSYSTEM=="tty", ATTRS{idVendor}=="2341", ATTRS{idProduct}=="0043", MODE="0666", SYMLINK+="arduino"
```

```bash
sudo udevadm control --reload-rules
sudo udevadm trigger
```

---

## Environment Variables

### Required (Production)

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | SQLite database path | `file:./db/nanggroe-iot.db` |
| `NANGGROE_API_KEY` | API authentication key | `nanggroe-iot-prod-key-2025` |

### Optional

| Variable | Description | Default |
|----------|-------------|---------|
| `ZAI_API_KEY` | Z-AI SDK key for cloud LLM | — |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token | — |
| `SERIAL_PORT` | Default serial port | `/dev/ttyUSB0` |
| `SERIAL_BAUD_RATE` | Serial baud rate | `115200` |
| `PORT` | Server port | `3000` |
| `MCP_PORT` | MCP protocol port | `8080` |
| `EXTENSION_WS_PORT` | Extension WebSocket port | `8081` |
| `NODE_ENV` | Environment mode | `development` |

### Generating a Secure API Key

```bash
# Generate a random API key
openssl rand -hex 32
# Example output: a1b2c3d4e5f6... (64 characters)
```

---

## Production Checklist

### Pre-Deployment

- [ ] Set `NODE_ENV=production`
- [ ] Set `NANGGROE_API_KEY` to a strong, unique key
- [ ] Run `bun run lint` — no errors
- [ ] Run `bun run test:e2e` — all 183 tests pass
- [ ] Run `bun run build` — build succeeds
- [ ] Database migrations applied (`bun run db:push`)
- [ ] Prisma client generated (`bun run db:generate`)
- [ ] `.env` file is not committed to version control
- [ ] All secrets are in environment variables, not code

### Security

- [ ] API key is set and tested
- [ ] HTTPS is enabled (via Caddy or reverse proxy)
- [ ] CORS is configured for allowed origins only
- [ ] Rate limiting is configured
- [ ] CSP headers are set (Tauri desktop)
- [ ] Input validation is active on critical routes
- [ ] Command injection protection is in place

### Monitoring

- [ ] System health endpoint (`GET /api`) is accessible
- [ ] Log rotation is configured
- [ ] Uptime monitoring is set up
- [ ] Alert notifications are configured
- [ ] Database backup schedule is set

### Hardware (Raspberry Pi)

- [ ] Serial port permissions are configured
- [ ] I2C and SPI are enabled
- [ ] USB device rules are set up
- [ ] Power supply is adequate (5V/3A)
- [ ] Cooling is sufficient for sustained load

---

## Security Hardening

### API Key Authentication

```bash
# Set a strong API key
export NANGGROE_API_KEY=$(openssl rand -hex 32)
```

The API key is validated by `src/lib/auth.ts`:
- Checks `x-api-key` header
- Checks `Authorization: Bearer` header
- Checks `api_key` query parameter
- In development without key: all requests allowed
- In production without key: 401 Unauthorized

### Command Injection Protection

All routes that handle hardware communication:
- Sanitize input strings
- Never execute shell commands with user input
- Use serialport library directly (no `exec()`)

### CSP Headers (Tauri)

Content Security Policy in the Tauri desktop build:
- Restricts script sources
- Prevents inline script execution
- Limits style sources
- Blocks unauthorized connections

### Input Validation

Critical API routes use Zod schema validation:
- Mission creation: validates name, type, altitude, speed
- Navigation plans: validates coordinates, waypoint format
- System configuration: validates key-value pairs
- Hardware registration: validates device type, protocol

### HTTPS Configuration (Caddy)

```
nanggroe-iot.local {
    reverse_proxy localhost:3000

    # Security headers
    header {
        X-Content-Type-Options nosniff
        X-Frame-Options DENY
        X-XSS-Protection "1; mode=block"
        Referrer-Policy strict-origin-when-cross-origin
    }
}
```

### Rate Limiting (Caddy)

```
nanggroe-iot.local {
    reverse_proxy localhost:3000

    rate_limit {
        zone nanggroe_zone {
            key    {remote_host}
            events 100
            window 1m
        }
    }
}
```

### Database Security

- SQLite file permissions: `600` (owner read/write only)
- No raw SQL queries (Prisma parameterized queries)
- Database directory not web-accessible
- Regular backups with rotation

---

*Last updated: 2025*
