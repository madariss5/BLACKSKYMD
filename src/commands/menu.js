const { languageManager } = require('../utils/language');
const config = require('../config/config');
const logger = require('../utils/logger');
const fs = require('fs').promises;
const path = require('path');
const { commandLoader } = require('../utils/commandLoader');
const moment = require('moment');

// Fancy border styles
const borders = {
    thin: {
        top: '╭',
        topRight: '╮',
        right: '│',
        bottomRight: '╯',
        bottom: '╰',
        bottomLeft: '╰',
        left: '│',
        topLeft: '╭'
    },
    thick: {
        top: '┏',
        topRight: '┓',
        right: '┃',
        bottomRight: '┛',
        bottom: '┗',
        bottomLeft: '┗',
        left: '┃',
        topLeft: '┏'
    },
    double: {
        top: '╔',
        topRight: '╗',
        right: '║',
        bottomRight: '╝',
        bottom: '╚',
        bottomLeft: '╚',
        left: '║',
        topLeft: '╔'
    }
};

// Theme colors using emoji
const themes = {
    primary: '🟢',
    secondary: '🔵',
    success: '✅',
    info: 'ℹ️',
    warning: '⚠️',
    danger: '❌',
    light: '⚪',
    dark: '⚫'
};

// Function to create a styled section
function createSection(title, content, style = 'thin', padding = 2) {
    const b = borders[style];
    const paddingStr = ' '.repeat(padding);
    const titlePadded = title ? ` ${title} ` : '';
    
    let result = `${b.top}${'━'.repeat(titlePadded.length)}${b.topRight}\n`;
    result += `${b.left}${titlePadded}${b.right}\n`;
    
    if (Array.isArray(content)) {
        for (const line of content) {
            result += `${b.left}${paddingStr}${line}${b.right}\n`;
        }
    } else {
        result += `${b.left}${paddingStr}${content}${b.right}\n`;
    }
    
    result += `${b.bottom}${'━'.repeat(titlePadded.length + padding * 2)}${b.bottomRight}`;
    return result;
}

// Function to generate a decorative header
function generateHeader(text) {
    const stars = '✦'.repeat(Math.floor((30 - text.length) / 2));
    return `${stars} *${text}* ${stars}`;
}

// Function to create a fancy line
function fancyLine(length = 40, char = '•') {
    return char.repeat(length);
}

// Function to group commands into columns
function formatCommandsInColumns(commands, prefix, columns = 3) {
    if (!commands || commands.length === 0) return [];
    
    const result = [];
    let line = '';
    let count = 0;
    
    for (const cmd of commands) {
        const cmdText = `${prefix}${cmd}`;
        
        if (count % columns === 0) {
            if (line) result.push(line);
            line = cmdText.padEnd(20, ' ');
        } else {
            line += cmdText.padEnd(20, ' ');
        }
        
        count++;
    }
    
    if (line) result.push(line);
    return result;
}

const menuCommands = {
    async menu(sock, message, args) {
        try {
            const sender = message.key.remoteJid;
            const username = message.pushName || 'User';
            const currentTime = moment().format('HH:mm:ss');
            const currentDate = moment().format('DD/MM/YYYY');
            const uptime = process.uptime();
            const uptimeStr = moment.duration(uptime, 'seconds').humanize();
            
            // Check if category was specified
            const category = args[0]?.toLowerCase();
            
            // Get all commands from all files
            const allCommands = {};
            const categories = {
                'owner': '👑 Owner Commands',
                'basic': '⚙️ General',
                'educational': '📚 Educational',
                'fun': '🎮 Fun',
                'group': '👥 Group',
                'media': '📸 Media',
                'nsfw': '🔞 NSFW',
                'reactions': '💫 Reactions',
                'user': '👤 User',
                'utility': '🛠️ Utility'
            };
            
            // Load commands from files
            const commandsPath = path.join(__dirname);
            const commandFiles = await fs.readdir(commandsPath);
            
            for (const file of commandFiles) {
                if (file.endsWith('.js') && file !== 'index.js' && file !== 'menu.js') {
                    const categoryName = file.replace('.js', '');
                    try {
                        const commands = require(`./${file}`);
                        const commandNames = Object.keys(commands).filter(cmd => 
                            cmd !== 'init' && typeof commands[cmd] === 'function'
                        );
                        
                        if (commandNames.length > 0) {
                            allCommands[categoryName] = commandNames;
                        }
                    } catch (err) {
                        logger.error(`Error loading commands from ${file}:`, err);
                    }
                }
            }
            
            // If a specific category was requested
            if (category && categories[category]) {
                // Display only the requested category
                const commands = allCommands[category] || [];
                
                if (commands.length === 0) {
                    await sock.sendMessage(sender, {
                        text: `❌ No commands found in category "${category}"`
                    });
                    return;
                }
                
                // Create header for category
                let menuText = `┏━━⟪ *${config.bot.name}* ⟫━━┓\n\n`;
                menuText += `${generateHeader(categories[category])}\n\n`;
                
                // Format commands in a grid
                const formattedCommands = formatCommandsInColumns(commands, config.bot.prefix, 2);
                menuText += formattedCommands.join('\n');
                
                menuText += `\n\n┗━━⟪ *${commands.length} Commands* ⟫━━┛`;
                
                await sock.sendMessage(sender, {
                    text: menuText,
                    quoted: message
                });
                return;
            }
            
            // Main menu header
            let menuText = `┏━━━━━━━━━━━━━━━━━━━┓\n`;
            menuText += `┃  *${config.bot.name}*  ┃\n`;
            menuText += `┗━━━━━━━━━━━━━━━━━━━┛\n\n`;
            
            // User info and time
            menuText += `${themes.info} *User:* ${username}\n`;
            menuText += `${themes.info} *Time:* ${currentTime}\n`;
            menuText += `${themes.info} *Date:* ${currentDate}\n`;
            menuText += `${themes.info} *Uptime:* ${uptimeStr}\n\n`;
            
            // Bot info
            menuText += `${generateHeader('BOT INFO')}\n\n`;
            menuText += `${themes.primary} *Bot Name:* ${config.bot.name}\n`;
            menuText += `${themes.primary} *Version:* ${config.bot.version}\n`;
            menuText += `${themes.primary} *Prefix:* ${config.bot.prefix}\n`;
            menuText += `${themes.primary} *Language:* ${config.bot.language}\n\n`;
            
            // Command categories
            menuText += `${generateHeader('COMMAND CATEGORIES')}\n\n`;
            
            // List all categories with command count
            let totalCommands = 0;
            for (const [cat, commands] of Object.entries(allCommands)) {
                if (categories[cat] && commands.length > 0) {
                    menuText += `${themes.secondary} *${categories[cat]}*\n`;
                    menuText += `  └ ${commands.length} commands\n`;
                    menuText += `  └ Type: ${config.bot.prefix}menu ${cat}\n\n`;
                    totalCommands += commands.length;
                }
            }
            
            // Footer
            menuText += `${fancyLine(40, '•')}\n`;
            menuText += `${themes.info} Total Commands: ${totalCommands}\n`;
            menuText += `${themes.info} Use ${config.bot.prefix}help <command> for details\n`;
            menuText += `${fancyLine(40, '•')}\n\n`;
            
            // Signature
            menuText += `┏━━━━━━━━━━━━━━━━━━━┓\n`;
            menuText += `┃    Powered by ${config.bot.name}   ┃\n`;
            menuText += `┗━━━━━━━━━━━━━━━━━━━┛`;
            
            await sock.sendMessage(sender, {
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
            const username = message.pushName || 'User';

            if (!commandName) {
                // Pretty help message with instructions
                let helpText = `┏━━⟪ *HELP MENU* ⟫━━┓\n\n`;
                helpText += `Hello ${username}! 👋\n\n`;
                helpText += `${themes.info} To see all commands:\n`;
                helpText += `  └ Type ${config.bot.prefix}menu\n\n`;
                helpText += `${themes.info} To see commands by category:\n`;
                helpText += `  └ Type ${config.bot.prefix}menu <category>\n\n`;
                helpText += `${themes.info} To get help for a specific command:\n`;
                helpText += `  └ Type ${config.bot.prefix}help <command>\n\n`;
                helpText += `┗━━⟪ *${config.bot.name}* ⟫━━┛`;
                
                await sock.sendMessage(sender, {
                    text: helpText,
                    quoted: message
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
                    if (commands[commandName] && typeof commands[commandName] === 'function') {
                        foundCommand = commands[commandName];
                        foundIn = file.replace('.js', '');
                        break;
                    }
                }
            }

            if (foundCommand) {
                const cmdConfig = foundCommand.config || {};
                
                // Beautifully formatted help message
                let helpText = `┏━━⟪ *COMMAND INFO* ⟫━━┓\n\n`;
                helpText += `${themes.primary} *Command:* ${commandName}\n`;
                helpText += `${themes.secondary} *Category:* ${foundIn}\n`;
                helpText += `${themes.info} *Description:* ${cmdConfig.description || 'No description available'}\n\n`;
                
                // Usage section
                helpText += `${generateHeader('USAGE')}\n\n`;
                helpText += `${themes.success} ${cmdConfig.usage || `${config.bot.prefix}${commandName}`}\n\n`;
                
                // Examples section if available
                if (cmdConfig.examples && cmdConfig.examples.length > 0) {
                    helpText += `${generateHeader('EXAMPLES')}\n\n`;
                    cmdConfig.examples.forEach((example, index) => {
                        helpText += `${themes.light} ${index + 1}. ${example}\n`;
                    });
                    helpText += '\n';
                }
                
                // Permissions if available
                if (cmdConfig.permissions && cmdConfig.permissions.length > 0) {
                    helpText += `${generateHeader('PERMISSIONS')}\n\n`;
                    helpText += `${themes.warning} Required: ${cmdConfig.permissions.join(', ')}\n\n`;
                }
                
                // Footer
                helpText += `┗━━⟪ *${config.bot.name}* ⟫━━┛`;

                await sock.sendMessage(sender, { 
                    text: helpText,
                    quoted: message
                });
            } else {
                // Error message when command not found
                let errorText = `┏━━⟪ *COMMAND NOT FOUND* ⟫━━┓\n\n`;
                errorText += `${themes.danger} Command "${commandName}" not found.\n\n`;
                errorText += `${themes.info} Use ${config.bot.prefix}menu to see all available commands.\n\n`;
                errorText += `┗━━⟪ *${config.bot.name}* ⟫━━┛`;
                
                await sock.sendMessage(sender, {
                    text: errorText,
                    quoted: message
                });
            }

        } catch (err) {
            logger.error('Error in help command:', err);
            throw err;
        }
    }
};

module.exports = menuCommands;