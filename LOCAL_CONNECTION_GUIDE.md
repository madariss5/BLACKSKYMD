# Local WhatsApp Connection Guide

## Important: Local-Only Connection Instructions

This guide explains how to set up the WhatsApp connection from your local computer. Due to restrictions on cloud platforms like Replit, direct WhatsApp connections are typically blocked with a 405 error.

## Step 1: Download the Connection Script

1. Save the `local-connect.js` file from this project to your local computer.
2. Open the file and edit line 27 to replace the phone number with your WhatsApp number:
   ```javascript
   const YOUR_NUMBER = '1234567890'; // Edit this with your WhatsApp number
   ```
   Include your country code without the + sign (for example, "12025551234" for a US number).

## Step 2: Install Node.js and Dependencies

1. If you don't have Node.js installed, download and install it from [nodejs.org](https://nodejs.org/).
2. Open a terminal/command prompt in the folder where you saved `local-connect.js`.
3. Run the following commands to install the required dependencies:

```bash
npm install @whiskeysockets/baileys@latest qrcode-terminal pino pino-pretty @hapi/boom
```

This will install all the packages needed for the connection.

## Step 3: Run the Connection Script

1. In your terminal/command prompt, run:
```bash
node local-connect.js
```

2. You'll see a QR code displayed in your terminal.
3. Open WhatsApp on your phone and scan this QR code:
   - Go to WhatsApp Settings > Linked Devices
   - Tap on "Link a Device"
   - Point your phone camera at the QR code on your screen

## Step 4: Wait for Authentication

1. After scanning, the script will show "CONNECTED SUCCESSFULLY!"
2. The script will automatically send your authentication credentials to your WhatsApp as a backup.
3. You'll find a `creds.json` file in your WhatsApp messages - save this for emergency recovery.
4. The script will also create an `auth_info_baileys` folder on your computer.

## Step 5: Transfer Credentials to Heroku

1. Compress (zip) the entire `auth_info_baileys` folder.
2. Upload this zip file to your Heroku server.
3. Extract the contents to the `auth_info_heroku` folder on Heroku.
4. Restart your Heroku dyno.

## Troubleshooting

If you encounter connection issues:

1. **Check your internet connection** - Make sure you have a stable connection.
2. **Firewall issues** - Ensure your firewall isn't blocking the connection.
3. **QR code expiration** - The QR code expires after 40 seconds. If it expires, the script will automatically generate a new one.
4. **Clear auth folder** - If you keep getting errors, delete the `auth_info_baileys` folder and try again.
5. **Check WhatsApp status** - Ensure WhatsApp is not down and that you don't have too many linked devices already.

## Important Notes

- **Local Only**: This connection MUST be initiated from your local computer, not from Replit or any cloud platform.
- **Re-authentication**: You'll need to repeat this process occasionally (typically every 1-4 weeks) as WhatsApp sessions expire.
- **Multiple Devices**: Make sure you don't exceed WhatsApp's linked device limit (typically 4 devices).
- **Security**: Keep your authentication files secure and never share them publicly.

## About the Connection Process

WhatsApp's Multi-Device API allows your bot to operate as a "linked device" to your WhatsApp account. The local connection creates this link, and then Heroku can maintain it without needing to repeatedly scan QR codes.

By using this two-step approach, we bypass the IP restrictions that cloud platforms face when trying to connect directly to WhatsApp.