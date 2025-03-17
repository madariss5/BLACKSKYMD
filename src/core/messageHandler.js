/**
 * Advanced Message Handler with Middleware Support
 * Handles incoming messages, commands, and responses
 */

const EventEmitter = require('events');
const logger = require('../utils/logger');

class MessageHandler extends EventEmitter {
    constructor(config = {}) {
        super();
        this.config = {
            prefix: '!',
            commandCooldown: 3000,
            ...config
        };

        this.middleware = [];
        this.commands = new Map();
        this.cooldowns = new Map();
        this.activeProcesses = new Map();
    }

    use(middleware) {
        if (typeof middleware !== 'function') {
            throw new Error('Middleware must be a function');
        }
        this.middleware.push(middleware);
        return this;
    }

    registerCommand(command, handler, options = {}) {
        this.commands.set(command, {
            handler,
            options: {
                cooldown: this.config.commandCooldown,
                requiresAuth: false,
                category: 'misc',
                ...options
            }
        });
    }

    async handleMessage(message, socket) {
        try {
            const msg = message.messages?.[0];
            if (!msg || msg.key.fromMe) return;

            // Create message context
            const context = {
                socket,
                message: msg,
                sender: msg.key.remoteJid,
                isGroup: msg.key.remoteJid.endsWith('@g.us'),
                content: msg.message?.conversation || 
                        msg.message?.extendedTextMessage?.text || 
                        msg.message?.imageMessage?.caption || 
                        '',
                raw: msg,
                replied: false
            };

            // Run middleware pipeline
            for (const middleware of this.middleware) {
                try {
                    const result = await middleware(context);
                    if (result === false) return; // Middleware chain stopped
                    Object.assign(context, result); // Merge middleware modifications
                } catch (error) {
                    logger.error('Middleware error:', error);
                    return;
                }
            }

            // Command handling
            if (context.content.startsWith(this.config.prefix)) {
                await this.handleCommand(context);
            }

            // Emit message event for custom handlers
            this.emit('message', context);

        } catch (error) {
            logger.error('Message handling error:', error);
            await this.handleError(error, message, socket);
        }
    }

    async handleCommand(context) {
        const [cmd, ...args] = context.content
            .slice(this.config.prefix.length)
            .trim()
            .split(/\s+/);

        const command = this.commands.get(cmd);
        if (!command) return;

        // Check cooldown
        const cooldownKey = `${context.sender}:${cmd}`;
        const cooldownTime = this.cooldowns.get(cooldownKey);
        if (cooldownTime && Date.now() < cooldownTime) {
            const remaining = Math.ceil((cooldownTime - Date.now()) / 1000);
            await this.sendCooldownMessage(context, remaining);
            return;
        }

        try {
            // Set cooldown
            this.cooldowns.set(cooldownKey, Date.now() + command.options.cooldown);
            setTimeout(() => this.cooldowns.delete(cooldownKey), command.options.cooldown);

            // Track active process
            this.activeProcesses.set(context.message.key.id, {
                command: cmd,
                startTime: Date.now()
            });

            // Execute command
            await command.handler(context, ...args);

            // Cleanup
            this.activeProcesses.delete(context.message.key.id);

        } catch (error) {
            logger.error(`Command error (${cmd}):`, error);
            await this.handleCommandError(error, context);
        }
    }

    async handleError(error, message, socket) {
        try {
            const errorMessage = {
                text: '⚠️ An error occurred while processing your message. Please try again later.',
                contextInfo: {
                    forwardingScore: 999,
                    isForwarded: true
                }
            };

            await socket.sendMessage(message.messages[0].key.remoteJid, errorMessage);
            
            // Log detailed error for debugging
            logger.error('Detailed error:', {
                error: error.message,
                stack: error.stack,
                messageId: message.messages[0].key.id
            });

        } catch (sendError) {
            logger.error('Error sending error message:', sendError);
        }
    }

    async handleCommandError(error, context) {
        try {
            const errorMessage = {
                text: `⚠️ Error executing command: ${error.message}`,
                contextInfo: {
                    forwardingScore: 999,
                    isForwarded: true
                }
            };

            await context.socket.sendMessage(context.sender, errorMessage);

        } catch (sendError) {
            logger.error('Error sending command error message:', sendError);
        }
    }

    async sendCooldownMessage(context, remaining) {
        try {
            await context.socket.sendMessage(context.sender, {
                text: `⏳ Please wait ${remaining} seconds before using this command again.`
            });
        } catch (error) {
            logger.error('Error sending cooldown message:', error);
        }
    }

    getActiveProcesses() {
        return Array.from(this.activeProcesses.entries()).map(([id, process]) => ({
            id,
            command: process.command,
            runtime: Date.now() - process.startTime
        }));
    }
}

module.exports = MessageHandler;
