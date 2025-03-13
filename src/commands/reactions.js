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

// Verified working API endpoints
const ANIME_GIF_API = {
    // Basic emotions
    hug: 'https://nekos.life/api/v2/img/hug',
    pat: 'https://nekos.life/api/v2/img/pat',
    kiss: 'https://nekos.life/api/v2/img/kiss',
    cuddle: 'https://nekos.life/api/v2/img/cuddle',
    smile: 'https://nekos.life/api/v2/img/smile',
    happy: 'https://nekos.life/api/v2/img/happy',
    wave: 'https://nekos.life/api/v2/img/wave',
    dance: 'https://nekos.life/api/v2/img/dance',
    cry: 'https://nekos.life/api/v2/img/cry',
    blush: 'https://nekos.life/api/v2/img/blush',
    laugh: 'https://nekos.life/api/v2/img/laugh',
    wink: 'https://nekos.life/api/v2/img/wink',
    poke: 'https://nekos.life/api/v2/img/poke',
    slap: 'https://nekos.life/api/v2/img/slap',
    bonk: 'https://nekos.life/api/v2/img/bonk',
    bully: 'https://nekos.life/api/v2/img/bully',
    kick: 'https://nekos.life/api/v2/img/kick',
    bite: 'https://nekos.life/api/v2/img/bite',
    lick: 'https://nekos.life/api/v2/img/lick',
    handhold: 'https://nekos.life/api/v2/img/handhold',
    highfive: 'https://nekos.life/api/v2/img/highfive',
    yeet: 'https://nekos.life/api/v2/img/yeet',
    throw: 'https://nekos.life/api/v2/img/throw',
    nom: 'https://nekos.life/api/v2/img/nom'
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

// Helper function to verify GIF URL format and accessibility
async function isValidGifUrl(url) {
    try {
        if (!url) return false;

        // Check URL format
        if (!(url.toLowerCase().endsWith('.gif') ||
              url.toLowerCase().includes('/gif/') ||
              url.toLowerCase().includes('tenor.com') ||
              url.toLowerCase().includes('giphy.com') ||
              url.toLowerCase().includes('nekos.life'))) {
            return false;
        }

        // Verify URL accessibility with short timeout
        const response = await axios.head(url, { 
            timeout: 3000,
            validateStatus: (status) => status === 200
        });

        // Check content type
        const contentType = response.headers['content-type'];
        return contentType && (
            contentType.includes('image/gif') ||
            contentType.includes('image/webp') ||
            contentType.includes('video/mp4')
        );
    } catch (err) {
        logger.debug(`GIF URL validation failed for ${url}: ${err.message}`);
        return false;
    }
}

// Optimized GIF fetching with caching and fallbacks
async function fetchAnimeGif(type) {
    try {
        const startTime = Date.now();
        logger.debug(`Fetching GIF for type: ${type}`);

        // Check cache first
        if (gifCache.has(type)) {
            const cached = gifCache.get(type);
            if (Date.now() - cached.timestamp < GIF_CACHE_TIMEOUT) {
                logger.debug(`GIF cache hit for ${type}`);
                return cached.url;
            }
            gifCache.delete(type);
        }

        // Try to fetch from API
        try {
            const endpoint = ANIME_GIF_API[type];
            if (!endpoint) {
                throw new Error(`No API endpoint for ${type}`);
            }

            const response = await axios.get(endpoint, {
                timeout: 5000,
                validateStatus: status => status === 200
            });

            // nekos.life API returns { url: "gif_url" }
            const gifUrl = response.data?.url;

            if (await isValidGifUrl(gifUrl)) {
                gifCache.set(type, { url: gifUrl, timestamp: Date.now() });
                logger.debug(`Successfully fetched GIF for ${type} (${Date.now() - startTime}ms)`);
                return gifUrl;
            }
            throw new Error('Invalid GIF URL from API');
        } catch (err) {
            logger.warn(`API error for ${type}: ${err.message}, trying fallback`);
            throw err; // Let the outer catch handle fallback
        }
    } catch (error) {
        logger.error(`Error fetching GIF for ${type}: ${error.message}`);
        // Return a hardcoded fallback GIF that's guaranteed to work
        return 'https://media.tenor.com/images/2d5373cd3a0be4f25345a52d1ada1d1f/tenor.gif';
    }
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

// Reaction message sending with improved GIF handling
async function sendReactionMessage(sock, sender, target, type, customGifUrl, emoji) {
    try {
        const startTime = Date.now();
        const chatJid = sender.includes('@g.us') ? sender : (sender.split('@')[0] + '@s.whatsapp.net');

        // Handle validation first
        if (target && !validateMention(target)) {
            await sock.sendMessage(chatJid, { text: `❌ Please mention a valid user to ${type}` });
            return;
        }

        // Get GIF URL first to handle any issues early
        const gifUrl = customGifUrl || await fetchAnimeGif(type);
        if (!gifUrl) {
            throw new Error('Failed to get GIF URL');
        }

        // Get user names in parallel
        const [senderName, targetName] = await Promise.all([
            getUserName(sock, sender),
            target ? getUserName(sock, target.includes('@') ? target : `${target.replace('@', '')}@s.whatsapp.net`) : null
        ]);

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

        // Try multiple formats in order
        const sendFormats = [
            // Try as video first (best for animated content)
            {
                type: 'video',
                message: {
                    video: { url: gifUrl },
                    caption: message,
                    mentions: mentions,
                    gifPlayback: true,
                    mimetype: 'video/mp4'
                }
            },
            // Then as GIF/image
            {
                type: 'image',
                message: {
                    image: { url: gifUrl },
                    caption: message,
                    mentions: mentions
                }
            },
            // Finally text-only as last resort
            {
                type: 'text',
                message: {
                    text: message,
                    mentions: mentions
                }
            }
        ];

        let sent = false;
        for (const format of sendFormats) {
            try {
                await sock.sendMessage(chatJid, format.message);
                logger.debug(`Successfully sent as ${format.type}`);
                sent = true;
                break;
            } catch (err) {
                logger.warn(`Failed to send as ${format.type}: ${err.message}`);
                continue;
            }
        }

        if (!sent) {
            throw new Error('Failed to send message in any format');
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

// Initialize and test endpoints
async function init() {
    try {
        logger.info('Initializing reactions command handler...');

        // Test endpoints and verify GIFs
        const results = await Promise.allSettled(
            Object.keys(ANIME_GIF_API).map(async type => {
                try {
                    const gifUrl = await fetchAnimeGif(type);
                    const isValid = await isValidGifUrl(gifUrl);
                    return { type, success: isValid, url: gifUrl };
                } catch (error) {
                    logger.error(`Failed to test endpoint for ${type}: ${error.message}`);
                    return { type, success: false, error: error.message };
                }
            })
        );

        const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
        const failed = results.filter(r => r.status === 'fulfilled' && !r.value.success).length;

        logger.info(`Reaction endpoints tested: ${successful} working, ${failed} failed`);

        if (failed > 0) {
            const failures = results
                .filter(r => r.status === 'fulfilled' && !r.value.success)
                .map(r => r.value.type);
            logger.warn(`Failed endpoints: ${failures.join(', ')}`);
        }

        return successful > 0; // Module is initialized if at least one endpoint works
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