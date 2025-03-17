/**
 * High-Performance WhatsApp Bot
 * Optimized for <5ms response times with minimal resource usage
 */

// Load the ultra-optimized connection
const ultraOptimizedConnection = require('./src/ultra-optimized-connection');
const logger = require('./src/utils/logger');

// Store the socket globally
let whatsappSocket = null;

/**
 * Initialize the high-performance WhatsApp bot
 */
async function initHighPerformanceBot() {
  try {
    console.log('╔═══════════════════════════════════════════════════╗');
    console.log('║                                                   ║');
    console.log('║     BLACKSKY-MD WHATSAPP HIGH-PERFORMANCE BOT     ║');
    console.log('║                                                   ║');
    console.log('║  • Ultra-fast command responses (<5ms target)     ║');
    console.log('║  • Optimized for multi-group environments         ║');
    console.log('║  • Enhanced memory and CPU usage                  ║');
    console.log('║  • Adaptive performance scaling                   ║');
    console.log('║                                                   ║');
    console.log('║  Wait for the QR code to appear and scan it       ║');
    console.log('║  with your WhatsApp mobile app                    ║');
    console.log('║                                                   ║');
    console.log('╚═══════════════════════════════════════════════════╝');
    
    // Initialize the bot with ultra-optimized connection
    whatsappSocket = await ultraOptimizedConnection.init();
    
    if (whatsappSocket) {
      logger.info('High-performance WhatsApp bot started successfully');
      
      // Set up basic process error handling
      process.on('uncaughtException', handleProcessError);
      process.on('unhandledRejection', handleProcessError);
      
      return true;
    } else {
      logger.error('Failed to initialize high-performance bot');
      return false;
    }
  } catch (err) {
    logger.error(`Error starting high-performance bot: ${err.message}`);
    return false;
  }
}

/**
 * Handle process errors
 * @param {Error} err - The error
 */
function handleProcessError(err) {
  logger.error(`Uncaught error: ${err.message}`);
  logger.error(err.stack);
  
  // Don't crash on non-critical errors
  if (err.message.includes('Connection closed') || 
      err.message.includes('Timed out') ||
      err.message.includes('rate limits') ||
      err.message.includes('Not found') ||
      err.message.includes('forbidden') ||
      err.message.includes('not-authorized')) {
    logger.warn('Non-critical error detected, continuing execution');
  } else {
    logger.error('Critical error detected, restarting connection');
    // Try to reconnect on critical errors
    setTimeout(() => {
      ultraOptimizedConnection.startConnection()
        .then(socket => {
          if (socket) {
            whatsappSocket = socket;
            logger.info('Successfully reconnected after critical error');
          }
        })
        .catch(reconnectErr => {
          logger.error(`Failed to reconnect: ${reconnectErr.message}`);
        });
    }, 5000);
  }
}

// Start the high-performance bot
initHighPerformanceBot()
  .then(success => {
    if (!success) {
      logger.error('Failed to start high-performance bot, exiting');
      process.exit(1);
    }
  })
  .catch(err => {
    logger.error(`Fatal error starting high-performance bot: ${err.message}`);
    process.exit(1);
  });

// Export the socket and connection for other modules
module.exports = {
  getSocket: () => whatsappSocket,
  restartConnection: ultraOptimizedConnection.startConnection
};