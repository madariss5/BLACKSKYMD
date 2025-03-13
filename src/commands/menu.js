/**
 * Modern WhatsApp MD Bot Menu System
 */

const { languageManager } = require('../utils/language');
const config = require('../config/config');
const logger = require('../utils/logger');
const fs = require('fs').promises;
const path = require('path');

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
    'user_extended': '👨‍💼', 
    'utility': '🛠️',
    'group_new': '👥',
    'menu': '📋',
    'default': '📄'
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
    'user_extended': 'Extended Profile',
    'utility': 'Utilities',
    'group_new': 'Group Advanced',
    'menu': 'Menu System',
    'default': 'Misc'
};

// Decorative symbols
const symbols = {
    bullet: '•',
    arrow: '➤',
    star: '✦',
    info: 'ℹ️',
    line: '━━━━━━━━━━━━━━━━━'
};

/**
 * Load all available commands from command files
 */
async function loadAllCommands() {
    try {
        const commandsPath = path.join(__dirname);
        const commandFiles = await getAllFiles(commandsPath);
        const allCommands = {};
        let totalCommands = 0;

        // Process a command module to extract commands
        const processCommandModule = (moduleData, category) => {
            try {
                let commands = moduleData.commands || moduleData;
                let categoryName = moduleData.category || category;

                if (typeof commands !== 'object') return 0;

                const commandList = Object.keys(commands).filter(cmd => 
                    typeof commands[cmd] === 'function' && cmd !== 'init'
                );

                if (commandList.length > 0) {
                    if (!allCommands[categoryName]) {
                        allCommands[categoryName] = [];
                    }
                    allCommands[categoryName].push(...commandList);
                    totalCommands += commandList.length;
                }

                return commandList.length;
            } catch (err) {
                logger.error(`Error processing command module: ${err}`);
                return 0;
            }
        };

        // Recursively get all files in directory
        async function getAllFiles(dir) {
            const entries = await fs.readdir(dir, { withFileTypes: true });
            const files = await Promise.all(entries.map(entry => {
                const fullPath = path.join(dir, entry.name);
                return entry.isDirectory() ? getAllFiles(fullPath) : fullPath;
            }));
            return files.flat();
        }

        // Load commands from all JS files
        for (const file of commandFiles) {
            if (file.endsWith('.js') && !['index.js', 'menu.js'].includes(path.basename(file))) {
                try {
                    const filePath = file;
                    const moduleData = require(filePath);
                    const category = path.basename(file, '.js');
                    processCommandModule(moduleData, category);
                } catch (err) {
                    logger.error(`Error loading commands from ${file}:`, err);
                }
            }
        }

        logger.info(`Loaded ${totalCommands} commands from ${Object.keys(allCommands).length} categories`);
        return { allCommands, totalCommands };
    } catch (err) {
        logger.error('Error loading commands:', err);
        return { allCommands: {}, totalCommands: 0 };
    }
}

/**
 * Create menu header
 */
function createHeader(botName, totalCommands, uptime) {
    return `┏━━━❮ *${botName.toUpperCase()}* ❯━━━┓
┃
┃ *📊 Status:* Online ✅
┃ *⏰ Uptime:* ${uptime}
┃ *🔢 Commands:* ${totalCommands}
┃
┗━━━━━━━━━━━━━━━━━━━━┛

${symbols.line}`;
}

/**
 * Create category section
 */
function createCategorySection(category, commands, prefix) {
    const emoji = categoryEmojis[category] || categoryEmojis.default;
    const prettyName = categoryNames[category] || categoryNames.default;

    let section = `\n┌───「 *${emoji} ${prettyName.toUpperCase()}* 」───┐\n`;
    const sortedCommands = [...commands].sort();

    for (const cmd of sortedCommands) {
        section += `┃ ${symbols.bullet} \`${prefix}${cmd}\`\n`;
    }

    section += `└─────────${symbols.line}─────────┘\n`;
    return section;
}

// Menu command handlers
const menuCommands = {
    async menu(sock, message, args) {
        try {
            const sender = message.key.remoteJid;
            const prefix = config.bot.prefix;
            const { allCommands, totalCommands } = await loadAllCommands();
            
            // Import language manager for translations
            const { languageManager } = require('../utils/language');
            
            // Get user's preferred language
            const userLang = config.bot.language || 'en';
            
            // Check if specific category requested
            const category = args[0]?.toLowerCase();
            
            if (category && allCommands[category]) {
                // Show commands in specific category - Flash-MD style
                // Get translated category name
                let categoryDisplayName = categoryNames[category] || category;
                const categoryKey = `menu.${category}_category`;
                const translatedCategory = languageManager.getText(categoryKey, userLang, null);
                if (translatedCategory && translatedCategory !== categoryKey) {
                    categoryDisplayName = translatedCategory;
                }
                
                const emoji = categoryEmojis[category] || categoryEmojis.default;
                
                // Use Flash-MD style box design
                let menuText = `┏━━━❮ *${emoji} ${categoryDisplayName} ${languageManager.getText('menu.commands', userLang, 'Commands')}* ❯━━━┓\n┃\n`;
                
                // Sort commands alphabetically
                const commands = [...allCommands[category]].sort();
                
                // Display commands in a vertical list (Flash-MD style)
                for (const cmd of commands) {
                    menuText += `┃ ${symbols.bullet} \`${prefix}${cmd}\`\n`;
                }
                
                // Add footer with command count
                menuText += `┃\n┃ ${symbols.info} ${languageManager.getText('menu.total_commands', userLang).replace('%s', commands.length)}\n`;
                menuText += `┗━━━━━━━━━━━━━━━━━━━━┛`;
                
                await sock.sendMessage(sender, { text: menuText });
                return;
            }
            
            // Show categories menu with Flash-MD style
            const botName = config.bot.name || "𝔹𝕃𝔸ℂ𝕂𝕊𝕂𝕐-𝕄𝔻";
            let menuText = `┏━━━❮ *📋 ${languageManager.getText('menu.categories', userLang)}* ❯━━━┓\n┃\n`;
            menuText += `┃ *${botName}* - ${languageManager.getText('menu.total_commands', userLang).replace('%s', totalCommands)}\n┃\n`;
            
            // Organize categories in a clean, vertical list
            const categories = Object.keys(allCommands);
            
            // Sort categories for a better user experience
            const orderedCategories = [
                'basic', 'utility', 'group', 'media', 'fun', 
                'reactions', 'user', 'user_extended', 'educational', 
                'nsfw', 'owner', 'menu'
            ].filter(cat => categories.includes(cat));
            
            // Add any remaining categories that might not be in the ordered list
            categories.forEach(cat => {
                if (!orderedCategories.includes(cat)) {
                    orderedCategories.push(cat);
                }
            });
            
            // Display categories in Flash-MD style
            for (const cat of orderedCategories) {
                const emoji = categoryEmojis[cat] || categoryEmojis.default;
                
                // Get translated category name
                let categoryDisplayName = categoryNames[cat] || cat;
                const categoryKey = `menu.${cat}_category`;
                const translatedCategory = languageManager.getText(categoryKey, userLang, null);
                if (translatedCategory && translatedCategory !== categoryKey) {
                    categoryDisplayName = translatedCategory;
                }
                
                menuText += `┃ ${emoji} *${categoryDisplayName}* - ${allCommands[cat].length} ${languageManager.getText('menu.commands', userLang, 'commands')}\n`;
            }
            
            // Add footer with instructions
            menuText += `┃\n┃ ${symbols.arrow} ${languageManager.getText('menu.category_info', userLang, prefix).replace('%s', prefix)}\n`;
            menuText += `┃ ${symbols.arrow} ${languageManager.getText('menu.command_help_info', userLang, prefix).replace('%s', prefix)}\n`;
            menuText += `┗━━━━━━━━━━━━━━━━━━━━┛`;
            
            // Send menu with image if possible
            try {
                // Use bot's icon or a generic image
                const imageUrl = 'https://i.ibb.co/Wn0nczF/BLACKSKY-icon.png'; // Default image
                
                await sock.sendMessage(sender, { 
                    image: { url: imageUrl },
                    caption: menuText
                });
            } catch (imgErr) {
                // Fallback to text-only if image fails
                logger.warn('Failed to send menu with image, sending text-only', imgErr);
                await sock.sendMessage(sender, { text: menuText });
            }
        } catch (err) {
            logger.error('Menu command error:', err);
            await sock.sendMessage(message.key.remoteJid, { 
                text: `❌ ${languageManager.getText('menu.error_generating', userLang, 'Error generating menu. Please try again.')}` 
            });
        }
    },

    async list(sock, message, args) {
        try {
            const sender = message.key.remoteJid;
            const prefix = config.bot.prefix;
            const { allCommands, totalCommands } = await loadAllCommands();
            
            // Get user's preferred language
            const userLang = config.bot.language || 'en';

            // Check if specific category requested
            const category = args[0]?.toLowerCase();

            if (category && allCommands[category]) {
                const emoji = categoryEmojis[category] || categoryEmojis.default;
                
                // Try to get translated category name
                let categoryDisplayName = categoryNames[category] || categoryNames.default;
                const categoryKey = `menu.${category}_category`;
                const translatedCategory = languageManager.getText(categoryKey, userLang, null);
                if (translatedCategory && translatedCategory !== categoryKey) {
                    categoryDisplayName = translatedCategory;
                }
                
                let listText = `*${emoji} ${categoryDisplayName} ${languageManager.getText('menu.commands', userLang, 'Commands')}*\n${symbols.line}\n`;

                const sortedCommands = [...allCommands[category]].sort();
                sortedCommands.forEach(cmd => {
                    listText += `${symbols.bullet} \`${prefix}${cmd}\`\n`;
                });

                listText += `\n_${languageManager.getText('menu.total_commands', userLang, totalCommands)}_`;
                await sock.sendMessage(sender, { text: listText });
                return;
            }

            // List all categories
            let listText = `*📂 ${languageManager.getText('menu.categories', userLang)}*\n${symbols.line}\n`;
            
            for (const [cat, commands] of Object.entries(allCommands)) {
                const emoji = categoryEmojis[cat] || categoryEmojis.default;
                
                // Try to get translated category name
                let categoryDisplayName = categoryNames[cat] || categoryNames.default;
                const categoryKey = `menu.${cat}_category`;
                const translatedCategory = languageManager.getText(categoryKey, userLang, null);
                if (translatedCategory && translatedCategory !== categoryKey) {
                    categoryDisplayName = translatedCategory;
                }
                
                listText += `${emoji} *${categoryDisplayName}* - ${commands.length} ${languageManager.getText('menu.commands', userLang, 'commands')}\n`;
            }

            listText += `\n_${languageManager.getText('menu.total_commands', userLang, totalCommands)}_\n`;
            listText += `\n${languageManager.getText('menu.see_commands', userLang, prefix)}`;

            await sock.sendMessage(sender, { text: listText });
        } catch (err) {
            logger.error('List command error:', err);
            await sock.sendMessage(message.key.remoteJid, { 
                text: `❌ ${languageManager.getText('menu.error_listing', userLang, 'Error listing commands. Please try again.')}` 
            });
        }
    },

    async menu1(sock, message, args) {
        try {
            const sender = message.key.remoteJid;
            const prefix = config.bot.prefix;
            const { allCommands, totalCommands } = await loadAllCommands();
            
            // Import language manager for translations
            const { languageManager } = require('../utils/language');
            
            // Get user's preferred language
            const userLang = config.bot.language || 'en';
            
            // Get bot information
            const botName = config.bot.name || "𝔹𝕃𝔸ℂ𝕂𝕊𝕂𝕐-𝕄𝔻";
            const owner = config.owner?.name || "Admin";
            
            // Create Flash-MD style header with emojis - translated based on user's language
            let menuText = `╭─「 *${botName}* 」─⊲\n`;
            menuText += `│ *🤖 ${languageManager.getText('menu.commands_count', userLang, totalCommands)}*\n`;
            menuText += `│ *📅 ${languageManager.getText('basic.date', userLang, 'Date')}:* ${new Date().toLocaleDateString()}\n`;
            menuText += `│ *👤 ${languageManager.getText('basic.owner', userLang, 'Owner')}:* ${owner}\n`;
            menuText += `│ *🔑 ${languageManager.getText('menu.prefix_info', userLang, prefix)}*\n`;
            menuText += `╰────────────────⊲\n\n`;
            
            // Generate modern Flash-MD style menu with all commands
            menuText += `┏━━『 *${languageManager.getText('menu.command_list', userLang)}* 』━━\n`;
            
            // Order categories in a specific way for better user experience - Translated category names
            const orderedCategories = [
                { id: 'basic', name: languageManager.getText('menu.basic_category', userLang, 'Basic') },
                { id: 'utility', name: languageManager.getText('menu.utility_category', userLang, 'Utilities') },
                { id: 'group', name: languageManager.getText('menu.group_category', userLang, 'Group Management') },
                { id: 'media', name: languageManager.getText('menu.media_category', userLang, 'Media Tools') },
                { id: 'fun', name: languageManager.getText('menu.fun_category', userLang, 'Fun & Games') },
                { id: 'reactions', name: languageManager.getText('menu.reactions_category', userLang, 'Reactions') },
                { id: 'user', name: languageManager.getText('menu.user_category', userLang, 'User Profile') },
                { id: 'user_extended', name: languageManager.getText('menu.user_extended_category', userLang, 'Extended User') },
                { id: 'educational', name: languageManager.getText('menu.educational_category', userLang, 'Educational') },
                { id: 'nsfw', name: languageManager.getText('menu.nsfw_category', userLang, 'NSFW') },
                { id: 'owner', name: languageManager.getText('menu.owner_category', userLang, 'Owner Commands') },
                { id: 'menu', name: languageManager.getText('menu.menu_category', userLang, 'Menu Commands') }
            ];
            
            // Add quick commands section
            menuText += `┃ ⚡ *${languageManager.getText('menu.quick_commands', userLang)}*\n`;
            const quickCommands = ['help', 'menu', 'ping', 'profile', 'sticker'];
            
            for (const cmd of quickCommands) {
                menuText += `┃ ➣ ${prefix}${cmd}\n`;
            }
            
            menuText += `┃\n`; // Add space between sections
            
            // Add popular commands section based on language
            menuText += `┃ 🔥 *${languageManager.getText('menu.popular_commands', userLang)}*\n`;
            // Popular commands might differ by language/region
            const popularCommands = userLang === 'de' 
                ? ['sticker', 'play', 'quote', 'meme', 'joke'] 
                : ['sticker', 'play', 'meme', 'joke', 'info'];
            
            for (const cmd of popularCommands) {
                menuText += `┃ ➣ ${prefix}${cmd}\n`;
            }
            
            menuText += `┃\n`; // Add space between sections
            
            // Get filtered and ordered categories
            for (const category of orderedCategories) {
                const commands = allCommands[category.id];
                if (!commands || commands.length === 0) continue;
                
                const emoji = categoryEmojis[category.id] || categoryEmojis.default;
                
                menuText += `┃ ✦ ${emoji} *${category.name}*\n`;
                
                // Format commands vertically, showing only the first 5 commands for each category
                const sortedCommands = [...commands].sort();
                const displayCommands = sortedCommands.slice(0, 5);
                
                // Display each command on its own line (Flash-MD style)
                for (const cmd of displayCommands) {
                    menuText += `┃ ➣ ${prefix}${cmd}\n`;
                }
                
                // Show command count and how to see more
                if (sortedCommands.length > 5) {
                    const remainingCount = sortedCommands.length - 5;
                    menuText += `┃ ✧ +${remainingCount} ${languageManager.getText('menu.commands', userLang, 'commands')}\n`;
                    menuText += `┃ ✧ ${languageManager.getText('menu.see_commands', userLang, prefix)}\n`;
                }
                
                menuText += `┃\n`; // Add space between categories
            }
            
            // Add footer with tips
            menuText += `┗━━━━━━━━━━━━━━━\n\n`;
            menuText += `${languageManager.getText('menu.menu_footer', userLang, prefix)}\n`;
            
            // Send menu with image if possible
            try {
                // Use bot's icon or a generic image
                const imageUrl = 'https://i.ibb.co/Wn0nczF/BLACKSKY-icon.png'; // Default image
                
                await sock.sendMessage(sender, { 
                    image: { url: imageUrl },
                    caption: menuText
                });
            } catch (imgErr) {
                // Fallback to text-only if image fails
                logger.warn('Failed to send menu with image, sending text-only', imgErr);
                await sock.sendMessage(sender, { text: menuText });
            }
            
        } catch (err) {
            logger.error('Menu1 command error:', err);
            await sock.sendMessage(message.key.remoteJid, { 
                text: `❌ ${languageManager.getText('menu.error_generating', userLang, 'Error generating menu. Please try again.')}` 
            });
        }
    },
    
    async help(sock, message, args) {
        try {
            const sender = message.key.remoteJid;
            const prefix = config.bot.prefix;
            const commandName = args[0]?.toLowerCase();
            
            // Import language manager for translations
            const { languageManager } = require('../utils/language');
            
            // Get user's preferred language
            const userLang = config.bot.language || 'en';

            if (!commandName) {
                // No specific command requested, show general help with modern styling
                const helpText = `┏━━━❮ *📚 ${languageManager.getText('menu.command_help', userLang)}* ❯━━━┓
┃
┃ ${symbols.arrow} ${languageManager.getText('menu.command_info', userLang)}:
┃   \`${prefix}help [command]\`
┃
┃ ${symbols.arrow} ${languageManager.getText('menu.available_commands', userLang)}:
┃   \`${prefix}menu\` - ${languageManager.getText('menu.categories', userLang)}
┃   \`${prefix}menu1\` - ${languageManager.getText('menu.bot_menu', userLang)}
┃   \`${prefix}list\` - ${languageManager.getText('menu.categories', userLang)}
┃   \`${prefix}list [category]\` - ${languageManager.getText('menu.category', userLang)}
┃
┃ ${symbols.star} *${languageManager.getText('menu.help_examples', userLang)}:*
┃   \`${prefix}help sticker\`
┃   \`${prefix}list media\`
┃
┗━━━━━━━━━━━━━━━━━━━━┛`;

                await sock.sendMessage(sender, { text: helpText });
                return;
            }

            // Find command details
            const commandsPath = path.join(__dirname);
            const commandFiles = await getAllFiles(commandsPath);
            let foundCommand = null;
            let foundIn = null;

            for (const file of commandFiles) {
                if (file.endsWith('.js') && path.basename(file) !== 'index.js') {
                    try {
                        const moduleData = require(file);
                        let commandsObject = moduleData.commands || moduleData;

                        if (commandsObject[commandName] && typeof commandsObject[commandName] === 'function') {
                            foundCommand = commandsObject[commandName];
                            foundIn = moduleData.category || path.basename(file, '.js');
                            break;
                        }
                    } catch (err) {
                        logger.error(`Error checking command in ${file}:`, err);
                    }
                }
            }

            if (foundCommand) {
                const emoji = categoryEmojis[foundIn] || categoryEmojis.default;

                // Get command configuration
                let configInfo = languageManager.getText('menu.no_info_available', userLang, "No additional information available.");
                try {
                    const configPath = path.join(__dirname, '../config/commands', `${foundIn}.json`);
                    const configData = await fs.readFile(configPath, 'utf8');
                    const configs = JSON.parse(configData);

                    const cmdConfig = configs.commands?.find(cmd => cmd.name === commandName);
                    if (cmdConfig) {
                        configInfo = cmdConfig.description || configInfo;
                    }
                } catch (err) {
                    // Config file might not exist, that's ok
                }
                
                // Get properly translated category name
                let categoryDisplayName = categoryNames[foundIn] || foundIn;
                // Try to get a translated category name
                const categoryKey = `menu.${foundIn}_category`;
                const translatedCategory = languageManager.getText(categoryKey, userLang, null);
                if (translatedCategory && translatedCategory !== categoryKey) {
                    categoryDisplayName = translatedCategory;
                }

                const helpText = `┏━━━❮ *${emoji} ${languageManager.getText('menu.command_info', userLang)}* ❯━━━┓
┃
┃ *${symbols.star} ${languageManager.getText('commands.help.command_info', userLang, commandName)}* \`${prefix}${commandName}\`
┃ *${symbols.bullet} ${languageManager.getText('menu.category', userLang)}:* ${categoryDisplayName}
┃
┃ *${symbols.arrow} ${languageManager.getText('menu.description', userLang)}:* 
┃   ${configInfo}
┃
┃ *${symbols.bullet} ${languageManager.getText('menu.usage', userLang)}:* 
┃   \`${prefix}${commandName}\`
┃
┗━━━━━━━━━━━━━━━━━━━━┛`;

                await sock.sendMessage(sender, { text: helpText });
            } else {
                await sock.sendMessage(sender, { 
                    text: languageManager.getText('menu.command_not_found', userLang, commandName, prefix)
                });
            }

        } catch (err) {
            logger.error('Help command error:', err);
            await sock.sendMessage(message.key.remoteJid, { 
                text: `❌ ${languageManager.getText('basic.help.error', config.bot.language || 'en')}` 
            });
        }
    }
};

module.exports = {
    commands: menuCommands,
    category: 'menu',
    async init() {
        try {
            logger.info('Initializing menu system...');
            await loadAllCommands();
            logger.info('Menu system initialized successfully');
            return true;
        } catch (err) {
            logger.error('Failed to initialize menu system:', err);
            return false;
        }
    }
};