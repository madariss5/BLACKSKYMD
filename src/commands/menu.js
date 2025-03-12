const { languageManager } = require('../utils/language');
const config = require('../config/config');
const logger = require('../utils/logger');
const fs = require('fs').promises;
const path = require('path');
const { commandLoader } = require('../utils/commandLoader');
const moment = require('moment');
const axios = require('axios');

/**
 * Loads commands from all available sources including main directory and subdirectories
 * @param {Object} allCommands Object to store commands by category
 * @returns {Promise<number>} Total number of commands loaded
 */
async function loadAllCommands(allCommands) {
    const commandsPath = path.join(__dirname);
    const commandFiles = await fs.readdir(commandsPath);
    let totalCommands = 0;
    
    // Helper function to process a module and extract commands
    const processModule = (moduleData, suggestedCategory) => {
        let commandsObject;
        let categoryName = suggestedCategory;
        
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
            totalCommands += commandNames.length;
        }
        
        return commandNames.length;
    };
    
    // First load commands from direct JS files in the commands directory
    for (const file of commandFiles) {
        if (file.endsWith('.js') && file !== 'index.js' && file !== 'menu.js') {
            try {
                const moduleData = require(`./${file}`);
                const categoryName = file.replace('.js', '');
                const cmdCount = processModule(moduleData, categoryName);
                logger.info(`Loaded ${cmdCount} commands from file ${file}`);
            } catch (err) {
                logger.error(`Error loading commands from ${file}:`, err);
            }
        }
    }
    
    // Then load commands from subdirectories
    for (const item of commandFiles) {
        const itemPath = path.join(commandsPath, item);
        try {
            const stats = await fs.stat(itemPath);
            
            if (stats.isDirectory()) {
                logger.info(`Checking subdirectory: ${item}`);
                
                // Check for index.js in subdirectory
                const indexPath = path.join(itemPath, 'index.js');
                try {
                    // Try to require the index.js file
                    const moduleData = require(`./${item}/index.js`);
                    const cmdCount = processModule(moduleData, item);
                    logger.info(`Loaded ${cmdCount} commands from ${item}/index.js`);
                } catch (indexErr) {
                    logger.info(`Could not load index.js from ${item} directory, trying individual files`);
                    
                    // If index.js fails, try loading individual files
                    try {
                        const subFiles = await fs.readdir(itemPath);
                        for (const subFile of subFiles) {
                            if (subFile.endsWith('.js') && subFile !== 'index.js') {
                                try {
                                    const subModulePath = `./${item}/${subFile}`;
                                    const subModule = require(subModulePath);
                                    const cmdCount = processModule(subModule, item);
                                    logger.info(`Loaded ${cmdCount} commands from ${subModulePath}`);
                                } catch (subErr) {
                                    logger.error(`Error loading commands from ${item}/${subFile}:`, subErr);
                                }
                            }
                        }
                    } catch (readErr) {
                        logger.error(`Error reading directory ${item}:`, readErr);
                    }
                }
            }
        } catch (statErr) {
            logger.error(`Error checking ${item}:`, statErr);
        }
    }
    
    return totalCommands;
}

// FLASH-MD Style Emojis and Design Elements
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
    line: '━━',
    dotline: '┈┈┈',
    flower: '✿',
    category: '📂',
    command: '🔸',
    premium: '💎',
    new: '🆕',
    hot: '🔥',
    crown: '👑',
    bolt: '⚡',
    robot: '🤖',
    zap: '⚡',
    rocket: '🚀',
    leaf: '🍃',
    check: '✓',
    time: '⏰',
    wand: '🪄',
    gear: '⚙️',
    globe: '🌐',
    link: '🔗',
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

// Function to create a FLASH-MD style header box
function createFlashHeader(title, subtitle = null) {
    const headerTitle = title.toUpperCase();
    const lineWidth = Math.max(headerTitle.length + 12, subtitle ? subtitle.length + 10 : 0, 30);
    
    let header = `${box.topLeft}${emojis.line.repeat(Math.floor(lineWidth/2))}${box.topRight}\n`;
    header += `${box.middleLeft} ${emojis.robot} ${styleTitle(headerTitle)} ${emojis.zap} ${box.middleRight}\n`;
    
    if (subtitle) {
        header += `${box.middleLeft} ${emojis.sparkle} ${styleSubtitle(subtitle)} ${box.middleRight}\n`;
    }
    
    header += `${box.bottomLeft}${emojis.line.repeat(Math.floor(lineWidth/2))}${box.bottomRight}`;
    return header;
}

// Function to create a category section in FLASH-MD style
function createCategorySection(categoryName, emoji, commands, prefix) {
    const catTitle = categoryName.toUpperCase();
    let section = `\n${emojis.rocket} ${styleTitle(`${emoji} ${catTitle}`)} ${emojis.rocket}\n`;
    section += `${emojis.line}${emojis.line}${emojis.line}${emojis.line}${emojis.line}${emojis.line}\n`;
    
    // Create a modern grid layout for commands with icons for each command
    let grid = '';
    const sortedCommands = [...commands].sort();
    
    // Command icons to make it visually appealing (cycling through different icons)
    const cmdIcons = [emojis.leaf, emojis.star, emojis.check, emojis.fire, emojis.wand];
    
    // Display commands in a better looking grid (2 per line)
    for (let i = 0; i < sortedCommands.length; i += 2) {
        const icon1 = cmdIcons[i % cmdIcons.length];
        const icon2 = cmdIcons[(i+1) % cmdIcons.length];
        
        const cmd1 = sortedCommands[i] ? `${icon1} ${styleCommand(prefix + sortedCommands[i])}` : '';
        const cmd2 = sortedCommands[i+1] ? `${icon2} ${styleCommand(prefix + sortedCommands[i+1])}` : '';
        
        grid += `${cmd1.padEnd(30)} ${cmd2}\n`;
    }
    
    section += grid;
    
    // Add detailed count with emoji
    section += `\n${emojis.info} ${styleSubtitle(`Total ${catTitle} Commands: ${sortedCommands.length}`)}\n`;
    section += `${emojis.dotline}${emojis.dotline}${emojis.dotline}${emojis.dotline}${emojis.dotline}\n`;
    
    return section;
}

// Function to create a FLASH-MD style compact category button
function createCompactCategory(categoryName, emoji, count, prefix) {
    return `${box.middleLeft} ${emoji} ${styleTitle(categoryName.padEnd(12))} ${styleSubtitle(`[${count}]`)} ${emojis.arrow} ${styleCommand(prefix + categoryName.toLowerCase())}\n`;
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
                    
                    // Create FLASH-MD style category menu with all commands
                    let menuText = createFlashHeader(`${config.bot.name} ${emojis.zap} ${categories[category]}`, 
                                                    `All ${commands.length} commands in this category`);
                    
                    menuText += `\n\n${createCategorySection(categories[category], categoryIcon, commands, prefix)}`;
                    
                    // Add footer with instructions
                    menuText += `\n${box.topLeft}${emojis.line.repeat(20)}${box.topRight}\n`;
                    menuText += `${box.middleLeft} ${emojis.gear} ${styleTitle('USAGE INFO')} ${box.middleRight}\n`;
                    menuText += `${box.middleLeft} ${emojis.info} Type ${styleCommand(prefix + 'help <command>')} ${box.middleRight}\n`;
                    menuText += `${box.middleLeft} ${emojis.arrow} Use ${styleCommand(prefix + 'menu')} to return ${box.middleRight}\n`;
                    menuText += `${box.bottomLeft}${emojis.line.repeat(20)}${box.bottomRight}\n\n`;
                    
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
                
                // Create FLASH-MD style main menu
                let menuText = '';
                
                // Title Box - FLASH-MD style header
                menuText += createFlashHeader(`${config.bot.name}`, `The Ultimate WhatsApp Assistant Bot`);
                
                // User Info Section - Enhanced with modern styling
                menuText += `\n\n${box.topLeft}${emojis.line.repeat(16)}${box.topRight}\n`;
                menuText += `${box.middleLeft} ${emojis.user} ${styleTitle('USER INFO')} ${box.middleRight}\n`;
                menuText += `${box.middleLeft} ${emojis.arrow} ${styleTitle('Name:')} ${styleSubtitle(username)}${box.middleRight}\n`;
                menuText += `${box.middleLeft} ${emojis.time} ${styleTitle('Time:')} ${styleSubtitle(currentTime)}${box.middleRight}\n`;
                menuText += `${box.middleLeft} ${emojis.globe} ${styleTitle('Date:')} ${styleSubtitle(currentDate)}${box.middleRight}\n`;
                menuText += `${box.middleLeft} ${emojis.online} ${styleTitle('Status:')} ${styleSubtitle('Online')}${box.middleRight}\n`;
                menuText += `${box.middleLeft} ${emojis.rocket} ${styleTitle('Uptime:')} ${styleSubtitle(uptimeStr)}${box.middleRight}\n`;
                menuText += `${box.bottomLeft}${emojis.line.repeat(16)}${box.bottomRight}\n\n`;
                
                // Command Categories Section - With better visual hierarchy
                menuText += `${box.topLeft}${emojis.line.repeat(20)}${box.topRight}\n`;
                menuText += `${box.middleLeft} ${emojis.robot} ${styleTitle('COMMAND MENU')} ${box.middleRight}\n`;
                menuText += `${box.bottomLeft}${emojis.line.repeat(20)}${box.bottomRight}\n\n`;
                
                let totalCommands = 0;
                
                // Add command categories with FLASH-MD compact layout
                for (const [cat, commands] of Object.entries(allCommands)) {
                    if (categories[cat] && commands.length > 0) {
                        const icon = categoryIcons[cat] || emojis.command;
                        menuText += createCompactCategory(categories[cat], icon, commands.length, prefix + 'menu ');
                        totalCommands += commands.length;
                    }
                }
                
                // Special Commands Section - Highlighted important commands
                menuText += `\n${box.topLeft}${emojis.line.repeat(18)}${box.topRight}\n`;
                menuText += `${box.middleLeft} ${emojis.zap} ${styleTitle('QUICK ACCESS')} ${box.middleRight}\n`;
                menuText += `${box.bottomLeft}${emojis.line.repeat(18)}${box.bottomRight}\n\n`;
                
                menuText += `${emojis.leaf} ${styleCommand(prefix + 'help')} - Get detailed help\n`;
                menuText += `${emojis.star} ${styleCommand(prefix + 'list')} - View all commands\n`;
                menuText += `${emojis.check} ${styleCommand(prefix + 'ping')} - Check bot response\n`;
                menuText += `${emojis.info} ${styleCommand(prefix + 'info')} - Bot information\n`;
                
                // Stats section - Command count with visual highlight
                menuText += `\n${box.topLeft}${emojis.line.repeat(16)}${box.topRight}\n`;
                menuText += `${box.middleLeft} ${emojis.fire} ${styleTitle('BOT STATS')} ${box.middleRight}\n`;
                menuText += `${box.middleLeft} ${styleTitle('Total Commands:')} ${styleHighlight(totalCommands)}${box.middleRight}\n`;
                menuText += `${box.middleLeft} ${styleTitle('Bot Version:')} ${styleSubtitle('v5.0.0')}${box.middleRight}\n`;
                menuText += `${box.bottomLeft}${emojis.line.repeat(16)}${box.bottomRight}\n\n`;
                
                // Inspirational Quote - With better styling
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
                
                // Create FLASH-MD style list menu
                let menuText = createFlashHeader('COMPLETE COMMAND LIST', 'All commands at your fingertips');
                menuText += '\n\n';
                
                let totalCommands = 0;
                
                // Generate category sections with FLASH-MD styling
                for (const [cat, commands] of Object.entries(allCommands)) {
                    if (categories[cat] && commands.length > 0) {
                        const icon = categoryIcons[cat] || emojis.command;
                        menuText += createCategorySection(categories[cat], icon, commands, prefix);
                        totalCommands += commands.length;
                    }
                }
                
                // Add footer with information in FLASH-MD box style
                menuText += `\n${box.topLeft}${emojis.line.repeat(18)}${box.topRight}\n`;
                menuText += `${box.middleLeft} ${emojis.gear} ${styleTitle('COMMAND INFO')} ${box.middleRight}\n`;
                menuText += `${box.middleLeft} ${styleTitle('TOTAL:')} ${styleHighlight(' ' + totalCommands + ' ')} ${box.middleRight}\n`;
                menuText += `${box.middleLeft} ${emojis.info} Use ${styleCommand(prefix + 'help <command>')} ${box.middleRight}\n`;
                menuText += `${box.middleLeft} ${emojis.arrow} ${styleCommand(prefix + 'menu')} for main menu ${box.middleRight}\n`;
                menuText += `${box.bottomLeft}${emojis.line.repeat(18)}${box.bottomRight}\n\n`;
                
                // Add inspirational quote with FLASH-MD styling
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
                    // Default help menu in FLASH-MD style
                    let helpText = createFlashHeader('HELP CENTER', 'Your guide to using the bot effectively');
                    
                    // User greeting with improved styling
                    helpText += `\n\n${box.topLeft}${emojis.line.repeat(20)}${box.topRight}\n`;
                    helpText += `${box.middleLeft} ${emojis.user} ${styleTitle('WELCOME, ' + username)} ${box.middleRight}\n`;
                    helpText += `${box.middleLeft} ${styleSubtitle('How can I assist you today?')} ${box.middleRight}\n`;
                    helpText += `${box.bottomLeft}${emojis.line.repeat(20)}${box.bottomRight}\n\n`;
                    
                    // Command Navigation Box with FLASH-MD styling
                    helpText += `${box.topLeft}${emojis.line.repeat(22)}${box.topRight}\n`;
                    helpText += `${box.middleLeft} ${emojis.robot} ${styleTitle('NAVIGATION GUIDE')} ${box.middleRight}\n`;
                    helpText += `${box.bottomLeft}${emojis.line.repeat(22)}${box.bottomRight}\n\n`;
                    
                    helpText += `${emojis.leaf} ${styleCommand(prefix + 'menu')} - View main menu\n`;
                    helpText += `${emojis.star} ${styleCommand(prefix + 'menu <category>')} - View category commands\n`;
                    helpText += `${emojis.check} ${styleCommand(prefix + 'help <command>')} - Get command help\n`;
                    helpText += `${emojis.fire} ${styleCommand(prefix + 'list')} - See all commands\n\n`;
                    
                    // Quick Start Section with enhanced visual appeal
                    helpText += `${box.topLeft}${emojis.line.repeat(18)}${box.topRight}\n`;
                    helpText += `${box.middleLeft} ${emojis.rocket} ${styleTitle('QUICK START')} ${box.middleRight}\n`;
                    helpText += `${box.bottomLeft}${emojis.line.repeat(18)}${box.bottomRight}\n\n`;
                    
                    helpText += `${emojis.wand} Try ${styleCommand(prefix + 'menu fun')} to see fun commands\n`;
                    helpText += `${emojis.gear} Use ${styleCommand(prefix + 'help sticker')} to learn about stickers\n`;
                    helpText += `${emojis.zap} Type ${styleCommand(prefix + 'ping')} to check if bot is responding\n\n`;
                    
                    // Tips Section with FLASH-MD design
                    helpText += `${box.topLeft}${emojis.line.repeat(10)}${box.topRight}\n`;
                    helpText += `${box.middleLeft} ${emojis.sparkle} ${styleTitle('PRO TIPS')} ${box.middleRight}\n`;
                    helpText += `${box.bottomLeft}${emojis.line.repeat(10)}${box.bottomRight}\n\n`;
                    
                    helpText += `${emojis.info} Commands with ${emojis.crown} require owner privileges\n`;
                    helpText += `${emojis.info} Some commands only work in groups\n`;
                    helpText += `${emojis.info} For media commands, send image/video with caption\n\n`;
                    
                    // Quote with elegant styling
                    helpText += `${emojis.dotline}${emojis.dotline}${emojis.dotline}${emojis.dotline}\n\n`;
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
                
                // Display command help in FLASH-MD style
                let helpText = createFlashHeader(`${commandName.toUpperCase()}`, 
                                              `${categoryIcon} ${foundIn} command`);
                helpText += '\n\n';
                
                // Command Info Box with FLASH-MD styling
                helpText += `${box.topLeft}${emojis.line.repeat(20)}${box.topRight}\n`;
                helpText += `${box.middleLeft} ${emojis.robot} ${styleTitle('COMMAND DETAILS')} ${box.middleRight}\n`;
                helpText += `${box.bottomLeft}${emojis.line.repeat(20)}${box.bottomRight}\n\n`;
                
                helpText += `${emojis.gear} ${styleTitle('Category:')} ${styleSubtitle(foundIn.charAt(0).toUpperCase() + foundIn.slice(1))}\n`;
                helpText += `${emojis.wand} ${styleTitle('Syntax:')} ${styleCommand(prefix + commandName)}\n\n`;
                
                // Usage Examples with FLASH-MD styling
                helpText += `${box.topLeft}${emojis.line.repeat(14)}${box.topRight}\n`;
                helpText += `${box.middleLeft} ${emojis.zap} ${styleTitle('USAGE')} ${box.middleRight}\n`;
                helpText += `${box.bottomLeft}${emojis.line.repeat(14)}${box.bottomRight}\n\n`;
                
                helpText += `${emojis.leaf} Basic: ${styleCommand(prefix + commandName)}\n`;
                helpText += `${emojis.star} With args: ${styleCommand(prefix + commandName + ' <text>')}\n\n`;
                
                // Command information in modern style
                helpText += `${box.topLeft}${emojis.line.repeat(18)}${box.topRight}\n`;
                helpText += `${box.middleLeft} ${emojis.info} ${styleTitle('COMMAND INFO')} ${box.middleRight}\n`;
                helpText += `${box.bottomLeft}${emojis.line.repeat(18)}${box.bottomRight}\n\n`;
                
                helpText += `This is a ${styleTitle(foundIn)} command that provides functionality related to ${styleSubtitle(foundIn)} operations.\n\n`;
                helpText += `${emojis.check} Try it out to discover all its features!\n`;
                helpText += `${emojis.check} For more help, ask the bot owner.\n\n`;
                
                // Related Commands in FLASH-MD compact style
                helpText += `${box.topLeft}${emojis.line.repeat(20)}${box.topRight}\n`;
                helpText += `${box.middleLeft} ${emojis.link} ${styleTitle('RELATED COMMANDS')} ${box.middleRight}\n`;
                helpText += `${box.bottomLeft}${emojis.line.repeat(20)}${box.bottomRight}\n\n`;
                
                helpText += `${emojis.command} Try ${styleCommand(prefix + 'menu ' + foundIn)} for similar commands\n\n`;
                
                // Quote with FLASH-MD styling
                helpText += `${emojis.dotline}${emojis.dotline}${emojis.dotline}${emojis.dotline}\n\n`;
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