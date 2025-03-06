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
    },
    timestamp: () => `,"time":"${new Date(Date.now()).toISOString()}"`,
    serializers: {
        err: (err) => ({
            type: err.type,
            message: err.message,
            stack: err.stack,
            code: err.code,
            statusCode: err.output?.statusCode
        })
    }
});

// Prevent pino from throwing unnecessary warnings
process.removeAllListeners('warning');

module.exports = logger;