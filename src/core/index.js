/**
 * BLACKSKY-MD WhatsApp Bot
 * Combines features from popular MD bots
 */

require('dotenv').config();
const express = require('express');
const Bot = require('./Bot');
const logger = require('../utils/logger');

// Create Express app for web interface
const app = express();
const port = 5000; // ALWAYS use port 5000

// Bot configuration
const config = {
    name: 'BLACKSKY-MD',
    prefix: '!',
    owner: [process.env.OWNER_NUMBER],
    connection: {
        printQR: true,
        browser: ['BLACKSKY-MD', 'Chrome', '1.0.0'],
        connectTimeoutMs: 60000,
        keepAliveIntervalMs: 15000
    },
    message: {
        commandCooldown: 3000
    },
    session: {
        sessionsDir: './sessions',
        backupInterval: 6 * 60 * 60 * 1000 // 6 hours
    },
    response: {
        defaultLanguage: 'en',
        useEmoji: true
    }
};

let bot; // Declare bot variable here to make it accessible in routes

// Setup web routes
app.get('/status', (req, res) => {
    const status = bot ? bot.getStatus() : { status: 'initializing' };
    res.json(status);
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

// Start Express server
app.listen(port, '0.0.0.0', () => {
    logger.info(`Web interface running on port ${port}`);
});

async function startBot() {
    try {
        logger.info('Starting bot...');
        bot = new Bot(config); // Assign bot to the variable

        // Register basic commands
        bot.command('ping', async (ctx) => {
            await ctx.typing(1000);
            await ctx.reply('Pong! 🏓', { emoji: '🏓' });
        });

        bot.command('help', async (ctx) => {
            await ctx.typing(2000);
            const helpMessage = {
                text: '*BLACKSKY-MD Bot Commands*\n\n' +
                      '!ping - Check bot response\n' +
                      '!help - Show this message\n' +
                      '!status - Show bot status',
                contextInfo: {
                    externalAdReply: {
                        title: 'BLACKSKY-MD Bot',
                        body: 'High Performance WhatsApp Bot',
                        mediaType: 1,
                        showAdAttribution: true
                    }
                }
            };
            await ctx.reply(helpMessage);
        });

        // Enhanced status command to check bot health
        bot.command('status', async (ctx) => {
            const status = bot.getStatus();
            const statusMessage = {
                text: `*Bot Status*\n\n` +
                      `Connected: ${status.connected}\n` +
                      `Active Sessions: ${status.activeSessions.length}\n` +
                      `Active Processes: ${status.activeProcesses.length}\n` +
                      `Message Queue: ${status.messageQueue.length}\n` +
                      `Reconnect Attempts: ${status.reconnectAttempts}\n` +
                      `Uptime: ${Math.floor((Date.now() - status.startTime) / 1000)}s`,
                contextInfo: {
                    isForwarded: false
                }
            };
            await ctx.reply(statusMessage);
        });

        // Start the bot
        const socket = await bot.start().catch(error => {
            throw new Error(`Failed to start bot: ${error.message}`);
        });

        if (!socket) {
            throw new Error('Failed to initialize WhatsApp connection');
        }

        logger.success('Bot started successfully!');

        // Setup error handlers
        process.on('uncaughtException', (err) => {
            logger.error('Uncaught Exception:', err);
            // Attempt graceful shutdown
            bot.stop().catch(console.error);
        });

        process.on('unhandledRejection', (err) => {
            logger.error('Unhandled Rejection:', err);
        });

    } catch (error) {
        logger.error('Failed to start bot:', {
            message: error.message,
            stack: error.stack
        });
        process.exit(1);
    }
}

// Start the bot
startBot();