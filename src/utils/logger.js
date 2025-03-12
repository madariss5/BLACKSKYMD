const pino = require('pino');

let originalLevel = 'debug';

// Create a consistent logger instance with enhanced configuration
const logger = pino({
    level: 'silent', // Start with silent logging
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
    serializers: {
        err: (err) => ({
            type: err.type || 'Error',
            message: err.message,
            stack: err.stack,
            code: err.code,
            details: err.details || {}
        })
    },
    timestamp: () => `,"time":"${new Date(Date.now()).toISOString()}"`
});

// Prevent unnecessary warnings
process.removeAllListeners('warning');

// Add methods to control logging
logger.silenceLogging = () => {
    originalLevel = logger.level;
    logger.level = 'silent';
};

logger.restoreLogging = () => {
    logger.level = originalLevel;
};

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