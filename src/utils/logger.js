const pino = require('pino');

let originalLevel = 'info'; // Changed from debug to reduce noise

// Create a consistent logger instance with enhanced configuration
const logger = pino({
    level: originalLevel,
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
            return { level: label };
        }
    },
    serializers: {
        err: (err) => ({
            type: err.type || 'Error',
            message: err.message,
            stack: err.stack,
            code: err.code,
            details: err.details || {}
        }),
        // Add WhatsApp specific serializers
        connection: (conn) => ({
            state: conn.state,
            isOnline: conn.isOnline,
            lastSeen: conn.lastSeen,
            platform: conn.platform
        }),
        message: (msg) => ({
            id: msg.key?.id,
            type: msg.type,
            from: msg.key?.remoteJid,
            timestamp: msg.messageTimestamp
        })
    },
    timestamp: () => `,"time":"${new Date(Date.now()).toISOString()}"`,
    // Reduce noise from WebSocket
    mixin: () => ({
        appName: 'BLACKSKY-MD'
    })
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