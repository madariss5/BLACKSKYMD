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
                await safeSendText(sock, sender, '🏓 Pong! Bot is working.' );
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
                await safeSendText(sock, sender, menuText );
                logger.log('Executed menu command successfully');
            } catch (err) {
                logger.error('Error in menu command:', err);
            }
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
        const validPrefixes = ['!', '/', '.'];
        const prefix = content.charAt(0);
        const isCommand = validPrefixes.includes(prefix);

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
                    await commands.get(commandName)(sock, message, args);
                    console.log('Command executed successfully:', commandName);
                } catch (err) {
                    logger.error(`Error executing command ${commandName}:`, err);
                    await sock.sendMessage(message.key.remoteJid, {
                        text: `❌ Error executing command: ${err.message || 'Unknown error'}. Please try again.`
                    });
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
                    suggestText = `\n\nDid you mean: ${similarCommands.map(cmd => `*!${cmd}*`).join(', ')}?`;
                }
                
                await sock.sendMessage(message.key.remoteJid, {
                    text: `❌ Command *!${commandName}* not found. Try !help or !menu for available commands.${suggestText}`
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