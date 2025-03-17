# WhatsApp Bot Deployment Guide

This comprehensive guide explains how to deploy your WhatsApp bot in various environments for 24/7 operation. Choose the option that best suits your technical skills and budget requirements.

## Table of Contents
1. [Preparation](#preparation)
2. [Cloud VPS Deployment](#cloud-vps-deployment)
3. [Self-Hosted Deployment](#self-hosted-deployment)
4. [Free Oracle Cloud Deployment](#free-oracle-cloud-deployment)
5. [Railway.app Deployment](#railwayapp-deployment)
6. [Android Deployment with Termux](#android-deployment-with-termux)
7. [Docker Deployment](#docker-deployment)
8. [Maintaining 24/7 Operation](#maintaining-247-operation)

## Preparation

Before deploying your bot, make sure you have:

1. A functional copy of the bot source code
2. Generated your WhatsApp session (QR scan completed at least once)
3. Backed up your auth_info_baileys directory

## Cloud VPS Deployment

### DigitalOcean ($5/month)

1. **Create a Droplet**:
   - Sign up for DigitalOcean
   - Create a Basic Droplet ($5/mo plan)
   - Choose Ubuntu 20.04
   - Add SSH keys for secure access

2. **Initial Server Setup**:
   ```bash
   # Connect to your server
   ssh root@your_server_ip
   
   # Create a new user
   adduser botuser
   usermod -aG sudo botuser
   
   # Switch to the new user
   su - botuser
   ```

3. **Install Node.js**:
   ```bash
   # Install NVM
   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.1/install.sh | bash
   
   # Activate NVM
   source ~/.bashrc
   
   # Install Node.js 16
   nvm install 16
   ```

4. **Set Up the Bot**:
   ```bash
   # Clone the repository
   git clone https://github.com/yourusername/your-bot-repo.git
   cd your-bot-repo
   
   # Install dependencies
   npm install
   
   # Transfer your auth_info_baileys directory (using sftp or scp from your local machine)
   # Example: scp -r auth_info_baileys botuser@your_server_ip:~/your-bot-repo/
   ```

5. **Install PM2 for Process Management**:
   ```bash
   # Install PM2 globally
   npm install -g pm2
   
   # Start your bot with PM2
   pm2 start src/index.js --name whatsapp-bot
   
   # Set up PM2 to start on system boot
   pm2 startup
   # Run the command PM2 outputs
   
   # Save the current PM2 process list
   pm2 save
   ```

6. **Monitor Your Bot**:
   ```bash
   # Check status
   pm2 status
   
   # View logs
   pm2 logs whatsapp-bot
   
   # Monitor resources
   pm2 monit
   ```

### Similar Setup for Linode, AWS EC2, and GCP

The steps above are similar for other VPS providers. The main differences are in creating the server instance.

## Self-Hosted Deployment

### Windows

1. **Install Node.js**:
   - Download and install Node.js from nodejs.org

2. **Create a Startup Script**:
   - Create a file named `start-bot.bat` with:
     ```batch
     @echo off
     cd C:\path\to\your\bot
     npm start
     ```

3. **Set Up Task Scheduler**:
   - Search for "Task Scheduler" in Windows
   - Create a new Basic Task
   - Set it to run at startup
   - Action: Start a program
   - Program/script: `C:\path\to\start-bot.bat`
   - Choose "Run whether user is logged on or not" for true background operation

### Linux

1. **Create a Systemd Service**:
   - Create a service file:
     ```bash
     sudo nano /etc/systemd/system/whatsapp-bot.service
     ```

   - Add the following content:
     ```
     [Unit]
     Description=WhatsApp Bot Service
     After=network.target
     
     [Service]
     Type=simple
     User=yourusername
     WorkingDirectory=/path/to/bot
     ExecStart=/usr/bin/npm start
     Restart=on-failure
     RestartSec=10
     StandardOutput=syslog
     StandardError=syslog
     SyslogIdentifier=whatsapp-bot
     
     [Install]
     WantedBy=multi-user.target
     ```

2. **Enable and Start the Service**:
   ```bash
   sudo systemctl enable whatsapp-bot.service
   sudo systemctl start whatsapp-bot.service
   ```

3. **Check Status and Logs**:
   ```bash
   sudo systemctl status whatsapp-bot.service
   sudo journalctl -u whatsapp-bot.service -f
   ```

## Free Oracle Cloud Deployment

Oracle Cloud offers Always Free instances that are perfect for running a WhatsApp bot 24/7.

1. **Sign Up for Oracle Cloud**:
   - Create an account at cloud.oracle.com
   - Note: You need a credit card for verification, but you won't be charged

2. **Create a VM Instance**:
   - Navigate to Compute > Instances > Create Instance
   - Choose "Always Free" eligible options (VM.Standard.E2.1.Micro)
   - Choose Ubuntu 20.04
   - Set up SSH keys for access

3. **Configure the Server**:
   - Follow the same steps as in the Cloud VPS section above to:
     - Install Node.js
     - Clone your repository
     - Set up PM2
     - Start your bot

4. **Set Up Firewall Rules (Optional)**:
   - If you're running a web server for QR:
     ```bash
     sudo iptables -A INPUT -p tcp --dport 5000 -j ACCEPT
     sudo netfilter-persistent save
     ```

## Railway.app Deployment

Railway provides an easy way to deploy your bot with minimal configuration.

1. **Sign Up for Railway**:
   - Create an account at railway.app
   - Link your GitHub account

2. **Deploy Your Project**:
   - Create a new project from your GitHub repository
   - Configure Node.js environment
   - Set the start command to `npm start`
   - Add environment variables as needed

3. **Configure Persistence**:
   - Add a persistent volume for the auth_info_baileys directory
   - Connect to your project's terminal and copy your existing auth_info_baileys folder

4. **Enable Auto-Deploys**:
   - Configure Railway to automatically deploy when you push to your repository

## Android Deployment with Termux

You can run your bot directly on an Android phone as a low-cost option.

1. **Install Termux**:
   - Download from F-Droid (not Play Store, as that version is outdated)
   - Open and update packages:
     ```bash
     pkg update && pkg upgrade
     ```

2. **Install Required Packages**:
   - Run the Termux setup script:
     ```bash
     bash termux-full-dependencies.sh
     ```

3. **Clone and Setup**:
   ```bash
   git clone https://github.com/yourusername/your-bot-repo.git
   cd your-bot-repo
   npm install
   ```

4. **Run the Bot**:
   ```bash
   bash termux-start.sh
   ```

5. **Run in Background**:
   - To keep the bot running when Termux is closed:
     ```bash
     npm install -g forever
     forever start src/index.js
     ```

6. **Auto-Start After Phone Reboot**:
   - Install Termux:Boot from F-Droid
   - Grant required permissions
   - Create a boot script in ~/.termux/boot:
     ```bash
     #!/data/data/com.termux/files/usr/bin/bash
     termux-wake-lock
     cd ~/your-bot-repo
     npm start
     ```

## Docker Deployment

Docker is great for consistent deployment across different platforms.

1. **Create a Dockerfile**:
   - In your project, create a file named `Dockerfile`:
     ```dockerfile
     FROM node:16-alpine
     
     WORKDIR /app
     
     COPY package*.json ./
     RUN npm install
     
     COPY . .
     
     # Create a volume for WhatsApp auth data
     VOLUME ["/app/auth_info_baileys"]
     
     CMD ["node", "src/index.js"]
     ```

2. **Build the Docker Image**:
   ```bash
   docker build -t whatsapp-bot .
   ```

3. **Run the Container**:
   ```bash
   docker run -d \
     --name whatsapp-bot \
     --restart unless-stopped \
     -v whatsapp-auth:/app/auth_info_baileys \
     whatsapp-bot
   ```

4. **View Logs**:
   ```bash
   docker logs -f whatsapp-bot
   ```

## Maintaining 24/7 Operation

### Session Management

1. **Regular Backups**
   - The bot automatically creates backups of the auth_info_baileys directory
   - Consider setting up additional external backups:
     ```bash
     # Example daily backup cron job
     0 0 * * * tar -czf ~/whatsapp-backup-$(date +\%Y\%m\%d).tar.gz ~/your-bot-repo/auth_info_baileys
     ```

2. **Connection Monitoring**
   - The bot implements automatic reconnection
   - Set up external monitoring:
     ```bash
     # Create a simple healthcheck.js in your project
     const axios = require('axios');
     
     // If the bot has a web server
     axios.get('http://localhost:5000/health')
       .then(() => console.log('Bot is healthy'))
       .catch(() => {
         console.error('Bot is down, restarting...');
         process.exit(1); // PM2 will restart
       });
     ```
   - Add to PM2:
     ```bash
     pm2 start healthcheck.js --name monitor --cron "*/15 * * * *"
     ```

3. **Service Notifications**
   - Set up notification services:
     - UptimeRobot free plan can monitor your bot's health endpoint
     - Set up Twilio SMS alerts for critical failures

4. **Performance Optimization**
   - Regular memory cleaning:
     ```bash
     # PM2 scheduled restart
     pm2 start src/index.js --name whatsapp-bot --cron-restart="0 4 * * *"
     ```
   - Monitor log file sizes:
     ```bash
     # Logrotate configuration example
     sudo nano /etc/logrotate.d/whatsapp-bot
     
     /home/botuser/your-bot-repo/logs/*.log {
       daily
       rotate 7
       compress
       delaycompress
       notifempty
       create 0640 botuser botuser
     }
     ```

These comprehensive deployment options should cover any scenario for running your WhatsApp bot 24/7. Choose the one that best fits your needs and technical comfort level.