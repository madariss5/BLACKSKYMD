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
            code: err.code
        })
    },
    // Add timestamp to all logs
    timestamp: () => `,"time":"${new Date(Date.now()).toISOString()}"`
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
};

module.exports = logger;