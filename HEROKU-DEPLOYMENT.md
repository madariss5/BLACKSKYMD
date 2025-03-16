# Heroku Deployment Guide for WhatsApp Bot

This guide will help you deploy your WhatsApp bot to Heroku, which provides better compatibility with WhatsApp connections than other cloud platforms like Replit.

## Prerequisites

1. [Heroku account](https://signup.heroku.com/) (free tier works)
2. [Heroku CLI](https://devcenter.heroku.com/articles/heroku-cli) installed on your computer
3. [Git](https://git-scm.com/) installed on your computer

## Setting Up Your Heroku App

### 1. Create a New Heroku App

```bash
# Login to Heroku CLI
heroku login

# Create a new Heroku app
heroku create your-whatsapp-bot-name
```

Replace `your-whatsapp-bot-name` with a unique name for your app.

### 2. Set Environment Variables (Optional)

You can set environment variables for your bot, such as:

```bash
# Set admin number (replace with your WhatsApp number without +)
heroku config:set ADMIN_NUMBER=1234567890

# Set log level (info, warn, error, debug)
heroku config:set LOG_LEVEL=info

# Enable or disable commands
heroku config:set ENABLE_COMMANDS=true
```

### 3. Deploy Your Bot

```bash
# Add Heroku remote to your git repo
git remote add heroku https://git.heroku.com/your-whatsapp-bot-name.git

# Push your code to Heroku
git push heroku main
```

## Connecting Your WhatsApp Account

After deploying, there are two ways to connect your WhatsApp account:

### Method 1: Scan QR Code from Heroku Web Interface

1. Open your app in the browser:
   ```
   heroku open
   ```

2. You'll see a QR code on the web interface. Scan it with WhatsApp on your phone:
   - Open WhatsApp
   - Go to Settings > Linked Devices
   - Tap "Link a Device"
   - Scan the QR code shown on the Heroku web page

### Method 2: Import Existing Authentication

If you have a working WhatsApp connection from your local machine:

1. Create the authentication files locally first:
   ```bash
   # On your local machine
   node local-connect.js
   ```

2. After connecting, locate the `auth_info_baileys` folder

3. Compress the folder into a ZIP file

4. Upload to Heroku using:
   ```bash
   heroku ps:copy ./auth_info_baileys.zip
   ```

5. SSH into your Heroku dyno:
   ```bash
   heroku ps:exec
   ```

6. Extract the auth files:
   ```bash
   mkdir -p auth_info_heroku
   unzip auth_info_baileys.zip -d auth_info_heroku
   ```

7. Restart your dyno:
   ```bash
   heroku dyno:restart
   ```

## Checking Bot Status

You can monitor your bot's status through the web interface by visiting your app's URL, or by checking the logs:

```bash
heroku logs --tail
```

## Troubleshooting

### Connection Issues

If you encounter connection problems:

1. **Check Logs**: Use `heroku logs --tail` to see what's happening
2. **Restart Dyno**: Try `heroku dyno:restart` to restart the application
3. **Update Session**: If your session expired, you may need to scan a new QR code

### Expired Sessions

WhatsApp sessions typically expire after 1-4 weeks. When this happens:
1. Visit your app's web interface
2. A new QR code should be displayed
3. Scan it with your phone to create a new session

### App Sleeping (Free Tier)

On the free tier, Heroku apps "sleep" after 30 minutes of inactivity. To keep your bot online:

1. Upgrade to a paid dyno (recommended for 24/7 uptime)
2. Use a service like [Kaffeine](https://kaffeine.herokuapp.com/) to ping your app every 30 minutes

## Upgrading to 24/7 Operation

For continuous operation, upgrade to a paid Heroku dyno:

```bash
heroku ps:scale web=1:basic
```

This will switch to the Basic tier ($7/month) which provides 24/7 uptime.

## Common Commands

- **View logs**: `heroku logs --tail`
- **Restart app**: `heroku dyno:restart`
- **Set variables**: `heroku config:set VAR_NAME=value`
- **View variables**: `heroku config`
- **Open app**: `heroku open`

## Security Considerations

- Keep your authentication files private
- Don't commit `auth_info_heroku` folder to your Git repository
- Use environment variables for sensitive data
- Consider using a dedicated WhatsApp number for your bot

---

For more details on Heroku deployment, refer to the [official Heroku documentation](https://devcenter.heroku.com/articles/getting-started-with-nodejs).