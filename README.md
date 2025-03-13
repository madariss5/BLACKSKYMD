# BLACKSKY-MD WhatsApp Bot

A sophisticated WhatsApp multi-device bot delivering intelligent, interactive, and educational messaging experiences with advanced personalization and user engagement capabilities.

## Features

- 🌐 **Multi-language Support** - English and German language support built-in
- 🔄 **Stable Connection** - Improved session management and reconnection handling
- 🖥️ **Web QR Display** - Easy to scan QR code interface accessible via web browser
- 💾 **Auto-Backup** - Credential backups sent directly to the bot's chat
- 🛡️ **Improved Auth Management** - Auth data only clears on actual logout
- 🌈 **Flash-MD Style Menu** - Modern, responsive menu system with multi-column display
- 📝 **350+ Commands** - Comprehensive command system organized by categories
- 📊 **Educational Features** - Learning tools, quizzes, and educational content
- 🎮 **Games & Fun** - Interactive games and entertainment commands
- 🖼️ **Media Processing** - Stickers, image editing, and media conversion tools

## Setup Instructions

1. **Clone this repository**
   ```bash
   git clone https://github.com/yourusername/blacksky-md.git
   cd blacksky-md
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   - Copy `.env.example` to `.env`
   - Edit the `.env` file with your settings

4. **Start the bot**
   ```bash
   node connected-bot.js
   ```

5. **Access the QR code**
   - Open your browser to `http://localhost:5000`
   - Scan the QR code with your WhatsApp

## Command Categories

- **Basic** - Essential commands like `.help`, `.info`, `.ping`
- **Group** - Group management: `.kick`, `.add`, `.promote`
- **Media** - Media processing: `.sticker`, `.toimg`, `.ytmp3`
- **Educational** - Learning tools: `.translate`, `.wiki`, `.math`
- **Fun** - Entertainment: `.quiz`, `.truth`, `.dare`
- **User** - User profile: `.register`, `.profile`, `.level`
- **Utility** - Tools: `.weather`, `.calculate`, `.currency`
- **Menu** - Menu navigation: `.menu`, `.list`

## Development

To contribute to the project:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgements

- [@whiskeysockets/baileys](https://github.com/WhiskeySockets/Baileys) for the WhatsApp Web API
- All contributors who have helped make this project better