# Deploy BLACKSKY-MD WhatsApp Bot to Heroku

[![Deploy](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy?template=https://github.com/madariss5/BLACKSKYMD)

## Prerequisites
Before deploying to Heroku, make sure you have:

1. A Heroku account (create one at [heroku.com](https://heroku.com) if you don't have it)
2. [Heroku CLI](https://devcenter.heroku.com/articles/heroku-cli) installed on your computer
3. A WhatsApp account for the bot
4. Node.js and npm installed locally (for testing)
5. Git installed on your computer


## Required Environment Variables

Set up the following environment variables in Heroku:

```bash
# Required
OWNER_NUMBER=          # Your WhatsApp number (without +)
NODE_ENV=production    # Set to 'production' for Heroku
PORT=                  # Will be set by Heroku automatically

# Optional but recommended
LOG_LEVEL=info        # Logging level (debug/info/warn/error)
```

## Deployment Steps

### 1. Prepare Your Application

1. Clone the repository:
```bash
git clone https://github.com/madariss5/BLACKSKYMD.git
cd BLACKSKYMD
```

2. Install dependencies:
```bash
npm install
```

3. Create a new Heroku app:
```bash
heroku create your-app-name
```

### 2. Configure Environment Variables

1. Set up environment variables on Heroku:
```bash
heroku config:set OWNER_NUMBER=your-number-here
heroku config:set NODE_ENV=production
```

### 3. Deploy to Heroku

1. Push your code to Heroku:
```bash
git push heroku main
```

2. Ensure at least one dyno is running:
```bash
heroku ps:scale web=1
heroku ps:scale worker=1
```

3. Open your app:
```bash
heroku open
```

## Post-Deployment Steps

1. Visit your app's URL to see the QR code interface
2. Scan the QR code with WhatsApp to connect your bot
3. Test the connection by sending a test message
4. Use the `.getcreds` command to get your session credentials
5. Add these credentials to your Heroku config vars to maintain the session (Your bot will now stay connected even after Heroku dynos restart)

## Maintaining the Connection

- The bot will automatically reconnect if disconnected
- Session data is preserved between restarts
- Use `heroku logs --tail` to monitor the bot's status


## Troubleshooting

### Common Issues and Solutions

1. **Application Error on Launch**
   - Check logs: `heroku logs --tail`
   - Ensure all environment variables are set
   - Verify the Procfile is correct
   - Check if the port binding is correct

2. **WhatsApp Connection Issues**
   - Clear your browser cache and try scanning again
   - Check if your WhatsApp is up to date
   - Ensure you're using the correct WhatsApp number

3. **H10 - App Crashed**
   - Check the application logs
   - Verify Node.js version compatibility
   - Ensure all dependencies are properly installed

4. **H14 - No Web Dynos Running**
   - Run: `heroku ps:scale web=1`
   - Check if the Procfile is properly configured

5. If you encounter other issues:
   - Check the Heroku logs for errors
   - Make sure all environment variables are set correctly
   - Try reconnecting by visiting the /qr endpoint


### Heroku Deployment Tips

1. **Optimize Your Dynos**
   - Use both web and worker dynos for better stability
   - Consider upgrading to hobby or professional dynos for 24/7 uptime

2. **Monitor Your App**
   - Use `heroku logs --tail` to watch real-time logs
   - Set up log monitoring for important events
   - Configure alerts for disconnections

3. **Resource Management**
   - Keep an eye on dyno hours usage
   - Monitor memory usage and leaks
   - Use proper error handling and logging

## Important Notes

- Free Heroku dynos sleep after 30 minutes of inactivity
- Use a service like UptimeRobot to prevent dyno sleeping
- Consider upgrading to a hobby or professional dyno for better reliability
- Regular monitoring of logs is recommended
- Keep your WhatsApp and bot application updated

## Support and Documentation

- For bot-specific issues, create an issue on the [GitHub repository](https://github.com/madariss5/BLACKSKYMD/issues)
- For Heroku-related questions, refer to [Heroku's documentation](https://devcenter.heroku.com)
- For WhatsApp-related issues, check [WhatsApp's FAQ](https://faq.whatsapp.com)

## Security Considerations

- Never share your WhatsApp credentials
- Keep your environment variables secure
- Regularly update your dependencies
- Monitor for unusual activity
- Back up your session data regularly

Remember to star the repository if you find it helpful! ⭐