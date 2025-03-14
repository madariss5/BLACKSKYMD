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

        logger.log('\nStarting command loading process...');
        logger.log('Loading commands from:', commandsPath);

        for (const file of files) {
            if (file.endsWith('.js') && !['index.js'].includes(path.basename(file))) {
                try {
                    logger.log(`\nProcessing file: ${path.relative(commandsPath, file)}`);
                    const filePath = file;
                    const moduleData = require(filePath);
                    const category = path.basename(path.dirname(file));

                    // Handle both direct commands and categorized commands
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
                                logger.log(`✓ Loaded command: ${name} (${category})`);
                            }
                        });

                        // Initialize module if it has init function
                        if (typeof moduleData.init === 'function') {
                            try {
                                await moduleData.init();
                                logger.log(`✓ Initialized module: ${path.basename(file, '.js')}`);
                            } catch (err) {
                                logger.error(`Error initializing module ${path.basename(file, '.js')}:`, err);
                            }
                        }
                    } else if (typeof moduleData === 'object') {
                        // Direct command exports
                        Object.entries(moduleData).forEach(([name, func]) => {
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
                                logger.log(`✓ Loaded direct command: ${name} (${category})`);
                            }
                        });
                    }
                } catch (err) {
                    logger.error(`Error loading commands from ${file}:`, err);
                }
            }
        }

        logger.log('\n✅ Command loading summary:');
        logger.log(`Total commands loaded: ${loadedCount}`);
        logger.log('Available commands:', Array.from(commands.keys()).sort().join(', '));

        if (loadedCount === 0) {
            logger.error('⚠️ Warning: No commands were loaded!');
        }
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
                logger.log('Executed ping command successfully');
            } catch (err) {
                logger.error('Error in ping command:', err);
            }
        });
        logger.log('Added fallback ping command');
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
                logger.log('Executed menu command successfully');
            } catch (err) {
                logger.error('Error in menu command:', err);
            }
        });
        logger.log('Added fallback menu command');
    }
}

// Update message handler to provide better logging
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
        if (content.startsWith('!') || content.startsWith('/') || content.startsWith('.')) {
            const prefix = content.charAt(0);
            const [commandName, ...args] = content.slice(1).trim().split(' ');
            const cmd = commandName.toLowerCase();

            logger.log('\nProcessing command:', cmd, 'with args:', args);

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
                    await sock.sendMessage(message.key.remoteJid, {
                        text: `❌ Error executing command: ${err.message}. Please try again.`
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
        logger.log('\nInitializing ultra minimal handler...');

        // Load all commands first
        await loadCommands();

        // Add fallback commands
        addFallbackCommands();

        // Verify commands are loaded
        const totalCommands = commands.size;
        const commandList = Array.from(commands.keys()).sort();

        logger.log('\n✅ Handler initialization complete:');
        logger.log(`Total commands available: ${totalCommands}`);
        logger.log('Try these basic commands:');
        logger.log('- !ping (Test bot response)');
        logger.log('- !menu (Show all commands)');

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