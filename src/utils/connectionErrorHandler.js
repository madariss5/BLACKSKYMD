/**
 * Connection Error Handler for WhatsApp Bot
 * Provides specialized handling for connection-related errors
 */

const logger = require('./logger');
const { safeSendText } = require('./jidHelper');
const { categorizeError } = require('./errorHandler');
const fs = require('fs').promises;
const path = require('path');

// Track connection errors
const connectionErrors = {
  count: 0,
  lastTime: 0,
  reconnectAttempts: 0,
  consecutiveFailures: 0
};

// Error symptoms that indicate connection issues
const CONNECTION_SYMPTOMS = [
  'connection closed',
  'timed out',
  'network error',
  'invalid message format',
  'disconnected',
  'socket closed',
  'unreachable',
  'connection reset',
  'server returned status code',
  'unable to connect',
  'dns lookup failed'
];

/**
 * Check if an error is connection-related
 * @param {Error} error - The error to check
 * @returns {boolean} - Whether it's a connection error
 */
function isConnectionError(error) {
  if (!error) return false;
  
  const message = (error.message || '').toLowerCase();
  
  return CONNECTION_SYMPTOMS.some(symptom => message.includes(symptom));
}

/**
 * Log a connection error with detailed diagnostics
 * @param {Error} error - The connection error
 * @param {string} context - Where the error occurred
 */
function logConnectionError(error, context = 'unknown') {
  const now = Date.now();
  connectionErrors.count++;
  
  // Calculate time since last error
  const timeSinceLast = connectionErrors.lastTime ? (now - connectionErrors.lastTime) : 0;
  connectionErrors.lastTime = now;
  
  // Track consecutive failures
  if (timeSinceLast < 60000) { // Less than a minute
    connectionErrors.consecutiveFailures++;
  } else {
    connectionErrors.consecutiveFailures = 1;
  }
  
  logger.error(`Connection error in ${context}: ${error.message}`, {
    error: error.stack,
    connectionErrors: { ...connectionErrors },
    timeSinceLast: `${Math.round(timeSinceLast / 1000)}s`
  });
  
  // Save detailed diagnostics for severe connection issues
  if (connectionErrors.consecutiveFailures >= 3) {
    saveConnectionDiagnostics(error, context);
  }
}

/**
 * Save connection diagnostics to a log file
 * @param {Error} error - The connection error
 * @param {string} context - Where the error occurred
 */
async function saveConnectionDiagnostics(error, context) {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const logDir = path.join(process.cwd(), 'logs');
    const logFile = path.join(logDir, `connection-error-${timestamp}.log`);
    
    // Create logs directory if it doesn't exist
    try {
      await fs.mkdir(logDir, { recursive: true });
    } catch (mkdirError) {
      // Ignore directory exists error
    }
    
    // Gather system information
    const diagnosticInfo = {
      timestamp: new Date().toISOString(),
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name
      },
      context,
      connectionStats: { ...connectionErrors },
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        memoryUsage: process.memoryUsage()
      }
    };
    
    await fs.writeFile(
      logFile, 
      JSON.stringify(diagnosticInfo, null, 2), 
      'utf8'
    );
    
    logger.info(`Connection diagnostics saved to ${logFile}`);
  } catch (saveError) {
    logger.error(`Failed to save connection diagnostics: ${saveError.message}`);
  }
}

/**
 * Handle a connection error
 * @param {Object} sock - WhatsApp socket connection
 * @param {Error} error - The connection error
 * @param {string} context - Where the error occurred
 * @param {Function} reconnectFn - Function to call for reconnection
 */
async function handleConnectionError(sock, error, context, reconnectFn = null) {
  // Log the error with diagnostics
  logConnectionError(error, context);
  
  // Determine if we should attempt reconnection
  const shouldReconnect = 
    connectionErrors.consecutiveFailures < 10 && // Not too many consecutive failures
    !!reconnectFn; // Have a reconnect function
  
  // If we should reconnect, schedule it with progressive backoff
  if (shouldReconnect) {
    const baseDelay = 5000; // 5 seconds
    const maxDelay = 300000; // 5 minutes
    
    // Calculate delay with exponential backoff
    const delay = Math.min(
      baseDelay * Math.pow(1.5, connectionErrors.consecutiveFailures),
      maxDelay
    );
    
    logger.info(`Scheduling reconnection attempt in ${Math.round(delay/1000)}s...`);
    
    // Schedule reconnection
    setTimeout(() => {
      connectionErrors.reconnectAttempts++;
      logger.info(`Attempting reconnection (attempt ${connectionErrors.reconnectAttempts})...`);
      
      try {
        reconnectFn();
      } catch (reconnectError) {
        logger.error(`Reconnection attempt failed: ${reconnectError.message}`);
      }
    }, delay);
  }
  
  // Notify a specific admin number if available and if errors are severe
  if (connectionErrors.consecutiveFailures >= 5 && sock && process.env.ADMIN_NUMBER) {
    try {
      const adminJid = `${process.env.ADMIN_NUMBER.replace(/[^0-9]/g, '')}@s.whatsapp.net`;
      
      await safeSendText(
        sock, 
        adminJid, 
        `⚠️ *Connection Alert*\n\nThe bot is experiencing connection issues.\n\n` +
        `*Error:* ${error.message}\n` +
        `*Context:* ${context}\n` +
        `*Consecutive failures:* ${connectionErrors.consecutiveFailures}\n` +
        `*Total errors:* ${connectionErrors.count}\n\n` +
        `${shouldReconnect ? 'Attempting automatic reconnection...' : 'Automatic reconnection has been disabled due to too many failures.'}`
      );
    } catch (notifyError) {
      logger.error(`Failed to notify admin about connection issues: ${notifyError.message}`);
    }
  }
  
  return shouldReconnect;
}

/**
 * Reset connection error statistics after successful connection
 */
function resetConnectionStats() {
  // Keep total count but reset consecutive failures
  connectionErrors.consecutiveFailures = 0;
  connectionErrors.reconnectAttempts = 0;
  logger.info('Connection statistics reset after successful connection');
}

module.exports = {
  isConnectionError,
  handleConnectionError,
  logConnectionError,
  resetConnectionStats
};