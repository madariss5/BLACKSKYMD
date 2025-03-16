# BLACKSKY-MD WhatsApp Bot Quick Start Guide

This is a streamlined guide to get your WhatsApp bot running quickly. For detailed information, refer to the specific documentation files.

## 1. Choose Your Connection Method

```bash
# Basic connection with web QR interface (Recommended for first-time users)
node src/qr-web-server.js

# Terminal-based QR for faster connection
node src/terminal-qr.js

# Safari fingerprint for better cloud compatibility
node safari-connect.js
```

## 2. Scan the QR Code

- Open WhatsApp on your phone
- Go to Settings → Linked Devices
- Tap "Link a Device"
- Scan the QR code that appears

## 3. Essential Bot Commands

Once connected, try these commands:

- `.help` - Display available commands
- `.menu` - Show interactive command menu
- `.info` - Show bot information
- `.ping` - Check bot response time
- `.status` - View connection status

## 4. Configuration Options

To customize your bot:

1. **Basic Configuration**:
   - Copy `.env.example` to `.env`
   - Edit to set your number as owner
   - Change bot name, prefix, and enabled features

2. **Connection Options**:
   - Main connection script: `src/qr-web-server.js`
   - Terminal-only version: `src/terminal-qr.js` 
   - Browser-specific: `safari-connect.js`, `firefox-connect.js`

## 5. Deployment Options

- **Replit**: Just click Run (see README-REPLIT.md)
- **Heroku**: Use one-click deploy or manual setup (see HEROKU.md)
- **Local**: Run node commands directly

## 6. Troubleshooting

If you encounter connection issues:

- Try a different connection method (safari-connect.js usually works best)
- Delete auth_info_baileys folder to generate fresh QR code
- Check the detailed troubleshooting in CONNECTION_README.md

For any other issues:

- Check the console logs for error messages
- Refer to detailed setup guides in the documentation