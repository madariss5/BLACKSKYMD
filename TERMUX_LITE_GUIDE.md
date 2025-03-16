# BLACKSKY-MD Ultra-Lite for Termux

This guide helps you run BLACKSKY-MD WhatsApp Bot on Termux using a simplified approach that focuses on maximum compatibility.

## Common Termux Issues

Many users face these problems when running WhatsApp bots on Termux:

1. **Package installation failures** - Some NPM packages have native dependencies that don't compile on Android
2. **Memory constraints** - Termux has limited RAM compared to servers
3. **Dependency conflicts** - Libraries like `canvas` and `sharp` often fail to install
4. **CPU architecture differences** - Some Node.js modules need to be built specifically for ARM
5. **File system permissions** - Android has stricter file access

## Ultra-Lite Solution

Our ultra-lite solution addresses these problems by:

1. Using only the absolutely essential dependencies
2. Eliminating problematic packages entirely
3. Creating a minimal but functional WhatsApp connection
4. Providing basic command functionality

## Installation

Follow these steps to install the ultra-lite version:

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

5. **Run the ultra-lite setup script**
   ```bash
   chmod +x termux-lite-setup.sh
   ./termux-lite-setup.sh
   ```

## Running the Bot

After installation, you have three ways to run the bot:

1. **Foreground mode** (see output directly)
   ```bash
   ./start-bot.sh
   ```

2. **Background mode** (runs in the background)
   ```bash
   ./background-bot.sh
   ```

3. **Restart** (if the bot is already running)
   ```bash
   ./restart-bot.sh
   ```

## Available Commands

This ultra-lite version supports these basic commands:

- `!ping` - Check if the bot is running
- `!help` - Show available commands
- `!info` - Display bot information

## Troubleshooting

If you encounter issues:

1. **Connection problems**
   - Make sure Termux has internet access
   - Try removing the auth folder: `rm -rf auth_info_baileys`
   - Restart the bot

2. **Bot crashes immediately**
   - Check log file: `cat bot.log`
   - Make sure you have sufficient storage space
   - Try reinstalling with: `./termux-lite-setup.sh`

3. **QR code doesn't scan**
   - Make sure your WhatsApp is up-to-date
   - Clear auth folder and try again: `rm -rf auth_info_baileys`

## Limitations

The ultra-lite version has these limitations:

- Limited command support (only basic commands)
- No image processing or sticker creation
- No advanced features like music or video downloads
- No group management features

## Battery Optimization

For 24/7 operation:

1. Disable battery optimization for Termux
   - Go to **Settings** > **Apps** > **Termux**
   - Select **Battery** > **Battery optimization**
   - Set Termux to **Not optimized**

2. Consider using Termux:Boot
   - Install from F-Droid: [Termux:Boot](https://f-droid.org/en/packages/com.termux.boot/)
   - Create a startup script in `~/.termux/boot/` folder

## Support

For additional support or to report issues, please check the GitHub repository or contact the developer.

---

*This ultra-lite guide is specifically designed to overcome Termux limitations while providing a reliable WhatsApp bot connection.*