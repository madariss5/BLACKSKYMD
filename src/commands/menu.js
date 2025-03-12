const { languageManager } = require('../utils/language');
const config = require('../config/config');
const logger = require('../utils/logger');
const fs = require('fs').promises;
const path = require('path');
const { commandLoader } = require('../utils/commandLoader');
const moment = require('moment');
const axios = require('axios');

// Emoji indicators for menu styling
const emojis = {
    // Category emojis
    owner: '👑',
    admin: '🛡️',
    basic: '🧩',
    general: '⚙️',
    educational: '📚',
    fun: '🎮',
    group: '👥',
    media: '🎬',
    nsfw: '🔞',
    reactions: '🎭',
    user: '👤',
    utility: '🔧',
    
    // Status emojis
    online: '🟢',
    offline: '🔴',
    loading: '⏳',
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️',

    // Menu styling
    star: '✨',
    dot: '•',
    arrow: '➤',
    line: '━',
    corner: '╭',
    category: '📂',
    command: '🔹',
    premium: '💎',
    new: '🆕',
    hot: '🔥',
};

// Special characters for frames and styling
const frames = {
    top: '╔', top_right: '╗', top_center: '╦',
    middle: '╠', middle_right: '╣', middle_center: '╬',
    bottom: '╚', bottom_right: '╝', bottom_center: '╩',
    vertical: '║', horizontal: '═'
};

// Function to get a random quote for the menu
async function getRandomQuote() {
    try {
        const defaultQuotes = [
            { quote: "The best way to predict the future is to create it.", author: "Peter Drucker" },
            { quote: "Life is what happens when you're busy making other plans.", author: "John Lennon" },
            { quote: "Time is gold when you know how to use it.", author: "Anonymous" },
            { quote: "Turn your wounds into wisdom.", author: "Oprah Winfrey" },
            { quote: "The journey of a thousand miles begins with one step.", author: "Lao Tzu" },
        ];
        
        return defaultQuotes[Math.floor(Math.random() * defaultQuotes.length)];
    } catch (error) {
        logger.error("Error fetching quote:", error);
        return { quote: "Simplicity is the ultimate sophistication.", author: "Leonardo da Vinci" };
    }
}

// Function to create a stylish header
function createHeader(title) {
    const decoration = emojis.star.repeat(3);
    return `${decoration} *${title.toUpperCase()}* ${decoration}`;
}

// Function to create a divider line
function createDivider(length = 35, char = emojis.line) {
    return char.repeat(length);
}

// Creates formatted menu category section
function createCategorySection(category, commands, prefix) {
    let result = `\n${emojis.category} *${category}*\n`;
    
    // Sort commands alphabetically
    const sortedCommands = [...commands].sort();
    
    // Format each command
    for (const cmd of sortedCommands.slice(0, 10)) { // Limit to 10 commands per category in menu
        result += `${emojis.command} \`${prefix}${cmd}\`\n`;
    }
    
    // If there are more commands, show a "see more" message
    if (sortedCommands.length > 10) {
        result += `   ${emojis.arrow} _...and ${sortedCommands.length - 10} more_\n`;
    }
    
    return result;
}

// Function to create a stylish button (text only since WhatsApp doesn't support real buttons)
function createButton(text, prefix) {
    return `${emojis.arrow} \`${prefix}${text}\``;
}

// Create the command list
const menuCommands = {
    category: 'basic',
    commands: {
        async menu(sock, message, args) {
            try {
                const sender = message.key.remoteJid;
                const username = message.pushName || 'User';
                const currentTime = moment().format('HH:mm:ss');
                const currentDate = moment().format('DD/MM/YYYY');
                const uptime = process.uptime();
                const uptimeStr = moment.duration(uptime, 'seconds').humanize();
                const prefix = config.bot.prefix;
                
                // Check if specific category requested
                const category = args[0]?.toLowerCase();
                
                // Get all commands from files
                const allCommands = {};
                const categories = {
                    'owner': '👑 Owner',
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
                        try {
                            const moduleData = require(`./${file}`);
                            let commandsObject;
                            let categoryName = file.replace('.js', '');
                            
                            if (moduleData.commands) {
                                commandsObject = moduleData.commands;
                                if (moduleData.category) {
                                    categoryName = moduleData.category;
                                }
                            } else {
                                commandsObject = moduleData;
                            }
                            
                            const commandNames = Object.keys(commandsObject).filter(cmd => 
                                cmd !== 'init' && typeof commandsObject[cmd] === 'function'
                            );
                            
                            if (commandNames.length > 0) {
                                if (allCommands[categoryName]) {
                                    allCommands[categoryName] = [...allCommands[categoryName], ...commandNames];
                                } else {
                                    allCommands[categoryName] = commandNames;
                                }
                            }
                        } catch (err) {
                            logger.error(`Error loading commands from ${file}:`, err);
                        }
                    }
                }
                
                // If specific category requested
                if (category && categories[category]) {
                    const commands = allCommands[category] || [];
                    
                    if (commands.length === 0) {
                        await sock.sendMessage(sender, {
                            text: `${emojis.error} No commands found in category "${category}"`
                        });
                        return;
                    }
                    
                    const randomQuote = await getRandomQuote();
                    
                    let menuText = `╔══${createDivider(30, '═')}══╗
║ ${emojis.star} *${config.bot.name.toUpperCase()}* ${emojis.star} ║
╠══${createDivider(30, '═')}══╣
║ ${categories[category]} COMMANDS ║
╚══${createDivider(30, '═')}══╝\n\n`;
                    
                    // Sort and format commands
                    const sortedCommands = [...commands].sort();
                    for (const cmd of sortedCommands) {
                        menuText += `${emojis.command} \`${prefix}${cmd}\`\n`;
                    }
                    
                    menuText += `\n${createDivider()}\n`;
                    menuText += `${emojis.info} Type \`${prefix}help <command>\` for details on a specific command.\n`;
                    menuText += `${emojis.arrow} Total: ${sortedCommands.length} commands\n\n`;
                    menuText += `${emojis.star} "${randomQuote.quote}" - ${randomQuote.author}`;
                    
                    // Create an image for the menu (can be replaced with actual image creation)
                    const botImageUrl = 'https://i.ibb.co/37FP2bk/noimage.jpg';
                    
                    await sock.sendMessage(sender, {
                        image: { url: botImageUrl },
                        caption: menuText,
                        quoted: message
                    });
                    return;
                }
                
                // Get random quote
                const randomQuote = await getRandomQuote();
                
                // Default menu (main menu)
                // Create a more visually appealing menu with proper spacing and structure
                let menuText = `╔══${createDivider(30, '═')}══╗
║ ${emojis.star} *${config.bot.name.toUpperCase()}* ${emojis.star} ║
╠══${createDivider(30, '═')}══╣
║ ${emojis.info} USER: ${username}
║ ${emojis.info} TIME: ${currentTime}
║ ${emojis.info} DATE: ${currentDate}
║ ${emojis.online} STATUS: Online
║ ${emojis.info} UPTIME: ${uptimeStr}
╠══${createDivider(30, '═')}══╣
║ ${emojis.star} COMMAND CATEGORIES ${emojis.star}
╚══${createDivider(30, '═')}══╝\n`;
                
                let totalCommands = 0;
                
                // Add command categories
                for (const [cat, commands] of Object.entries(allCommands)) {
                    if (categories[cat] && commands.length > 0) {
                        menuText += `\n${emojis.category} *${categories[cat]}*`;
                        menuText += ` _(${commands.length} cmds)_`;
                        menuText += `\n${emojis.arrow} \`${prefix}menu ${cat}\`\n`;
                        totalCommands += commands.length;
                    }
                }
                
                // Add footer with usage instructions
                menuText += `\n${createDivider()}\n\n`;
                menuText += `${emojis.info} *TOTAL COMMANDS:* ${totalCommands}\n`;
                menuText += `${emojis.info} Use \`${prefix}help <command>\` for help with a specific command\n`;
                menuText += `${emojis.info} Use \`${prefix}list\` to see all commands in one list\n\n`;
                
                // Add random inspirational quote
                menuText += `${emojis.star} "${randomQuote.quote}" - ${randomQuote.author}`;
                
                // Get or create a bot image
                const botImageUrl = 'https://i.ibb.co/37FP2bk/noimage.jpg'; // Replace with your bot's image
                
                // Send menu with image
                await sock.sendMessage(sender, {
                    image: { url: botImageUrl },
                    caption: menuText,
                    quoted: message
                });
                
            } catch (err) {
                logger.error('Error in menu command:', err);
                throw err;
            }
        },
        
        async list(sock, message, args) {
            try {
                const sender = message.key.remoteJid;
                const prefix = config.bot.prefix;
                
                // Get all commands from files
                const allCommands = {};
                const categories = {
                    'owner': '👑 Owner',
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
                        try {
                            const moduleData = require(`./${file}`);
                            let commandsObject;
                            let categoryName = file.replace('.js', '');
                            
                            if (moduleData.commands) {
                                commandsObject = moduleData.commands;
                                if (moduleData.category) {
                                    categoryName = moduleData.category;
                                }
                            } else {
                                commandsObject = moduleData;
                            }
                            
                            const commandNames = Object.keys(commandsObject).filter(cmd => 
                                cmd !== 'init' && typeof commandsObject[cmd] === 'function'
                            );
                            
                            if (commandNames.length > 0) {
                                if (allCommands[categoryName]) {
                                    allCommands[categoryName] = [...allCommands[categoryName], ...commandNames];
                                } else {
                                    allCommands[categoryName] = commandNames;
                                }
                            }
                        } catch (err) {
                            logger.error(`Error loading commands from ${file}:`, err);
                        }
                    }
                }
                
                let menuText = `${emojis.star} *COMPLETE COMMAND LIST* ${emojis.star}\n\n`;
                let totalCommands = 0;
                
                // Generate category sections
                for (const [cat, commands] of Object.entries(allCommands)) {
                    if (categories[cat] && commands.length > 0) {
                        menuText += createCategorySection(categories[cat], commands, prefix);
                        totalCommands += commands.length;
                    }
                }
                
                // Add footer
                menuText += `\n${createDivider()}\n`;
                menuText += `${emojis.info} *TOTAL COMMANDS:* ${totalCommands}\n`;
                menuText += `${emojis.info} Use \`${prefix}help <command>\` for details on a command`;
                
                await sock.sendMessage(sender, {
                    text: menuText,
                    quoted: message
                });
                
            } catch (err) {
                logger.error('Error in list command:', err);
                throw err;
            }
        },
        
        async help(sock, message, args) {
            try {
                const commandName = args[0];
                const sender = message.key.remoteJid;
                const username = message.pushName || 'User';
                const prefix = config.bot.prefix;
                
                if (!commandName) {
                    // Default help menu (no specific command)
                    let helpText = `${createHeader('HELP MENU')}\n\n`;
                    helpText += `Hello ${username}! ${emojis.star}\n\n`;
                    helpText += `${emojis.arrow} *View all commands:*\n`;
                    helpText += `   ${createButton('menu', prefix)}\n\n`;
                    helpText += `${emojis.arrow} *View commands by category:*\n`;
                    helpText += `   ${createButton('menu <category>', prefix)}\n\n`;
                    helpText += `${emojis.arrow} *Get help for a command:*\n`;
                    helpText += `   ${createButton('help <command>', prefix)}\n\n`;
                    helpText += `${emojis.arrow} *See all commands in a list:*\n`;
                    helpText += `   ${createButton('list', prefix)}\n\n`;
                    helpText += `${createDivider()}\n\n`;
                    helpText += `For example: Type \`${prefix}help sticker\` to learn about the sticker command.`;
                    
                    await sock.sendMessage(sender, {
                        text: helpText,
                        quoted: message
                    });
                    return;
                }
                
                // Find the command in all files
                const commandsPath = path.join(__dirname);
                const commandFiles = await fs.readdir(commandsPath);
                let foundCommand = null;
                let foundIn = null;
                
                for (const file of commandFiles) {
                    if (file.endsWith('.js') && file !== 'index.js') {
                        try {
                            const moduleData = require(`./${file}`);
                            let commandsObject;
                            
                            if (moduleData.commands) {
                                commandsObject = moduleData.commands;
                                if (commandsObject[commandName] && typeof commandsObject[commandName] === 'function') {
                                    foundCommand = commandsObject[commandName];
                                    foundIn = moduleData.category || file.replace('.js', '');
                                    break;
                                }
                            } else {
                                commandsObject = moduleData;
                                if (commandsObject[commandName] && typeof commandsObject[commandName] === 'function') {
                                    foundCommand = commandsObject[commandName];
                                    foundIn = file.replace('.js', '');
                                    break;
                                }
                            }
                        } catch (err) {
                            logger.error(`Error checking command in ${file}:`, err);
                        }
                    }
                }
                
                if (!foundCommand) {
                    await sock.sendMessage(sender, {
                        text: `${emojis.error} Command \`${commandName}\` not found. Type \`${prefix}menu\` to see available commands.`,
                        quoted: message
                    });
                    return;
                }
                
                // Display command help
                let helpText = `${createHeader(`COMMAND: ${commandName.toUpperCase()}`)}\n\n`;
                
                // Category information
                helpText += `${emojis.category} *Category:* ${foundIn}\n\n`;
                
                // Usage information (basic)
                helpText += `${emojis.info} *Usage:*\n`;
                helpText += `   \`${prefix}${commandName}\`\n\n`;
                
                // Note that we're showing simplified help since detailed descriptions aren't available
                helpText += `${emojis.warning} This is a simplified help message.\n`;
                helpText += `Try using the command to learn more about how it works.\n\n`;
                
                helpText += `${createDivider()}`;
                
                await sock.sendMessage(sender, {
                    text: helpText,
                    quoted: message
                });
                
            } catch (err) {
                logger.error('Error in help command:', err);
                throw err;
            }
        },
        
        async init() {
            logger.info('Menu commands module initialized');
            return true;
        }
    }
};

module.exports = menuCommands;