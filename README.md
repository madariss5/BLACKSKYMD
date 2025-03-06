# WhatsApp Multi-Device Bot

A comprehensive WhatsApp bot with multi-device support and extensive features using @whiskeysockets/baileys.

## Features

- Multi-device support
- Extensive command categories (utility, fun, group, media)
- Image and video processing
- Audio playback and management
- Group management features
- And much more!

## Prerequisites

- Node.js 16 or higher
- A WhatsApp account

## Installation

1. Clone the repository
```bash
git clone <repository-url>
cd whatsapp-bot
```

2. Install dependencies
```bash
npm install
```

3. Create a .env file using .env.example as template
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Start the bot
```bash
npm start
```

## Environment Variables

Required:
- `OWNER_NUMBER`: Your WhatsApp number (format: 1234567890)
- `SESSION_ID`: Unique session ID for multi-device support (auto-generated)
- `BOT_PREFIX`: Command prefix for the bot (default: .)
- `BOT_NAME`: Custom name for your bot

Optional API keys for enhanced features:
- `OPENWEATHERMAP_API_KEY`: For weather commands
- `GOOGLE_API_KEY`: For Google services
- `WOLFRAM_APP_ID`: For Wolfram Alpha queries
- `NEWS_API_KEY`: For news commands

## Available Commands

The bot includes various command categories:

- Basic Commands: help, ping, info
- Media Commands: sticker, toimg, brightness, blur
- Group Commands: kick, add, promote, demote
- Fun Commands: meme, joke, tictactoe
- Educational Commands: define, translate, calculate
- Utility Commands: weather, currency, reminder
- And many more!


## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support and queries, please create an issue in the repository.

## Acknowledgements

- [@whiskeysockets/baileys](https://github.com/WhiskeySockets/Baileys) for the WhatsApp Web API
- All contributors and users of this bot