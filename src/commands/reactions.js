const logger = require('../utils/logger');
const axios = require('axios');

// Cache for user information and GIFs
const userCache = new Map();
const gifCache = new Map();
const USER_CACHE_TIMEOUT = 30 * 60 * 1000; // 30 minutes
const GIF_CACHE_TIMEOUT = 5 * 60 * 1000; // 5 minutes

// Fallback GIFs for when API fails
const fallbacks = {
    hug: 'https://media.tenor.com/images/a9bb4d55b2a08d3a964ddb39c0e96f3d/tenor.gif',
    pat: 'https://media.tenor.com/images/1d37a873edfeb81a1f5403f4a3bfa185/tenor.gif',
    kiss: 'https://media.tenor.com/images/02d9cae34993e48ab5bb27763f46b32e/tenor.gif',
    slap: 'https://media.tenor.com/images/9ea4fb41d066737c0e3f2d626c13f230/tenor.gif',
    cuddle: 'https://media.tenor.com/images/5603e24395b61245a08fe0299574f1e3/tenor.gif',
    panic: 'https://media.tenor.com/images/9c42c0f3a448561bdb573049e11c6466/tenor.gif',
    yeet: 'https://media.tenor.com/images/d88b38c6698c568e7347ef365ae6b348/tenor.gif',
    sad: 'https://media.tenor.com/images/7e623e17dd8c776eee5c044d4fe8a305/tenor.gif',
    happy: 'https://media.tenor.com/images/a5cab07318215c706bbdd819fca2b60d/tenor.gif',
    shoot: 'https://media.tenor.com/images/12cb6396c5c1dd2e9042da1d2f74a551/tenor.gif',
    punch: 'https://media.tenor.com/images/4f8e6c925e0c4556b9a4417c6e6d3710/tenor.gif',
    kick: 'https://media.tenor.com/images/4dd99934786573b92d56a6a96d96d99f/tenor.gif',
    dance: 'https://media.tenor.com/images/81c0b8d3c0617d2a8bf42650b181b97e/tenor.gif',
    cry: 'https://media.tenor.com/images/e69ebde3631408c200777ebe10f84367/tenor.gif',
    angry: 'https://media.tenor.com/images/bb33cc1bdd6a9d6a7eff0a5e5bfa7012/tenor.gif',
    bonk: 'https://media.tenor.com/images/79644a28bfcb95a9c9bd5073235dfa8e/tenor.gif',
    excited: 'https://media.tenor.com/images/ff7d22e3aa44144810c12bb743a48569/tenor.gif',
    pout: 'https://media.tenor.com/images/c718238122f3eae93bc96583f89d98f2/tenor.gif',
    confused: 'https://media.tenor.com/images/f2e7957f59d71bcf8ca3a6fe406a53a5/tenor.gif',
    bully: 'https://media.tenor.com/images/dd8058fa55f2b208350e00f329cdfa9a/tenor.gif',
    stare: 'https://media.tenor.com/images/9e6e8f42500512dd18dc99c1d054b909/tenor.gif',
    celebrate: 'https://media.tenor.com/images/2b9cba7b488142d61559145bf1d406c3/tenor.gif'
};

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

// Optimized GIF fetching with caching and faster timeout
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

        // Get fallback URL ready
        const fallbackUrl = fallbacks[type] || genericFallback;

        // Try to get GIF in parallel with very short timeout 
        try {
            const response = await Promise.race([
                axios.get(`https://api.waifu.pics/sfw/${type}`, { timeout: 1500 }),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Timeout')), 1500)
                )
            ]);

            if (response?.data?.url) {
                const gifUrl = response.data.url;
                gifCache.set(type, { url: gifUrl, timestamp: Date.now() });
                logger.debug(`GIF fetched for ${type} (${Date.now() - startTime}ms)`);
                return gifUrl;
            }
        } catch (error) {
            logger.warn(`Error fetching ${type} GIF (${Date.now() - startTime}ms): ${error.message}`);
        }

        // Use fallback 
        gifCache.set(type, { url: fallbackUrl, timestamp: Date.now() });
        return fallbackUrl;
    } catch (error) {
        logger.error(`Error in fetchAnimeGif for ${type}: ${error.message}`);
        return fallbacks[type] || genericFallback;
    }
}

// Optimized user name fetching with caching
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
            // Try to get contact info with timeout
            const contactPromise = Promise.race([
                Promise.resolve(sock.contacts[jid] || {}),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Contact fetch timeout')), 1000))
            ]);

            const contact = await contactPromise;
            name = contact?.pushName ||
                  contact?.verifiedName ||
                  contact?.name ||
                  contact?.notify;

            if (!name) {
                const statusPromise = Promise.race([
                    sock.fetchStatus(jid).catch(() => null),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Status fetch timeout')), 1000))
                ]);

                const status = await statusPromise;
                if (status?.status?.name) {
                    name = status.status.name;
                }
            }
        } catch (err) {
            logger.warn(`Error getting contact info (${Date.now() - startTime}ms): ${err.message}`);
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
            if (!validateMention(target)) {
                await sock.sendMessage(chatJid, {
                    text: `❌ Please mention a valid user to ${type}`
                });
                return;
            }

            message = targetName === 'everyone' || targetName === 'all'
                ? `${senderName} ${type}s everyone ${emoji}`
                : `${senderName} ${type}s ${targetName} ${emoji}`;
        } else {
            const actionMap = {
                cry: 'crying',
                dance: 'dancing',
                laugh: 'laughing',
                blush: 'blushing',
                panic: 'panicking',
                smile: 'smiling',
                angry: 'angry',
                sad: 'sad',
                happy: 'happy'
            };

            message = `${senderName} is ${actionMap[type] || `feeling ${type}`} ${emoji}`;
        }

        const mentions = (chatJid.includes('@g.us') && target && target.includes('@')) ? [target] : undefined;

        logger.debug(`Sending reaction message (${Date.now() - startTime}ms)`);
        await sock.sendMessage(chatJid, {
            image: { url: finalGifUrl },
            caption: message,
            mentions: mentions
        }).catch(async (err) => {
            logger.error(`Error sending message with image (${Date.now() - startTime}ms):`, err);
            // Fallback to text-only message
            await sock.sendMessage(chatJid, {
                text: message,
                mentions: mentions
            });
        });
        logger.debug(`Reaction message sent successfully (${Date.now() - startTime}ms)`);
    } catch (error) {
        logger.error('Error sending reaction message:', error);
        await sock.sendMessage(sender, { text: `❌ Error sending ${type} reaction` });
    }
}

// Export commands
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
    async tickle(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        await sendReactionMessage(sock, sender, target, 'tickle', null, '🤗');
    },
    async boop(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        await sendReactionMessage(sock, sender, target, 'boop', null, '👉');
    },
    async blush(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        await sendReactionMessage(sock, sender, target, 'blush', null, '😊');
    },
    async cry(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        await sendReactionMessage(sock, sender, target, 'cry', null, '😢');
    },
    async dance(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        await sendReactionMessage(sock, sender, target, 'dance', null, '💃');
    },
    async laugh(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        await sendReactionMessage(sock, sender, target, 'laugh', null, '😂');
    },
    async smile(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        await sendReactionMessage(sock, sender, target, 'smile', null, '😊');
    },
    async wave(sock, message, args) {
        try {
            const sender = message.key.remoteJid;
            const target = args[0];
            await sendReactionMessage(sock, sender, target, 'wave', null, '👋');
        } catch (error) {
            logger.error('Error in wave command:', error);
            const errorJid = message.key.remoteJid;
            await sock.sendMessage(errorJid, { text: '❌ Error executing wave command' });
        }
    },
    async wink(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        await sendReactionMessage(sock, sender, target, 'wink', null, '😉');
    },
    async grouphug(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        await sendReactionMessage(sock, sender, target, 'grouphug', null, '🤗');
    },
    async punch(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        await sendReactionMessage(sock, sender, target, 'punch', null, '👊');
    },
    async bonk(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        await sendReactionMessage(sock, sender, target, 'bonk', null, '🔨');
    },
    async pout(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        await sendReactionMessage(sock, sender, target, 'pout', null, '😤');
    },
    async smug(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        await sendReactionMessage(sock, sender, target, 'smug', null, '😏');
    },
    async run(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        await sendReactionMessage(sock, sender, target, 'run', null, '🏃');
    },
    async sleep(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        await sendReactionMessage(sock, sender, target, 'sleep', null, '😴');
    },
    async panic(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        await sendReactionMessage(sock, sender, target, 'panic', null, '😱');
    },
    async facepalm(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        await sendReactionMessage(sock, sender, target, 'facepalm', null, '🤦');
    },
    async highfive(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        await sendReactionMessage(sock, sender, target, 'highfive', null, '✋');
    },
    async hold(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        await sendReactionMessage(sock, sender, target, 'hold', null, '🤝');
    },
    async handhold(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        await sendReactionMessage(sock, sender, target, 'handhold', null, '🤝');
    },
    async nom(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        await sendReactionMessage(sock, sender, target, 'nom', null, '😋');
    },
    async bite(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        await sendReactionMessage(sock, sender, target, 'bite', null, '😬');
    },
    async glomp(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        await sendReactionMessage(sock, sender, target, 'glomp', null, '💫');
    },
    async kill(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        await sendReactionMessage(sock, sender, target, 'kill', null, '💀');
    },
    async yeet(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        await sendReactionMessage(sock, sender, target, 'yeet', null, '🚀');
    },
    async stare(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        await sendReactionMessage(sock, sender, target, 'stare', null, '👀');
    },
    async lick(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        await sendReactionMessage(sock, sender, target, 'lick', null, '👅');
    },
    async feed(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        await sendReactionMessage(sock, sender, target, 'feed', null, '🍽️');
    },
    async bully(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        await sendReactionMessage(sock, sender, target, 'bully', null, '😈');
    },
    async happy(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        await sendReactionMessage(sock, sender, target, 'happy', null, '😊');
    },
    async sad(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        await sendReactionMessage(sock, sender, target, 'sad', null, '😢');
    },
    async angry(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        await sendReactionMessage(sock, sender, target, 'angry', null, '😠');
    },
    async confused(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        await sendReactionMessage(sock, sender, target, 'confused', null, '😕');
    },
    async think(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        await sendReactionMessage(sock, sender, target, 'think', null, '🤔');
    },
    async peck(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        await sendReactionMessage(sock, sender, target, 'peck', null, '😘');
    },
    async greet(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        await sendReactionMessage(sock, sender, target, 'greet', null, '👋');
    },
    async salute(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        await sendReactionMessage(sock, sender, target, 'salute', null, '🫡');
    },
    async shocked(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        await sendReactionMessage(sock, sender, target, 'shocked', null, '😱');
    },
    async shrug(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        await sendReactionMessage(sock, sender, target, 'shrug', null, '🤷');
    },
    async nod(sock, message, args) {
        const sender = message.key.remoteJid;
        const target= args[0];
        await sendReactionMessage(sock, sender, target, 'nod', null, '😌');
    },
    async shake(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        await sendReactionMessage(sock, sender, target, 'shake', null, '😤');
    },
    async kick(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        await sendReactionMessage(sock, sender, target, 'kick', null, '🦵');
    },
    async throw(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        await sendReactionMessage(sock, sender, target, 'throw', null, '🎯');
    },
    async shoot(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        await sendReactionMessage(sock, sender, target, 'shoot', null, '🔫');
    },
    async thumbsup(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        await sendReactionMessage(sock, sender, target, 'thumbsup', null, '👍');
    },
    async thumbsdown(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        await sendReactionMessage(sock, sender, target, 'thumbsdown', null, '👎');
    },
    async excited(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        await sendReactionMessage(sock, sender, target, 'excited', null, '🤩');
    },
    async lewd(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        await sendReactionMessage(sock, sender, target, 'lewd', null, '😳');
    },
    async bored(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        await sendReactionMessage(sock, sender, target, 'bored', null, '😑');
    },
    async nervous(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        await sendReactionMessage(sock, sender, target, 'nervous', null, '😰');
    },
    async celebrate(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        await sendReactionMessage(sock, sender, target, 'celebrate', null, '🎉');
    },
    async dizzy(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        await sendReactionMessage(sock, sender, target, 'dizzy', null, '💫');
    },
    async bye(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        await sendReactionMessage(sock, sender, target, 'bye', null, '👋');
    },
    async smack(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        await sendReactionMessage(sock, sender, target, 'smack', null, '💥');
    },
    async nuzzle(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        await sendReactionMessage(sock, sender, target, 'nuzzle', null, '🥰');
    },
    async growl(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        await sendReactionMessage(sock, sender, target, 'growl', null, '😾');
    },
    async disgusted(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        await sendReactionMessage(sock, sender, target, 'disgusted', null, '🤢');
    },
    async scared(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        await sendReactionMessage(sock, sender, target, 'scared', null, '😱');
    },
    async hifive(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        await sendReactionMessage(sock, sender, target, 'hifive', null, '✋');
    },

    async grouphug(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        await sendReactionMessage(sock, sender, target, 'grouphug', null, '🤗');
    },

    async peck(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        await sendReactionMessage(sock, sender, target, 'peck', null, '😘');
    },

    async greet(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        await sendReactionMessage(sock, sender, target, 'greet', null, '👋');
    },

    async bye(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        await sendReactionMessage(sock, sender, target, 'bye', null, '👋');
    },

    async sad(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        await sendReactionMessage(sock, sender, target, 'sad', null, '😢');
    },

    async nom(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        await sendReactionMessage(sock, sender, target, 'nom', null, '😋');
    },
    async init() {
        try {
            logger.info('Initializing reactions command handler...');

            const commandNames = Object.keys(reactionCommands).filter(key =>
                key !== 'init' && typeof reactionCommands[key] === 'function'
            );

            const endpointNames = Object.keys(ANIME_GIF_API);

            logger.info(`Available reaction commands: ${commandNames.length}`);
            logger.info(`Available API endpoints: ${endpointNames.length}`);

            const missingEndpoints = commandNames.filter(cmd => {
                if (cmd === 'hifive') return !ANIME_GIF_API['highfive'];
                if (cmd === 'grouphug') return !ANIME_GIF_API['hug'];
                if (cmd === 'peck') return !ANIME_GIF_API['kiss'];
                if (cmd === 'greet' || cmd === 'bye') return !ANIME_GIF_API['wave'];
                if (cmd === 'sad') return !ANIME_GIF_API['cry'];
                if (cmd === 'nom') return !ANIME_GIF_API['bite'];
                return !ANIME_GIF_API[cmd];
            });

            if (missingEndpoints.length > 0) {
                logger.warn(`Commands missing API endpoints: ${missingEndpoints.join(', ')}`);
            }

            logger.info('Testing API endpoints...');
            const testedEndpoints = new Set();
            const results = await Promise.allSettled(
                commandNames.map(async cmd => {
                    try {
                        let endpoint = ANIME_GIF_API[cmd];
                        if (cmd === 'hifive') endpoint = ANIME_GIF_API['highfive'];
                        if (cmd === 'grouphug') endpoint = ANIME_GIF_API['hug'];
                        if (cmd === 'peck') endpoint = ANIME_GIF_API['kiss'];
                        if (cmd === 'greet' || cmd === 'bye') endpoint = ANIME_GIF_API['wave'];
                        if (cmd === 'sad') endpoint = ANIME_GIF_API['cry'];
                        if (cmd === 'nom') endpoint = ANIME_GIF_API['bite'];

                        if (!endpoint || testedEndpoints.has(endpoint)) {
                            return { command: cmd, skipped: true };
                        }
                        testedEndpoints.add(endpoint);

                        const url = await fetchAnimeGif(cmd, 1);
                        return { command: cmd, success: !!url };
                    } catch (error) {
                        logger.error(`Failed to test endpoint for ${cmd}:`, error);
                        return { command: cmd, success: false, error: error.message };
                    }
                })
            );

            const failed = results
                .filter(r => r.status === 'fulfilled' && !r.value.skipped && !r.value.success)
                .map(r => r.value.command);

            if (failed.length > 0) {
                logger.warn(`Failed to fetch test GIFs for commands: ${failed.join(', ')}`);
                logger.warn('These commands may not work properly.');

                results
                    .filter(r => r.status === 'fulfilled' && !r.value.success)
                    .forEach(r => {
                        logger.error(`${r.value.command} error:`, r.value.error);
                    });
            }

            const workingEndpoints = results
                .filter(r => r.status === 'fulfilled' && r.value.value.success)
                .length;

            logger.info(`Successfully tested ${workingEndpoints} API endpoints`);
            return workingEndpoints > 0;
        } catch (error) {
            logger.error('Failed to initialize reactions commands:', error);
            logger.error('Stack trace:', error.stack);
            return false;
        }
    }
};

// Cleanup timers for caches
setInterval(() => {
    const now = Date.now();
    let usersPurged = 0, gifsPurged = 0;

    for (const [key, data] of userCache.entries()) {
        if (now - data.timestamp > USER_CACHE_TIMEOUT) {
            userCache.delete(key);
            usersPurged++;
        }
    }

    for (const [key, data] of gifCache.entries()) {
        if (now - data.timestamp > GIF_CACHE_TIMEOUT) {
            gifCache.delete(key);
            gifsPurged++;
        }
    }

    if (usersPurged > 0 || gifsPurged > 0) {
        logger.debug(`Cache cleanup: Purged ${usersPurged} users and ${gifsPurged} GIFs`);
    }
}, Math.min(USER_CACHE_TIMEOUT, GIF_CACHE_TIMEOUT));

module.exports = {
    commands: reactionCommands,
    category: 'reactions'
};