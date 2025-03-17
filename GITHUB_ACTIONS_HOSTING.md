# Running Your WhatsApp Bot 24/7 on GitHub Actions (Free)

This unconventional guide demonstrates how to use GitHub Actions CI/CD platform to host your WhatsApp bot for free with nearly 24/7 uptime.

## Why Use GitHub Actions?

- **Completely Free**: Uses GitHub's free tier minutes (2,000 minutes/month)
- **No Server Management**: Zero infrastructure to maintain
- **Reliable Infrastructure**: Enterprise-grade GitHub infrastructure
- **Built-in CI/CD**: Automatic deployment on code changes
- **GitHub Integration**: Perfect for projects already hosted on GitHub

## How It Works

GitHub Actions allows you to run workflows triggered by various events. We'll create a workflow that:

1. Runs on a schedule (every 5 hours)
2. Starts the WhatsApp bot
3. Keeps it running for just under 5 hours
4. Saves the session state to GitHub Secrets
5. Repeats this process to achieve near 24/7 uptime

## Prerequisites

- GitHub account with a repository for your WhatsApp bot
- Basic understanding of GitHub Actions
- WhatsApp bot code adapted for ephemeral environments

## Step 1: Create Required Secrets

In your GitHub repository:

1. Go to Settings > Secrets and variables > Actions
2. Add the following repository secrets:
   - `SESSION_DATA`: Initially empty, will be populated automatically
   - `OWNER_NUMBER`: Your WhatsApp number
   - `BOT_PREFIX`: Command prefix (e.g., "!")
   - `GH_PAT`: A Personal Access Token with `repo` scope

## Step 2: Set Up Session Persistence

Create a utility module for session management (`session-manager.js`):

```javascript
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Directory for WhatsApp session data
const AUTH_DIR = path.join(process.cwd(), 'auth_info_baileys');

/**
 * Save session data to a Base64-encoded string
 * @returns {string} Base64-encoded session data
 */
function saveSessionToBase64() {
  try {
    // Create temp file for session data
    const tempFile = path.join(process.cwd(), 'session_data.tar.gz');
    
    // Create tar archive of auth directory if it exists
    if (fs.existsSync(AUTH_DIR)) {
      execSync(`tar -czf ${tempFile} -C ${process.cwd()} auth_info_baileys`);
      
      // Read and encode the file
      const fileData = fs.readFileSync(tempFile);
      const base64Data = fileData.toString('base64');
      
      // Cleanup
      fs.unlinkSync(tempFile);
      
      return base64Data;
    }
    
    return null;
  } catch (error) {
    console.error('Error saving session:', error);
    return null;
  }
}

/**
 * Restore session data from Base64-encoded string
 * @param {string} base64Data Base64-encoded session data
 * @returns {boolean} Success status
 */
function restoreSessionFromBase64(base64Data) {
  try {
    if (!base64Data) {
      console.log('No session data provided');
      return false;
    }
    
    // Create temp file for session data
    const tempFile = path.join(process.cwd(), 'session_data.tar.gz');
    
    // Write base64 data to file
    fs.writeFileSync(tempFile, Buffer.from(base64Data, 'base64'));
    
    // Extract the archive
    execSync(`tar -xzf ${tempFile} -C ${process.cwd()}`);
    
    // Cleanup
    fs.unlinkSync(tempFile);
    
    return true;
  } catch (error) {
    console.error('Error restoring session:', error);
    return false;
  }
}

module.exports = {
  saveSessionToBase64,
  restoreSessionFromBase64
};
```

## Step 3: Modify Your Bot for GitHub Actions

Add GitHub Actions specific code to your bot's `index.js`:

```javascript
// Add at the top of your file
const { saveSessionToBase64, restoreSessionFromBase64 } = require('./session-manager');

// Add the following to handle graceful shutdown and session saving
let shuttingDown = false;

// Set maximum runtime (just under 5 hours = 4h59m = 17940000ms)
const MAX_RUNTIME = 17940000;

// Save session periodically and before exit
async function saveSession() {
  console.log('Saving session data...');
  const sessionData = saveSessionToBase64();
  
  if (sessionData) {
    // In GitHub Actions, set output variable
    if (process.env.GITHUB_ACTIONS) {
      fs.appendFileSync(process.env.GITHUB_ENV, `SESSION_DATA=${sessionData}\n`);
      console.log('Session data saved to GitHub Environment');
    }
  }
}

// Set up periodic session saving (every 15 minutes)
const sessionSaveInterval = setInterval(saveSession, 15 * 60 * 1000);

// Set up graceful shutdown
process.on('SIGINT', async () => {
  if (shuttingDown) return;
  shuttingDown = true;
  
  console.log('Shutting down...');
  clearInterval(sessionSaveInterval);
  
  await saveSession();
  process.exit(0);
});

// Set up auto-shutdown timer for GitHub Actions
if (process.env.GITHUB_ACTIONS) {
  setTimeout(async () => {
    console.log(`Reached maximum runtime of ${MAX_RUNTIME}ms, shutting down...`);
    process.emit('SIGINT');
  }, MAX_RUNTIME);
}

// Add this after your WhatsApp initialization code
async function initializeBot() {
  // Restore session if running in GitHub Actions
  if (process.env.GITHUB_ACTIONS && process.env.SESSION_DATA) {
    console.log('Restoring session from GitHub Environment...');
    const success = restoreSessionFromBase64(process.env.SESSION_DATA);
    if (success) {
      console.log('Session restored successfully');
    } else {
      console.log('Failed to restore session, will create new session');
    }
  }
  
  // Initialize your WhatsApp connection here
  // ...
}

// Call the initialization function
initializeBot();
```

## Step 4: Create GitHub Actions Workflow

Create a file at `.github/workflows/bot-runner.yml`:

```yaml
name: Run WhatsApp Bot 24/7

on:
  schedule:
    # Run every 5 hours
    - cron: '0 */5 * * *'
  workflow_dispatch:  # Allow manual trigger

jobs:
  run-bot:
    runs-on: ubuntu-latest
    timeout-minutes: 300  # 5 hours max
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm install
      
      - name: Restore session data
        run: |
          if [ -n "${{ secrets.SESSION_DATA }}" ]; then
            echo "SESSION_DATA=${{ secrets.SESSION_DATA }}" >> $GITHUB_ENV
            echo "Session data found, will restore previous session"
          else
            echo "No session data found, will create new session"
          fi
      
      - name: Start WhatsApp bot
        env:
          BOT_PREFIX: ${{ secrets.BOT_PREFIX }}
          OWNER_NUMBER: ${{ secrets.OWNER_NUMBER }}
        run: |
          echo "Starting WhatsApp bot..."
          node src/index.js
      
      - name: Update session secret
        if: always()
        uses: gliech/create-github-secret-action@v1
        with:
          name: SESSION_DATA
          value: ${{ env.SESSION_DATA }}
          pa_token: ${{ secrets.GH_PAT }}
```

## Step 5: Create QR Code Server for First Login

For the initial connection, create a script to display the QR code (`qr-server.js`):

```javascript
const express = require('express');
const qrcode = require('qrcode');
const http = require('http');
const socketIo = require('socket.io');

// Setup express
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Serve static files
app.use(express.static('public'));

// Serve main page
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/qr.html');
});

// Socket connection
io.on('connection', (socket) => {
  console.log('Client connected');
  
  // If we already have a QR code
  if (global.latestQR) {
    socket.emit('qr', global.latestQR);
  }
});

// Create server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`QR server running on port ${PORT}`);
});

// Function to update QR code
async function updateQR(qrCode) {
  global.latestQR = qrCode;
  
  try {
    // Generate QR code image
    const qrImage = await qrcode.toDataURL(qrCode);
    io.emit('qr', qrImage);
    console.log('QR code updated');
  } catch (error) {
    console.error('Error generating QR code:', error);
  }
}

module.exports = { updateQR };
```

Create a simple HTML page (`public/qr.html`):

```html
<!DOCTYPE html>
<html>
<head>
  <title>WhatsApp Bot QR Code</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      text-align: center;
      margin: 0;
      padding: 20px;
    }
    #qrcode {
      margin: 20px auto;
      max-width: 300px;
    }
    #qrcode img {
      max-width: 100%;
    }
    .status {
      margin: 10px;
      padding: 10px;
      background: #f0f0f0;
      border-radius: 5px;
    }
  </style>
</head>
<body>
  <h1>WhatsApp Bot QR Code</h1>
  <div class="status" id="status">Waiting for QR code...</div>
  <div id="qrcode"></div>
  
  <script src="/socket.io/socket.io.js"></script>
  <script>
    const socket = io();
    const qrDiv = document.getElementById('qrcode');
    const statusDiv = document.getElementById('status');
    
    socket.on('qr', (qrImage) => {
      qrDiv.innerHTML = `<img src="${qrImage}" alt="QR Code">`;
      statusDiv.textContent = 'Scan this QR code with WhatsApp to connect';
    });
    
    socket.on('connected', () => {
      qrDiv.innerHTML = '<p>✅ Connected successfully!</p>';
      statusDiv.textContent = 'WhatsApp connected! You can close this page.';
      statusDiv.style.background = '#d4edda';
    });
  </script>
</body>
</html>
```

Modify your bot code to use the QR server in dev mode:

```javascript
// In your WhatsApp connection code
let qrServer;
if (!process.env.GITHUB_ACTIONS) {
  qrServer = require('./qr-server');
}

// In your connection event handler
sock.ev.on('connection.update', async (update) => {
  const { connection, lastDisconnect, qr } = update;
  
  if (qr) {
    // Display QR in console
    console.log('QR CODE:', qr);
    
    // Send to QR server in dev mode
    if (!process.env.GITHUB_ACTIONS && qrServer) {
      qrServer.updateQR(qr);
    }
  }
  
  // Rest of your connection code
});
```

## Step 6: Initial Setup

1. Push all these changes to your GitHub repository

2. For the first run, manually trigger the workflow:
   - Go to Actions tab in your repository
   - Select "Run WhatsApp Bot 24/7" workflow
   - Click "Run workflow"

3. For the initial QR scan, you need to:
   - Clone your repository locally
   - Install dependencies: `npm install`
   - Start the QR server: `node qr-server.js`
   - Open a browser to http://localhost:3000
   - Scan the QR code with WhatsApp

4. Once connected, the GitHub Action will save the session data

5. Subsequent workflow runs will automatically restore the session

## Step 7: Monitoring and Maintenance

### Check Action Logs

Regularly check your GitHub Actions logs:
1. Go to Actions tab in your repository
2. Click on the latest "Run WhatsApp Bot 24/7" workflow run
3. Examine the logs for any errors

### Handle Session Expiration

Sometimes WhatsApp sessions expire. When this happens:

1. Clear the `SESSION_DATA` secret:
   - Go to Settings > Secrets and variables > Actions
   - Delete the `SESSION_DATA` secret
   
2. Run the local QR server again to reconnect
3. After connecting, the workflow will save the new session

## Tips and Optimizations

### Minimizing GitHub Actions Minutes Usage

To get the most out of your free 2,000 minutes per month:

1. Keep your Docker image small:
   ```yaml
   runs-on: ubuntu-latest  # Use the smallest runner
   ```

2. Optimize Node.js memory usage:
   ```javascript
   // Add to your index.js
   const v8 = require('v8');
   v8.setFlagsFromString('--max_old_space_size=256');
   ```

3. Only install necessary dependencies:
   ```
   npm install --production
   ```

### Handling Network Issues

Add resilient reconnection logic to your bot:

```javascript
// In your WhatsApp connection code
let reconnectAttempts = 0;
const maxReconnectAttempts = 10;

sock.ev.on('connection.update', async (update) => {
  const { connection, lastDisconnect } = update;
  
  if (connection === 'close') {
    const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
    
    if (shouldReconnect && reconnectAttempts < maxReconnectAttempts) {
      reconnectAttempts++;
      console.log(`Connection closed. Reconnecting (${reconnectAttempts}/${maxReconnectAttempts})...`);
      startBot();
    } else if (reconnectAttempts >= maxReconnectAttempts) {
      console.log('Maximum reconnection attempts reached. Saving session and exiting.');
      await saveSession();
      process.exit(1); // Exit with error to trigger GitHub Actions retry
    }
  }
  
  if (connection === 'open') {
    reconnectAttempts = 0;
    console.log('Connection opened');
  }
});
```

### Using Multiple Repositories for Additional Minutes

If you need more than 2,000 minutes per month:

1. Create multiple repositories for your bot
2. Set up identical workflows in each
3. Schedule them to run at different times
4. Use the same session data across repositories

## Limitations and Considerations

While GitHub Actions provides a creative free solution, be aware of:

1. **Terms of Service**: Ensure you're not violating GitHub's terms, which prohibit using Actions purely for compute or as a service

2. **Reliability**: There might be brief gaps between workflow runs

3. **Runtime Limit**: Each workflow run has a maximum duration of 6 hours (we use slightly less)

4. **Monthly Limits**: Free tier has 2,000 minutes/month limit (could run out)

5. **Stability**: Not designed as a hosting platform, so future changes might affect this approach

## Conclusion

GitHub Actions provides a creative way to run your WhatsApp bot 24/7 without cost, leveraging the CI/CD platform for continuous operation. While not a conventional hosting solution, it works well for personal bots with moderate usage requirements and demonstrates the flexibility of GitHub's ecosystem.

This approach is best suited for:
- Personal projects with limited budget
- Bots with moderate message volume
- Users comfortable with GitHub workflows
- Temporary hosting while evaluating the bot

For production deployments with higher reliability requirements, consider the other hosting options covered in our main guides.