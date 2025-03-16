# Deploying WhatsApp Bot to Heroku with Aptfile

This guide explains how to deploy the WhatsApp bot to Heroku using the Aptfile approach, which helps resolve dependency issues with system libraries (like pangocairo) required by the canvas package.

## Prerequisites

1. [Heroku account](https://signup.heroku.com/)
2. [Heroku CLI](https://devcenter.heroku.com/articles/heroku-cli) installed
3. [Git](https://git-scm.com/) installed
4. Local WhatsApp connection already established (via `local-connect.js`)

## Step 1: Set Up the Heroku App

```bash
# Login to Heroku
heroku login

# Create a new app
heroku create your-whatsapp-bot-name
```

## Step 2: Add the Apt Buildpack

This buildpack will install the system dependencies needed for the canvas package:

```bash
heroku buildpacks:add --index 1 heroku-community/apt -a your-whatsapp-bot-name
heroku buildpacks:add --index 2 heroku/nodejs -a your-whatsapp-bot-name
```

## Step 3: Configure Environment Variables

```bash
# Set required environment variables
heroku config:set ADMIN_NUMBER=1234567890 -a your-whatsapp-bot-name
```

### Setting Up Authentication

You have two options for authentication:

#### Option 1: Using CREDS_JSON (Recommended)

1. Find your `creds.json` file in the `auth_info_baileys` folder (created when you ran `local-connect.js`)
2. Copy the entire contents
3. Set it as an environment variable:

```bash
heroku config:set CREDS_JSON='{"clientID":"your-content-here",...}' -a your-whatsapp-bot-name
```

#### Option 2: Manual Upload After Deployment

If the CREDS_JSON approach doesn't work, you can manually upload the authentication files:

1. Deploy the app first
2. Then SSH into the dyno:

```bash
heroku ps:exec -a your-whatsapp-bot-name
```

3. Create the auth directory:

```bash
mkdir -p auth_info_heroku
```

4. In another terminal, copy the files:

```bash
heroku ps:copy ./auth_info_baileys.zip -a your-whatsapp-bot-name
```

5. Back in the SSH session, extract the files:

```bash
unzip auth_info_baileys.zip
cp -R auth_info_baileys/* auth_info_heroku/
```

6. Restart the dyno:

```bash
exit
heroku dyno:restart -a your-whatsapp-bot-name
```

## Step 4: Deploy to Heroku

```bash
# Add Heroku as a remote
git remote add heroku https://git.heroku.com/your-whatsapp-bot-name.git

# Push to Heroku
git push heroku main
```

## Step 5: Monitor the Deployment

Watch the build logs during deployment:

```bash
heroku logs --tail -a your-whatsapp-bot-name
```

## Troubleshooting

### Deployment Failures

If you're still experiencing issues with the canvas dependency, try these additional steps:

1. Set Node.js version explicitly in package.json:
   ```json
   "engines": {
     "node": "18.x"
   }
   ```

2. Remove the canvas and chartjs-node-canvas dependencies if you don't absolutely need them:

   ```bash
   # Edit package.json to remove these dependencies
   # Then push again
   git push heroku main
   ```

3. Check if the Aptfile is being processed in the logs:

   ```bash
   heroku logs --source app --tail -a your-whatsapp-bot-name
   ```

   You should see messages about installing the apt packages.

### Connection Issues

If the bot connects but doesn't respond, check the logs for any WhatsApp connection errors:

```bash
heroku logs --tail -a your-whatsapp-bot-name
```

## Advanced Configuration

### Process File (Procfile)

If you need to use a custom start command, create a file named `Procfile` with:

```
web: node heroku-bot.js
```

### Node.js Versions

If you need to specify a different Node.js version:

```bash
heroku config:set NODE_VERSION=16.20.0 -a your-whatsapp-bot-name
```

## Conclusion

The Aptfile approach installs system dependencies needed by Node.js native modules like canvas. This can be a simpler alternative to using Docker for Heroku deployments.

## Maintenance

To update your bot:

1. Make your changes locally
2. Commit them:
   ```bash
   git add .
   git commit -m "Update message"
   ```
3. Push to both GitHub and Heroku:
   ```bash
   git push origin main
   git push heroku main
   ```