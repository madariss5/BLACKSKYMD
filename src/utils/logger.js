const pino = require('pino');

const logger = pino({
    level: 'info',
    transport: {
        target: 'pino-pretty',
        options: {
            colorize: true,
            timestamp: true,
        },
    },
});

module.exports = logger;
