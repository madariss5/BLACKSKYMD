const pino = require('pino');

const logger = pino({
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    transport: {
        target: 'pino-pretty',
        options: {
            colorize: true,
            timestamp: true,
            ignore: 'pid,hostname',
            translateTime: 'SYS:standard',
            messageFormat: '{msg} {context}',
            levelFirst: true,
        },
    },
    base: null,
});

module.exports = logger;