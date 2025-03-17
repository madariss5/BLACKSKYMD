# Complete Guide to Running WhatsApp Bot 24/7 on Termux

This comprehensive guide will walk you through setting up your WhatsApp bot to run continuously on an Android device using Termux, with optimizations for battery life and performance.

## Why Use Termux?

- Run your bot on spare Android devices
- No monthly hosting costs
- Physical device you control completely
- Can run 24/7 with proper setup
- Great option for users in regions with expensive hosting

## Prerequisites

- Android device (Android 7.0 or higher recommended)
- At least 3GB of RAM (4GB+ recommended)
- At least 5GB of free storage
- Stable internet connection
- Power supply (continuous charging recommended)

## Step 1: Install Termux

1. Install Termux from F-Droid (recommended over Play Store):
   - Visit [F-Droid.org](https://f-droid.org/) and download the F-Droid app
   - Open F-Droid and search for "Termux"
   - Install the latest version

2. Install Termux:Boot (for auto-start):
   - In F-Droid, search for "Termux:Boot"
   - Install the app

3. Grant necessary permissions:
   - Go to Settings > Apps > Termux
   - Grant storage permissions
   - Enable autostart permission (varies by device)

## Step 2: Initial Termux Setup

Open Termux and run these commands:

```bash
# Update package lists
pkg update -y

# Upgrade existing packages
pkg upgrade -y

# Install essential packages
pkg install -y git nodejs yarn wget curl nano openssh cronie termux-services termux-api

# Create storage directory
termux-setup-storage

# Enable services
sv-enable crond
```

## Step 3: Configure Termux for Better Performance

```bash
# Edit Termux properties
mkdir -p ~/.termux
echo "allow-external-apps=true" > ~/.termux/termux.properties

# Set up better font and colors
wget https://github.com/termux/termux-styling/raw/master/app/src/main/assets/fonts/Hack-Regular.ttf -O ~/.termux/font.ttf
echo "extra-keys = [['ESC','/','-','HOME','UP','END','PGUP'],['TAB','CTRL','ALT','LEFT','DOWN','RIGHT','PGDN']]" > ~/.termux/termux.properties

# Restart Termux to apply changes
termux-reload-settings
```

## Step 4: Battery Optimization Settings

Run these commands to create a battery optimization script:

```bash
# Create a script for battery optimization
cat > ~/battery-optimize.sh << 'EOF'
#!/data/data/com.termux/files/usr/bin/bash

# Prevent device from sleeping when plugged in
termux-wake-lock

# Set notification
termux-notification -t "WhatsApp Bot Running" -c "Bot is active and running. Battery optimization enabled."

# Log start time
echo "Service started at $(date)" >> ~/bot-uptime.log

# Keep script running to maintain wake lock
while true; do
  sleep 1800  # 30 minutes
  echo "Service still running at $(date)" >> ~/bot-uptime.log
done
EOF

# Make it executable
chmod +x ~/battery-optimize.sh
```

## Step 5: Clone Your Bot Repository

```bash
# Create directory for your bot
mkdir -p ~/whatsapp-bot

# Clone your repository
cd ~/whatsapp-bot
git clone https://github.com/your-username/your-repo.git .

# Install dependencies
npm install
```

## Step 6: Configure Auto-Start on Boot

Create a boot script to start your bot automatically when the device reboots:

```bash
# Create boot directory if it doesn't exist
mkdir -p ~/.termux/boot

# Create the boot script
cat > ~/.termux/boot/start-whatsapp-bot << 'EOF'
#!/data/data/com.termux/files/usr/bin/bash

# Start the battery optimization in the background
~/battery-optimize.sh &

# Wait for a moment to ensure internet connectivity
sleep 30

# Navigate to bot directory
cd ~/whatsapp-bot

# Start the bot with PM2
pm2 start src/index.js --name whatsapp-bot

# Log boot start
echo "Bot started after boot at $(date)" >> ~/bot-boot.log
EOF

# Make it executable
chmod +x ~/.termux/boot/start-whatsapp-bot

# Install PM2 for process management
npm install -g pm2
```

## Step 7: Set Up PM2 for Process Management

```bash
# Navigate to your bot directory
cd ~/whatsapp-bot

# Install PM2 globally if not already done
npm install -g pm2

# Start your bot with PM2
pm2 start src/index.js --name whatsapp-bot

# Set up PM2 to save process list
pm2 save

# Enable PM2 to start on boot
pm2 startup

# Copy the command displayed by PM2 and run it
```

## Step 8: Create Maintenance Scripts

### Automatic Updates Script

```bash
cat > ~/update-bot.sh << 'EOF'
#!/data/data/com.termux/files/usr/bin/bash

# Navigate to bot directory
cd ~/whatsapp-bot

# Pull latest changes from git
git pull

# Install any new dependencies
npm install

# Restart the bot
pm2 restart whatsapp-bot

# Log the update
echo "Bot updated at $(date)" >> ~/bot-updates.log
EOF

chmod +x ~/update-bot.sh
```

### Session Backup Script

```bash
cat > ~/backup-session.sh << 'EOF'
#!/data/data/com.termux/files/usr/bin/bash

# Define variables
BACKUP_DIR=~/storage/shared/WhatsAppBotBackups
SOURCE_DIR=~/whatsapp-bot/auth_info_baileys
DATE=$(date +"%Y-%m-%d_%H-%M")
BACKUP_FILE="$BACKUP_DIR/whatsapp_session_$DATE.tar.gz"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Create the backup
tar -czf "$BACKUP_FILE" -C ~/whatsapp-bot auth_info_baileys

# Remove backups older than 7 days
find "$BACKUP_DIR" -name "whatsapp_session_*.tar.gz" -mtime +7 -delete

# Log the backup
echo "Backup created at $DATE: $BACKUP_FILE" >> "$BACKUP_DIR/backup_log.txt"
EOF

chmod +x ~/backup-session.sh
```

### Log Rotation Script

```bash
cat > ~/rotate-logs.sh << 'EOF'
#!/data/data/com.termux/files/usr/bin/bash

# Set log directory
LOG_DIR=~/whatsapp-bot/logs

# Create log directory if it doesn't exist
mkdir -p "$LOG_DIR"

# Compress logs older than 2 days
find "$LOG_DIR" -name "*.log" -mtime +2 -exec gzip {} \;

# Delete logs older than 7 days
find "$LOG_DIR" -name "*.log.gz" -mtime +7 -delete

# Log the rotation
echo "Log rotation completed at $(date)" >> "$LOG_DIR/rotation.log"
EOF

chmod +x ~/rotate-logs.sh
```

## Step 9: Set Up Cron Jobs for Automated Maintenance

```bash
# Open crontab editor
crontab -e
```

Add these lines:

```
# Run update script every day at 3 AM
0 3 * * * ~/update-bot.sh

# Backup session every 6 hours
0 */6 * * * ~/backup-session.sh

# Rotate logs daily at 2 AM
0 2 * * * ~/rotate-logs.sh

# Check if bot is running every 15 minutes
*/15 * * * * pgrep -f "node src/index.js" || ~/termux-start-bot.sh

# Create a monitoring check
*/30 * * * * pm2 restart whatsapp-bot
```

## Step 10: Create a Monitoring System

```bash
cat > ~/monitor-bot.sh << 'EOF'
#!/data/data/com.termux/files/usr/bin/bash

# Check if PM2 is running
if ! pgrep -f "pm2" > /dev/null; then
  echo "PM2 not running, starting..."
  pm2 resurrect
  echo "PM2 restarted at $(date)" >> ~/bot-monitoring.log
fi

# Check if bot process is running
if ! pm2 list | grep -q "whatsapp-bot"; then
  echo "Bot not running, restarting..."
  cd ~/whatsapp-bot
  pm2 start src/index.js --name whatsapp-bot
  echo "Bot restarted at $(date)" >> ~/bot-monitoring.log
  
  # Send notification
  termux-notification -t "WhatsApp Bot Restarted" -c "Bot was down and has been restarted."
else
  # Check memory usage
  MEM_USAGE=$(pm2 info whatsapp-bot | grep "memory" | awk '{print $4}')
  if [[ "$MEM_USAGE" > "300" ]]; then
    echo "High memory usage ($MEM_USAGE MB), restarting bot..."
    pm2 restart whatsapp-bot
    echo "Bot restarted due to high memory usage at $(date)" >> ~/bot-monitoring.log
  fi
fi
EOF

chmod +x ~/monitor-bot.sh

# Add to crontab
crontab -e
```

Add this line:

```
*/10 * * * * ~/monitor-bot.sh
```

## Step 11: Advanced Battery Optimization

For devices running 24/7, create this script:

```bash
cat > ~/battery-health.sh << 'EOF'
#!/data/data/com.termux/files/usr/bin/bash

# Function to check battery level
check_battery() {
  termux-battery-status | grep percentage | awk '{print $2}' | sed 's/,//g'
}

# Function to check if device is charging
is_charging() {
  CHARGING=$(termux-battery-status | grep status | grep -i "charging")
  if [ -z "$CHARGING" ]; then
    echo "false"
  else
    echo "true"
  fi
}

# Get battery level
BATTERY_LEVEL=$(check_battery)
CHARGING=$(is_charging)

# Log battery status
echo "Battery Status: $BATTERY_LEVEL%, Charging: $CHARGING ($(date))" >> ~/battery-log.txt

# If battery is critically low and not charging, shut down gracefully
if [ "$BATTERY_LEVEL" -lt 5 ] && [ "$CHARGING" = "false" ]; then
  echo "Critical battery level! Shutting down bot to prevent data loss." >> ~/battery-log.txt
  pm2 stop whatsapp-bot
  termux-notification -t "CRITICAL: Bot Shutdown" -c "Battery critically low. Bot has been stopped to prevent data corruption."
fi

# If battery is getting low, send notification
if [ "$BATTERY_LEVEL" -lt 20 ] && [ "$CHARGING" = "false" ]; then
  termux-notification -t "Low Battery Warning" -c "Battery at $BATTERY_LEVEL%. Please connect charger to keep bot running."
fi

# If battery is high and still charging, send notification to unplug
if [ "$BATTERY_LEVEL" -gt 95 ] && [ "$CHARGING" = "true" ]; then
  HOUR=$(date +"%H")
  # Only notify during waking hours (8am-11pm)
  if [ "$HOUR" -ge 8 ] && [ "$HOUR" -lt 23 ]; then
    termux-notification -t "Battery Health" -c "Battery at $BATTERY_LEVEL%. Consider unplugging to improve battery health."
  fi
fi
EOF

chmod +x ~/battery-health.sh

# Add to crontab
crontab -e
```

Add this line:

```
*/30 * * * * ~/battery-health.sh
```

## Step 12: Initial Bot Launch and QR Code Scanning

Now you can start your bot and scan the QR code:

```bash
# Navigate to your bot directory
cd ~/whatsapp-bot

# Start the bot 
node src/index.js
```

Scan the QR code when prompted. After successful connection, stop the bot with Ctrl+C and restart it with PM2:

```bash
pm2 start src/index.js --name whatsapp-bot
```

## Step 13: Create a Startup Script for Manual Starts

```bash
cat > ~/termux-start-bot.sh << 'EOF'
#!/data/data/com.termux/files/usr/bin/bash

# Wake lock to prevent sleep
termux-wake-lock

# Start battery optimization in background
~/battery-optimize.sh &

# Navigate to bot directory
cd ~/whatsapp-bot

# Check if PM2 is running
if ! pgrep -f "pm2" > /dev/null; then
  pm2 resurrect
  sleep 2
fi

# Start bot if not already running
if ! pm2 list | grep -q "whatsapp-bot"; then
  pm2 start src/index.js --name whatsapp-bot
fi

# Create notification
termux-notification -t "WhatsApp Bot Started" -c "Bot is now running in background mode."

# Log start
echo "Bot manually started at $(date)" >> ~/bot-manual-starts.log
EOF

chmod +x ~/termux-start-bot.sh
```

## Step 14: Performance Optimization for Termux

To improve your bot's performance on Termux:

```bash
# Edit Node.js memory settings
cat > ~/.npmrc << 'EOF'
node_options=--max_old_space_size=512
EOF

# Create a swap file for extra memory
cd ~
termux-setup-storage
dd if=/dev/zero of=~/storage/shared/swapfile bs=1M count=1024
mkswap ~/storage/shared/swapfile
swapon ~/storage/shared/swapfile

# Add swap mount to startup
echo "swapon ~/storage/shared/swapfile" >> ~/.bashrc
```

## Maintenance and Troubleshooting

### Updating Your Bot

To update your bot with the latest code:

```bash
~/update-bot.sh
```

### Checking Logs

```bash
# View PM2 logs
pm2 logs whatsapp-bot

# View last 100 lines
pm2 logs whatsapp-bot --lines 100
```

### Restoring Session from Backup

If you need to restore a session from backup:

```bash
# List available backups
ls -la ~/storage/shared/WhatsAppBotBackups/

# Extract a specific backup
cd ~/whatsapp-bot
tar -xzf ~/storage/shared/WhatsAppBotBackups/whatsapp_session_YYYY-MM-DD_HH-MM.tar.gz
```

### Troubleshooting Common Issues

1. **Bot crashes frequently**:
   - Check memory usage with `pm2 monit`
   - Increase Node.js memory limit
   - Ensure device has sufficient free RAM

2. **Bot disconnects from WhatsApp**:
   - Check internet connectivity
   - Verify WhatsApp server status
   - Ensure battery optimization isn't killing the app

3. **Termux closed by system**:
   - Disable battery optimization for Termux in Android settings
   - Add Termux to protected apps list
   - Use a device with more RAM

4. **QR code scanning issues**:
   - Clear auth_info_baileys folder
   - Update WhatsApp on your phone
   - Restart the bot with fresh session

## Best Practices for 24/7 Operation

1. **Power Management**:
   - Keep the device plugged in to a good quality charger
   - Consider using a smart plug with scheduling to cycle charging
   - Use a surge protector

2. **Internet Connection**:
   - Use a reliable WiFi connection
   - Consider a backup data plan
   - Set up automatic reconnection

3. **Device Selection**:
   - Use a dedicated device (not your primary phone)
   - Older flagship phones often work better than new budget phones
   - Minimum 3GB RAM, 4GB+ recommended

4. **Physical Setup**:
   - Place device in a well-ventilated area
   - Keep away from direct sunlight and heat sources
   - Consider a small fan for cooling if device runs hot

5. **Monitoring**:
   - Check on the device physically once a day if possible
   - Set up the monitoring scripts as shown above
   - Consider setting up remote monitoring with Termux:API SMS

## Conclusion

You now have a comprehensive setup for running your WhatsApp bot 24/7 on Termux with:

- Automatic startup after device reboot
- Battery optimization and monitoring
- Process management with PM2
- Scheduled maintenance and updates
- Session backups and log rotation
- Performance optimizations for mobile devices

This setup should provide a reliable self-hosted option for your WhatsApp bot without monthly hosting costs.