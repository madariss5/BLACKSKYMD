# Heroku Deployment Guide

This guide provides comprehensive instructions for deploying BLACKSKY-MD WhatsApp Bot to Heroku, including both standard and container-based deployment methods.

## Quick Deployment

The fastest way to deploy is using the Deploy to Heroku button:

[![Deploy](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy?template=https://github.com/madariss5/BLACKSKY)

## Standard Deployment Method

### Prerequisites
- A Heroku account ([Sign up for free](https://signup.heroku.com/))
- Git installed on your machine

### Steps

1. **Clone the repository**
   ```bash
   git clone https://github.com/madariss5/BLACKSKYMD.git
   cd BLACKSKYMD
   ```

2. **Login to Heroku CLI**
   ```bash
   heroku login
   ```

3. **Create a new Heroku app**
   ```bash
   heroku create your-app-name
   ```

4. **Set required environment variables**
   ```bash
   heroku config:set OWNER_NUMBER=your-whatsapp-number
   ```

5. **Push to Heroku**
   ```bash
   git push heroku main
   ```

6. **Open the app**
   ```bash
   heroku open
   ```

7. **Scan the QR code** with your WhatsApp to connect.

## Container-Based Deployment Method (Recommended)

Heroku now supports Docker deployments, which provide better isolation and consistency.

### Steps

1. **Clone the repository**
   ```bash
   git clone https://github.com/madariss5/BLACKSKYMD.git
   cd BLACKSKYMD
   ```

2. **Login to Heroku CLI**
   ```bash
   heroku login
   ```

3. **Create a new Heroku app**
   ```bash
   heroku create your-app-name
   ```

4. **Set the stack to container**
   ```bash
   heroku stack:set container
   ```

5. **Set required environment variables**
   ```bash
   heroku config:set OWNER_NUMBER=your-whatsapp-number
   ```

6. **Push to Heroku**
   ```bash
   git push heroku main
   ```

7. **Open the app**
   ```bash
   heroku open
   ```

8. **Scan the QR code** with your WhatsApp to connect.

## Environment Variables

You can set these environment variables to customize your bot:

| Variable | Description | Default |
|----------|-------------|---------|
| OWNER_NUMBER | Your WhatsApp number with country code | Required |
| PREFIX | Command prefix | ! |
| GROUP_ONLY_MSG | Message when someone uses the bot in private | This bot only works in groups! |
| DISABLE_PM | Disable private messages | false |
| ENABLE_NSFW | Enable NSFW commands | false |
| LANGUAGE | Bot language | en |

## Session Persistence

Heroku has an ephemeral filesystem that doesn't persist across dyno restarts. BLACKSKY-MD includes a special session management system that preserves your WhatsApp connection across restarts.

This is automatically enabled and no additional configuration is required.

## Advanced Configuration

### Custom Buildpacks

The following buildpacks are automatically added:

1. **nodejs**: For running the Node.js application
2. **ffmpeg**: For media processing capabilities

### Dyno Scaling

For better uptime, you might want to upgrade from the free tier:

```bash
heroku ps:scale web=1:basic
```

### Logging

To view logs and troubleshoot issues:

```bash
heroku logs --tail
```

### Updating Your Deployment

To update your bot with the latest changes:

```bash
git pull origin main
git push heroku main
```

## Common Issues and Solutions

1. **QR Code not showing**:
   - Check the logs with `heroku logs --tail`
   - Ensure all environment variables are set correctly
   - Restart the dyno with `heroku restart`

2. **Connection issues**:
   - Make sure your WhatsApp app is up to date
   - Try reconnecting by visiting the /qr endpoint
   - Check for any recent WhatsApp API changes

3. **Dyno sleeping (free tier)**:
   - Use a service like UptimeRobot to ping your app every 30 minutes
   - Upgrade to a paid plan for 24/7 uptime

## Need More Help?

If you encounter any issues, please open a GitHub issue or reach out to the community for support.