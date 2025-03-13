/**
 * Ultra Minimal Message Handler
 * Designed for maximum reliability
 */

const fs = require('fs');
const path = require('path');

// Commands storage
const commands = new Map();

// Basic ping command
commands.set('ping', async (sock, message) => {
    try {
        console.log('Executing ping command');
        const sender = message.key.remoteJid;
        await sock.sendMessage(sender, { text: '🏓 Pong! Bot is working.' });
    } catch (err) {
        console.error('Error in ping command:', err);
    }
});

// Help command
commands.set('help', async (sock, message) => {
    try {
        console.log('Executing help command');
        const sender = message.key.remoteJid;
        const commandList = Array.from(commands.keys()).join(', ');
        await sock.sendMessage(sender, { 
            text: `*Available Commands*\n${commandList}`
        });
    } catch (err) {
        console.error('Error in help command:', err);
    }
});

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

// Add about command 
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


// Message handler
async function messageHandler(sock, message) {
    try {
        console.log('Message received:', message);

        // Basic validation
        if (!message?.message || !message.key?.remoteJid) {
            console.log('Invalid message format');
            return;
        }

        // Get message content
        const content = message.message?.conversation || 
                       message.message?.extendedTextMessage?.text ||
                       message.message?.imageMessage?.caption ||
                       message.message?.videoMessage?.caption;

        console.log('Message content:', content);

        if (!content) {
            console.log('No text content found');
            return;
        }

        // Check for command prefix
        if (content.startsWith('!') || content.startsWith('.')) {
            console.log('Command detected:', content);

            const commandName = content.slice(1).trim().split(' ')[0].toLowerCase();
            console.log('Attempting to execute command:', commandName);

            if (commands.has(commandName)) {
                await commands.get(commandName)(sock, message);
                console.log('Command executed successfully:', commandName);
            } else {
                console.log('Command not found:', commandName);
                await sock.sendMessage(message.key.remoteJid, {
                    text: `Command not found. Try !help for available commands.`
                });
            }
        }
    } catch (err) {
        console.error('Error in message handler:', err);
        try {
            await sock.sendMessage(message.key.remoteJid, {
                text: 'An error occurred while processing your message.'
            });
        } catch (sendErr) {
            console.error('Failed to send error message:', sendErr);
        }
    }
}

// Initialize handler
async function init() {
    try {
        console.log('Initializing ultra minimal handler');
        console.log('Available commands:', Array.from(commands.keys()));
        return true;
    } catch (err) {
        console.error('Error initializing handler:', err);
        return false;
    }
}

module.exports = {
    messageHandler,
    init,
    commands
};