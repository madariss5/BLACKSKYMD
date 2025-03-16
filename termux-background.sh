#!/bin/bash
# BLACKSKY-MD WhatsApp Bot Termux Background Service Setup
# This script sets up the bot to run continuously in the background on Termux

# Display banner
echo "==============================================="
echo "  BLACKSKY-MD WhatsApp Bot - Background Setup"
echo "==============================================="

# Function to check if a package is installed
check_package() {
    if ! command -v "$1" &> /dev/null; then
        echo "Package $1 is not installed. Installing..."
        pkg install -y "$1"
    else
        echo "Package $1 is already installed."
    fi
}

# Function to create startup script
create_startup_script() {
    mkdir -p ~/bin
    
    echo "Creating bot startup script in ~/bin/start-blacksky..."
    cat > ~/bin/start-blacksky << 'EOL'
#!/bin/bash
# BLACKSKY-MD WhatsApp Bot Starter Script
cd "$(dirname "$0")/../blacksky-md"
./termux-start.sh
EOL
    
    chmod +x ~/bin/start-blacksky
    echo "Startup script created successfully."
}

# Function to create background runner script
create_background_script() {
    mkdir -p ~/bin
    
    echo "Creating background runner script in ~/bin/start-blacksky-background..."
    cat > ~/bin/start-blacksky-background << 'EOL'
#!/bin/bash
# BLACKSKY-MD WhatsApp Bot Background Runner
cd "$(dirname "$0")/../blacksky-md"
echo "Starting BLACKSKY-MD WhatsApp Bot in the background..."
nohup ./termux-start.sh > logs/nohup.log 2>&1 &
echo $! > .bot.pid
echo "Bot started with PID: $(cat .bot.pid)"
echo "To view logs: tail -f logs/nohup.log"
echo "To stop the bot: ~/bin/stop-blacksky"
EOL
    
    chmod +x ~/bin/start-blacksky-background
    echo "Background runner script created successfully."
}

# Function to create stop script
create_stop_script() {
    mkdir -p ~/bin
    
    echo "Creating stop script in ~/bin/stop-blacksky..."
    cat > ~/bin/stop-blacksky << 'EOL'
#!/bin/bash
# BLACKSKY-MD WhatsApp Bot Stopper Script
cd "$(dirname "$0")/../blacksky-md"
if [ -f .bot.pid ]; then
    PID=$(cat .bot.pid)
    if ps -p $PID > /dev/null; then
        echo "Stopping bot with PID: $PID"
        kill $PID
        rm .bot.pid
        echo "Bot stopped successfully."
    else
        echo "Bot process not found. It may have already exited."
        rm .bot.pid
    fi
else
    echo "No PID file found. Trying to find and stop any running instances..."
    pkill -f "node src/termux-connection.js"
    pkill -f "node src/connection.js"
    pkill -f "node src/index.js"
    echo "Any running bot instances have been stopped."
fi
EOL
    
    chmod +x ~/bin/stop-blacksky
    echo "Stop script created successfully."
}

# Function to create status check script
create_status_script() {
    mkdir -p ~/bin
    
    echo "Creating status check script in ~/bin/blacksky-status..."
    cat > ~/bin/blacksky-status << 'EOL'
#!/bin/bash
# BLACKSKY-MD WhatsApp Bot Status Checker
cd "$(dirname "$0")/../blacksky-md"
echo "Checking BLACKSKY-MD WhatsApp Bot status..."

if [ -f .bot.pid ]; then
    PID=$(cat .bot.pid)
    if ps -p $PID > /dev/null; then
        echo "Bot is running with PID: $PID"
        echo "Uptime: $(ps -o etime= -p $PID)"
        echo "Memory usage: $(ps -o rss= -p $PID | awk '{print $1/1024 " MB"}')"
        echo "To view logs: tail -f logs/nohup.log"
    else
        echo "Bot process not found, but PID file exists."
        echo "The bot may have crashed. Run ~/bin/start-blacksky-background to restart."
    fi
else
    BOT_PID=$(pgrep -f "node src/termux-connection.js" || pgrep -f "node src/connection.js" || pgrep -f "node src/index.js")
    if [ -n "$BOT_PID" ]; then
        echo "Bot is running with PID: $BOT_PID"
        echo "Uptime: $(ps -o etime= -p $BOT_PID)"
        echo "Memory usage: $(ps -o rss= -p $BOT_PID | awk '{print $1/1024 " MB"}')"
        echo "To view logs: tail -f logs/nohup.log"
    else
        echo "Bot is not running."
        echo "Run ~/bin/start-blacksky-background to start."
    fi
fi
EOL
    
    chmod +x ~/bin/blacksky-status
    echo "Status check script created successfully."
}

# Function to create Termux:Boot startup script
create_boot_script() {
    # Check if Termux:Boot is installed
    if [ -d ~/.termux/boot ]; then
        echo "Creating Termux:Boot startup script..."
        mkdir -p ~/.termux/boot
        
        cat > ~/.termux/boot/start-blacksky-bot.sh << 'EOL'
#!/bin/bash
# This script starts the BLACKSKY-MD WhatsApp Bot at boot
# Wait for system to fully boot and network to be available
sleep 60
# Start the bot in background
~/bin/start-blacksky-background
EOL
        
        chmod +x ~/.termux/boot/start-blacksky-bot.sh
        echo "Termux:Boot startup script created successfully."
    else
        echo "Termux:Boot not found. To enable auto-start at boot:"
        echo "1. Install Termux:Boot from F-Droid"
        echo "2. Run this script again to set up auto-start"
    fi
}

# Function to create cron job for periodic monitoring
create_cron_job() {
    check_package "cronie"
    
    # Create monitor script
    mkdir -p ~/bin
    
    echo "Creating health monitor script..."
    cat > ~/bin/blacksky-health-monitor << 'EOL'
#!/bin/bash
# BLACKSKY-MD WhatsApp Bot Health Monitor
cd "$(dirname "$0")/../blacksky-md"

# Check if bot is supposed to be running
if [ -f .bot.pid ]; then
    PID=$(cat .bot.pid)
    if ! ps -p $PID > /dev/null; then
        echo "$(date): Bot with PID $PID not found. Restarting..." >> logs/monitor.log
        ~/bin/start-blacksky-background
    fi
fi

# Check if any WhatsApp connection files exist but process doesn't
BOT_PID=$(pgrep -f "node src/termux-connection.js" || pgrep -f "node src/connection.js" || pgrep -f "node src/index.js")
if [ -z "$BOT_PID" ] && [ -d "auth_info_baileys" ]; then
    echo "$(date): Bot process not found but auth files exist. Restarting..." >> logs/monitor.log
    ~/bin/start-blacksky-background
fi
EOL
    
    chmod +x ~/bin/blacksky-health-monitor
    
    # Add to crontab if not already there
    if ! crontab -l 2>/dev/null | grep -q "blacksky-health-monitor"; then
        (crontab -l 2>/dev/null; echo "*/15 * * * * ~/bin/blacksky-health-monitor") | crontab -
        echo "Added cron job to check bot health every 15 minutes."
    else
        echo "Cron job already exists."
    fi
}

# Function to setup Termux:Widget
create_widget() {
    # Check if Termux:Widget is likely installed by checking for shortcuts directory
    if [ -d ~/.shortcuts ]; then
        echo "Creating Termux:Widget shortcuts..."
        mkdir -p ~/.shortcuts
        
        # Create start shortcut
        cat > ~/.shortcuts/Start-BlackskyBot.sh << 'EOL'
#!/bin/bash
~/bin/start-blacksky-background
EOL
        chmod +x ~/.shortcuts/Start-BlackskyBot.sh
        
        # Create stop shortcut
        cat > ~/.shortcuts/Stop-BlackskyBot.sh << 'EOL'
#!/bin/bash
~/bin/stop-blacksky
EOL
        chmod +x ~/.shortcuts/Stop-BlackskyBot.sh
        
        # Create status shortcut
        cat > ~/.shortcuts/BlackskyBot-Status.sh << 'EOL'
#!/bin/bash
~/bin/blacksky-status
echo "Press any key to close"
read -n 1
EOL
        chmod +x ~/.shortcuts/BlackskyBot-Status.sh
        
        echo "Termux:Widget shortcuts created successfully."
    else
        echo "Termux:Widget not found. To enable home screen widgets:"
        echo "1. Install Termux:Widget from F-Droid"
        echo "2. Run this script again to set up widgets"
    fi
}

# Main installation process
echo "Setting up BLACKSKY-MD WhatsApp Bot for 24/7 background operation..."

# Check and install required packages
check_package "nodejs"
check_package "git"
check_package "nano"
check_package "cronie"

# Create the scripts
create_startup_script
create_background_script
create_stop_script
create_status_script
create_boot_script
create_cron_job
create_widget

# Make termux-start.sh executable
chmod +x termux-start.sh

# Create symlink to the current directory
if [ ! -d ~/blacksky-md ]; then
    echo "Creating symlink to current directory..."
    ln -s "$(pwd)" ~/blacksky-md
    echo "Symlink created: ~/blacksky-md -> $(pwd)"
fi

echo "==============================================="
echo "BLACKSKY-MD WhatsApp Bot background setup complete!"
echo "==============================================="
echo ""
echo "Instructions:"
echo "--------------"
echo "Start bot:           ~/bin/start-blacksky-background"
echo "Stop bot:            ~/bin/stop-blacksky"
echo "Check status:        ~/bin/blacksky-status"
echo "View logs:           tail -f logs/nohup.log"
echo ""
echo "The bot will automatically start at boot if you have Termux:Boot installed."
echo "Home screen widgets are available if you have Termux:Widget installed."
echo "A health monitor will check and restart the bot every 15 minutes if it crashes."
echo ""
echo "For full instructions, see TERMUX_GUIDE.md"
echo "==============================================="