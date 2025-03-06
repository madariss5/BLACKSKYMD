const pino = require('pino');

const logger = pino({
    level: process.env.NODE_ENV === 'production' ? 'warn' : 'warn', // Set to warn by default
    transport: {
        target: 'pino-pretty',
        options: {
            colorize: true,
            translateTime: false, // Disable timestamp
            ignore: 'pid,hostname,time',
            messageFormat: '{msg}', // Simplified format
            levelFirst: false, // Hide level
            hideObject: true // Hide object dumps
        }
    },
    formatters: {
        level: (label) => {
            return {}; // Hide level in output
        }
    },
    // Minimal serializers
    serializers: {
        err: (err) => ({
            message: err.message
        })
    }
});

// Prevent pino from throwing unnecessary warnings
process.removeAllListeners('warning');

module.exports = logger;