/**
 * Centralized Error Handler for WhatsApp Bot Commands
 * Provides standardized error handling and reporting for all command modules
 */

const logger = require('./logger');
const { 
  safeSendMessage, 
  safeSendText, 
  safeSendImage,
  safeSendButtons,
  normalizeJid,
  ensureJidString
} = require('./jidHelper');

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
  const {
    reply = true,
    logError = true,
    userFriendly = true,
    detailed = false,
    useRetry = true
  } = options;
  
  // Log the error
  if (logError) {
    // Add category for better log classification
    const category = categorizeError(error);
    
    logger.error(`Error in ${moduleName}.${commandName} [${category}]: ${error.message}`, {
      error: error.stack,
      module: moduleName,
      command: commandName,
      category,
      jid: ensureJidString(jid)
    });
  }
  
  // Send error response to user
  if (reply) {
    // Skip responding for certain errors or invalid recipients
    if (!jid || jid === 'unknown' || !sock || typeof sock.sendMessage !== 'function') {
      logger.warn(`Can't send error message: Invalid sock or JID (command: ${commandName}, module: ${moduleName})`);
      return;
    }
    
    // Handle user input errors directly without retry mechanism
    if (isUserInputError(error) && userFriendly) {
      try {
        const errorMessage = `❌ *Error:* ${error.message}`;
        await safeSendText(sock, jid, errorMessage);
        return;
      } catch (inputErrorReplyError) {
        logger.error(`Failed to send input error message: ${inputErrorReplyError.message}`);
      }
    }
    
    // Use enhanced error messaging with retry for other errors
    if (useRetry) {
      try {
        const messageSent = await sendEnhancedErrorMessage(
          sock, 
          jid, 
          error, 
          commandName,
          userFriendly ? false : detailed
        );
        
        if (messageSent) {
          return;
        }
      } catch (enhancedMessageError) {
        logger.error(`Enhanced error message failed: ${enhancedMessageError.message}`);
      }
    }
    
    // Fallback to simple message if enhanced messaging fails or isn't used
    try {
      let errorMessage;
      
      if (userFriendly) {
        // Get user-friendly message based on error category
        const category = categorizeError(error);
        errorMessage = `❌ ${getUserFriendlyErrorMessage(category, commandName)}`;
      } else {
        // Technical error with details (for debugging/admin)
        errorMessage = `❌ *Error in ${commandName}*:\n\n${error.message}\n\nModule: ${moduleName}`;
      }
      
      await safeSendText(sock, jid, errorMessage);
    } catch (replyError) {
      logger.error(`All error messaging methods failed: ${replyError.message}`);
    }
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
    // Safely extract JID, handle case where message might be invalid
    let jid = 'unknown';
    try {
      if (message && message.key && message.key.remoteJid) {
        jid = message.key.remoteJid;
      } else if (sock && sock.user && sock.user.id) {
        // Fall back to bot's own JID if message JID is not available
        jid = sock.user.id;
      }
    } catch (e) {
      logger.error(`Failed to extract JID: ${e.message}`);
    }
    
    await handleCommandError(sock, jid, error, commandName, moduleName);
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
  return async function(sock, message, args) {
    // Validate required parameters
    if (!sock) {
      logger.error(`Invalid socket passed to ${commandName} in ${moduleName}`);
      return null;
    }
    
    // If args is undefined, initialize as empty array
    if (!args) {
      args = [];
    }
    
    // Apply timeout to prevent hanging commands (10 second default)
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Command ${commandName} timed out after 10 seconds`));
      }, 10000);
    });
    
    try {
      // Race the command execution against the timeout
      return await Promise.race([
        safelyExecuteCommand(commandFunction, sock, message, args, commandName, moduleName),
        timeoutPromise
      ]);
    } catch (error) {
      // Handle timeout errors
      logger.error(`Timeout or error in ${commandName}: ${error.message}`);
      
      // Get JID if possible for error reporting
      let jid = 'unknown';
      try {
        if (message && message.key && message.key.remoteJid) {
          jid = message.key.remoteJid;
        }
      } catch (e) {
        // Ignore JID extraction errors
      }
      
      await handleCommandError(
        sock, 
        jid, 
        error, 
        commandName, 
        moduleName, 
        { userFriendly: true }
      );
      
      return null;
    }
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
  
  for (const [commandName, commandFunction] of Object.entries(commandsObject)) {
    if (typeof commandFunction === 'function') {
      wrappedCommands[commandName] = wrapWithErrorHandler(
        commandFunction,
        commandName,
        moduleName
      );
    } else {
      wrappedCommands[commandName] = commandFunction;
    }
  }
  
  return wrappedCommands;
}

/**
 * Check if an error is a user input error
 * @param {Error} error - The error to check
 * @returns {boolean} - Whether it's a user input error
 */
function isUserInputError(error) {
  // Check for custom property
  if (error.isUserError) {
    return true;
  }
  
  // Check for specific error messages that indicate user input problems
  const userErrorPatterns = [
    /invalid (input|argument|parameter)/i,
    /missing (input|argument|parameter)/i,
    /please provide/i,
    /not found/i,
    /no results/i,
    /invalid format/i,
    /not supported/i,
    /too (large|small|long|short)/i,
    /exceeded limit/i,
    /must be (a|an) [a-z]+/i
  ];
  
  return userErrorPatterns.some(pattern => pattern.test(error.message));
}

/**
 * Categorize an error to provide more specific handling and user messages
 * @param {Error} error - The error to categorize
 * @returns {string} - Error category
 */
function categorizeError(error) {
  const message = error.message.toLowerCase();
  
  // Connection-related errors
  if (message.includes('connection') || 
      message.includes('timeout') || 
      message.includes('network') ||
      message.includes('disconnected') ||
      message.includes('offline')) {
    return 'connection';
  }
  
  // Authentication-related errors
  if (message.includes('auth') || 
      message.includes('login') || 
      message.includes('credentials') ||
      message.includes('permission')) {
    return 'authentication';
  }
  
  // Rate limiting or server-side errors
  if (message.includes('too many') || 
      message.includes('rate limit') || 
      message.includes('429') ||
      message.includes('server error') ||
      message.includes('5xx')) {
    return 'rate_limit';
  }
  
  // Media-related errors
  if (message.includes('media') || 
      message.includes('image') || 
      message.includes('video') ||
      message.includes('audio') ||
      message.includes('file')) {
    return 'media';
  }
  
  // Validation-related errors
  if (message.includes('invalid') ||
      message.includes('validation') ||
      message.includes('format')) {
    return 'validation';
  }
  
  // JID-related errors
  if (message.includes('jid') ||
      message.includes('recipient') ||
      message.includes('whatsapp.net') ||
      message.includes('g.us')) {
    return 'jid';
  }
  
  // Default to 'unknown' for unrecognized errors
  return 'unknown';
}

/**
 * Get user-friendly message based on error category
 * @param {string} category - Error category
 * @param {string} commandName - Name of the command that failed
 * @returns {string} - User-friendly error message
 */
function getUserFriendlyErrorMessage(category, commandName) {
  switch (category) {
    case 'connection':
      return `I'm having trouble connecting right now. Please try the ${commandName} command again in a moment.`;
    
    case 'authentication':
      return `I don't have permission to perform this action. The ${commandName} command might need special access.`;
    
    case 'rate_limit':
      return `I'm receiving too many requests right now. Please try the ${commandName} command again later.`;
    
    case 'media':
      return `I had trouble processing the media for the ${commandName} command. The file might be too large or in an unsupported format.`;
    
    case 'validation':
      return `There was a problem with the information provided for the ${commandName} command. Please check your input and try again.`;
    
    case 'jid':
      return `I couldn't send the message to this chat. Please try the ${commandName} command in a different chat.`;
    
    default:
      return `I encountered a problem with the ${commandName} command. Please try again or use a different command.`;
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
    sendFunction = safeSendMessage
  } = options;
  
  let lastError = null;
  const normalizedJid = normalizeJid(jid);
  
  if (!normalizedJid) {
    logger.error('Invalid JID provided for retry message send');
    return null;
  }
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Wait with exponential backoff, except on first attempt
      if (attempt > 0) {
        const delay = initialDelay * Math.pow(2, attempt - 1);
        logger.info(`Retry attempt ${attempt}/${maxRetries} after ${delay}ms delay`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      
      // Attempt to send the message
      const result = await sendFunction(sock, normalizedJid, content);
      
      if (result) {
        if (attempt > 0) {
          logger.info(`Message send succeeded after ${attempt} retries`);
        }
        return result;
      }
    } catch (error) {
      lastError = error;
      const category = categorizeError(error);
      
      // Don't retry certain error categories
      if (category === 'authentication' || category === 'validation' || category === 'jid') {
        logger.warn(`Not retrying message send due to ${category} error: ${error.message}`);
        break;
      }
      
      logger.warn(`Message send attempt ${attempt + 1}/${maxRetries + 1} failed: ${error.message}`);
    }
  }
  
  // If we reached here, all retries failed
  if (lastError) {
    logger.error(`All ${maxRetries + 1} message send attempts failed. Last error: ${lastError.message}`);
  } else {
    logger.error(`All ${maxRetries + 1} message send attempts failed with unknown errors`);
  }
  
  return null;
}

/**
 * Send an error message to user with enhanced reliability
 * @param {Object} sock - WhatsApp socket connection
 * @param {any} jid - JID to send to
 * @param {Error} error - The error that occurred
 * @param {string} commandName - Name of the command that failed
 * @param {boolean} detailed - Whether to include technical details
 * @returns {Promise<boolean>} - Whether the error message was sent successfully
 */
async function sendEnhancedErrorMessage(sock, jid, error, commandName, detailed = false) {
  const normalizedJid = normalizeJid(jid);
  
  if (!normalizedJid || !sock || typeof sock.sendMessage !== 'function') {
    return false;
  }
  
  try {
    const category = categorizeError(error);
    const userFriendlyMessage = getUserFriendlyErrorMessage(category, commandName);
    
    let errorMessage;
    if (detailed) {
      errorMessage = `❌ *Error in ${commandName}*\n\n${userFriendlyMessage}\n\n*Technical details:* ${error.message}`;
    } else {
      errorMessage = `❌ ${userFriendlyMessage}`;
    }
    
    // Try to send with buttons for better user experience (with fallback)
    try {
      const buttons = [
        {buttonId: 'help', buttonText: {displayText: '💡 Get Help'}, type: 1},
        {buttonId: `${commandName}_retry`, buttonText: {displayText: '🔄 Try Again'}, type: 1}
      ];
      
      // First try buttons message with retry options
      // Create a wrapper function that adapts safeSendButtons to the signature expected by retryMessageSend
      const buttonSendWrapper = async (sock, jid, content) => {
        if (!content || typeof content !== 'object') return null;
        return await safeSendButtons(
          sock, 
          jid, 
          content.text || '', 
          content.footer || '', 
          content.buttons || []
        );
      };
      
      const result = await retryMessageSend(
        sock,
        normalizedJid,
        {
          text: errorMessage,
          footer: `Error Category: ${category.toUpperCase()}`,
          buttons
        },
        { maxRetries: 2, sendFunction: buttonSendWrapper }
      );
      
      if (result) {
        return true;
      }
      
      // Fall back to simple text message if buttons fail
      logger.info('Falling back to simple text error message');
    } catch (buttonError) {
      logger.warn(`Button error message failed, falling back to text: ${buttonError.message}`);
    }
    
    // Simple text fallback
    const result = await retryMessageSend(
      sock,
      normalizedJid,
      { text: errorMessage },
      { maxRetries: 3 }
    );
    
    return !!result;
  } catch (finalError) {
    logger.error(`Failed to send enhanced error message: ${finalError.message}`);
    return false;
  }
}

module.exports = {
  handleCommandError,
  safelyExecuteCommand,
  wrapWithErrorHandler,
  addErrorHandlingToAll,
  isUserInputError,
  categorizeError,
  getUserFriendlyErrorMessage,
  retryMessageSend,
  sendEnhancedErrorMessage
};