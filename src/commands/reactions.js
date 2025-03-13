const logger = require('../utils/logger');
const axios = require('axios');

// API endpoints (using waifu.pics and additional sources)
const ANIME_GIF_API = {
    // Existing endpoints remain unchanged
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
    punch: 'https://api.waifu.pics/sfw/kick', // Using kick as alternative for punch
    bonk: 'https://api.waifu.pics/sfw/bonk',
    pout: 'https://api.waifu.pics/sfw/pout',
    smug: 'https://api.waifu.pics/sfw/smug',
    run: 'https://api.waifu.pics/sfw/run',
    sleep: 'https://api.waifu.pics/sfw/sleep',
    panic: 'https://api.waifu.pics/sfw/panic',
    facepalm: 'https://api.waifu.pics/sfw/facepalm',
    highfive: 'https://api.waifu.pics/sfw/highfive', // Using handhold for hold
    handhold: 'https://api.waifu.pics/sfw/handhold',
    nom: 'https://api.waifu.pics/sfw/bite', // Using bite for nom
    bite: 'https://api.waifu.pics/sfw/bite',
    glomp: 'https://api.waifu.pics/sfw/glomp',
    kill: 'https://api.waifu.pics/sfw/kill',
    yeet: 'https://api.waifu.pics/sfw/yeet',
    stare: 'https://api.waifu.pics/sfw/stare',
    lick: 'https://api.waifu.pics/sfw/lick',
    feed: 'https://api.waifu.pics/sfw/feed',
    bully: 'https://api.waifu.pics/sfw/bully',
    happy: 'https://api.waifu.pics/sfw/happy',
    sad: 'https://api.waifu.pics/sfw/cry', // Using cry for sad
    angry: 'https://api.waifu.pics/sfw/angry',
    confused: 'https://api.waifu.pics/sfw/confused',
    think: 'https://api.waifu.pics/sfw/think',
    peck: 'https://api.waifu.pics/sfw/kiss', // Using kiss for peck
    greet: 'https://api.waifu.pics/sfw/wave', // Using wave for greet
    salute: 'https://api.waifu.pics/sfw/salute',
    shocked: 'https://api.waifu.pics/sfw/shock',
    shrug: 'https://api.waifu.pics/sfw/shrug',
    nod: 'https://api.waifu.pics/sfw/nod',
    shake: 'https://api.waifu.pics/sfw/shake',
    kick: 'https://api.waifu.pics/sfw/kick',
    throw: 'https://api.waifu.pics/sfw/throw',
    shoot: 'https://api.waifu.pics/sfw/shoot',
    thumbsup: 'https://api.waifu.pics/sfw/thumbsup',
    thumbsdown: 'https://api.waifu.pics/sfw/thumbsdown',
    excited: 'https://api.waifu.pics/sfw/excited',
    lewd: 'https://api.waifu.pics/sfw/lewd',
    bored: 'https://api.waifu.pics/sfw/bored',
    nervous: 'https://api.waifu.pics/sfw/nervous',
    celebrate: 'https://api.waifu.pics/sfw/celebrate',
    dizzy: 'https://api.waifu.pics/sfw/dizzy',
    bye: 'https://api.waifu.pics/sfw/wave', // Using wave for bye
    smack: 'https://api.waifu.pics/sfw/smack',
    nuzzle: 'https://api.waifu.pics/sfw/nuzzle',
    growl: 'https://api.waifu.pics/sfw/growl',
    disgusted: 'https://api.waifu.pics/sfw/disgust',
    scared: 'https://api.waifu.pics/sfw/scared',
    // Alternative commands using existing endpoints
    hifive: 'https://api.waifu.pics/sfw/highfive', // Alternative for highfive
    grouphug: 'https://api.waifu.pics/sfw/hug' // Using hug for grouphug
};

// Helper function to validate mentions
function validateMention(mention) {
    if (!mention || typeof mention !== 'string') return false;

    // Check for common WhatsApp mention formats
    if (mention.includes('@s.whatsapp.net') ||
        mention.includes('@g.us') ||
        /^\d+@/.test(mention)) {
        return true;
    }

    // If it's just a number, assume it's a phone number and add WhatsApp format
    if (/^\d+$/.test(mention)) {
        return true; // It's a valid phone number
    }

    // If it's a message mention tag (potential formats)
    if (mention.startsWith('@') ||
        mention.match(/^[a-zA-Z0-9._-]+$/) ||  // Allow alphanumeric usernames
        mention === 'everyone' ||
        mention === 'all') {
        return true;
    }

    // Default case: try to handle it as a potential mention
    return true;
}

// Helper function to fetch anime GIFs with retries
async function fetchAnimeGif(type, retries = 3) {
    try {
        // Enhanced set of type-specific fallback GIFs (reliable, well-tested GIFs)
        const fallbacks = {
            // Common reactions with high-quality fallbacks
            'hug': 'https://media.tenor.com/images/a9bb4d55b2a08d3a964ddb39c0e96f3d/tenor.gif',
            'pat': 'https://media.tenor.com/images/1d37a873edfeb81a1f5403f4a3bfa185/tenor.gif',
            'kiss': 'https://media.tenor.com/images/02d9cae34993e48ab5bb27763f46b32e/tenor.gif',
            'slap': 'https://media.tenor.com/images/9ea4fb41d066737c0e3f2d626c13f230/tenor.gif',
            'cuddle': 'https://media.tenor.com/images/5603e24395b61245a08fe0299574f1e3/tenor.gif',
            'panic': 'https://media.tenor.com/images/9c42c0f3a448561bdb573049e11c6466/tenor.gif',
            'yeet': 'https://media.tenor.com/images/d88b38c6698c568e7347ef365ae6b348/tenor.gif',
            'sad': 'https://media.tenor.com/images/7e623e17dd8c776eee5c044d4fe8a305/tenor.gif',
            'happy': 'https://media.tenor.com/images/a5cab07318215c706bbdd819fca2b60d/tenor.gif',
            'shoot': 'https://media.tenor.com/images/12cb6396c5c1dd2e9042da1d2f74a551/tenor.gif',
            'punch': 'https://media.tenor.com/images/4f8e6c925e0c4556b9a4417c6e6d3710/tenor.gif',
            'kick': 'https://media.tenor.com/images/4dd99934786573b92d56a6a96d96d99f/tenor.gif',
            'dance': 'https://media.tenor.com/images/81c0b8d3c0617d2a8bf42650b181b97e/tenor.gif',
            'cry': 'https://media.tenor.com/images/e69ebde3631408c200777ebe10f84367/tenor.gif',
            'angry': 'https://media.tenor.com/images/bb33cc1bdd6a9d6a7eff0a5e5bfa7012/tenor.gif',
            'bonk': 'https://media.tenor.com/images/79644a28bfcb95a9c9bd5073235dfa8e/tenor.gif',
            'excited': 'https://media.tenor.com/images/ff7d22e3aa44144810c12bb743a48569/tenor.gif',
            'pout': 'https://media.tenor.com/images/c718238122f3eae93bc96583f89d98f2/tenor.gif',
            'confused': 'https://media.tenor.com/images/f2e7957f59d71bcf8ca3a6fe406a53a5/tenor.gif',
            'bully': 'https://media.tenor.com/images/dd8058fa55f2b208350e00f329cdfa9a/tenor.gif',
            'stare': 'https://media.tenor.com/images/9e6e8f42500512dd18dc99c1d054b909/tenor.gif'
        };

        // Generic fallback for other reactions - must be reliable
        const genericFallback = 'https://media.tenor.com/images/2b9cba7b488142d61559145bf1d406c3/tenor.gif';

        // Get type-specific fallback or use generic
        const fallbackGifUrl = fallbacks[type] || genericFallback;

        const endpoint = ANIME_GIF_API[type];
        if (!endpoint) {
            logger.error(`Invalid reaction type: ${type}`);
            return fallbackGifUrl;
        }

        logger.info(`Fetching gif for type: ${type} from endpoint: ${endpoint}`);

        let lastError;
        for (let i = 0; i < retries; i++) {
            try {
                const response = await axios.get(endpoint);
                if (response.status === 200 && response.data && response.data.url) {
                    // Verify the URL is actually a GIF or animated image format
                    const url = response.data.url;

                    // Simple check to see if the URL has a known animation format extension
                    if (url.toLowerCase().endsWith('.gif') ||
                        url.toLowerCase().endsWith('.webp') ||
                        url.toLowerCase().includes('gif') ||
                        url.toLowerCase().includes('tenor') ||
                        url.toLowerCase().includes('giphy')) {

                        logger.debug(`Successfully fetched ${type} GIF from API: ${url}`);
                        return url;
                    } else {
                        // If the URL doesn't seem to be a GIF, log this and try another API call
                        logger.warn(`Received non-GIF URL for ${type}: ${url}`);

                        // If this is the last retry, return the URL anyway - better to try
                        if (i === retries - 1) {
                            return url;
                        }
                    }
                } else {
                    throw new Error(`Invalid response format for ${type}`);
                }
            } catch (error) {
                lastError = error;
                logger.warn(`Retry ${i + 1}/${retries} failed for ${type} GIF:`, error.message);
                await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s between retries
            }
        }

        logger.warn(`All ${retries} retries failed for ${type} GIF, using fallback`);
        return fallbackGifUrl;
    } catch (error) {
        logger.error(`Error fetching ${type} GIF after ${retries} retries:`, error.message);
        // Return type-specific fallback if available, otherwise generic
        return fallbacks[type] || genericFallback;
    }
}

// Helper function to send reaction message
async function sendReactionMessage(sock, sender, target, type, gifUrl, emoji) {
    try {
        const fallbacks = {
            'happy': 'https://media.tenor.com/images/a5cab07318215c706bbdd819fca2b60d/tenor.gif',
            'sad': 'https://media.tenor.com/images/7e623e17dd8c776eee5c044d4fe8a305/tenor.gif',
            'angry': 'https://media.tenor.com/images/bb33cc1bdd6a9d6a7eff0a5e5bfa7012/tenor.gif',
            'blush': 'https://media.tenor.com/images/cbf38a2e97a348a621207c967a77628a/tenor.gif',
            'dance': 'https://media.tenor.com/images/81c0b8d3c0617d2a8bf42650b181b97e/tenor.gif',
            'laugh': 'https://media.tenor.com/images/82f52b6b3d5ca613116ae1dcae9b1422/tenor.gif',
            'cry': 'https://media.tenor.com/images/e69ebde3631408c200777ebe10f84367/tenor.gif',
            'panic': 'https://media.tenor.com/images/9c42c0f3a448561bdb573049e11c6466/tenor.gif'
        };

        if (!gifUrl ||
            !(gifUrl.toLowerCase().endsWith('.gif') ||
              gifUrl.toLowerCase().endsWith('.webp'))) {
            gifUrl = fallbacks[type] || 'https://media.tenor.com/images/2b9cba7b488142d61559145bf1d406c3/tenor.gif';
        }

        const chatJid = sender.includes('@g.us') ? sender : (sender.split('@')[0] + '@s.whatsapp.net');
        const senderName = sender.includes('@g.us') ? 'You' : sender.split('@')[0];

        let message;
        if (target) {
            if (!validateMention(target)) {
                await sock.sendMessage(chatJid, {
                    text: `❌ Please mention a valid user to ${type}`
                });
                return;
            }

            const targetName = target.startsWith('@') ? target.substring(1) :
                target.includes('@') ? target.split('@')[0] : target;

            message = targetName === 'everyone' || targetName === 'all'
                ? `${senderName} ${type}s everyone ${emoji}`
                : `${senderName} ${type}s ${targetName} ${emoji}`;
        } else {
            // Self-reaction message format
            message = `${senderName} is ${type === 'cry' ? 'crying' :
                type === 'dance' ? 'dancing' :
                    type === 'laugh' ? 'laughing' :
                        type === 'blush' ? 'blushing' :
                            type === 'panic' ? 'panicking' :
                                type === 'smile' ? 'smiling' :
                                    type === 'angry' ? 'angry' :
                                        type === 'sad' ? 'sad' :
                                            type === 'happy' ? 'happy' :
                                                `feeling ${type}`} ${emoji}`;
        }

        const mentions = (chatJid.includes('@g.us') && target && target.includes('@')) ? [target] : undefined;

        await sock.sendMessage(chatJid, {
            image: { url: gifUrl },
            caption: message,
            mentions: mentions
        });
    } catch (error) {
        logger.error('Error sending reaction message:', error);
        const errorJid = sender.includes('@g.us') ? sender : sender;
        await sock.sendMessage(errorJid, { text: `❌ Error sending ${type} reaction` });
    }
}

// Export commands
const reactionCommands = {
    // Base command implementations
    async hug(sock, message, args) {
        try {
            // Extract sender from message object
            const sender = message.key.remoteJid;
            const target = args[0];
            const chatJid = sender.includes('@g.us') ? sender : sender;

            if (!target) {
                await sock.sendMessage(chatJid, { text: '🤗 Please mention someone to hug' });
                return;
            }
            const gifUrl = await fetchAnimeGif('hug');
            await sendReactionMessage(sock, sender, target, 'hug', gifUrl, '🤗');
            return true;
        } catch (error) {
            logger.error('Error in hug command:', error);
            const errorJid = message.key.remoteJid;
            await sock.sendMessage(errorJid, { text: '❌ Error executing hug command' });
            throw error;
        }
    },
    async pat(sock, message, args) {
        // Extract sender from message object
        const sender = message.key.remoteJid;
        const target = args[0];
        if (!target) {
            await sock.sendMessage(sender, { text: '👋 Please mention someone to pat' });
            return;
        }
        const gifUrl = await fetchAnimeGif('pat');
        await sendReactionMessage(sock, sender, target, 'pat', gifUrl, '👋');
    },
    async kiss(sock, message, args) {
        // Extract sender from message object
        const sender = message.key.remoteJid;
        const target = args[0];
        if (!target) {
            await sock.sendMessage(sender, { text: '💋 Please mention someone to kiss' });
            return;
        }
        const gifUrl = await fetchAnimeGif('kiss');
        await sendReactionMessage(sock, sender, target, 'kiss', gifUrl, '💋');
    },
    async cuddle(sock, message, args) {
        // Extract sender from message object
        const sender = message.key.remoteJid;
        const target = args[0];
        if (!target) {
            await sock.sendMessage(sender, { text: '🤗 Please mention someone to cuddle' });
            return;
        }
        const gifUrl = await fetchAnimeGif('cuddle');
        await sendReactionMessage(sock, sender, target, 'cuddle', gifUrl, '🤗');
    },
    async poke(sock, message, args) {
        // Extract sender from message object
        const sender = message.key.remoteJid;
        const target = args[0];
        if (!target) {
            await sock.sendMessage(sender, { text: '👉 Please mention someone to poke' });
            return;
        }
        const gifUrl = await fetchAnimeGif('poke');
        await sendReactionMessage(sock, sender, target, 'poke', gifUrl, '👉');
    },
    async slap(sock, message, args) {
        // Extract sender from message object
        const sender = message.key.remoteJid;
        const target = args[0];
        if (!target) {
            await sock.sendMessage(sender, { text: '👋 Please mention someone to slap' });
            return;
        }
        const gifUrl = await fetchAnimeGif('slap');
        await sendReactionMessage(sock, sender, target, 'slap', gifUrl, '👋');
    },
    async tickle(sock, message, args) {
        // Extract sender from message object
        const sender = message.key.remoteJid;
        const target = args[0];
        if (!target) {
            await sock.sendMessage(sender, { text: '🤗 Please mention someone to tickle' });
            return;
        }
        const gifUrl = await fetchAnimeGif('tickle');
        await sendReactionMessage(sock, sender, target, 'tickle', gifUrl, '🤗');
    },
    async boop(sock, message, args) {
        // Extract sender from message object
        const sender = message.key.remoteJid;
        const target = args[0];
        if (!target) {
            await sock.sendMessage(sender, { text: '👉 Please mention someone to boop' });
            return;
        }
        const gifUrl = await fetchAnimeGif('boop');
        await sendReactionMessage(sock, sender, target, 'boop', gifUrl, '👉');
    },
    async blush(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        const gifUrl = await fetchAnimeGif('blush');
        await sendReactionMessage(sock, sender, target, 'blush', gifUrl, '😊');
    },
    async cry(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        const gifUrl = await fetchAnimeGif('cry');
        await sendReactionMessage(sock, sender, target, 'cry', gifUrl, '😢');
    },
    async dance(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        const gifUrl = await fetchAnimeGif('dance');
        await sendReactionMessage(sock, sender, target, 'dance', gifUrl, '💃');
    },
    async laugh(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        const gifUrl = await fetchAnimeGif('laugh');
        await sendReactionMessage(sock, sender, target, 'laugh', gifUrl, '😂');
    },
    async smile(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        const gifUrl = await fetchAnimeGif('smile');
        await sendReactionMessage(sock, sender, target, 'smile', gifUrl, '😊');
    },
    async wave(sock, message, args) {
        try {
            // Extract sender from message object
            const sender = message.key.remoteJid;
            const target = args[0];
            const gifUrl = await fetchAnimeGif('wave');
            await sendReactionMessage(sock, sender, target, 'wave', gifUrl, '👋');
        } catch (error) {
            logger.error('Error in wave command:', error);
            const errorJid = message.key.remoteJid;
            await sock.sendMessage(errorJid, { text: '❌ Error executing wave command' });
        }
    },
    async wink(sock, message, args) {
        // Extract sender from message object
        const sender = message.key.remoteJid;
        const target = args[0];
        const gifUrl = await fetchAnimeGif('wink');
        await sendReactionMessage(sock, sender, target, 'wink', gifUrl, '😉');
    },
    async grouphug(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        const gifUrl = await fetchAnimeGif('hug');
        await sendReactionMessage(sock, sender, target, 'grouphug', gifUrl, '🤗');
    },
    async punch(sock, message, args) {
        // Extract sender from message object
        const sender = message.key.remoteJid;
        const target = args[0];
        if (!target) {
            await sock.sendMessage(sender, { text: '👊 Please mention someone to punch' });
            return;
        }
        const gifUrl = await fetchAnimeGif('punch');
        await sendReactionMessage(sock, sender, target, 'punch', gifUrl, '👊');
    },
    async bonk(sock, message, args) {
        // Extract sender from message object
        const sender = message.key.remoteJid;
        const target = args[0];
        if (!target) {
            await sock.sendMessage(sender, { text: '🔨 Please mention someone to bonk' });
            return;
        }
        const gifUrl = await fetchAnimeGif('bonk');
        await sendReactionMessage(sock, sender, target, 'bonk', gifUrl, '🔨');
    },
    async pout(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        const gifUrl = await fetchAnimeGif('pout');
        await sendReactionMessage(sock, sender, target, 'pout', gifUrl, '😤');
    },
    async smug(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        const gifUrl = await fetchAnimeGif('smug');
        await sendReactionMessage(sock, sender, target, 'smug', gifUrl, '😏');
    },
    async run(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        const gifUrl = await fetchAnimeGif('run');
        await sendReactionMessage(sock, sender, target, 'run', gifUrl, '🏃');
    },
    async sleep(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        const gifUrl = await fetchAnimeGif('sleep');
        await sendReactionMessage(sock, sender, target, 'sleep', gifUrl, '😴');
    },
    async panic(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        const gifUrl = await fetchAnimeGif('panic');
        await sendReactionMessage(sock, sender, target, 'panic', gifUrl, '😱');
    },
    async facepalm(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        const gifUrl = await fetchAnimeGif('facepalm');
        await sendReactionMessage(sock, sender, target, 'facepalm', gifUrl, '🤦');
    },
    // New commands implementation
    async highfive(sock, message, args) {
        // Extract sender from message object
        const sender = message.key.remoteJid;
        const target = args[0];
        if (!target) {
            await sock.sendMessage(sender, { text: '✋ Please mention someone to high five' });
            return;
        }
        const gifUrl = await fetchAnimeGif('highfive');
        await sendReactionMessage(sock, sender, target, 'highfive', gifUrl, '✋');
    },
    async hold(sock, message, args) {
        // Extract sender from message object
        const sender = message.key.remoteJid;
        const target = args[0];
        if (!target) {
            await sock.sendMessage(sender, { text: '🤝 Please mention someone to hold' });
            return;
        }
        const gifUrl = await fetchAnimeGif('hold');
        await sendReactionMessage(sock, sender, target, 'hold', gifUrl, '🤝');
    },
    async handhold(sock, message, args) {
        // Extract sender from message object
        const sender = message.key.remoteJid;
        const target = args[0];
        if (!target) {
            await sock.sendMessage(sender, { text: '🤝 Please mention someone to hold hands with' });
            return;
        }
        const gifUrl = await fetchAnimeGif('handhold');
        await sendReactionMessage(sock, sender, target, 'handhold', gifUrl, '🤝');
    },
    async nom(sock, message, args) {
        // Extract sender from message object
        const sender = message.key.remoteJid;
        const target = args[0];
        if (!target) {
            await sock.sendMessage(sender, { text: '😋 Please mention someone to nom' });
            return;
        }
        const gifUrl = await fetchAnimeGif('nom');
        await sendReactionMessage(sock, sender, target, 'nom', gifUrl, '😋');
    },
    async bite(sock, message, args) {
        // Extract sender from message object
        const sender = message.key.remoteJid;
        const target = args[0];
        if (!target) {
            await sock.sendMessage(sender, { text: '😬 Please mention someone to bite' });
            return;
        }
        const gifUrl = await fetchAnimeGif('bite');
        await sendReactionMessage(sock, sender, target, 'bite', gifUrl, '😬');
    },
    async glomp(sock, message, args) {
        // Extract sender from message object
        const sender = message.key.remoteJid;
        const target = args[0];
        if (!target) {
            await sock.sendMessage(sender, { text: '💫 Please mention someone to glomp' });
            return;
        }
        const gifUrl = await fetchAnimeGif('glomp');
        await sendReactionMessage(sock, sender, target, 'glomp', gifUrl, '💫');
    },
    async kill(sock, message, args) {
        // Extract sender from message object
        const sender = message.key.remoteJid;
        const target = args[0];
        if (!target) {
            await sock.sendMessage(sender, { text: '💀 Please mention someone to kill (jokingly)' });
            return;
        }
        const gifUrl = await fetchAnimeGif('kill');
        await sendReactionMessage(sock, sender, target, 'kill', gifUrl, '💀');
    },
    async yeet(sock, message, args) {
        // Extract sender from message object
        const sender = message.key.remoteJid;
        const target = args[0];
        if (!target) {
            await sock.sendMessage(sender, { text: '🚀 Please mention someone to yeet' });
            return;
        }
        const gifUrl = await fetchAnimeGif('yeet');
        await sendReactionMessage(sock, sender, target, 'yeet', gifUrl, '🚀');
    },
    async stare(sock, message, args) {
        // Extract sender from message object
        const sender = message.key.remoteJid;
        const target = args[0];
        if (!target) {
            await sock.sendMessage(sender, { text: '👀 Please mention someone to stare at' });
            return;
        }
        const gifUrl = await fetchAnimeGif('stare');
        await sendReactionMessage(sock, sender, target, 'stare', gifUrl, '👀');
    },
    async lick(sock, message, args) {
        // Extract sender from message object
        const sender = message.key.remoteJid;
        const target = args[0];
        if (!target) {
            await sock.sendMessage(sender, { text: '👅 Please mention someone to lick' });
            return;
        }
        const gifUrl = await fetchAnimeGif('lick');
        await sendReactionMessage(sock, sender, target, 'lick', gifUrl, '👅');
    },
    async feed(sock, message, args) {
        // Extract sender from message object
        const sender = message.key.remoteJid;
        const target = args[0];
        if (!target) {
            await sock.sendMessage(sender, { text: '🍽️ Please mention someone to feed' });
            return;
        }
        const gifUrl = await fetchAnimeGif('feed');
        await sendReactionMessage(sock, sender, target, 'feed', gifUrl, '🍽️');
    },
    async bully(sock, message, args) {
        // Extract sender from message object
        const sender = message.key.remoteJid;
        const target = args[0];
        if (!target) {
            await sock.sendMessage(sender, { text: '😈 Please mention someone to bully (playfully)' });
            return;
        }
        const gifUrl = await fetchAnimeGif('bully');
        await sendReactionMessage(sock, sender, target, 'bully', gifUrl, '😈');
    },
    // Solo reactions (no target needed)
    async happy(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0]; // Optional target
        const gifUrl = await fetchAnimeGif('happy');
        await sendReactionMessage(sock, sender, target, 'happy', gifUrl, '😊');
    },
    async sad(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        const gifUrl = await fetchAnimeGif('sad');
        await sendReactionMessage(sock, sender, target, 'sad', gifUrl, '😢');
    },
    async angry(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        const gifUrl = await fetchAnimeGif('angry');
        await sendReactionMessage(sock, sender, target, 'angry', gifUrl, '😠');
    },
    async confused(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        const gifUrl = await fetchAnimeGif('confused');
        await sendReactionMessage(sock, sender, target, 'confused', gifUrl, '😕');
    },
    async think(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        const gifUrl = await fetchAnimeGif('think');
        await sendReactionMessage(sock, sender, target, 'think', gifUrl, '🤔');
    },
    async peck(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        if (!target) {
            await sock.sendMessage(sender, { text: '😘 Please mention someone to peck' });
            return;
        }
        const gifUrl = await fetchAnimeGif('peck');
        await sendReactionMessage(sock, sender, target, 'peck', gifUrl, '😘');
    },
    async greet(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        if (!target) {
            await sock.sendMessage(sender, { text: '👋 Please mention someone to greet' });
            return;
        }
        const gifUrl = await fetchAnimeGif('greet');
        await sendReactionMessage(sock, sender, target, 'greet', gifUrl, '👋');
    },
    async salute(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        if (!target) {
            await sock.sendMessage(sender, { text: '🫡 Please mention someone to salute' });
            return;
        }
        const gifUrl = await fetchAnimeGif('salute');
        await sendReactionMessage(sock, sender, target, 'salute', gifUrl, '🫡');
    },
    async shocked(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        const gifUrl = await fetchAnimeGif('shocked');
        await sendReactionMessage(sock, sender, target, 'shocked', gifUrl, '😱');
    },
    async shrug(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        const gifUrl = await fetchAnimeGif('shrug');
        await sendReactionMessage(sock, sender, target, 'shrug', gifUrl, '🤷');
    },
    async nod(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        const gifUrl = await fetchAnimeGif('nod');
        await sendReactionMessage(sock, sender, target, 'nod', gifUrl, '😌');
    },
    async shake(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        const gifUrl = await fetchAnimeGif('shake');
        await sendReactionMessage(sock, sender, target, 'shake', gifUrl, '😤');
    },
    async kick(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        if (!target) {
            await sock.sendMessage(sender, { text: '🦵 Please mention someone to kick' });
            return;
        }
        const gifUrl = await fetchAnimeGif('kick');
        await sendReactionMessage(sock, sender, target, 'kick', gifUrl, '🦵');
    },
    async throw(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        if (!target) {
            await sock.sendMessage(sender, { text: '🎯 Please mention someone to throw at' });
            return;
        }
        const gifUrl = await fetchAnimeGif('throw');
        await sendReactionMessage(sock, sender, target, 'throw', gifUrl, '🎯');
    },
    async shoot(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        if (!target) {
            await sock.sendMessage(sender, { text: '🔫 Please mention someone to shoot (jokingly)' });
            return;
        }
        const gifUrl = await fetchAnimeGif('shoot');
        await sendReactionMessage(sock, sender, target, 'shoot', gifUrl, '🔫');
    },
    async thumbsup(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        const gifUrl = await fetchAnimeGif('thumbsup');
        await sendReactionMessage(sock, sender, target, 'thumbsup', gifUrl, '👍');
    },
    async thumbsdown(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        const gifUrl = await fetchAnimeGif('thumbsdown');
        await sendReactionMessage(sock, sender, target, 'thumbsdown', gifUrl, '👎');
    },
    async excited(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        const gifUrl = await fetchAnimeGif('excited');
        await sendReactionMessage(sock, sender, target, 'excited', gifUrl, '🤩');
    },
    async lewd(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        const gifUrl = await fetchAnimeGif('lewd');
        await sendReactionMessage(sock, sender, target, 'lewd', gifUrl, '😳');
    },
    async bored(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        const gifUrl = await fetchAnimeGif('bored');
        await sendReactionMessage(sock, sender, target, 'bored', gifUrl, '😑');
    },
    async nervous(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        const gifUrl = await fetchAnimeGif('nervous');
        await sendReactionMessage(sock, sender, target, 'nervous', gifUrl, '😰');
    },
    async celebrate(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        const gifUrl = await fetchAnimeGif('celebrate');
        await sendReactionMessage(sock, sender, target, 'celebrate', gifUrl, '🎉');
    },
    async dizzy(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        const gifUrl = await fetchAnimeGif('dizzy');
        await sendReactionMessage(sock, sender, target, 'dizzy', gifUrl, '💫');
    },
    async bye(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        const gifUrl = await fetchAnimeGif('bye');
        await sendReactionMessage(sock, sender, target, 'bye', gifUrl, '👋');
    },
    async smack(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        if (!target) {
            await sock.sendMessage(sender, { text: '💥 Please mention someone to smack' });
            return;
        }
        const gifUrl = await fetchAnimeGif('smack');
        await sendReactionMessage(sock, sender, target, 'smack', gifUrl, '💥');
    },
    async nuzzle(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        if (!target) {
            await sock.sendMessage(sender, { text: '🥰 Please mention someone to nuzzle' });
            return;
        }
        const gifUrl = await fetchAnimeGif('nuzzle');
        await sendReactionMessage(sock, sender, target, 'nuzzle', gifUrl, '🥰');
    },
    async growl(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        if (!target) {
            await sock.sendMessage(sender, { text: '😾 Please mention someone to growl at' });
            return;
        }
        const gifUrl = await fetchAnimeGif('growl');
        await sendReactionMessage(sock, sender, target, 'growl', gifUrl, '😾');
    },
    async disgusted(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        const gifUrl = await fetchAnimeGif('disgusted');
        await sendReactionMessage(sock, sender, target, 'disgusted', gifUrl, '🤢');
    },
    async scared(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        const gifUrl = await fetchAnimeGif('scared');
        await sendReactionMessage(sock, sender, target, 'scared', gifUrl, '😱');
    },
    // Alternative commands
    async hifive(sock, message, args) {
        // This is a wrapper for the highfive command
        const sender = message.key.remoteJid;
        const target = args[0];
        if (!target) {
            await sock.sendMessage(sender, { text: '✋ Please mention someone to high five' });
            return;
        }
        const gifUrl = await fetchAnimeGif('highfive');
        await sendReactionMessage(sock, sender, target, 'highfive', gifUrl, '✋');
    },

    async grouphug(sock, message, args) {
        const sender = message.key.remoteJid;
        const target = args[0];
        const gifUrl = await fetchAnimeGif('hug');
        await sendReactionMessage(sock, sender, target, 'grouphug', gifUrl, '🤗');
    },

    async peck(sock, message, args) {
        // This is a wrapper for the kiss command
        const sender = message.key.remoteJid;
        const target = args[0];
        if (!target) {
            await sock.sendMessage(sender, { text: '😘 Please mention someone to peck' });
            return;
        }
        const gifUrl = await fetchAnimeGif('kiss');
        await sendReactionMessage(sock, sender, target, 'peck', gifUrl, '😘');
    },

    async greet(sock, message, args) {
        // This is a wrapper for the wave command
        const sender = message.key.remoteJid;
        const target = args[0];
        if (!target) {
            await sock.sendMessage(sender, { text: '👋 Please mention someone to greet' });
            return;
        }
        const gifUrl = await fetchAnimeGif('wave');
        await sendReactionMessage(sock, sender, target, 'greet', gifUrl, '👋');
    },

    async bye(sock, message, args) {
        // This is a wrapper for the wave command with no target
        const sender = message.key.remoteJid;
        const target = args[0];
        const gifUrl = await fetchAnimeGif('wave');
        await sendReactionMessage(sock, sender, target, 'bye', gifUrl, '👋');
    },

    async sad(sock, message, args) {
        // This is a wrapper for the cry command
        const sender = message.key.remoteJid;
        const target = args[0];
        const gifUrl = await fetchAnimeGif('cry');
        await sendReactionMessage(sock, sender, target, 'sad', gifUrl, '😢');
    },

    async nom(sock, message, args) {
        // This is a wrapper for the bite command
        const sender = message.key.remoteJid;
        const target = args[0];
        if (!target) {
            await sock.sendMessage(sender, { text: '😋 Please mention someone to nom' });
            return;
        }
        const gifUrl = await fetchAnimeGif('bite');
        await sendReactionMessage(sock, sender, target, 'nom', gifUrl, '😋');
    },

    async init() {
        try {
            logger.info('Initializing reactions command handler...');

            // Get all command names excluding special functions
            const commandNames = Object.keys(reactionCommands).filter(key =>
                key !== 'init' && typeof reactionCommands[key] === 'function'
            );

            // Get all API endpoints
            const endpointNames = Object.keys(ANIME_GIF_API);

            logger.info(`Available reaction commands: ${commandNames.length}`);
            logger.info(`Available API endpoints: ${endpointNames.length}`);

            // Validate all commands have corresponding endpoints
            const missingEndpoints = commandNames.filter(cmd => {
                // Handle special cases for alternative commands
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

            // Test endpoints with retries
            logger.info('Testing API endpoints...');
            const testedEndpoints = new Set();
            const results = await Promise.allSettled(
                commandNames.map(async cmd => {
                    try {
                        // Get the correct endpoint for the command
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

                // Log detailed errors for each failed command
                results
                    .filter(r => r.status === 'fulfilled' && !r.value.success)
                    .forEach(r => {
                        logger.error(`${r.value.command} error:`, r.value.error);
                    });
            }

            // Count working endpoints
            const workingEndpoints = results
                .filter(r => r.status === 'fulfilled' && r.value.success)
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

module.exports = {
    commands: reactionCommands,
    category: 'reactions'
};