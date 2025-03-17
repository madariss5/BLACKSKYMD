/**
 * Ultra Minimal Message Handler
 * Enhanced with full command functionality
 */

const fs = require('fs'); // Use regular fs for sync operations
const fsPromises = require('fs').promises; // Use promises for async operations
const path = require('path');
const logger = console;

// Commands storage
const commands = new Map();
const { safeSendText, safeSendMessage } = require('../utils/jidHelper');

// Add core commands
function addCoreCommands() {
    commands.set('ping', {
        execute: async (sock, message) => {
            try {
                const sender = message.key.remoteJid;
                await safeSendText(sock, sender, '🏓 Pong! Bot is working.');
            } catch (err) {
                logger.error('Error in ping command:', err);
            }
        },
        description: 'Check if bot is responding',
        usage: '!ping',
        category: 'core',
        enabled: true
    });

    commands.set('menu', {
        execute: async (sock, message) => {
            try {
                const sender = message.key.remoteJid;
                let menuText = '*📋 Available Commands*\n\n';

                // Group commands by category
                const categories = new Map();
                for (const [name, cmd] of commands.entries()) {
                    const category = cmd.category || 'misc';
                    if (!categories.has(category)) {
                        categories.set(category, []);
                    }
                    categories.get(category).push({
                        name,
                        description: cmd.description || 'No description'
                    });
                }

                // Build menu text
                for (const [category, cmdList] of categories.entries()) {
                    menuText += `*${category.toUpperCase()}*\n`;
                    cmdList.sort((a, b) => a.name.localeCompare(b.name))
                        .forEach(cmd => {
                            menuText += `• !${cmd.name} - ${cmd.description}\n`;
                        });
                    menuText += '\n';
                }

                await safeSendText(sock, sender, menuText);
            } catch (err) {
                logger.error('Error in menu command:', err);
            }
        },
        description: 'Show available commands',
        usage: '!menu',
        category: 'core',
        enabled: true
    });

    commands.set('help', {
        execute: async (sock, message, args) => {
            try {
                const sender = message.key.remoteJid;
                if (args.length > 0) {
                    const commandName = args[0].toLowerCase();
                    const command = commands.get(commandName);
                    if (command) {
                        const helpText = `*Command: ${commandName}*\n` +
                            `Description: ${command.description || 'No description'}\n` +
                            `Usage: ${command.usage || `!${commandName}`}\n` +
                            `Category: ${command.category || 'misc'}`;
                        await safeSendText(sock, sender, helpText);
                    } else {
                        await safeSendText(sock, sender, `❌ Command "${commandName}" not found.`);
                    }
                } else {
                    await safeSendText(sock, sender, 
                        '*💡 Help Menu*\n\n' +
                        'Use .help <command> for detailed information\n' +
                        'Use .menu to see all commands'
                    );
                }
            } catch (err) {
                logger.error('Error in help command:', err);
            }
        },
        description: 'Get help with commands',
        usage: '.help <command>',
        category: 'core',
        enabled: true
    });
}

// Load command modules from directory
async function loadCommandModules() {
    try {
        const commandsDir = path.join(process.cwd(), 'src/commands');

        // Check if directory exists
        try {
            await fsPromises.access(commandsDir);
        } catch (err) {
            logger.error('Commands directory not found:', commandsDir);
            return false;
        }

        // Get all .js files recursively
        async function getJsFiles(dir) {
            const items = await fsPromises.readdir(dir, { withFileTypes: true });
            const files = await Promise.all(items.map(item => {
                const fullPath = path.join(dir, item.name);
                return item.isDirectory() ? getJsFiles(fullPath) : fullPath;
            }));
            return files.flat().filter(file => file.endsWith('.js'));
        }

        const files = await getJsFiles(commandsDir);
        logger.log(`Found ${files.length} command files`);

        // Load each command module
        for (const file of files) {
            if (file.endsWith('.js') && !file.includes('index.js')) {
                try {
                    delete require.cache[require.resolve(file)];
                    const module = require(file);
                    const category = path.basename(path.dirname(file));

                    if (module.commands) {
                        Object.entries(module.commands).forEach(([name, handler]) => {
                            if (typeof handler === 'function' && name !== 'init') {
                                commands.set(name, {
                                    execute: handler,
                                    description: `${name} command`,
                                    usage: `.${name}`,
                                    category: category !== 'commands' ? category : 'general',
                                    enabled: true
                                });
                                logger.log(`Loaded command: ${name} (${category})`);
                            }
                        });

                        if (typeof module.init === 'function') {
                            await module.init();
                            logger.log(`Initialized module: ${path.basename(file)}`);
                        }
                    }
                } catch (err) {
                    logger.error(`Error loading module ${file}:`, err);
                }
            }
        }

        return true;
    } catch (err) {
        logger.error('Error loading command modules:', err);
        return false;
    }
}

// Process incoming messages
async function messageHandler(sock, message) {
    try {
        if (!message?.message || !message.key?.remoteJid) return;

        const content = message.message?.conversation || 
                       message.message?.extendedTextMessage?.text ||
                       message.message?.imageMessage?.caption || 
                       message.message?.videoMessage?.caption;

        if (!content) return;

        // Check for command prefix
        const prefix = content.charAt(0);
        const validPrefixes = ['!', '/', '.'];

        if (validPrefixes.includes(prefix)) {
            const args = content.slice(1).trim().split(/\s+/);
            const commandName = args.shift().toLowerCase();

            // Typing indicator disabled as per user request

            if (commands.has(commandName)) {
                try {
                    const command = commands.get(commandName);
                    await command.execute(sock, message, args);
                } catch (err) {
                    logger.error(`Error executing command ${commandName}:`, err);
                    await safeSendMessage(sock, message.key.remoteJid, {
                        text: '❌ Error executing command'
                    });
                }
            } else {
                await safeSendMessage(sock, message.key.remoteJid, {
                    text: `❌ Command not found: ${commandName}\nUse .help to see available commands`
                });
            }

            // Clearing typing indicator disabled as per user request
        }
    } catch (err) {
        logger.error('Error in message handler:', err);
    }
}

// Initialize handler
async function init() {
    try {
        // Clear existing commands
        commands.clear();

        // Add core commands
        addCoreCommands();

        // Load command modules
        const success = await loadCommandModules();
        if (!success) {
            logger.error('Failed to load command modules');
            return false;
        }

        logger.log(`Initialized with ${commands.size} commands`);
        return true;
    } catch (err) {
        logger.error('Error initializing handler:', err);
        return false;
    }
}

module.exports = {
    messageHandler,
    init,
    commands
};