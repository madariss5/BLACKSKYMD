#!/bin/bash
# BLACKSKY-MD WhatsApp Bot Battery Optimization Script for Termux
# This script configures your bot to use minimal battery while staying responsive

# Display banner
echo "==============================================="
echo "  BLACKSKY-MD WhatsApp Bot - Battery Optimizer"
echo "==============================================="

# Create the low power config file
mkdir -p config
cat > config/battery_optimize.json << 'EOL'
{
  "batteryOptimization": true,
  "enableLowPowerMode": true,
  "lowPowerSettings": {
    "reducedPresenceUpdates": true,
    "minimizeReconnectFrequency": true,
    "useCompressedMediaOnly": true,
    "disableUnusedFeatures": ["status", "call", "reaction"],
    "extendedReconnectInterval": 60000,
    "reduceLogLevel": "warn"
  },
  "systemSettings": {
    "disableGC": true,
    "reduceMaxRAM": true,
    "maxHeapSize": 256,
    "prioritizeCriticalConnections": true,
    "enableWakeLockAvoidance": true,
    "minimizeNetworkActivity": true
  }
}
EOL

echo "Created battery optimization config."

# Create a modified environment file for low-power operation
if [ -f .env ]; then
    cp .env .env.backup
    echo "Backed up existing .env file to .env.backup"
    
    # Add or update low power settings if needed
    if ! grep -q "LOW_POWER_MODE" .env; then
        echo "LOW_POWER_MODE=true" >> .env
        echo "REDUCED_PRESENCE_UPDATES=true" >> .env
        echo "MINIMIZE_RECONNECTS=true" >> .env
        echo "DISABLE_UNUSED_FEATURES=status,call,reaction" >> .env
        echo "LOG_LEVEL=warn" >> .env
        echo "Added battery optimization settings to .env"
    fi
else
    cat > .env << 'EOL'
# BLACKSKY-MD WhatsApp Bot Environment Configuration
# Battery-optimized settings

# Core settings
NODE_ENV=production
PREFIX=!

# Battery optimization
LOW_POWER_MODE=true
REDUCED_PRESENCE_UPDATES=true
MINIMIZE_RECONNECTS=true
DISABLE_UNUSED_FEATURES=status,call,reaction
LOG_LEVEL=warn
ENABLE_MESSAGE_RETRIES=false
RECONNECT_INTERVAL=60000

# Session settings
SESSION_ID=BlackskyMD
EOL
    echo "Created new .env file with battery optimization settings"
fi

# Create a Node.js script to modify connection settings for Termux
cat > src/termux-optimize.js << 'EOL'
/**
 * Termux Battery Optimization Utility
 * This script modifies the connection settings to minimize battery usage
 */

const fs = require('fs');
const path = require('path');

// Load JSON config files that can be optimized
try {
    // Check for system.json
    if (fs.existsSync('./system.json')) {
        const systemConfig = JSON.parse(fs.readFileSync('./system.json', 'utf8'));
        
        // Update system config for battery optimization
        systemConfig.batteryOptimization = true;
        systemConfig.reduceMemoryUsage = true;
        systemConfig.disconnectOnIdle = true;
        systemConfig.idleTimeoutMinutes = 10;
        systemConfig.autoReconnect = true;
        systemConfig.logLevel = 'warn';
        
        // Save modified config
        fs.writeFileSync('./system.json', JSON.stringify(systemConfig, null, 2));
        console.log('Updated system.json for battery optimization');
    }
    
    // Create connection configuration if it doesn't exist
    if (!fs.existsSync('./connection-config.json')) {
        const connectionConfig = {
            browser: ['BLACKSKY-MD', 'Termux', '1.0.0'],
            printQRInTerminal: true,
            auth: {
                creds: {},
                keys: {}
            },
            markOnlineOnConnect: false,
            retryRequestDelayMs: 10000,
            fireInitQueries: false,
            logQR: false,
            defaultQueryTimeoutMs: 60000,
            customUploadHosts: [],
            patchMessageBeforeSending: true,
            syncFullHistory: false,
            connectTimeoutMs: 60000,
            keepAliveIntervalMs: 30000,
            emitOwnEvents: false,
            shouldIgnoreJid: jid => {
                return jid.endsWith('@broadcast');
            }
        };
        
        fs.writeFileSync('./connection-config.json', JSON.stringify(connectionConfig, null, 2));
        console.log('Created optimized connection-config.json');
    }
    
    console.log('Battery optimization settings applied successfully');
} catch (err) {
    console.error('Error applying battery optimization settings:', err);
}
EOL

# Make script executable
chmod +x src/termux-optimize.js

# Run the optimization script
echo "Running Node.js optimization script..."
node src/termux-optimize.js

# Create a cron job to periodically clean up logs
mkdir -p ~/bin
cat > ~/bin/blacksky-cleanup << 'EOL'
#!/bin/bash
# Auto cleanup script for BLACKSKY-MD
cd "$(dirname "$0")/../blacksky-md"

# Truncate logs if they get too large (over 1MB)
find logs -type f -size +1M -name "*.log" | while read log_file; do
    echo "Truncating large log file: $log_file"
    tail -n 1000 "$log_file" > "$log_file.tmp"
    mv "$log_file.tmp" "$log_file"
done

# Remove temp files older than 1 day
find temp -type f -mtime +1 -delete 2>/dev/null

# Remove auth directories older than 7 days (except the current one)
CURRENT_AUTH=$(readlink -f auth_info_baileys)
find . -maxdepth 1 -type d -name "auth_info_*" -mtime +7 | while read auth_dir; do
    if [ "$(readlink -f "$auth_dir")" != "$CURRENT_AUTH" ]; then
        echo "Removing old auth directory: $auth_dir"
        rm -rf "$auth_dir"
    fi
done

echo "$(date): Cleanup completed" >> logs/maintenance.log
EOL

chmod +x ~/bin/blacksky-cleanup

# Add to crontab if not already there
if ! crontab -l 2>/dev/null | grep -q "blacksky-cleanup"; then
    (crontab -l 2>/dev/null; echo "0 3 * * * ~/bin/blacksky-cleanup") | crontab -
    echo "Added daily cleanup job to crontab (runs at 3:00 AM)"
fi

# Termux-specific optimization hints
echo -e "\n\nTermux Battery Optimization Tips:"
echo "--------------------------------------"
echo "1. Enable Termux wake lock to prevent sleep:"
echo "   Install Termux:API: pkg install termux-api"
echo "   Use: termux-wake-lock before starting bot"
echo ""
echo "2. Use Doze mode whitelist for better uptime:"
echo "   Enable from Android settings > Battery > Battery optimization"
echo "   Set Termux to 'Not optimized'"
echo ""
echo "3. Disable battery optimization for Termux:"
echo "   Most Android phones have settings to prevent app sleep"
echo "   Look for 'App battery usage' or similar in your phone settings"
echo ""
echo "4. Recommended settings to modify in your bot config:"
echo "   - Set 'msgRetryCounterMap' to {} to disable retries"
echo "   - Use connectTimeoutMs: 60000 for longer timeouts"
echo "   - Set 'maxCachedMessages' to a lower value (e.g., 10)"
echo ""
echo "5. Run the bot with additional Node.js optimizations:"
echo "   NODE_OPTIONS=\"--max-old-space-size=256 --optimize-for-size\" ./termux-start.sh"
echo ""
echo "==============================================="
echo "Battery optimization setup complete!"
echo "Your bot should now use significantly less battery while running 24/7."
echo "==============================================="