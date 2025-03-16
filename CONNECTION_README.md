# BLACKSKY-MD WhatsApp Connection Guide

This guide explains how to establish a reliable WhatsApp connection with the BLACKSKY-MD bot, particularly in cloud environments where connection stability can be challenging.

## Quick Start

The simplest way to connect is to run the start script:

```bash
./start-whatsapp.sh
```

This script provides a menu of connection methods to choose from, with the Advanced Connection Manager being the recommended option for most users.

## Connection Methods

### 1. Advanced Connection Manager (Recommended)

```bash
node connection-manager.js
```

**Features:**
- Automatically tries different browser fingerprints (Firefox, Safari, Chrome, Edge, Opera)
- Handles connection errors and retries with exponential backoff
- Preserves session data for faster reconnections
- Most reliable for cloud environments like Replit

### 2. Terminal QR Code

```bash
node terminal-qr-connect.js
```

**Features:**
- Simple and lightweight connection method
- Displays QR code directly in the terminal
- Good for headless environments where a web interface is not required
- Faster startup time than other methods

### 3. Browser-Specific Connections

For situations where specific browsers work better in your environment:

```bash
# Firefox connection
node firefox-connect.js

# Safari connection
node safari-connect.js
```

## Troubleshooting Connection Issues

If you're experiencing connection problems, try these solutions:

### 1. Run the Connection Cleanup Script

```bash
./cleanup-connections.sh
```

This script provides two cleanup options:
- **Standard Cleanup**: Removes current session data while preserving backups
- **Full Reset**: Removes all session data for a completely fresh start

### 2. Common Error Messages and Solutions

#### "Cannot read properties of undefined (reading 'public')"
This usually indicates session data corruption. Solution:
1. Run `./cleanup-connections.sh` and select option 2 (Full Reset)
2. Restart the connection with `./start-whatsapp.sh`

#### "Connection closed with status code: disconnected"
WhatsApp server disconnected the session. Solution:
1. Wait a few minutes (possible rate limiting)
2. Run `./cleanup-connections.sh` and select option 1 (Standard Cleanup)
3. Try connecting with a different browser fingerprint

#### QR Code Won't Scan
If your QR code won't scan properly:
1. Make sure your phone has a stable internet connection
2. Clean your camera lens
3. Adjust the brightness of your screen
4. If using terminal QR, try a web-based method instead

### 3. Cloud Environment Specific Tips

#### Replit
- Keep the Replit tab open to maintain connection
- Use Advanced Connection Manager for best results
- If using Replit mobile app, take a screenshot of the QR code and zoom in to scan

#### Heroku
- Configure environment variables as specified in HEROKU.md
- Use the special `heroku-prebuild` script for proper setup

## Maintaining Connection

For long-term connection stability:

1. Set up a keep-alive ping service (like UptimeRobot)
2. Configure automatic reconnection (enabled by default)
3. For 24/7 operation, see RUNNING_24_7_GUIDE.md

## Advanced Configuration

You can customize connection behavior by modifying these files:

- `connection-manager.js`: Browser profiles and retry settings
- `src/utils/connectionMonitor.js`: Connection monitoring parameters
- `src/utils/sessionManager.js`: Session management options

## Command System

Once connected, the bot will respond to commands starting with `!` (default prefix).

Basic commands to test your connection:
- `!ping`: Check if the bot is responding
- `!info`: Display bot information
- `!help`: Show available commands

If the command system isn't loading properly, the simplified message handler provides fallback functionality with basic commands.

---

If you continue experiencing connection issues after trying these solutions, please check for updates to the connection system or report your specific error for additional help.