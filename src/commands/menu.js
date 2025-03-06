const { languageManager } = require('../utils/language');
const config = require('../config/config');
const logger = require('../utils/logger');

const commandCategories = {
    basic: {
        title: '📋 Basic Commands',
        commands: ['help', 'menu', 'ping', 'info']
    },
    media: {
        title: '🎥 Media Commands',
        commands: ['sticker', 'toimg', 'brightness', 'blur']
    },
    group: {
        title: '👥 Group Commands',
        commands: ['kick', 'add', 'promote', 'demote']
    },
    educational: {
        title: '📚 Educational',
        commands: ['define', 'translate', 'calculate']
    },
    utility: {
        title: '🛠 Utility',
        commands: ['weather', 'currency', 'reminder']
    }
};

async function menuCommand(sock, msg, args) {
    try {
        let menuText = `*${config.bot.name} - Command Menu*\n\n`;

        // Add bot info
        menuText += `*Bot Prefix:* ${config.bot.prefix}\n`;
        menuText += `*Language:* ${config.bot.language}\n\n`;

        // Add categories and commands
        for (const [category, data] of Object.entries(commandCategories)) {
            menuText += `${data.title}\n`;
            data.commands.forEach(cmd => {
                const description = languageManager.getText(`commands.${cmd}.description`) || 'No description available';
                const usage = languageManager.getText(`commands.${cmd}.usage`) || `${config.bot.prefix}${cmd}`;
                menuText += `  ◦ ${usage}\n    ${description}\n`;
            });
            menuText += '\n';
        }

        // Add footer
        menuText += `\n_Send ${config.bot.prefix}help [command] for detailed info about a specific command_`;

        await sock.sendMessage(msg.key.remoteJid, {
            text: menuText,
            quoted: msg
        });

        return true;
    } catch (err) {
        logger.error('Error in menu command:', err);
        return false;
    }
}

module.exports = {
    command: 'menu',
    handler: menuCommand,
    help: {
        description: 'Shows the command menu',
        usage: '.menu',
        category: 'basic'
    }
};