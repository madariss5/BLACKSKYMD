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
- Heroku account (for deployment)

## Local Development

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

## Heroku Deployment

### Method 1: Deploy with Button

[![Deploy to Heroku](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy)

1. Click the Deploy button above
2. Fill in the required environment variables:
   - `OWNER_NUMBER`: Your WhatsApp number (format: 1234567890)
   - `SESSION_ID`: Will be auto-generated
   - `BOT_PREFIX`: Command prefix (default: .)
   - `BOT_NAME`: Your bot's name
   - Optional API keys for enhanced features

### Method 2: Manual Deployment

1. Create a new Heroku app
2. Add the following buildpack:
   - heroku/nodejs

3. Configure environment variables in Heroku Settings:
   - Set all variables from .env.example
   - Ensure `NODE_ENV` is set to "production"

4. Deploy using Heroku Git:
```bash
heroku login
heroku git:remote -a your-app-name
git push heroku main
```

5. Enable the worker dyno:
```bash
heroku ps:scale worker=1
```

## Environment Variables

Make sure to set these environment variables in your Heroku settings:

Required:
- `OWNER_NUMBER`: Your WhatsApp number (format: 1234567890)
- `SESSION_ID`: Unique session ID for multi-device support (auto-generated)
- `BOT_PREFIX`: Command prefix for the bot (default: .)
- `BOT_NAME`: Custom name for your bot
- `NODE_ENV`: Set to "production" for deployment

Optional API keys for enhanced features:
- `OPENWEATHERMAP_API_KEY`: For weather commands
- `GOOGLE_API_KEY`: For Google services
- `WOLFRAM_APP_ID`: For Wolfram Alpha queries
- `NEWS_API_KEY`: For news commands

## Troubleshooting

If you encounter any issues during deployment:

1. Check Heroku logs:
```bash
heroku logs --tail
```

2. Verify environment variables are set correctly
3. Ensure worker dyno is running
4. Check if the WhatsApp connection is established

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.