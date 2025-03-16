# BLACKSKY-MD Complete Termux Installation Guide

This guide provides comprehensive instructions for installing and running BLACKSKY-MD WhatsApp Bot on Termux with all dependencies.

## Installation Options

We provide three different installation options depending on your needs:

1. **Full Installation** (`termux-full-dependencies.sh`) - Installs all dependencies with Jimp-based polyfills for problematic packages
2. **Ultra-Lite Installation** (`termux-lite-setup.sh`) - Minimal installation with only essential dependencies
3. **Minimal Dependencies** (`termux-minimal-dependencies.sh`) - Simplified installation focused on stability

## Full Installation (Recommended)

This method installs all dependencies and provides polyfills for packages that don't work well on Termux.

### Prerequisites

1. **Install Termux from F-Droid**
   
   Download [Termux from F-Droid](https://f-droid.org/en/packages/com.termux/) (not from Play Store)

2. **Update Termux packages**
   ```bash
   pkg update && pkg upgrade -y
   ```

3. **Install git**
   ```bash
   pkg install git -y
   ```

4. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/blacksky-md.git
   cd blacksky-md
   ```

### Running the Full Installer

```bash
chmod +x termux-full-dependencies.sh
./termux-full-dependencies.sh
```

This script will:
- Install all required system packages
- Create polyfills for Canvas, Sharp, and node-webpmux
- Install all Node.js dependencies
- Create startup scripts

### Starting the Bot

After installation, you have three ways to run the bot:

1. **Foreground mode** (see output directly)
   ```bash
   ./start-bot.sh
   ```

2. **Background mode** (runs in the background)
   ```bash
   ./background-bot.sh
   ```

3. **Auto-restart mode** (automatically restarts if it crashes)
   ```bash
   ./watchdog.sh
   ```

## How Polyfills Work

The installation provides fallback implementations for packages that often fail to install on Termux:

1. **Canvas Polyfill**
   - Uses Jimp for image manipulation
   - Provides a Canvas-like API
   - Supports basic image operations

2. **Sharp Polyfill**
   - Also uses Jimp
   - Offers basic image processing functions
   - Preserves the same API as Sharp

3. **node-webpmux Polyfill**
   - Provides sticker creation functionality
   - Supports simple EXIF data setting

## Troubleshooting

### Common Issues and Solutions

1. **Out of Memory Errors**
   
   If you encounter "JavaScript heap out of memory" errors:
   ```bash
   # Edit your .env file and add
   LOW_MEMORY_MODE=true
   ```

2. **Slow Performance**
   
   Termux has resource limitations. You can improve performance:
   ```bash
   # Reduce logging verbosity in .env
   LOG_LEVEL=error
   
   # Disable unused features
   DISABLE_UNUSED_FEATURES=status,call
   ```

3. **Installation Fails**
   
   If dependency installation fails, try the lite version:
   ```bash
   chmod +x termux-lite-setup.sh
   ./termux-lite-setup.sh
   ```

4. **QR Code Issues**
   
   If the QR code doesn't scan:
   ```bash
   # Clear auth folder and restart
   rm -rf auth_info_baileys
   ./start-bot.sh
   ```

## Background Operation

For 24/7 operation:

1. **Disable Battery Optimization for Termux**
   - Go to **Settings** > **Apps** > **Termux**
   - Select **Battery** > **Battery optimization**
   - Set Termux to **Not optimized**

2. **Auto-start on Boot**
   
   Install Termux:Boot from F-Droid and create a startup script:
   ```bash
   mkdir -p ~/.termux/boot
   
   # Create a boot script
   cat > ~/.termux/boot/start-whatsapp-bot.sh << 'EOL'
   #!/data/data/com.termux/files/usr/bin/bash
   cd ~/blacksky-md
   ./background-bot.sh
   EOL
   
   chmod +x ~/.termux/boot/start-whatsapp-bot.sh
   ```

## Advanced Tips

### Memory Optimization

Termux has limited memory compared to servers. To reduce memory usage:

1. **Edit watchdog.sh to include garbage collection**
   ```bash
   # Add this line in watchdog.sh before starting the bot
   export NODE_OPTIONS="--max-old-space-size=512 --expose-gc"
   ```

2. **Create a memory management cronjob**
   ```bash
   # Install cronie
   pkg install cronie -y
   
   # Add a cron job
   crontab -e
   ```
   
   Add this line to run a memory check every hour:
   ```
   0 * * * * pkill -USR1 node
   ```

### Using Custom Commands

When creating custom commands, remember that some dependencies might not be available in their original form. Use these alternatives:

1. **For image processing:** Use Jimp instead of Canvas/Sharp
   ```javascript
   const Jimp = require('jimp');
   
   async function processImage(imagePath) {
     const image = await Jimp.read(imagePath);
     image.resize(300, 300).greyscale();
     return await image.getBufferAsync(Jimp.MIME_PNG);
   }
   ```

2. **For stickers:** Use the polyfill with simpler options
   ```javascript
   const { Image, EXIF } = require('node-webpmux');
   
   async function createSticker(imagePath) {
     const img = await Image.from(imagePath);
     const exif = EXIF.create({ packname: 'My Stickers', author: 'Bot' });
     img.setExif(exif);
     await img.save('sticker.webp');
     return 'sticker.webp';
   }
   ```

## Additional Resources

- [Polyfill API Documentation](./docs/polyfills.md)
- [Termux Performance Tips](./docs/termux-tips.md)
- [Background Mode Guide](./docs/background-mode.md)

## Support

For additional help, please check the GitHub repository or contact the developer.

---

*This guide is tailored for installing BLACKSKY-MD WhatsApp Bot on Termux with all dependencies.*