const pino = require('pino');

// Create the logger instance
const logger = pino({
    level: 'info',
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
    timestamp: () => `,"time":"${new Date(Date.now()).toISOString()}"`,
    mixin: () => ({
        appName: 'BLACKSKY-MD'
    })
});

// Prevent unnecessary warnings
process.removeAllListeners('warning');

// Add child method for Baileys compatibility
logger.child = (bindings) => {
    return pino({
        level: logger.level,
        transport: {
            target: 'pino-pretty',
            options: {
                colorize: true,
                translateTime: 'SYS:standard',
                ignore: 'pid,hostname',
                messageFormat: '{msg}',
                levelFirst: true
            }
        }
    }).child(bindings);
};

// Add custom methods for module loading
logger.moduleInit = (moduleName) => {
    logger.debug(`🔄 Initializing ${moduleName} module...`);
};

logger.moduleSuccess = (moduleName) => {
    logger.info(`✅ ${moduleName} module initialized successfully`);
};

logger.moduleError = (moduleName, error) => {
    logger.error({
        msg: `❌ Error initializing ${moduleName} module: ${error.message}`,
        err: error,
        module: moduleName
    });
};

// Add connection logging
logger.connectionUpdate = (state, details = {}) => {
    logger.info({
        msg: `Connection ${state}`,
        connection: {
            state,
            ...details
        }
    });
};

logger.connectionError = (error, attempt = null) => {
    logger.error({
        msg: 'Connection error occurred',
        err: error,
        reconnectAttempt: attempt
    });
};

// Add command execution logging
logger.commandStart = (commandName, user) => {
    logger.debug(`🎯 Executing command: ${commandName} by ${user}`);
};

logger.commandSuccess = (commandName) => {
    logger.info(`✅ Command ${commandName} executed successfully`);
};

logger.commandError = (commandName, error) => {
    logger.error({
        msg: `❌ Error executing command ${commandName}`,
        err: error,
        command: commandName
    });
};

module.exports = logger;