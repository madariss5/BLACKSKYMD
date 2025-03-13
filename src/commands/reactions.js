const logger = require('../utils/logger');
const axios = require('axios');

// API endpoints (using waifu.pics and additional sources)
const ANIME_GIF_API = {
    hug: 'https://api.waifu.pics/sfw/hug',
    pat: 'https://api.waifu.pics/sfw/pat',
    kiss: 'https://api.waifu.pics/sfw/kiss',
    cuddle: 'https://api.waifu.pics/sfw/cuddle',
    poke: 'https://api.waifu.pics/sfw/poke',
    slap: 'https://api.waifu.pics/sfw/slap',
    blush: 'https://api.waifu.pics/sfw/blush',
    cry: 'https://api.waifu.pics/sfw/cry',
    dance: 'https://api.waifu.pics/sfw/dance',
    smile: 'https://api.waifu.pics/sfw/smile',
    wave: 'https://api.waifu.pics/sfw/wave',
    boop: 'https://api.waifu.pics/sfw/boop',
    tickle: 'https://api.waifu.pics/sfw/tickle',
    laugh: 'https://api.waifu.pics/sfw/laugh',
    wink: 'https://api.waifu.pics/sfw/wink',
    // Adding missing reaction endpoints
    punch: 'https://api.waifu.pics/sfw/kick', // Using kick as alternative for punch
    bonk: 'https://api.waifu.pics/sfw/bonk',
    pout: 'https://api.waifu.pics/sfw/pout',
    smug: 'https://api.waifu.pics/sfw/smug',
    run: 'https://api.waifu.pics/sfw/run',
    sleep: 'https://api.waifu.pics/sfw/sleep',
    panic: 'https://api.waifu.pics/sfw/panic',
    facepalm: 'https://api.waifu.pics/sfw/facepalm'
};

// Helper function to validate mentions
function validateMention(mention) {
    return mention && typeof mention === 'string' && mention.includes('@');
}

// Helper function to fetch anime GIFs with retries
async function fetchAnimeGif(type, retries = 3) {
    try {
        const endpoint = ANIME_GIF_API[type];
        if (!endpoint) {
            logger.error(`Invalid reaction type: ${type}`);
            return null;
        }

        logger.info(`Fetching gif for type: ${type} from endpoint: ${endpoint}`);

        let lastError;
        for (let i = 0; i < retries; i++) {
            try {
                const response = await axios.get(endpoint);
                logger.debug('API Response:', {
                    status: response.status,
                    data: response.data
                });
                return response.data.url;
            } catch (error) {
                lastError = error;
                logger.warn(`Retry ${i + 1}/${retries} failed for ${type} GIF:`, error.message);
                await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s between retries
            }
        }

        throw lastError;
    } catch (error) {
        logger.error(`Error fetching ${type} GIF after ${retries} retries:`, error.message);
        return null;
    }
}

// Helper function to send reaction message
async function sendReactionMessage(sock, sender, target, type, gifUrl, emoji) {
    try {
        // Get the chat context (either group or private chat)
        const chatJid = sender.includes('@g.us') ? sender : (sender.split('@')[0] + '@s.whatsapp.net');
        const isGroup = chatJid.includes('@g.us');
        
        // Extract the sender's name without the "@xxxx" part
        const senderName = sender.includes('@g.us') 
            ? 'You' // In group chat, it's "You" from the bot's perspective
            : sender.split('@')[0];
            
        const targetName = target ? target.split('@')[0] : null;

        let message;
        if (target) {
            if (!validateMention(target)) {
                await sock.sendMessage(chatJid, {
                    text: `❌ Please mention a valid user to ${type}`
                });
                return;
            }
            message = `${senderName} ${type}s ${targetName} ${emoji}`;
        } else {
            message = `${senderName} ${type}s ${emoji}`;
        }

        logger.debug(`Sending reaction message: ${message} to ${chatJid}`);

        // Prepare mentions array only if we're in a group chat
        const mentions = (isGroup && target) ? [target] : undefined;

        if (gifUrl) {
            await sock.sendMessage(chatJid, {
                image: { url: gifUrl },
                caption: message,
                mentions: mentions
            });
        } else {
            await sock.sendMessage(chatJid, { 
                text: message,
                mentions: mentions
            });
        }
    } catch (error) {
        logger.error('Error sending reaction message:', error);
        logger.error('Error details:', error.stack);
        
        // Try to determine the correct JID to send the error message
        const errorJid = sender.includes('@g.us') ? sender : sender;
        await sock.sendMessage(errorJid, { text: `❌ Error sending ${type} reaction` });
    }
}

// Export commands
const reactionCommands = {
    async hug(sock, sender, args) {
        try {
            const target = args[0];
            // Determine the correct JID to send messages to
            const chatJid = sender.includes('@g.us') ? sender : sender;
            
            if (!target) {
                await sock.sendMessage(chatJid, { text: '🤗 Please mention someone to hug' });
                return;
            }
            const gifUrl = await fetchAnimeGif('hug');
            await sendReactionMessage(sock, sender, target, 'hug', gifUrl, '🤗');
        } catch (error) {
            logger.error('Error in hug command:', error);
            const errorJid = sender.includes('@g.us') ? sender : sender;
            await sock.sendMessage(errorJid, { text: '❌ Error executing hug command' });
        }
    },

    async pat(sock, sender, args) {
        const target = args[0];
        if (!target) {
            await sock.sendMessage(sender, { text: '👋 Please mention someone to pat' });
            return;
        }
        const gifUrl = await fetchAnimeGif('pat');
        await sendReactionMessage(sock, sender, target, 'pat', gifUrl, '👋');
    },

    async kiss(sock, sender, args) {
        const target = args[0];
        if (!target) {
            await sock.sendMessage(sender, { text: '💋 Please mention someone to kiss' });
            return;
        }
        const gifUrl = await fetchAnimeGif('kiss');
        await sendReactionMessage(sock, sender, target, 'kiss', gifUrl, '💋');
    },

    async cuddle(sock, sender, args) {
        const target = args[0];
        if (!target) {
            await sock.sendMessage(sender, { text: '🤗 Please mention someone to cuddle' });
            return;
        }
        const gifUrl = await fetchAnimeGif('cuddle');
        await sendReactionMessage(sock, sender, target, 'cuddle', gifUrl, '🤗');
    },

    async poke(sock, sender, args) {
        const target = args[0];
        if (!target) {
            await sock.sendMessage(sender, { text: '👉 Please mention someone to poke' });
            return;
        }
        const gifUrl = await fetchAnimeGif('poke');
        await sendReactionMessage(sock, sender, target, 'poke', gifUrl, '👉');
    },

    async slap(sock, sender, args) {
        const target = args[0];
        if (!target) {
            await sock.sendMessage(sender, { text: '👋 Please mention someone to slap' });
            return;
        }
        const gifUrl = await fetchAnimeGif('slap');
        await sendReactionMessage(sock, sender, target, 'slap', gifUrl, '👋');
    },

    async tickle(sock, sender, args) {
        const target = args[0];
        if (!target) {
            await sock.sendMessage(sender, { text: '🤗 Please mention someone to tickle' });
            return;
        }
        const gifUrl = await fetchAnimeGif('tickle');
        await sendReactionMessage(sock, sender, target, 'tickle', gifUrl, '🤗');
    },

    async boop(sock, sender, args) {
        const target = args[0];
        if (!target) {
            await sock.sendMessage(sender, { text: '👉 Please mention someone to boop' });
            return;
        }
        const gifUrl = await fetchAnimeGif('boop');
        await sendReactionMessage(sock, sender, target, 'boop', gifUrl, '👉');
    },

    async blush(sock, sender) {
        const gifUrl = await fetchAnimeGif('blush');
        await sendReactionMessage(sock, sender, null, 'blush', gifUrl, '😊');
    },

    async cry(sock, sender) {
        const gifUrl = await fetchAnimeGif('cry');
        await sendReactionMessage(sock, sender, null, 'cry', gifUrl, '😢');
    },

    async dance(sock, sender) {
        const gifUrl = await fetchAnimeGif('dance');
        await sendReactionMessage(sock, sender, null, 'dance', gifUrl, '💃');
    },

    async laugh(sock, sender) {
        const gifUrl = await fetchAnimeGif('laugh');
        await sendReactionMessage(sock, sender, null, 'laugh', gifUrl, '😂');
    },

    async smile(sock, sender) {
        const gifUrl = await fetchAnimeGif('smile');
        await sendReactionMessage(sock, sender, null, 'smile', gifUrl, '😊');
    },

    async wave(sock, sender) {
        try {
            const gifUrl = await fetchAnimeGif('wave');
            await sendReactionMessage(sock, sender, null, 'wave', gifUrl, '👋');
        } catch (error) {
            logger.error('Error in wave command:', error);
            const errorJid = sender.includes('@g.us') ? sender : sender;
            await sock.sendMessage(errorJid, { text: '❌ Error executing wave command' });
        }
    },

    async wink(sock, sender, args) {
        const target = args[0];
        const gifUrl = await fetchAnimeGif('wink');
        await sendReactionMessage(sock, sender, target, 'wink', gifUrl, '😉');
    },

    async grouphug(sock, sender) {
        const gifUrl = await fetchAnimeGif('hug');
        await sendReactionMessage(sock, sender, null, 'grouphug', gifUrl, '🤗');
    },

    async punch(sock, sender, args) {
        const target = args[0];
        if (!target) {
            await sock.sendMessage(sender, { text: '👊 Please mention someone to punch' });
            return;
        }
        const gifUrl = await fetchAnimeGif('punch');
        await sendReactionMessage(sock, sender, target, 'punch', gifUrl, '👊');
    },

    async bonk(sock, sender, args) {
        const target = args[0];
        if (!target) {
            await sock.sendMessage(sender, { text: '🔨 Please mention someone to bonk' });
            return;
        }
        const gifUrl = await fetchAnimeGif('bonk');
        await sendReactionMessage(sock, sender, target, 'bonk', gifUrl, '🔨');
    },

    async pout(sock, sender) {
        const gifUrl = await fetchAnimeGif('pout');
        await sendReactionMessage(sock, sender, null, 'pout', gifUrl, '😤');
    },

    async smug(sock, sender) {
        const gifUrl = await fetchAnimeGif('smug');
        await sendReactionMessage(sock, sender, null, 'smug', gifUrl, '😏');
    },

    async run(sock, sender) {
        const gifUrl = await fetchAnimeGif('run');
        await sendReactionMessage(sock, sender, null, 'run', gifUrl, '🏃');
    },

    async sleep(sock, sender) {
        const gifUrl = await fetchAnimeGif('sleep');
        await sendReactionMessage(sock, sender, null, 'sleep', gifUrl, '😴');
    },

    async panic(sock, sender) {
        const gifUrl = await fetchAnimeGif('panic');
        await sendReactionMessage(sock, sender, null, 'panic', gifUrl, '😱');
    },

    async facepalm(sock, sender) {
        const gifUrl = await fetchAnimeGif('facepalm');
        await sendReactionMessage(sock, sender, null, 'facepalm', gifUrl, '🤦');
    },

    // Initialize and test API connection
    async init() {
        try {
            logger.info('Initializing reactions command handler...');

            // Log available commands
            const availableCommands = Object.keys(ANIME_GIF_API);
            logger.info(`Available reaction commands: ${availableCommands.join(', ')}`);

            // Test each API endpoint
            logger.info('Testing API endpoints...');
            const results = await Promise.allSettled(
                availableCommands.map(async cmd => {
                    const url = await fetchAnimeGif(cmd, 1);
                    return { command: cmd, success: !!url };
                })
            );

            const failed = results
                .filter(r => r.status === 'fulfilled' && !r.value.success)
                .map(r => r.value.command);

            if (failed.length > 0) {
                logger.warn(`Failed to fetch test GIFs for commands: ${failed.join(', ')}`);
                return false;
            }

            logger.info('Successfully tested all API endpoints');
            return true;
        } catch (error) {
            logger.error('Failed to initialize reactions commands:', error);
            return false;
        }
    }
};

module.exports = {
    commands: reactionCommands,
    category: 'reactions'
};