const logger = require('../utils/logger');

const basicCommands = {
    async help(sock, sender) {
        const helpText = `
Available Commands:
1. Basic Commands:
   !help - Show this help message
   !ping - Check bot status
   !info - Get bot information
   !menu - Show all commands menu
   !owner - Show bot owner info
   !runtime - Show bot uptime
   !speed - Test bot response speed
   !status - Show bot status
   !donate - Support bot development

2. Group Commands:
   !kick @user - Kick user from group
   !promote @user - Promote user to admin
   !demote @user - Demote user from admin
   !everyone - Tag all members
   !groupinfo - Show group information

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
    },

    async runtime(sock, sender) {
        const uptime = process.uptime();
        const hours = Math.floor(uptime / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        const seconds = Math.floor(uptime % 60);

        await sock.sendMessage(sender, { 
            text: `Bot Runtime: ${hours}h ${minutes}m ${seconds}s` 
        });
    },

    async speed(sock, sender) {
        const start = Date.now();
        await sock.sendMessage(sender, { text: 'Testing speed...' });
        const end = Date.now();
        const speed = end - start;

        await sock.sendMessage(sender, { 
            text: `Speed Test Results:\nResponse Time: ${speed}ms` 
        });
    },

    async status(sock, sender) {
        const status = {
            cpu: process.cpuUsage(),
            memory: process.memoryUsage(),
            uptime: process.uptime()
        };

        const statusText = `
Bot Status:
CPU Usage: ${Math.round(status.cpu.user / 1000000)}%
Memory: ${Math.round(status.memory.heapUsed / 1024 / 1024)}MB / ${Math.round(status.memory.heapTotal / 1024 / 1024)}MB
Uptime: ${Math.floor(status.uptime / 3600)}h ${Math.floor((status.uptime % 3600) / 60)}m
        `.trim();

        await sock.sendMessage(sender, { text: statusText });
    },

    async owner(sock, sender) {
        // Replace with actual owner info
        await sock.sendMessage(sender, { 
            text: 'Bot Owner:\nName: Owner\nContact: wa.me/1234567890' 
        });
    },

    async menu(sock, sender) {
        const menu = `
📚 *COMMAND MENU* 📚

1️⃣ *Basic Commands*
   • !help - Show help message
   • !ping - Check bot status
   • !info - Bot information
   • !menu - Show this menu
   • !owner - Show owner info

2️⃣ *Group Commands*
   • !kick - Kick member
   • !add - Add member
   • !promote - Promote member
   • !demote - Demote member
   • !groupinfo - Group info

3️⃣ *Fun Commands*
   • !quote - Random quote
   • !joke - Random joke
   • !meme - Random meme
   • !game - Play games

4️⃣ *Media Commands*
   • !sticker - Create sticker
   • !image - Search image
   • !youtube - Download YT

5️⃣ *Utility Commands*
   • !weather - Check weather
   • !translate - Translate text
   • !calculate - Calculator

6️⃣ *Owner Commands*
   • !broadcast - Send broadcast
   • !ban - Ban user
   • !unban - Unban user

Type !help [command] for details
        `.trim();

        await sock.sendMessage(sender, { text: menu });
    },

    async donate(sock, sender) {
        const donateText = `
Support Bot Development! 🙏

Your support helps keep the bot running and improving!

Payment Methods:
• PayPal: example@email.com
• Ko-fi: ko-fi.com/botname
• GitHub Sponsors: github.com/sponsor/botname

Thank you for your support! ❤️
        `.trim();

        await sock.sendMessage(sender, { text: donateText });
    }
};

module.exports = basicCommands;