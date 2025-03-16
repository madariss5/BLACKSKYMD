# Deploying WhatsApp Bot to Heroku with Docker

This guide explains how to deploy the WhatsApp bot to Heroku using Docker, which helps resolve dependency issues like missing system libraries (e.g., pangocairo).

## Prerequisites

1. [Heroku account](https://signup.heroku.com/)
2. [Heroku CLI](https://devcenter.heroku.com/articles/heroku-cli) installed
3. [Git](https://git-scm.com/) installed
4. Local WhatsApp connection already established (via `local-connect.js`)

## Step 1: Prepare Your Repository

First, make sure your repository contains all the Docker-related files:

* `Dockerfile` - Contains instructions for building the Docker image
* `heroku.yml` - Tells Heroku to use Docker
* `heroku-package.json` - A specialized package.json file for Heroku deployment
* `app.json` - Updated to use the container stack

## Step 2: Create a Heroku App

```bash
# Login to Heroku
heroku login

# Create a new app
heroku create your-whatsapp-bot-name
```

## Step 3: Set Up the Container Stack

```bash
# Tell Heroku to use the container stack
heroku stack:set container -a your-whatsapp-bot-name
```

## Step 4: Configure Environment Variables

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

## Step 5: Deploy to Heroku

```bash
# Add Heroku as a remote
git remote add heroku https://git.heroku.com/your-whatsapp-bot-name.git

# Push to Heroku
git push heroku main
```

## Step 6: Monitor the Deployment

Watch the build logs during deployment. The build will take longer than usual because it's building a Docker image.

After deployment, check the logs:

```bash
heroku logs --tail -a your-whatsapp-bot-name
```

## Troubleshooting

### Deployment Failures

If deployment fails, check the build logs for specific errors:

```bash
heroku builds:info -a your-whatsapp-bot-name
```

### Connection Issues

If the bot connects but doesn't respond, check the logs for any WhatsApp connection errors:

```bash
heroku logs --tail -a your-whatsapp-bot-name
```

### Container Issues

If you encounter Docker-related issues:

```bash
# Verify the stack is set correctly
heroku stack -a your-whatsapp-bot-name

# Restart the container
heroku dyno:restart -a your-whatsapp-bot-name
```

## Updating the Bot

When you want to update the bot:

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

## Advanced: Scaling and Monitoring

### Scale for Better Performance

```bash
# Upgrade to a standard dyno for better performance
heroku ps:scale web=1:standard -a your-whatsapp-bot-name
```

### Add Persistent Storage (if needed)

```bash
# Add PostgreSQL add-on for persistent data
heroku addons:create heroku-postgresql:hobby-dev -a your-whatsapp-bot-name
```

### Set Up Monitoring

```bash
# Add New Relic for monitoring
heroku addons:create newrelic:wayne -a your-whatsapp-bot-name
```

## Conclusion

Using Docker with Heroku solves the dependency issues that can occur with system libraries required by Node.js modules like canvas. This approach ensures all dependencies are properly installed in the container image.