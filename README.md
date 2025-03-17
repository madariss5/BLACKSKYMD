# BLACKSKY-MD WhatsApp Bot

A sophisticated WhatsApp multi-device bot platform with advanced hosting solutions and intelligent deployment capabilities.

[![Deploy](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy?template=https://github.com/madariss5/BLACKSKY)

## Features

- **Multi-Device Compatible**: Works with the latest WhatsApp Multi-Device
- **Cloud-Ready**: Optimized for cloud hosting platforms like Heroku
- **Persistent Sessions**: Maintains connection after system restarts
- **Reaction GIFs**: Full support for animated reaction commands
- **Command Categories**: Organized commands for easy management
- **Admin Controls**: Comprehensive group and permission management
- **Multiple Languages**: Support for various languages

## One-Click Deployment Options

| Platform | Button | Guide |
|----------|--------|-------|
| Heroku | [![Deploy](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy?template=https://github.com/madariss5/BLACKSKY) | [Heroku Guide](HEROKU_SETUP_GUIDE.md) |
| Docker | N/A | [Docker Guide](DOCKER_DEPLOYMENT_GUIDE.md) |
| Termux | N/A | [Termux Guide](TERMUX_GUIDE.md) |

## Quick Start

1. **Deploy to Heroku**: Click the "Deploy" button above
2. **Configure**: Set your WhatsApp number as OWNER_NUMBER
3. **Deploy**: Wait for deployment to complete
4. **Connect**: Scan the QR code with your WhatsApp

## Command Categories

- **Basic**: General commands for everyday use
- **Admin**: Group management and administrative functions
- **Utility**: Helpful tools and utilities
- **Fun**: Entertainment and interactive commands
- **Reactions**: GIF-based reaction commands
- **NSFW**: Adult content (disabled by default)

## Deployment Options

BLACKSKY-MD supports multiple deployment methods:

- **Heroku**: One-click cloud deployment
- **Docker**: Container-based deployment for better reliability
- **Termux**: Run directly on Android devices
- **VPS/Cloud**: Deploy on any Linux-based system

See the corresponding guides in this repository for detailed instructions.

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| OWNER_NUMBER | Your WhatsApp number with country code | Required |
| PREFIX | Command prefix | ! |
| GROUP_ONLY_MSG | Message when used in private | This bot only works in groups! |
| DISABLE_PM | Disable private messages | false |
| ENABLE_NSFW | Enable NSFW commands | false |
| LANGUAGE | Bot language | en |

## Special Cloud Features

When running in cloud environments like Heroku:

- **Automatic Connection Recovery**: Reconnects after dyno restarts
- **Session Persistence**: Maintains session across restarts
- **Reaction GIFs Fallback**: Uses networked GIFs when local files unavailable
- **Optimized Resources**: Minimal resource usage for cloud constraints

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.