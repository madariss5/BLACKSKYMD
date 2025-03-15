# WhatsApp Connection Troubleshooting Guide

This guide provides specific solutions for common WhatsApp connection issues, especially when using the bot in cloud environments like Replit.

## Common Errors and Solutions

### Error: "Connection Failure (Status code: 405)"

This is the most common error when connecting from cloud environments. WhatsApp is blocking the connection attempt.

**Solutions:**

1. **Try the Terminal-Only QR Code Method**
   ```bash
   node src/terminal-qr.js
   ```
   
2. **Clear Authentication State and Try Again**
   ```bash
   # Use the interactive tool
   node connect-interactive.js
   # Select "Clear Credentials" option
   
   # Or manually delete auth folders
   rm -rf auth_info_baileys
   rm -rf auth_info_baileys_qr
   rm -rf auth_info_simple
   ```
   
3. **Use the Alternate Browser Connection Tool**
   ```bash
   node try-alternate-browser.js
   ```
   This tool lets you switch browser configurations to bypass restrictions.

4. **Try After Hours or on Weekends**
   WhatsApp's server-side security measures may be less strict during off-peak hours.

### Error: "getaddrinfo ENOTFOUND web.whatsapp.com"

This indicates DNS resolution issues.

**Solutions:**

1. **Check Your Network Connection**
   Make sure your internet connection is working properly.
   
2. **Run Connection Diagnostics**
   ```bash
   node check-connection.js
   ```
   
3. **Modify Your DNS Settings (if possible)**
   Use Google DNS (8.8.8.8) or Cloudflare DNS (1.1.1.1).

### Error: "WebSocket connection failed"

This usually indicates network restrictions or firewall issues.

**Solutions:**

1. **Try the Specialized QR Generator**
   ```bash
   node src/qr-generator.js
   ```
   
2. **Enable Keep-Alive in Connection Parameters**
   Edit `src/qr-generator.js` and modify the connection options:
   ```javascript
   const connectOptions = {
       keepAliveIntervalMs: 10000,
       retryRequestDelayMs: 3000
   };
   ```

### Error: "timeout after 60000 ms"

The connection process is taking too long and timing out.

**Solutions:**

1. **Increase Timeout Duration**
   Edit the connection parameters in the relevant file (e.g., `src/index.js`):
   ```javascript
   const connectOptions = {
       connectTimeoutMs: 120000  // Increase to 2 minutes
   };
   ```
   
2. **Check Your Internet Speed**
   Slow connections may need increased timeouts.

### Error: "User rejected the conversation"

WhatsApp servers are actively rejecting the connection request.

**Solutions:**

1. **Use the Quick Connect Script**
   ```bash
   node quick-connect.js
   ```
   This script tries multiple connection methods automatically.
   
2. **Wait 24 Hours Before Trying Again**
   WhatsApp may temporarily restrict connections from certain IP addresses.
   
3. **Try Connecting from a Different Network**
   If possible, restart your Replit project to get a new IP address.

## Preventing Connection Issues

Follow these best practices to minimize connection problems:

1. **Use Session Persistence**
   Once connected, the bot will save credentials for future use.
   
2. **Use the Interactive Connection Helper**
   ```bash
   node connect-interactive.js
   ```
   
3. **Maintain a Single Active Session**
   Don't connect the same WhatsApp account from multiple locations simultaneously.

4. **Implement Gradual Reconnection**
   When the bot disconnects, it should attempt reconnection with increasing delay intervals.

## Advanced Troubleshooting

### Connection Not Working Even After Multiple Attempts

If you've tried all the above solutions and still cannot connect:

1. **Check Browser Compatibility**
   Edit `try-alternate-browser.js` to try different browser fingerprints.
   
2. **Verify WhatsApp Server Status**
   Check if WhatsApp is experiencing outages.
   
3. **Try the Ultra-Minimal Connection Script**
   ```bash
   node src/terminal-qr.js
   ```
   
4. **Check the Latest WhatsApp Web Changes**
   WhatsApp occasionally updates their web interface, which can affect the bot.

### Persistent Authentication Problems

If the bot cannot maintain a session or keeps asking for QR code scanning:

1. **Ensure Auth Directory Permissions**
   Make sure the `auth_info_baileys` directory is writable.
   
2. **Implement Session Backup**
   The bot includes session backup functionality to prevent loss of authentication.
   
3. **Check WhatsApp Account Status**
   Make sure your WhatsApp account is active and not banned or restricted.

## Getting Help

If you continue to experience connection issues:

1. **Run Diagnostics and Check Logs**
   ```bash
   node check-connection.js
   ```
   
2. **Try the Auto-Connection Feature**
   ```bash
   node quick-connect.js
   ```
   
3. **Contact Project Maintainers**
   Provide detailed information about the error and the steps you've already taken.

## Additional Resources

- [Baileys Documentation](https://github.com/WhiskeySockets/Baileys)
- [WhatsApp Web API Changes Log](https://github.com/WhiskeySockets/Baileys/blob/master/CHANGELOG.md)
- [WhatsApp's Official Business API](https://developers.facebook.com/docs/whatsapp/)