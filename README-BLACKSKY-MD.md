# BLACKSKY-MD WhatsApp Bot

A high-performance WhatsApp multi-device bot with intelligent communication capabilities, designed for scalable and responsive user interactions.

## Features

- **High Performance**: Optimized for minimal resource consumption
- **Connection Reliability**: Automatic reconnection with exponential backoff
- **Session Persistence**: Automated session backup and recovery
- **Modular Command System**: Easy to extend with new commands
- **Multi-language Support**: Built-in internationalization
- **Error Resilience**: Comprehensive error handling
- **Terminal QR Connection**: Easy device linking

## Quick Start

### Step 1: Setup

Make sure you have Node.js 14+ installed on your system.

```bash
# Install dependencies
npm install
```

### Step 2: Connect to WhatsApp

Use the terminal QR connector to link the bot to your WhatsApp account:

```bash
# Start the Terminal QR connector workflow
# OR
node terminal-qr-connect.js
```

Scan the QR code displayed in the terminal with your WhatsApp mobile app:
1. Open WhatsApp on your phone
2. Tap Menu or Settings and select WhatsApp Web/Linked Devices
3. Tap "Link a Device"
4. Point your phone camera toward the QR code on the screen

### Step 3: Run the Bot

After successfully connecting, start the bot:

```bash
# Start the WhatsApp Bot workflow
# OR
node src/index.js
```

## Command Structure

Commands follow a simple structure:

```
!commandName arg1 arg2 ...
```

### Available Commands

- `!ping` - Check if the bot is responsive
- `!help` - Display help information
- `!info` - Display bot information

## Adding Custom Commands

Create a new file in the `src/commands` directory:

```javascript
// Example command module (src/commands/example.js)
const { safeSendText } = require('../utils/jidHelper');

const exampleCommands = {
    hello: async (sock, message) => {
        await safeSendText(sock, message.key.remoteJid, 'Hello, world!');
    }
};

module.exports = {
    commands: exampleCommands,
    category: 'example',
    async init() {
        return true;
    }
};
```

## Directory Structure

```
├── src/
│   ├── commands/       # Command modules
│   ├── core/           # Core system modules
│   └── utils/          # Utility functions
├── data/
│   ├── translations/   # Language files
│   └── reaction_gifs/  # Reaction GIFs (optional)
├── logs/               # Log files
├── auth_info_baileys/  # Session data
└── terminal-qr-connect.js # QR code connection utility
```

## Advanced Configuration

Edit the settings in the respective module files:

- Connection settings: `src/core/connection.js`
- Command registry settings: `src/core/commandRegistry.js`
- Session settings: `src/core/sessionManager.js`

## Troubleshooting

### Connection Issues

If you have trouble connecting:

1. Make sure your internet connection is stable
2. Verify that your WhatsApp is up to date
3. Try deleting the `auth_info_baileys` folder and reconnect
4. Check the logs for specific error messages

### Command Issues

If commands aren't working:

1. Verify the command is loaded in the logs
2. Check for any errors in the command execution
3. Make sure the command format is correct

## License

MIT License

## Contributing

Contributions are welcome! Please check out our contribution guidelines.

## Credits

Built using [@whiskeysockets/baileys](https://github.com/WhiskeySockets/Baileys) for WhatsApp connection.