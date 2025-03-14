/**
 * Centralized Error Handler for WhatsApp Bot Commands
 * Provides standardized error handling and reporting for all command modules
 */

const logger = require('./logger');
const { safeSendMessage, safeSendText, safeSendImage } = require('./jidHelper');

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
 * @returns {Promise<void>}
 */
async function handleCommandError(sock, jid, error, commandName, moduleName, options = {}) {
  const {
    reply = true,
    logError = true,
    userFriendly = true
  } = options;
  
  // Log the error
  if (logError) {
    logger.error(`Error in ${moduleName}.${commandName}: ${error.message}`, {
      error: error.stack,
      module: moduleName,
      command: commandName,
      jid: jid
    });
  }
  
  // Send error response to user
  if (reply) {
    try {
      let errorMessage;
      
      if (userFriendly) {
        if (isUserInputError(error)) {
          // User input errors should be shown directly
          errorMessage = `❌ *Error:* ${error.message}`;
        } else {
          // Technical errors should be simplified
          errorMessage = `❌ Sorry, I couldn't process the command "${commandName}".\n\n${
            error.userMessage || 'An unexpected error occurred.'
          }`;
        }
      } else {
        // Technical error with details (for debugging/admin)
        errorMessage = `❌ *Error in ${commandName}*:\n\n${error.message}\n\nModule: ${moduleName}`;
      }
      
      // Only attempt to send message if sock and jid are valid
      if (sock && typeof sock.sendMessage === 'function' && jid && jid !== 'unknown') {
        await safeSendMessage(sock, jid, { text: errorMessage });
      } else {
        logger.warn(`Can't send error message: Invalid sock or JID (command: ${commandName}, module: ${moduleName})`);
      }
    } catch (replyError) {
      logger.error(`Failed to send error message: ${replyError.message}`);
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

module.exports = {
  handleCommandError,
  safelyExecuteCommand,
  wrapWithErrorHandler,
  addErrorHandlingToAll,
  isUserInputError
};