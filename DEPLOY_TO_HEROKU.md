# Deploy BLACKSKY-MD WhatsApp Bot to Heroku

[![Deploy](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy?template=https://github.com/madariss5/BLACKSKYMD)

## Prerequisites
Before deploying, make sure you have:
1. A WhatsApp account for the bot
2. Your WhatsApp number to be set as owner (without +)
3. [Heroku](https://heroku.com) account

## Deployment Steps

1. Click the "Deploy" button above
2. Fill in the required environment variables:
   - `OWNER_NUMBER`: Your WhatsApp number with country code (no + or spaces)
   - Other variables are optional and have default values

3. Click "Deploy App" and wait for the deployment to complete
4. Once deployed, click "View" to open your app
5. Scan the QR code with WhatsApp to connect your bot
6. Send `.alive` command to verify the bot is working

## After Deployment

1. Use the `.getcreds` command to get your session credentials
2. Add these credentials to your Heroku config vars to maintain the session
3. Your bot will now stay connected even after Heroku dynos restart

## Troubleshooting

If you encounter any issues:
1. Check the Heroku logs for errors
2. Make sure all environment variables are set correctly
3. Try reconnecting by visiting the /qr endpoint

## Important Notes

- Free Heroku dynos go to sleep after 30 minutes of inactivity
- Use a service like UptimeRobot to keep your bot online 24/7
- For better reliability, consider upgrading to a paid dyno