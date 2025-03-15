# Deployment Guide for WhatsApp Bot

This deployment guide provides simple, straightforward instructions for deploying your WhatsApp bot to Heroku, with a focus on using the Safari connection method for maximum reliability.

## 📋 Step-by-Step Deployment

### Prerequisites

Before you begin, make sure you have:
- A Heroku account
- Git installed on your computer
- Your WhatsApp number

### Step 1: Set up your local repository

Clone the repository and navigate to it:

```bash
git clone https://github.com/yourusername/whatsapp-bot.git
cd whatsapp-bot
```

### Step 2: Create a Heroku app

```bash
# Login to Heroku
heroku login

# Create a new Heroku app
heroku create your-whatsapp-bot-name
```

### Step 3: Configure environment variables

```bash
# Set essential environment variables
heroku config:set NODE_ENV=production
heroku config:set PREFIX=.
heroku config:set OWNER_NUMBER=your_number_here
heroku config:set PLATFORM=heroku
heroku config:set AUTH_DIR=auth_info_safari
heroku config:set CONNECTION_METHOD=safari
```

### Step 4: Deploy to Heroku

```bash
# Add Heroku remote
heroku git:remote -a your-app-name

# Push to Heroku
git push heroku main
```

### Step 5: Connect your WhatsApp

After deployment:

1. View the Heroku logs to see the QR code:
   ```bash
   heroku logs --tail
   ```

2. Scan the QR code with your WhatsApp

3. Once connected, the bot will send authentication credentials to your WhatsApp as backup

## 🔄 Reconnection Process

If your Heroku dyno restarts or the bot disconnects:

1. The bot will attempt to reconnect automatically using stored credentials
2. If that fails, a new QR code will be generated in the logs
3. If you need to restore credentials, forward the `creds.json` file the bot previously sent to you

## ⚠️ Troubleshooting Common Issues

### Connection Errors (Status Code 405)

This error is common in cloud environments due to WhatsApp's restrictions. Our Safari connection method is specially designed to bypass this limitation. If you still encounter this error:

1. Ensure all environment variables are set correctly
2. Try restarting the dyno: `heroku restart`
3. Check the logs for specific error messages: `heroku logs --tail`

### Authentication Issues

If the bot keeps generating new QR codes after every restart:

1. Forward the backup `creds.json` file (that the bot sent to your WhatsApp) back to the bot
2. The file will be automatically detected and used for authentication

### Heroku Free Tier Sleeping

Heroku free tier dynos sleep after 30 minutes of inactivity. To keep your bot running:

1. Upgrade to a hobby or paid dyno
2. Use a service like UptimeRobot to ping your app URL every 20 minutes

## 🔒 Security Considerations

1. Never share your `creds.json` file or QR code publicly
2. Set strong access controls for your bot's admin commands
3. Regularly check connected devices in your WhatsApp

## 📱 Maintaining Your Bot

To keep your bot up to date:

1. Pull the latest changes from the repository
2. Push to Heroku:
   ```bash
   git push heroku main
   ```

## 🆘 Need Help?

If you encounter any issues:

1. Check the detailed logs: `heroku logs --tail`
2. Look for specific error messages in the logs
3. Refer to the more detailed documentation in HEROKU-SAFARI.md for advanced troubleshooting