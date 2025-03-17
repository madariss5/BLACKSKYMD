/**
 * BLACKSKY-MD High Performance WhatsApp Bot
 * Main Entry Point
 */

const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const fs = require('fs');
const path = require('path');
const pino = require('pino');
const QRCode = require('qrcode');
const logger = require('./src/utils/logger');
const { safeSendText } = require('./src/utils/jidHelper');

// Path for auth credentials
const AUTH_FOLDER = './auth_info_baileys';

// Logger configuration
const loggerOptions = {
  level: 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      translateTime: "SYS:standard",
      ignore: "hostname,pid"
    }
  }
};

// Create the required directories
function ensureDirectoriesExist() {
  const directories = [
    './data',
    './data/translations',
    './data/reaction_gifs',
    AUTH_FOLDER
  ];
  
  for (const dir of directories) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      logger.info(`Created directory: ${dir}`);
    }
  }
}

// Create a connection state manager
async function connectToWhatsApp() {
  ensureDirectoriesExist();
  
  logger.info('Starting WhatsApp connection...');
  
  // Load auth state
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER);
  
  // Socket configuration
  const sock = makeWASocket({
    printQRInTerminal: true,
    auth: state,
    logger: pino(loggerOptions),
    browser: ['WhatsApp-MD-Bot', 'Chrome', '4.0.0'],
    syncFullHistory: false,
    markOnlineOnConnect: true,
    defaultQueryTimeoutMs: 30000
  });
  
  // Connection events
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;
    
    if (qr) {
      // Generate and log QR code
      logger.info('QR code received, scan with WhatsApp to connect.');
      try {
        const qrString = await QRCode.toString(qr, {
          type: 'terminal',
          small: true
        });
        console.log(qrString);
      } catch (err) {
        logger.error('Failed to generate QR code:', err);
      }
    }
    
    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error instanceof Boom && 
                             lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut;
      
      logger.info(`Connection closed due to ${lastDisconnect.error}`);
      
      if (shouldReconnect) {
        logger.info('Reconnecting to WhatsApp...');
        setTimeout(connectToWhatsApp, 5000);
      } else {
        logger.error('Connection closed permanently. Logged out or authentication failed.');
      }
    } else if (connection === 'open') {
      logger.success('Connected to WhatsApp!');
    }
  });
  
  // Credentials update event
  sock.ev.on('creds.update', saveCreds);
  
  // Initialize command system (placeholder - will be implemented)
  const commands = {};
  let initialized = false;
  
  // Message handling
  sock.ev.on('messages.upsert', async ({ messages }) => {
    if (!messages || !messages[0]) return;
    
    const msg = messages[0];
    
    // Skip processing if not message create event
    if (msg.key?.remoteJid === 'status@broadcast' || !msg.message || msg.key.fromMe) {
      return;
    }
    
    // Initialize command handler once
    if (!initialized) {
      try {
        // Load command modules dynamically
        const commandsDir = path.join(__dirname, 'src', 'commands');
        
        if (fs.existsSync(commandsDir)) {
          const commandFiles = fs.readdirSync(commandsDir).filter(file => file.endsWith('.js'));
          
          for (const file of commandFiles) {
            try {
              const filePath = path.join(commandsDir, file);
              const module = require(filePath);
              
              if (module.commands && typeof module.commands === 'object') {
                // Register all commands from this module
                Object.assign(commands, module.commands);
                logger.info(`Loaded commands from ${file}`);
                
                // Initialize module if it has an init function
                if (typeof module.init === 'function') {
                  await module.init(sock);
                }
              }
            } catch (err) {
              logger.error(`Error loading command file ${file}:`, err);
            }
          }
        }
        
        initialized = true;
      } catch (err) {
        logger.error('Error initializing command handler:', err);
      }
    }
    
    // Process command if message starts with prefix
    const prefix = '!';
    const body = msg.message?.conversation || 
                  msg.message?.imageMessage?.caption || 
                  msg.message?.videoMessage?.caption || 
                  msg.message?.extendedTextMessage?.text || '';
    
    if (body.startsWith(prefix)) {
      const [cmd, ...args] = body.slice(prefix.length).trim().split(' ');
      
      if (commands[cmd]) {
        try {
          logger.info(`Executing command: ${cmd} with args: ${args.join(' ')}`);
          await commands[cmd](sock, msg, args);
        } catch (err) {
          logger.error(`Error executing command ${cmd}:`, err);
          await safeSendText(sock, msg.key.remoteJid, `Error executing command: ${cmd}`);
        }
      } else {
        logger.info(`Unknown command: ${cmd}`);
        await safeSendText(sock, msg.key.remoteJid, `Command not found: ${cmd}`);
      }
    }
  });
  
  return sock;
}

// Start the bot
connectToWhatsApp().catch(err => {
  logger.error('Error in main WhatsApp connection process:', err);
});