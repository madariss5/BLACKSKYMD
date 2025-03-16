/**
 * Ultra Minimal Message Handler
 * Enhanced with full command functionality
 */

const fs = require('fs').promises;
const path = require('path');
const logger = console;

// Commands storage
const commands = new Map();
const { safeSendText, safeSendMessage } = require('../utils/jidHelper');

// Helper function to calculate Levenshtein distance
function levenshteinDistance(a, b) {
    const matrix = Array(b.length + 1).fill().map(() => Array(a.length + 1).fill(0));

    for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= b.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= b.length; j++) {
        for (let i = 1; i <= a.length; i++) {
            const substitutionCost = a[i - 1] === b[j - 1] ? 0 : 1;
            matrix[j][i] = Math.min(
                matrix[j][i - 1] + 1,
                matrix[j - 1][i] + 1,
                matrix[j - 1][i - 1] + substitutionCost
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

        try {
            await fs.access(configDir);
        } catch (err) {
            logger.warn('Config directory does not exist:', configDir);
            return configsMap;
        }

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
        cooldown: 3,
        groupOnly: false,
        permissions: ['user'],
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
                        description: cmd.description || 'No description available'
                    });
                }

                // Build menu text with descriptions
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
        description: 'Show available commands with descriptions',
        usage: '!menu',
        category: 'core',
        cooldown: 5,
        groupOnly: false,
        permissions: ['user'],
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
                        const helpText = `*Command: ${commandName}*\n\n` +
                            `Description: ${command.description || 'No description available'}\n` +
                            `Usage: ${command.usage || `!${commandName}`}\n` +
                            `Category: ${command.category || 'misc'}\n` +
                            `Cooldown: ${command.cooldown || 3} seconds\n` +
                            `Group Only: ${command.groupOnly ? 'Yes' : 'No'}\n` +
                            `Permissions: ${command.permissions?.join(', ') || 'user'}`;

                        await safeSendText(sock, sender, helpText);
                    } else {
                        await safeSendText(sock, sender, `❌ Command "${commandName}" not found.`);
                    }
                } else {
                    await safeSendText(sock, sender, 
                        '*💡 Help Menu*\n\n' +
                        'Use !help <command> to get detailed information about a specific command.\n\n' +
                        'Example:\n!help ping\n\n' +
                        'Use !menu to see all available commands.'
                    );
                }
            } catch (err) {
                logger.error('Error in help command:', err);
            }
        },
        description: 'Get detailed help for commands',
        usage: '!help <command>',
        category: 'core',
        cooldown: 3,
        groupOnly: false,
        permissions: ['user'],
        enabled: true
    });
}

// Load commands from a directory
async function loadCommandsFromDir(dir) {
    try {
        const files = await fs.readdir(dir, { withFileTypes: true });
        const configs = await loadCommandConfigs();

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
                                const config = configs.get(name) || {};
                                commands.set(name, {
                                    execute: handler,
                                    description: config.description || `${name} command`,
                                    usage: config.usage || `!${name}`,
                                    category: config.category || category,
                                    cooldown: config.cooldown || 3,
                                    groupOnly: config.groupOnly || false,
                                    permissions: config.permissions || ['user'],
                                    enabled: config.enabled !== false
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
            const args = content.slice(1).trim().split(/\s+/);
            const commandName = args.shift().toLowerCase();

            // Show typing indicator
            try {
                await sock.sendPresenceUpdate('composing', message.key.remoteJid);
            } catch (err) {
                logger.error('Error setting presence:', err);
            }

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
                // Find similar commands
                const similarCommands = Array.from(commands.keys())
                    .filter(cmd => levenshteinDistance(cmd, commandName) <= 2)
                    .slice(0, 3);

                let suggestion = '';
                if (similarCommands.length > 0) {
                    suggestion = `\n\nDid you mean: ${similarCommands.map(cmd => `!${cmd}`).join(', ')}?`;
                }

                await safeSendText(sock, message.key.remoteJid,
                    `❌ Command not found: ${commandName}. Use !help to see available commands.${suggestion}`
                );
            }

            // Stop typing indicator
            try {
                await sock.sendPresenceUpdate('paused', message.key.remoteJid);
            } catch (err) {
                logger.error('Error clearing presence:', err);
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

        // Load reactions module separately to ensure proper initialization
        try {
            const reactionsPath = path.join(process.cwd(), 'src/commands/reactions.js');
            if (fs.existsSync(reactionsPath)) {
                const reactionsModule = require(reactionsPath);
                if (typeof reactionsModule.init === 'function') {
                    await reactionsModule.init();
                    logger.log('Reactions module initialized');
                }
            }
        } catch (err) {
            logger.error('Error loading reactions module:', err);
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