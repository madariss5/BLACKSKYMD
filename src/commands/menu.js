const { languageManager } = require('../utils/language');
const config = require('../config/config');
const logger = require('../utils/logger');
const fs = require('fs').promises;
const path = require('path');
const { commandLoader } = require('../utils/commandLoader');
const moment = require('moment');
const axios = require('axios');

// SHABAN-MD-V5 Style Emojis and Design Elements
const emojis = {
    // Category emojis
    owner: '👑',
    admin: '⚡',
    basic: '🧩',
    general: '⚙️',
    educational: '📚',
    fun: '🎮',
    group: '👥',
    media: '📽️',
    nsfw: '🔞',
    reactions: '💫',
    user: '👤',
    utility: '🛠️',
    
    // Status indicators
    online: '✅',
    offline: '❌',
    loading: '⏳',
    success: '✓',
    error: '✗',
    warning: '⚠️',
    info: 'ℹ️',

    // Decoration elements
    star: '✨',
    sparkle: '💫',
    fire: '🔥',
    heart: '❤️',
    diamond: '💎',
    money: '💰',
    cool: '😎',
    arrow: '➣',
    bullet: '•',
    line: '┄┄',
    dotline: '┈┈┈',
    flower: '✿',
    category: '📂',
    command: '🔸',
    premium: '💎',
    new: '🆕',
    hot: '🔥',
    crown: '👑',
    bolt: '⚡',
};

// Box drawing characters
const box = {
    // Basic box elements
    topLeft: '╭', topRight: '╮',
    middleLeft: '│', middleRight: '│',
    bottomLeft: '╰', bottomRight: '╯',
    
    // Title box elements
    titleLeft: '┏',
    titleRight: '┓',
    titleBottom: '┗',
    titleBottomRight: '┛',
    
    // Line elements
    horizontalLine: '━',
    doubleLine: '═',
    verticalLine: '┃',
    
    // Special elements
    fancyCornerTL: '┏', 
    fancyCornerTR: '┓',
    fancyCornerBL: '┗', 
    fancyCornerBR: '┛',
    fancyLineH: '━',
    fancyLineV: '┃',
    
    // Section dividers
    sectionDivider: '┅┅┅┅',
};

// Color codes (WhatsApp supported markdown)
const colors = {
    title: '*',      // Bold
    subtitle: '_',   // Italic
    highlight: '```', // Monospace
    strikethrough: '~', // Strikethrough
    link: '',        // No special formatting for links
};

// Menu styling functions
function styleTitle(text) {
    return `${colors.title}${text}${colors.title}`;
}

function styleSubtitle(text) {
    return `${colors.subtitle}${text}${colors.subtitle}`;
}

function styleCommand(text) {
    return `\`${text}\``;
}

function styleHighlight(text) {
    return `${colors.highlight}${text}${colors.highlight}`;
}

// Function to create fancy dividers with emojis
function createFancyDivider(emoji, length = 16) {
    return emoji + box.sectionDivider.repeat(length) + emoji;
}

// Function to get inspiring quotes for the menu
async function getInspirationalQuote() {
    try {
        const quotes = [
            { text: "Unleash your potential, make every conversation count.", author: "SHABAN-BOT" },
            { text: "In a world of machines, we bring humanity to chat.", author: "WhatsApp AI" },
            { text: "Beyond messages - creating connections, one chat at a time.", author: "ChatBot" },
            { text: "Turning simple texts into extraordinary experiences.", author: "Bot Master" },
            { text: "The future of messaging is here - in your hands.", author: "Tech Guru" },
            { text: "Smart conversations, smarter connections.", author: "AI Assistant" },
            { text: "Breaking boundaries in digital communication.", author: "Digital Pioneer" },
            { text: "Your personal assistant, just a message away.", author: "Virtual Friend" },
            { text: "Transforming chats into meaningful interactions.", author: "Connection Expert" },
            { text: "Where technology meets human touch.", author: "Bot Creator" }
        ];
        
        return quotes[Math.floor(Math.random() * quotes.length)];
    } catch (error) {
        logger.error("Error fetching quote:", error);
        return { text: "Making conversations better, one message at a time.", author: "Bot AI" };
    }
}

// Function to create a SHABAN-style header box
function createShabanHeader(title, subtitle = null) {
    const headerTitle = title.toUpperCase();
    const lineWidth = Math.max(headerTitle.length + 10, subtitle ? subtitle.length + 8 : 0, 25);
    
    let header = `${box.fancyCornerTL}${box.fancyLineH.repeat(lineWidth)}${box.fancyCornerTR}\n`;
    header += `${box.fancyLineV} ${emojis.crown} ${styleTitle(headerTitle)} ${emojis.crown} ${box.fancyLineV}\n`;
    
    if (subtitle) {
        header += `${box.fancyLineV} ${styleSubtitle(subtitle)} ${box.fancyLineV}\n`;
    }
    
    header += `${box.fancyCornerBL}${box.fancyLineH.repeat(lineWidth)}${box.fancyCornerBR}`;
    return header;
}

// Function to create a category section in SHABAN-style
function createCategorySection(categoryName, emoji, commands, prefix) {
    const catTitle = categoryName.toUpperCase();
    let section = `\n${emojis.sparkle} ${styleTitle(emoji + ' ' + catTitle)} ${emojis.sparkle}\n`;
    
    // Create a grid layout for commands
    let grid = '';
    const sortedCommands = [...commands].sort();
    
    // Display commands in a compact grid (3 per line)
    for (let i = 0; i < sortedCommands.length; i += 3) {
        const cmd1 = sortedCommands[i] ? `${emojis.command} ${styleCommand(prefix + sortedCommands[i])}` : '';
        const cmd2 = sortedCommands[i+1] ? `${emojis.command} ${styleCommand(prefix + sortedCommands[i+1])}` : '';
        const cmd3 = sortedCommands[i+2] ? `${emojis.command} ${styleCommand(prefix + sortedCommands[i+2])}` : '';
        
        grid += `${cmd1.padEnd(25)} ${cmd2.padEnd(25)} ${cmd3}\n`;
    }
    
    section += grid;
    
    // Add count
    section += `\n${emojis.info} ${styleSubtitle('Total: ' + sortedCommands.length + ' commands')}\n`;
    section += createFancyDivider(emojis.dotline);
    
    return section;
}

// Function to create a compact category preview
function createCompactCategory(categoryName, emoji, count, prefix) {
    return `${emoji} ${styleTitle(categoryName)} ${styleSubtitle('(' + count + ')')} ${emojis.arrow} ${styleCommand(prefix + 'menu ' + categoryName.toLowerCase())}\n`;
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
                const categoryIcons = {
                    'owner': emojis.crown,
                    'basic': emojis.general,
                    'educational': emojis.educational,
                    'fun': emojis.fun,
                    'group': emojis.group,
                    'media': emojis.media,
                    'nsfw': emojis.nsfw,
                    'reactions': emojis.reactions,
                    'user': emojis.user,
                    'utility': emojis.utility
                };
                
                const categories = {
                    'owner': 'Owner',
                    'basic': 'General',
                    'educational': 'Educational',
                    'fun': 'Fun',
                    'group': 'Group',
                    'media': 'Media',
                    'nsfw': 'NSFW',
                    'reactions': 'Reactions',
                    'user': 'User',
                    'utility': 'Utility'
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
                    
                    const quote = await getInspirationalQuote();
                    const categoryIcon = categoryIcons[category] || emojis.command;
                    
                    // Create SHABAN-style category menu
                    let menuText = createShabanHeader(`${config.bot.name} - ${categories[category]} Commands`, 
                                                     `A total of ${commands.length} commands in this category`);
                    
                    menuText += `\n\n${createCategorySection(categories[category], categoryIcon, commands, prefix)}`;
                    
                    // Add footer with instructions
                    menuText += `\n${emojis.bolt} ${styleTitle('USAGE INFO')} ${emojis.bolt}\n`;
                    menuText += `${emojis.info} Type ${styleCommand(prefix + 'help <command>')} for detailed help\n`;
                    menuText += `${emojis.arrow} Use ${styleCommand(prefix + 'menu')} to return to main menu\n\n`;
                    
                    // Add inspirational quote
                    menuText += `${emojis.sparkle} ${styleSubtitle('"' + quote.text + '"')}\n`;
                    menuText += `${emojis.star} ${styleSubtitle('- ' + quote.author)}\n`;
                    
                    // Create an image for the menu
                    const botImageUrl = 'https://i.ibb.co/37FP2bk/noimage.jpg';
                    
                    await sock.sendMessage(sender, {
                        image: { url: botImageUrl },
                        caption: menuText,
                        quoted: message
                    });
                    return;
                }
                
                // Get inspirational quote
                const quote = await getInspirationalQuote();
                
                // Create SHABAN-style main menu
                let menuText = '';
                
                // Title Box
                menuText += createShabanHeader(config.bot.name, 'The Ultimate WhatsApp AI Assistant');
                
                // User Info Section
                menuText += `\n\n${box.topLeft}${box.horizontalLine.repeat(40)}${box.topRight}\n`;
                menuText += `${box.middleLeft} ${emojis.user} ${styleTitle('USER INFO')}${box.middleRight}\n`;
                menuText += `${box.middleLeft} ${emojis.arrow} ${styleTitle('Name:')} ${styleSubtitle(username)}${box.middleRight}\n`;
                menuText += `${box.middleLeft} ${emojis.arrow} ${styleTitle('Time:')} ${styleSubtitle(currentTime)}${box.middleRight}\n`;
                menuText += `${box.middleLeft} ${emojis.arrow} ${styleTitle('Date:')} ${styleSubtitle(currentDate)}${box.middleRight}\n`;
                menuText += `${box.middleLeft} ${emojis.arrow} ${styleTitle('Status:')} ${emojis.online} ${styleSubtitle('Online')}${box.middleRight}\n`;
                menuText += `${box.middleLeft} ${emojis.arrow} ${styleTitle('Uptime:')} ${styleSubtitle(uptimeStr)}${box.middleRight}\n`;
                menuText += `${box.bottomLeft}${box.horizontalLine.repeat(40)}${box.bottomRight}\n\n`;
                
                // Command Categories Section
                menuText += `${emojis.sparkle} ${styleTitle('COMMAND CATEGORIES')} ${emojis.sparkle}\n\n`;
                
                let totalCommands = 0;
                
                // Add command categories in a new grid-style layout
                for (const [cat, commands] of Object.entries(allCommands)) {
                    if (categories[cat] && commands.length > 0) {
                        const icon = categoryIcons[cat] || emojis.command;
                        menuText += createCompactCategory(categories[cat], icon, commands.length, prefix);
                        totalCommands += commands.length;
                    }
                }
                
                // Special Commands Section
                menuText += `\n${createFancyDivider(emojis.dotline)}\n\n`;
                menuText += `${emojis.bolt} ${styleTitle('QUICK ACCESS')} ${emojis.bolt}\n\n`;
                menuText += `${emojis.command} ${styleCommand(prefix + 'help')} - Get help on using the bot\n`;
                menuText += `${emojis.command} ${styleCommand(prefix + 'list')} - View all commands in a list\n`;
                menuText += `${emojis.command} ${styleCommand(prefix + 'ping')} - Check bot response time\n`;
                menuText += `${emojis.command} ${styleCommand(prefix + 'info')} - Bot information\n`;
                
                // Footer Section
                menuText += `\n\n${createFancyDivider(emojis.sparkle)}\n\n`;
                menuText += `${emojis.info} ${styleTitle('TOTAL COMMANDS:')} ${styleHighlight(' ' + totalCommands + ' ')}\n\n`;
                
                // Bot Version & Credits
                menuText += `${emojis.crown} ${styleSubtitle('Bot Version:')} v5.0.0\n`;
                menuText += `${emojis.crown} ${styleSubtitle('Developer:')} SHABAN-MD Team\n\n`;
                
                // Inspirational Quote
                menuText += `${emojis.sparkle} ${styleSubtitle('"' + quote.text + '"')}\n`;
                menuText += `${emojis.star} ${styleSubtitle('- ' + quote.author)}\n`;
                
                // Get or create a bot image
                const botImageUrl = 'https://i.ibb.co/37FP2bk/noimage.jpg';
                
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
                const categoryIcons = {
                    'owner': emojis.crown,
                    'basic': emojis.general,
                    'educational': emojis.educational,
                    'fun': emojis.fun,
                    'group': emojis.group,
                    'media': emojis.media,
                    'nsfw': emojis.nsfw,
                    'reactions': emojis.reactions,
                    'user': emojis.user,
                    'utility': emojis.utility
                };
                
                const categories = {
                    'owner': 'Owner',
                    'basic': 'General',
                    'educational': 'Educational',
                    'fun': 'Fun',
                    'group': 'Group',
                    'media': 'Media',
                    'nsfw': 'NSFW',
                    'reactions': 'Reactions',
                    'user': 'User',
                    'utility': 'Utility'
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
                
                // Get inspirational quote
                const quote = await getInspirationalQuote();
                
                // Create SHABAN-style list menu
                let menuText = createShabanHeader('COMPLETE COMMAND LIST', 'All available commands at your fingertips');
                menuText += '\n\n';
                
                let totalCommands = 0;
                
                // Generate category sections
                for (const [cat, commands] of Object.entries(allCommands)) {
                    if (categories[cat] && commands.length > 0) {
                        const icon = categoryIcons[cat] || emojis.command;
                        menuText += createCategorySection(categories[cat], icon, commands, prefix);
                        totalCommands += commands.length;
                    }
                }
                
                // Add footer with information
                menuText += `\n${emojis.bolt} ${styleTitle('COMMAND INFO')} ${emojis.bolt}\n\n`;
                menuText += `${emojis.info} ${styleTitle('TOTAL COMMANDS:')} ${styleHighlight(' ' + totalCommands + ' ')}\n`;
                menuText += `${emojis.info} Use ${styleCommand(prefix + 'help <command>')} for details on a specific command\n`;
                menuText += `${emojis.info} Use ${styleCommand(prefix + 'menu')} to return to the main menu\n\n`;
                
                // Add inspirational quote
                menuText += `${emojis.sparkle} ${styleSubtitle('"' + quote.text + '"')}\n`;
                menuText += `${emojis.star} ${styleSubtitle('- ' + quote.author)}\n`;
                
                // Get or create a bot image
                const botImageUrl = 'https://i.ibb.co/37FP2bk/noimage.jpg';
                
                await sock.sendMessage(sender, {
                    image: { url: botImageUrl },
                    caption: menuText,
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
                
                // Get inspirational quote
                const quote = await getInspirationalQuote();
                
                if (!commandName) {
                    // Default help menu in SHABAN-style
                    let helpText = createShabanHeader('HELP CENTER', 'Your guide to using the bot effectively');
                    
                    // User greeting
                    helpText += `\n\n${emojis.sparkle} Hello ${styleTitle(username)}! Welcome to the help center ${emojis.sparkle}\n\n`;
                    
                    // Command Navigation Box
                    helpText += `${box.topLeft}${box.horizontalLine.repeat(40)}${box.topRight}\n`;
                    helpText += `${box.middleLeft} ${emojis.bolt} ${styleTitle('NAVIGATION GUIDE')} ${box.middleRight}\n`;
                    helpText += `${box.middleLeft} ${emojis.arrow} ${styleCommand(prefix + 'menu')} - View main menu ${box.middleRight}\n`;
                    helpText += `${box.middleLeft} ${emojis.arrow} ${styleCommand(prefix + 'menu <category>')} - View category commands ${box.middleRight}\n`;
                    helpText += `${box.middleLeft} ${emojis.arrow} ${styleCommand(prefix + 'help <command>')} - Get command help ${box.middleRight}\n`;
                    helpText += `${box.middleLeft} ${emojis.arrow} ${styleCommand(prefix + 'list')} - See all commands ${box.middleRight}\n`;
                    helpText += `${box.bottomLeft}${box.horizontalLine.repeat(40)}${box.bottomRight}\n\n`;
                    
                    // Quick Start Section
                    helpText += `${emojis.fire} ${styleTitle('QUICK START GUIDE')} ${emojis.fire}\n\n`;
                    helpText += `${emojis.command} Try ${styleCommand(prefix + 'menu fun')} to see fun commands\n`;
                    helpText += `${emojis.command} Use ${styleCommand(prefix + 'help sticker')} to learn about the sticker command\n`;
                    helpText += `${emojis.command} Type ${styleCommand(prefix + 'ping')} to check if bot is responding\n\n`;
                    
                    // Tips Section
                    helpText += `${emojis.sparkle} ${styleTitle('PRO TIPS')} ${emojis.sparkle}\n\n`;
                    helpText += `${emojis.info} Commands with ${emojis.crown} require owner privileges\n`;
                    helpText += `${emojis.info} Some commands only work in groups\n`;
                    helpText += `${emojis.info} For media commands, send an image/video with caption\n\n`;
                    
                    // Quote
                    helpText += `${createFancyDivider(emojis.dotline)}\n\n`;
                    helpText += `${emojis.sparkle} ${styleSubtitle('"' + quote.text + '"')}\n`;
                    helpText += `${emojis.star} ${styleSubtitle('- ' + quote.author)}\n`;
                    
                    // Get or create a bot image
                    const botImageUrl = 'https://i.ibb.co/37FP2bk/noimage.jpg';
                    
                    await sock.sendMessage(sender, {
                        image: { url: botImageUrl },
                        caption: helpText,
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
                        text: `${emojis.error} ${styleTitle('Command Not Found')} ${emojis.error}\n\n` +
                              `The command ${styleCommand(commandName)} could not be found.\n` +
                              `Type ${styleCommand(prefix + 'menu')} to see all available commands.`,
                        quoted: message
                    });
                    return;
                }
                
                // Get the appropriate category icon
                const categoryIcons = {
                    'owner': emojis.crown,
                    'basic': emojis.general,
                    'educational': emojis.educational,
                    'fun': emojis.fun,
                    'group': emojis.group,
                    'media': emojis.media,
                    'nsfw': emojis.nsfw,
                    'reactions': emojis.reactions,
                    'user': emojis.user,
                    'utility': emojis.utility
                };
                
                const categoryIcon = categoryIcons[foundIn] || emojis.command;
                
                // Display command help in SHABAN-style
                let helpText = createShabanHeader(`Command: ${commandName.toUpperCase()}`, 
                                               `From the ${foundIn} category`);
                helpText += '\n\n';
                
                // Command Info Box
                helpText += `${box.topLeft}${box.horizontalLine.repeat(40)}${box.topRight}\n`;
                helpText += `${box.middleLeft} ${categoryIcon} ${styleTitle('COMMAND INFORMATION')} ${box.middleRight}\n`;
                helpText += `${box.middleLeft} ${emojis.arrow} ${styleTitle('Category:')} ${styleSubtitle(foundIn)} ${box.middleRight}\n`;
                helpText += `${box.middleLeft} ${emojis.arrow} ${styleTitle('Usage:')} ${styleCommand(prefix + commandName)} ${box.middleRight}\n`;
                helpText += `${box.bottomLeft}${box.horizontalLine.repeat(40)}${box.bottomRight}\n\n`;
                
                // Usage Examples
                helpText += `${emojis.bolt} ${styleTitle('HOW TO USE')} ${emojis.bolt}\n\n`;
                helpText += `${emojis.info} Basic usage: ${styleCommand(prefix + commandName)}\n`;
                helpText += `${emojis.info} With arguments: ${styleCommand(prefix + commandName + ' <text>')}\n\n`;
                
                // Note about simplified help
                helpText += `${box.topLeft}${box.horizontalLine.repeat(40)}${box.topRight}\n`;
                helpText += `${box.middleLeft} ${emojis.warning} ${styleTitle('SIMPLIFIED HELP MESSAGE')} ${box.middleRight}\n`;
                helpText += `${box.middleLeft} This is a basic overview of the command. ${box.middleRight}\n`;
                helpText += `${box.middleLeft} Try using it to discover all its features! ${box.middleRight}\n`;
                helpText += `${box.bottomLeft}${box.horizontalLine.repeat(40)}${box.bottomRight}\n\n`;
                
                // Related Commands (just a placeholder since we don't have actual related commands data)
                helpText += `${emojis.sparkle} ${styleTitle('RELATED COMMANDS')} ${emojis.sparkle}\n\n`;
                helpText += `${emojis.command} Try ${styleCommand(prefix + 'menu ' + foundIn)} for similar commands\n\n`;
                
                // Quote
                helpText += `${createFancyDivider(emojis.dotline)}\n\n`;
                helpText += `${emojis.sparkle} ${styleSubtitle('"' + quote.text + '"')}\n`;
                helpText += `${emojis.star} ${styleSubtitle('- ' + quote.author)}\n`;
                
                // Get or create a bot image
                const botImageUrl = 'https://i.ibb.co/37FP2bk/noimage.jpg';
                
                await sock.sendMessage(sender, {
                    image: { url: botImageUrl },
                    caption: helpText,
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