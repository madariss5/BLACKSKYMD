# Deploying WhatsApp Bot to Heroku

This guide provides detailed instructions for deploying the WhatsApp Bot to Heroku, addressing the common challenges of Heroku's ephemeral filesystem.

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

### 1. Optimize Configuration for Heroku

Heroku has an ephemeral filesystem, meaning files written during the application's runtime are not persisted between dynos restarts. To overcome this:

- We'll use the bot's built-in credential backup system
- Use environment variables for configuration
- Utilize Heroku's add-ons for persistent storage when needed

### 2. Adjust Port Configuration

Heroku dynamically assigns a port to your application, which we must respect:

```javascript
// In server.js or your web server file
const PORT = process.env.PORT || 5000;
```

### 3. Create a Procfile

Create a `Procfile` in your project root (if not already present) with the following content:

```
web: node heroku-deploy.js
```

This tells Heroku to run the `heroku-deploy.js` script when starting the web dyno.

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

### 2. Add the Heroku Redis Add-on (Optional but Recommended)

Redis can be used to store session data and credentials:

```bash
heroku addons:create heroku-redis:hobby-dev
```

### 3. Configure Environment Variables

```bash
# Set environment variables for your configuration
heroku config:set NODE_ENV=production
heroku config:set PREFIX=!
heroku config:set OWNER_NUMBER=1234567890
```

Add any other environment variables your bot needs.

## Deployment Process

### 1. Prepare your code for Heroku

Ensure your `package.json` has the correct:
- Main script
- Node version
- Start command

Example `package.json` snippet:
```json
{
  "name": "blacksky-md-bot",
  "version": "1.0.0",
  "description": "WhatsApp Bot for Heroku",
  "main": "heroku-deploy.js",
  "scripts": {
    "start": "node heroku-deploy.js"
  },
  "engines": {
    "node": "14.x"
  }
}
```

### 2. Commit your changes

```bash
git add .
git commit -m "Prepared for Heroku deployment"
```

### 3. Deploy to Heroku

```bash
git push heroku main
```

Or if you're on a different branch:

```bash
git push heroku yourbranch:main
```

### 4. Scale your app

By default, Heroku doesn't start web dynos automatically after deployment. Start it with:

```bash
heroku ps:scale web=1
```

## Post-Deployment Steps

### 1. Connecting to WhatsApp

After deployment, you'll need to connect your bot to WhatsApp by scanning a QR code:

1. View the logs to see the QR code URL:
   ```bash
   heroku logs --tail
   ```

2. Open the URL shown in the logs (it will be something like `https://your-app-name.herokuapp.com/qr`)

3. Scan the QR code with your WhatsApp app

### 2. Monitoring Logs

Keep monitoring the logs to ensure your bot is running correctly:

```bash
heroku logs --tail
```

### 3. Setting up credential backup

The bot has a built-in credential backup system that works with Heroku's ephemeral filesystem:

1. First connection: Scan the QR code as described above
2. The credentials will be automatically backed up to a secure format
3. On dyno restarts, the credentials will be automatically restored from backup

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

3. **Perform backups**
   Export important data regularly:
   ```bash
   heroku pg:backups:capture --app your-app-name
   ```

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

By following this guide, you should have a successfully deployed WhatsApp bot running on Heroku with optimized settings for reliability and persistence across dyno restarts.

For further assistance, refer to the Heroku documentation or the WhatsApp bot's specific documentation.