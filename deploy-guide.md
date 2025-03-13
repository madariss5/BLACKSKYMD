# Deployment Guide for BLACKSKY-MD WhatsApp Bot

This guide will help you deploy your WhatsApp bot to various platforms.

## Deployment on Replit

1. **Create a new Repl**
   - Go to [Replit](https://replit.com/)
   - Click on "Create Repl"
   - Select "Import from GitHub" and paste your repository URL
   - Choose "Node.js" as the language

2. **Set up environment variables**
   - Go to the "Secrets" tab in your Repl
   - Add all the variables from your `.env` file

3. **Configure the run command**
   - In the `.replit` file, set your run command to:
   ```
   run = "node connected-bot.js"
   ```

4. **Start the bot**
   - Click the "Run" button
   - The QR code will be accessible via the Replit webview on port 5000

## Deployment on Heroku

1. **Create a new Heroku app**
   ```bash
   heroku create your-bot-name
   ```

2. **Set up environment variables**
   ```bash
   heroku config:set PREFIX=.
   heroku config:set OWNER_NUMBER=491234567890
   # Set all other required environment variables...
   ```

3. **Configure Procfile**
   Make sure your Procfile contains:
   ```
   web: node connected-bot.js
   ```

4. **Push to Heroku**
   ```bash
   git push heroku main
   ```

5. **Scale the dyno**
   ```bash
   heroku ps:scale web=1
   ```

## Setup with Custom Domain

If you want to use a custom domain for your QR code:

1. **For Replit:**
   - Go to "Settings" > "Custom Domains"
   - Add your domain and follow the DNS configuration instructions

2. **For Heroku:**
   ```bash
   heroku domains:add yourdomain.com
   ```
   - Follow the DNS configuration instructions provided by Heroku

## Keeping the Bot Running 24/7

For uninterrupted operation:

1. **Using UptimeRobot**
   - Create an account at [UptimeRobot](https://uptimerobot.com/)
   - Add a new monitor
   - Set the URL to your deployed bot's domain
   - Set check interval to 5 minutes

2. **Using always-on feature in Replit**
   - If you have Replit Pro, enable the always-on feature in your Repl settings

## Updating the Bot

1. **Pull latest changes from GitHub**
   ```bash
   git pull origin main
   ```

2. **Install any new dependencies**
   ```bash
   npm install
   ```

3. **Restart the bot**
   - For Replit, just press the "Run" button again
   - For Heroku: `heroku restart`

## Troubleshooting

If you encounter connection issues:

1. **Check logs**
   - Replit: View the console output
   - Heroku: `heroku logs --tail`

2. **Clear auth data**
   - Delete the `auth_info_qr` directory
   - Restart the bot and scan a new QR code

3. **Network issues**
   - Ensure your server has stable internet access
   - Some platforms might block WhatsApp connections, consider using a VPN