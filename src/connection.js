const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const path = require('path');
const fs = require('fs');
const fsPromises = fs.promises;

// Only keep essential handlers
const { messageHandler } = require('./handlers/messageHandler');
const { handleGroupMessage } = require('./handlers/groupMessageHandler');

let sock = null;

async function startConnection() {
    try {
        // Clean start
        console.clear();
        console.log('Starting WhatsApp connection...\n');

        // Set up fresh auth state
        const authDir = path.join(process.cwd(), 'auth_info');
        if (fs.existsSync(authDir)) {
            await fsPromises.rm(authDir, { recursive: true, force: true });
        }
        await fsPromises.mkdir(authDir);

        // Initialize state
        const { state, saveCreds } = await useMultiFileAuthState(authDir);

        // Create socket with minimal config
        sock = makeWASocket({
            auth: state,
            printQRInTerminal: true,
            // Use legacy version to avoid noise handler issues
            version: [2, 2308, 7]
        });

        // Basic event handling
        sock.ev.process(async (events) => {
            if (events['connection.update']) {
                const update = events['connection.update'];
                const { connection, lastDisconnect } = update;

                if (connection === 'open') {
                    console.log('\nConnected to WhatsApp!\n');
                }

                if (connection === 'close') {
                    const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
                    if (shouldReconnect) {
                        startConnection();
                    }
                }
            }

            // Save credentials when updated
            if (events['creds.update']) {
                await saveCreds();
            }

            // Handle messages only when needed
            if (events['messages.upsert']) {
                const upsert = events['messages.upsert'];
                if (upsert.type === 'notify') {
                    for (const msg of upsert.messages) {
                        if (!msg.message) continue;
                        const isGroup = msg.key.remoteJid?.endsWith('@g.us');
                        if (isGroup) {
                            await handleGroupMessage(sock, msg);
                        }
                        await messageHandler(sock, msg);
                    }
                }
            }
        });

        return sock;
    } catch (err) {
        console.error('Connection error:', err);
        setTimeout(startConnection, 3000);
    }
}

module.exports = { startConnection };