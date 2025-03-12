const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const path = require('path');
const fs = require('fs');
const fsPromises = fs.promises;

let sock = null;

async function startConnection() {
    try {
        const authDir = path.join(process.cwd(), 'auth_info');
        if (fs.existsSync(authDir)) {
            await fsPromises.rm(authDir, { recursive: true, force: true });
        }
        await fsPromises.mkdir(authDir);

        const { state, saveCreds } = await useMultiFileAuthState(authDir);

        sock = makeWASocket({
            auth: state,
            printQRInTerminal: false,
            version: [2, 2308, 7]
        });

        sock.ev.process(async (events) => {
            if (events['connection.update']) {
                const update = events['connection.update'];
                const { qr } = update;
                if (qr) qrcode.generate(qr, { small: true });
            }

            if (events['creds.update']) await saveCreds();
        });

        return sock;
    } catch (err) {
        setTimeout(startConnection, 3000);
    }
}

module.exports = { startConnection };