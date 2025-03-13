# 𝔹𝕃𝔸ℂ𝕂𝕊𝕂𝕐-𝕄𝔻

A comprehensive WhatsApp bot with multi-device support and extensive features using @whiskeysockets/baileys.

## Features

- Multi-device support
- Extensive command categories (utility, fun, group, media)
- Image and video processing
- Audio playback and management
- Group management features
- Heroku deployment ready with persistent sessions
- And much more!

## Prerequisites

- Node.js 16 or higher
- A WhatsApp account
- For Heroku deployment: A Heroku account

## Installation

### Local Setup

1. Clone the repository
```bash
git clone <repository-url>
cd 𝔹𝕃𝔸ℂ𝕂𝕊𝕂𝕐-𝕄𝔻
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

### Heroku Deployment

This bot is fully compatible with Heroku and includes features to maintain 24/7 uptime and session persistence.

#### Deploy with Heroku Button

[![Deploy to Heroku](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy)

#### Manual Heroku Deployment

1. Create a Heroku account if you don't have one
2. Install [Heroku CLI](https://devcenter.heroku.com/articles/heroku-cli)
3. Log in to Heroku CLI
```bash
heroku login
```

4. Create a new Heroku app
```bash
heroku create your-app-name
```

5. Add Heroku remote
```bash
heroku git:remote -a your-app-name
```

6. Add required buildpacks
```bash
heroku buildpacks:add heroku/nodejs
heroku buildpacks:add https://github.com/jonathanong/heroku-buildpack-ffmpeg-latest.git
```

7. Configure environment variables
```bash
heroku config:set OWNER_NUMBER=your-number
heroku config:set HEROKU_APP_NAME=your-app-name
heroku config:set NODE_ENV=production
# Add other variables as needed
```

8. Push to Heroku
```bash
git push heroku main
```

9. Scale the worker dyno (not the web dyno, as this is a worker application)
```bash
heroku ps:scale web=0 worker=1
```

10. Check the logs to scan the QR code
```bash
heroku logs --tail
```

#### Important Notes for Heroku Deployment

- When deploying to Heroku, you'll need to scan the QR code from the logs
- The bot implements session persistence to maintain your login across Heroku dynos restarts
- The bot automatically pings itself to avoid sleeping on free Heroku dynos
- If you still face connectivity issues, consider upgrading to a paid Heroku dyno

#### Session Management on Heroku

The 𝔹𝕃𝔸ℂ𝕂𝕊𝕂𝕐-𝕄𝔻 bot includes special mechanisms for session persistence:

1. **Temporary Directory Storage**: The bot automatically detects Heroku environment and stores session files in Heroku's `/tmp` directory.

2. **Backup System**: The bot creates regular backups of your session:
   - Initial backup on startup
   - Regular backups (every 15 minutes by default, configurable via `BACKUP_INTERVAL`)
   - Advanced session restoration logic that tries multiple backup sources

3. **Session ID**: Heroku automatically generates a unique `SESSION_ID` for your deployment using the `generator: "secret"` feature in app.json.

4. **Keep-Alive Mechanism**: The bot sends regular HTTP requests to itself to prevent free Heroku dynos from sleeping.

5. **Recovery from Failures**: If your bot disconnects, it implements exponential backoff retries and will regenerate a QR code if needed.

If you experience session issues, you can check the logs with:
```bash
heroku logs --tail
```

## Environment Variables

Required:
- `OWNER_NUMBER`: Your WhatsApp number (format: 1234567890)
- `SESSION_ID`: Unique session ID for multi-device support (auto-generated)
- `BOT_PREFIX`: Command prefix for the bot (default: .)
- `BOT_NAME`: Name for your 𝔹𝕃𝔸ℂ𝕂𝕊𝕂𝕐-𝕄𝔻 instance

Heroku Deployment (required for Heroku):
- `HEROKU_APP_NAME`: The name of your Heroku app (for keep-alive mechanism)
- `APP_URL`: Custom URL if you're using a custom domain (optional)
- `KEEP_ALIVE`: Set to "false" to disable keep-alive pings (default: true)
- `BACKUP_INTERVAL`: Minutes between session backups (default: 15)

Optional API keys for enhanced features:
- `OPENWEATHERMAP_API_KEY`: For weather commands
- `GOOGLE_API_KEY`: For Google services
- `WOLFRAM_APP_ID`: For Wolfram Alpha queries
- `NEWS_API_KEY`: For news commands
- `SPOTIFY_CLIENT_ID` & `SPOTIFY_CLIENT_SECRET`: For music-related functions

See [API Keys Documentation](docs/API_KEYS.md) for a complete list of supported APIs and setup instructions.

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