# Heroku Deployment Guide with Safari Connection

This guide provides detailed instructions for deploying the BLACKSKY-MD WhatsApp Bot to Heroku, specifically optimized to use the Safari connection method which offers the best reliability in cloud environments.

## Key Improvements

1. **Safari Browser Fingerprint**: The bot now automatically uses Safari browser fingerprint when running on Heroku for improved connection stability.
2. **Enhanced Error Recovery**: Special handling for cloud environment-specific errors (status code 405).
3. **Optimized Connection Parameters**: Longer timeouts and more frequent keepalive intervals for better performance on Heroku.
4. **Automatic Credentials Backup**: The bot automatically sends authentication credentials to your WhatsApp number for easy restoration.

## Deployment Steps

### 1. Preparation

Before deployment, ensure these files are properly configured:

- **Procfile**: Points to `safari-connect.js` as the main entry point
- **app.json**: Sets the auth directory to `auth_info_safari` and defines the connection method as `safari`
- **package.json**: Contains all necessary dependencies

### 2. Deploying to Heroku

#### Option 1: Deploy via Heroku CLI

```bash
# Login to Heroku
heroku login

# Create a new Heroku app
heroku create your-whatsapp-bot-name

# Add Heroku remote to your repository
heroku git:remote -a your-whatsapp-bot-name

# Set environment variables
heroku config:set PREFIX=.
heroku config:set OWNER_NUMBER=your_number_here
heroku config:set NODE_ENV=production
heroku config:set PLATFORM=heroku
heroku config:set AUTH_DIR=auth_info_safari
heroku config:set CONNECTION_METHOD=safari

# Push to Heroku
git push heroku main
```

#### Option 2: Deploy via Heroku Dashboard

1. Create a new app on Heroku Dashboard
2. Connect to your GitHub repository
3. Add the following environment variables in the Settings tab:
   - `PREFIX`: `.` (or your preferred command prefix)
   - `OWNER_NUMBER`: Your WhatsApp number (e.g., 491234567890)
   - `NODE_ENV`: `production`
   - `PLATFORM`: `heroku`
   - `AUTH_DIR`: `auth_info_safari`
   - `CONNECTION_METHOD`: `safari`
4. Deploy from the Deploy tab

### 3. Initial Connection

After deployment, you need to establish the initial connection:

1. View the Heroku logs to see the QR code:
   ```bash
   heroku logs --tail
   ```

2. Scan the QR code with your WhatsApp

3. Once connected, the bot will send authentication credentials to your WhatsApp as backup

### 4. Handling Reconnections

If Heroku dyno restarts or the bot disconnects:

1. The bot will attempt to reconnect automatically using stored credentials
2. If that fails, a new QR code will be generated in the logs
3. If you need to restore credentials, forward the `creds.json` file the bot previously sent to you

## Troubleshooting

### Common Issues

1. **Connection Errors (405)**:
   - This is a common error in cloud environments due to WhatsApp's restrictions
   - The Safari connection method is specifically designed to handle this
   - Ensure your environment variables are set correctly

2. **Authentication Issues**:
   - If the bot keeps generating new QR codes, your credentials may be invalid
   - Forward the backup `creds.json` file to the bot

3. **Dyno Sleeping (Free Tier)**:
   - Heroku free tier dynos sleep after 30 minutes of inactivity
   - Use a service like UptimeRobot to ping your bot every 20 minutes

## Advanced Configuration

### Persistent Storage for Heroku

Heroku has an ephemeral filesystem that loses data on dyno restarts. To maintain user data:

1. Add the PostgreSQL add-on:
   ```bash
   heroku addons:create heroku-postgresql:mini
   ```

2. The bot will automatically detect the PostgreSQL connection string from `DATABASE_URL` environment variable

3. User data, chat histories, and settings will be stored in the database

## Maintenance

### Regular Updates

To keep your bot up to date:

1. Pull the latest changes from the repository
2. Push to Heroku:
   ```bash
   git push heroku main
   ```

### Monitoring

Monitor your bot's performance and logs:

```bash
# View detailed logs
heroku logs --tail

# Check dyno status
heroku ps

# Check resource usage
heroku ps:utilization
```

## Security Considerations

1. Never share your `creds.json` file or QR code publicly
2. Regularly review connected devices in WhatsApp
3. Set strong access controls for your bot's admin commands