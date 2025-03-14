# WhatsApp Bot Connection Troubleshooting Guide

## Common Connection Issues and Solutions

This document provides solutions to common connection issues that might occur when running a WhatsApp bot using Baileys library on cloud platforms like Replit.

### Error 405: Connection Failure

**Symptoms:**
- Error message: "Connection closed due to Connection Failure"
- Status code: 405
- QR code not being generated or expiring immediately

**Causes:**
- Network restrictions on the Replit server
- Baileys websocket connection being rejected by WhatsApp servers
- Browser fingerprint being detected as suspicious

**Solutions:**

1. **Use a unique browser fingerprint each time:**
   ```javascript
   const browserId = `BLACKSKY-${Date.now()}`;
   const sock = makeWASocket({
     browser: [browserId, 'Chrome', '110.0.0'],
     // other options
   });
   ```

2. **Clear auth state completely before reconnecting:**
   ```javascript
   if (fs.existsSync('./auth_info')) {
     fs.rmSync('./auth_info', { recursive: true, force: true });
   }
   fs.mkdirSync('./auth_info', { recursive: true });
   ```

3. **Use the terminal QR code option:**
   ```javascript
   const sock = makeWASocket({
     printQRInTerminal: true,
     // other options
   });
   ```

4. **Use the simplified QR server (replit-qr.js):**
   ```bash
   node replit-qr.js
   ```

5. **After connecting, backup credentials using the credentials backup system:**
   ```javascript
   const { backupCredentials } = require('./src/utils/credentialsBackup');
   // ...
   if (sock.authState && sock.authState.creds) {
     await backupCredentials(sock.authState.creds);
   }
   ```

### Error 401: Unauthorized / Error 440: Session Expired

**Symptoms:**
- Error message: "Connection closed due to Unauthorized" 
- Status code: 401 or 440
- Previously working connection suddenly fails

**Causes:**
- WhatsApp session has expired
- Credentials have been invalidated by WhatsApp servers
- Someone logged out of the session from phone

**Solutions:**

1. **Generate a new QR code for scanning:**
   ```bash
   node replit-qr.js
   ```

2. **Check that another device hasn't logged out the bot:**
   - Open WhatsApp on your phone
   - Go to Settings → Linked Devices
   - Ensure you haven't removed the bot's session

3. **If using Heroku or platforms with ephemeral filesystem, use credential backup:**
   ```javascript
   const { restoreAuthFiles } = require('./src/utils/credentialsBackup');
   
   // Before connecting, try to restore credentials
   await restoreAuthFiles();
   // Then continue with normal connection
   ```

### Error 429: Too Many Requests

**Symptoms:**
- Error message: "Connection closed due to Too Many Requests"
- Status code: 429
- Multiple connection attempts fail in sequence

**Causes:**
- Rate limiting by WhatsApp servers
- Too many connection attempts in a short period
- Multiple bots running from the same IP address

**Solutions:**

1. **Implement exponential backoff:**
   ```javascript
   const getRetryDelay = (attempt) => Math.min(30000, 1000 * Math.pow(2, attempt));
   
   // In reconnection logic
   const delay = getRetryDelay(retryCount);
   setTimeout(connectToWhatsApp, delay);
   ```

2. **Limit connection attempts:**
   ```javascript
   const MAX_RETRIES = 5;
   
   if (retryCount < MAX_RETRIES) {
     // Retry connection
   } else {
     console.log('Maximum retries reached. Please try again later.');
   }
   ```

3. **Use more conservative connection parameters:**
   ```javascript
   const sock = makeWASocket({
     connectTimeoutMs: 60000,
     keepAliveIntervalMs: 10000,
     retryRequestDelayMs: 2000,
     // other options
   });
   ```

### Error 500-504: Server Errors

**Symptoms:**
- Error message related to WhatsApp server issues
- Status codes: 500, 502, 503, 504
- Connection attempts fail, but start working later

**Causes:**
- WhatsApp server issues
- Network connectivity problems
- Temporary WhatsApp service disruptions

**Solutions:**

1. **Wait and retry automatically:**
   ```javascript
   const serverErrorCodes = [500, 502, 503, 504];
   
   if (serverErrorCodes.includes(statusCode)) {
     console.log('WhatsApp servers may be experiencing issues. Waiting longer before retry...');
     setTimeout(connectToWhatsApp, 60000); // Wait a full minute
   }
   ```

2. **Monitor WhatsApp status:**
   - Check [Down Detector](https://downdetector.com/status/whatsapp/) for WhatsApp outages
   - Wait for service to be restored if there are widespread issues

### Version Compatibility Issues

**Symptoms:**
- Unexpected errors with Baileys functions
- Features not working as expected
- Connection works but messaging fails

**Causes:**
- Using incompatible version of Baileys
- WhatsApp API changes not reflected in your version
- Dependencies conflicts

**Solutions:**

1. **Use the recommended Baileys version:**
   ```bash
   npm install @whiskeysockets/baileys@latest
   ```

2. **Ensure proper WebSocket implementation:**
   ```javascript
   // Make sure you have these installed
   npm install ws qrcode-terminal
   ```

3. **Update your version field in connection:**
   ```javascript
   const sock = makeWASocket({
     version: [2, 2323, 4], // Use appropriate version
     // other options
   });
   ```

## Using the Credential Backup System

This bot implements a robust credential backup system that can help maintain connections across restarts:

```javascript
// To backup credentials
const { backupCredentials } = require('./src/utils/credentialsBackup');
await backupCredentials(sock.authState.creds);

// To restore credentials
const { restoreAuthFiles } = require('./src/utils/credentialsBackup'); 
await restoreAuthFiles();
```

## QR Code Generation Options

1. **Terminal-only QR code (simplest, most reliable):**
   ```bash
   node qr-terminal.js
   ```

2. **Web-based QR code generator with detailed debugging:**
   ```bash
   node replit-qr.js
   ```

3. **Simple web QR server:**
   ```bash
   node simple-qr.js
   ```

## Recommended Workflow

1. Start with `replit-qr.js` to get a QR code and connect
2. After connecting successfully, credentials will be backed up automatically
3. Run the main bot with `node src/index.js` which will use the saved credentials
4. If connection is lost, the bot will attempt to reconnect automatically
5. If reconnection fails persistently, use `replit-qr.js` again to generate a fresh QR code

By following these practices, you should be able to maintain a more stable WhatsApp bot connection even in restricted cloud environments.