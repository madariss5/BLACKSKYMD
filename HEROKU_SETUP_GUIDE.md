# Heroku Setup Guide for BLACKSKY-MD WhatsApp Bot

This guide will help you deploy the BLACKSKY-MD WhatsApp bot to Heroku with just a few clicks. Heroku provides a reliable cloud platform for running your WhatsApp bot 24/7.

## One-Click Deployment

The easiest way to deploy this bot is using the Deploy to Heroku button:

[![Deploy](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy?template=https://github.com/madariss5/BLACKSKY)

## Step-by-Step Deployment Instructions

1. **Click the "Deploy to Heroku" button** above.

2. **Create a Heroku account or log in** if you already have one.

3. **Enter your app name** - This will be part of your app's URL (`https://your-app-name.herokuapp.com`).

4. **Configure the required environment variables**:
   - `OWNER_NUMBER`: Your WhatsApp number with country code (e.g., 12025550170). Do not include '+' or spaces.

5. **Optional environment variables** (default values will be used if not specified):
   - `PREFIX`: Command prefix (default: !)
   - `GROUP_ONLY_MSG`: Message to send when someone tries to use the bot in private
   - `DISABLE_PM`: Set to "true" to disable private messages
   - `ENABLE_NSFW`: Set to "true" to enable NSFW commands
   - `LANGUAGE`: Bot language (en, es, pt, etc.)

6. **Click "Deploy App"** and wait for the deployment to complete.

7. **Once deployed, click "View"** to open your app.

8. **Scan the QR code** with your WhatsApp to connect your bot.

## Important Notes for Heroku Deployments

- Your bot will automatically reconnect after Heroku dynos restart (which happens every 24 hours).
- The bot uses a special cloud-optimized session manager to maintain your connection.
- All commands work in the cloud environment, including reaction GIFs thanks to the fallback system.

## Maintaining Your Connection

WhatsApp connections on Heroku remain active as long as:

1. Your Heroku account is in good standing
2. You have not manually disconnected your WhatsApp
3. Your WhatsApp app is kept up-to-date

If your connection is lost, simply visit your Heroku app URL (`https://your-app-name.herokuapp.com`) and scan the QR code again.

## Upgrading Your Heroku Plan

The free tier of Heroku has some limitations. For better reliability, consider upgrading to a paid plan:

1. Go to your [Heroku Dashboard](https://dashboard.heroku.com)
2. Select your app
3. Go to the Resources tab
4. Click "Change Dyno Type"
5. Select a paid plan (Basic is recommended for most users)

## Troubleshooting

If you encounter any issues with your Heroku deployment:

1. Check your Heroku logs by running `heroku logs --tail -a your-app-name` if you have the Heroku CLI installed, or by viewing logs in the Heroku Dashboard.
2. Make sure all required environment variables are set correctly.
3. Try redeploying the app if there are persistent issues.
4. Ensure your WhatsApp is up to date.

## Advanced: Manual Deployment

For users who prefer manual deployment:

```bash
# Clone the repository
git clone https://github.com/madariss5/BLACKSKYMD.git
cd BLACKSKYMD

# Install Heroku CLI (if not already installed)
# Follow instructions at: https://devcenter.heroku.com/articles/heroku-cli

# Log in to Heroku
heroku login

# Create a new Heroku app
heroku create your-app-name

# Set environment variables
heroku config:set OWNER_NUMBER=your-number-here

# Deploy to Heroku
git push heroku main

# Open your app
heroku open
```

## Need Help?

If you need assistance with your Heroku deployment, please open an issue on our [GitHub repository](https://github.com/madariss5/BLACKSKYMD/issues).