/**
 * Local WhatsApp Connection Script
 * 
 * This script is designed to be run on your local machine (not in Replit/Heroku)
 * It will help you establish a connection and provide credentials for your bot
 * 
 * SETUP INSTRUCTIONS:
 * 1. Save this file to your local computer
 * 2. Install Node.js if you don't have it already
 * 3. Run these commands in your terminal/command prompt:
 *    npm install @whiskeysockets/baileys qrcode-terminal fs
 * 4. Run: node local-connect.js
 * 5. Scan the QR code with your phone
 * 6. After successful connection, upload the auth_info_baileys folder to your Heroku project
 */

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const qrcode = require('qrcode-terminal');
const fs = require('fs');

const AUTH_FOLDER = './auth_info_baileys';

async function connectToWhatsApp() {
  // Create auth folder if it doesn't exist
  if (!fs.existsSync(AUTH_FOLDER)) {
    fs.mkdirSync(AUTH_FOLDER, { recursive: true });
    console.log(`Created auth folder: ${AUTH_FOLDER}`);
  }
  
  // Load authentication state
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER);
  
  // Socket configuration options for the best compatibility
  const socket = makeWASocket({
    printQRInTerminal: true,
    auth: state,
    browser: ['WhatsApp Local', 'Chrome', '111.0.5563.146'],
    connectTimeoutMs: 60000,
    markOnlineOnConnect: false,
    // Browser fingerprint options seem to work better from local machines
    // No need for special browser parameters that we use on cloud platforms
  });
  
  // Listen for auth updates
  socket.ev.on('creds.update', saveCreds);
  
  // Connection updates handling
  socket.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;
    
    // Display QR code in terminal
    if (qr) {
      console.log('\n\n========== SCAN QR CODE WITH YOUR PHONE ==========\n\n');
      qrcode.generate(qr, { small: true });
      console.log('\n\nQR Code expires in 20 seconds. Be quick!\n\n');
    }
    
    // Handle successful connection
    if (connection === 'open') {
      console.log('\n\n✅ CONNECTED SUCCESSFULLY!\n\n');
      console.log(`Your authentication credentials have been saved to: ${AUTH_FOLDER}`);
      console.log('\nIMPORTANT: Now upload the entire auth_info_baileys folder to your Heroku project.\n');
      console.log('Next steps:');
      console.log('1. Zip the auth_info_baileys folder');
      console.log('2. Deploy your bot to Heroku');
      console.log('3. Use "heroku ps:copy" to upload the zip file');
      console.log('4. Extract into the auth_info_heroku folder on Heroku');
      console.log('5. Restart your Heroku dyno with "heroku dyno:restart"\n');
    }
    
    // Handle disconnection
    if (connection === 'close') {
      const shouldReconnect = 
        (lastDisconnect.error instanceof Boom && 
         lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut);
      
      console.log('Connection closed due to ', lastDisconnect.error);
      
      if (shouldReconnect) {
        console.log('Reconnecting...');
        connectToWhatsApp();
      } else {
        console.log('Disconnected permanently, you need to re-scan the QR code.');
        console.log('Delete the auth_info_baileys folder and try again.');
      }
    }
  });
  
  // Return the socket
  return socket;
}

// Start the connection
connectToWhatsApp()
  .catch(err => console.log('Error starting connection:', err));