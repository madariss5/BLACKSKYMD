# Hosting Your WhatsApp Bot on Heroku

This comprehensive guide walks you through the process of deploying your WhatsApp bot on Heroku for 24/7 operation with reliable uptime and efficient resource usage.

## Why Choose Heroku?

- **Easy Deployment**: Simple Git-based deployment
- **Free Tier Available**: Basic testing without cost
- **Flexible Scaling**: Easily upgrade as your bot grows
- **Managed Infrastructure**: No server maintenance
- **Add-ons Ecosystem**: Easy database integration

## Prerequisites

- A Heroku account ([signup](https://signup.heroku.com/))
- Git installed on your local machine
- Heroku CLI installed ([download](https://devcenter.heroku.com/articles/heroku-cli))
- Your WhatsApp bot code (from this repository)

## Step 1: Prepare Your Repository for Heroku

Heroku requires specific files to properly deploy your application. Let's create them.

### Procfile

Create a file named `Procfile` (no extension) in your project root:

```
web: node src/index.js
```

### package.json

Ensure your `package.json` has the correct Node.js version and start script:

```json
{
  "name": "whatsapp-bot",
  "version": "1.0.0",
  "description": "WhatsApp Multi-Device Bot",
  "main": "src/index.js",
  "scripts": {
    "start": "node src/index.js",
    "test": "echo \"Error: no test specified\" && exit 1"
  },
  "engines": {
    "node": "20.x"
  },
  "dependencies": {
    // Your dependencies here
  }
}
```

### app.json

Create an `app.json` file for Heroku Button support:

```json
{
  "name": "WhatsApp MD Bot",
  "description": "High-performance WhatsApp Multi-Device Bot",
  "repository": "https://github.com/yourusername/your-repo",
  "logo": "https://node-js-sample.herokuapp.com/node.png",
  "keywords": ["node", "whatsapp", "bot", "baileys"],
  "env": {
    "PREFIX": {
      "description": "Command prefix for the bot",
      "value": "!"
    },
    "OWNER_NUMBER": {
      "description": "Bot owner's WhatsApp number with country code",
      "value": ""
    }
  }
}
```

### .slugignore

Create a `.slugignore` file to exclude unnecessary files from deployment:

```
/.git
/node_modules
/.github
/docs
/*.md
/data/logs
/testing
```

## Step 2: Modify Your Code for Heroku Compatibility

Heroku assigns a dynamic port to your application, so modify your code to use the `PORT` environment variable:

```javascript
// In src/index.js or your server file
const PORT = process.env.PORT || 5000;

// If you have an Express server, update the listen call:
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

## Step 3: Session Storage Setup

Heroku uses an ephemeral filesystem that doesn't persist between deployments or when dynos restart. We need to set up a persistent storage solution.

### Option 1: Using Heroku Postgres

1. Install the PostgreSQL add-on:

```bash
heroku addons:create heroku-postgresql:hobby-dev
```

2. Install the necessary packages:

```bash
npm install pg sequelize
```

3. Create a database adapter in your project (e.g., `src/utils/sessionStoreAdapter.js`):

```javascript
const { Sequelize, DataTypes } = require('sequelize');
const fs = require('fs');
const path = require('path');

// Initialize Sequelize with PostgreSQL connection
const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  ssl: true,
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false
    }
  }
});

// Define session model
const Session = sequelize.define('Session', {
  id: {
    type: DataTypes.STRING,
    primaryKey: true
  },
  data: {
    type: DataTypes.TEXT
  }
});

// Create a custom store adapter
class PostgresSessionStore {
  constructor() {
    this.initialized = false;
  }

  async initialize() {
    await sequelize.sync();
    this.initialized = true;
    console.log('PostgreSQL session store initialized');
  }

  async sessionExists(id) {
    if (!this.initialized) await this.initialize();
    const session = await Session.findByPk(id);
    return !!session;
  }

  async loadSession(id) {
    if (!this.initialized) await this.initialize();
    const session = await Session.findByPk(id);
    if (session) {
      return JSON.parse(session.data);
    }
    return null;
  }

  async saveSession(id, data) {
    if (!this.initialized) await this.initialize();
    await Session.upsert({
      id,
      data: JSON.stringify(data)
    });
    return true;
  }

  async deleteSession(id) {
    if (!this.initialized) await this.initialize();
    await Session.destroy({ where: { id } });
    return true;
  }

  // Helper to migrate local auth files to database
  async migrateLocalSession() {
    if (!this.initialized) await this.initialize();
    
    const authDir = path.join(process.cwd(), 'auth_info_baileys');
    if (fs.existsSync(authDir)) {
      try {
        // Read creds.json
        const credsPath = path.join(authDir, 'creds.json');
        if (fs.existsSync(credsPath)) {
          const creds = JSON.parse(fs.readFileSync(credsPath, 'utf8'));
          await this.saveSession('creds', creds);
          console.log('Migrated creds.json to database');
        }
        
        // Process other files as needed
        // ...
        
        return true;
      } catch (error) {
        console.error('Error migrating session:', error);
        return false;
      }
    }
    return false;
  }
}

module.exports = new PostgresSessionStore();
```

4. Modify your bot's code to use this adapter:

```javascript
// In src/index.js
const sessionStore = require('./utils/sessionStoreAdapter');

// Then in your Baileys connection code
const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

// Change to:
let state, saveCreds;

// Check if running on Heroku
if (process.env.DATABASE_URL) {
  // Initialize custom store
  await sessionStore.initialize();
  
  // Try to migrate local session if it exists
  await sessionStore.migrateLocalSession();
  
  // Custom auth state for Heroku
  state = {
    creds: await sessionStore.loadSession('creds') || {},
    keys: {}
  };
  
  saveCreds = async () => {
    await sessionStore.saveSession('creds', state.creds);
  };
} else {
  // Local file-based auth for development
  const { state: localState, saveCreds: localSaveCreds } = 
    await useMultiFileAuthState('auth_info_baileys');
  state = localState;
  saveCreds = localSaveCreds;
}

// Use state and saveCreds with Baileys
const sock = makeWASocket({
  auth: state,
  // other options...
});
```

### Option 2: Using Heroku Redis

1. Add Redis to your Heroku app:

```bash
heroku addons:create heroku-redis:hobby-dev
```

2. Install the necessary packages:

```bash
npm install redis
```

3. Create a Redis adapter for session storage.

## Step 4: Set Up a QR Code Server for Authentication

Since Heroku doesn't provide direct terminal access, we need a web interface to scan the QR code:

```javascript
// In src/index.js or a separate file
const express = require('express');
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server);
const PORT = process.env.PORT || 5000;

// Serve static files
app.use(express.static('public'));

// Serve QR code page
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

// Socket.io connection for real-time QR updates
io.on('connection', (socket) => {
  console.log('Client connected for QR code');
  socket.emit('message', 'Waiting for QR code...');
  
  // Send QR code to client when available
  global.sendQR = (qr) => {
    socket.emit('qr', qr);
  };
});

// Start the server
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// In your WhatsApp connection code
sock.ev.on('connection.update', async (update) => {
  const { connection, lastDisconnect, qr } = update;
  
  if (qr) {
    // Send QR to web interface
    if (global.sendQR) {
      global.sendQR(qr);
    }
    console.log('QR code:', qr);
  }
  
  // Rest of your connection handling
});
```

Create a simple HTML page for QR scanning (in `public/index.html`):

```html
<!DOCTYPE html>
<html>
<head>
  <title>WhatsApp Bot QR Code</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: Arial, sans-serif;
      text-align: center;
      margin: 0;
      padding: 20px;
      background: #f5f5f5;
    }
    #qrcode {
      margin: 20px auto;
      padding: 20px;
      background: white;
      border-radius: 10px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      max-width: 300px;
    }
    #status {
      margin: 20px;
      padding: 10px;
      background: #e0f7fa;
      border-radius: 5px;
    }
    .success {
      background: #e8f5e9 !important;
      color: #2e7d32;
    }
    .error {
      background: #ffebee !important;
      color: #c62828;
    }
  </style>
</head>
<body>
  <h1>WhatsApp Bot QR Code</h1>
  <div id="status">Waiting for QR code...</div>
  <div id="qrcode"></div>
  
  <script src="/socket.io/socket.io.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js"></script>
  <script>
    const socket = io();
    const statusDiv = document.getElementById('status');
    const qrcodeDiv = document.getElementById('qrcode');
    
    socket.on('message', (msg) => {
      statusDiv.textContent = msg;
    });
    
    socket.on('qr', (qr) => {
      statusDiv.textContent = 'QR Code received! Scan with WhatsApp';
      
      // Generate QR code
      const typeNumber = 4;
      const errorCorrectionLevel = 'L';
      const qrcode = qrcode(typeNumber, errorCorrectionLevel);
      qrcode.addData(qr);
      qrcode.make();
      qrcodeDiv.innerHTML = qrcode.createImgTag(5);
    });
    
    socket.on('connected', () => {
      statusDiv.textContent = 'WhatsApp connected successfully!';
      statusDiv.className = 'success';
      qrcodeDiv.innerHTML = '<p>✅ Device connected successfully!</p>';
    });
    
    socket.on('error', (err) => {
      statusDiv.textContent = 'Error: ' + err;
      statusDiv.className = 'error';
    });
  </script>
</body>
</html>
```

## Step 5: Deploy to Heroku

Now you're ready to deploy your bot to Heroku:

```bash
# Login to Heroku CLI
heroku login

# Create a new Heroku app
heroku create your-whatsapp-bot-name

# Add Heroku as a remote repository
heroku git:remote -a your-whatsapp-bot-name

# Set environment variables
heroku config:set PREFIX=!
heroku config:set OWNER_NUMBER=your_number

# Configure PostgreSQL to accept SSL connections
heroku config:set PGSSLMODE=no-verify

# Push your code to Heroku
git push heroku main

# Scale your dyno to run the web process
heroku ps:scale web=1

# Check the logs
heroku logs --tail
```

## Step 6: Prevent Dyno Sleeping (Free Tier)

Heroku free dynos sleep after 30 minutes of inactivity. To keep your bot running:

1. Create a file `src/keepalive.js`:

```javascript
const axios = require('axios');
const APP_URL = process.env.APP_URL;

if (APP_URL) {
  setInterval(async () => {
    try {
      console.log('Sending keepalive request...');
      await axios.get(APP_URL);
    } catch (error) {
      console.error('Keepalive request failed:', error.message);
    }
  }, 25 * 60 * 1000); // Every 25 minutes
}
```

2. Import this in your main file:

```javascript
// In src/index.js
if (process.env.APP_URL) {
  require('./keepalive');
}
```

3. Set your app URL:

```bash
heroku config:set APP_URL=https://your-whatsapp-bot-name.herokuapp.com
```

## Step 7: Set Up Dyno Monitoring (Optional)

For better reliability, set up monitoring:

```bash
# Install the Heroku status add-on
heroku addons:create statuspage:hobby

# Enable log drains for better logging
heroku drains:add https://log-service.herokuapp.com/drain
```

## Step 8: Perform Initial Connection

1. Open your app URL in a browser:
```
https://your-whatsapp-bot-name.herokuapp.com/
```

2. Scan the QR code with WhatsApp.

3. After successful connection, your bot will remain connected as long as the dyno is running.

## Heroku Upgrade Options

### Free Tier Limitations
- 550 free dyno hours per month
- Sleeps after 30 minutes of inactivity
- Limited resources

### Recommended Paid Tiers
1. **Hobby Dyno ($7/month)**:
   - Never sleeps
   - Better performance
   - 1000 dyno hours per month

2. **Standard 1X ($25/month)**:
   - Production-ready performance
   - Horizontal scaling
   - Autoscaling capabilities
   - Ideal for bots serving multiple groups

### Add-ons Worth Considering
1. **Heroku Redis ($10/month)**:
   - Better session management
   - In-memory data storage
   - Faster response times

2. **Heroku Postgres ($9/month)**:
   - Reliable database for user data
   - Daily backups
   - 10M rows storage

## Troubleshooting

### Common Issues and Solutions

#### Issue: Bot disconnects frequently
Solution:
- Upgrade to Hobby or Standard-1X dyno
- Implement session persistence with Postgres or Redis
- Add reconnection logic in your code

#### Issue: QR code not appearing
Solution:
- Check Heroku logs: `heroku logs --tail`
- Ensure web process is running: `heroku ps`
- Verify port configuration

#### Issue: H12 - Request timeout
Solution:
- Move long-running tasks to background workers
- Implement async processing for heavy operations
- Optimize resource usage

#### Issue: R14 - Memory quota exceeded
Solution:
- Reduce memory usage with better garbage collection
- Implement memory leaks detection
- Consider upgrading to a larger dyno

## Advanced Heroku Configuration

### Worker Dynos

For better reliability, split your bot into separate processes:

```
# Updated Procfile
web: node src/qr-server.js
worker: node src/bot.js
```

Deploy and scale:

```bash
heroku ps:scale web=1 worker=1
```

### Auto-Scaling with Add-ons

```bash
# Install autoscaling add-on
heroku addons:create adept-scale:basic

# Configure scaling
heroku config:set ADEPT_SCALE_WORKER_MIN=1
heroku config:set ADEPT_SCALE_WORKER_MAX=2
```

### Heroku Scheduler for Maintenance

```bash
# Install scheduler
heroku addons:create scheduler:standard

# Add a task to restart the bot daily
# In the web interface, schedule: node src/maintenance.js
```

## Backup Strategy for Heroku

Create an automated backup system:

```javascript
// src/backup.js
const { exec } = require('child_process');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Create PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function backupSessions() {
  try {
    // Query all sessions
    const result = await pool.query('SELECT * FROM "Sessions"');
    
    // Create backup directory
    const backupDir = path.join(process.cwd(), 'backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    
    // Write backup file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(backupDir, `session_backup_${timestamp}.json`);
    fs.writeFileSync(backupFile, JSON.stringify(result.rows, null, 2));
    
    // Upload to cloud storage (optional)
    // Implement your preferred cloud storage solution here
    
    console.log(`Backup completed: ${backupFile}`);
    return true;
  } catch (error) {
    console.error('Backup failed:', error);
    return false;
  }
}

// Run backup
backupSessions().then(process.exit);
```

Schedule it with Heroku Scheduler.

## Conclusion

Heroku provides a reliable platform for hosting your WhatsApp bot with minimal configuration and maintenance. This guide has walked you through:

- Setting up your repository for Heroku deployment
- Configuring persistent session storage
- Creating a web interface for QR code scanning
- Deploying and managing your bot on Heroku
- Preventing dyno sleeping
- Troubleshooting common issues
- Advanced configuration options

For 24/7 operation with better reliability, we recommend upgrading to at least the Hobby dyno tier ($7/month) and implementing the session persistence solutions described in this guide.