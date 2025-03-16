# Deploying WhatsApp Bot to Heroku with Docker

This guide explains how to use Docker containers to deploy the WhatsApp bot to Heroku. This approach helps resolve dependency issues with libraries like canvas, chart.js, and ffmpeg that require native system dependencies.

## Prerequisites

1. [Heroku account](https://signup.heroku.com/)
2. [Heroku CLI](https://devcenter.heroku.com/articles/heroku-cli) installed
3. [Docker](https://www.docker.com/products/docker-desktop) installed locally (optional, only needed for local testing)
4. [Git](https://git-scm.com/) installed
5. Local WhatsApp connection already established (via `local-connect.js`)

## Step 1: Set Up Heroku Container Registry

```bash
# Login to Heroku
heroku login

# Create a new Heroku app
heroku create your-whatsapp-bot-name

# Set the stack to container
heroku stack:set container -a your-whatsapp-bot-name
```

## Step 2: Configure Environment Variables

Set up your necessary environment variables:

```bash
# Set your admin number
heroku config:set ADMIN_NUMBER=1234567890 -a your-whatsapp-bot-name
```

### Authentication Setup

You have two options for authentication:

#### Option 1: Using CREDS_JSON Environment Variable (Recommended)

1. Find your `creds.json` file in the `auth_info_baileys` folder (created when you ran `local-connect.js`)
2. Copy the entire contents
3. Set it as an environment variable:

```bash
heroku config:set CREDS_JSON='{"clientID":"your-content-here",...}' -a your-whatsapp-bot-name
```

#### Option 2: Mounting Authentication Files During Build

1. If the CREDS_JSON approach doesn't work, you can still use SSH to access your Heroku dyno after deployment and manually set up authentication files.

## Step 3: Understanding the Dockerfile

The project includes a pre-configured Dockerfile that:

1. Uses Node.js as the base image
2. Installs system dependencies required by canvas and other modules
3. Copies the application code
4. Installs Node.js dependencies
5. Sets up a proper entrypoint to run the bot

```dockerfile
FROM node:18

# Install dependencies for canvas and other modules
RUN apt-get update && apt-get install -y \
    build-essential \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    ffmpeg \
    python3 \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the application
COPY . .

# Create directories for auth files if they don't exist
RUN mkdir -p auth_info_baileys auth_info_heroku

# Set environment variables
ENV NODE_ENV=production

# This will be used by heroku-bot.js
CMD ["node", "heroku-bot.js"]
```

## Step 4: Understanding heroku.yml

The `heroku.yml` file tells Heroku how to build and run the Docker container:

```yaml
build:
  docker:
    web: Dockerfile
run:
  web: node heroku-bot.js
```

## Step 5: Deploy to Heroku

```bash
# Initialize Git if not already done
git init

# Add Heroku as a remote
git remote add heroku https://git.heroku.com/your-whatsapp-bot-name.git

# Add files to Git
git add .
git commit -m "Initial commit for Heroku Docker deployment"

# Push to Heroku
git push heroku main
```

## Step 6: Verify Deployment

Watch the build logs:

```bash
heroku logs --tail -a your-whatsapp-bot-name
```

You should see Docker building the image, installing dependencies, and starting the bot.

## Step 7: Accessing the Web Interface

Once deployed, you can access the web interface at:

```
https://your-whatsapp-bot-name.herokuapp.com/
```

## Troubleshooting

### Build Failures

If the build fails:

1. Check Heroku build logs:
   ```bash
   heroku builds:info -a your-whatsapp-bot-name
   ```

2. For more detailed logs:
   ```bash
   heroku builds:output -a your-whatsapp-bot-name
   ```

### Connection Issues

If the bot connects but doesn't respond to commands:

1. Check application logs:
   ```bash
   heroku logs --tail -a your-whatsapp-bot-name
   ```

2. You might see "Connection Failure (Code: 405)" errors, which are common when connecting from cloud environments. In this case:
   - Make sure you've properly set up authentication using one of the methods described above
   - Try using the CREDS_JSON environment variable approach if you haven't already

### Canvas/Chart.js Issues

If you're still experiencing issues with canvas-related functionality:

1. Verify Docker is properly installing all dependencies:
   ```bash
   heroku run bash -a your-whatsapp-bot-name
   apt list --installed | grep cairo
   apt list --installed | grep pango
   ```

2. You can test canvas functionality:
   ```bash
   heroku run node -e "const { createCanvas } = require('canvas'); const canvas = createCanvas(200, 200); console.log('Canvas created successfully');" -a your-whatsapp-bot-name
   ```

## Advanced Configuration

### Custom Memory Allocation

If your bot needs more memory:

```bash
heroku dyno:resize performance-m -a your-whatsapp-bot-name
```

### Setting Up Auto-Restart

For enhanced reliability, you can use the Heroku Scheduler add-on to periodically restart your bot:

```bash
# First, install the scheduler add-on
heroku addons:create scheduler:standard -a your-whatsapp-bot-name

# Then, set up a job via the Heroku Dashboard to run:
heroku dyno:restart -a your-whatsapp-bot-name
```

## Best Practices

1. **Resource Management**: Monitor your Heroku resource usage, especially if using the free tier
2. **Keep Dependencies Updated**: Regularly update your Node.js dependencies for security
3. **Backup Authentication**: Always keep backups of your authentication files
4. **Log Monitoring**: Regularly check logs for unexpected errors or behaviors
5. **Auto-Redeploy**: Consider setting up GitHub integration for auto-deployment on code changes

## Conclusion

Using Docker with Heroku provides a consistent deployment environment that properly handles all system dependencies required by the WhatsApp bot, especially for modules like canvas and ffmpeg.

This approach is particularly useful if you're experiencing dependency-related issues with the standard Heroku Node.js buildpack.