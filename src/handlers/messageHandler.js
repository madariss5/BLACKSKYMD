const logger = require('../utils/logger');
const { safeSendMessage, safeSendText, safeSendImage } = require('../utils/jidHelper');
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
            
            // Get the full path to the command handler module for better error reporting
            const commandHandlerPath = path.resolve(process.cwd(), 'src/handlers/commandHandler.js');
            logger.info(`Command handler path: ${commandHandlerPath}`);
            
            // Check if file exists
            try {
                const stats = await fs.stat(commandHandlerPath);
                logger.info(`Command handler file exists: ${stats.isFile()}`);
            } catch (statErr) {
                logger.error(`Command handler file not found: ${commandHandlerPath}`, statErr);
                // Try to list directory contents for debugging
                try {
                    const dirPath = path.dirname(commandHandlerPath);
                    const files = await fs.readdir(dirPath);
                    logger.info(`Files in ${dirPath}:`, files);
                } catch (readErr) {
                    logger.error(`Could not read directory: ${readErr.message}`);
                }
            }
            
            // Directly use the instance from bot-handler.js to avoid module cache issues
            const commandHandler = require('./commandHandler');

            // Verify command handler structure
            logger.info('Command handler module loaded, verifying structure:', {
                moduleType: typeof commandHandler,
                hasProcessCommand: typeof commandHandler.processCommand === 'function',
                hasCommands: typeof commandHandler.commands === 'object',
                commandCount: commandHandler.commands?.size || 0,
                isInitialized: typeof commandHandler.isInitialized === 'function' ? commandHandler.isInitialized() : false
            });

            if (!commandHandler || typeof commandHandler.processCommand !== 'function') {
                throw new Error('Invalid command handler structure');
            }

            // If commands are not loaded yet, try to load them
            if (commandHandler.commands?.size === 0 && typeof commandHandler.loadCommands === 'function') {
                logger.info('Commands not loaded yet, loading commands...');
                await commandHandler.loadCommands();
                logger.info('Command loading completed, command count:', commandHandler.commands?.size || 0);
            }

            commandProcessor = commandHandler.processCommand;
            logger.info('Command handler verification successful');
        } catch (err) {
            logger.error('Failed to load command handler:', err);
            logger.error('Command handler stack trace:', err.stack);
            
            // Initialize with a simple fallback command processor for resilience
            if (!commandProcessor) {
                logger.warn('Initializing fallback command processor');
                commandProcessor = async (sock, message, commandText) => {
                    logger.warn(`Using fallback processor for command: ${commandText}`);
                    await safeSendText(sock, message.key.remoteJid, 'Command processing is currently limited. Please try again later.' 
                    );
                };
            }
            
            // Don't fail initialization - continue with fallback
            logger.warn('Continuing with fallback command processor');
        }

        // Create temp directories
        try {
            const tempDir = path.join(process.cwd(), 'temp');
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
        
        // First check if this is a credentials backup message (high priority handling)
        if (sock.user && sender === sock.user.id) {
            const messageText = message.message?.conversation || 
                              message.message?.extendedTextMessage?.text;
            
            if (messageText) {
                try {
                    // Try to parse as JSON
                    const data = JSON.parse(messageText);
                    
                    // Check if this is a credentials backup message
                    if (data && data.type === 'BOT_CREDENTIALS_BACKUP') {
                        logger.info('Detected credentials backup message, processing...');
                        
                        // Process the backup using sessionManager
                        const { sessionManager } = require('../utils/sessionManager');
                        const success = await sessionManager.handleCredentialsBackup(message);
                        
                        if (success) {
                            logger.info('Successfully processed credentials backup');
                            // We've handled this special message, no need to process further
                            return;
                        }
                    }
                } catch (jsonErr) {
                    // Not a valid JSON or not our backup format, continue with normal processing
                }
            }
        }

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
                await safeSendMessage(sock, sender, {
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
                await safeSendText(sock, sender, '❌ Command failed. Please try again.\n\nUse !help to see available commands.'
                );
            }
        }
    } catch (err) {
        logger.error('Error in message handler:', err);
        logger.error('Stack trace:', err.stack);
    }
}

// Ensure the init function is exposed correctly and properly initialized
logger.info('Setting up messageHandler module exports');

// Add a simple initialization check function
function isInitialized() {
    return commandProcessor !== null;
}

// Export the module with all required functions
module.exports = { 
    messageHandler, 
    init,
    isInitialized
};