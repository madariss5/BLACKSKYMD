# BLACKSKY-MD WhatsApp Bot

A sophisticated WhatsApp multi-device bot with advanced network management and intelligent interaction capabilities, designed for seamless cross-environment communication.

[![Deploy](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy)

## Latest Updates

This repository now includes multiple deployment options to address common issues when deploying WhatsApp bots to cloud environments:

- **Docker-based deployment** for resolving complex dependencies
- **Aptfile-based deployment** as an alternative approach
- **One-click Heroku deploy button** for quick setup
- **Environment variable authentication** for simpler credential management

See [GITHUB-SUMMARY.md](GITHUB-SUMMARY.md) for a complete list of changes.

## Key Features

- **Multi-device support** via @whiskeysockets/baileys library
- **490+ commands** across 15 categories
- **Advanced connection handling** for cloud environments
- **Multiple deployment options** for different needs
- **Intelligent error recovery** and credential management

## Quick Start

### Option 1: One-Click Deploy to Heroku

[![Deploy](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy)

### Option 2: Local Development

```bash
# Clone the repository
git clone https://github.com/yourusername/your-repo-name.git
cd your-repo-name

# Install dependencies
npm install

# Start the bot
node quick-connect.js
```

### Option 3: Manual Heroku Deployment

Choose from our deployment guides:
- [Standard Deployment](HEROKU-DEPLOYMENT.md)
- [Docker-based Deployment](HEROKU-DOCKER-GUIDE.md)
- [Aptfile-based Deployment](HEROKU-APTFILE-GUIDE.md)

## Authentication

WhatsApp bots require authentication through QR code scanning. Due to platform restrictions, direct QR code scanning often fails in cloud environments like Heroku. We recommend:

1. **Local Authentication First**: Connect your bot locally and then transfer the credentials to Heroku
2. **Environment Variable Authentication**: Use the CREDS_JSON environment variable for simpler setup

Full instructions are in the [DEPLOYMENT_SUMMARY.md](DEPLOYMENT_SUMMARY.md) file.

## Connection System

This bot includes an enhanced connection system specifically designed to work around the "Connection Failure" issues common when running WhatsApp bots in cloud environments.

For detailed information about connection options, see [CONNECTION_README.md](CONNECTION_README.md).

## Deployment Options

For a complete overview of available deployment methods and their pros/cons, see [DEPLOYMENT_OPTIONS.md](DEPLOYMENT_OPTIONS.md).

## Contributing

Pull requests are welcome! Please see our [contributing guidelines](.github/CONTRIBUTING.md) for more information.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgements

- [@whiskeysockets/baileys](https://github.com/WhiskeySockets/Baileys) for the WhatsApp Web API
- All contributors to this project