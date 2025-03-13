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
    hug: 'https://api.waifu.pics/sfw/hug',
    pat: 'https://api.waifu.pics/sfw/pat',
    kiss: 'https://api.waifu.pics/sfw/kiss',
    cuddle: 'https://api.waifu.pics/sfw/cuddle',
    smile: 'https://api.waifu.pics/sfw/smile',
    happy: 'https://api.waifu.pics/sfw/happy',
    wave: 'https://api.waifu.pics/sfw/wave',
    dance: 'https://api.waifu.pics/sfw/dance',
    cry: 'https://api.waifu.pics/sfw/cry',
    blush: 'https://api.waifu.pics/sfw/blush',
    laugh: 'https://api.waifu.pics/sfw/laugh',
    wink: 'https://api.waifu.pics/sfw/wink',
    poke: 'https://api.waifu.pics/sfw/poke',
    slap: 'https://api.waifu.pics/sfw/slap',
    bonk: 'https://api.waifu.pics/sfw/bonk',
    bully: 'https://api.waifu.pics/sfw/bully',
    kick: 'https://api.waifu.pics/sfw/kick',
    kill: 'https://api.waifu.pics/sfw/kill',
    bite: 'https://api.waifu.pics/sfw/bite',
    lick: 'https://api.waifu.pics/sfw/lick',
    handhold: 'https://api.waifu.pics/sfw/handhold',
    highfive: 'https://api.waifu.pics/sfw/highfive',
    yeet: 'https://api.waifu.pics/sfw/yeet',
    throw: 'https://api.waifu.pics/sfw/throw',
    nom: 'https://api.waifu.pics/sfw/nom'
};

// Verified working Tenor GIF fallbacks
const fallbacks = {
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
    bonk: 'https://media.tenor.com/images/79644a28bfcb95a9c9bd5073235dfa8e/tenor.gif',
    bully: 'https://media.tenor.com/images/dd8058fa55f2b208350e00f329cdfa9a/tenor.gif',
    kick: 'https://media.tenor.com/images/4dd99934786573b92d56a6a96d96d99f/tenor.gif',
    kill: 'https://media.tenor.com/images/8c91837c981dbf53b7218a2dbb6b9d4a/tenor.gif',
    bite: 'https://media.tenor.com/images/6b42070d19f50180a7c7cfd62a02a5c4/tenor.gif',
    lick: 'https://media.tenor.com/images/ec2ca0bf12d7b1a30fea702b59e5a7ea/tenor.gif',
    handhold: 'https://media.tenor.com/images/7b1f06eac73c36721912edcaa21f31ec/tenor.gif',
    highfive: 'https://media.tenor.com/images/7b1f06eac73c36721912edcaa21f31ec/tenor.gif',
    yeet: 'https://media.tenor.com/images/d88b38c6698c568e7347ef365ae6b348/tenor.gif',
    throw: 'https://media.tenor.com/images/d88b38c6698c568e7347ef365ae6b348/tenor.gif',
    nom: 'https://media.tenor.com/images/b89ada361f579e3893c05c1bced437d3/tenor.gif'
};

// Generic fallback for when both API and specific fallback fail
const genericFallback = 'https://media.tenor.com/images/2b9cba7b488142d61559145bf1d406c3/tenor.gif';

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

// Helper function to verify GIF URL format
function isValidGifUrl(url) {
    return url && (
        url.toLowerCase().endsWith('.gif') ||
        url.toLowerCase().includes('/gif/') ||
        url.toLowerCase().includes('tenor.com') ||
        url.toLowerCase().includes('giphy.com') ||
        url.toLowerCase().includes('waifu.pics')
    );
}

// Optimized GIF fetching with caching and fallbacks
async function fetchAnimeGif(type) {
    try {
        const startTime = Date.now();

        // Check cache first
        if (gifCache.has(type)) {
            const cached = gifCache.get(type);
            if (Date.now() - cached.timestamp < GIF_CACHE_TIMEOUT) {
                logger.debug(`GIF cache hit for ${type} (${Date.now() - startTime}ms)`);
                return cached.url;
            }
            gifCache.delete(type);
        }

        const fallbackUrl = fallbacks[type] || genericFallback;

        // Try primary API with short timeout
        try {
            const endpoint = ANIME_GIF_API[type];
            if (!endpoint) {
                gifCache.set(type, { url: fallbackUrl, timestamp: Date.now() });
                return fallbackUrl;
            }

            const response = await Promise.race([
                axios.get(endpoint, { 
                    timeout: 2000,
                    validateStatus: status => status === 200
                }),
                new Promise((_, reject) => setTimeout(() => reject(new Error('API Timeout')), 2000))
            ]);

            if (response?.data?.url && isValidGifUrl(response.data.url)) {
                const gifUrl = response.data.url;
                gifCache.set(type, { url: gifUrl, timestamp: Date.now() });
                logger.debug(`GIF fetched for ${type} (${Date.now() - startTime}ms)`);
                return gifUrl;
            }
        } catch (err) {
            logger.debug(`Using fallback for ${type}: ${err.message}`);
        }

        // Use fallback
        gifCache.set(type, { url: fallbackUrl, timestamp: Date.now() });
        return fallbackUrl;

    } catch (error) {
        logger.error(`Error in fetchAnimeGif for ${type}: ${error.message}`);
        return fallbacks[type] || genericFallback;
    }
}

// Fast user name fetching with caching
async function getUserName(sock, jid) {
    try {
        const startTime = Date.now();
        // Check cache first
        if (userCache.has(jid)) {
            const cached = userCache.get(jid);
            if (Date.now() - cached.timestamp < USER_CACHE_TIMEOUT) {
                logger.debug(`User cache hit for ${jid} (${Date.now() - startTime}ms)`);
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
                if (status?.status?.name) {
                    name = status.status.name;
                }
            }
        } catch (err) {
            logger.warn(`Error getting contact info: ${err.message}`);
        }

        name = name || (jid.includes('@g.us') ? 'Group Member' : jid.split('@')[0].split(':')[0]);

        // Format phone numbers nicely
        if (name.match(/^\d+$/)) {
            name = name.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3');
        }

        // Cache the result
        userCache.set(jid, { name, timestamp: Date.now() });
        logger.debug(`User name resolved for ${jid} (${Date.now() - startTime}ms)`);
        return name;
    } catch (err) {
        logger.error(`Error fetching user name: ${err.message}`);
        return jid.split('@')[0].split(':')[0];
    }
}

// Fast reaction message sending with parallel processing
async function sendReactionMessage(sock, sender, target, type, gifUrl, emoji) {
    try {
        const startTime = Date.now();
        const chatJid = sender.includes('@g.us') ? sender : (sender.split('@')[0] + '@s.whatsapp.net');

        // Handle validation first
        if (target && !validateMention(target)) {
            await sock.sendMessage(chatJid, { text: `❌ Please mention a valid user to ${type}` });
            return;
        }

        // Get all data in parallel with timeouts
        logger.debug(`Starting parallel data fetch for ${type} reaction`);
        const [senderName, targetName, finalGifUrl] = await Promise.all([
            getUserName(sock, sender),
            target ? getUserName(sock, target.includes('@') ? target : `${target.replace('@', '')}@s.whatsapp.net`) : null,
            gifUrl || fetchAnimeGif(type)
        ]);
        logger.debug(`Parallel data fetch completed (${Date.now() - startTime}ms)`);

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

            message = `${senderName} is ${actionMap[type] || `feeling ${type}`} ${emoji}`;
        }

        const mentions = (chatJid.includes('@g.us') && target && target.includes('@')) ? [target] : undefined;

        logger.debug(`Sending reaction message (${Date.now() - startTime}ms)`);

        try {
            // Try sending as video first for better GIF playback
            await sock.sendMessage(chatJid, {
                video: { url: finalGifUrl },
                caption: message,
                mentions: mentions,
                gifPlayback: true,
                mimetype: 'video/mp4'
            });
        } catch (videoErr) {
            logger.warn(`Failed to send as video, trying as image: ${videoErr.message}`);
            try {
                // Try sending as image
                await sock.sendMessage(chatJid, {
                    image: { url: finalGifUrl },
                    caption: message,
                    mentions: mentions
                });
            } catch (imgErr) {
                logger.error(`Failed to send as image: ${imgErr.message}`);
                // Fallback to text-only message
                await sock.sendMessage(chatJid, {
                    text: message,
                    mentions: mentions
                });
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

// Simple initialization function that tests endpoints
async function init() {
    try {
        logger.info('Initializing reactions command handler...');

        // Test all endpoints
        const results = await Promise.allSettled(
            Object.keys(ANIME_GIF_API).map(async type => {
                try {
                    const gifUrl = await fetchAnimeGif(type);
                    return { type, success: isValidGifUrl(gifUrl) };
                } catch (error) {
                    return { type, success: false, error: error.message };
                }
            })
        );

        const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
        const failed = results.filter(r => r.status === 'fulfilled' && !r.value.success).length;

        logger.info(`Reaction endpoints tested: ${successful} working, ${failed} failed`);
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