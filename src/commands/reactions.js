/**
 * BLACKSKY-MD Reaction Commands Module
 * Implements a comprehensive set of reaction commands with GIF support
 */

const logger = require('../utils/logger');
const axios = require('axios');

// Cache for user information and GIFs
const userCache = new Map();
const gifCache = new Map();
const USER_CACHE_TIMEOUT = 30 * 60 * 1000; // 30 minutes
const GIF_CACHE_TIMEOUT = 5 * 60 * 1000; // 5 minutes

// Direct GIF URLs that are verified to work
const DIRECT_GIFS = {
    hug: 'https://media.tenor.com/images/2d5373cd3a0be4f25345a52d1ada1d1f/tenor.gif',
    pat: 'https://media.tenor.com/images/1d37a873edfeb81a1f5403f4a3bfa185/tenor.gif',
    kiss: 'https://media.tenor.com/images/a1f7d43752168b3c1dbdfb925bda8a33/tenor.gif',
    cuddle: 'https://media.tenor.com/images/5603e24395b61245a08fe0299574f1e3/tenor.gif',
    smile: 'https://media.tenor.com/images/81c0b8d3c0617d2a8bf42650b181b97e/tenor.gif',
    happy: 'https://media.tenor.com/images/a5cab07318215c706bbdd819fca2b60d/tenor.gif',
    wave: 'https://media.tenor.com/images/9c1afcf5f3c9b4a0f336f01a86acb1e3/tenor.gif',
    dance: 'https://media.tenor.com/images/81c0b8d3c0617d2a8bf42650b181b97e/tenor.gif',
    cry: 'https://media.tenor.com/images/e69ebde3631408c200777ebe10f84367/tenor.gif',
    blush: 'https://media.tenor.com/images/cbfd2a06c6d350e13d0a4cc4803c5c82/tenor.gif',
    laugh: 'https://media.tenor.com/images/9c42c0f3a448561bdb573049e11c6466/tenor.gif',
    wink: 'https://media.tenor.com/images/4f8e6c925e0c4556b9a4417c6e6d3710/tenor.gif',
    poke: 'https://media.tenor.com/images/9ea4fb41d066737c0e3f2d626c13f230/tenor.gif',
    slap: 'https://media.tenor.com/images/d2a955ef051296f5e18c06433cd71a66/tenor.gif',
    bonk: 'https://media.tenor.com/images/79644a28bfcb95a9c9bd5073235dfa8e/tenor.gif'
};

// Helper function to validate mentions
function validateMention(mention) {
    if (!mention || typeof mention !== 'string') return false;
    return mention.includes('@s.whatsapp.net') ||
           mention.includes('@g.us') ||
           /^\d+@/.test(mention) ||
           /^\d+$/.test(mention) ||
           mention.startsWith('@') ||
           mention.match(/^[a-zA-Z0-9._-]+$/) ||
           mention === 'everyone' ||
           mention === 'all';
}

// Fast user name fetching with caching
async function getUserName(sock, jid) {
    try {
        if (userCache.has(jid)) {
            const cached = userCache.get(jid);
            if (Date.now() - cached.timestamp < USER_CACHE_TIMEOUT) {
                return cached.name;
            }
            userCache.delete(jid);
        }

        let name;
        try {
            const contact = await sock.contacts[jid] || {};
            name = contact?.pushName ||
                  contact?.verifiedName ||
                  contact?.name ||
                  contact?.notify;

            if (!name) {
                const status = await sock.fetchStatus(jid).catch(() => null);
                name = status?.status?.name;
            }
        } catch (err) {
            logger.warn(`Error getting contact info: ${err.message}`);
        }

        name = name || jid.split('@')[0];

        // Format phone numbers nicely
        if (name.match(/^\d+$/)) {
            name = name.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3');
        }

        userCache.set(jid, { name, timestamp: Date.now() });
        return name;
    } catch (err) {
        logger.error(`Error fetching user name: ${err.message}`);
        return jid.split('@')[0];
    }
}

// Reaction message sending with direct GIFs
async function sendReactionMessage(sock, sender, target, type, customGifUrl, emoji) {
    try {
        const startTime = Date.now();
        const chatJid = sender.includes('@g.us') ? sender : (sender.split('@')[0] + '@s.whatsapp.net');

        // Handle validation first
        if (target && !validateMention(target)) {
            await sock.sendMessage(chatJid, { text: `❌ Please mention a valid user to ${type}` });
            return;
        }

        // Get user names in parallel
        const [senderName, targetName] = await Promise.all([
            getUserName(sock, sender),
            target ? getUserName(sock, target.includes('@') ? target : `${target.replace('@', '')}@s.whatsapp.net`) : null
        ]);

        // Get GIF URL
        const gifUrl = customGifUrl || DIRECT_GIFS[type];
        if (!gifUrl) {
            throw new Error(`No GIF URL available for ${type}`);
        }

        // Generate message text
        let message;
        if (target) {
            message = targetName === 'everyone' || targetName === 'all'
                ? `${senderName} ${type}s everyone ${emoji}`
                : `${senderName} ${type}s ${targetName} ${emoji}`;
        } else {
            const actionMap = {
                cry: 'crying',
                dance: 'dancing',
                laugh: 'laughing',
                smile: 'smiling',
                happy: 'happy',
                blush: 'blushing',
                wink: 'winking',
                wave: 'waving'
            };
            message = `${senderName} is ${actionMap[type] || type}ing ${emoji}`;
        }

        const mentions = (chatJid.includes('@g.us') && target && target.includes('@')) ? [target] : undefined;

        logger.debug(`Sending ${type} reaction with GIF: ${gifUrl}`);

        try {
            // Send as video with GIF playback
            await sock.sendMessage(chatJid, {
                video: { url: gifUrl },
                caption: message,
                mentions: mentions,
                gifPlayback: true,
                mimetype: 'video/mp4'
            });
            logger.debug(`Successfully sent video message for ${type}`);
        } catch (videoErr) {
            logger.warn(`Failed to send as video, trying as image: ${videoErr.message}`);

            try {
                // Try as image instead
                await sock.sendMessage(chatJid, {
                    image: { url: gifUrl },
                    caption: message,
                    mentions: mentions
                });
                logger.debug(`Successfully sent image message for ${type}`);
            } catch (imgErr) {
                logger.error(`Failed to send media message: ${imgErr.message}`);

                // Final fallback to text-only
                await sock.sendMessage(chatJid, {
                    text: message,
                    mentions: mentions
                });
                logger.debug(`Sent text-only message for ${type}`);
            }
        }

        logger.debug(`Reaction message sent successfully (${Date.now() - startTime}ms)`);
    } catch (error) {
        logger.error('Error sending reaction message:', error);
        await sock.sendMessage(sender, { text: `❌ Error executing ${type} command` });
    }
}

// Define reaction commands
const reactionCommands = {
    // Basic emotions
    async hug(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        await sendReactionMessage(sock, sender, target, 'hug', null, '🤗');
    },
    async pat(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        await sendReactionMessage(sock, sender, target, 'pat', null, '👋');
    },
    async kiss(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        await sendReactionMessage(sock, sender, target, 'kiss', null, '💋');
    },
    async cuddle(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        await sendReactionMessage(sock, sender, target, 'cuddle', null, '🤗');
    },
    async happy(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        await sendReactionMessage(sock, sender, target, 'happy', null, '😊');
    },
    async smile(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        await sendReactionMessage(sock, sender, target, 'smile', null, '😊');
    },
    async wave(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        await sendReactionMessage(sock, sender, target, 'wave', null, '👋');
    },
    async dance(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        await sendReactionMessage(sock, sender, target, 'dance', null, '💃');
    },
    async cry(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        await sendReactionMessage(sock, sender, target, 'cry', null, '😢');
    },
    async blush(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        await sendReactionMessage(sock, sender, target, 'blush', null, '😊');
    },
    async laugh(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        await sendReactionMessage(sock, sender, target, 'laugh', null, '😂');
    },
    async wink(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        await sendReactionMessage(sock, sender, target, 'wink', null, '😉');
    },
    // Playful actions
    async poke(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        await sendReactionMessage(sock, sender, target, 'poke', null, '👉');
    },
    async slap(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        await sendReactionMessage(sock, sender, target, 'slap', null, '👋');
    },
    async bonk(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        await sendReactionMessage(sock, sender, target, 'bonk', null, '🔨');
    },
    async bully(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        await sendReactionMessage(sock, sender, target, 'bully', null, '😈');
    },
    async kick(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        await sendReactionMessage(sock, sender, target, 'kick', null, '🦵');
    },
    async bite(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        await sendReactionMessage(sock, sender, target, 'bite', null, '😬');
    },
    async lick(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        await sendReactionMessage(sock, sender, target, 'lick', null, '👅');
    },
    // Social interactions
    async handhold(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        await sendReactionMessage(sock, sender, target, 'handhold', null, '🤝');
    },
    async highfive(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        await sendReactionMessage(sock, sender, target, 'highfive', null, '✋');
    },
    // Fun actions
    async yeet(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        await sendReactionMessage(sock, sender, target, 'yeet', null, '🚀');
    },
    async throw(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        await sendReactionMessage(sock, sender, target, 'throw', null, '🎯');
    },
    async nom(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        await sendReactionMessage(sock, sender, target, 'nom', null, '😋');
    }
};

// Cleanup timers for caches
setInterval(() => {
    const now = Date.now();

    // Cleanup user cache
    for (const [key, data] of userCache.entries()) {
        if (now - data.timestamp > USER_CACHE_TIMEOUT) {
            userCache.delete(key);
        }
    }

    // Cleanup GIF cache
    for (const [key, data] of gifCache.entries()) {
        if (now - data.timestamp > GIF_CACHE_TIMEOUT) {
            gifCache.delete(key);
        }
    }
}, Math.min(USER_CACHE_TIMEOUT, GIF_CACHE_TIMEOUT));

// Simple initialization function
async function init() {
    try {
        logger.info('Initializing reactions command handler...');
        return true; // Module is ready
    } catch (error) {
        logger.error('Failed to initialize reactions module:', error);
        return false;
    }
}

module.exports = {
    commands: reactionCommands,
    category: 'reactions',
    init
};