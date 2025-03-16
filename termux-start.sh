#!/bin/bash
# BLACKSKY-MD WhatsApp Bot Termux Startup Script
# This script starts the bot with optimized settings for Termux

# Display banner
echo "==============================================="
echo "  BLACKSKY-MD WhatsApp Bot - Termux Edition"
echo "==============================================="
echo "Starting with optimization for 24/7 operation..."

# Set up environment variables
export NODE_ENV=production
export NODE_OPTIONS="--max-old-space-size=512"  # Lower memory limit for Termux

# Create necessary directories if they don't exist
mkdir -p auth_info_baileys
mkdir -p logs
mkdir -p data
mkdir -p src/commands

# Run dependency installer if needed
if [ ! -f "src/utils/polyfills/canvas-polyfill.js" ] || [ ! -f "src/utils/polyfills/sharp-polyfill.js" ]; then
    echo "Missing polyfill modules. Running dependency installer..."
    if [ -f "termux-dependencies.sh" ]; then
        ./termux-dependencies.sh
    else
        echo "Error: Could not find termux-dependencies.sh"
        echo "Please run it manually first: ./termux-dependencies.sh"
    fi
fi

# Ensure commands directory is ready and populate it if needed
COUNT=$(ls -1 src/commands/ 2>/dev/null | wc -l)
if [ "$COUNT" -eq 0 ]; then
    echo "Commands directory is empty, checking for termux.js..."
    
    # Check if we have the termux command module
    if [ ! -f "src/commands/termux.js" ]; then
        echo "Termux command module not found, creating it..."
        # Basic template for termux.js if it doesn't exist
        cat > src/commands/termux.js << 'EOL'
/**
 * Termux Command Module
 * Basic commands that work reliably in Termux environment
 */
module.exports = {
    ping: async (sock, message) => {
        await sock.sendMessage(message.key.remoteJid, { text: 'Pong! Bot is running in Termux mode.' });
    },
    
    help: async (sock, message) => {
        await sock.sendMessage(message.key.remoteJid, { 
            text: 'BLACKSKY-MD Bot\n\nRunning in Termux lightweight mode\nPrefix: !\n\n' +
                 'Basic Commands:\n' +
                 '!ping - Check if bot is running\n' +
                 '!help - Show this help message\n' +
                 '!info - Show bot information\n' +
                 '!status - Show command system status'
        });
    },
    
    info: async (sock, message) => {
        await sock.sendMessage(message.key.remoteJid, { 
            text: 'BLACKSKY-MD Bot\nVersion: 1.0.0\nRunning on: Termux\nOptimized: Yes\n' +
                  'Memory usage: ' + (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2) + ' MB' 
        });
    }
};
EOL
        echo "Created basic termux command module"
    else
        echo "Termux command module found"
    fi
    
    # Check if we have any JS files in the project root that need to be copied
    echo "Checking for command files in project root..."
    find . -maxdepth 1 -name "*.js" -type f | while read -r file; do
        FILENAME=$(basename "$file")
        if grep -q "module.exports" "$file" && grep -q "async.*sock.*message" "$file"; then
            echo "Found potential command file: $FILENAME, copying to commands directory..."
            cp "$file" "src/commands/"
        fi
    done
    
    # Also check src directory for commands
    if [ -d "src" ]; then
        echo "Checking for command files in src directory..."
        find src -maxdepth 1 -name "*.js" -type f | while read -r file; do
            FILENAME=$(basename "$file")
            if grep -q "module.exports" "$file" && grep -q "async.*sock.*message" "$file"; then
                echo "Found potential command file: $FILENAME, copying to commands directory..."
                cp "$file" "src/commands/"
            fi
        done
    fi
    
    echo "Command directory setup complete"
fi

# Copy standard command modules to commands directory if they exist
echo "Checking for standard command modules in the project..."
if [ -d "commands" ]; then
    echo "Found commands directory, copying modules to src/commands..."
    cp -f commands/*.js src/commands/ 2>/dev/null
fi

# Create logs directory if it doesn't exist
mkdir -p logs

# Start the WhatsApp bot with Termux-optimized options
echo "Starting WhatsApp bot with Termux optimizations..."
echo "$(date): Bot starting" >> logs/termux.log

# Set up auto-restart with exponential backoff
MAX_RESTARTS=100
RESTART_COUNT=0
WAIT_TIME=5

# Start the bot in a loop for auto-restart
while [ $RESTART_COUNT -lt $MAX_RESTARTS ]; do
    RESTART_COUNT=$((RESTART_COUNT + 1))
    
    echo "Starting bot (attempt $RESTART_COUNT)..."
    echo "$(date): Bot restart attempt $RESTART_COUNT" >> logs/termux.log
    
    # Try with termux-connection.js first (optimized for Termux)
    if [ -f "src/termux-connection.js" ]; then
        echo "Using Termux-optimized connection script"
        node src/termux-connection.js 2>&1 | tee -a logs/termux.log
    # Fall back to standard connection options
    elif [ -f "src/connection.js" ]; then
        echo "Using standard connection script"
        node src/connection.js 2>&1 | tee -a logs/termux.log
    elif [ -f "src/index.js" ]; then
        echo "Using main index script"
        node src/index.js 2>&1 | tee -a logs/termux.log
    else
        echo "No suitable script found. Please ensure src/termux-connection.js or src/connection.js exists."
        exit 1
    fi
    
    EXIT_CODE=$?
    
    # Check if exit was intentional (code 0)
    if [ $EXIT_CODE -eq 0 ]; then
        echo "Bot exited cleanly with code 0. Restarting normally."
        WAIT_TIME=5
    else
        echo "Bot crashed with exit code $EXIT_CODE. Waiting $WAIT_TIME seconds before restart..."
        echo "$(date): Bot crashed with exit code $EXIT_CODE. Waiting $WAIT_TIME seconds before restart." >> logs/termux.log
        
        # Exponential backoff for crash restarts
        WAIT_TIME=$((WAIT_TIME * 2))
        
        # Cap maximum wait time at 5 minutes
        if [ $WAIT_TIME -gt 300 ]; then
            WAIT_TIME=300
        fi
    fi
    
    sleep $WAIT_TIME
done

echo "Maximum restart count ($MAX_RESTARTS) reached. Please check the logs."
echo "$(date): Maximum restart count reached. Bot stopped." >> logs/termux.log