/**
 * Ultra Minimal Message Handler
 * Designed for maximum reliability
 */

const fs = require('fs').promises;
const path = require('path');
const logger = console;

// Commands storage
const commands = new Map();

// Import all commands from the commands directory recursively
async function loadCommands() {
    try {
        const commandsPath = path.join(__dirname, '../commands');
        const files = await getAllFiles(commandsPath);
        let loadedCount = 0;

        logger.log('Loading commands from:', commandsPath);

        for (const file of files) {
            if (file.endsWith('.js') && !['index.js'].includes(path.basename(file))) {
                try {
                    const filePath = file;
                    const moduleData = require(filePath);
                    const category = path.basename(file, '.js');

                    if (moduleData.commands) {
                        Object.entries(moduleData.commands).forEach(([name, func]) => {
                            if (typeof func === 'function' && name !== 'init') {
                                commands.set(name, async (sock, message, args) => {
                                    try {
                                        return await func(sock, message, args);
                                    } catch (err) {
                                        logger.error(`Error executing command ${name}:`, err);
                                        throw err;
                                    }
                                });
                                loadedCount++;
                                logger.log(`Loaded command: ${name} from ${category}`);
                            }
                        });

                        // Initialize module if it has init function
                        if (typeof moduleData.init === 'function') {
                            moduleData.init().catch(err => {
                                logger.error(`Error initializing module ${category}:`, err);
                            });
                        }
                    }
                } catch (err) {
                    logger.error(`Error loading commands from ${file}:`, err);
                }
            }
        }

        logger.log(`Successfully loaded ${loadedCount} commands`);
    } catch (err) {
        logger.error('Error loading commands:', err);
    }
}

// Recursively get all files in directory
async function getAllFiles(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const files = await Promise.all(entries.map(entry => {
        const fullPath = path.join(dir, entry.name);
        return entry.isDirectory() ? getAllFiles(fullPath) : fullPath;
    }));
    return files.flat();
}

// Add fallback commands if they don't exist
function addFallbackCommands() {
    if (!commands.has('ping')) {
        commands.set('ping', async (sock, message) => {
            try {
                const sender = message.key.remoteJid;
                await sock.sendMessage(sender, { text: '🏓 Pong! Bot is working.' });
            } catch (err) {
                logger.error('Error in ping command:', err);
            }
        });
    }

    if (!commands.has('help')) {
        commands.set('help', async (sock, message) => {
            try {
                const sender = message.key.remoteJid;
                const commandList = Array.from(commands.keys()).join(', ');
                await sock.sendMessage(sender, { 
                    text: `*Available Commands*\n${commandList}`
                });
            } catch (err) {
                logger.error('Error in help command:', err);
            }
        });
    }

    if (!commands.has('menu')) {
        commands.set('menu', async (sock, message) => {
            try {
                const sender = message.key.remoteJid;
                const commandList = Array.from(commands.keys()).sort();
                let menuText = `*📋 Command Menu*\n\n`;
                menuText += `Total Commands: ${commandList.length}\n\n`;
                menuText += commandList.map(cmd => `• !${cmd}`).join('\n');
                await sock.sendMessage(sender, { text: menuText });
            } catch (err) {
                logger.error('Error in menu command:', err);
            }
        });
    }
}

// Message handler with improved error handling
async function messageHandler(sock, message) {
    try {
        // Basic validation
        if (!message?.message || !message.key?.remoteJid) {
            logger.log('Invalid message format');
            return;
        }

        // Get message content
        const content = message.message?.conversation || 
                       message.message?.extendedTextMessage?.text ||
                       message.message?.imageMessage?.caption ||
                       message.message?.videoMessage?.caption;

        if (!content) {
            logger.log('No text content found');
            return;
        }

        // Check for command prefix
        if (content.startsWith('!') || content.startsWith('.')) {
            const prefix = content.charAt(0);
            const [commandName, ...args] = content.slice(1).trim().split(' ');
            const cmd = commandName.toLowerCase();

            logger.log('Processing command:', cmd, 'with args:', args);

            // Show typing indicator
            try {
                await sock.sendPresenceUpdate('composing', message.key.remoteJid);
            } catch (err) {
                logger.error('Error setting presence:', err);
            }

            if (commands.has(cmd)) {
                try {
                    await commands.get(cmd)(sock, message, args);
                    logger.log('Command executed successfully:', cmd);
                } catch (err) {
                    logger.error('Error executing command:', err);
                    const errorMessage = err.message || 'Unknown error occurred';
                    await sock.sendMessage(message.key.remoteJid, {
                        text: `❌ Error executing command: ${errorMessage}. Please try again.`
                    });
                }
            } else {
                logger.log('Command not found:', cmd);
                await sock.sendMessage(message.key.remoteJid, {
                    text: `❌ Command not found. Try !help or !menu for available commands.`
                });
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
            await sock.sendMessage(message.key.remoteJid, {
                text: '❌ An error occurred while processing your message.'
            });
        } catch (sendErr) {
            logger.error('Failed to send error message:', sendErr);
        }
    }
}

// Initialize handler
async function init() {
    try {
        logger.log('Initializing ultra minimal handler');

        // Load all commands first
        await loadCommands();

        // Add fallback commands
        addFallbackCommands();

        logger.log(`Handler initialized with ${commands.size} commands`);
        logger.log('Available commands:', Array.from(commands.keys()));
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