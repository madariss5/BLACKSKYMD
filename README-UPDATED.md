# 🤖 BLACKSKY-MD WhatsApp Bot

A versatile WhatsApp bot with multiple connection methods, 490+ commands, and multi-language support.

## ✨ Features

- **Dual Connection Methods:** Connect via QR code or pairing code
- **Command-Rich:** 490+ commands across 15 categories
- **Multi-Language:** Support for English and German
- **Robust Architecture:** Enhanced error handling and auto-reconnection
- **Web Interface:** User-friendly dashboard for control and monitoring

## 🚀 Getting Started

### Connection Options

1. **QR Code Method**
   - Run the `QR Code Server` workflow
   - Scan the displayed QR code with your WhatsApp mobile app

2. **Pairing Code Method**
   - Run the `Improved Pairing Code` workflow
   - Enter your phone number (with country code, no '+' symbol)
   - Click "Get Pairing Code"
   - Enter the code in your WhatsApp mobile app

### Cloud Deployment

If you're running this bot in a cloud environment (like Replit), you might encounter connection issues (405 error). This is due to WhatsApp's security measures.

For reliable cloud deployment:
1. See `DEPLOYMENT_GUIDE.md` for detailed instructions
2. Consider generating auth files locally first
3. Upload pre-authenticated session to your cloud environment

## 📚 Documentation

- **Implementation Summary:** `IMPLEMENTATION_SUMMARY.md`
- **Deployment Guide:** `DEPLOYMENT_GUIDE.md`
- **Connection Troubleshooting:** `CONNECTION_FIXES.md`
- **Phone Number Format:** `PHONE_FORMATTING.md`
- **Error Handling:** `ERROR_HANDLING.md`

## 📋 Command Categories

The bot includes commands in these categories:
- 📱 Basic: Core functionality and utility commands
- 👥 Group: Group management and administration
- 🎵 Media: Audio, video, and image manipulation
- 🎮 Fun: Entertainment and games
- 🔞 NSFW: Age-restricted content (disabled by default)
- 😄 Reactions: GIF reactions and expressions
- 🎓 Educational: Learning and information resources
- 👤 User: Profile and user-specific features
- 🧰 Utility: Helpful tools and converters
- 📊 Stats: Usage statistics and analytics
- ⚙️ Admin: Bot administration and configuration
- 💬 AI: Artificial intelligence features
- 🌐 Web: Web-based utilities and searches
- 📝 Notes: Note-taking and reminders
- 🎲 Games: Interactive games and challenges

## 🛠️ Technical Notes

### Environment Variables

- `PAIRING_NUMBER`: Phone number for pairing code generation
- `OWNER_NUMBER`: Bot owner's WhatsApp number
- `LANGUAGE`: Default language (en/de)

### Authentication

Auth files are stored in various directories based on the connection method used:
- `auth_info_baileys`: Main auth directory
- `auth_info_pairing`: Pairing code auth directory
- `auth_info_qr`: QR code auth directory

### Connection Error Handling

- 405 error is common in cloud environments due to WhatsApp security measures
- Multiple browser fingerprints are tried automatically
- See `CONNECTION_README.md` for more details

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

Created with 💖 by BLACKSKY-MD Team