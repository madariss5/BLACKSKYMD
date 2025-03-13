const logger = require('../utils/logger');
const config = require('../config/config');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const fs = require('fs').promises;
const path = require('path');

// Message rate limiting
const messageRateLimit = new Map();
const RATE_LIMIT = 10; // messages per minute
const RATE_WINDOW = 60000; // 1 minute in milliseconds

// Command cooldowns
const commandCooldowns = new Map();

// Typing indicators
const typingStates = new Map();

// Store command handler reference
let commandProcessor = null;

/**
 * Initialize message handler
 */
async function init() {
    try {
        logger.info('Starting message handler initialization...');

        // Load command handler
        try {
            logger.info('Loading command handler module...');
            const commandHandler = require('./commandHandler');

            // Verify command handler structure
            logger.info('Command handler module loaded, verifying structure:', {
                moduleType: typeof commandHandler,
                hasProcessCommand: typeof commandHandler.processCommand === 'function',
                hasCommands: typeof commandHandler.commands === 'object',
                commandCount: commandHandler.commands?.size || 0
            });

            if (!commandHandler || typeof commandHandler.processCommand !== 'function') {
                throw new Error('Invalid command handler structure');
            }

            commandProcessor = commandHandler.processCommand;
            logger.info('Command handler verification successful');
        } catch (err) {
            logger.error('Failed to load command handler:', err);
            logger.error('Command handler stack trace:', err.stack);
            return false;
        }

        // Create temp directories
        try {
            const tempDir = path.join(__dirname, '../../temp');
            await fs.mkdir(tempDir, { recursive: true });
            logger.info('Temp directory created:', tempDir);
        } catch (err) {
            logger.warn('Failed to create temp directory:', err);
            // Non-critical error, continue initialization
        }

        logger.info('Message handler initialization completed successfully');
        return true;
    } catch (err) {
        logger.error('Message handler initialization failed:', err);
        logger.error('Full error details:', {
            name: err.name,
            message: err.message,
            stack: err.stack,
            code: err.code
        });
        return false;
    }
}

/**
 * Check rate limit for a user
 */
function checkRateLimit(userId) {
    const now = Date.now();
    const userRates = messageRateLimit.get(userId) || [];
    const validRates = userRates.filter(time => now - time < RATE_WINDOW);

    if (validRates.length >= RATE_LIMIT) {
        return false;
    }

    validRates.push(now);
    messageRateLimit.set(userId, validRates);
    return true;
}

/**
 * Check command cooldown
 */
function checkCommandCooldown(userId, command) {
    const now = Date.now();
    const key = `${userId}:${command}`;
    const cooldownExpiry = commandCooldowns.get(key);

    if (cooldownExpiry && now < cooldownExpiry) {
        return Math.ceil((cooldownExpiry - now) / 1000);
    }

    commandCooldowns.set(key, now + 3000);
    return 0;
}

/**
 * Show typing indicator
 */
async function showTypingIndicator(sock, jid) {
    try {
        if (!typingStates.get(jid)) {
            typingStates.set(jid, true);
            await sock.sendPresenceUpdate('composing', jid);

            setTimeout(async () => {
                await sock.sendPresenceUpdate('paused', jid);
                typingStates.set(jid, false);
            }, 1000);
        }
    } catch (err) {
        logger.error('Error showing typing indicator:', err);
    }
}

/**
 * Handle incoming messages
 */
async function messageHandler(sock, message) {
    try {
        // Log incoming message for debugging
        logger.debug('Received message:', {
            type: message.message ? Object.keys(message.message)[0] : null,
            from: message.key.remoteJid,
            messageContent: message.message?.conversation || 
                          message.message?.extendedTextMessage?.text ||
                          message.message?.imageMessage?.caption ||
                          message.message?.videoMessage?.caption
        });

        // Basic validation
        if (!message?.message || !message.key?.remoteJid) {
            return;
        }

        const sender = message.key.remoteJid;
        const isGroup = sender.endsWith('@g.us');

        // Extract text content
        const messageContent = message.message?.conversation ||
                             message.message?.extendedTextMessage?.text ||
                             message.message?.imageMessage?.caption ||
                             message.message?.videoMessage?.caption;

        if (!messageContent) {
            return;
        }

        // Check rate limit
        if (!checkRateLimit(sender)) {
            logger.warn(`Rate limit exceeded for ${sender}`);
            return;
        }

        // Get prefix from config
        const prefix = config?.bot?.prefix || '!';

        // Process commands
        if (messageContent.startsWith(prefix)) {
            const commandText = messageContent.slice(prefix.length).trim();
            if (!commandText) {
                return;
            }

            // Command cooldown check
            const command = commandText.split(' ')[0];
            const cooldown = checkCommandCooldown(sender, command);
            if (cooldown > 0) {
                await sock.sendMessage(sender, {
                    text: `⏳ Please wait ${cooldown} seconds before using this command again.`
                });
                return;
            }

            // Show typing indicator
            await showTypingIndicator(sock, sender);

            try {
                // Verify command processor is available
                if (!commandProcessor) {
                    throw new Error('Command processor not initialized');
                }

                // Process command
                await commandProcessor(sock, message, commandText, { isGroup });
                logger.info(`Command ${command} processed successfully for ${sender}`);
            } catch (err) {
                logger.error('Command execution failed:', {
                    error: err.message,
                    stack: err.stack,
                    command: commandText,
                    sender: sender
                });
                await sock.sendMessage(sender, {
                    text: '❌ Command failed. Please try again.\n\nUse !help to see available commands.'
                });
            }
        }
    } catch (err) {
        logger.error('Error in message handler:', err);
        logger.error('Stack trace:', err.stack);
    }
}

module.exports = { messageHandler, init };