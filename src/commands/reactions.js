const logger = require('../utils/logger');
const axios = require('axios');

// API endpoint (using waifu.pics)
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
    wave: 'https://api.waifu.pics/sfw/wave'
};

// Helper function to fetch anime GIFs
async function fetchAnimeGif(type) {
    try {
        const endpoint = ANIME_GIF_API[type];
        if (!endpoint) {
            logger.error(`Invalid reaction type: ${type}`);
            return null;
        }

        logger.info(`Fetching gif for type: ${type} from endpoint: ${endpoint}`);
        const response = await axios.get(endpoint);

        logger.debug('API Response:', {
            status: response.status,
            data: response.data,
            headers: response.headers
        });

        return response.data.url;
    } catch (error) {
        logger.error(`Error fetching ${type} GIF:`, error.message);
        return null;
    }
}

// Helper function to send reaction message
async function sendReactionMessage(sock, sender, target, type, gifUrl, emoji) {
    try {
        const senderName = sender.split('@')[0];
        const message = target ? 
            `${senderName} ${type}s ${target} ${emoji}` :
            `${senderName} ${type}s ${emoji}`;

        logger.debug(`Sending reaction message: ${message}`);

        if (gifUrl) {
            await sock.sendMessage(sender, {
                image: { url: gifUrl },
                caption: message
            });
        } else {
            await sock.sendMessage(sender, { text: message });
        }
    } catch (error) {
        logger.error('Error sending reaction message:', error);
        await sock.sendMessage(sender, { text: `Error sending ${type} reaction.` });
    }
}

// Export commands directly
module.exports = {
    async hug(sock, sender, args) {
        const target = args[0];
        if (!target) {
            await sock.sendMessage(sender, { text: '🤗 Please mention someone to hug' });
            return;
        }
        const gifUrl = await fetchAnimeGif('hug');
        await sendReactionMessage(sock, sender, target, 'hug', gifUrl, '🤗');
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

    async wave(sock, sender) {
        const gifUrl = await fetchAnimeGif('wave');
        await sendReactionMessage(sock, sender, null, 'wave', gifUrl, '👋');
    },

    // Helper method to initialize and test API connection
    async init() {
        try {
            logger.info('Initializing reactions command handler...');

            // Log available commands
            const availableCommands = Object.keys(ANIME_GIF_API);
            logger.info(`Available reaction commands: ${availableCommands.join(', ')}`);

            // Test API connection
            logger.info('Testing API connection...');
            const testGif = await fetchAnimeGif('hug');
            if (testGif) {
                logger.info('Successfully tested API connection');
                return true;
            }
            logger.error('Failed to fetch test GIF');
            return false;
        } catch (error) {
            logger.error('Failed to initialize reactions commands:', error);
            return false;
        }
    }
};