# Running Your WhatsApp Bot 24/7

This guide explains how to keep your WhatsApp bot running 24/7, even when you close your browser or shut down your computer.

## How It Works

Your bot now has two server components:
1. The main WhatsApp web server on port 5007 (for scanning QR codes)
2. A keep-alive server on port 3000 (for maintaining 24/7 operation)

By regularly pinging the keep-alive server, you can prevent Replit from shutting down your bot due to inactivity.

## Setting Up UptimeRobot (Free Method)

1. **Create an account at [UptimeRobot](https://uptimerobot.com/)** (free tier is sufficient)

2. **Add a new monitor**:
   - Click "Add New Monitor"
   - Select "HTTP(s)" as the monitor type
   - Enter a friendly name (e.g., "WhatsApp Bot")
   - Enter your Replit URL + port 3000 as the URL:
     ```
     https://your-replit-project.your-username.repl.co:3000
     ```
   - Set monitoring interval to 5 minutes
   - Click "Create Monitor"

3. **Verify the monitor is working**:
   - The status should turn green within 5-10 minutes
   - You can check the logs to see successful pings

## Testing 24/7 Operation

1. Connect your WhatsApp by scanning the QR code at port 5007
2. Close your browser completely
3. Wait a few hours
4. Return to check if your bot is still responding to commands

## Additional Persistence Tips

### Session Management

Your bot now stores authentication data in persistent directories:
- Main auth directory: `/home/runner/workspace/auth_info_baileys`
- Backup credentials: `/home/runner/workspace/sessions/creds_backup_*.json`

These files are preserved even when your Replit project is restarted, allowing your bot to reconnect without needing to scan the QR code again.

### Troubleshooting Connection Issues

If your bot disconnects frequently:

1. Try reconnecting by going to your bot's QR web interface (port 5007)
2. If it shows "Connected" but doesn't respond to commands, restart the Replit
3. Check UptimeRobot logs to ensure it's successfully pinging your keep-alive server
4. Make sure you don't have multiple instances of the bot running

## Advanced: Keeping Credentials Safe

Your bot automatically backs up credentials in several locations:
- Multiple backup files with timestamps
- Automatic cleanup of older backup files to prevent clutter

This ensures that even if one credential file gets corrupted, your bot can recover from backups.
