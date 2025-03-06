const { languageManager } = require('../utils/language');
const config = require('../config/config');
const logger = require('../utils/logger');
const fs = require('fs').promises;
const path = require('path');

const menuCommands = {
    async menu(sock, message, args) {
        try {
            // Bot info section
            let menuText = `╭─────『 *${config.bot.name}* 』─────\n`;
            menuText += `│ 👋 *Welcome!*\n`;
            menuText += `│ 🤖 *Bot Name:* ${config.bot.name}\n`;
            menuText += `│ 📝 *Prefix:* ${config.bot.prefix}\n`;
            menuText += `│ 🌐 *Language:* ${config.bot.language}\n`;
            menuText += `╰────────────────────\n\n`;

            // Command Categories
            const categories = {
                '👑 Owner Commands': 'owner',
                '⚙️ General': 'basic',
                '📚 Educational': 'educational',
                '🎮 Fun': 'fun',
                '👥 Group': 'group',
                '📸 Media': 'media',
                '🔞 NSFW': 'nsfw',
                '💫 Reactions': 'reactions',
                '👤 User': 'user',
                '🛠️ Utility': 'utility'
            };

            // Load all commands
            const commandsPath = path.join(__dirname);
            const commandFiles = await fs.readdir(commandsPath);

            for (const [categoryName, categoryFile] of Object.entries(categories)) {
                if (commandFiles.includes(categoryFile + '.js')) {
                    const commands = require(`./${categoryFile}.js`);
                    const commandList = Object.keys(commands);

                    if (commandList.length > 0) {
                        menuText += `╭─『 ${categoryName} 』\n`;
                        for (const cmd of commandList) {
                            const cmdConfig = commands[cmd].config || {};
                            menuText += `│ ⌁ ${config.bot.prefix}${cmd}\n`;
                        }
                        menuText += `╰────────────────\n\n`;
                    }
                }
            }

            // Footer
            menuText += `╭─『 ℹ️ *Info* 』\n`;
            menuText += `│ Use ${config.bot.prefix}help <command>\n`;
            menuText += `│ for detailed information\n`;
            menuText += `╰────────────────`;

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
                    text: `╭─『 ℹ️ Help 』\n│ Use ${config.bot.prefix}menu to see all commands\n│ Or ${config.bot.prefix}help <command> for details\n╰────────────`
                });
                return;
            }

            // Find the command in all command files
            const commandsPath = path.join(__dirname);
            const commandFiles = await fs.readdir(commandsPath);
            let foundCommand = null;
            let foundIn = null;

            for (const file of commandFiles) {
                if (file.endsWith('.js') && file !== 'index.js') {
                    const commands = require(`./${file}`);
                    if (commands[commandName]) {
                        foundCommand = commands[commandName];
                        foundIn = file.replace('.js', '');
                        break;
                    }
                }
            }

            if (foundCommand) {
                const config = foundCommand.config || {};
                let helpText = `╭─『 📖 Command Help 』\n`;
                helpText += `│ 🔍 *Command:* ${commandName}\n`;
                helpText += `│ 📁 *Category:* ${foundIn}\n`;
                helpText += `│ 📝 *Description:* ${config.description || 'No description available'}\n`;
                helpText += `│ 💡 *Usage:* ${config.usage || `${config.bot.prefix}${commandName}`}\n`;
                if (config.examples) {
                    helpText += `│ 📌 *Examples:*\n`;
                    config.examples.forEach(example => {
                        helpText += `│ • ${example}\n`;
                    });
                }
                helpText += `╰────────────────`;

                await sock.sendMessage(sender, { text: helpText });
            } else {
                await sock.sendMessage(sender, {
                    text: `❌ Command "${commandName}" not found.\nUse ${config.bot.prefix}menu to see available commands.`
                });
            }

        } catch (err) {
            logger.error('Error in help command:', err);
            throw err;
        }
    }
};

module.exports = menuCommands;