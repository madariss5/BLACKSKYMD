/**
 * Advanced Message Handler with Middleware Support
 * Combined features from popular MD bots
 */

const EventEmitter = require('events');
const logger = require('../utils/logger');

class MessageHandler extends EventEmitter {
    constructor(config = {}) {
        super();
        this.config = {
            prefix: '!',
            commandCooldown: 3000,
            maxProcessingTime: 30000,
            ...config
        };

        this.middleware = [];
        this.commands = new Map();
        this.cooldowns = new Map();
        this.activeProcesses = new Map();
        this.messageQueue = new Map();
        this.errorHandlers = new Map();
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
                description: '',
                usage: '',
                aliases: [],
                ...options
            }
        });
    }

    async handleMessage(message, socket) {
        try {
            const msg = message.messages?.[0];
            if (!msg || msg.key.fromMe) return;

            // Enhanced message context
            const context = {
                socket,
                message: msg,
                sender: msg.key.remoteJid,
                isGroup: msg.key.remoteJid.endsWith('@g.us'),
                content: msg.message?.conversation || 
                        msg.message?.extendedTextMessage?.text || 
                        msg.message?.imageMessage?.caption || 
                        msg.message?.videoMessage?.caption ||
                        '',
                raw: msg,
                replied: false,
                quotedMessage: msg.message?.extendedTextMessage?.contextInfo?.quotedMessage,
                mentionedJids: msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [],
                timestamp: msg.messageTimestamp,
                type: Object.keys(msg.message || {})[0],
                isCommand: false
            };

            // Track message processing
            const processId = `${context.sender}_${Date.now()}`;
            this.activeProcesses.set(processId, {
                context,
                startTime: Date.now()
            });

            // Run enhanced middleware pipeline
            for (const middleware of this.middleware) {
                try {
                    const result = await Promise.race([
                        middleware(context),
                        new Promise((_, reject) => 
                            setTimeout(() => reject(new Error('Middleware timeout')), 
                            this.config.maxProcessingTime)
                        )
                    ]);

                    if (result === false) {
                        this.activeProcesses.delete(processId);
                        return;
                    }
                    Object.assign(context, result);
                } catch (error) {
                    logger.error('Middleware error:', error);
                    await this.handleMiddlewareError(error, context);
                    this.activeProcesses.delete(processId);
                    return;
                }
            }

            // Enhanced command handling
            if (context.content.startsWith(this.config.prefix)) {
                context.isCommand = true;
                await this.handleCommand(context);
            }

            // Emit message event for custom handlers
            this.emit('message', context);

            // Cleanup
            this.activeProcesses.delete(processId);

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

        // Enhanced cooldown system
        const cooldownKey = `${context.sender}:${cmd}`;
        const cooldownTime = this.cooldowns.get(cooldownKey);
        if (cooldownTime && Date.now() < cooldownTime) {
            const remaining = Math.ceil((cooldownTime - Date.now()) / 1000);
            await this.sendCooldownMessage(context, remaining);
            return;
        }

        try {
            // Set cooldown with progressive increase for spam prevention
            const currentCooldown = this.cooldowns.get(`${context.sender}:count`) || 0;
            const cooldownDuration = command.options.cooldown * Math.pow(1.1, currentCooldown);

            this.cooldowns.set(cooldownKey, Date.now() + cooldownDuration);
            this.cooldowns.set(`${context.sender}:count`, currentCooldown + 1);

            // Auto-reset cooldown count after 5 minutes
            setTimeout(() => {
                this.cooldowns.delete(`${context.sender}:count`);
            }, 300000);

            // Track command execution
            const commandId = `${context.message.key.id}_${Date.now()}`;
            this.activeProcesses.set(commandId, {
                command: cmd,
                startTime: Date.now(),
                context
            });

            // Execute command with timeout
            await Promise.race([
                command.handler(context, ...args),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Command execution timeout')), 
                    this.config.maxProcessingTime)
                )
            ]);

            // Cleanup
            this.activeProcesses.delete(commandId);

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

    async handleMiddlewareError(error, context) {
        logger.error('Middleware error:', {
            error: error.message,
            middleware: error.middleware,
            context: {
                sender: context.sender,
                content: context.content
            }
        });
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
            runtime: Date.now() - process.startTime,
            context: process.context ? {
                sender: process.context.sender,
                content: process.context.content,
                type: process.context.type
            } : undefined
        }));
    }

    getCooldowns() {
        const now = Date.now();
        return Array.from(this.cooldowns.entries())
            .filter(([key, time]) => time > now)
            .map(([key, time]) => ({
                key,
                remainingTime: Math.ceil((time - now) / 1000)
            }));
    }
}

module.exports = MessageHandler;