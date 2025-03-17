/**
 * BLACKSKY-MD WhatsApp Bot - Main Entry Point
 * Using @whiskeysockets/baileys with enhanced connection persistence
 */

const botCore = require('./core');
const logger = require('./utils/logger');

// Log startup message
logger.info('Starting BLACKSKY-MD WhatsApp Bot...');
logger.info(`Node.js Version: ${process.version}`);
logger.info(`Platform: ${process.platform}`);

// Define uptime timer to measure bot stability
let startTime = Date.now();

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
    logger.error('Uncaught Exception:', err);
    // Don't exit process to maintain connection stability
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // Don't exit process to maintain connection stability
});

// Log memory usage periodically for monitoring
setInterval(() => {
    const memoryUsage = process.memoryUsage();
    logger.info('Memory Usage:', {
        rss: `${Math.round(memoryUsage.rss / 1024 / 1024)} MB`,
        heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`,
        heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`,
        uptime: `${Math.round((Date.now() - startTime) / 1000 / 60)} minutes`
    });
}, 30 * 60 * 1000); // Log every 30 minutes

// Export the bot's core functionality
module.exports = botCore;