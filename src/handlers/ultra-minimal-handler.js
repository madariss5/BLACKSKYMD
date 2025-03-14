/**
 * Ultra Minimal Message Handler
 * Designed for maximum reliability
 */

const fs = require('fs');
const path = require('path');
const logger = console;

// Commands storage
const commands = new Map();

// Basic ping command
commands.set('ping', async (sock, message) => {
    try {
        logger.log('Executing ping command');
        const sender = message.key.remoteJid;
        await sock.sendMessage(sender, { text: '🏓 Pong! Bot is working.' });
    } catch (err) {
        logger.error('Error in ping command:', err);
    }
});

// Help command
commands.set('help', async (sock, message) => {
    try {
        logger.log('Executing help command');
        const sender = message.key.remoteJid;
        const commandList = Array.from(commands.keys()).join(', ');
        await sock.sendMessage(sender, { 
            text: `*Available Commands*\n${commandList}`
        });
    } catch (err) {
        logger.error('Error in help command:', err);
    }
});

// Add status command
commands.set('status', async (sock, message) => {
    try {
        const sender = message.key.remoteJid;
        const uptime = process.uptime();
        const hours = Math.floor(uptime / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        const seconds = Math.floor(uptime % 60);

        const statusText = `*📊 Bot Status*\n\n` +
                           `🟢 *Status:* Online\n` +
                           `⏱️ *Uptime:* ${hours}h ${minutes}m ${seconds}s\n` +
                           `🧩 *Commands:* ${commands.size}\n`;

        await sock.sendMessage(sender, { text: statusText });
    } catch (err) {
        logger.error('Error in status command:', err);
    }
});

// Add about command 
if (!commands.has('about')) {
    commands.set('about', async (sock, message) => {
        try {
            if (!message.key?.remoteJid) return;
            const sender = message.key.remoteJid;

            const aboutText = `*🤖 BLACKSKY-MD Bot*\n\n` +
                              `A reliable WhatsApp bot with multi-level fallback system.\n\n` +
                              `*Version:* 1.0.0\n` +
                              `*Framework:* @whiskeysockets/baileys\n` +
                              `*Commands:* ${commands.size}\n\n` +
                              `Type *!help* for available commands.`;

            await sock.sendMessage(sender, { text: aboutText });
        } catch (err) {
            logger.error('Error in about command:', err);
        }
    });
}


// Message handler
async function messageHandler(sock, message) {
    try {
        logger.log('Message received:', JSON.stringify(message, null, 2));

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

        logger.log('Message content:', content);

        if (!content) {
            logger.log('No text content found');
            return;
        }

        // Check for command prefix
        if (content.startsWith('!') || content.startsWith('.')) {
            logger.log('Command detected:', content);

            const commandName = content.slice(1).trim().split(' ')[0].toLowerCase();
            logger.log('Attempting to execute command:', commandName);

            // Show typing indicator
            try {
                await sock.sendPresenceUpdate('composing', message.key.remoteJid);
            } catch (err) {
                logger.error('Error setting presence:', err);
            }

            if (commands.has(commandName)) {
                try {
                    await commands.get(commandName)(sock, message);
                    logger.log('Command executed successfully:', commandName);
                } catch (err) {
                    logger.error('Error executing command:', err);
                    await sock.sendMessage(message.key.remoteJid, {
                        text: 'Error executing command. Please try again.'
                    });
                }
            } else {
                logger.log('Command not found:', commandName);
                await sock.sendMessage(message.key.remoteJid, {
                    text: `Command not found. Try !help for available commands.`
                });
            }

            // Stop typing indicator
            try {
                await sock.sendPresenceUpdate('paused', message.key.remoteJid);
            } catch (err) {
                logger.error('Error clearing presence:', err);
            }
        } else {
            logger.log('Not a command message');
        }
    } catch (err) {
        logger.error('Error in message handler:', err);
        try {
            await sock.sendMessage(message.key.remoteJid, {
                text: 'An error occurred while processing your message.'
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