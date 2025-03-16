# BLACKSKY-MD WhatsApp Bot - Replit Setup Guide

This guide helps you set up the BLACKSKY-MD WhatsApp bot on Replit after remixing the project.

## Quick Start After Remixing

1. **Run the Bot**:
   - Click the green "Run" button at the top of the page
   - The QR code will appear in a web interface

2. **Scan the QR Code**:
   - Open WhatsApp on your phone
   - Go to Settings → Linked Devices
   - Tap "Link a Device"
   - Scan the QR code that appears

3. **Bot is Now Connected**:
   - You'll see a "Connected" message when successful
   - The credentials are automatically saved for future use

## Connection Methods

This bot provides multiple connection methods to ensure it works in various environments:

### Main Connection (Default)
The default workflow uses `src/qr-web-server.js` which:
- Starts a web server to display the QR code
- Automatically handles connection and credential management
- Uses optimized parameters for Replit

### Alternative Connection Methods

If you experience connection issues with the default method:

1. **Terminal QR**:
   - Run `node src/terminal-qr.js` in the Shell
   - Scan the QR code that appears directly in the terminal

2. **Safari Connection**:
   - Run `node safari-connect.js` in the Shell
   - This uses Safari browser fingerprinting which often works better on Replit

3. **Enhanced QR Generator**:
   - Run `node src/qr-generator.js` in the Shell
   - Tries multiple browser profiles to find one that works

## Customizing Your Bot

1. **Environment Variables**:
   - Create a `.env` file by copying `.env.example`
   - Set your phone number as `OWNER_NUMBER` (without +)
   - Customize bot name, prefix, and other settings

2. **Enabling Features**:
   - In `.env`, set `ENABLE_NSFW`, `ENABLE_GAMES`, etc.
   - By default, most features are enabled except NSFW

## Common Issues and Solutions

### Connection Failures (405 Error)
This is a common issue when connecting from cloud environments:

1. **Try Different Connection Methods**:
   - Start with `safari-connect.js` which has the highest success rate
   - Try the terminal QR method if web methods fail

2. **Clear Authentication Data**:
   - If you keep getting errors, delete the `auth_info_baileys` directory
   - Run the bot again to generate a fresh QR code

3. **Local Authentication**:
   - As a last resort, authenticate locally (see CLOUD_ENVIRONMENT_GUIDE.md)
   - Upload the auth files to Replit

### Bot Keeps Disconnecting
1. **Enable "Always On"**:
   - Use Replit's "Always On" feature to prevent the bot from sleeping
   - This feature requires a paid Replit plan

2. **Use Enhanced Reconnection**:
   - Run `node enhanced-connection.js` which has advanced reconnection logic

## Updating Your Bot

This bot is regularly updated with new features and fixes:

1. **Pull Latest Changes**:
   ```bash
   git pull origin main
   ```

2. **Update Dependencies**:
   ```bash
   npm install
   ```

## Support and Help

If you need help with your bot:

1. **Check Documentation**:
   - Read CONNECTION_README.md for connection troubleshooting
   - Check HEROKU.md for deployment guidance

2. **Common Commands**:
   - Use `.help` to see available commands
   - Use `.menu` to see a categorized list of commands
   - Use `.info` to check bot status

## Important Notes

- WhatsApp may detect and block connections from Replit IPs
- If all connection methods fail, try again later or use local authentication
- Keep your authentication data secure - don't share it publicly

## Credits

- @whiskeysockets/baileys library for WhatsApp Web API
- Contributors to this project for connection resilience enhancements
