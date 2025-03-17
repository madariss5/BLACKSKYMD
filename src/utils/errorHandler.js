/**
 * Centralized Error Handler for WhatsApp Bot Commands
 * Provides standardized error handling and reporting for all command modules
 */

// Load logger
let logger;
try {
    logger = require('./logger');
} catch (err) {
    // Fallback to console if logger isn't available
    logger = {
        info: console.log,
        error: console.error,
        warn: console.warn,
        debug: console.log
    };
}

// Load safe message helpers
let jidHelper;
try {
    jidHelper = require('./jidHelper');
} catch (err) {
    // Fallback if jidHelper isn't available
    jidHelper = {
        safeSendMessage: async (sock, jid, content) => {
            try {
                return await sock.sendMessage(jid, content);
            } catch (err) {
                logger.error(`Error sending message: ${err.message}`);
                return null;
            }
        }
    };
}

// Counter for retry attempts per command
const retryCounter = new Map();

/**
 * Handle an error that occurred during command execution
 * @param {Object} sock - The WhatsApp socket connection
 * @param {string} jid - The JID where the error occurred
 * @param {Error} error - The error object
 * @param {string} commandName - The name of the command that failed
 * @param {string} moduleName - The module containing the command
 * @param {Object} options - Additional options
 * @param {boolean} options.reply - Whether to reply to the user (default: true)
 * @param {boolean} options.logError - Whether to log the error (default: true)
 * @param {boolean} options.userFriendly - Whether to send a user-friendly message (default: true)
 * @param {boolean} options.detailed - Whether to include technical details (default: false)
 * @param {boolean} options.useRetry - Whether to use retry mechanism (default: true)
 * @returns {Promise<void>}
 */
async function handleCommandError(sock, jid, error, commandName, moduleName, options = {}) {
    // Default options
    const {
        reply = true,
        logError = true,
        userFriendly = true,
        detailed = false,
        useRetry = true
    } = options;
    
    // Always log errors unless specifically disabled
    if (logError) {
        logger.error(`Error in command "${commandName}" from module "${moduleName}": ${error.message}`);
        if (error.stack) {
            logger.error(`Stack trace: ${error.stack}`);
        }
    }
    
    // Skip reply if disabled
    if (!reply || !sock || !jid) return;
    
    try {
        // Determine user-friendly message based on error type
        const errorCategory = categorizeError(error);
        let userMessage = userFriendly 
            ? getUserFriendlyErrorMessage(errorCategory, commandName)
            : `Error executing command ${commandName}: ${error.message}`;
            
        // Add technical details if requested
        if (detailed) {
            userMessage += `\n\nTechnical details: ${error.message}`;
            if (error.code) {
                userMessage += `\nError code: ${error.code}`;
            }
        }
        
        // Send error message with retry mechanism
        if (useRetry) {
            await retryMessageSend(sock, jid, { text: userMessage });
        } else {
            await jidHelper.safeSendMessage(sock, jid, { text: userMessage });
        }
    } catch (sendErr) {
        logger.error(`Failed to send error message: ${sendErr.message}`);
    }
}

/**
 * Safely execute a command with error handling
 * @param {Function} commandFunction - The command function to execute
 * @param {Object} sock - The WhatsApp socket connection
 * @param {Object} message - The message object
 * @param {Array} args - Command arguments
 * @param {string} commandName - The name of the command
 * @param {string} moduleName - The module containing the command
 * @returns {Promise<any>} - The result from the command function or null if it failed
 */
async function safelyExecuteCommand(commandFunction, sock, message, args, commandName, moduleName) {
    try {
        return await commandFunction(sock, message, args);
    } catch (error) {
        await handleCommandError(sock, message.key.remoteJid, error, commandName, moduleName);
        return null;
    }
}

/**
 * Create a wrapped version of a command function with built-in error handling
 * @param {Function} commandFunction - The original command function
 * @param {string} commandName - The name of the command
 * @param {string} moduleName - The module containing the command
 * @returns {Function} - The wrapped command function
 */
function wrapWithErrorHandler(commandFunction, commandName, moduleName) {
    return async (sock, message, args) => {
        return await safelyExecuteCommand(commandFunction, sock, message, args, commandName, moduleName);
    };
}

/**
 * Add error handling to all commands in a module
 * @param {Object} commandsObject - The object containing command functions
 * @param {string} moduleName - The name of the module
 * @returns {Object} - A new object with all commands wrapped with error handling
 */
function addErrorHandlingToAll(commandsObject, moduleName) {
    const wrappedCommands = {};
    
    Object.keys(commandsObject).forEach(commandName => {
        if (typeof commandsObject[commandName] === 'function') {
            wrappedCommands[commandName] = wrapWithErrorHandler(
                commandsObject[commandName],
                commandName,
                moduleName
            );
        } else {
            wrappedCommands[commandName] = commandsObject[commandName];
        }
    });
    
    return wrappedCommands;
}

/**
 * Check if an error is a user input error
 * @param {Error} error - The error to check
 * @returns {boolean} - Whether it's a user input error
 */
function isUserInputError(error) {
    if (!error) return false;
    
    // Check for common input error messages
    const userInputErrorPatterns = [
        /invalid (input|argument|parameter)/i,
        /missing (required )?(input|argument|parameter)/i,
        /incorrect format/i,
        /too (few|many) arguments/i,
        /argument out of range/i,
        /invalid URL/i,
        /user not found/i,
        /group not found/i
    ];
    
    return userInputErrorPatterns.some(pattern => pattern.test(error.message));
}

/**
 * Categorize an error to provide more specific handling and user messages
 * @param {Error} error - The error to categorize
 * @returns {string} - Error category
 */
function categorizeError(error) {
    if (!error) return 'unknown';
    
    // Check for input errors first
    if (isUserInputError(error)) {
        return 'input';
    }
    
    // Network/connection related errors
    if (/network|connection|timeout|econnrefused|fetch|request|unavailable/i.test(error.message)) {
        return 'network';
    }
    
    // Permission related errors
    if (/permission|unauthorized|forbidden|not allowed|admin only/i.test(error.message)) {
        return 'permission';
    }
    
    // Media/file related errors
    if (/file|media|image|video|audio|download|upload|buffer|stream/i.test(error.message)) {
        return 'media';
    }
    
    // WhatsApp specific errors
    if (/whatsapp|wa|baileys|socket|jid|message|chat|group/i.test(error.message)) {
        return 'whatsapp';
    }
    
    // Rate limiting
    if (/rate|limit|too many|throttle/i.test(error.message)) {
        return 'ratelimit';
    }
    
    // Default to general error
    return 'general';
}

/**
 * Get user-friendly message based on error category
 * @param {string} category - Error category
 * @param {string} commandName - Name of the command that failed
 * @returns {string} - User-friendly error message
 */
function getUserFriendlyErrorMessage(category, commandName) {
    switch (category) {
        case 'input':
            return `⚠️ There seems to be an issue with the way you used the ${commandName} command. Please check the command format with .help ${commandName}.`;
        
        case 'network':
            return `⚠️ Sorry, I couldn't complete the ${commandName} command because of a network issue. Please try again later.`;
        
        case 'permission':
            return `⚠️ You don't have permission to use the ${commandName} command, or I need admin rights to perform this action.`;
        
        case 'media':
            return `⚠️ There was a problem processing the media for the ${commandName} command. Make sure you're sending a supported file type and it's not too large.`;
        
        case 'whatsapp':
            return `⚠️ I encountered a WhatsApp-related issue while running the ${commandName} command. Please try again later.`;
        
        case 'ratelimit':
            return `⚠️ You're using the ${commandName} command too frequently. Please wait a moment before trying again.`;
        
        case 'general':
        default:
            return `⚠️ An error occurred while running the ${commandName} command. Please try again later.`;
    }
}

/**
 * Retry sending a message with exponential backoff
 * @param {Object} sock - WhatsApp socket connection
 * @param {any} jid - JID to send to
 * @param {Object} content - Message content
 * @param {Object} options - Retry options
 * @param {number} options.maxRetries - Maximum retry attempts (default: 3)
 * @param {number} options.initialDelay - Initial delay in ms (default: 500)
 * @param {Function} options.sendFunction - Function to use for sending (default: safeSendMessage)
 * @returns {Promise<Object|null>} - Message sending result or null if all retries failed
 */
async function retryMessageSend(sock, jid, content, options = {}) {
    const {
        maxRetries = 3,
        initialDelay = 500,
        sendFunction = jidHelper.safeSendMessage
    } = options;
    
    let attempt = 0;
    let delay = initialDelay;
    
    while (attempt < maxRetries) {
        try {
            return await sendFunction(sock, jid, content);
        } catch (err) {
            attempt++;
            
            if (attempt >= maxRetries) {
                logger.error(`Failed to send message after ${maxRetries} attempts: ${err.message}`);
                return null;
            }
            
            logger.warn(`Message send attempt ${attempt} failed: ${err.message}. Retrying in ${delay}ms`);
            
            // Wait before retry
            await new Promise(resolve => setTimeout(resolve, delay));
            
            // Exponential backoff
            delay *= 2;
        }
    }
    
    return null;
}

module.exports = {
    handleCommandError,
    safelyExecuteCommand,
    wrapWithErrorHandler,
    addErrorHandlingToAll,
    isUserInputError,
    categorizeError,
    getUserFriendlyErrorMessage,
    retryMessageSend
};