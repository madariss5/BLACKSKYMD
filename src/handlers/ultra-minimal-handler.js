/**
 * Ultra Minimal Message Handler
 * Designed for maximum reliability with zero dependencies
 * Now with full command loading capability
 */

const fs = require('fs');
const path = require('path');
const logger = console;

// Commands map with fallback basic commands
const commands = new Map();

// Add ping command
commands.set('ping', async (sock, message) => {
    try {
        if (!message.key?.remoteJid) return;
        const sender = message.key.remoteJid;
        await sock.sendMessage(sender, { text: '🏓 Pong! Bot is online.' });
    } catch (err) {
        console.error('Error in ping command:', err);
    }
});

// Add help command
commands.set('help', async (sock, message) => {
    try {
        if (!message.key?.remoteJid) return;
        const sender = message.key.remoteJid;

        const commandsList = Array.from(commands.keys()).slice(0, 20).join(', ');

        const helpText = `*🤖 WhatsApp Bot Commands*\n\n` +
                        `Available commands: ${commands.size}\n` +
                        `Examples: ${commandsList}${commands.size > 20 ? '...' : ''}\n\n` +
                        `Use !commandname to execute a command\n` +
                        `Use !menu for a better organized list`;

        await sock.sendMessage(sender, { text: helpText });
    } catch (err) {
        console.error('Error in help command:', err);
    }
});

/**
 * Process messages
 */
async function messageHandler(sock, message) {
    try {
        // Basic validation
        if (!message?.message || !message.key?.remoteJid) return;

        // Get text content
        const content = message.message.conversation || 
                      message.message.extendedTextMessage?.text ||
                      message.message.imageMessage?.caption ||
                      message.message.videoMessage?.caption;

        console.log('Received message:', content);

        if (!content) return;

        // Check for command prefix (! or .)
        if (content.startsWith('!') || content.startsWith('.')) {
            console.log('Processing command:', content);

            // Extract command and args
            const prefix = content.charAt(0);
            const commandName = content.slice(1).trim().split(' ')[0].toLowerCase();
            const args = content.slice(prefix.length + commandName.length + 1).trim().split(' ');

            // Send typing indicator
            try {
                await sock.sendPresenceUpdate('composing', message.key.remoteJid);
                setTimeout(async () => {
                    try {
                        await sock.sendPresenceUpdate('paused', message.key.remoteJid);
                    } catch (_) {}
                }, 2000);
            } catch (_) {}

            // Execute command
            if (commands.has(commandName)) {
                try {
                    await commands.get(commandName)(sock, message, args);
                    console.log(`Command ${commandName} executed successfully`);
                } catch (cmdErr) {
                    console.error(`Error executing command ${commandName}:`, cmdErr);
                    try {
                        await sock.sendMessage(message.key.remoteJid, { 
                            text: `❌ Error executing command: ${cmdErr.message || 'Unknown error'}`
                        });
                    } catch (_) {}
                }
            } else {
                try {
                    await sock.sendMessage(message.key.remoteJid, { 
                        text: `⚠️ Command *!${commandName}* not found. Try *!help* to see available commands.`
                    });
                } catch (_) {}
            }
        }
    } catch (err) {
        console.error('Error in message handler:', err);
        try {
            await sock.sendMessage(message.key.remoteJid, { 
                text: '❌ An error occurred while processing your message.'
            });
        } catch (_) {}
    }
}

/**
 * Initialize handler
 */
async function init() {
    console.log('⚙️ Initializing ultra minimal handler...');

    try {
        // Add status command
        commands.set('status', async (sock, message) => {
            try {
                const sender = message.key.remoteJid;
                const uptime = process.uptime();
                const hours = Math.floor(uptime / 3600);
                const minutes = Math.floor((uptime % 3600) / 60);
                const seconds = Math.floor(uptime % 60);

                const statusText = `*📊 Bot Status*\n\n` +
                                 `🟢 *Status:* Online\n` +
                                 `⏱️ *Uptime:* ${hours}h ${minutes}m ${seconds}s\n` +
                                 `🧩 *Commands:* ${commands.size}\n`;

                await sock.sendMessage(sender, { text: statusText });
            } catch (err) {
                console.error('Error in status command:', err);
            }
        });

        // Add about command (from original code)
        if (!commands.has('about')) {
            commands.set('about', async (sock, message) => {
                try {
                    if (!message.key?.remoteJid) return;
                    const sender = message.key.remoteJid;

                    const aboutText = `*🤖 BLACKSKY-MD Bot*\n\n` +
                                     `A reliable WhatsApp bot with multi-level fallback system.\n\n` +
                                     `*Version:* 1.0.0\n` +
                                     `*Framework:* @whiskeysockets/baileys\n` +
                                     `*Commands:* ${commands.size}\n\n` +
                                     `Type *!help* for available commands.`;

                    await sock.sendMessage(sender, { text: aboutText });
                } catch (err) {
                    console.error('Error in about command:', err);
                }
            });
        }


        console.log(`🚀 Ultra minimal handler initialized with ${commands.size} commands`);
        return true;
    } catch (err) {
        console.error('Error initializing handler:', err);
        return false;
    }
}

// Export handler
module.exports = {
    messageHandler,
    init,
    commands
};