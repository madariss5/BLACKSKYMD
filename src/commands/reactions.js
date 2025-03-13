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
        // Type-specific fallback GIFs for common reactions (these are stable URLs)
        const fallbacks = {
            'hug': 'https://c.tenor.com/FzEfrj9RKqEAAAAd/anime-hug.gif',
            'pat': 'https://c.tenor.com/Dbj9bAT9S-YAAAAC/anime-pat.gif',
            'kiss': 'https://c.tenor.com/Fu-vx6npJicAAAAC/anime-kiss.gif',
            'slap': 'https://c.tenor.com/PeJyQRCSHHkAAAAC/saki-saki-mukai-naoya.gif',
            'cuddle': 'https://c.tenor.com/ItpTQW2UKPYAAAAC/cuddle-anime.gif',
            'panic': 'https://c.tenor.com/KOMV7S7Zf28AAAAC/anime-panic.gif',
            'yeet': 'https://c.tenor.com/1FYdZLkHY9wAAAAC/anime-throw.gif',
            'sad': 'https://c.tenor.com/6q-ickMeKnYAAAAC/crying-anime.gif',
            'happy': 'https://c.tenor.com/QxIL-aeHRmMAAAAC/happy-anime.gif'
        };
        
        // Generic fallback for all other types
        const genericFallback = 'https://i.imgur.com/hew1cmf.gif';
        
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
                    logger.debug(`Successfully fetched ${type} GIF from API`);
                    return response.data.url;
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
        // Always use fallback if gifUrl is null
        if (!gifUrl) {
            gifUrl = 'https://i.imgur.com/hew1cmf.gif';
        }
        
        // Get the chat context (either group or private chat)
        const chatJid = sender.includes('@g.us') ? sender : (sender.split('@')[0] + '@s.whatsapp.net');
        const isGroup = chatJid.includes('@g.us');

        // Extract the sender's name without the "@xxxx" part
        const senderName = sender.includes('@g.us')
            ? 'You' // In group chat, it's "You" from the bot's perspective
            : sender.split('@')[0];

        // Process target if provided
        let targetJid = target;
        let targetName = null;
        
        if (target) {
            // Clean up the target - remove @ if present
            if (target.startsWith('@')) {
                targetName = target.substring(1);
            } else if (target.includes('@')) {
                // If it's a JID format
                targetName = target.split('@')[0];
            } else {
                targetName = target;
            }
            
            // If it's just a number, format it as a WhatsApp JID
            if (/^\d+$/.test(targetName)) {
                targetJid = `${targetName}@s.whatsapp.net`;
            } else if (!target.includes('@')) {
                // Try to normalize as a proper JID if not already
                targetJid = `${targetName}@s.whatsapp.net`;
            }
        }

        let message;
        if (target) {
            if (!validateMention(target)) {
                logger.warn(`Invalid mention format: "${target}"`);
                await sock.sendMessage(chatJid, {
                    text: `❌ Please mention a valid user to ${type}`
                });
                return;
            }
            
            // Handle special cases for 'everyone' or 'all'
            if (targetName === 'everyone' || targetName === 'all') {
                message = `${senderName} ${type}s everyone ${emoji}`;
            } else {
                message = `${senderName} ${type}s ${targetName} ${emoji}`;
            }
        } else {
            message = `${senderName} ${type}s ${emoji}`;
        }

        logger.debug(`Sending reaction message: ${message} to ${chatJid}`);
        logger.debug(`Target info - Name: ${targetName}, JID: ${targetJid}`);

        // Prepare mentions array only if we're in a group chat and we have a valid target
        const mentions = (isGroup && targetJid && targetJid.includes('@')) ? [targetJid] : undefined;

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
    async blush(sock, message) {
        // Extract sender from message object
        const sender = message.key.remoteJid;
        const gifUrl = await fetchAnimeGif('blush');
        await sendReactionMessage(sock, sender, null, 'blush', gifUrl, '😊');
    },
    async cry(sock, message) {
        // Extract sender from message object
        const sender = message.key.remoteJid;
        const gifUrl = await fetchAnimeGif('cry');
        await sendReactionMessage(sock, sender, null, 'cry', gifUrl, '😢');
    },
    async dance(sock, message) {
        // Extract sender from message object
        const sender = message.key.remoteJid;
        const gifUrl = await fetchAnimeGif('dance');
        await sendReactionMessage(sock, sender, null, 'dance', gifUrl, '💃');
    },
    async laugh(sock, message) {
        // Extract sender from message object
        const sender = message.key.remoteJid;
        const gifUrl = await fetchAnimeGif('laugh');
        await sendReactionMessage(sock, sender, null, 'laugh', gifUrl, '😂');
    },
    async smile(sock, message) {
        // Extract sender from message object
        const sender = message.key.remoteJid;
        const gifUrl = await fetchAnimeGif('smile');
        await sendReactionMessage(sock, sender, null, 'smile', gifUrl, '😊');
    },
    async wave(sock, message) {
        try {
            // Extract sender from message object
            const sender = message.key.remoteJid;
            const gifUrl = await fetchAnimeGif('wave');
            await sendReactionMessage(sock, sender, null, 'wave', gifUrl, '👋');
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
    async grouphug(sock, message) {
        // Extract sender from message object
        const sender = message.key.remoteJid;
        const gifUrl = await fetchAnimeGif('hug');
        await sendReactionMessage(sock, sender, null, 'grouphug', gifUrl, '🤗');
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
    async pout(sock, message) {
        // Extract sender from message object
        const sender = message.key.remoteJid;
        const gifUrl = await fetchAnimeGif('pout');
        await sendReactionMessage(sock, sender, null, 'pout', gifUrl, '😤');
    },
    async smug(sock, message) {
        // Extract sender from message object
        const sender = message.key.remoteJid;
        const gifUrl = await fetchAnimeGif('smug');
        await sendReactionMessage(sock, sender, null, 'smug', gifUrl, '😏');
    },
    async run(sock, message) {
        // Extract sender from message object
        const sender = message.key.remoteJid;
        const gifUrl = await fetchAnimeGif('run');
        await sendReactionMessage(sock, sender, null, 'run', gifUrl, '🏃');
    },
    async sleep(sock, message) {
        // Extract sender from message object
        const sender = message.key.remoteJid;
        const gifUrl = await fetchAnimeGif('sleep');
        await sendReactionMessage(sock, sender, null, 'sleep', gifUrl, '😴');
    },
    async panic(sock, message) {
        // Extract sender from message object
        const sender = message.key.remoteJid;
        const gifUrl = await fetchAnimeGif('panic');
        await sendReactionMessage(sock, sender, null, 'panic', gifUrl, '😱');
    },
    async facepalm(sock, message) {
        // Extract sender from message object
        const sender = message.key.remoteJid;
        const gifUrl = await fetchAnimeGif('facepalm');
        await sendReactionMessage(sock, sender, null, 'facepalm', gifUrl, '🤦');
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
    async happy(sock, message) {
        // Extract sender from message object
        const sender = message.key.remoteJid;
        const gifUrl = await fetchAnimeGif('happy');
        await sendReactionMessage(sock, sender, null, 'happy', gifUrl, '😊');
    },
    async sad(sock, message) {
        // Extract sender from message object
        const sender = message.key.remoteJid;
        const gifUrl = await fetchAnimeGif('sad');
        await sendReactionMessage(sock, sender, null, 'sad', gifUrl, '😢');
    },
    async angry(sock, message) {
        // Extract sender from message object
        const sender = message.key.remoteJid;
        const gifUrl = await fetchAnimeGif('angry');
        await sendReactionMessage(sock, sender, null, 'angry', gifUrl, '😠');
    },
    async confused(sock, message) {
        // Extract sender from message object
        const sender = message.key.remoteJid;
        const gifUrl = await fetchAnimeGif('confused');
        await sendReactionMessage(sock, sender, null, 'confused', gifUrl, '😕');
    },
    async think(sock, message) {
        // Extract sender from message object
        const sender = message.key.remoteJid;
        const gifUrl = await fetchAnimeGif('think');
        await sendReactionMessage(sock, sender, null, 'think', gifUrl, '🤔');
    },
    async peck(sock, message, args) {
        // Extract sender from message object
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
        // Extract sender from message object
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
        // Extract sender from message object
        const sender = message.key.remoteJid;
        const target = args[0];
        if (!target) {
            await sock.sendMessage(sender, { text: '🫡 Please mention someone to salute' });
            return;
        }
        const gifUrl = await fetchAnimeGif('salute');
        await sendReactionMessage(sock, sender, target, 'salute', gifUrl, '🫡');
    },
    async shocked(sock, message) {
        // Extract sender from message object
        const sender = message.key.remoteJid;
        const gifUrl = await fetchAnimeGif('shocked');
        await sendReactionMessage(sock, sender, null, 'shocked', gifUrl, '😱');
    },
    async shrug(sock, message) {
        // Extract sender from message object
        const sender = message.key.remoteJid;
        const gifUrl = await fetchAnimeGif('shrug');
        await sendReactionMessage(sock, sender, null, 'shrug', gifUrl, '🤷');
    },
    async nod(sock, message) {
        // Extract sender from message object
        const sender = message.key.remoteJid;
        const gifUrl = await fetchAnimeGif('nod');
        await sendReactionMessage(sock, sender, null, 'nod', gifUrl, '😌');
    },
    async shake(sock, message) {
        // Extract sender from message object
        const sender = message.key.remoteJid;
        const gifUrl = await fetchAnimeGif('shake');
        await sendReactionMessage(sock, sender, null, 'shake', gifUrl, '😤');
    },
    async kick(sock, message, args) {
        // Extract sender from message object
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
        // Extract sender from message object
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
        // Extract sender from message object
        const sender = message.key.remoteJid;
        const target = args[0];
        if (!target) {
            await sock.sendMessage(sender, { text: '🔫 Please mention someone to shoot (jokingly)' });
            return;
        }
        const gifUrl = await fetchAnimeGif('shoot');
        await sendReactionMessage(sock, sender, target, 'shoot', gifUrl, '🔫');
    },
    async thumbsup(sock, message) {
        // Extract sender from message object
        const sender = message.key.remoteJid;
        const gifUrl = await fetchAnimeGif('thumbsup');
        await sendReactionMessage(sock, sender, null, 'thumbsup', gifUrl, '👍');
    },
    async thumbsdown(sock, message) {
        // Extract sender from message object
        const sender = message.key.remoteJid;
        const gifUrl = await fetchAnimeGif('thumbsdown');
        await sendReactionMessage(sock, sender, null, 'thumbsdown', gifUrl, '👎');
    },
    async excited(sock, message) {
        // Extract sender from message object
        const sender = message.key.remoteJid;
        const gifUrl = await fetchAnimeGif('excited');
        await sendReactionMessage(sock, sender, null, 'excited', gifUrl, '🤩');
    },
    async lewd(sock, message) {
        // Extract sender from message object
        const sender = message.key.remoteJid;
        const gifUrl = await fetchAnimeGif('lewd');
        await sendReactionMessage(sock, sender, null, 'lewd', gifUrl, '😳');
    },
    async bored(sock, message) {
        // Extract sender from message object
        const sender = message.key.remoteJid;
        const gifUrl = await fetchAnimeGif('bored');
        await sendReactionMessage(sock, sender, null, 'bored', gifUrl, '😑');
    },
    async nervous(sock, message) {
        // Extract sender from message object
        const sender = message.key.remoteJid;
        const gifUrl = await fetchAnimeGif('nervous');
        await sendReactionMessage(sock, sender, null, 'nervous', gifUrl, '😰');
    },
    async celebrate(sock, message) {
        // Extract sender from message object
        const sender = message.key.remoteJid;
        const gifUrl = await fetchAnimeGif('celebrate');
        await sendReactionMessage(sock, sender, null, 'celebrate', gifUrl, '🎉');
    },
    async dizzy(sock, message) {
        // Extract sender from message object
        const sender = message.key.remoteJid;
        const gifUrl = await fetchAnimeGif('dizzy');
        await sendReactionMessage(sock, sender, null, 'dizzy', gifUrl, '💫');
    },
    async bye(sock, message) {
        // Extract sender from message object
        const sender = message.key.remoteJid;
        const gifUrl = await fetchAnimeGif('bye');
        await sendReactionMessage(sock, sender, null, 'bye', gifUrl, '👋');
    },
    async smack(sock, message, args) {
        // Extract sender from message object
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
        // Extract sender from message object
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
        // Extract sender from message object
        const sender = message.key.remoteJid;
        const target = args[0];
        if (!target) {
            await sock.sendMessage(sender, { text: '😾 Please mention someone to growl at' });
            return;
        }
        const gifUrl = await fetchAnimeGif('growl');
        await sendReactionMessage(sock, sender, target, 'growl', gifUrl, '😾');
    },
    async disgusted(sock, message) {
        // Extract sender from message object
        const sender = message.key.remoteJid;
        const gifUrl = await fetchAnimeGif('disgusted');
        await sendReactionMessage(sock, sender, null, 'disgusted', gifUrl, '🤢');
    },
    async scared(sock, message) {
        // Extract sender from message object
        const sender = message.key.remoteJid;
        const gifUrl = await fetchAnimeGif('scared');
        await sendReactionMessage(sock, sender, null, 'scared', gifUrl, '😱');
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

    async grouphug(sock, message) {
        // Already implemented above independently
        const sender = message.key.remoteJid;
        const gifUrl = await fetchAnimeGif('hug');
        await sendReactionMessage(sock, sender, null, 'grouphug', gifUrl, '🤗');
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

    async bye(sock, message) {
        // This is a wrapper for the wave command with no target
        const sender = message.key.remoteJid;
        const gifUrl = await fetchAnimeGif('wave');
        await sendReactionMessage(sock, sender, null, 'bye', gifUrl, '👋');
    },

    async sad(sock, message) {
        // This is a wrapper for the cry command
        const sender = message.key.remoteJid;
        const gifUrl = await fetchAnimeGif('cry');
        await sendReactionMessage(sock, sender, null, 'sad', gifUrl, '😢');
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