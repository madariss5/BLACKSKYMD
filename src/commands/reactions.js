// Import required modules
const logger = require('../utils/logger');
const axios = require('axios');

// Cache for user information
const userCache = new Map();
const USER_CACHE_TIMEOUT = 30 * 60 * 1000; // 30 minutes

// Verified working Tenor GIF URLs
const DIRECT_GIFS = {
    hug: 'https://media.tenor.com/kCZjTqCKiggAAAAC/anime-hug.gif',
    pat: 'https://media.tenor.com/Y7B6npa9mXgAAAAC/head-pat-anime.gif',
    kiss: 'https://media.tenor.com/dn_KuOESmUYAAAAC/engage-kiss-anime-kiss.gif',
    cuddle: 'https://media.tenor.com/keasv-Cnh4QAAAAC/anime-cuddle.gif',
    smile: 'https://media.tenor.com/F8E1MO_1BhcAAAAC/anime-smile.gif',
    happy: 'https://media.tenor.com/QK1rQJY2Q4oAAAAC/anime-happy.gif',
    wave: 'https://media.tenor.com/eZBtFHL9xa0AAAAC/wave-anime.gif',
    dance: 'https://media.tenor.com/ppvvvFyxpH4AAAAC/anime-dance.gif',
    cry: 'https://media.tenor.com/6pHzjCKu1w8AAAAC/sad-cry.gif',
    blush: 'https://media.tenor.com/YM3fW1y6f8MAAAAC/shy-anime.gif',
    laugh: 'https://media.tenor.com/YCJlCfNvSWEAAAAC/laugh-anime.gif',
    wink: 'https://media.tenor.com/QLxZxXtU2VMAAAAC/wink-anime.gif',
    poke: 'https://media.tenor.com/0ZT_Qk4EwKoAAAAC/anime-poke.gif',
    slap: 'https://media.tenor.com/Ws6Dm1ZW_vMAAAAC/girl-slap.gif',
    bonk: 'https://media.tenor.com/CrmEU2LjMi8AAAAC/anime-bonk.gif',
    bite: 'https://media.tenor.com/w4T3GhUB8CIAAAAC/anime-bite.gif',
    yeet: 'https://media.tenor.com/9vVAHDC9IHsAAAAC/anime-throw.gif',
    punch: 'https://media.tenor.com/p_mMicwVUqkAAAAC/anime-punch.gif',
    highfive: 'https://media.tenor.com/PMEk6EGV7FgAAAAC/anime-high-five.gif'
};

// Helper function to validate mentions
function validateMention(target) {
    if (!target || typeof target !== 'string') return false;
    return target.includes('@s.whatsapp.net') ||
           target.includes('@g.us') ||
           /^\d+@/.test(target) ||
           /^\d+$/.test(target) ||
           target.startsWith('@') ||
           target.match(/^[a-zA-Z0-9._-]+$/) ||
           target === 'everyone' ||
           target === 'all';
}

// Improved user name fetching with better error handling
async function getUserName(sock, jid) {
    try {
        // Handle null/undefined jid
        if (!jid) {
            return "Someone";
        }
        
        // Return cached name if available
        if (userCache.has(jid)) {
            const cached = userCache.get(jid);
            if (Date.now() - cached.timestamp < USER_CACHE_TIMEOUT) {
                return cached.name;
            }
            userCache.delete(jid);
        }

        let name = null;
        
        // Get contact from store instead of directly accessing contacts
        try {
            // Try to get contact from store
            if (sock.store && typeof sock.store.contacts === 'object') {
                const contact = sock.store.contacts[jid];
                name = contact?.pushName || contact?.verifiedName || contact?.name || contact?.notify;
            } 
            
            // Try direct contact access as fallback
            if (!name && sock.contacts && typeof sock.contacts === 'object') {
                const contact = sock.contacts[jid];
                name = contact?.pushName || contact?.verifiedName || contact?.name || contact?.notify;
            }
            
            // Last resort - try to fetch status
            if (!name && typeof sock.fetchStatus === 'function') {
                const status = await sock.fetchStatus(jid).catch(() => null);
                name = status?.status?.name;
            }
        } catch (err) {
            logger.warn(`Error getting contact info for ${jid}: ${err.message}`);
        }

        // Default to phone number if no name found
        if (!name) {
            // Extract phone number from JID
            const phoneMatch = jid.match(/^(\d+)@/);
            name = phoneMatch ? phoneMatch[1] : jid.split('@')[0];
            
            // Format phone numbers nicely if they match expected pattern
            if (name.match(/^\d{10,}$/)) {
                // Try to format as (XXX) XXX-XXXX
                try {
                    name = name.replace(/(\d{3})(\d{3})(\d{4})$/, '($1) $2-$3');
                } catch (e) {
                    // If formatting fails, keep original
                }
            }
        }

        // Cache the result
        userCache.set(jid, { name, timestamp: Date.now() });
        return name;
    } catch (err) {
        logger.error(`Error fetching user name: ${err.message}`);
        // Return a safe fallback
        return jid?.split('@')[0] || "User";
    }
}

// Completely redesigned reaction message sending function
async function sendReactionMessage(sock, sender, target, type, customGifUrl, emoji) {
    try {
        // Validation
        if (!DIRECT_GIFS[type] && !customGifUrl) {
            throw new Error(`No GIF URL available for ${type}`);
        }

        const gifUrl = customGifUrl || DIRECT_GIFS[type];
        const targetJid = target ? (target.includes('@') ? target : `${target.replace('@', '')}@s.whatsapp.net`) : null;

        // Validate target if provided
        if (target && !validateMention(target)) {
            await sock.sendMessage(sender, { text: `❌ Invalid target mention for ${type} command` });
            return;
        }

        // Get user names with better error handling
        let senderName = "User";
        let targetName = "Someone";
        try {
            senderName = await getUserName(sock, sender);
            if (target) {
                targetName = await getUserName(sock, targetJid);
            }
        } catch (nameError) {
            logger.warn(`Error getting names: ${nameError.message}`);
            // Continue with default names
        }

        // Generate message text with better grammar
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

        // Try to download GIF
        let buffer;
        try {
            const response = await axios.get(gifUrl, { 
                responseType: 'arraybuffer',
                timeout: 15000, // 15 second timeout
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
            });
            buffer = Buffer.from(response.data);
        } catch (downloadError) {
            logger.warn(`Error downloading GIF: ${downloadError.message}`);
            // Send text-only message as fallback
            await sock.sendMessage(sender, { 
                text: `${message}\n\n(Image could not be loaded)` 
            });
            return;
        }

        // Try to send as image first (more reliable than sticker)
        try {
            await sock.sendMessage(sender, {
                image: buffer,
                caption: message,
                mimetype: 'image/gif',
                gifPlayback: true
            });
            logger.info(`Successfully sent ${type} reaction to ${sender}`);
            return;
        } catch (imageError) {
            logger.warn(`Could not send as image, trying as sticker: ${imageError.message}`);
            // Fall through to try sticker method
        }

        // Try to send as sticker if image fails
        try {
            await sock.sendMessage(sender, {
                sticker: buffer,
                mimetype: 'image/gif',
                gifPlayback: true
            });
            
            // Send caption as separate message since stickers can't have captions
            await sock.sendMessage(sender, { text: message });
            
            logger.info(`Successfully sent ${type} reaction as sticker to ${sender}`);
        } catch (stickerError) {
            logger.error(`Failed to send as sticker: ${stickerError.message}`);
            
            // Last resort - send text only
            await sock.sendMessage(sender, { 
                text: `${message}\n\n(Could not process reaction image)` 
            });
        }
    } catch (error) {
        logger.error('Error sending reaction message:', error);
        try {
            // Final fallback to regular message
            await sock.sendMessage(sender, { 
                text: `*${type.toUpperCase()} REACTION* ${emoji}\n\n${error.message}` 
            });
        } catch (sendErr) {
            logger.error('Failed to send any message:', sendErr);
        }
    }
}

// Define reaction commands
const reactionCommands = {
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
    async smile(sock, message, args) {
        const sender = message.key.remoteJid;
        await sendReactionMessage(sock, sender, null, 'smile', null, '😊');
    },
    async happy(sock, message, args) {
        const sender = message.key.remoteJid;
        await sendReactionMessage(sock, sender, null, 'happy', null, '😊');
    },
    async wave(sock, message, args) {
        const sender = message.key.remoteJid;
        await sendReactionMessage(sock, sender, null, 'wave', null, '👋');
    },
    async dance(sock, message, args) {
        const sender = message.key.remoteJid;
        await sendReactionMessage(sock, sender, null, 'dance', null, '💃');
    },
    async cry(sock, message, args) {
        const sender = message.key.remoteJid;
        await sendReactionMessage(sock, sender, null, 'cry', null, '😢');
    },
    async blush(sock, message, args) {
        const sender = message.key.remoteJid;
        await sendReactionMessage(sock, sender, null, 'blush', null, '😊');
    },
    async laugh(sock, message, args) {
        const sender = message.key.remoteJid;
        await sendReactionMessage(sock, sender, null, 'laugh', null, '😂');
    },
    async wink(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        await sendReactionMessage(sock, sender, target, 'wink', null, '😉');
    },
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

// Initialize function
async function init() {
    try {
        logger.info('Initializing reactions module...');
        return true;
    } catch (error) {
        logger.error('Failed to initialize reactions module:', error);
        return false;
    }
}

// Export module
module.exports = {
    commands: reactionCommands,
    category: 'reactions',
    init
};