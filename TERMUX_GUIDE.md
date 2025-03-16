# BLACKSKY-MD WhatsApp Bot - Termux Guide

This guide explains how to run the BLACKSKY-MD WhatsApp bot in Termux for 24/7 operation without keeping Termux open.

## Table of Contents
- [Installation](#installation)
- [Setup](#setup)
- [Running in Background](#running-in-background)
- [Commands](#commands)
- [Auto-Start at Boot](#auto-start-at-boot)
- [Troubleshooting](#troubleshooting)
- [Battery Optimization](#battery-optimization)
- [Advanced Configuration](#advanced-configuration)

## Installation

1. **Install Termux from F-Droid**
   
   Download and install [Termux from F-Droid](https://f-droid.org/en/packages/com.termux/) (recommended over the Play Store version).

2. **Update Termux packages**
   ```bash
   pkg update && pkg upgrade -y
   ```

3. **Install required packages**
   ```bash
   pkg install nodejs git nano cronie -y
   ```

4. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/blacksky-md.git
   cd blacksky-md
   ```

5. **Run the Termux dependencies installer**
   
   This script installs all required dependencies and creates fallbacks for libraries that are difficult to install on Termux.
   
   ```bash
   chmod +x termux-dependencies.sh
   ./termux-dependencies.sh
   ```
   
   The script will:
   - Install system dependencies required by Node.js modules
   - Set up polyfills for Canvas and Sharp libraries
   - Create a compatible package.json for Termux
   - Install core Node.js dependencies
   
   > **Note:** Some commands like image generation and stickers may use simpler graphics on Termux, but all core functionality will work.

## Setup

1. **Make setup scripts executable**
   ```bash
   chmod +x termux-start.sh termux-background.sh
   ```

2. **Run the background setup script**
   ```bash
   ./termux-background.sh
   ```
   
   This script will:
   - Create necessary directories
   - Set up scripts for background operation
   - Configure auto-start options
   - Add monitoring for stability

## Running in Background

After setup, you can use these commands to manage your bot:

- **Start the bot in the background**
  ```bash
  ~/bin/start-blacksky-background
  ```

- **Check if the bot is running**
  ```bash
  ~/bin/blacksky-status
  ```

- **Stop the bot**
  ```bash
  ~/bin/stop-blacksky
  ```

- **View live logs**
  ```bash
  tail -f logs/nohup.log
  ```

## Commands

Your bot includes essential Termux-specific commands:

- `!help` - Shows all available commands
- `!status` - Displays bot status and system information
- `!ping` - Checks if bot is responsive
- `!info` - Shows bot information
- `!restart` - Restarts the bot (admin only)
- `!debug` - Shows debug information
- `!modules` - Lists all command modules

All standard commands from the main bot are also available.

## Auto-Start at Boot

To make your bot start automatically when your device restarts:

1. **Install Termux:Boot from F-Droid**
   
   Download and install [Termux:Boot from F-Droid](https://f-droid.org/en/packages/com.termux.boot/)

2. **Grant permissions**
   
   Open Termux:Boot app and grant the required permissions

3. **Run the background setup script again**
   ```bash
   ./termux-background.sh
   ```

4. **Verify setup**
   
   Check that `~/.termux/boot/start-blacksky-bot.sh` was created

## Troubleshooting

### Bot not responding or crashing

1. **Check logs for errors**
   ```bash
   tail -n 100 logs/nohup.log
   ```

2. **Make sure the process is running**
   ```bash
   ~/bin/blacksky-status
   ```

3. **Restart the bot**
   ```bash
   ~/bin/stop-blacksky
   ~/bin/start-blacksky-background
   ```

4. **Clear auth state if necessary**
   ```bash
   rm -rf auth_info_baileys
   ```
   Then restart the bot and scan the QR code again.

### Canvas or Sharp dependency errors

If you see errors about missing `canvas` or `sharp` modules:

1. **Run the dependency installer**
   ```bash
   chmod +x termux-dependencies.sh
   ./termux-dependencies.sh
   ```

2. **Make sure polyfills are being used**
   
   Check if these files exist:
   ```bash
   ls -la src/utils/polyfills/canvas-polyfill.js
   ls -la src/utils/polyfills/sharp-polyfill.js
   ```

3. **Ensure the polyfill loader is used in termux-connection.js**
   
   The first few lines should include:
   ```javascript
   // Use Termux polyfills for missing dependencies
   require('./use-polyfills');
   ```

4. **Manually create the polyfill directories if needed**
   ```bash
   mkdir -p src/utils/polyfills
   ```

5. **Fix package installation errors**
   
   If you see errors about missing development packages like "libjpeg-turbo-dev", use these alternatives:
   ```bash
   pkg install -y python3 python-numpy libjpeg-turbo libpng x11-repo pango
   ```
   
   These are the correct package names for Termux which differ from standard Linux distributions.

### Command modules not loading

If commands aren't working:

1. **Check which modules are loaded**
   ```bash
   !modules
   ```

2. **Run the debug command**
   ```bash
   !debug
   ```

3. **Update the commands directory**
   ```bash
   mkdir -p src/commands
   cp -f commands/*.js src/commands/ 2>/dev/null
   ```

4. **Restart the bot**
   ```bash
   ~/bin/stop-blacksky
   ~/bin/start-blacksky-background
   ```

### Image processing or sticker issues

If images, stickers, or visual features aren't working properly:

1. **Verify that Jimp is installed**
   ```bash
   npm list jimp
   ```
   If not installed, install it:
   ```bash
   npm install jimp
   ```

2. **Install additional image libraries**
   ```bash
   pkg install -y libpng libjpeg-turbo giflib
   ```

3. **Try running the GIF optimizer**
   ```bash
   ./termux-gif-optimizer.sh
   ```

4. **Check for file permission issues**
   ```bash
   chmod -R 755 data/
   ```

## Battery Optimization

For best performance in 24/7 operation, disable battery optimization for Termux:

1. Go to **Settings** > **Apps** > **Termux**
2. Select **Battery** > **Battery optimization** or **Battery saver**
3. Set Termux to **Not optimized** or **Unrestricted**

Some phones also have additional settings:

- **Xiaomi/MIUI**: Set Termux to "No restrictions" in battery settings
- **Samsung**: Add Termux to "Unmonitored apps" list
- **Huawei**: Add Termux to "Protected apps"
- **OnePlus**: Disable "Deep optimization" for Termux

## Advanced Configuration

### Additional Utility Scripts

The following specialized scripts are available to help manage your bot in Termux:

1. **Battery Optimization**
   ```bash
   chmod +x termux-battery-optimize.sh
   ./termux-battery-optimize.sh
   ```
   This script configures your bot for minimal battery usage while maintaining functionality.

2. **Log Management**
   ```bash
   chmod +x termux-log-manager.sh
   ./termux-log-manager.sh
   ```
   This tool analyzes and manages log files to prevent storage issues on your device.

3. **GIF Optimizer**
   ```bash
   chmod +x termux-gif-optimizer.sh
   ./termux-gif-optimizer.sh
   ```
   Ensures that reaction GIFs work properly in WhatsApp by optimizing them for Termux.

### Custom Commands

To add your own commands, create a new file in the `src/commands` folder:

```javascript
// src/commands/mycommands.js
module.exports = {
    mycommand: async (sock, message, args) => {
        await sock.sendMessage(message.key.remoteJid, { 
            text: 'This is my custom command!' 
        });
    }
};
```

### Persistent Storage

All user data is stored in the `data` directory. To back up your bot:

```bash
zip -r blacksky-backup.zip auth_info_baileys data
```

To restore:

```bash
unzip blacksky-backup.zip
```

### Cron Jobs

The bot is configured with a health monitor that runs every 15 minutes. To modify:

```bash
crontab -e
```

### Home Screen Widget

If you installed Termux:Widget, you can add shortcuts to your home screen:
1. Long press on home screen
2. Select "Widgets"
3. Find and add "Termux:Widget"
4. Tap on the widget and select one of:
   - Start-BlackskyBot
   - Stop-BlackskyBot
   - BlackskyBot-Status

### Memory Management

Since Termux runs within the Android system, memory management is important:

1. **Clear Cache Regularly**
   ```bash
   ~/bin/blacksky-cleanup
   ```

2. **Use Low Memory Mode**
   If your device has limited RAM, enable low memory mode in `.env`:
   ```
   LOW_MEMORY_MODE=true
   ```

3. **Disable Unused Features**
   Edit `.env` to disable features you don't use:
   ```
   DISABLE_UNUSED_FEATURES=status,call,reaction
   ```

4. **Monitor Resource Usage**
   ```bash
   ~/bin/blacksky-status
   ```

## Support

For additional help or to report issues, please visit our GitHub repository or contact support.

---

*This guide is specifically for the Termux environment on Android. Settings and procedures may vary depending on your device and Android version.*