# BLACKSKY-MD WhatsApp Bot - Heroku Deployment Guide

## Quick Deploy
[![Deploy](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy)

## Prerequisites
1. A WhatsApp account for the bot
2. Your WhatsApp number to be set as owner (without +)
3. [Heroku](https://heroku.com) account

## Deployment Steps

### Method 1: One-Click Deploy
1. Click the "Deploy to Heroku" button above
2. Fill in the required environment variables:
   - `OWNER_NUMBER`: Your WhatsApp number without + (required)
   - `BOT_NAME`: Name for your bot (optional)
   - `PREFIX`: Command prefix (optional, defaults to !)

### Method 2: Manual Deploy
1. Fork/Clone this repository
2. Create a new Heroku app
3. In Heroku dashboard:
   - Go to Settings → Config Vars
   - Add the required environment variables (same as above)
4. Deploy using Heroku Git or GitHub integration:
   ```bash
   # Using Heroku Git
   heroku login
   heroku git:remote -a your-app-name
   git push heroku main
   ```

## Post-Deployment
1. Once deployed, open your app's URL
2. Scan the QR code with WhatsApp
3. The bot will automatically save credentials and maintain connection

## Important Notes
- The bot uses Heroku's `/tmp` directory for session storage
- Credentials are automatically backed up and restored
- Bot will auto-reconnect if disconnected
- Uses eco dyno to stay within free tier limits

## Troubleshooting
1. If QR code doesn't appear:
   - Check Heroku logs: `heroku logs --tail`
   - Ensure all environment variables are set
   - Verify your dyno is running: `heroku ps`

2. If bot disconnects:
   - The bot will automatically attempt to reconnect
   - No manual intervention needed

## Support
- For bot-related issues, use the `.help` command
- For deployment issues, check Heroku logs
- For further assistance, open an issue in the GitHub repository

## Cost Considerations
- Runs well on Heroku's eco dyno plan
- No additional add-ons required
- Stays within free tier limits
