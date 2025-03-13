/**
 * Simple Message Handler for WhatsApp Bot - Optimized for Speed
 */

let logger;
try {
    logger = require('../utils/logger');
} catch (err) {
    logger = {
        info: console.log,
        error: console.error,
        warn: console.warn,
        debug: console.debug
    };
}

// Use Map for faster command lookup
const commands = new Map();

// Add optimized ping command
commands.set('ping', async (sock, message) => {
    const sender = message.key.remoteJid;
    await sock.sendMessage(sender, { text: '🏓 Pong!' });
});

// Add optimized help command
commands.set('help', async (sock, message) => {
    const sender = message.key.remoteJid;
    const commandList = Array.from(commands.keys())
        .map(name => `!${name}`)
        .join('\n');
    await sock.sendMessage(sender, {
        text: `*Available Commands:*\n\n${commandList}`
    });
});

// Add optimized info command
commands.set('info', async (sock, message) => {
    const sender = message.key.remoteJid;
    await sock.sendMessage(sender, {
        text: '🤖 *Bot Info*\nVersion: 1.0.0\nStatus: Active\nCommands: ' + commands.size
    });
});

/**
 * Optimized command processor
 */
async function processCommand(sock, message, commandText) {
    const sender = message.key.remoteJid;
    if (!commandText?.trim()) return;

    const [commandName, ...args] = commandText.trim().split(' ');
    const command = commands.get(commandName.toLowerCase());

    if (!command) {
        await sock.sendMessage(sender, {
            text: `❌ Unknown command. Use !help to see available commands.`
        });
        return;
    }

    await command(sock, message, args);
}

/**
 * Optimized message handler
 */
async function messageHandler(sock, message) {
    if (!message?.message || !message.key?.remoteJid) return;

    const messageContent = message.message?.conversation ||
                        message.message?.extendedTextMessage?.text ||
                        message.message?.imageMessage?.caption ||
                        message.message?.videoMessage?.caption;

    if (!messageContent) return;

    // Process commands (using ! prefix)
    if (messageContent.startsWith('!')) {
        const commandText = messageContent.slice(1).trim();
        if (commandText) {
            await processCommand(sock, message, commandText);
        }
    }
}

/**
 * Fast initialization
 */
async function init() {
    try {
        // Add status command
        commands.set('status', async (sock, message) => {
            const sender = message.key.remoteJid;
            await sock.sendMessage(sender, { 
                text: '✅ Bot Online\n⚡ Fast Response Mode' 
            });
        });

        return true;
    } catch (err) {
        logger.error('Handler initialization error:', err);
        return false;
    }
}

module.exports = {
    messageHandler,
    init,
    commands
};