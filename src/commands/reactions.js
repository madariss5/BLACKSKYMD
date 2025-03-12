const logger = require('../utils/logger');
const axios = require('axios');

// API endpoints
// The Walking Dead GIF sources
const TWD_GIF_API = {
    // Original commands with TWD alternatives
    hug: 'https://api.gify.com/v1/gifs/random?api_key=dc6zaTOxFJmzC&tag=walking+dead+hug',
    pat: 'https://api.gify.com/v1/gifs/random?api_key=dc6zaTOxFJmzC&tag=walking+dead+pat',
    kiss: 'https://api.gify.com/v1/gifs/random?api_key=dc6zaTOxFJmzC&tag=walking+dead+kiss',
    cuddle: 'https://api.gify.com/v1/gifs/random?api_key=dc6zaTOxFJmzC&tag=walking+dead+cuddle',
    poke: 'https://api.gify.com/v1/gifs/random?api_key=dc6zaTOxFJmzC&tag=walking+dead+poke',
    slap: 'https://api.gify.com/v1/gifs/random?api_key=dc6zaTOxFJmzC&tag=walking+dead+slap',
    punch: 'https://api.gify.com/v1/gifs/random?api_key=dc6zaTOxFJmzC&tag=walking+dead+punch',
    kick: 'https://api.gify.com/v1/gifs/random?api_key=dc6zaTOxFJmzC&tag=walking+dead+kick',
    wave: 'https://api.gify.com/v1/gifs/random?api_key=dc6zaTOxFJmzC&tag=walking+dead+wave',
    happy: 'https://api.gify.com/v1/gifs/random?api_key=dc6zaTOxFJmzC&tag=walking+dead+happy',
    sad: 'https://api.gify.com/v1/gifs/random?api_key=dc6zaTOxFJmzC&tag=walking+dead+sad',
    angry: 'https://api.gify.com/v1/gifs/random?api_key=dc6zaTOxFJmzC&tag=walking+dead+angry',
    scared: 'https://api.gify.com/v1/gifs/random?api_key=dc6zaTOxFJmzC&tag=walking+dead+scared',
    cry: 'https://api.gify.com/v1/gifs/random?api_key=dc6zaTOxFJmzC&tag=walking+dead+cry',
    laugh: 'https://api.gify.com/v1/gifs/random?api_key=dc6zaTOxFJmzC&tag=walking+dead+laugh',
    dance: 'https://api.gify.com/v1/gifs/random?api_key=dc6zaTOxFJmzC&tag=walking+dead+dance',
    stare: 'https://api.gify.com/v1/gifs/random?api_key=dc6zaTOxFJmzC&tag=walking+dead+stare',
    kill: 'https://api.gify.com/v1/gifs/random?api_key=dc6zaTOxFJmzC&tag=walking+dead+kill',
    shocked: 'https://api.gify.com/v1/gifs/random?api_key=dc6zaTOxFJmzC&tag=walking+dead+shocked',
    love: 'https://api.gify.com/v1/gifs/random?api_key=dc6zaTOxFJmzC&tag=walking+dead+love',
};

const ANIME_GIF_API = {
    // Original endpoints
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
    grouphug: 'https://api.waifu.pics/sfw/hug', // Using hug as a placeholder for grouphug
    
    // New reaction endpoints - additional 40 anime reactions
    // Using appropriate endpoints from waifu.pics API, with fallbacks to similar emotions when needed
    
    // Positive Reactions
    handhold: 'https://api.waifu.pics/sfw/handhold',
    highfive: 'https://api.waifu.pics/sfw/highfive',
    nom: 'https://api.waifu.pics/sfw/nom',
    bite: 'https://api.waifu.pics/sfw/bite',
    glomp: 'https://api.waifu.pics/sfw/glomp',
    kill: 'https://api.waifu.pics/sfw/kill',
    happy: 'https://api.waifu.pics/sfw/happy',
    waifu: 'https://api.waifu.pics/sfw/waifu',
    
    // Action Reactions
    cringe: 'https://api.waifu.pics/sfw/cringe',
    kick: 'https://api.waifu.pics/sfw/kick',
    yeet: 'https://api.waifu.pics/sfw/yeet',
    neko: 'https://api.waifu.pics/sfw/neko',
    shinobu: 'https://api.waifu.pics/sfw/shinobu',
    megumin: 'https://api.waifu.pics/sfw/megumin',
    lick: 'https://api.waifu.pics/sfw/lick',
    bully: 'https://api.waifu.pics/sfw/bully',
    
    // Extended Emotions
    awoo: 'https://api.waifu.pics/sfw/awoo',
    thumbsup: 'https://api.waifu.pics/sfw/smile', // Using smile as fallback
    thinking: 'https://api.waifu.pics/sfw/think',
    confused: 'https://api.waifu.pics/sfw/pout', // Using pout as fallback
    nod: 'https://api.waifu.pics/sfw/smile', // Using smile as fallback
    shake: 'https://api.waifu.pics/sfw/wave', // Using wave as fallback
    shrug: 'https://api.waifu.pics/sfw/shrug',
    stare: 'https://api.waifu.pics/sfw/stare',
    
    // Additional Expressions
    poke2: 'https://api.waifu.pics/sfw/poke', // Alternative poke
    amazing: 'https://api.waifu.pics/sfw/smile', // Using smile as fallback
    bleh: 'https://api.waifu.pics/sfw/blush', // Using blush as fallback
    hmph: 'https://api.waifu.pics/sfw/pout', // Using pout as fallback
    wow: 'https://api.waifu.pics/sfw/happy', // Using happy as fallback
    cool: 'https://api.waifu.pics/sfw/smile', // Using smile as fallback
    love: 'https://api.waifu.pics/sfw/kiss', // Using kiss as fallback
    nervous: 'https://api.waifu.pics/sfw/panic', // Using panic as fallback
    
    // Complex Actions
    headpat: 'https://api.waifu.pics/sfw/pat', // Alternative pat
    tackle: 'https://api.waifu.pics/sfw/glomp', // Using glomp as fallback
    shoot: 'https://api.waifu.pics/sfw/kill', // Using kill as fallback
    throw: 'https://api.waifu.pics/sfw/yeet', // Using yeet as fallback
    hide: 'https://api.waifu.pics/sfw/panic', // Using panic as fallback
    greet: 'https://api.waifu.pics/sfw/wave', // Using wave as fallback
    shocked: 'https://api.waifu.pics/sfw/panic', // Using panic as fallback
    scared: 'https://api.waifu.pics/sfw/cry' // Using cry as fallback
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

// Helper function to fetch Walking Dead GIFs
async function fetchTWDGif(type) {
    try {
        const endpoint = TWD_GIF_API[type];
        if (!endpoint) {
            // If type not found in Walking Dead GIFs, return null
            return null;
        }
        const response = await axios.get(endpoint);
        // The GIPHY API structure is different, so we adjust how we get the URL
        return response.data.data.images?.original?.url || null;
    } catch (error) {
        logger.error(`Error fetching Walking Dead ${type} GIF:`, error);
        return null;
    }
}

// Helper to get either anime or Walking Dead GIF based on preference
async function getGif(type, preferWalkingDead = false) {
    // We try to get the preferred type first, then fall back to the other
    if (preferWalkingDead) {
        const twdGif = await fetchTWDGif(type);
        return twdGif || await fetchAnimeGif(type);
    } else {
        const animeGif = await fetchAnimeGif(type);
        return animeGif || await fetchTWDGif(type);
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
            // Randomly decide whether to use Walking Dead or anime GIF (25% chance for Walking Dead)
            const useWalkingDead = Math.random() < 0.25;
            const gifUrl = await getGif('hug', useWalkingDead);
            
            let message = `${sender.split('@')[0]} hugs ${target} warmly! 🤗`;
            if (useWalkingDead) {
                message += ' [Walking Dead Style]';
            }
            
            if (gifUrl) {
                await sock.sendMessage(sender, {
                    text: message,
                    image: { url: gifUrl }
                });
            } else {
                await sock.sendMessage(sender, { text: message });
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
            const gifUrl = await fetchAnimeGif('pat');
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
            const gifUrl = await fetchAnimeGif('kiss');
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
            const gifUrl = await fetchAnimeGif('cuddle');
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
            const gifUrl = await fetchAnimeGif('poke');
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
            const gifUrl = await fetchAnimeGif('tickle');
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
            const gifUrl = await fetchAnimeGif('boop');
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
            const gifUrl = await fetchAnimeGif('blush');
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
            const gifUrl = await fetchAnimeGif('cry');
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
            const gifUrl = await fetchAnimeGif('dance');
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
            const gifUrl = await fetchAnimeGif('smile'); // Using smile as a placeholder
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
            const gifUrl = await fetchAnimeGif('slap');
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
            const gifUrl = await fetchAnimeGif('punch');
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
            const gifUrl = await fetchAnimeGif('bonk');
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
            const gifUrl = await fetchAnimeGif('pout');
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
            const gifUrl = await fetchAnimeGif('smug');
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
            const gifUrl = await fetchAnimeGif('wink');
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
            const gifUrl = await fetchAnimeGif('grouphug');
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
            const gifUrl = await fetchAnimeGif('wave');
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
            const gifUrl = await fetchAnimeGif('run');
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
            const gifUrl = await fetchAnimeGif('sleep');
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
            const gifUrl = await fetchAnimeGif('panic');
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
            const gifUrl = await fetchAnimeGif('facepalm');
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
    // 1. Handhold
    async handhold(sock, sender, args) {
        const target = args[0];
        if (!target) {
            await sock.sendMessage(sender, { text: '🤝 Please mention someone to hold hands with' });
            return;
        }
        try {
            const gifUrl = await fetchAnimeGif('handhold');
            if (gifUrl) {
                await sock.sendMessage(sender, {
                    text: `${sender.split('@')[0]} holds hands with ${target}! 🤝`,
                    image: { url: gifUrl }
                });
            } else {
                await sock.sendMessage(sender, { text: `${sender.split('@')[0]} holds hands with ${target}! 🤝` });
            }
        } catch (error) {
            logger.error('Error in handhold command:', error);
            await sock.sendMessage(sender, { text: `${sender.split('@')[0]} holds hands with ${target}! 🤝` });
        }
    },

    // 2. Highfive
    async highfive(sock, sender, args) {
        const target = args[0];
        if (!target) {
            await sock.sendMessage(sender, { text: '✋ Please mention someone to high five' });
            return;
        }
        try {
            const gifUrl = await fetchAnimeGif('highfive');
            if (gifUrl) {
                await sock.sendMessage(sender, {
                    text: `${sender.split('@')[0]} high fives ${target}! ✋`,
                    image: { url: gifUrl }
                });
            } else {
                await sock.sendMessage(sender, { text: `${sender.split('@')[0]} high fives ${target}! ✋` });
            }
        } catch (error) {
            logger.error('Error in highfive command:', error);
            await sock.sendMessage(sender, { text: `${sender.split('@')[0]} high fives ${target}! ✋` });
        }
    },

    // 3. Nom
    async nom(sock, sender, args) {
        const target = args[0];
        if (!target) {
            await sock.sendMessage(sender, { text: '🍽️ Please mention someone or something to nom' });
            return;
        }
        try {
            const gifUrl = await fetchAnimeGif('nom');
            if (gifUrl) {
                await sock.sendMessage(sender, {
                    text: `${sender.split('@')[0]} noms ${target}! 🍽️`,
                    image: { url: gifUrl }
                });
            } else {
                await sock.sendMessage(sender, { text: `${sender.split('@')[0]} noms ${target}! 🍽️` });
            }
        } catch (error) {
            logger.error('Error in nom command:', error);
            await sock.sendMessage(sender, { text: `${sender.split('@')[0]} noms ${target}! 🍽️` });
        }
    },

    // 4. Bite
    async bite(sock, sender, args) {
        const target = args[0];
        if (!target) {
            await sock.sendMessage(sender, { text: '😬 Please mention someone to bite' });
            return;
        }
        try {
            const gifUrl = await fetchAnimeGif('bite');
            if (gifUrl) {
                await sock.sendMessage(sender, {
                    text: `${sender.split('@')[0]} bites ${target}! 😬`,
                    image: { url: gifUrl }
                });
            } else {
                await sock.sendMessage(sender, { text: `${sender.split('@')[0]} bites ${target}! 😬` });
            }
        } catch (error) {
            logger.error('Error in bite command:', error);
            await sock.sendMessage(sender, { text: `${sender.split('@')[0]} bites ${target}! 😬` });
        }
    },

    // 5. Glomp
    async glomp(sock, sender, args) {
        const target = args[0];
        if (!target) {
            await sock.sendMessage(sender, { text: '🫂 Please mention someone to glomp' });
            return;
        }
        try {
            const gifUrl = await fetchAnimeGif('glomp');
            if (gifUrl) {
                await sock.sendMessage(sender, {
                    text: `${sender.split('@')[0]} glomps ${target}! 🫂`,
                    image: { url: gifUrl }
                });
            } else {
                await sock.sendMessage(sender, { text: `${sender.split('@')[0]} glomps ${target}! 🫂` });
            }
        } catch (error) {
            logger.error('Error in glomp command:', error);
            await sock.sendMessage(sender, { text: `${sender.split('@')[0]} glomps ${target}! 🫂` });
        }
    },

    // 6. Kill
    async kill(sock, sender, args) {
        const target = args[0];
        if (!target) {
            await sock.sendMessage(sender, { text: '💀 Please mention someone to kill (just for fun!)' });
            return;
        }
        try {
            const gifUrl = await fetchAnimeGif('kill');
            if (gifUrl) {
                await sock.sendMessage(sender, {
                    text: `${sender.split('@')[0]} kills ${target}! 💀 (Don't worry, it's just an anime reaction!)`,
                    image: { url: gifUrl }
                });
            } else {
                await sock.sendMessage(sender, { text: `${sender.split('@')[0]} kills ${target}! 💀 (Don't worry, it's just an anime reaction!)` });
            }
        } catch (error) {
            logger.error('Error in kill command:', error);
            await sock.sendMessage(sender, { text: `${sender.split('@')[0]} kills ${target}! 💀 (Don't worry, it's just an anime reaction!)` });
        }
    },

    // 7. Happy
    async happy(sock, sender) {
        try {
            const gifUrl = await fetchAnimeGif('happy');
            if (gifUrl) {
                await sock.sendMessage(sender, {
                    text: `${sender.split('@')[0]} is super happy! 😄`,
                    image: { url: gifUrl }
                });
            } else {
                await sock.sendMessage(sender, { text: `${sender.split('@')[0]} is super happy! 😄` });
            }
        } catch (error) {
            logger.error('Error in happy command:', error);
            await sock.sendMessage(sender, { text: `${sender.split('@')[0]} is super happy! 😄` });
        }
    },

    // 8. Waifu
    async waifu(sock, sender) {
        try {
            const gifUrl = await fetchAnimeGif('waifu');
            if (gifUrl) {
                await sock.sendMessage(sender, {
                    text: `${sender.split('@')[0]} shares a cute waifu! 💖`,
                    image: { url: gifUrl }
                });
            } else {
                await sock.sendMessage(sender, { text: `${sender.split('@')[0]} shares a cute waifu! 💖` });
            }
        } catch (error) {
            logger.error('Error in waifu command:', error);
            await sock.sendMessage(sender, { text: `${sender.split('@')[0]} shares a cute waifu! 💖` });
        }
    },

    // 9. Cringe
    async cringe(sock, sender) {
        try {
            const gifUrl = await fetchAnimeGif('cringe');
            if (gifUrl) {
                await sock.sendMessage(sender, {
                    text: `${sender.split('@')[0]} cringes! 😬`,
                    image: { url: gifUrl }
                });
            } else {
                await sock.sendMessage(sender, { text: `${sender.split('@')[0]} cringes! 😬` });
            }
        } catch (error) {
            logger.error('Error in cringe command:', error);
            await sock.sendMessage(sender, { text: `${sender.split('@')[0]} cringes! 😬` });
        }
    },

    // 10. Kick
    async kick(sock, sender, args) {
        const target = args[0];
        if (!target) {
            await sock.sendMessage(sender, { text: '🦵 Please mention someone to kick' });
            return;
        }
        try {
            const gifUrl = await fetchAnimeGif('kick');
            if (gifUrl) {
                await sock.sendMessage(sender, {
                    text: `${sender.split('@')[0]} kicks ${target}! 🦵`,
                    image: { url: gifUrl }
                });
            } else {
                await sock.sendMessage(sender, { text: `${sender.split('@')[0]} kicks ${target}! 🦵` });
            }
        } catch (error) {
            logger.error('Error in kick command:', error);
            await sock.sendMessage(sender, { text: `${sender.split('@')[0]} kicks ${target}! 🦵` });
        }
    },

    // 11. Yeet
    async yeet(sock, sender, args) {
        const target = args[0];
        if (!target) {
            await sock.sendMessage(sender, { text: '🚀 Please mention someone to yeet' });
            return;
        }
        try {
            const gifUrl = await fetchAnimeGif('yeet');
            if (gifUrl) {
                await sock.sendMessage(sender, {
                    text: `${sender.split('@')[0]} yeets ${target}! 🚀`,
                    image: { url: gifUrl }
                });
            } else {
                await sock.sendMessage(sender, { text: `${sender.split('@')[0]} yeets ${target}! 🚀` });
            }
        } catch (error) {
            logger.error('Error in yeet command:', error);
            await sock.sendMessage(sender, { text: `${sender.split('@')[0]} yeets ${target}! 🚀` });
        }
    },

    // 12. Neko
    async neko(sock, sender) {
        try {
            const gifUrl = await fetchAnimeGif('neko');
            if (gifUrl) {
                await sock.sendMessage(sender, {
                    text: `${sender.split('@')[0]} shares a cute neko! 🐱`,
                    image: { url: gifUrl }
                });
            } else {
                await sock.sendMessage(sender, { text: `${sender.split('@')[0]} shares a cute neko! 🐱` });
            }
        } catch (error) {
            logger.error('Error in neko command:', error);
            await sock.sendMessage(sender, { text: `${sender.split('@')[0]} shares a cute neko! 🐱` });
        }
    },

    // 13. Shinobu
    async shinobu(sock, sender) {
        try {
            const gifUrl = await fetchAnimeGif('shinobu');
            if (gifUrl) {
                await sock.sendMessage(sender, {
                    text: `${sender.split('@')[0]} shares a Shinobu image! ✨`,
                    image: { url: gifUrl }
                });
            } else {
                await sock.sendMessage(sender, { text: `${sender.split('@')[0]} shares a Shinobu image! ✨` });
            }
        } catch (error) {
            logger.error('Error in shinobu command:', error);
            await sock.sendMessage(sender, { text: `${sender.split('@')[0]} shares a Shinobu image! ✨` });
        }
    },

    // 14. Megumin
    async megumin(sock, sender) {
        try {
            const gifUrl = await fetchAnimeGif('megumin');
            if (gifUrl) {
                await sock.sendMessage(sender, {
                    text: `${sender.split('@')[0]} shares a Megumin image! 💥`,
                    image: { url: gifUrl }
                });
            } else {
                await sock.sendMessage(sender, { text: `${sender.split('@')[0]} shares a Megumin image! 💥` });
            }
        } catch (error) {
            logger.error('Error in megumin command:', error);
            await sock.sendMessage(sender, { text: `${sender.split('@')[0]} shares a Megumin image! 💥` });
        }
    },

    // 15. Lick
    async lick(sock, sender, args) {
        const target = args[0];
        if (!target) {
            await sock.sendMessage(sender, { text: '👅 Please mention someone to lick' });
            return;
        }
        try {
            const gifUrl = await fetchAnimeGif('lick');
            if (gifUrl) {
                await sock.sendMessage(sender, {
                    text: `${sender.split('@')[0]} licks ${target}! 👅`,
                    image: { url: gifUrl }
                });
            } else {
                await sock.sendMessage(sender, { text: `${sender.split('@')[0]} licks ${target}! 👅` });
            }
        } catch (error) {
            logger.error('Error in lick command:', error);
            await sock.sendMessage(sender, { text: `${sender.split('@')[0]} licks ${target}! 👅` });
        }
    },

    // 16. Bully
    async bully(sock, sender, args) {
        const target = args[0];
        if (!target) {
            await sock.sendMessage(sender, { text: '😈 Please mention someone to bully' });
            return;
        }
        try {
            const gifUrl = await fetchAnimeGif('bully');
            if (gifUrl) {
                await sock.sendMessage(sender, {
                    text: `${sender.split('@')[0]} bullies ${target}! 😈`,
                    image: { url: gifUrl }
                });
            } else {
                await sock.sendMessage(sender, { text: `${sender.split('@')[0]} bullies ${target}! 😈` });
            }
        } catch (error) {
            logger.error('Error in bully command:', error);
            await sock.sendMessage(sender, { text: `${sender.split('@')[0]} bullies ${target}! 😈` });
        }
    },

    // 17. Awoo
    async awoo(sock, sender) {
        try {
            const gifUrl = await fetchAnimeGif('awoo');
            if (gifUrl) {
                await sock.sendMessage(sender, {
                    text: `${sender.split('@')[0]} awoos! 🐺`,
                    image: { url: gifUrl }
                });
            } else {
                await sock.sendMessage(sender, { text: `${sender.split('@')[0]} awoos! 🐺` });
            }
        } catch (error) {
            logger.error('Error in awoo command:', error);
            await sock.sendMessage(sender, { text: `${sender.split('@')[0]} awoos! 🐺` });
        }
    },

    // 18. Thumbsup
    async thumbsup(sock, sender) {
        try {
            const gifUrl = await fetchAnimeGif('thumbsup');
            if (gifUrl) {
                await sock.sendMessage(sender, {
                    text: `${sender.split('@')[0]} gives a thumbs up! 👍`,
                    image: { url: gifUrl }
                });
            } else {
                await sock.sendMessage(sender, { text: `${sender.split('@')[0]} gives a thumbs up! 👍` });
            }
        } catch (error) {
            logger.error('Error in thumbsup command:', error);
            await sock.sendMessage(sender, { text: `${sender.split('@')[0]} gives a thumbs up! 👍` });
        }
    },

    // 19. Thinking
    async thinking(sock, sender) {
        try {
            const gifUrl = await fetchAnimeGif('thinking');
            if (gifUrl) {
                await sock.sendMessage(sender, {
                    text: `${sender.split('@')[0]} is thinking... 🤔`,
                    image: { url: gifUrl }
                });
            } else {
                await sock.sendMessage(sender, { text: `${sender.split('@')[0]} is thinking... 🤔` });
            }
        } catch (error) {
            logger.error('Error in thinking command:', error);
            await sock.sendMessage(sender, { text: `${sender.split('@')[0]} is thinking... 🤔` });
        }
    },

    // 20. Confused
    async confused(sock, sender) {
        try {
            const gifUrl = await fetchAnimeGif('confused');
            if (gifUrl) {
                await sock.sendMessage(sender, {
                    text: `${sender.split('@')[0]} is confused! 😕`,
                    image: { url: gifUrl }
                });
            } else {
                await sock.sendMessage(sender, { text: `${sender.split('@')[0]} is confused! 😕` });
            }
        } catch (error) {
            logger.error('Error in confused command:', error);
            await sock.sendMessage(sender, { text: `${sender.split('@')[0]} is confused! 😕` });
        }
    },

    // 21. Nodding
    async nod(sock, sender) {
        try {
            const gifUrl = await fetchAnimeGif('nod');
            if (gifUrl) {
                await sock.sendMessage(sender, {
                    text: `${sender.split('@')[0]} nods in agreement! 😌`,
                    image: { url: gifUrl }
                });
            } else {
                await sock.sendMessage(sender, { text: `${sender.split('@')[0]} nods in agreement! 😌` });
            }
        } catch (error) {
            logger.error('Error in nod command:', error);
            await sock.sendMessage(sender, { text: `${sender.split('@')[0]} nods in agreement! 😌` });
        }
    },

    // 22. Shaking Head
    async shake(sock, sender) {
        try {
            const gifUrl = await fetchAnimeGif('shake');
            if (gifUrl) {
                await sock.sendMessage(sender, {
                    text: `${sender.split('@')[0]} shakes their head! 😔`,
                    image: { url: gifUrl }
                });
            } else {
                await sock.sendMessage(sender, { text: `${sender.split('@')[0]} shakes their head! 😔` });
            }
        } catch (error) {
            logger.error('Error in shake command:', error);
            await sock.sendMessage(sender, { text: `${sender.split('@')[0]} shakes their head! 😔` });
        }
    },

    // 23. Shrug
    async shrug(sock, sender) {
        try {
            const gifUrl = await fetchAnimeGif('shrug');
            if (gifUrl) {
                await sock.sendMessage(sender, {
                    text: `${sender.split('@')[0]} shrugs! ¯\\_(ツ)_/¯`,
                    image: { url: gifUrl }
                });
            } else {
                await sock.sendMessage(sender, { text: `${sender.split('@')[0]} shrugs! ¯\\_(ツ)_/¯` });
            }
        } catch (error) {
            logger.error('Error in shrug command:', error);
            await sock.sendMessage(sender, { text: `${sender.split('@')[0]} shrugs! ¯\\_(ツ)_/¯` });
        }
    },

    // 24. Stare
    async stare(sock, sender, args) {
        const target = args[0] ? args[0] : "intensely";
        try {
            const gifUrl = await fetchAnimeGif('stare');
            if (gifUrl) {
                await sock.sendMessage(sender, {
                    text: `${sender.split('@')[0]} stares ${target !== "intensely" ? "at " + target : "intensely"}! 👀`,
                    image: { url: gifUrl }
                });
            } else {
                await sock.sendMessage(sender, { text: `${sender.split('@')[0]} stares ${target !== "intensely" ? "at " + target : "intensely"}! 👀` });
            }
        } catch (error) {
            logger.error('Error in stare command:', error);
            await sock.sendMessage(sender, { text: `${sender.split('@')[0]} stares ${target !== "intensely" ? "at " + target : "intensely"}! 👀` });
        }
    },

    // 25. Poke2 (Alternative poke)
    async poke2(sock, sender, args) {
        const target = args[0];
        if (!target) {
            await sock.sendMessage(sender, { text: '👈 Please mention someone to super poke' });
            return;
        }
        try {
            const gifUrl = await fetchAnimeGif('poke2');
            if (gifUrl) {
                await sock.sendMessage(sender, {
                    text: `${sender.split('@')[0]} super pokes ${target}! 👈`,
                    image: { url: gifUrl }
                });
            } else {
                await sock.sendMessage(sender, { text: `${sender.split('@')[0]} super pokes ${target}! 👈` });
            }
        } catch (error) {
            logger.error('Error in poke2 command:', error);
            await sock.sendMessage(sender, { text: `${sender.split('@')[0]} super pokes ${target}! 👈` });
        }
    },

    // 26. Amazing
    async amazing(sock, sender) {
        try {
            const gifUrl = await fetchAnimeGif('amazing');
            if (gifUrl) {
                await sock.sendMessage(sender, {
                    text: `${sender.split('@')[0]} thinks that's amazing! ✨`,
                    image: { url: gifUrl }
                });
            } else {
                await sock.sendMessage(sender, { text: `${sender.split('@')[0]} thinks that's amazing! ✨` });
            }
        } catch (error) {
            logger.error('Error in amazing command:', error);
            await sock.sendMessage(sender, { text: `${sender.split('@')[0]} thinks that's amazing! ✨` });
        }
    },

    // 27. Bleh (Tongue out)
    async bleh(sock, sender) {
        try {
            const gifUrl = await fetchAnimeGif('bleh');
            if (gifUrl) {
                await sock.sendMessage(sender, {
                    text: `${sender.split('@')[0]} sticks their tongue out! 😝`,
                    image: { url: gifUrl }
                });
            } else {
                await sock.sendMessage(sender, { text: `${sender.split('@')[0]} sticks their tongue out! 😝` });
            }
        } catch (error) {
            logger.error('Error in bleh command:', error);
            await sock.sendMessage(sender, { text: `${sender.split('@')[0]} sticks their tongue out! 😝` });
        }
    },

    // 28. Hmph
    async hmph(sock, sender) {
        try {
            const gifUrl = await fetchAnimeGif('hmph');
            if (gifUrl) {
                await sock.sendMessage(sender, {
                    text: `${sender.split('@')[0]} goes hmph! 😤`,
                    image: { url: gifUrl }
                });
            } else {
                await sock.sendMessage(sender, { text: `${sender.split('@')[0]} goes hmph! 😤` });
            }
        } catch (error) {
            logger.error('Error in hmph command:', error);
            await sock.sendMessage(sender, { text: `${sender.split('@')[0]} goes hmph! 😤` });
        }
    },

    // 29. Wow
    async wow(sock, sender) {
        try {
            const gifUrl = await fetchAnimeGif('wow');
            if (gifUrl) {
                await sock.sendMessage(sender, {
                    text: `${sender.split('@')[0]} is amazed! 😲`,
                    image: { url: gifUrl }
                });
            } else {
                await sock.sendMessage(sender, { text: `${sender.split('@')[0]} is amazed! 😲` });
            }
        } catch (error) {
            logger.error('Error in wow command:', error);
            await sock.sendMessage(sender, { text: `${sender.split('@')[0]} is amazed! 😲` });
        }
    },

    // 30. Cool
    async cool(sock, sender) {
        try {
            const gifUrl = await fetchAnimeGif('cool');
            if (gifUrl) {
                await sock.sendMessage(sender, {
                    text: `${sender.split('@')[0]} is looking cool! 😎`,
                    image: { url: gifUrl }
                });
            } else {
                await sock.sendMessage(sender, { text: `${sender.split('@')[0]} is looking cool! 😎` });
            }
        } catch (error) {
            logger.error('Error in cool command:', error);
            await sock.sendMessage(sender, { text: `${sender.split('@')[0]} is looking cool! 😎` });
        }
    },

    // 31. Love
    async love(sock, sender, args) {
        const target = args[0] ? args[0] : "everyone";
        try {
            const gifUrl = await fetchAnimeGif('love');
            if (gifUrl) {
                await sock.sendMessage(sender, {
                    text: `${sender.split('@')[0]} loves ${target}! ❤️`,
                    image: { url: gifUrl }
                });
            } else {
                await sock.sendMessage(sender, { text: `${sender.split('@')[0]} loves ${target}! ❤️` });
            }
        } catch (error) {
            logger.error('Error in love command:', error);
            await sock.sendMessage(sender, { text: `${sender.split('@')[0]} loves ${target}! ❤️` });
        }
    },

    // 32. Nervous
    async nervous(sock, sender) {
        try {
            const gifUrl = await fetchAnimeGif('nervous');
            if (gifUrl) {
                await sock.sendMessage(sender, {
                    text: `${sender.split('@')[0]} is feeling nervous! 😰`,
                    image: { url: gifUrl }
                });
            } else {
                await sock.sendMessage(sender, { text: `${sender.split('@')[0]} is feeling nervous! 😰` });
            }
        } catch (error) {
            logger.error('Error in nervous command:', error);
            await sock.sendMessage(sender, { text: `${sender.split('@')[0]} is feeling nervous! 😰` });
        }
    },

    // 33. Headpat (Alternative pat)
    async headpat(sock, sender, args) {
        const target = args[0];
        if (!target) {
            await sock.sendMessage(sender, { text: '✋ Please mention someone to headpat' });
            return;
        }
        try {
            const gifUrl = await fetchAnimeGif('headpat');
            if (gifUrl) {
                await sock.sendMessage(sender, {
                    text: `${sender.split('@')[0]} gives ${target} a gentle headpat! ✋`,
                    image: { url: gifUrl }
                });
            } else {
                await sock.sendMessage(sender, { text: `${sender.split('@')[0]} gives ${target} a gentle headpat! ✋` });
            }
        } catch (error) {
            logger.error('Error in headpat command:', error);
            await sock.sendMessage(sender, { text: `${sender.split('@')[0]} gives ${target} a gentle headpat! ✋` });
        }
    },

    // 34. Tackle
    async tackle(sock, sender, args) {
        const target = args[0];
        if (!target) {
            await sock.sendMessage(sender, { text: '💥 Please mention someone to tackle' });
            return;
        }
        try {
            const gifUrl = await fetchAnimeGif('tackle');
            if (gifUrl) {
                await sock.sendMessage(sender, {
                    text: `${sender.split('@')[0]} tackles ${target}! 💥`,
                    image: { url: gifUrl }
                });
            } else {
                await sock.sendMessage(sender, { text: `${sender.split('@')[0]} tackles ${target}! 💥` });
            }
        } catch (error) {
            logger.error('Error in tackle command:', error);
            await sock.sendMessage(sender, { text: `${sender.split('@')[0]} tackles ${target}! 💥` });
        }
    },

    // 35. Shoot
    async shoot(sock, sender, args) {
        const target = args[0];
        if (!target) {
            await sock.sendMessage(sender, { text: '🔫 Please mention someone to shoot (as a joke!)' });
            return;
        }
        try {
            const gifUrl = await fetchAnimeGif('shoot');
            if (gifUrl) {
                await sock.sendMessage(sender, {
                    text: `${sender.split('@')[0]} shoots ${target}! 🔫 (Just as an anime reaction, all in good fun!)`,
                    image: { url: gifUrl }
                });
            } else {
                await sock.sendMessage(sender, { text: `${sender.split('@')[0]} shoots ${target}! 🔫 (Just as an anime reaction, all in good fun!)` });
            }
        } catch (error) {
            logger.error('Error in shoot command:', error);
            await sock.sendMessage(sender, { text: `${sender.split('@')[0]} shoots ${target}! 🔫 (Just as an anime reaction, all in good fun!)` });
        }
    },

    // 36. Throw
    async throw(sock, sender, args) {
        const target = args[0] ? args[0] : "something";
        try {
            const gifUrl = await fetchAnimeGif('throw');
            if (gifUrl) {
                await sock.sendMessage(sender, {
                    text: `${sender.split('@')[0]} throws ${target}! 🚀`,
                    image: { url: gifUrl }
                });
            } else {
                await sock.sendMessage(sender, { text: `${sender.split('@')[0]} throws ${target}! 🚀` });
            }
        } catch (error) {
            logger.error('Error in throw command:', error);
            await sock.sendMessage(sender, { text: `${sender.split('@')[0]} throws ${target}! 🚀` });
        }
    },

    // 37. Hide
    async hide(sock, sender) {
        try {
            const gifUrl = await fetchAnimeGif('hide');
            if (gifUrl) {
                await sock.sendMessage(sender, {
                    text: `${sender.split('@')[0]} hides! 🙈`,
                    image: { url: gifUrl }
                });
            } else {
                await sock.sendMessage(sender, { text: `${sender.split('@')[0]} hides! 🙈` });
            }
        } catch (error) {
            logger.error('Error in hide command:', error);
            await sock.sendMessage(sender, { text: `${sender.split('@')[0]} hides! 🙈` });
        }
    },

    // 38. Greet
    async greet(sock, sender, args) {
        const target = args[0] ? args[0] : "everyone";
        try {
            const gifUrl = await fetchAnimeGif('greet');
            if (gifUrl) {
                await sock.sendMessage(sender, {
                    text: `${sender.split('@')[0]} greets ${target}! 👋`,
                    image: { url: gifUrl }
                });
            } else {
                await sock.sendMessage(sender, { text: `${sender.split('@')[0]} greets ${target}! 👋` });
            }
        } catch (error) {
            logger.error('Error in greet command:', error);
            await sock.sendMessage(sender, { text: `${sender.split('@')[0]} greets ${target}! 👋` });
        }
    },

    // 39. Shocked
    async shocked(sock, sender) {
        try {
            const gifUrl = await fetchAnimeGif('shocked');
            if (gifUrl) {
                await sock.sendMessage(sender, {
                    text: `${sender.split('@')[0]} is shocked! 😱`,
                    image: { url: gifUrl }
                });
            } else {
                await sock.sendMessage(sender, { text: `${sender.split('@')[0]} is shocked! 😱` });
            }
        } catch (error) {
            logger.error('Error in shocked command:', error);
            await sock.sendMessage(sender, { text: `${sender.split('@')[0]} is shocked! 😱` });
        }
    },

    // 40. Scared
    async scared(sock, sender) {
        try {
            const gifUrl = await fetchAnimeGif('scared');
            if (gifUrl) {
                await sock.sendMessage(sender, {
                    text: `${sender.split('@')[0]} is scared! 😨`,
                    image: { url: gifUrl }
                });
            } else {
                await sock.sendMessage(sender, { text: `${sender.split('@')[0]} is scared! 😨` });
            }
        } catch (error) {
            logger.error('Error in scared command:', error);
            await sock.sendMessage(sender, { text: `${sender.split('@')[0]} is scared! 😨` });
        }
    },

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