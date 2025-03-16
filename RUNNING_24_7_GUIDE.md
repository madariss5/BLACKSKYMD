# Running Your WhatsApp Bot 24/7

This guide will help you keep your WhatsApp bot running 24/7, even when Replit is closed.

## Method 1: Using UptimeRobot (Free)

UptimeRobot is a service that can ping your Replit URL every 5 minutes to keep it from going to sleep.

1. Sign up for a free account at [UptimeRobot](https://uptimerobot.com/)
2. Add a new monitor:
   - Monitor Type: HTTP(s)
   - Friendly Name: "WhatsApp Bot"
   - URL: Your Replit URL (e.g., https://your-repl-name.yourusername.repl.co)
   - Monitoring Interval: Every 5 minutes

This will keep your Replit instance active. However, free Replit instances may still restart occasionally.

## Method 2: Using Replit's Always On Feature (Paid)

If you have Replit Pro or Hacker Plan, you can use the "Always On" feature:

1. Go to your Replit dashboard
2. Select your WhatsApp bot project
3. In the project overview, find and enable the "Always On" toggle

This is the most reliable method for keeping your bot running on Replit.

## Method 3: Deploy to a VPS (Advanced)

For the most reliable 24/7 operation, you can deploy to a Virtual Private Server:

1. Create an account on a VPS provider (DigitalOcean, Linode, etc.)
2. Create a basic Ubuntu server ($5/month options are enough)
3. SSH into your server and run these commands:

```bash
# Update system and install Node.js
sudo apt update
sudo apt install -y nodejs npm git

# Clone your repository
git clone https://github.com/yourusername/your-repo.git
cd your-repo

# Install dependencies
npm install

# Install PM2 to keep the bot running
npm install -g pm2

# Start the bot with PM2
pm2 start src/qr-web-server.js --name whatsapp-bot

# Make PM2 start the bot on server reboot
pm2 startup
pm2 save
```

## Enhanced Session Management 

I've implemented several features to improve your bot's ability to reconnect:

1. **Multiple Backup Locations**: Your session is backed up in several directories for redundancy.
2. **Automatic Backup**: The session is automatically backed up every 15 minutes.
3. **Robust Restoration**: The bot will search multiple locations to find valid credentials when restarting.

## Testing If Your Bot Stays Connected

1. Connect your WhatsApp by scanning the QR code
2. Send a few test messages like `.ping` to verify it's working
3. Keep Replit running for at least 30 minutes to ensure backup systems work
4. Check that backup files are created in the following locations:
   - `./backups/`
   - `./auth_info_baileys_backup/`
   - `./data/session_backups/`

## Troubleshooting

If your bot disconnects:

1. Check if Replit is still running
2. Verify that your monitoring service (UptimeRobot) is active
3. If restarting, check the logs for errors
4. Try scanning the QR code again if needed

Remember that WhatsApp Web sessions typically last 2-4 weeks before requiring a new login, even with perfect uptime.