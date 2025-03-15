# Advanced Heroku Deployment with Safari Connection Method

This guide provides instructions for deploying your WhatsApp bot to Heroku using the Safari connection method, which has shown better success rates in cloud environments.

## Why Safari Connection Method?

The Safari connection method offers several advantages:

1. Better success rate in cloud environments like Heroku
2. Reduced likelihood of encountering the 405 error
3. More stable long-term connection
4. Improved reconnection capabilities

## Setup Instructions

### Prerequisites

- Heroku account
- Git and Heroku CLI installed
- Node.js installed locally

### Step 1: Local Setup First

For best results, establish a connection locally before deploying:

1. Clone your bot repository locally
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the local connection script:
   ```bash
   node local-connect.js
   ```
4. Scan the QR code with your phone
5. Once connected, you'll have generated authentication files in the `auth_info_baileys` folder

### Step 2: Prepare for Heroku Deployment

1. Compress the auth files:
   ```bash
   zip -r auth_files.zip auth_info_baileys
   ```

2. Create a new Heroku app:
   ```bash
   heroku create your-whatsapp-bot-name
   ```

3. Set environment variables:
   ```bash
   heroku config:set NODE_ENV=production
   heroku config:set ADMIN_NUMBER=1234567890  # Your WhatsApp number
   ```

4. Copy the `heroku-package.json` to replace the default `package.json`:
   ```bash
   cp heroku-package.json package.json
   ```

### Step 3: Deploy to Heroku

1. Commit your changes:
   ```bash
   git add .
   git commit -m "Prepare for Heroku deployment"
   ```

2. Push to Heroku:
   ```bash
   git push heroku main
   ```

### Step 4: Upload Authentication Files

1. Use SFTP to transfer the auth files to Heroku:
   ```bash
   # First, get a terminal on your Heroku dyno
   heroku ps:exec

   # In another terminal, copy the file to Heroku
   heroku ps:copy auth_files.zip
   ```

2. On the Heroku terminal, extract the files:
   ```bash
   mkdir -p auth_info_heroku
   unzip auth_files.zip -d ./
   cp -R auth_info_baileys/* auth_info_heroku/
   ```

3. Restart your dyno:
   ```bash
   exit  # Exit the Heroku terminal
   heroku dyno:restart
   ```

## Advanced Configuration

### Improving Reconnection

To improve reconnection capabilities, consider adjusting these parameters in `heroku-bot.js`:

```javascript
// Increase max retries
const MAX_RETRIES = 20;  // Default is 10

// Adjust reconnect interval
const RECONNECT_INTERVAL = 3000;  // Default is 5000
```

### Deploying with the "Deploy to Heroku" Button

You can add a one-click deploy button to your GitHub repository by including this in your README.md:

```markdown
[![Deploy to Heroku](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy?template=https://github.com/yourusername/your-repo)
```

Ensure your repository includes:
- `app.json` file for configuration
- `Procfile` with the correct start command
- `heroku-bot.js` as the main script

## Troubleshooting

### Common Issues

1. **405 Method Not Allowed Error**
   - This is a common issue with WhatsApp's server blocking cloud IPs
   - Solution: Use the Safari connection method and import authentication from a local session

2. **Connection Timeout**
   - Make sure your Heroku dyno is not sleeping (use a paid dyno)
   - Check your internet connection when generating the initial QR code

3. **Authentication Failed**
   - Your session may have expired
   - Solution: Generate a new session locally and upload again, or use the web interface to scan a new QR code

4. **Memory Issues on Heroku**
   - Consider upgrading to a larger dyno if you experience memory limitations
   - Optimize your bot code to reduce memory usage

## Maintaining 24/7 Operation

For 24/7 operation, upgrade from the free Heroku dyno:

```bash
heroku ps:scale web=1:basic
```

This ensures your bot doesn't go to sleep after 30 minutes of inactivity.

---

For technical support or questions about this deployment method, please refer to the project documentation or open an issue on GitHub.