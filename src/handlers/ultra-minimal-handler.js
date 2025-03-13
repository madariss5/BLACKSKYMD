/**
 * Ultra Minimal Message Handler
 * Designed for maximum reliability with zero dependencies
 */

// No external dependencies
// Built-in commands map
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
        
        const helpText = `*🤖 Ultra Minimal Bot Commands*\n\n` +
                        `!ping - Check if bot is responding\n` +
                        `!help - Show this help message\n` +
                        `!status - Show bot status\n` +
                        `!about - About this bot\n\n` +
                        `_This is running in ultra-minimal mode for maximum reliability._`;
        
        await sock.sendMessage(sender, { text: helpText });
    } catch (err) {
        console.error('Error in help command:', err);
    }
});

// Add status command
commands.set('status', async (sock, message) => {
    try {
        if (!message.key?.remoteJid) return;
        const sender = message.key.remoteJid;
        
        const uptime = process.uptime();
        const hours = Math.floor(uptime / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        const seconds = Math.floor(uptime % 60);
        
        const statusText = `*📊 Bot Status*\n\n` +
                          `🟢 *Status:* Online\n` +
                          `⏱️ *Uptime:* ${hours}h ${minutes}m ${seconds}s\n` +
                          `🔧 *Mode:* Ultra Minimal\n` +
                          `🧩 *Commands:* ${commands.size}\n`;
        
        await sock.sendMessage(sender, { text: statusText });
    } catch (err) {
        console.error('Error in status command:', err);
    }
});

// Add about command
commands.set('about', async (sock, message) => {
    try {
        if (!message.key?.remoteJid) return;
        const sender = message.key.remoteJid;
        
        const aboutText = `*🤖 BLACKSKY-MD Bot*\n\n` +
                         `A reliable WhatsApp bot with multi-level fallback system.\n\n` +
                         `*Version:* 1.0.0 (Ultra Minimal)\n` +
                         `*Framework:* @whiskeysockets/baileys\n` +
                         `*Created by:* Team BLACKSKY\n\n` +
                         `_Currently running in ultra-minimal mode to ensure stability._\n\n` +
                         `Type *!help* for available commands.`;
        
        await sock.sendMessage(sender, { text: aboutText });
    } catch (err) {
        console.error('Error in about command:', err);
    }
});

/**
 * Process messages
 */
async function messageHandler(sock, message) {
    try {
        // Very basic validation
        if (!message.message || !message.key?.remoteJid) return;
        
        // Get text content
        const content = message.message.conversation || 
                      message.message.extendedTextMessage?.text;
        
        console.log('Ultra minimal handler received message:', content);
        
        if (!content || !content.startsWith('!')) return;
        
        console.log('Processing command:', content);
        
        // Extract command
        const command = content.slice(1).trim().split(' ')[0].toLowerCase();
        
        console.log('Extracted command:', command, 'Available commands:', Array.from(commands.keys()));
        
        // Run command if it exists
        if (commands.has(command)) {
            console.log('Executing command:', command);
            await commands.get(command)(sock, message);
        } else {
            console.log('Command not found:', command);
        }
    } catch (err) {
        console.error('Error in ultra minimal handler:', err);
    }
}

/**
 * Simple initialization
 */
async function init() {
    console.log('Ultra minimal handler initialized');
    return true;
}

// Export the handler
module.exports = {
    messageHandler,
    init,
    commands
};