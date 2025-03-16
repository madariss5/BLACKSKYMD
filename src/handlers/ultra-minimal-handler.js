/**
 * Ultra Minimal Message Handler
 * Designed for maximum reliability
 */

const fs = require('fs').promises;
const path = require('path');
const logger = console;

// Commands storage
const commands = new Map();
const { safeSendText, safeSendMessage, safeSendImage } = require('../utils/jidHelper');

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

// Load all JSON configurations for commands
async function loadCommandConfigs() {
    try {
        const configsMap = new Map();
        const configDir = path.join(process.cwd(), 'src/config/commands');
        
        // Check if config directory exists
        try {
            await fs.access(configDir);
        } catch (err) {
            logger.error('Config directory does not exist:', configDir);
            return configsMap;
        }
        
        // Read all JSON config files
        const configFiles = await fs.readdir(configDir);
        logger.log(`Found ${configFiles.length} config files in ${configDir}`);
        
        for (const file of configFiles) {
            if (!file.endsWith('.json')) continue;
            
            try {
                const filePath = path.join(configDir, file);
                const content = await fs.readFile(filePath, 'utf8');
                const config = JSON.parse(content);
                const category = file.replace('.json', '');
                
                if (Array.isArray(config.commands)) {
                    let cmdCount = 0;
                    for (const cmd of config.commands) {
                        if (cmd && cmd.name) {
                            configsMap.set(cmd.name, {
                                ...cmd,
                                category
                            });
                            cmdCount++;
                        }
                    }
                    logger.log(`Loaded ${cmdCount} command configs from ${file}`);
                }
            } catch (err) {
                logger.error(`Error loading config file ${file}:`, err);
            }
        }
        
        logger.log(`Total command configs loaded: ${configsMap.size}`);
        return configsMap;
    } catch (err) {
        logger.error('Error loading command configs:', err);
        return new Map();
    }
}

// Import all commands from the commands directory recursively
async function loadCommands() {
    try {
        const commandsPath = path.join(process.cwd(), 'src/commands');
        logger.log('\nStarting command loading process...');
        logger.log('Loading commands from:', commandsPath);

        // Load command configurations first
        const commandConfigs = await loadCommandConfigs();
        logger.log(`Loaded ${commandConfigs.size} command configurations from JSON files`);

        // Track which commands are actually implemented
        const implementedCommands = new Set();

        // Get all JavaScript files
        const files = await getAllFiles(commandsPath);
        let loadedCount = 0;
        let stubCount = 0;

        // First pass - load all implemented commands
        for (const file of files) {
            if (file.endsWith('.js') && !['index.js'].includes(path.basename(file))) {
                try {
                    logger.log(`\nProcessing file: ${path.relative(commandsPath, file)}`);
                    delete require.cache[require.resolve(file)]; // Clear cache
                    const moduleData = require(file);
                    const fileBasename = path.basename(file, '.js');
                    const category = path.basename(path.dirname(file)) !== 'commands' 
                        ? path.basename(path.dirname(file)) 
                        : fileBasename;

                    if (moduleData.commands) {
                        Object.entries(moduleData.commands).forEach(([name, func]) => {
                            if (typeof func === 'function' && name !== 'init') {
                                const config = commandConfigs.get(name);
                                commands.set(name, {
                                    execute: async (sock, message, args) => {
                                        try {
                                            return await func(sock, message, args);
                                        } catch (err) {
                                            logger.error(`Error executing command ${name}:`, err);
                                            throw err;
                                        }
                                    },
                                    description: config?.description || `Command: ${name}`,
                                    usage: config?.usage || `!${name}`,
                                    category: config?.category || category,
                                    cooldown: config?.cooldown || 3,
                                    groupOnly: config?.groupOnly || false,
                                    permissions: config?.permissions || ['user'],
                                    enabled: config?.enabled !== false,
                                    isStub: false
                                });
                                implementedCommands.add(name);
                                loadedCount++;
                                logger.log(`✓ Loaded command: ${name} (${config?.category || category})`);
                            }
                        });

                        // Initialize module if it has init function
                        if (typeof moduleData.init === 'function') {
                            try {
                                await moduleData.init();
                                logger.log(`✓ Initialized module: ${fileBasename}`);
                            } catch (err) {
                                logger.error(`Error initializing module ${fileBasename}:`, err);
                            }
                        }
                    } else if (typeof moduleData === 'object') {
                        // Direct command exports
                        Object.entries(moduleData).forEach(([name, func]) => {
                            if (typeof func === 'function' && name !== 'init') {
                                // Get configuration for this command
                                const config = commandConfigs.get(name);
                                
                                commands.set(name, {
                                    execute: async (sock, message, args) => {
                                        try {
                                            return await func(sock, message, args);
                                        } catch (err) {
                                            logger.error(`Error executing command ${name}:`, err);
                                            throw err;
                                        }
                                    },
                                    description: config?.description || `Command: ${name}`,
                                    usage: config?.usage || `!${name}`,
                                    category: config?.category || category,
                                    cooldown: config?.cooldown || 3,
                                    groupOnly: config?.groupOnly || false,
                                    permissions: config?.permissions || ['user'],
                                    enabled: config?.enabled !== false,
                                    isStub: false
                                });
                                
                                implementedCommands.add(name);
                                loadedCount++;
                                logger.log(`✓ Loaded direct command: ${name} (${config?.category || category})`);
                            }
                        });
                    }
                } catch (err) {
                    logger.error(`Error loading commands from ${file}:`, err);
                }
            }
        }
        
        // Second pass - create stubs for configured but unimplemented commands
        for (const [commandName, config] of commandConfigs.entries()) {
            if (!implementedCommands.has(commandName)) {
                // This command is configured but not implemented - create a stub
                const stubHandler = async (sock, message) => {
                    try {
                        const sender = message.key.remoteJid;
                        await safeSendText(sock, sender, 
                            `⚠️ Command *!${commandName}* exists in configuration but hasn't been implemented yet.`
                        );
                        logger.log(`Executed stub for unimplemented command: ${commandName}`);
                    } catch (err) {
                        logger.error(`Error in stub command ${commandName}:`, err);
                    }
                };
                
                commands.set(commandName, {
                    execute: stubHandler,
                    description: config.description || `Command: ${commandName}`,
                    usage: config.usage || `!${commandName}`,
                    category: config.category || 'uncategorized',
                    cooldown: config.cooldown || 3,
                    groupOnly: config.groupOnly || false,
                    permissions: config.permissions || ['user'],
                    enabled: config.enabled !== false,
                    isStub: true
                });
                
                stubCount++;
                logger.log(`⚠️ Created stub for command: ${commandName} (${config.category})`);
            }
        }
        
        logger.log('\n✅ Command loading summary:');
        logger.log(`Total implemented commands loaded: ${loadedCount}`);
        logger.log(`Stub commands created: ${stubCount}`);
        logger.log(`Total commands available: ${loadedCount + stubCount}`);
        
        // Get detailed breakdown by category
        const commandsByCategory = {};
        const stubCommandsByCategory = {};
        
        for (const [name, cmd] of commands.entries()) {
            if (typeof cmd === 'object' && cmd.category) {
                const category = cmd.category;
                if (cmd.isStub) {
                    stubCommandsByCategory[category] = (stubCommandsByCategory[category] || 0) + 1;
                } else {
                    commandsByCategory[category] = (commandsByCategory[category] || 0) + 1;
                }
            }
        }
        
        logger.log('\nImplemented commands by category:');
        Object.entries(commandsByCategory)
            .sort((a, b) => b[1] - a[1])
            .forEach(([category, count]) => {
                logger.log(`- ${category}: ${count} commands`);
            });
            
        logger.log('\nStub commands by category:');
        Object.entries(stubCommandsByCategory)
            .sort((a, b) => b[1] - a[1])
            .forEach(([category, count]) => {
                logger.log(`- ${category}: ${count} commands`);
            });
        
        if (loadedCount === 0 && stubCount === 0) {
            logger.error('⚠️ Warning: No commands were loaded!');
        }
    } catch (err) {
        logger.error('Error loading commands:', err);
    }
}

// Recursively get all files in directory
async function getAllFiles(dir) {
    try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        const files = await Promise.all(entries.map(entry => {
            const fullPath = path.join(dir, entry.name);
            return entry.isDirectory() ? getAllFiles(fullPath) : fullPath;
        }));
        return files.flat();
    } catch (err) {
        logger.error(`Error reading directory ${dir}:`, err);
        return [];
    }
}

// Add fallback commands if they don't exist
function addFallbackCommands() {
    if (!commands.has('ping')) {
        commands.set('ping', {
            execute: async (sock, message) => {
                try {
                    const sender = message.key.remoteJid;
                    await safeSendText(sock, sender, '🏓 Pong! Bot is working.' );
                    logger.log('Executed ping command successfully');
                } catch (err) {
                    logger.error('Error in ping command:', err);
                }
            },
            description: 'Check if the bot is online and responsive',
            usage: '!ping',
            category: 'general',
            cooldown: 3,
            groupOnly: false,
            permissions: ['user'],
            enabled: true
        });
        logger.log('Added fallback ping command');
    }

    if (!commands.has('menu')) {
        commands.set('menu', {
            execute: async (sock, message) => {
                try {
                    const sender = message.key.remoteJid;
                    const commandList = Array.from(commands.keys()).sort();
                    let menuText = `*📋 Command Menu*\n\n`;
                    menuText += `Total Commands: ${commandList.length}\n\n`;
                    
                    // Group commands by category
                    const categorizedCommands = {};
                    for (const [cmdName, cmdData] of commands.entries()) {
                        const category = typeof cmdData === 'object' && cmdData.category ? 
                            cmdData.category : 'uncategorized';
                        
                        if (!categorizedCommands[category]) {
                            categorizedCommands[category] = [];
                        }
                        categorizedCommands[category].push(cmdName);
                    }
                    
                    // Build menu text with categories
                    for (const [category, cmds] of Object.entries(categorizedCommands)) {
                        menuText += `\n*${category.toUpperCase()}*\n`;
                        menuText += cmds.map(cmd => `• !${cmd}`).join('\n');
                        menuText += '\n';
                    }
                    
                    await safeSendText(sock, sender, menuText);
                    logger.log('Executed menu command successfully');
                } catch (err) {
                    logger.error('Error in menu command:', err);
                }
            },
            description: 'Display a list of all available commands',
            usage: '!menu',
            category: 'general',
            cooldown: 3,
            groupOnly: false,
            permissions: ['user'],
            enabled: true
        });
        logger.log('Added fallback menu command');
    }
}

// Enhanced message handler with improved command detection
async function messageHandler(sock, message) {
    try {
        // Basic validation
        if (!message?.message || !message.key?.remoteJid) {
            logger.log('Invalid message format');
            return;
        }

        // Detailed logging for troubleshooting
        if (process.env.DEBUG_BOT === 'true') {
            logger.log('Message object:', JSON.stringify(message, null, 2));
        }

        // Get message content from various formats
        const content = message.message?.conversation || 
                       message.message?.extendedTextMessage?.text ||
                       message.message?.imageMessage?.caption ||
                       message.message?.videoMessage?.caption ||
                       message.message?.documentMessage?.caption ||
                       message.message?.viewOnceMessage?.message?.imageMessage?.caption ||
                       message.message?.viewOnceMessage?.message?.videoMessage?.caption ||
                       message.message?.listResponseMessage?.title ||
                       message.message?.buttonsResponseMessage?.selectedButtonId ||
                       message.message?.templateButtonReplyMessage?.selectedId;

        if (!content) {
            logger.log('No text content found');
            return;
        }

        // Determine if message is a command by checking prefixes
        const configPrefix = process.env.PREFIX || '.'; // Default to '.' if not set in .env
        const validPrefixes = ['!', '/', '.', configPrefix]; // Include configured prefix
        // Remove duplicates from validPrefixes array
        const uniquePrefixes = [...new Set(validPrefixes)];
        
        // Log the config prefix being used (for debugging)
        console.log(`Config prefix: ${configPrefix}, Valid prefixes: ${uniquePrefixes.join(', ')}`)
        
        const prefix = content.charAt(0);
        const isCommand = uniquePrefixes.includes(prefix);
        
        // If not a command but starts with 'prefix' or 'pref' (common user typo when asking about commands)
        if (!isCommand && (content.toLowerCase().startsWith('prefix') || content.toLowerCase().startsWith('pref'))) {
            try {
                await safeSendText(sock, message.key.remoteJid, 
                    `ℹ️ *Command Prefix Information*\n\nYou can use any of these prefixes: ${uniquePrefixes.join(', ')}\n\nFor example:\n${configPrefix}help - Show all commands\n${configPrefix}ping - Test if bot is working`
                );
                return; // Early return after sending prefix info
            } catch (err) {
                logger.error('Error sending prefix info:', err);
            }
        }
        
        // Debug message content
        console.log(`Message content: "${content}", Prefix detected: "${prefix}", Is command: ${isCommand}`);
        
        if (isCommand) {
            // Extract command name and arguments
            // This improved version handles quotes and special characters better
            let args = [];
            let commandName = '';
            
            // Check if there are spaces after the command
            if (content.indexOf(' ') !== -1) {
                commandName = content.slice(1, content.indexOf(' ')).toLowerCase();
                // Properly split args respecting quotes
                const argString = content.slice(content.indexOf(' ') + 1);
                // Simple arg parsing
                args = argString.split(' ').filter(arg => arg.trim() !== '');
            } else {
                // Command with no args
                commandName = content.slice(1).toLowerCase();
            }
            
            // Log command processing
            console.log(`\nProcessing command: ${commandName} with args:`, args);
            
            // Show typing indicator
            try {
                await sock.sendPresenceUpdate('composing', message.key.remoteJid);
            } catch (err) {
                logger.error('Error setting presence:', err);
            }
            
            if (commands.has(commandName)) {
                try {
                    const command = commands.get(commandName);
                    if (typeof command === 'function') {
                        // Handle legacy command format
                        await command(sock, message, args);
                    } else if (command && typeof command.execute === 'function') {
                        // Handle new command format with metadata
                        await command.execute(sock, message, args);
                    } else {
                        throw new Error('Invalid command implementation');
                    }
                    console.log('Command executed successfully:', commandName);
                } catch (err) {
                    logger.error(`Error executing command ${commandName}:`, err);
                    await safeSendText(sock, message.key.remoteJid, 
                        `❌ Error executing command: ${err.message || 'Unknown error'}. Please try again.`
                    );
                }
            } else {
                console.log('Command not found:', commandName);
                
                // Check for similar commands to suggest
                const allCommands = Array.from(commands.keys());
                const similarCommands = allCommands.filter(cmd => 
                    cmd.includes(commandName) || 
                    commandName.includes(cmd) || 
                    levenshteinDistance(cmd, commandName) <= 2
                ).slice(0, 3);
                
                let suggestText = '';
                if (similarCommands.length > 0) {
                    suggestText = `\n\nDid you mean: ${similarCommands.map(cmd => `*${prefix}${cmd}*`).join(', ')}?`;
                }
                
                await safeSendText(sock, message.key.remoteJid,
                    `❌ Command *${prefix}${commandName}* not found. Try ${prefix}help or ${prefix}menu for available commands.${suggestText}`
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
        try {
            await safeSendText(sock, message.key.remoteJid, '❌ An error occurred while processing your message.'
            );
        } catch (sendErr) {
            logger.error('Failed to send error message:', sendErr);
        }
    }
}

// Initialize handler
async function init() {
    try {
        logger.log('\nInitializing ultra minimal handler...');

        // Load all commands first
        const success = await loadCommands();
        if (!success) {
            logger.error('Failed to load commands');
            return false;
        }

        // Add fallback commands
        addFallbackCommands();

        // Explicitly load the reactions module to ensure it's registered
        try {
            const reactionsPath = path.join(process.cwd(), 'src/commands/reactions.js');
            logger.log(`Attempting to load reactions module from: ${reactionsPath}`);
            
            if (fs.existsSync(reactionsPath)) {
                // Clear cache first to ensure we get the latest version
                delete require.cache[require.resolve(reactionsPath)];
                const reactionsModule = require(reactionsPath);
                
                if (reactionsModule && reactionsModule.commands) {
                    const reactionCommands = Object.keys(reactionsModule.commands)
                        .filter(cmd => cmd !== 'init');
                    
                    logger.log(`Found ${reactionCommands.length} reaction commands in module`);
                    
                    // Register each reaction command
                    reactionCommands.forEach(cmdName => {
                        if (!commands.has(cmdName)) {
                            commands.set(cmdName, {
                                execute: reactionsModule.commands[cmdName],
                                description: `Reaction: ${cmdName}`,
                                usage: `!${cmdName} @user`,
                                category: 'reactions',
                                cooldown: 5,
                                groupOnly: false,
                                permissions: ['user'],
                                enabled: true,
                                isStub: false
                            });
                            logger.log(`✅ Registered reaction command: ${cmdName}`);
                        }
                    });
                    
                    // Initialize the reactions module
                    if (typeof reactionsModule.init === 'function') {
                        await reactionsModule.init();
                        logger.log('✅ Reactions module initialized successfully');
                    }
                } else {
                    logger.warn('Reactions module found but does not export commands object');
                }
            } else {
                logger.warn(`Reactions module not found at path: ${reactionsPath}`);
            }
        } catch (error) {
            logger.error(`Error loading reactions module: ${error.message}`);
        }

        // Verify commands are loaded
        const totalCommands = commands.size;
        logger.log('\n✅ Handler initialization complete:');
        logger.log(`Total commands available: ${totalCommands}`);
        logger.log('Try these basic commands:');
        const configPrefix = process.env.PREFIX || '.';
        logger.log(`- ${configPrefix}ping (Test bot response)`);
        logger.log(`- ${configPrefix}menu (Show all commands)`);

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