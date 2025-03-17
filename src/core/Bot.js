/**
 * Main Bot Class
 * Integrates all components and provides high-level bot functionality
 */

const ConnectionHandler = require('./connection');
const MessageHandler = require('./messageHandler');
const SessionHandler = require('./sessionHandler');
const ResponseHandler = require('./responseHandler');
const logger = require('../utils/logger');

class Bot {
    constructor(config = {}) {
        this.config = {
            name: 'BLACKSKY-MD',
            prefix: '!',
            owner: [],
            ...config
        };

        this.connection = new ConnectionHandler(config.connection);
        this.messageHandler = new MessageHandler(config.message);
        this.sessionHandler = new SessionHandler(config.session);
        this.responseHandler = new ResponseHandler(config.response);

        this.setupMessageHandler();
    }

    setupMessageHandler() {
        // Add core middleware
        this.messageHandler.use(async (ctx) => {
            // Add response methods to context
            ctx.reply = async (content, options = {}) => {
                return this.responseHandler.replyToMessage(ctx.socket, ctx.raw, content, options);
            };
            
            ctx.send = async (content, options = {}) => {
                return this.responseHandler.sendResponse(ctx.socket, ctx.sender, content, options);
            };

            ctx.typing = async (duration) => {
                return this.responseHandler.sendTyping(ctx.socket, ctx.sender, duration);
            };

            return ctx;
        });
    }

    async start() {
        try {
            logger.info('Starting bot...');
            
            // Set message handler in connection
            this.connection.setMessageHandler(this.messageHandler);
            
            // Connect to WhatsApp
            const socket = await this.connection.connect();
            
            if (!socket) {
                throw new Error('Failed to create WhatsApp connection');
            }

            logger.success(`${this.config.name} is ready!`);
            return socket;

        } catch (error) {
            logger.error('Error starting bot:', error);
            throw error;
        }
    }

    async stop() {
        try {
            await this.connection.disconnect();
            logger.info('Bot stopped');
        } catch (error) {
            logger.error('Error stopping bot:', error);
            throw error;
        }
    }

    command(name, handler, options = {}) {
        this.messageHandler.registerCommand(name, handler, options);
        return this;
    }

    use(middleware) {
        this.messageHandler.use(middleware);
        return this;
    }

    template(name, template) {
        this.responseHandler.registerTemplate(name, template);
        return this;
    }

    getStatus() {
        return {
            connected: this.connection.isConnected,
            activeSessions: this.sessionHandler.getActiveSessions(),
            activeProcesses: this.messageHandler.getActiveProcesses(),
            messageQueue: this.responseHandler.getQueueStatus()
        };
    }
}

module.exports = Bot;
