const pino = require('pino');

const logger = pino({
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    transport: {
        target: 'pino-pretty',
        options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
            messageFormat: '[{time}] {msg} {context}',
            levelFirst: true
        }
    },
    formatters: {
        level: (label) => {
            return { level: label.toUpperCase() };
        }
    },
    redact: {
        paths: ['*.password', '*.secret', '*.token'],
        remove: true
    }
});

// Prevent pino from throwing unnecessary warnings
process.removeAllListeners('warning');

module.exports = logger;