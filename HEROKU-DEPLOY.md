# Deploying WhatsApp Bot to Heroku

This guide provides detailed instructions for deploying the WhatsApp Bot to Heroku, with a focus on proper configuration and maintenance.

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Preparing for Deployment](#preparing-for-deployment)
3. [Setting Up Heroku](#setting-up-heroku)
4. [Deployment Process](#deployment-process)
5. [Post-Deployment Steps](#post-deployment-steps)
6. [Troubleshooting](#troubleshooting)
7. [Maintaining Your Bot](#maintaining-your-bot)

## Prerequisites

Before you start, make sure you have:
- A Heroku account (Sign up at [heroku.com](https://www.heroku.com) if needed)
- [Heroku CLI](https://devcenter.heroku.com/articles/heroku-cli) installed
- Git installed on your computer
- Node.js installed (version 14+ recommended)
- A WhatsApp account for the bot

## Preparing for Deployment

### 1. Configure Environment Variables

The bot uses several environment variables defined in `app.json`. Key variables include:
- `PREFIX`: Command prefix for the bot (default: ".")
- `OWNER_NUMBER`: Your WhatsApp number with country code (e.g., "491234567890")
- `AUTH_DIR`: Directory for auth files (default: "auth_info_baileys")
- `LOG_LEVEL`: Logging level (default: "info")

### 2. Understanding Heroku's Filesystem

Heroku has an ephemeral filesystem, meaning files written during runtime are not persisted between dynos restarts. The bot is designed to handle this by:
- Using environment variables for configuration
- Implementing automatic credential backup and restore
- Utilizing Heroku's PostgreSQL add-on for persistent storage

## Setting Up Heroku

### 1. Create a new Heroku application

```bash
# Log in to Heroku
heroku login

# Create a new Heroku app
heroku create your-whatsapp-bot-name

# Or if you want to use a specific region
heroku create your-whatsapp-bot-name --region eu
```

### 2. Configure Environment Variables

```bash
# Set essential environment variables
heroku config:set NODE_ENV=production
heroku config:set PREFIX=.
heroku config:set OWNER_NUMBER=your_number_here
```

Add any other environment variables defined in `app.json` that you want to customize.

## Deployment Process

### 1. Deploy using Heroku Git

```bash
# Add Heroku remote
heroku git:remote -a your-app-name

# Push to Heroku
git push heroku main
```

The deployment process will automatically:
- Install required dependencies
- Set up the PostgreSQL database
- Configure the necessary buildpacks
- Run post-deployment migrations

### 2. Verify Deployment

Check deployment status and logs:
```bash
# View build logs
heroku logs --tail
```

## Post-Deployment Steps

### 1. Connecting to WhatsApp

After deployment:
1. Visit your app URL to see the QR code
2. Scan the QR code with WhatsApp
3. The bot will automatically save and manage credentials

### 2. Verify Bot Operation

Check that the bot is running properly:
```bash
# Check application status
heroku ps

# View real-time logs
heroku logs --tail
```

## Troubleshooting

### Common Issues and Solutions

1. **Bot disconnects after a few hours**
   - This is normal behavior on Heroku's free tier, which puts apps to sleep after 30 minutes of inactivity
   - Upgrade to a hobby or paid dyno to avoid this issue
   - Use a service like [UptimeRobot](https://uptimerobot.com/) to ping your app every few minutes

2. **Error: R10 (Boot timeout)**
   - Your app is taking too long to start
   - Check for heavy operations in startup code
   - Consider moving initialization logic to background processes

3. **Error: H12 (Request timeout)**
   - Web requests are timing out (30 seconds limit on Heroku)
   - Optimize long-running operations
   - Move intensive tasks to background workers

4. **Cannot connect to WhatsApp**
   - Ensure Redis add-on is properly configured
   - Check that environment variables are set correctly
   - Verify there are no IP restrictions on WhatsApp's side

### Resolving Authentication Issues

If your bot loses connection and cannot reconnect automatically:
1. Access the Heroku Dashboard
2. Restart the dyno: `heroku restart`
3. Check logs to see the new QR code URL
4. Scan the QR code again to reconnect

## Maintaining Your Bot

### Regular Maintenance

1. **Keep dependencies updated**
   ```bash
   npm update
   git commit -am "Updated dependencies"
   git push heroku main
   ```

2. **Monitor usage**
   Regularly check your Heroku dashboard for:
   - Dyno usage
   - Add-on usage
   - Logs for errors

### Scaling Your Bot

As your bot's user base grows, you might need to scale:
1. **Upgrading dynos**
   ```bash
   heroku ps:type hobby
   ```

2. **Add more dynos for higher load**
   ```bash
   heroku ps:scale web=2
   ```

### Securing Your Bot

1. **Regularly rotate API keys**
   Update any external API keys used by your bot

2. **Monitor access**
   Check for unusual connection patterns or usage

3. **Keep your WhatsApp app updated**
   This ensures compatibility with the latest API changes

---

For further assistance, refer to:
- [Heroku Documentation](https://devcenter.heroku.com/)
- [WhatsApp Bot Documentation](./docs/)
- [Baileys Library Documentation](https://github.com/whiskeysockets/baileys)