# Running BLACKSKY-MD 24/7 in Cloud Environments

This guide provides instructions for keeping your WhatsApp bot running continuously in cloud environments such as Replit, Heroku, and others.

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Replit Setup](#replit-setup)
3. [Heroku Setup](#heroku-setup)
4. [Keep-Alive Strategies](#keep-alive-strategies)
5. [Dealing with Connection Issues](#dealing-with-connection-issues)
6. [Automated Recovery](#automated-recovery)

## Prerequisites

Before setting up your 24/7 deployment, make sure:
- You have successfully connected to WhatsApp at least once
- Your bot code is functioning correctly
- You understand the platform limitations of your chosen cloud provider

## Replit Setup

Replit will automatically shutdown your project after a period of inactivity. Here's how to keep it running:

### 1. Use the Advanced Connection Manager

Always use the `connection-manager.js` script for the most reliable connection in Replit:

```bash
node connection-manager.js
```

### 2. Set Up a Keep-Alive Endpoint

Our code already includes a simple HTTP server that responds to pings. You just need to set up a service to ping it regularly:

#### Option A: UptimeRobot (Recommended)
1. Create a free account at [UptimeRobot](https://uptimerobot.com/)
2. Add a new monitor of type "HTTP(s)"
3. Enter your Replit URL: `https://your-repl-name.your-username.repl.co`
4. Set the monitoring interval to 5 minutes
5. Save the monitor

#### Option B: Use a Pinger Service
Various free services can ping your Replit URL at regular intervals:
- [Cron-job.org](https://cron-job.org)
- [Kaffeine](https://kaffeine.herokuapp.com/) (for Heroku)
- [New Relic](https://newrelic.com/) (more advanced)

### 3. Persistent Storage for Sessions

Replit has persistent storage, but it's good practice to back up your authentication data:

```javascript
// Backup authentication files periodically
const backupInterval = setInterval(() => {
  // Copy auth files to a persistent location
  try {
    fs.copyFileSync('./auth_info_baileys/creds.json', './backups/creds.json');
    console.log('Authentication data backed up successfully');
  } catch (err) {
    console.error('Failed to backup authentication data:', err);
  }
}, 1000 * 60 * 60); // Every hour
```

## Heroku Setup

Heroku has different challenges because its filesystem is ephemeral (files are lost between restarts).

### 1. Use Environment Variables

Store sensitive information in environment variables instead of files:

```bash
heroku config:set BOT_OWNER="your-number@s.whatsapp.net"
```

### 2. Persistent Storage Solutions

Use a database or external storage for persistent data:
- Heroku Postgres (Free tier available)
- MongoDB Atlas (Free tier available)
- Amazon S3 (Low-cost storage)

Example implementation for session storage with Postgres:
```javascript
// Store credentials in database instead of files
async function saveCredsToDatabase(creds) {
  const credString = JSON.stringify(creds);
  await db.query('UPDATE auth_data SET creds = $1 WHERE id = 1', [credString]);
}

async function getCredsFromDatabase() {
  const result = await db.query('SELECT creds FROM auth_data WHERE id = 1');
  if (result.rows.length > 0 && result.rows[0].creds) {
    return JSON.parse(result.rows[0].creds);
  }
  return null;
}
```

### 3. Procfile Configuration

Create a Procfile in your project root with:
```
worker: node connection-manager.js
```

## Keep-Alive Strategies

### 1. Regular Self-Pinging

Have your bot ping itself periodically:

```javascript
// Self-ping every 20 minutes to avoid idle timeouts
setInterval(() => {
  fetch('https://your-app-name.herokuapp.com/')
    .then(() => console.log('Self-ping successful'))
    .catch(err => console.error('Self-ping failed:', err));
}, 1000 * 60 * 20);
```

### 2. Prevent Sleeping with Worker Dynos (Heroku)

Use worker dynos instead of web dynos on Heroku to avoid sleeping:
```
heroku ps:scale web=0 worker=1
```

### 3. Keep Database Connections Alive

For database-backed applications, implement connection pooling with keep-alive:

```javascript
const pool = new Pool({
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
  max: 20
});

// Periodically execute a simple query to keep connection alive
setInterval(async () => {
  try {
    await pool.query('SELECT NOW()');
    console.log('Database connection refreshed');
  } catch (err) {
    console.error('Failed to refresh database connection:', err);
  }
}, 1000 * 60 * 5); // Every 5 minutes
```

## Dealing with Connection Issues

### 1. Automatic Reconnection

Our connection manager already implements sophisticated reconnection strategies, but you can enhance it:

```javascript
// In your connection code
const maxReconnectAttempts = 10;
let reconnectCount = 0;

function handleDisconnect(reason) {
  if (reconnectCount < maxReconnectAttempts) {
    const delay = Math.min(1000 * (reconnectCount + 1), 10000);
    console.log(`Reconnecting in ${delay/1000} seconds...`);
    setTimeout(connectToWhatsApp, delay);
    reconnectCount++;
  } else {
    console.log('Maximum reconnection attempts reached. Restarting application...');
    process.exit(1); // Let the platform restart the application
  }
}
```

### 2. Monitor Health with External Services

Set up external monitoring to alert you of issues:
- UptimeRobot alerts
- New Relic monitoring
- Custom status page

### 3. Anti-Ban Measures

Avoid getting banned by WhatsApp:
- Implement rate limiting for message sending
- Avoid spamming or automated messaging to unknown numbers
- Follow WhatsApp's terms of service

## Automated Recovery

### 1. Implement Health Checks

Create a health check endpoint that verification services can use:

```javascript
app.get('/health', (req, res) => {
  if (isConnected) {
    res.status(200).send('OK');
  } else {
    res.status(500).send('Not connected to WhatsApp');
  }
});
```

### 2. Auto-Restart on Failure

Configure your platform to restart on crashes:

For Heroku, this is automatic for crashed processes.

For Replit, you can use:
```bash
npm install forever
npx forever start connection-manager.js
```

### 3. Log Analytics

Implement comprehensive logging to diagnose issues:

```javascript
// Advanced logging with timestamp and log levels
function logger(message, level = 'info') {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
  
  console.log(logEntry);
  
  // Optionally write to file
  fs.appendFileSync('./logs/bot.log', logEntry + '\n');
  
  // For critical errors, you might want to trigger notifications
  if (level === 'critical') {
    // Send email, SMS, or other notification
  }
}
```

## Conclusion

By following these strategies, your BLACKSKY-MD WhatsApp bot should run continuously in most cloud environments. Remember that different platforms have different constraints, so adapt these recommendations to your specific needs.

For platform-specific questions or advanced deployments, refer to your cloud provider's documentation.