# Setting Up Your WhatsApp Bot on DigitalOcean

This guide provides step-by-step instructions for deploying your WhatsApp bot on a DigitalOcean droplet for 24/7 operation.

## Why DigitalOcean?

DigitalOcean offers an excellent balance of cost, performance, and reliability:
- Affordable starting at $5/month for a basic droplet
- SSD-based storage for fast performance
- 99.99% uptime SLA
- Simple setup and management
- Reliable network infrastructure

## Prerequisites

- A DigitalOcean account (with billing information set up)
- Your WhatsApp bot code (from this repository)
- Basic command line knowledge
- SSH client (built into Mac/Linux, use PuTTY on Windows)

## Step 1: Create a DigitalOcean Droplet

1. Log in to your DigitalOcean account
2. Click "Create" → "Droplets"
3. Choose the following settings:
   - **Region**: Choose one closest to your users
   - **Image**: Ubuntu 22.04 LTS x64
   - **Size**: Basic ($5/mo with 1GB RAM/1 CPU)
   - **Add SSH Key**: Follow the prompts to add your SSH key
   - **Hostname**: something memorable like `whatsapp-bot`

4. Click "Create Droplet"

## Step 2: Connect to Your Droplet

Once your droplet is created, you'll get its IP address. Connect using SSH:

```bash
ssh root@YOUR_DROPLET_IP
```

## Step 3: Update System and Install Dependencies

```bash
# Update package lists and upgrade existing packages
apt update && apt upgrade -y

# Install essential tools
apt install -y git curl wget build-essential

# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Verify installations
node -v  # Should show v20.x.x
npm -v   # Should show 10.x.x or higher

# Install PM2 process manager globally
npm install -g pm2
```

## Step 4: Setup Firewall (Optional but Recommended)

```bash
# Enable UFW
ufw enable

# Allow SSH, HTTP, and HTTPS
ufw allow ssh
ufw allow http
ufw allow https

# Verify status
ufw status
```

## Step 5: Clone Your Repository

```bash
# Create directory for your application
mkdir -p /opt/whatsapp-bot
cd /opt/whatsapp-bot

# Clone your repository
git clone https://github.com/your-username/your-repo.git .
# OR upload your files using SCP or SFTP

# Install dependencies
npm install
```

## Step 6: Configure Environment Variables

```bash
# Create .env file
nano .env
```

Add your environment variables:

```
# Bot Configuration
BOT_NAME=BLACKSKY-MD
PREFIX=!
WELCOME_MESSAGE=Welcome to BLACKSKY-MD Bot!

# Optional API Keys
OPENAI_API_KEY=your_api_key_if_needed

# Admin Settings
OWNER_NUMBER=your_phone_number
```

Press `CTRL+X`, then `Y` to save and exit.

## Step 7: Setup the Bot to Run with PM2

```bash
# Start your bot with PM2
pm2 start src/index.js --name whatsapp-bot

# Configure PM2 to start on system boot
pm2 startup ubuntu
# Run the command that PM2 outputs

# Save the current PM2 processes
pm2 save

# Check status
pm2 status
```

## Step 8: Setup Auto-Restart and Maintenance

Create a maintenance script:

```bash
nano /opt/whatsapp-bot/maintenance.sh
```

Add the following:

```bash
#!/bin/bash
# Maintenance script for WhatsApp bot

# Navigate to app directory
cd /opt/whatsapp-bot

# Pull latest changes (if using Git)
git pull

# Update dependencies
npm install

# Restart the bot
pm2 restart whatsapp-bot

# Ensure PM2 process list is saved
pm2 save

# Log the maintenance event
echo "Maintenance performed at $(date)" >> maintenance_log.txt
```

Make it executable:

```bash
chmod +x /opt/whatsapp-bot/maintenance.sh
```

Add a cron job for regular maintenance:

```bash
# Open crontab editor
crontab -e
```

Add this line to run maintenance every day at 3 AM:

```
0 3 * * * /opt/whatsapp-bot/maintenance.sh
```

Save and exit.

## Step 9: Setup Session Backup Strategy

Create a backup script:

```bash
nano /opt/whatsapp-bot/backup.sh
```

Add the following:

```bash
#!/bin/bash
# WhatsApp session backup script

# Set variables
BACKUP_DIR="/opt/backups/whatsapp"
SOURCE_DIR="/opt/whatsapp-bot/auth_info_baileys"
DATE=$(date +"%Y-%m-%d_%H-%M-%S")
BACKUP_FILE="$BACKUP_DIR/whatsapp_session_$DATE.tar.gz"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Create the backup
tar -czf "$BACKUP_FILE" -C "/opt/whatsapp-bot" "auth_info_baileys"

# Remove backups older than 7 days
find "$BACKUP_DIR" -type f -name "whatsapp_session_*.tar.gz" -mtime +7 -exec rm {} \;

# Log the backup
echo "Backup created at $DATE: $BACKUP_FILE" >> "$BACKUP_DIR/backup_log.txt"
```

Make it executable and set up a cron job:

```bash
chmod +x /opt/whatsapp-bot/backup.sh
crontab -e
```

Add this line to run a backup every 6 hours:

```
0 */6 * * * /opt/whatsapp-bot/backup.sh
```

## Step 10: Monitoring Setup

Install a simple monitoring script:

```bash
nano /opt/whatsapp-bot/monitor.sh
```

Add this content:

```bash
#!/bin/bash
# Simple monitoring for WhatsApp bot

# Check if process is running
if ! pm2 show whatsapp-bot | grep -q "online"; then
  echo "Bot is not running! Attempting restart..."
  pm2 restart whatsapp-bot
  
  # Send notification (optional - requires mailutils)
  echo "WhatsApp bot was down and has been restarted at $(date)" | mail -s "Bot Restart Alert" your-email@example.com
  
  echo "Restart attempted at $(date)" >> /opt/whatsapp-bot/monitoring_log.txt
else
  echo "Bot check OK at $(date)" >> /opt/whatsapp-bot/monitoring_log.txt
fi
```

Set it up to run every 15 minutes:

```bash
chmod +x /opt/whatsapp-bot/monitor.sh
crontab -e
```

Add this line:

```
*/15 * * * * /opt/whatsapp-bot/monitor.sh
```

## Step 11: Initial Scan of QR Code

When you first start the bot, you'll need to scan a QR code with your WhatsApp. You have two options:

### Option 1: If your droplet has a public IP/domain with HTTP enabled
1. Configure your bot to serve the QR code on a web interface
2. Access the QR code via your browser at `http://YOUR_DROPLET_IP:PORT`

### Option 2: For command-line only access
1. Install `qrencode` package:
   ```bash
   apt install -y qrencode
   ```
2. Modify your bot code to save the QR code or pipe it to qrencode
3. You can then view the QR code directly in terminal:
   ```bash
   pm2 logs whatsapp-bot
   ```

## Step 12: Security Hardening (Optional but Recommended)

For additional security:

```bash
# Create a new user for running the bot
adduser botuser
usermod -aG sudo botuser

# Transfer ownership of files
chown -R botuser:botuser /opt/whatsapp-bot

# Configure PM2 to run as this user
# First stop current PM2 instance
pm2 kill

# Switch to the new user
su - botuser

# Start PM2 with the bot
cd /opt/whatsapp-bot
pm2 start src/index.js --name whatsapp-bot
pm2 save

# Setup PM2 to start on boot for this user
pm2 startup
# Run the command that PM2 outputs
```

## Troubleshooting

### Connection Issues
- Check internet connectivity: `ping google.com`
- Verify WhatsApp's server status
- Try regenerating the QR code
- Check the logs: `pm2 logs whatsapp-bot`

### Performance Issues
- Monitor system resources: `htop`
- Check disk space: `df -h`
- Consider upgrading your droplet if resources are consistently maxed out

### Bot Not Starting
- Check for errors: `pm2 logs whatsapp-bot`
- Verify Node.js version: `node -v`
- Ensure all dependencies are installed: `cd /opt/whatsapp-bot && npm install`
- Check file permissions: `ls -la /opt/whatsapp-bot`

## Upgrading Your Droplet (if needed)

If you need more resources:
1. Go to your DigitalOcean dashboard
2. Select your droplet
3. Click on "Resize"
4. Choose a larger size
5. Apply the changes

Your droplet will restart with the new specifications.

## Conclusion

You now have a robust, 24/7 setup for your WhatsApp bot on DigitalOcean. This configuration includes:

- Reliable hosting with fast SSD storage
- Automatic startup and recovery
- Regular maintenance and updates
- Session backups
- Basic monitoring

The $5/month Basic droplet is sufficient for most personal or small business bots. For higher volume needs, consider upgrading to a larger droplet or implementing database optimizations.

## Additional Resources

- [DigitalOcean Documentation](https://docs.digitalocean.com/)
- [PM2 Documentation](https://pm2.keymetrics.io/docs/usage/quick-start/)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)
- [UFW Firewall Guide](https://www.digitalocean.com/community/tutorials/how-to-set-up-a-firewall-with-ufw-on-ubuntu-20-04)