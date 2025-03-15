# BLACKSKY-MD WhatsApp Bot

A robust WhatsApp multi-device bot engineered to tackle complex network connectivity challenges with intelligent communication resilience.

## Key Features

- Multi-device WhatsApp bot using @whiskeysockets/baileys
- Advanced connection handling for cloud environments like Replit
- Intelligent error recovery and credential management
- Multiple connection methods for different usage scenarios

## Connection System

This bot includes an enhanced connection system specifically designed to work around the "Connection Failure" issues common when running WhatsApp bots in cloud environments. We provide multiple connection methods:

1. **Standard Web Connection**
   - Default connection option with web QR interface
   - Automatically attempts to reconnect with optimized parameters

2. **Specialized QR Generator**
   - Alternative connection method for difficult environments
   - Uses a streamlined approach with fewer dependencies

3. **Terminal-only QR**
   - Most reliable connection method
   - No web interface required, works directly in the terminal

For detailed information about connection options, see [CONNECTION_README.md](CONNECTION_README.md).

## Quick Start

### Option 1: Use the Connection Helper

```bash
node run-connection.js
```

This interactive script will guide you through the different connection options.

### Option 2: Direct Connection

```bash
# Standard web connection (default)
node src/index.js

# Or for connection issues, use the web QR generator
node src/qr-generator.js

# Or for most reliable connection
node src/terminal-qr.js
```

### After Connecting

1. Scan the QR code with your WhatsApp app:
   - Go to WhatsApp Settings → Linked Devices
   - Tap on "Link a Device"
   - Scan the QR code shown in the web interface or terminal

2. Once connected, the bot will automatically save credentials for future use
   - You should only need to scan the QR code once
   - Subsequent restarts will use the saved credentials

## Troubleshooting

If you're experiencing connection issues:

1. Try the different connection methods mentioned above
2. Check [CONNECTION_README.md](CONNECTION_README.md) for detailed troubleshooting steps
3. Clear the authentication data (delete the `auth_info_baileys` folder)

## Important Notes

- WhatsApp may occasionally reject connections from cloud providers
- The connection system will automatically try different approaches
- If all methods fail, WhatsApp servers may be temporarily blocking the IP address

## Command Usage

Once connected, the bot will automatically load and process commands.

For more information about available commands and features, see the source code in the `src/commands` directory.

## Credits

- @whiskeysockets/baileys library for WhatsApp Web API
- Contributors to this project for connection resilience enhancements