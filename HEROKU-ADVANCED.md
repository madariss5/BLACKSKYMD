# Advanced Heroku Deployment Guide

This guide provides advanced techniques for deploying and maintaining your WhatsApp bot on Heroku.

## Prerequisites

- A Heroku account
- Git installed on your local machine
- Node.js and npm installed locally
- Heroku CLI installed (`npm install -g heroku`)
- Successfully authenticated on your local machine using `local-connect.js`

## One-Click Deploy

The easiest way to deploy is using the "Deploy to Heroku" button:

[![Deploy](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy)

When using one-click deploy:
1. Enter your WhatsApp number (without + sign) in the ADMIN_NUMBER field
2. Choose an app name
3. Click "Deploy app"

## Manual Deployment

For more control over the deployment process:

```bash
# Login to Heroku
heroku login

# Clone the repository
git clone https://github.com/yourusername/blacksky-whatsapp-bot.git
cd blacksky-whatsapp-bot

# Create a Heroku app
heroku create your-app-name

# Set environment variables
heroku config:set ADMIN_NUMBER=your_number_here

# Push to Heroku
git push heroku main
```

## Authentication Transfer (CRITICAL)

You have two options for transferring your WhatsApp authentication:

### Option 1: Using CREDS_JSON Environment Variable (Recommended)

This is the easiest method that doesn't require manually uploading auth files:

1. After successfully running `local-connect.js` locally, locate the `auth_info_baileys` folder
2. Find the `creds.json` file in this folder
3. Open it and copy the entire contents
4. Set this as the `CREDS_JSON` environment variable in Heroku:
   ```bash
   heroku config:set CREDS_JSON='{"clientID":"your-content-here",...}'
   ```
   (Make sure to include the entire contents of the file)

5. Restart your dyno:
   ```bash
   heroku dyno:restart
   ```

### Option 2: Manual File Upload

If you can't use the environment variable method:

1. After successfully running `local-connect.js` locally, locate the `auth_info_baileys` folder
2. Create a zip file of this folder:
   ```bash
   zip -r auth_files.zip auth_info_baileys
   ```

3. Open a shell on your Heroku dyno:
   ```bash
   heroku ps:exec
   ```

4. In a new terminal window, copy the zip file:
   ```bash
   heroku ps:copy auth_files.zip
   ```

5. Back in the Heroku shell, extract the files:
   ```bash
   mkdir -p auth_info_heroku
   unzip auth_files.zip
   cp -R auth_info_baileys/* auth_info_heroku/
   ```

6. Restart your dyno:
   ```bash
   exit
   heroku dyno:restart
   ```

## Environment Variables

Configure your bot with these environment variables:

```bash
# Required
heroku config:set ADMIN_NUMBER=your_whatsapp_number

# Optional - Performance
heroku config:set MAX_RETRIES=10
heroku config:set RECONNECT_INTERVAL=5

# Optional - Logging
heroku config:set LOG_LEVEL=info
```

## Advanced Deployment Options

### Use Custom Domain

```bash
heroku domains:add your-domain.com
# Follow instructions to configure DNS
```

### Scale for Better Performance

```bash
# Upgrade to a standard dyno for better performance
heroku ps:type standard
```

### Persistent Storage

For persistent data storage (user profiles, settings):

```bash
# Add PostgreSQL add-on
heroku addons:create heroku-postgresql:hobby-dev
```

Then update your code to use the `DATABASE_URL` environment variable.

## Monitoring and Maintenance

### View Logs

```bash
heroku logs --tail
```

### Check Connection Status

Visit your app URL to see the connection status dashboard.

### Manual Restart

If you encounter connection issues:

```bash
heroku dyno:restart
```

## Periodic Re-Authentication

WhatsApp sessions typically expire after 1-4 weeks. When this happens:

1. Re-run the `local-connect.js` script locally
2. Repeat the authentication transfer steps
3. Restart your Heroku dyno

## Troubleshooting

### Connection Issues

If you see "Connection Failure (Code: 405)" in logs:
- This is normal for Replit, but shouldn't happen on Heroku
- Verify that you transferred authentication properly
- The auth files must be in the `auth_info_heroku` folder

### Command Modules Not Loading

If commands aren't working:
- Check logs for module loading errors
- Ensure the `src/commands` structure is intact
- Manually test with `!help` and `!status` commands

### Memory Limits

If you're hitting memory limits:
- Use a Standard-2X or Performance dyno
- Optimize image processing operations
- Reduce concurrent operations