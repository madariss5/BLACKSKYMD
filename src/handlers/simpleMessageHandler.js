/**
 * Simple Message Handler for WhatsApp Bot
 * A lightweight alternative that avoids complex module dependencies
 */

// Setup basic logging even if logger module fails
let logger;
try {
    logger = require('../utils/logger');
} catch (err) {
    // Fallback to basic console logging if logger module fails
    logger = {
        info: console.log,
        error: console.error,
        warn: console.warn,
        debug: console.debug
    };
    console.warn('Using fallback logger due to error:', err);
}

// Simple command registry - we'll add basic commands here
const commands = new Map();

// Add basic ping command
commands.set('ping', async (sock, message) => {
    try {
        const sender = message.key.remoteJid;
        await sock.sendMessage(sender, { 
            text: '🏓 Pong! Bot is active and responding.' 
        });
    } catch (err) {
        logger.error('Error executing ping command:', err);
    }
});

// Add help command
commands.set('help', async (sock, message) => {
    try {
        const sender = message.key.remoteJid;
        const commandList = Array.from(commands.keys())
            .map(name => `!${name}`)
            .join('\n');

        await sock.sendMessage(sender, {
            text: `*Available Commands:*\n\n${commandList}`
        });
    } catch (err) {
        logger.error('Error executing help command:', err);
    }
});

// Add info command
commands.set('info', async (sock, message) => {
    try {
        const sender = message.key.remoteJid;
        await sock.sendMessage(sender, {
            text: '🤖 *WhatsApp Bot Info*\n\n' +
                  'Version: 1.0.0\n' +
                  'Status: Active\n' +
                  'Commands: ' + commands.size + ' available\n\n' +
                  'This is a simplified fallback handler.'
        });
    } catch (err) {
        logger.error('Error executing info command:', err);
    }
});

/**
 * Process a command
 */
async function processCommand(sock, message, commandText) {
    try {
        const sender = message.key.remoteJid;
        
        // Skip if no command text
        if (!commandText?.trim()) {
            return;
        }

        // Split command and args
        const [commandName, ...args] = commandText.trim().split(' ');
        const command = commands.get(commandName.toLowerCase());

        if (!command) {
            await sock.sendMessage(sender, {
                text: `❌ Unknown command: ${commandName}\nUse !help to see available commands.`
            });
            return;
        }

        // Execute command
        await command(sock, message, args);
        logger.info(`Command ${commandName} executed successfully`);

    } catch (err) {
        logger.error('Command processing error:', err);
    }
}

/**
 * Handle incoming messages
 */
async function messageHandler(sock, message) {
    try {
        // Basic validation
        if (!message?.message || !message.key?.remoteJid) {
            return;
        }

        const sender = message.key.remoteJid;
        
        // Extract text content
        const messageContent = message.message?.conversation ||
                             message.message?.extendedTextMessage?.text ||
                             message.message?.imageMessage?.caption ||
                             message.message?.videoMessage?.caption;

        if (!messageContent) {
            return;
        }

        // Use ! as command prefix
        const prefix = '!';
        
        // Process commands
        if (messageContent.startsWith(prefix)) {
            const commandText = messageContent.slice(prefix.length).trim();
            if (commandText) {
                await processCommand(sock, message, commandText);
            }
        }
    } catch (err) {
        logger.error('Error in simple message handler:', err);
    }
}

/**
 * Initialize message handler
 */
async function init() {
    try {
        logger.info('Initializing simple message handler...');
        
        // Add status command
        if (!commands.has('status')) {
            commands.set('status', async (sock, message) => {
                const sender = message.key.remoteJid;
                await sock.sendMessage(sender, { 
                    text: '✅ System Status: Online\n⏱️ Using Simple Message Handler\n🤖 Basic commands available' 
                });
            });
        }
        
        // Log the successful initialization
        logger.info(`Simple message handler initialized with ${commands.size} built-in commands`);
        
        return true;
    } catch (err) {
        logger.error('Simple message handler initialization error:', err);
        return false;
    }
}

module.exports = {
    messageHandler,
    init,
    commands
};