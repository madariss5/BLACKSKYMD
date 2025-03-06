const logger = require('../utils/logger');

const basicCommands = {
    async help(sock, sender) {
        const helpText = `
Available Commands:
1. Basic Commands:
   !help - Show this help message
   !ping - Check bot status
   !info - Get bot information

2. Group Commands:
   !kick @user - Kick user from group
   !promote @user - Promote user to admin
   !demote @user - Demote user from admin

3. Fun Commands:
   !quote - Get random quote
   !joke - Get random joke
   !meme - Get random meme

4. Utility Commands:
   !weather [city] - Get weather info
   !translate [text] - Translate text
   !calculate [expression] - Calculate expression

Type !help [command] for more info about a command
        `.trim();
        
        await sock.sendMessage(sender, { text: helpText });
    },

    async ping(sock, sender) {
        const start = Date.now();
        await sock.sendMessage(sender, { text: 'Pong! 🏓' });
        const ping = Date.now() - start;
        await sock.sendMessage(sender, { text: `Latency: ${ping}ms` });
    },

    async info(sock, sender) {
        const info = `
WhatsApp Bot
Version: 1.0.0
Status: Online
Library: @whiskeysockets/baileys
Node Version: ${process.version}
Uptime: ${Math.floor(process.uptime())} seconds
        `.trim();
        
        await sock.sendMessage(sender, { text: info });
    }
};

module.exports = basicCommands;
