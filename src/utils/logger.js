const pino = require('pino');

// Create a consistent logger instance with enhanced configuration
const logger = pino({
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    transport: {
        target: 'pino-pretty',
        options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
            messageFormat: '{msg}',
            levelFirst: true,
            customLevels: 'error:99,warn:98,info:97,debug:96'
        }
    },
    formatters: {
        level: (label) => {
            return {
                level: label
            };
        }
    },
    // Enhanced serializers for better error handling
    serializers: {
        err: (err) => ({
            type: err.type || 'Error',
            message: err.message,
            stack: err.stack,
            code: err.code,
            details: err.details || {}
        })
    },
    // Add timestamp to all logs
    timestamp: () => `,"time":"${new Date(Date.now()).toISOString()}"`,
    // Add module name to all logs
    mixin: () => {
        const stack = new Error().stack;
        const caller = stack.split('\n')[2];
        const match = caller.match(/[\/\\]([^\/\\]+)\.js/);
        return { module: match ? match[1] : 'unknown' };
    }
});

// Prevent unnecessary warnings
process.removeAllListeners('warning');

// Add custom methods for module loading
logger.moduleInit = (moduleName) => {
    logger.info(`🔄 Initializing ${moduleName} module...`);
};

logger.moduleSuccess = (moduleName) => {
    logger.info(`✅ ${moduleName} module initialized successfully`);
};

logger.moduleError = (moduleName, error) => {
    logger.error(`❌ Error initializing ${moduleName} module: ${error.message}`);
    logger.error('Stack trace:', error.stack);
    if (error.details) {
        logger.error('Additional details:', error.details);
    }
};

// Add command execution logging
logger.commandStart = (commandName, user) => {
    logger.info(`🎯 Executing command: ${commandName} by ${user}`);
};

logger.commandSuccess = (commandName) => {
    logger.info(`✅ Command ${commandName} executed successfully`);
};

logger.commandError = (commandName, error) => {
    logger.error(`❌ Error executing command ${commandName}: ${error.message}`);
    logger.error('Stack trace:', error.stack);
};

module.exports = logger;