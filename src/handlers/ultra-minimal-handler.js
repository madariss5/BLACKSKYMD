/**
 * Ultra Minimal Message Handler
 * Designed for maximum reliability
 */

const fs = require('fs');
const path = require('path');
const logger = console;

// Commands storage
const commands = new Map();

// Import all commands from the commands directory
try {
    const commandsModule = require('../commands/index');

    // Load commands from the module
    if (commandsModule && commandsModule.commands) {
        logger.log('Loading commands from modules...');
        Object.entries(commandsModule.commands).forEach(([name, func]) => {
            if (typeof func === 'function' && name !== 'init') {
                commands.set(name, async (sock, message, args) => {
                    try {
                        return await func(sock, message, args);
                    } catch (err) {
                        logger.error(`Error executing command ${name}:`, err);
                        throw err;
                    }
                });
            }
        });
        logger.log(`Loaded ${commands.size} commands from modules`);
    }
} catch (err) {
    logger.error('Error loading command modules:', err);
}

// Add fallback commands if they don't exist
if (!commands.has('ping')) {
    commands.set('ping', async (sock, message) => {
        try {
            logger.log('Executing ping command');
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
}

if (!commands.has('status')) {
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
}

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

            const prefix = content.charAt(0);
            const [commandName, ...args] = content.slice(1).trim().split(' ');
            const cmd = commandName.toLowerCase();

            logger.log('Attempting to execute command:', cmd);

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
                        text: 'Error executing command. Please try again.'
                    });
                }
            } else {
                logger.log('Command not found:', cmd);
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

        // Initialize command modules if available
        try {
            if (require('../commands/index').initializeModules) {
                await require('../commands/index').initializeModules();
                logger.log('Command modules initialized');
            }
        } catch (err) {
            logger.error('Error initializing command modules:', err);
        }

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