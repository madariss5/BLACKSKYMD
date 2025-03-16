/**
 * Basic Commands Module
 * Provides essential utility commands for the bot
 */

// Try to load the safe-send utility
let safeSend;
try {
    // First try the direct path
    safeSend = require('../src/utils/safe-send');
    console.log('Successfully loaded safe-send utility for basic commands');
} catch (err) {
    try {
        // Try alternate path
        safeSend = require('./src/utils/safe-send');
        console.log('Successfully loaded safe-send utility (alternate path)');
    } catch (altErr) {
        console.log(`Could not load safe-send utility: ${err.message}`);
        // Create fallback message sending functions if utility is not available
        safeSend = {
            safeSendText: async (sock, jid, text) => {
                console.log(`[FALLBACK SEND] Sending text to ${jid}: ${text.substring(0, 50)}${text.length > 50 ? '...' : ''}`);
                try {
                    return await sock.sendMessage(jid, { text });
                } catch (err) {
                    console.error(`[FALLBACK SEND] Error: ${err.message}`);
                    // Try one more time
                    try {
                        console.log(`[FALLBACK SEND] Retrying...`);
                        return await sock.sendMessage(jid, { text });
                    } catch (retryErr) {
                        console.error(`[FALLBACK SEND] Retry failed: ${retryErr.message}`);
                        return null;
                    }
                }
            },
            safeSendMessage: async (sock, jid, content) => {
                console.log(`[FALLBACK SEND] Sending message to ${jid}`);
                try {
                    return await sock.sendMessage(jid, content);
                } catch (err) {
                    console.error(`[FALLBACK SEND] Error: ${err.message}`);
                    // Try one more time
                    try {
                        console.log(`[FALLBACK SEND] Retrying...`);
                        return await sock.sendMessage(jid, content);
                    } catch (retryErr) {
                        console.error(`[FALLBACK SEND] Retry failed: ${retryErr.message}`);
                        return null;
                    }
                }
            },
            safeSendReply: async (sock, msg, text) => {
                console.log(`[FALLBACK SEND] Sending reply: ${text.substring(0, 50)}${text.length > 50 ? '...' : ''}`);
                try {
                    return await sock.sendMessage(msg.key.remoteJid, { 
                        text,
                        quoted: msg 
                    });
                } catch (err) {
                    console.error(`[FALLBACK SEND] Error: ${err.message}`);
                    try {
                        console.log(`[FALLBACK SEND] Retrying without quote...`);
                        return await sock.sendMessage(msg.key.remoteJid, { text });
                    } catch (retryErr) {
                        console.error(`[FALLBACK SEND] Retry failed: ${retryErr.message}`);
                        return null;
                    }
                }
            }
        };
        console.log('Using fallback message sending (safe-send.js not available)');
    }
}

// Define command handlers
const commands = {
    // Simple ping command
    ping: async (sock, msg) => {
        const jid = msg.key.remoteJid;
        console.log(`Executing ping command for ${jid}`);
        await safeSend.safeSendText(sock, jid, 'Pong! 🏓 Bot is active and running!');
        console.log('Ping command completed');
    },
    
    // Echo command to repeat a message
    echo: async (sock, msg, args) => {
        const jid = msg.key.remoteJid;
        console.log(`Executing echo command for ${jid} with args: ${args.join(' ')}`);
        const text = args.join(' ');
        
        if (!text) {
            await safeSend.safeSendText(sock, jid, 'You need to provide text to echo! Example: !echo hello world');
            return;
        }
        
        await safeSend.safeSendText(sock, jid, text);
        console.log('Echo command completed');
    },
    
    // Info command to show bot details
    info: async (sock, msg) => {
        const jid = msg.key.remoteJid;
        console.log(`Executing info command for ${jid}`);
        
        const infoText = `*BLACKSKY-MD WhatsApp Bot*\n\n` +
                      `• Version: 1.0.0\n` +
                      `• Framework: Baileys\n` +
                      `• Created: March 2025\n` +
                      `• Node Version: ${process.version}\n` +
                      `• Platform: ${process.platform}\n` +
                      `• Uptime: ${Math.floor(process.uptime())} seconds\n` +
                      `• Commands: Use !help to see available commands\n\n` +
                      `Bot is currently active and ready to use!`;
        
        await safeSend.safeSendText(sock, jid, infoText);
        console.log('Info command completed');
    },
    
    // Help command to list all available commands
    help: async (sock, msg) => {
        const jid = msg.key.remoteJid;
        console.log(`Executing help command for ${jid}`);
        
        const helpText = `*Available Commands*\n\n` +
                      `!ping - Check if bot is active\n` +
                      `!echo [text] - Repeat a message back to you\n` +
                      `!info - Show information about the bot\n` +
                      `!status - Check bot connection status\n` +
                      `!help - Show this help message\n\n` +
                      `For reaction commands, type !reactions`;
        
        await safeSend.safeSendText(sock, jid, helpText);
        console.log('Help command completed');
    },
    
    // Status command to check connection status
    status: async (sock, msg) => {
        const jid = msg.key.remoteJid;
        console.log(`Executing status command for ${jid}`);
        
        // Prepare status information
        const statusText = `*Bot Status Information*\n\n` +
                        `• Connected: Yes\n` +
                        `• Uptime: ${Math.floor(process.uptime())} seconds\n` +
                        `• Current Time: ${new Date().toLocaleString()}\n` +
                        `• Memory Usage: ${Math.round(process.memoryUsage().rss / 1024 / 1024)} MB\n` +
                        `• Platform: ${process.platform}\n` +
                        `• Node Version: ${process.version}\n\n` +
                        `The bot is currently online and responding to commands!`;
        
        await safeSend.safeSendText(sock, jid, statusText);
        console.log('Status command completed');
    }
};

// Command descriptions for help text
const descriptions = {
    ping: 'Check if bot is active',
    echo: 'Repeat a message back to you',
    info: 'Show information about the bot',
    status: 'Check bot connection status',
    help: 'Show this help message'
};

module.exports = {
    commands,
    descriptions
};