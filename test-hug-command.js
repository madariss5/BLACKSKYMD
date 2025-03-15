/**
 * Test Hug Command
 * This script tests the hug command in the reactions module
 */

const { default: makeWASocket, DisconnectReason } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');

async function connectAndSendMessage() {
  // Load auth info from Safari Connect session
  const authFolder = './auth_info_safari';
  
  if (!fs.existsSync(path.join(authFolder, 'creds.json'))) {
    console.log('Auth info not found. Make sure Safari Connect is running.');
    return;
  }
  
  // Use the auth state
  const { state, saveCreds } = {
    state: {
      creds: JSON.parse(fs.readFileSync(path.join(authFolder, 'creds.json'))),
      keys: {}
    },
    saveCreds: async () => {}
  };

  // Create a socket connection
  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true,
    browser: ['Test Script', 'Chrome', '10.0.0']
  });

  // Set up connection event handler
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect } = update;
    
    if (connection === 'open') {
      console.log('Connected successfully!');
      
      // Send a test message
      console.log('Sending test hug command...');
      try {
        await sock.sendMessage(sock.user.id, { text: '!hug' });
        console.log('Message sent successfully!');
      } catch (err) {
        console.error('Error sending message:', err);
      }
      
      // Give some time for the message to be processed
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Disconnect
      await sock.logout();
      console.log('Test completed.');
      process.exit(0);
    } else if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      console.log(`Connection closed with status code: ${statusCode}`);
      process.exit(1);
    }
  });
}

connectAndSendMessage().catch(console.error);