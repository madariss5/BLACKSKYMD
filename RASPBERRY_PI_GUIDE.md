# Running Your WhatsApp Bot 24/7 on Raspberry Pi

This comprehensive guide walks you through the process of setting up your WhatsApp bot to run reliably on a Raspberry Pi, providing an affordable self-hosted 24/7 solution with complete control.

## Why Use Raspberry Pi?

- **One-time cost**: No monthly hosting fees
- **Low power consumption**: 5-10W usage (approximately $5-10/year in electricity)
- **Complete control**: Full access to hardware and software
- **Expandability**: Add external storage, cooling, UPS backup
- **Learning opportunity**: Great for developing Linux server skills

## Hardware Requirements

### Minimum Setup:
- Raspberry Pi 3B+ or newer
- 16GB microSD card (class 10 or better)
- 5V/2.5A power supply
- Ethernet connection (recommended) or reliable Wi-Fi

### Recommended Setup:
- Raspberry Pi 4 (2GB+ RAM)
- 32GB+ microSD card (A2 rating for better performance)
- Official Raspberry Pi power supply
- Ethernet connection
- Basic heatsink kit
- Small case with passive cooling

### Optional Enhancements:
- USB SSD for better reliability and performance
- Small cooling fan
- UPS HAT or battery backup
- GPIO status LED

## Initial Setup

### Step 1: Install Raspberry Pi OS Lite

1. Download [Raspberry Pi Imager](https://www.raspberrypi.com/software/)
2. Insert your microSD card into your computer
3. Open Pi Imager and select:
   - Choose OS: Raspberry Pi OS (64-bit) Lite
   - Choose Storage: Your microSD card
   - Click on the gear icon (⚙️) to access advanced options
   - Set hostname (e.g., `whatsapp-bot`)
   - Enable SSH
   - Set username and password
   - Configure your Wi-Fi (if not using Ethernet)
   - Click "Save" then "Write"

4. Insert the microSD card into your Raspberry Pi and power it on

### Step 2: Initial Configuration

1. Connect to your Pi via SSH:
   ```bash
   ssh username@whatsapp-bot.local
   ```
   (or use the IP address if hostname doesn't work)

2. Update your system:
   ```bash
   sudo apt update && sudo apt full-upgrade -y
   ```

3. Configure basic settings:
   ```bash
   sudo raspi-config
   ```
   
   Recommended settings:
   - System Options > Boot / Auto Login > Console
   - Performance Options > GPU Memory > 16 (minimal for headless)
   - Localisation Options > set your timezone
   - Advanced Options > Expand Filesystem
   - Finish and reboot

### Step 3: Install Node.js

```bash
# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node -v  # Should show v20.x.x
npm -v   # Should show 10.x.x or higher

# Install PM2 globally for process management
sudo npm install -g pm2
```

### Step 4: Optional - Set Up USB SSD Boot (Recommended)

For better reliability and performance, consider booting from USB SSD:

1. Prepare a USB SSD with Raspberry Pi OS using the same steps as for the microSD card
2. Enable USB boot in the bootloader:
   ```bash
   sudo raspi-config
   ```
   Navigate to Advanced Options > Boot Order > USB Boot

3. Shut down the Pi, remove the microSD card, connect the USB SSD, and power on

## Bot Installation

### Step 1: Prepare the Environment

```bash
# Create a directory for your bot
mkdir -p ~/whatsapp-bot
cd ~/whatsapp-bot

# Clone your repository
git clone https://github.com/your-username/your-repo.git .

# Install dependencies
npm install
```

### Step 2: Set Up Environment Variables

```bash
# Create .env file
nano .env
```

Add your configuration:
```
PREFIX=!
OWNER_NUMBER=your_number_here
DEBUG=false
```

Press Ctrl+X, then Y to save and exit.

### Step 3: Test Run the Bot

```bash
# Start the bot directly to verify it works
node src/index.js
```

When the QR code appears, scan it with your WhatsApp app. After successful connection, press Ctrl+C to stop the bot.

## Setting Up for 24/7 Operation

### Step 1: Configure PM2 for Process Management

```bash
# Start your bot with PM2
cd ~/whatsapp-bot
pm2 start src/index.js --name whatsapp-bot

# Make PM2 automatically start on boot
pm2 startup
# Run the command that PM2 outputs

# Save the current process list
pm2 save
```

### Step 2: Create Automatic Session Backup

1. Create a backup script:
   ```bash
   nano ~/whatsapp-bot/backup-session.sh
   ```

2. Add the following content:
   ```bash
   #!/bin/bash

   # Configuration
   BACKUP_DIR="/home/pi/whatsapp-backups"
   BOT_DIR="/home/pi/whatsapp-bot"
   DATE=$(date +"%Y-%m-%d_%H-%M")
   BACKUP_FILE="$BACKUP_DIR/session_backup_$DATE.tar.gz"
   MAX_BACKUPS=10

   # Create backup directory if it doesn't exist
   mkdir -p "$BACKUP_DIR"

   # Create the backup
   tar -czf "$BACKUP_FILE" -C "$BOT_DIR" "auth_info_baileys"

   # Verify backup
   if [ -f "$BACKUP_FILE" ]; then
     echo "Backup created successfully at $BACKUP_FILE"
     
     # Keep only the latest MAX_BACKUPS backups
     ls -tr "$BACKUP_DIR"/session_backup_*.tar.gz | head -n -"$MAX_BACKUPS" | xargs rm -f
   else
     echo "Backup failed!"
   fi
   ```

3. Make it executable:
   ```bash
   chmod +x ~/whatsapp-bot/backup-session.sh
   ```

4. Set up a cron job to run the backup script:
   ```bash
   crontab -e
   ```

5. Add this line to run backups every 6 hours:
   ```
   0 */6 * * * /home/pi/whatsapp-bot/backup-session.sh >> /home/pi/whatsapp-backups/backup.log 2>&1
   ```

### Step 3: Set Up Monitoring and Auto-Recovery

1. Create a monitoring script:
   ```bash
   nano ~/whatsapp-bot/monitor.sh
   ```

2. Add the following content:
   ```bash
   #!/bin/bash

   # Check if bot process is running
   if ! pm2 list | grep -q "whatsapp-bot"; then
     echo "Bot is not running! Restarting..."
     cd /home/pi/whatsapp-bot
     pm2 start src/index.js --name whatsapp-bot
     echo "Bot restarted at $(date)" >> /home/pi/whatsapp-bot/monitor.log
   fi

   # Check memory usage and restart if too high
   MEMORY_USAGE=$(pm2 jlist | grep -o '"memory":[0-9]*' | grep -o '[0-9]*')
   if [ "$MEMORY_USAGE" -gt 300000000 ]; then  # 300MB
     echo "Memory usage too high ($MEMORY_USAGE bytes). Restarting bot..."
     pm2 restart whatsapp-bot
     echo "Bot restarted due to high memory usage at $(date)" >> /home/pi/whatsapp-bot/monitor.log
   fi
   ```

3. Make it executable:
   ```bash
   chmod +x ~/whatsapp-bot/monitor.sh
   ```

4. Add to crontab to run every 15 minutes:
   ```bash
   crontab -e
   ```

5. Add this line:
   ```
   */15 * * * * /home/pi/whatsapp-bot/monitor.sh
   ```

## Hardware Optimization

### Step 1: Cooling and Power Management

For reliable 24/7 operation, properly cooling your Raspberry Pi is essential:

1. Install temperature monitoring tools:
   ```bash
   sudo apt install -y lm-sensors
   ```

2. Check temperature:
   ```bash
   vcgencmd measure_temp
   ```

3. Create a temperature logging script:
   ```bash
   nano ~/temp-monitor.sh
   ```

4. Add the following content:
   ```bash
   #!/bin/bash
   TEMP=$(vcgencmd measure_temp | cut -d= -f2 | cut -d"'" -f1)
   echo "$(date +'%Y-%m-%d %H:%M:%S') - Temperature: $TEMP°C" >> ~/temperature.log
   
   # Alert if temperature is too high (above 80°C)
   if (( $(echo "$TEMP > 80" | bc -l) )); then
     echo "WARNING: High temperature detected: $TEMP°C" >> ~/high-temp-alerts.log
   fi
   ```

5. Make it executable:
   ```bash
   chmod +x ~/temp-monitor.sh
   ```

6. Add to crontab to run every 30 minutes:
   ```
   */30 * * * * /home/pi/temp-monitor.sh
   ```

### Step 2: USB SSD Performance Optimization

If using a USB SSD:

1. Install performance tools:
   ```bash
   sudo apt install -y hdparm
   ```

2. Check current read performance:
   ```bash
   sudo hdparm -t /dev/sda
   ```

3. Add the following to `/etc/fstab` to optimize SSD mounting (replace UUID with your actual UUID):
   ```
   UUID=YOUR-SSD-UUID  /  ext4  defaults,noatime  0  1
   ```

4. Find your UUID with:
   ```bash
   sudo blkid
   ```

### Step 3: Power Loss Protection

1. Install uninterruptible power supply (UPS) HAT, or connect to external UPS

2. For a software-based approach (if UPS has USB connection):
   ```bash
   sudo apt install -y apcupsd
   ```

3. Configure shutdown on power loss:
   ```bash
   sudo nano /etc/apcupsd/apcupsd.conf
   ```

4. Set these parameters:
   ```
   BATTERYLEVEL 30
   MINUTES 5
   ```

## Network Reliability

### Step 1: Set Up a Static IP

1. Edit the DHCP configuration:
   ```bash
   sudo nano /etc/dhcpcd.conf
   ```

2. Add the following at the end (modify as needed for your network):
   ```
   interface eth0
   static ip_address=192.168.1.100/24
   static routers=192.168.1.1
   static domain_name_servers=1.1.1.1 8.8.8.8
   ```

### Step 2: Configure Network Monitoring

1. Create a network check script:
   ```bash
   nano ~/network-check.sh
   ```

2. Add the following content:
   ```bash
   #!/bin/bash
   
   # Function to check internet connectivity
   check_internet() {
     ping -c 4 8.8.8.8 > /dev/null 2>&1
     return $?
   }
   
   # Function to restart networking
   restart_network() {
     sudo systemctl restart dhcpcd
     echo "Network restarted at $(date)" >> ~/network-log.txt
   }
   
   # Main check
   if ! check_internet; then
     echo "Internet connection down at $(date)" >> ~/network-log.txt
     restart_network
     sleep 30
     
     # Check again
     if ! check_internet; then
       echo "Internet still down after restart at $(date)" >> ~/network-log.txt
     else
       echo "Internet restored after restart at $(date)" >> ~/network-log.txt
     fi
   fi
   ```

3. Make it executable:
   ```bash
   chmod +x ~/network-check.sh
   ```

4. Add to crontab to run every 10 minutes:
   ```
   */10 * * * * /home/pi/network-check.sh
   ```

## Advanced Features

### SSH Remote Access from Anywhere

1. Set up port forwarding on your router (forward port 22 to your Pi's IP)

2. For better security, change the default SSH port:
   ```bash
   sudo nano /etc/ssh/sshd_config
   ```
   
   Find the line `#Port 22` and change it to `Port 2222` (or another number)

3. Restart SSH:
   ```bash
   sudo systemctl restart ssh
   ```

4. For even better security, set up SSH key authentication and disable password login

### Remote Management Web Interface

Set up a simple web dashboard:

1. Install required packages:
   ```bash
   sudo apt install -y nginx
   ```

2. Create a simple status page:
   ```bash
   sudo nano /var/www/html/index.html
   ```

3. Add basic HTML and JavaScript that fetches status info

4. Create a status API script:
   ```bash
   nano ~/whatsapp-bot/status-api.js
   ```

5. Add code to serve bot status over HTTP

6. Set up PM2 to run the status API:
   ```bash
   cd ~/whatsapp-bot
   pm2 start status-api.js --name status-api
   pm2 save
   ```

### Automatic Updates

1. Create an update script:
   ```bash
   nano ~/whatsapp-bot/update-bot.sh
   ```

2. Add the following content:
   ```bash
   #!/bin/bash
   
   cd /home/pi/whatsapp-bot
   
   # Backup before update
   tar -czf ~/whatsapp-backups/pre-update-backup_$(date +"%Y-%m-%d_%H-%M").tar.gz .
   
   # Pull latest changes
   git pull
   
   # Install any new dependencies
   npm install
   
   # Restart the bot
   pm2 restart whatsapp-bot
   
   echo "Bot updated at $(date)" >> ~/whatsapp-bot/update-log.txt
   ```

3. Make it executable:
   ```bash
   chmod +x ~/whatsapp-bot/update-bot.sh
   ```

4. Add to crontab to check for updates weekly:
   ```
   0 2 * * 0 /home/pi/whatsapp-bot/update-bot.sh
   ```

## Troubleshooting Common Issues

### Bot Disconnects Frequently

**Issue**: The WhatsApp connection drops regularly.

**Solutions**:
1. Check internet stability with `ping -c 100 8.8.8.8` and look for packet loss
2. Ensure your power supply is adequate (use official RPi power supply)
3. Verify your Pi isn't overheating with `vcgencmd measure_temp`
4. Add reconnection logic to your bot code
5. Use Ethernet instead of Wi-Fi if possible

### High CPU/Memory Usage

**Issue**: The bot uses too much CPU or memory.

**Solutions**:
1. Check resource usage with `top` or `htop`
2. Limit memory usage in Node.js:
   ```bash
   cd ~/whatsapp-bot
   pm2 stop whatsapp-bot
   pm2 start src/index.js --name whatsapp-bot --node-args="--max-old-space-size=512"
   pm2 save
   ```
3. Optimize your code to use less resources
4. Consider upgrading to a Raspberry Pi with more RAM

### SD Card Corruption

**Issue**: Bot stops working after power loss or SD card becomes corrupted.

**Solutions**:
1. Use a high-quality SD card (Samsung EVO or SanDisk Extreme)
2. Switch to USB SSD boot (much more reliable)
3. Set up regular backups of the entire SD card:
   ```bash
   sudo dd if=/dev/mmcblk0 of=~/pi-backup.img bs=1M
   ```
4. Use a UPS to prevent power loss

## Performance Optimization

### Swap File Configuration

Increase swap space for better performance:

1. Edit the swap configuration:
   ```bash
   sudo nano /etc/dphys-swapfile
   ```

2. Change `CONF_SWAPSIZE` to `1024`

3. Restart swap service:
   ```bash
   sudo systemctl restart dphys-swapfile
   ```

### Overclocking (Optional)

For Pi 4, moderate overclocking can improve performance:

1. Edit the boot configuration:
   ```bash
   sudo nano /boot/config.txt
   ```

2. Add these lines:
   ```
   over_voltage=4
   arm_freq=1850
   ```

3. Reboot and monitor temperatures carefully

## Conclusion

Your Raspberry Pi is now set up to run your WhatsApp bot 24/7 with:

- Automatic startup on boot
- Process monitoring and auto-recovery
- Regular session backups
- Network reliability checks
- Temperature monitoring
- Optional remote access

This self-hosted solution gives you complete control over your bot while keeping costs minimal. The one-time hardware investment provides a reliable platform for running your bot indefinitely without monthly hosting fees.

## Additional Resources

- [Raspberry Pi Documentation](https://www.raspberrypi.com/documentation/)
- [PM2 Documentation](https://pm2.keymetrics.io/docs/usage/quick-start/)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)
- [WhatsApp Multi-Device API Documentation](https://github.com/WhiskeySockets/Baileys)