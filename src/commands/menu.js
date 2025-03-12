/**
 * Modern WhatsApp MD Bot Menu System
 * Features elegant design, categorized commands, and dynamic loading
 */

const { languageManager } = require('../utils/language');
const config = require('../config/config');
const logger = require('../utils/logger');
const fs = require('fs').promises;
const path = require('path');
const { commandLoader } = require('../utils/commandLoader');
const moment = require('moment');

/**
 * Loads commands from all directories and builds category structure
 */
async function loadAllCommands() {
    const commandsPath = path.join(__dirname);
    const commandFiles = await fs.readdir(commandsPath);
    const allCommands = {};
    let totalCommands = 0;
    
    // Process a module to extract commands
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
    
    // Load commands from JS files in the commands directory
    for (const file of commandFiles) {
        if (file.endsWith('.js') && file !== 'index.js' && file !== 'menu.js') {
            try {
                const moduleData = require(`./${file}`);
                const categoryName = file.replace('.js', '');
                processModule(moduleData, categoryName);
            } catch (err) {
                logger.error(`Error loading commands from ${file}:`, err);
            }
        }
    }
    
    // Load commands from subdirectories
    for (const item of commandFiles) {
        const itemPath = path.join(commandsPath, item);
        try {
            const stats = await fs.stat(itemPath);
            
            if (stats.isDirectory()) {
                // Try index.js first
                try {
                    const moduleData = require(`./${item}/index.js`);
                    processModule(moduleData, item);
                } catch (indexErr) {
                    // If index.js fails, try individual files
                    try {
                        const subFiles = await fs.readdir(itemPath);
                        for (const subFile of subFiles) {
                            if (subFile.endsWith('.js') && subFile !== 'index.js') {
                                try {
                                    const subModule = require(`./${item}/${subFile}`);
                                    processModule(subModule, item);
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
    
    return { allCommands, totalCommands };
}

// Emoji mapping for categories
const categoryEmojis = {
    'owner': '👑',
    'basic': '🧩',
    'educational': '📚',
    'fun': '🎮',
    'group': '👥',
    'media': '📽️',
    'nsfw': '🔞',
    'reactions': '💫',
    'user': '👤',
    'utility': '🛠️',
    'group_new': '👥',
    
    // Add more as needed
    'default': '📋'
};

// Pretty names for categories
const categoryNames = {
    'owner': 'Owner',
    'basic': 'Basic',
    'educational': 'Educational',
    'fun': 'Fun & Games',
    'group': 'Group Management',
    'media': 'Media Tools',
    'nsfw': 'NSFW',
    'reactions': 'Reactions',
    'user': 'User Profile',
    'utility': 'Utilities',
    'group_new': 'Group Advanced',
    
    // Add more as needed
    'default': 'Misc'
};

// Decorative symbols
const symbols = {
    divider: '┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄',
    bullet: '•',
    arrow: '➤',
    star: '✦',
    check: '✓',
    dot: '∙',
    heart: '♡',
    sparkle: '✧',
    diamond: '♦',
    circle: '○',
    square: '■',
    flower: '✿',
    line: '━━━━━━━━━━━━━━━━━',
    doubleLine: '═════════════════'
};

/**
 * Creates a beautifully formatted menu header
 */
function createHeader(botName, totalCommands, uptime) {
    return `╭────❮ *${botName}* ❯────╮
│
│ *📊 Status:* Online
│ *⏰ Uptime:* ${uptime}
│ *🔢 Commands:* ${totalCommands}
│
╰────────────────╯

${symbols.line}
`;
}

/**
 * Creates a nicely formatted category section
 */
function createCategorySection(categoryName, commands, prefix) {
    const emoji = categoryEmojis[categoryName] || categoryEmojis.default;
    const prettyName = categoryNames[categoryName] || categoryNames.default;
    
    let section = `\n*${emoji} ${prettyName.toUpperCase()}*\n${symbols.divider}\n`;
    
    // Format commands in a clean 2-column layout when possible
    const sortedCommands = [...commands].sort();
    const commandsPerLine = 2;
    
    for (let i = 0; i < sortedCommands.length; i += commandsPerLine) {
        const commandsInThisLine = sortedCommands.slice(i, i + commandsPerLine);
        const formattedCommands = commandsInThisLine.map(cmd => `${symbols.bullet} \`${prefix}${cmd}\``);
        section += formattedCommands.join(' ᅠ ᅠ ') + '\n';
    }
    
    return section;
}

/**
 * Creates a compact category summary
 */
function createCategorySummary(categories) {
    let summary = `*📂 COMMAND CATEGORIES*\n${symbols.divider}\n`;
    
    Object.keys(categories).forEach(category => {
        const emoji = categoryEmojis[category] || categoryEmojis.default;
        const prettyName = categoryNames[category] || categoryNames.default;
        const count = categories[category].length;
        
        summary += `${emoji} *${prettyName}* - ${count} commands\n`;
    });
    
    return summary;
}

/**
 * Create footer with usage instructions
 */
function createFooter(prefix) {
    return `
${symbols.line}
*💡 USAGE TIPS*
${symbols.divider}
• Type \`${prefix}menu [category]\` for specific category
• Type \`${prefix}help [command]\` for command details
• Use \`${prefix}\` as command prefix

_Powered by @whiskeysockets/baileys_`;
}

// Define menu commands
const menuCommands = {
    category: 'basic',
    commands: {
        /**
         * Main menu command with category filtering
         */
        async menu(sock, message, args) {
            try {
                const sender = message.key.remoteJid;
                const username = message.pushName || 'User';
                const uptime = process.uptime();
                const uptimeStr = moment.duration(uptime, 'seconds').humanize();
                const prefix = config.bot.prefix;
                
                // Check if specific category requested
                const category = args[0]?.toLowerCase();
                
                // Load all commands
                const { allCommands, totalCommands } = await loadAllCommands();
                
                if (category && allCommands[category]) {
                    // Show specific category
                    const commands = allCommands[category];
                    
                    const menuText = `${createHeader(config.bot.name, commands.length, uptimeStr)}` +
                                     `${createCategorySection(category, commands, prefix)}` +
                                     `${createFooter(prefix)}`;
                    
                    await sock.sendMessage(sender, { text: menuText });
                    return;
                }
                
                // Show all categories in summary view
                const header = createHeader(config.bot.name, totalCommands, uptimeStr);
                const categorySummary = createCategorySummary(allCommands);
                const footer = createFooter(prefix);
                
                const menuText = `${header}${categorySummary}${footer}`;
                
                await sock.sendMessage(sender, { text: menuText });
                
            } catch (err) {
                logger.error('Menu command error:', err);
                await sock.sendMessage(message.key.remoteJid, { 
                    text: '❌ Error generating menu. Please try again.' 
                });
            }
        },
        
        /**
         * List all commands in a category or all categories
         */
        async list(sock, message, args) {
            try {
                const sender = message.key.remoteJid;
                const prefix = config.bot.prefix;
                
                // Check if specific category requested
                const category = args[0]?.toLowerCase();
                
                // Load all commands
                const { allCommands, totalCommands } = await loadAllCommands();
                
                if (category && allCommands[category]) {
                    // Show specific category
                    const commands = allCommands[category];
                    const emoji = categoryEmojis[category] || categoryEmojis.default;
                    const prettyName = categoryNames[category] || categoryNames.default;
                    
                    let listText = `*${emoji} ${prettyName} Commands*\n${symbols.divider}\n`;
                    commands.sort().forEach(cmd => {
                        listText += `${symbols.bullet} \`${prefix}${cmd}\`\n`;
                    });
                    
                    listText += `\n_Total: ${commands.length} commands_`;
                    
                    await sock.sendMessage(sender, { text: listText });
                    return;
                }
                
                // List all categories
                let listText = `*📋 All Command Categories*\n${symbols.divider}\n`;
                
                Object.keys(allCommands).forEach(cat => {
                    const emoji = categoryEmojis[cat] || categoryEmojis.default;
                    const prettyName = categoryNames[cat] || categoryNames.default;
                    const count = allCommands[cat].length;
                    
                    listText += `${emoji} *${prettyName}* - ${count} commands\n`;
                });
                
                listText += `\n_To see commands in a category:_\n\`${prefix}list [category]\``;
                
                await sock.sendMessage(sender, { text: listText });
                
            } catch (err) {
                logger.error('List command error:', err);
                await sock.sendMessage(message.key.remoteJid, { 
                    text: '❌ Error listing commands. Please try again.' 
                });
            }
        },
        
        /**
         * Display help for a specific command
         */
        async help(sock, message, args) {
            try {
                const sender = message.key.remoteJid;
                const prefix = config.bot.prefix;
                const commandName = args[0]?.toLowerCase();
                
                if (!commandName) {
                    // No specific command requested, show general help
                    const helpText = `*📚 Command Help*
${symbols.divider}
To get help with a specific command, type:
\`${prefix}help [command]\`

For a list of all commands:
\`${prefix}menu\` - Show all categories
\`${prefix}list\` - List all categories
\`${prefix}list [category]\` - List commands in category

*Examples:*
\`${prefix}help sticker\` - Get help with sticker command
\`${prefix}list media\` - List all media commands`;
                    
                    await sock.sendMessage(sender, { text: helpText });
                    return;
                }
                
                // Try to find the command in all modules
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
                
                if (foundCommand) {
                    // Get the appropriate category emoji
                    const emoji = categoryEmojis[foundIn] || categoryEmojis.default;
                    
                    // Find command configuration for more details if available
                    let configInfo = "No additional information available.";
                    try {
                        const configPath = path.join(__dirname, '../config/commands', `${foundIn}.json`);
                        const configData = await fs.readFile(configPath, 'utf8');
                        const configs = JSON.parse(configData);
                        
                        const cmdConfig = configs.find(cmd => cmd.name === commandName);
                        if (cmdConfig) {
                            configInfo = cmdConfig.description || configInfo;
                        }
                    } catch (err) {
                        // Config file might not exist, that's ok
                    }
                    
                    const helpText = `*${emoji} Command: ${prefix}${commandName}*
${symbols.divider}
*Category:* ${categoryNames[foundIn] || foundIn}
*Description:* ${configInfo}

*Usage:* \`${prefix}${commandName}\``;
                    
                    await sock.sendMessage(sender, { text: helpText });
                } else {
                    await sock.sendMessage(sender, { 
                        text: `❌ Command "${commandName}" not found. Use \`${prefix}menu\` to see available commands.` 
                    });
                }
                
            } catch (err) {
                logger.error('Help command error:', err);
                await sock.sendMessage(message.key.remoteJid, { 
                    text: '❌ Error providing help. Please try again.' 
                });
            }
        }
    }
};

module.exports = {
    commands: menuCommands,
    category: 'basic',
    async init() {
        try {
            logger.info('Initializing modern menu system...');
            return true;
        } catch (error) {
            logger.error('Failed to initialize menu system:', error);
            return false;
        }
    }
};