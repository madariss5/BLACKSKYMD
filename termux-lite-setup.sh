#!/data/data/com.termux/files/usr/bin/bash
# Ultra-Minimal Termux Setup for WhatsApp Bot
# Designed for maximum compatibility with Termux limitations

echo "🤖 BLACKSKY-MD Ultra-Lite Termux Installer 🤖"
echo "=============================================="

# Set strict error handling
set -e

# Check if running in Termux
if [ ! -d "/data/data/com.termux" ]; then
  echo "⚠️  This script is designed to run in Termux only!"
  exit 1
fi

echo "📦 Step 1: Installing base packages..."
pkg update -y
pkg install -y nodejs git wget

echo "📱 Step 2: Setting up directories..."
mkdir -p node_modules
mkdir -p src/handlers
mkdir -p src/commands
mkdir -p src/utils/polyfills
mkdir -p auth_info_baileys
mkdir -p data

echo "📄 Step 3: Creating minimal connection script..."
cat > src/termux-min-connection.js << 'EOL'
/**
 * Ultra-Minimal Termux WhatsApp Connection Script
 * Designed for maximum compatibility on Android Termux environment
 */

// Require the minimal necessary packages
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const fs = require('fs');
const qrcode = require('qrcode-terminal');

// Folder to store auth data
const AUTH_FOLDER = './auth_info_baileys';

// Ensure auth folder exists
if (!fs.existsSync(AUTH_FOLDER)) {
    fs.mkdirSync(AUTH_FOLDER, { recursive: true });
}

// Functions to handle missing dependencies
function fakeCacheableStore(keys) {
    return {
        get: (key) => keys[key],
        set: (key, val) => keys[key] = val
    };
}

// Connection function
async function connectToWhatsApp() {
    console.log('Starting WhatsApp connection in ultra-lite Termux mode...');
    
    try {
        // Load state
        const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER);
        
        // Create socket with minimal options
        const sock = makeWASocket({
            printQRInTerminal: true,
            browser: ['BLACKSKY-MD', 'Termux-Lite', '1.0.0'],
            auth: {
                creds: state.creds,
                keys: fakeCacheableStore(state.keys)
            },
            // Disable all advanced features for maximum compatibility
            getMessage: async () => undefined
        });
        
        // Handle connection events
        sock.ev.on('connection.update', (update) => {
            const { connection, lastDisconnect, qr } = update;
            
            if (qr) {
                console.log('Scan this QR code in WhatsApp:');
                qrcode.generate(qr, { small: true });
            }
            
            if (connection === 'close') {
                const reason = lastDisconnect?.error?.output?.statusCode;
                console.log('Connection closed due to:', reason || 'unknown reason');
                
                if (reason !== DisconnectReason.loggedOut) {
                    console.log('Reconnecting...');
                    setTimeout(connectToWhatsApp, 3000);
                } else {
                    console.log('Logged out. Please restart the application.');
                    // Remove auth to allow new login
                    try {
                        fs.rmdirSync(AUTH_FOLDER, { recursive: true });
                    } catch (err) {
                        console.error('Failed to remove auth folder:', err);
                    }
                }
            }
            
            if (connection === 'open') {
                console.log('Connected successfully!');
                console.log('Your bot is now running in Termux ultra-lite mode.');
                console.log('Commands are limited but the connection is stable.');
            }
        });
        
        // Save credentials
        sock.ev.on('creds.update', saveCreds);
        
        // Minimal message handler
        sock.ev.on('messages.upsert', async ({ messages }) => {
            if (!messages[0]) return;
            
            const m = messages[0];
            if (m.key.fromMe) return;
            
            try {
                const text = m.message?.conversation || m.message?.extendedTextMessage?.text || '';
                
                if (text.startsWith('!')) {
                    const [command, ...args] = text.slice(1).split(' ');
                    const jid = m.key.remoteJid;
                    
                    // Basic command handling
                    if (command === 'ping') {
                        await sock.sendMessage(jid, { text: 'Pong! Bot is running in Termux ultra-lite mode.' });
                    } else if (command === 'help') {
                        await sock.sendMessage(jid, { 
                            text: 'BLACKSKY-MD Bot\n\nRunning in Termux ultra-lite mode\nPrefix: !\n\n' +
                                 'Available Commands:\n' +
                                 '!ping - Check if bot is running\n' +
                                 '!help - Show this help message\n' +
                                 '!info - Show bot information\n'
                        });
                    } else if (command === 'info') {
                        await sock.sendMessage(jid, { 
                            text: 'BLACKSKY-MD Bot\nVersion: 1.0.0 (Termux Ultra-Lite)\n' +
                                  'Running on Termux for Android\n' +
                                  'Node.js: ' + process.version
                        });
                    }
                }
            } catch (err) {
                console.error('Error in message handler:', err);
            }
        });
        
    } catch (err) {
        console.error('Failed to connect:', err);
        setTimeout(connectToWhatsApp, 5000);
    }
}

// Start the bot
connectToWhatsApp();
EOL

echo "📔 Step 4: Creating minimal package.json..."
cat > package.json << 'EOL'
{
  "name": "blacksky-md-termux-lite",
  "version": "1.0.0",
  "description": "Ultra-Minimal WhatsApp Bot for Termux",
  "main": "src/termux-min-connection.js",
  "scripts": {
    "start": "node src/termux-min-connection.js"
  },
  "dependencies": {
    "@whiskeysockets/baileys": "^6.5.0",
    "qrcode-terminal": "^0.12.0"
  }
}
EOL

echo "📦 Step 5: Installing core dependencies..."
npm install --no-optional || {
  echo "❌ Standard install failed, trying alternative approach..."
  rm -rf node_modules
  npm install @whiskeysockets/baileys qrcode-terminal --no-optional
}

echo "📜 Step 6: Creating run script..."
cat > start-bot.sh << 'EOL'
#!/data/data/com.termux/files/usr/bin/bash
node src/termux-min-connection.js
EOL
chmod +x start-bot.sh

echo "🔄 Step 7: Creating restart script..."
cat > restart-bot.sh << 'EOL'
#!/data/data/com.termux/files/usr/bin/bash
pkill -f "node src/termux-min-connection.js" || true
sleep 1
nohup node src/termux-min-connection.js > bot.log 2>&1 &
echo "Bot restarted in background. Check bot.log for output."
EOL
chmod +x restart-bot.sh

echo "📋 Step 8: Creating background script..."
cat > background-bot.sh << 'EOL'
#!/data/data/com.termux/files/usr/bin/bash
nohup node src/termux-min-connection.js > bot.log 2>&1 &
echo "Bot started in background. Check bot.log for output."
EOL
chmod +x background-bot.sh

echo "✅ Installation Complete!"
echo "=============================================="
echo "To start the bot in the foreground: ./start-bot.sh"
echo "To start the bot in the background: ./background-bot.sh"
echo "To restart the bot: ./restart-bot.sh"
echo ""
echo "This ultra-lite version is designed for maximum"
echo "compatibility with Termux's limitations."
echo "It provides basic commands only, but with a stable connection."
echo "=============================================="