/**
 * Ultra Minimal Message Handler
 * Designed for maximum reliability
 */

const fs = require('fs').promises;
const path = require('path');
const logger = console;

// Commands storage
const commands = new Map();
const { safeSendText, safeSendMessage } = require('../utils/jidHelper');

// Helper function to calculate Levenshtein distance between two strings
// Used for suggesting similar commands when a command is not found
function levenshteinDistance(a, b) {
    const matrix = Array(b.length + 1).fill().map(() => Array(a.length + 1).fill(0));
    
    for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= b.length; j++) matrix[j][0] = j;
    
    for (let j = 1; j <= b.length; j++) {
        for (let i = 1; i <= a.length; i++) {
            const substitutionCost = a[i - 1] === b[j - 1] ? 0 : 1;
            matrix[j][i] = Math.min(
                matrix[j][i - 1] + 1, // deletion
                matrix[j - 1][i] + 1, // insertion
                matrix[j - 1][i - 1] + substitutionCost // substitution
            );
        }
    }
    
    return matrix[b.length][a.length];
}

// Load all command configurations
async function loadCommandConfigs() {
    try {
        const configsMap = new Map();
        const configDir = path.join(process.cwd(), 'src/config/commands');

        // Check if config directory exists
        try {
            await fs.access(configDir);
        } catch (err) {
            logger.warn('Config directory does not exist:', configDir);
            return configsMap;
        }

        // Read all JSON config files
        const configFiles = await fs.readdir(configDir);
        for (const file of configFiles) {
            if (!file.endsWith('.json')) continue;

            try {
                const filePath = path.join(configDir, file);
                const content = await fs.readFile(filePath, 'utf8');
                const config = JSON.parse(content);
                const category = file.replace('.json', '');

                if (Array.isArray(config.commands)) {
                    for (const cmd of config.commands) {
                        if (cmd && cmd.name) {
                            configsMap.set(cmd.name, {
                                ...cmd,
                                category
                            });
                        }
                    }
                }
            } catch (err) {
                logger.error(`Error loading config file ${file}:`, err);
            }
        }

        return configsMap;
    } catch (err) {
        logger.error('Error loading command configs:', err);
        return new Map();
    }
}

// Add core commands that should always be available
function addCoreCommands() {
    // Add ping command
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
        category: 'core',
        enabled: true
    });

    // Add menu command
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
                    categories.get(category).push(name);
                }

                // Build menu text
                for (const [category, cmdList] of categories.entries()) {
                    menuText += `*${category.toUpperCase()}*\n`;
                    cmdList.sort().forEach(cmd => {
                        menuText += `• !${cmd}\n`;
                    });
                    menuText += '\n';
                }

                await safeSendText(sock, sender, menuText);
            } catch (err) {
                logger.error('Error in menu command:', err);
            }
        },
        description: 'Show available commands',
        category: 'core',
        enabled: true
    });
}

// Load commands from a directory
async function loadCommandsFromDir(dir) {
    try {
        const files = await fs.readdir(dir, { withFileTypes: true });
        for (const file of files) {
            const fullPath = path.join(dir, file.name);

            if (file.isDirectory()) {
                await loadCommandsFromDir(fullPath);
            } else if (file.name.endsWith('.js') && !file.name.startsWith('index')) {
                try {
                    delete require.cache[require.resolve(fullPath)];
                    const module = require(fullPath);
                    const category = path.basename(path.dirname(fullPath));

                    if (module.commands) {
                        Object.entries(module.commands).forEach(([name, handler]) => {
                            if (typeof handler === 'function' && name !== 'init') {
                                commands.set(name, {
                                    execute: handler,
                                    category,
                                    enabled: true
                                });
                                logger.log(`Loaded command: ${name} (${category})`);
                            }
                        });

                        if (typeof module.init === 'function') {
                            await module.init();
                        }
                    }
                } catch (err) {
                    logger.error(`Error loading commands from ${fullPath}:`, err);
                }
            }
        }
    } catch (err) {
        logger.error(`Error reading directory ${dir}:`, err);
    }
}

// Enhanced message handler
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
            const args = content.slice(1).trim().split(' ');
            const commandName = args.shift().toLowerCase();

            if (commands.has(commandName)) {
                try {
                    const command = commands.get(commandName);
                    await command.execute(sock, message, args);
                } catch (err) {
                    logger.error(`Error executing command ${commandName}:`, err);
                    await safeSendText(sock, message.key.remoteJid, 
                        '❌ Error executing command. Please try again.'
                    );
                }
            } else {
                await safeSendText(sock, message.key.remoteJid,
                    `❌ Command not found: ${commandName}. Use !help to see available commands.`
                );
            }
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

        // Add core commands first
        addCoreCommands();

        // Load all commands from the commands directory
        const commandsDir = path.join(process.cwd(), 'src/commands');
        await loadCommandsFromDir(commandsDir);

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