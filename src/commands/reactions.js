const logger = require('../utils/logger');
const axios = require('axios');

// API endpoints
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
    bonk: 'https://api.waifu.pics/sfw/bonk',
    punch: 'https://api.waifu.pics/sfw/punch',
    wink: 'https://api.waifu.pics/sfw/wink',
    pout: 'https://api.waifu.pics/sfw/pout',
    smug: 'https://api.waifu.pics/sfw/smug',
    run: 'https://api.waifu.pics/sfw/run',
    sleep: 'https://api.waifu.pics/sfw/sleep',
    panic: 'https://api.waifu.pics/sfw/panic',
    facepalm: 'https://api.waifu.pics/sfw/facepalm',
    tickle: 'https://api.waifu.pics/sfw/tickle',
    boop: 'https://api.waifu.pics/sfw/boop',
    grouphug: 'https://api.waifu.pics/sfw/hug' // Using hug as a placeholder for grouphug
};

// Helper function to fetch anime GIFs
async function fetchAnimeGif(type) {
    try {
        const endpoint = ANIME_GIF_API[type];
        if (!endpoint) {
            throw new Error('Invalid reaction type');
        }
        const response = await axios.get(endpoint);
        return response.data.url;
    } catch (error) {
        logger.error(`Error fetching ${type} GIF:`, error);
        return null;
    }
}

const reactionCommands = {

    // Positive Reactions
    async hug(sock, sender, args) {
        const target = args[0];
        if (!target) {
            await sock.sendMessage(sender, { text: '🤗 Please mention someone to hug' });
            return;
        }
        try {
            const gifUrl = await fetchAnimeGif('hug');
            if (gifUrl) {
                await sock.sendMessage(sender, {
                    text: `${sender.split('@')[0]} hugs ${target} warmly! 🤗`,
                    image: { url: gifUrl }
                });
            } else {
                await sock.sendMessage(sender, { text: `${sender.split('@')[0]} hugs ${target} warmly! 🤗` });
            }
        } catch (error) {
            logger.error('Error in hug command:', error);
            await sock.sendMessage(sender, { text: `${sender.split('@')[0]} hugs ${target} warmly! 🤗` });
        }
    },

    async pat(sock, sender, args) {
        const target = args[0];
        if (!target) {
            await sock.sendMessage(sender, { text: '👋 Please mention someone to pat' });
            return;
        }
        try {
            const gifUrl = await this.fetchAnimeGif('pat');
            if (gifUrl) {
                await sock.sendMessage(sender, {
                    text: `${sender.split('@')[0]} pats ${target} gently! 👋`,
                    image: { url: gifUrl }
                });
            } else {
                await sock.sendMessage(sender, { text: `${sender.split('@')[0]} pats ${target} gently! 👋` });
            }
        } catch (error) {
            logger.error('Error in pat command:', error);
            await sock.sendMessage(sender, { text: `${sender.split('@')[0]} pats ${target} gently! 👋` });
        }
    },

    async kiss(sock, sender, args) {
        const target = args[0];
        if (!target) {
            await sock.sendMessage(sender, { text: '💋 Please mention someone to kiss' });
            return;
        }
        try {
            const gifUrl = await this.fetchAnimeGif('kiss');
            if (gifUrl) {
                await sock.sendMessage(sender, {
                    text: `${sender.split('@')[0]} kisses ${target}! 💋`,
                    image: { url: gifUrl }
                });
            } else {
                await sock.sendMessage(sender, { text: `${sender.split('@')[0]} kisses ${target}! 💋` });
            }
        } catch (error) {
            logger.error('Error in kiss command:', error);
            await sock.sendMessage(sender, { text: `${sender.split('@')[0]} kisses ${target}! 💋` });
        }
    },

    async cuddle(sock, sender, args) {
        const target = args[0];
        if (!target) {
            await sock.sendMessage(sender, { text: '🤗 Please mention someone to cuddle' });
            return;
        }
        try {
            const gifUrl = await this.fetchAnimeGif('cuddle');
            if (gifUrl) {
                await sock.sendMessage(sender, {
                    text: `${sender.split('@')[0]} cuddles with ${target}! 🤗`,
                    image: { url: gifUrl }
                });
            } else {
                await sock.sendMessage(sender, { text: `${sender.split('@')[0]} cuddles with ${target}! 🤗` });
            }
        } catch (error) {
            logger.error('Error in cuddle command:', error);
            await sock.sendMessage(sender, { text: `${sender.split('@')[0]} cuddles with ${target}! 🤗` });
        }
    },

    // Playful Reactions
    async poke(sock, sender, args) {
        const target = args[0];
        if (!target) {
            await sock.sendMessage(sender, { text: '👉 Please mention someone to poke' });
            return;
        }
        try {
            const gifUrl = await this.fetchAnimeGif('poke');
            if (gifUrl) {
                await sock.sendMessage(sender, {
                    text: `${sender.split('@')[0]} pokes ${target}! 👉`,
                    image: { url: gifUrl }
                });
            } else {
                await sock.sendMessage(sender, { text: `${sender.split('@')[0]} pokes ${target}! 👉` });
            }
        } catch (error) {
            logger.error('Error in poke command:', error);
            await sock.sendMessage(sender, { text: `${sender.split('@')[0]} pokes ${target}! 👉` });
        }
    },

    async tickle(sock, sender, args) {
        const target = args[0];
        if (!target) {
            await sock.sendMessage(sender, { text: '🤣 Please mention someone to tickle' });
            return;
        }
        try {
            const gifUrl = await this.fetchAnimeGif('tickle');
            if (gifUrl) {
                await sock.sendMessage(sender, {
                    text: `${sender.split('@')[0]} tickles ${target}! 🤣`,
                    image: { url: gifUrl }
                });
            } else {
                await sock.sendMessage(sender, { text: `${sender.split('@')[0]} tickles ${target}! 🤣` });
            }
        } catch (error) {
            logger.error('Error in tickle command:', error);
            await sock.sendMessage(sender, { text: `${sender.split('@')[0]} tickles ${target}! 🤣` });
        }
    },

    async boop(sock, sender, args) {
        const target = args[0];
        if (!target) {
            await sock.sendMessage(sender, { text: '👆 Please mention someone to boop' });
            return;
        }
        try {
            const gifUrl = await this.fetchAnimeGif('boop');
            if (gifUrl) {
                await sock.sendMessage(sender, {
                    text: `${sender.split('@')[0]} boops ${target}! 👆`,
                    image: { url: gifUrl }
                });
            } else {
                await sock.sendMessage(sender, { text: `${sender.split('@')[0]} boops ${target}! 👆` });
            }
        } catch (error) {
            logger.error('Error in boop command:', error);
            await sock.sendMessage(sender, { text: `${sender.split('@')[0]} boops ${target}! 👆` });
        }
    },


    // Emotional Reactions
    async blush(sock, sender) {
        try {
            const gifUrl = await this.fetchAnimeGif('blush');
            if (gifUrl) {
                await sock.sendMessage(sender, {
                    text: `${sender.split('@')[0]} blushes! 😊`,
                    image: { url: gifUrl }
                });
            } else {
                await sock.sendMessage(sender, { text: `${sender.split('@')[0]} blushes! 😊` });
            }
        } catch (error) {
            logger.error('Error in blush command:', error);
            await sock.sendMessage(sender, { text: `${sender.split('@')[0]} blushes! 😊` });
        }
    },

    async cry(sock, sender) {
        try {
            const gifUrl = await this.fetchAnimeGif('cry');
            if (gifUrl) {
                await sock.sendMessage(sender, {
                    text: `${sender.split('@')[0]} starts crying! 😢`,
                    image: { url: gifUrl }
                });
            } else {
                await sock.sendMessage(sender, { text: `${sender.split('@')[0]} starts crying! 😢` });
            }
        } catch (error) {
            logger.error('Error in cry command:', error);
            await sock.sendMessage(sender, { text: `${sender.split('@')[0]} starts crying! 😢` });
        }
    },

    async dance(sock, sender) {
        try {
            const gifUrl = await this.fetchAnimeGif('dance');
            if (gifUrl) {
                await sock.sendMessage(sender, {
                    text: `${sender.split('@')[0]} starts dancing! 💃`,
                    image: { url: gifUrl }
                });
            } else {
                await sock.sendMessage(sender, { text: `${sender.split('@')[0]} starts dancing! 💃` });
            }
        } catch (error) {
            logger.error('Error in dance command:', error);
            await sock.sendMessage(sender, { text: `${sender.split('@')[0]} starts dancing! 💃` });
        }
    },

    async laugh(sock, sender) {
        try {
            const gifUrl = await this.fetchAnimeGif('smile'); // Using smile as a placeholder
            if (gifUrl) {
                await sock.sendMessage(sender, {
                    text: `${sender.split('@')[0]} laughs out loud! 😆`,
                    image: { url: gifUrl }
                });
            } else {
                await sock.sendMessage(sender, { text: `${sender.split('@')[0]} laughs out loud! 😆` });
            }
        } catch (error) {
            logger.error('Error in laugh command:', error);
            await sock.sendMessage(sender, { text: `${sender.split('@')[0]} laughs out loud! 😆` });
        }
    },

    // Aggressive Reactions
    async slap(sock, sender, args) {
        const target = args[0];
        if (!target) {
            await sock.sendMessage(sender, { text: '👋 Please mention someone to slap' });
            return;
        }
        try {
            const gifUrl = await this.fetchAnimeGif('slap');
            if (gifUrl) {
                await sock.sendMessage(sender, {
                    text: `${sender.split('@')[0]} slaps ${target}! 👋`,
                    image: { url: gifUrl }
                });
            } else {
                await sock.sendMessage(sender, { text: `${sender.split('@')[0]} slaps ${target}! 👋` });
            }
        } catch (error) {
            logger.error('Error in slap command:', error);
            await sock.sendMessage(sender, { text: `${sender.split('@')[0]} slaps ${target}! 👋` });
        }
    },

    async punch(sock, sender, args) {
        const target = args[0];
        if (!target) {
            await sock.sendMessage(sender, { text: '👊 Please mention someone to punch' });
            return;
        }
        try {
            const gifUrl = await this.fetchAnimeGif('punch');
            if (gifUrl) {
                await sock.sendMessage(sender, {
                    text: `${sender.split('@')[0]} punches ${target}! 👊`,
                    image: { url: gifUrl }
                });
            } else {
                await sock.sendMessage(sender, { text: `${sender.split('@')[0]} punches ${target}! 👊` });
            }
        } catch (error) {
            logger.error('Error in punch command:', error);
            await sock.sendMessage(sender, { text: `${sender.split('@')[0]} punches ${target}! 👊` });
        }
    },

    async bonk(sock, sender, args) {
        const target = args[0];
        if (!target) {
            await sock.sendMessage(sender, { text: '🔨 Please mention someone to bonk' });
            return;
        }
        try {
            const gifUrl = await this.fetchAnimeGif('bonk');
            if (gifUrl) {
                await sock.sendMessage(sender, {
                    text: `${sender.split('@')[0]} bonks ${target}! 🔨`,
                    image: { url: gifUrl }
                });
            } else {
                await sock.sendMessage(sender, { text: `${sender.split('@')[0]} bonks ${target}! 🔨` });
            }
        } catch (error) {
            logger.error('Error in bonk command:', error);
            await sock.sendMessage(sender, { text: `${sender.split('@')[0]} bonks ${target}! 🔨` });
        }
    },

    // Complex Emotions
    async pout(sock, sender) {
        try {
            const gifUrl = await this.fetchAnimeGif('pout');
            if (gifUrl) {
                await sock.sendMessage(sender, {
                    text: `${sender.split('@')[0]} pouts! 😤`,
                    image: { url: gifUrl }
                });
            } else {
                await sock.sendMessage(sender, { text: `${sender.split('@')[0]} pouts! 😤` });
            }
        } catch (error) {
            logger.error('Error in pout command:', error);
            await sock.sendMessage(sender, { text: `${sender.split('@')[0]} pouts! 😤` });
        }
    },

    async smug(sock, sender) {
        try {
            const gifUrl = await this.fetchAnimeGif('smug');
            if (gifUrl) {
                await sock.sendMessage(sender, {
                    text: `${sender.split('@')[0]} looks smug! 😏`,
                    image: { url: gifUrl }
                });
            } else {
                await sock.sendMessage(sender, { text: `${sender.split('@')[0]} looks smug! 😏` });
            }
        } catch (error) {
            logger.error('Error in smug command:', error);
            await sock.sendMessage(sender, { text: `${sender.split('@')[0]} looks smug! 😏` });
        }
    },

    async wink(sock, sender, args) {
        const target = args[0];
        if (!target) {
            await sock.sendMessage(sender, { text: '😉 Please mention someone to wink at' });
            return;
        }
        try {
            const gifUrl = await this.fetchAnimeGif('wink');
            if (gifUrl) {
                await sock.sendMessage(sender, {
                    text: `${sender.split('@')[0]} winks at ${target}! 😉`,
                    image: { url: gifUrl }
                });
            } else {
                await sock.sendMessage(sender, { text: `${sender.split('@')[0]} winks at ${target}! 😉` });
            }
        } catch (error) {
            logger.error('Error in wink command:', error);
            await sock.sendMessage(sender, { text: `${sender.split('@')[0]} winks at ${target}! 😉` });
        }
    },

    // Group Reactions
    async grouphug(sock, sender) {
        try {
            const gifUrl = await this.fetchAnimeGif('grouphug');
            if (gifUrl) {
                await sock.sendMessage(sender, {
                    text: `${sender.split('@')[0]} hugs everyone! 🤗`,
                    image: { url: gifUrl }
                });
            } else {
                await sock.sendMessage(sender, { text: `${sender.split('@')[0]} hugs everyone! 🤗` });
            }
        } catch (error) {
            logger.error('Error in grouphug command:', error);
            await sock.sendMessage(sender, { text: `${sender.split('@')[0]} hugs everyone! 🤗` });
        }
    },

    async wave(sock, sender) {
        try {
            const gifUrl = await this.fetchAnimeGif('wave');
            if (gifUrl) {
                await sock.sendMessage(sender, {
                    text: `${sender.split('@')[0]} waves at everyone! 👋`,
                    image: { url: gifUrl }
                });
            } else {
                await sock.sendMessage(sender, { text: `${sender.split('@')[0]} waves at everyone! 👋` });
            }
        } catch (error) {
            logger.error('Error in wave command:', error);
            await sock.sendMessage(sender, { text: `${sender.split('@')[0]} waves at everyone! 👋` });
        }
    },

    // Action Reactions
    async run(sock, sender) {
        try {
            const gifUrl = await this.fetchAnimeGif('run');
            if (gifUrl) {
                await sock.sendMessage(sender, {
                    text: `${sender.split('@')[0]} starts running! 🏃`,
                    image: { url: gifUrl }
                });
            } else {
                await sock.sendMessage(sender, { text: `${sender.split('@')[0]} starts running! 🏃` });
            }
        } catch (error) {
            logger.error('Error in run command:', error);
            await sock.sendMessage(sender, { text: `${sender.split('@')[0]} starts running! 🏃` });
        }
    },

    async sleep(sock, sender) {
        try {
            const gifUrl = await this.fetchAnimeGif('sleep');
            if (gifUrl) {
                await sock.sendMessage(sender, {
                    text: `${sender.split('@')[0]} falls asleep! 😴`,
                    image: { url: gifUrl }
                });
            } else {
                await sock.sendMessage(sender, { text: `${sender.split('@')[0]} falls asleep! 😴` });
            }
        } catch (error) {
            logger.error('Error in sleep command:', error);
            await sock.sendMessage(sender, { text: `${sender.split('@')[0]} falls asleep! 😴` });
        }
    },

    async panic(sock, sender) {
        try {
            const gifUrl = await this.fetchAnimeGif('panic');
            if (gifUrl) {
                await sock.sendMessage(sender, {
                    text: `${sender.split('@')[0]} starts panicking! 😱`,
                    image: { url: gifUrl }
                });
            } else {
                await sock.sendMessage(sender, { text: `${sender.split('@')[0]} starts panicking! 😱` });
            }
        } catch (error) {
            logger.error('Error in panic command:', error);
            await sock.sendMessage(sender, { text: `${sender.split('@')[0]} starts panicking! 😱` });
        }
    },

    async facepalm(sock, sender) {
        try {
            const gifUrl = await this.fetchAnimeGif('facepalm');
            if (gifUrl) {
                await sock.sendMessage(sender, {
                    text: `${sender.split('@')[0]} facepalms! 🤦`,
                    image: { url: gifUrl }
                });
            } else {
                await sock.sendMessage(sender, { text: `${sender.split('@')[0]} facepalms! 🤦` });
            }
        } catch (error) {
            logger.error('Error in facepalm command:', error);
            await sock.sendMessage(sender, { text: `${sender.split('@')[0]} facepalms! 🤦` });
        }
    }
};

module.exports = {
    commands: reactionCommands,
    category: 'reactions',
    async init() {
        try {
            logger.info('Initializing reactions command handler...');
            return true;
        } catch (error) {
            logger.error('Failed to initialize reactions commands:', error);
            return false;
        }
    }
};