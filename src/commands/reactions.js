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

// Direct Tenor GIF URLs that are verified to work
const DIRECT_GIFS = {
    hug: 'https://media1.tenor.com/m/NwS54VoQH9YAAAAC/anime-love.gif',
    pat: 'https://media1.tenor.com/m/N41zKEDABuUAAAAC/anime-head-pat-anime-pat.gif',
    kiss: 'https://media1.tenor.com/m/YFzXN8r2h_sAAAAC/anime-kiss.gif',
    cuddle: 'https://media1.tenor.com/m/4XGh4v8UYaEAAAAC/anime-cuddle.gif',
    smile: 'https://media1.tenor.com/m/It6ujwRk4uEAAAAC/happy-anime.gif',
    happy: 'https://media1.tenor.com/m/6Nc8_5KOabEAAAAC/happy-anime.gif',
    wave: 'https://media1.tenor.com/m/w1EV9RN07MgAAAAC/wave-anime.gif',
    dance: 'https://media1.tenor.com/m/mKTS5nbF1zcAAAAC/anime-dance.gif',
    cry: 'https://media1.tenor.com/m/N2_bZv_A_f4AAAAC/sad-cry.gif',
    blush: 'https://media1.tenor.com/m/xIuXbMtA38sAAAAC/wheat-embarrassed.gif',
    laugh: 'https://media1.tenor.com/m/w9h-XaFr8V8AAAAC/laugh-anime.gif',
    wink: 'https://media1.tenor.com/m/uxO9pxZdyxgAAAAC/anime-wink.gif',
    poke: 'https://media1.tenor.com/m/3dOqO4vVlXQAAAAC/poke-anime.gif',
    slap: 'https://media1.tenor.com/m/Ws6Dm1ZW_vMAAAAC/girl-slap.gif',
    bonk: 'https://media1.tenor.com/m/CrmEU2LjMi8AAAAC/anime-bonk.gif',
    bite: 'https://media1.tenor.com/m/w4T3GhUB8CIAAAAC/anime-bite.gif',
    yeet: 'https://media1.tenor.com/m/tJ_Eo6OXOkoAAAAC/throw-yeet.gif',
    punch: 'https://media1.tenor.com/m/w1N7CXFWUyQAAAAC/anime-punch.gif',
    highfive: 'https://media1.tenor.com/m/KZmxu5RH0gcAAAAC/high-five-anime.gif'
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

        // Send as video with GIF playback enabled
        await sock.sendMessage(chatJid, {
            video: { url: gifUrl },
            caption: message,
            mentions: mentions,
            gifPlayback: true,
            mimetype: 'video/mp4'
        });

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
    async bite(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        await sendReactionMessage(sock, sender, target, 'bite', null, '😬');
    },
    // Fun actions
    async yeet(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        await sendReactionMessage(sock, sender, target, 'yeet', null, '🚀');
    },
    async punch(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        await sendReactionMessage(sock, sender, target, 'punch', null, '👊');
    },
    async highfive(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        await sendReactionMessage(sock, sender, target, 'highfive', null, '✋');
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