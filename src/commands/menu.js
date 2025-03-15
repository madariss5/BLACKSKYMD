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

// Import necessary utilities
const { safeSendText, safeSendMessage, safeSendImage } = require('../utils/jidHelper');

// Symbols for menu formatting
const symbols = {
    arrow: "➣",
    bullet: "•",
    star: "✦",
    dot: "·"
};

// Menu command handlers
const menuCommands = {
    async menu(sock, message, args) {
        try {
            const sender = message.key.remoteJid;
            const prefix = config.bot.prefix || '!';
            const { allCommands, totalCommands } = await loadAllCommands();

            // Get user's preferred language
            const userLang = config.bot.language || 'en';

            // Create Flash-MD style header
            let menuText = `┏━━━❮ *🤖 BLACKSKY-MD* ❯━━━┓\n`;
            menuText += `┃ ✦ *Total Commands:* ${totalCommands}\n`;
            menuText += `┃ ✦ *Prefix:* ${prefix}\n`;
            menuText += `┗━━━━━━━━━━━━━━━━━┛\n\n`;

            // Order categories for better organization
            const orderedCategories = [
                'basic', 'utility', 'group', 'media', 'fun',
                'reactions', 'user', 'user_extended', 'educational',
                'nsfw', 'menu'
                // 'owner' is hidden from normal menu as it's admin-only
            ].filter(cat => allCommands[cat] && allCommands[cat].length > 0);

            // Add any remaining categories
            Object.keys(allCommands).forEach(cat => {
                if (!orderedCategories.includes(cat) && allCommands[cat].length > 0) {
                    orderedCategories.push(cat);
                }
            });

            // Display each category and its commands
            for (const category of orderedCategories) {
                const emoji = categoryEmojis[category] || categoryEmojis.default;
                const commands = allCommands[category];

                if (!commands || commands.length === 0) continue;

                // Get translated category name
                let categoryDisplayName = categoryNames[category] || category;
                const categoryKey = `menu.${category}_category`;
                const translatedCategory = languageManager.getText(categoryKey, userLang, null);
                if (translatedCategory && translatedCategory !== categoryKey) {
                    categoryDisplayName = translatedCategory;
                }

                menuText += `┌──『 ${emoji} *${categoryDisplayName}* 』\n`;

                // Sort commands alphabetically
                const sortedCommands = [...commands].sort();

                // Display each command
                for (const cmd of sortedCommands) {
                    menuText += `│ ➣ ${prefix}${cmd}\n`;
                }

                menuText += `└──────────────\n`;
            }

            // Add footer with tips
            menuText += `\n✦ Use *${prefix}help <command>* for detailed info\n`;
            menuText += `✦ Example: *${prefix}help sticker*\n`;

            // Send menu with image if possible
            try {
                // First try with local image file if available, then fallback to URL
                const localImagePath = path.join(process.cwd(), 'generated-icon.png');
                
                // Check if local image exists
                try {
                    await fs.access(localImagePath);
                    // Local image exists, use it
                    await safeSendMessage(sock, sender, {
                        image: { url: localImagePath },
                        caption: menuText
                    });
                } catch (accessErr) {
                    // Local file doesn't exist, try URL
                    // The URL method can cause issues, use safeSendImage method instead
                    await safeSendImage(sock, sender, 'https://i.ibb.co/Wn0nczF/BLACKSKY-icon.png', menuText);
                }
            } catch (imgErr) {
                logger.warn('Failed to send menu with image, sending text-only', imgErr);
                await safeSendText(sock, sender, menuText);
            }

        } catch (err) {
            logger.error('Menu command error:', err);
            await safeSendText(sock, message.key.remoteJid, `❌ Error generating menu. Please try again.`
            );
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
        
                await safeSendText(sock, sender, helpText);
                return;
            }
        
            // Find command details
            const commandsPath = path.join(process.cwd(), 'src/commands');
            const commandFiles = await fs.readdir(commandsPath);
            let foundCommand = null;
            let foundIn = null;
        
            for (const file of commandFiles) {
                if (file.endsWith('.js') && path.basename(file) !== 'index.js') {
                    try {
                        const moduleData = require(path.join(commandsPath, file));
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
                    const configPath = path.join(process.cwd(), 'src/config/commands', `${foundIn}.json`);
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
        
                await safeSendText(sock, sender, helpText);
            } else {
                await safeSendText(sock, sender, languageManager.getText('menu.command_not_found', userLang, commandName, prefix)
                );
            }
        
        } catch (err) {
            logger.error('Help command error:', err);
            await safeSendText(sock, message.key.remoteJid, 
                `❌ ${languageManager.getText('basic.help.error', config.bot.language || 'en')}`
            );
        }
    }
};

// Load all commands from command files
async function loadAllCommands() {
    try {
        const commandsPath = path.join(process.cwd(), 'src/commands');
        const allCommands = {};
        let totalCommands = 0;

        // Function to recursively get all files
        async function getAllFiles(dir) {
            const entries = await fs.readdir(dir, { withFileTypes: true });
            const files = await Promise.all(entries.map(async entry => {
                const fullPath = path.join(dir, entry.name);
                return entry.isDirectory() ? getAllFiles(fullPath) : fullPath;
            }));
            return files.flat();
        }

        // Get all JS files including those in subdirectories
        const commandFiles = await getAllFiles(commandsPath);
        logger.info(`Found ${commandFiles.length} potential command files`);

        // Process each command file
        for (const file of commandFiles) {
            if (file.endsWith('.js') && !['index.js', 'menu.js'].includes(path.basename(file))) {
                try {
                    const moduleData = require(file);
                    let category = path.basename(path.dirname(file));

                    // If it's in the root commands directory, use the filename as category
                    if (category === 'commands') {
                        category = path.basename(file, '.js');
                    }

                    // Get commands from module
                    let commands = moduleData.commands || moduleData;
                    if (typeof commands === 'object') {
                        // Filter valid commands
                        const commandList = Object.keys(commands).filter(cmd =>
                            typeof commands[cmd] === 'function' && cmd !== 'init'
                        );

                        if (commandList.length > 0) {
                            if (!allCommands[category]) {
                                allCommands[category] = [];
                            }
                            allCommands[category].push(...commandList);
                            totalCommands += commandList.length;
                            logger.info(`Loaded ${commandList.length} commands from ${category}`);
                        }
                    }
                } catch (err) {
                    logger.error(`Error loading commands from ${file}:`, err);
                }
            }
        }

        // Also check the index.js for additional commands
        try {
            const indexCommands = require('./index').commands;
            if (indexCommands && typeof indexCommands === 'object') {
                const mainCommands = Object.keys(indexCommands).filter(cmd =>
                    typeof indexCommands[cmd] === 'function' && cmd !== 'init'
                );

                if (mainCommands.length > 0) {
                    if (!allCommands['main']) {
                        allCommands['main'] = [];
                    }
                    allCommands['main'].push(...mainCommands);
                    totalCommands += mainCommands.length;
                    logger.info(`Loaded ${mainCommands.length} commands from index.js`);
                }
            }
        } catch (err) {
            logger.error('Error loading commands from index.js:', err);
        }

        logger.info(`Total commands loaded: ${totalCommands} from ${Object.keys(allCommands).length} categories`);
        return { allCommands, totalCommands };
    } catch (err) {
        logger.error('Error loading commands:', err);
        return { allCommands: {}, totalCommands: 0 };
    }
}

module.exports = {
    commands: {
        ...menuCommands
    },
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