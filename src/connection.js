const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const path = require('path');
const fs = require('fs');
const fsPromises = fs.promises;
const pino = require('pino');

let sock = null;

async function startConnection() {
    try {
        console.clear();
        console.log("Starting WhatsApp connection...\n");

        const authDir = path.join(process.cwd(), 'auth_info');
        if (fs.existsSync(authDir)) {
            await fsPromises.rm(authDir, { recursive: true, force: true });
        }
        await fsPromises.mkdir(authDir);

        console.log('Creating new auth state...');
        const { state, saveCreds } = await useMultiFileAuthState(authDir);

        console.log('Initializing WhatsApp connection...');
        sock = makeWASocket({
            auth: state,
            printQRInTerminal: true,
            browser: ['Chrome (Linux)', '', ''],
            logger: pino({ level: 'silent' })
        });

        sock.ev.on('connection.update', (update) => {
            console.log('Connection update:', update);
            if(update.qr){
                console.log('\nQR Code received, attempting to display...\n');
                // Add extra newlines for spacing
                console.log('\n\n');
                qrcode.generate(update.qr, {small: false}, (qr) => {
                    console.log(qr);
                });
                // Add instructions
                console.log('\nScan this QR code with WhatsApp to connect\n');
            }
            if (update.connection === 'open') {
                console.log('\nConnected to WhatsApp!\n');
            }
            if(update.connection === 'close'){
                console.log('Connection closed. Reason:', update.reason);
                // Add more robust handling here based on DisconnectReason.
            }

        });


        sock.ev.on('creds.update', async () => {
            await saveCreds();
        });

        return sock;
    } catch (err) {
        console.error('Connection error:', err);
        throw err;
    }
}

module.exports = { startConnection };