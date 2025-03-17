/**
 * Enhanced Message Handler
 * Processes incoming messages and triggers appropriate command handlers
 */

const { proto } = require('@whiskeysockets/baileys');
const logger = require('../utils/logger');
const { safeSendMessage, safeSendText } = require('../utils/jidHelper');
const commandRegistry = require('./commandRegistry');

// Queue for message handling to prevent race conditions
let messageQueue = [];
let isProcessing = false;
const MAX_QUEUE_SIZE = 50; // Prevent memory issues from queue growing too large

/**
 * Add a message to the processing queue
 * @param {Object} sock - WhatsApp socket
 * @param {Object} message - Message object
 */
function enqueueMessage(sock, message) {
    // Limit queue size to prevent memory issues
    if (messageQueue.length >= MAX_QUEUE_SIZE) {
        messageQueue.shift(); // Remove oldest message
    }
    
    messageQueue.push({ sock, message });
    
    // Start processing if not already in progress
    if (!isProcessing) {
        processMessageQueue();
    }
}

/**
 * Process the message queue sequentially
 */
async function processMessageQueue() {
    if (isProcessing || messageQueue.length === 0) {
        return;
    }
    
    isProcessing = true;
    
    try {
        const { sock, message } = messageQueue.shift();
        await processMessage(sock, message);
    } catch (err) {
        logger.error('Error processing message from queue:', err);
    } finally {
        isProcessing = false;
        
        // Continue processing if there are more messages
        if (messageQueue.length > 0) {
            processMessageQueue();
        }
    }
}

/**
 * Extract text from a message
 * @param {Object} message - The message object
 * @returns {string|null} - Extracted text or null
 */
function extractMessageText(message) {
    if (!message.message) return null;
    
    return message.message.conversation ||
           message.message.extendedTextMessage?.text ||
           message.message.imageMessage?.caption ||
           message.message.videoMessage?.caption ||
           message.message.documentMessage?.caption;
}

/**
 * Process a single message
 * @param {Object} sock - WhatsApp socket
 * @param {Object} message - Message object
 */
async function processMessage(sock, message) {
    try {
        if (!message?.key?.remoteJid) return;
        
        // Skip messages from status broadcast
        if (message.key.remoteJid === 'status@broadcast') return;
        
        // Ensure the command registry is initialized
        if (!commandRegistry.isInitialized) {
            await commandRegistry.initialize();
        }
        
        // Extract message text
        const messageText = extractMessageText(message);
        if (!messageText) return;
        
        // Process command if it starts with the prefix
        if (messageText.startsWith(commandRegistry.prefix)) {
            await handleCommand(sock, message, messageText);
        }
        
        // Additional message processing logic can be added here
        // For example: auto-responders, keyword triggers, etc.
    } catch (err) {
        logger.error('Error processing message:', err);
    }
}

/**
 * Handle command execution
 * @param {Object} sock - WhatsApp socket
 * @param {Object} message - Message object
 * @param {string} messageText - The message text
 */
async function handleCommand(sock, message, messageText) {
    try {
        // Parse command and arguments
        const commandText = messageText.slice(commandRegistry.prefix.length).trim();
        if (!commandText) return;
        
        const [commandName, ...args] = commandText.split(' ');
        if (!commandName) return;
        
        const sender = message.key.remoteJid;
        
        // Get the command
        const command = commandRegistry.getCommand(commandName.toLowerCase());
        
        // Command not found
        if (!command) {
            await safeSendText(sock, sender, 
                `❌ Unknown command: *${commandName}*\nUse ${commandRegistry.prefix}help to see available commands.`
            );
            return;
        }
        
        // Check permissions
        if (!commandRegistry.hasPermission(sender, command.config.permissions)) {
            await safeSendText(sock, sender, 
                '❌ You do not have permission to use this command.'
            );
            return;
        }
        
        // Execute command with error handling
        try {
            logger.info(`Executing command: ${commandName} with args: ${args.join(' ')}`);
            await command.execute(sock, message, args);
        } catch (err) {
            logger.error(`Error executing command ${commandName}:`, err);
            
            // Send error message to user
            await safeSendText(sock, sender,
                `❌ Error executing command *${commandName}*: ${err.message}\nPlease try again.`
            );
        }
    } catch (err) {
        logger.error('Error in command handler:', err);
    }
}

/**
 * Main message handler function (entry point)
 * @param {Object} sock - WhatsApp socket
 * @param {Object} message - Message object
 */
async function messageHandler(sock, message) {
    // Add message to processing queue
    enqueueMessage(sock, message);
}

module.exports = {
    messageHandler,
    extractMessageText,
    processMessage
};