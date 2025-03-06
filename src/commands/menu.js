const { languageManager } = require('../utils/language');
const config = require('../config/config');
const logger = require('../utils/logger');

const menuCommands = {
    async menu(sock, message, args) {
        try {
            let menuText = `*${config.bot.name} - Command Menu*\n\n`;

            // Add bot info
            menuText += `*Bot Prefix:* ${config.bot.prefix}\n`;
            menuText += `*Language:* ${config.bot.language}\n\n`;

            // Add command categories
            const categories = {
                '📋 Basic': ['help', 'menu', 'ping', 'info'],
                '🎥 Media': ['sticker', 'toimg'],
                '👥 Group': ['kick', 'add', 'promote', 'demote'],
                '📚 Educational': ['define', 'translate', 'calculate'],
                '🛠 Utility': ['weather', 'currency', 'reminder']
            };

            // Add categories and commands
            for (const [category, commands] of Object.entries(categories)) {
                menuText += `${category}\n`;
                commands.forEach(cmd => {
                    menuText += `  ◦ ${config.bot.prefix}${cmd}\n`;
                });
                menuText += '\n';
            }

            // Add footer
            menuText += `\n_Send ${config.bot.prefix}help [command] for detailed info_`;

            await sock.sendMessage(message.key.remoteJid, {
                text: menuText,
                quoted: message
            });

        } catch (err) {
            logger.error('Error in menu command:', err);
            throw err;
        }
    },

    async help(sock, message, args) {
        try {
            const commandName = args[0];
            const sender = message.key.remoteJid;

            if (!commandName) {
                await sock.sendMessage(sender, {
                    text: `Use ${config.bot.prefix}menu to see all commands\nor ${config.bot.prefix}help [command] for specific help`
                });
                return;
            }

            // TODO: Implement specific command help
            await sock.sendMessage(sender, {
                text: `Help for ${commandName} will be available soon`
            });

        } catch (err) {
            logger.error('Error in help command:', err);
            throw err;
        }
    }
};

module.exports = menuCommands;