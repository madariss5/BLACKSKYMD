/**
 * WhatsApp Bot Launcher - Heroku/Replit Optimized
 * This script helps launch the WhatsApp bot with proper environment detection
 */

// Environment detection
const isHeroku = process.env.NODE_ENV === 'production' || process.env.DYNO;
const isReplit = process.env.REPL_ID || process.env.REPL_SLUG;

// Port configuration
const port = process.env.PORT || 5000;

console.log(`Starting WhatsApp Bot in ${isHeroku ? 'Heroku' : isReplit ? 'Replit' : 'local'} environment...`);
console.log(`Launching server with web interface on port ${port}...`);

// Setup keep-alive for Heroku if enabled
if (isHeroku && process.env.KEEP_ALIVE !== 'false') {
  const appName = process.env.HEROKU_APP_NAME;
  const interval = parseInt(process.env.KEEP_ALIVE_INTERVAL || '20', 10);
  
  if (appName) {
    console.log(`Setting up keep-alive ping for ${appName} every ${interval} minutes`);
    setInterval(() => {
      console.log(`[${new Date().toISOString()}] Sending keep-alive ping...`);
      require('https').get(`https://${appName}.herokuapp.com/`);
    }, interval * 60 * 1000);
  } else {
    console.warn('HEROKU_APP_NAME not set, skipping keep-alive pings');
  }
}

// Start appropriate server based on environment
if (isHeroku) {
  require('./bot-handler.js');
} else if (isReplit) {
  require('./replit-qr.js');
} else {
  require('./compatible-qr.js');
}