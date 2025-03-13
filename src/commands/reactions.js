const logger = require('../utils/logger');
const axios = require('axios');

// API endpoints (using waifu.pics and additional sources)
const ANIME_GIF_API = {
    // Existing endpoints
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
    highfive: 'https://api.waifu.pics/sfw/highfive',
    hold: 'https://api.waifu.pics/sfw/handhold', // Using handhold for hold
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
    // Base command implementations
    async hug(sock, sender, args) {
        try {
            const target = args[0];
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
    // New commands implementation
    async highfive(sock, sender, args) {
        const target = args[0];
        if (!target) {
            await sock.sendMessage(sender, { text: '✋ Please mention someone to high five' });
            return;
        }
        const gifUrl = await fetchAnimeGif('highfive');
        await sendReactionMessage(sock, sender, target, 'highfive', gifUrl, '✋');
    },
    async hold(sock, sender, args) {
        const target = args[0];
        if (!target) {
            await sock.sendMessage(sender, { text: '🤝 Please mention someone to hold' });
            return;
        }
        const gifUrl = await fetchAnimeGif('hold');
        await sendReactionMessage(sock, sender, target, 'hold', gifUrl, '🤝');
    },
    async handhold(sock, sender, args) {
        const target = args[0];
        if (!target) {
            await sock.sendMessage(sender, { text: '🤝 Please mention someone to hold hands with' });
            return;
        }
        const gifUrl = await fetchAnimeGif('handhold');
        await sendReactionMessage(sock, sender, target, 'handhold', gifUrl, '🤝');
    },
    async nom(sock, sender, args) {
        const target = args[0];
        if (!target) {
            await sock.sendMessage(sender, { text: '😋 Please mention someone to nom' });
            return;
        }
        const gifUrl = await fetchAnimeGif('nom');
        await sendReactionMessage(sock, sender, target, 'nom', gifUrl, '😋');
    },
    async bite(sock, sender, args) {
        const target = args[0];
        if (!target) {
            await sock.sendMessage(sender, { text: '😬 Please mention someone to bite' });
            return;
        }
        const gifUrl = await fetchAnimeGif('bite');
        await sendReactionMessage(sock, sender, target, 'bite', gifUrl, '😬');
    },
    async glomp(sock, sender, args) {
        const target = args[0];
        if (!target) {
            await sock.sendMessage(sender, { text: '💫 Please mention someone to glomp' });
            return;
        }
        const gifUrl = await fetchAnimeGif('glomp');
        await sendReactionMessage(sock, sender, target, 'glomp', gifUrl, '💫');
    },
    async kill(sock, sender, args) {
        const target = args[0];
        if (!target) {
            await sock.sendMessage(sender, { text: '💀 Please mention someone to kill (jokingly)' });
            return;
        }
        const gifUrl = await fetchAnimeGif('kill');
        await sendReactionMessage(sock, sender, target, 'kill', gifUrl, '💀');
    },
    async yeet(sock, sender, args) {
        const target = args[0];
        if (!target) {
            await sock.sendMessage(sender, { text: '🚀 Please mention someone to yeet' });
            return;
        }
        const gifUrl = await fetchAnimeGif('yeet');
        await sendReactionMessage(sock, sender, target, 'yeet', gifUrl, '🚀');
    },
    async stare(sock, sender, args) {
        const target = args[0];
        if (!target) {
            await sock.sendMessage(sender, { text: '👀 Please mention someone to stare at' });
            return;
        }
        const gifUrl = await fetchAnimeGif('stare');
        await sendReactionMessage(sock, sender, target, 'stare', gifUrl, '👀');
    },
    async lick(sock, sender, args) {
        const target = args[0];
        if (!target) {
            await sock.sendMessage(sender, { text: '👅 Please mention someone to lick' });
            return;
        }
        const gifUrl = await fetchAnimeGif('lick');
        await sendReactionMessage(sock, sender, target, 'lick', gifUrl, '👅');
    },
    async feed(sock, sender, args) {
        const target = args[0];
        if (!target) {
            await sock.sendMessage(sender, { text: '🍽️ Please mention someone to feed' });
            return;
        }
        const gifUrl = await fetchAnimeGif('feed');
        await sendReactionMessage(sock, sender, target, 'feed', gifUrl, '🍽️');
    },
    async bully(sock, sender, args) {
        const target = args[0];
        if (!target) {
            await sock.sendMessage(sender, { text: '😈 Please mention someone to bully (playfully)' });
            return;
        }
        const gifUrl = await fetchAnimeGif('bully');
        await sendReactionMessage(sock, sender, target, 'bully', gifUrl, '😈');
    },
    // Solo reactions (no target needed)
    async happy(sock, sender) {
        const gifUrl = await fetchAnimeGif('happy');
        await sendReactionMessage(sock, sender, null, 'happy', gifUrl, '😊');
    },
    async sad(sock, sender) {
        const gifUrl = await fetchAnimeGif('sad');
        await sendReactionMessage(sock, sender, null, 'sad', gifUrl, '😢');
    },
    async angry(sock, sender) {
        const gifUrl = await fetchAnimeGif('angry');
        await sendReactionMessage(sock, sender, null, 'angry', gifUrl, '😠');
    },
    async confused(sock, sender) {
        const gifUrl = await fetchAnimeGif('confused');
        await sendReactionMessage(sock, sender, null, 'confused', gifUrl, '😕');
    },
    async think(sock, sender) {
        const gifUrl = await fetchAnimeGif('think');
        await sendReactionMessage(sock, sender, null, 'think', gifUrl, '🤔');
    },
    async peck(sock, sender, args) {
        const target = args[0];
        if (!target) {
            await sock.sendMessage(sender, { text: '😘 Please mention someone to peck' });
            return;
        }
        const gifUrl = await fetchAnimeGif('peck');
        await sendReactionMessage(sock, sender, target, 'peck', gifUrl, '😘');
    },
    async greet(sock, sender, args) {
        const target = args[0];
        if (!target) {
            await sock.sendMessage(sender, { text: '👋 Please mention someone to greet' });
            return;
        }
        const gifUrl = await fetchAnimeGif('greet');
        await sendReactionMessage(sock, sender, target, 'greet', gifUrl, '👋');
    },
    async salute(sock, sender, args) {
        const target = args[0];
        if (!target) {
            await sock.sendMessage(sender, { text: '🫡 Please mention someone to salute' });
            return;
        }
        const gifUrl = await fetchAnimeGif('salute');
        await sendReactionMessage(sock, sender, target, 'salute', gifUrl, '🫡');
    },
    async shocked(sock, sender) {
        const gifUrl = await fetchAnimeGif('shocked');
        await sendReactionMessage(sock, sender, null, 'shocked', gifUrl, '😱');
    },
    async shrug(sock, sender) {
        const gifUrl = await fetchAnimeGif('shrug');
        await sendReactionMessage(sock, sender, null, 'shrug', gifUrl, '🤷');
    },
    async nod(sock, sender) {
        const gifUrl = await fetchAnimeGif('nod');
        await sendReactionMessage(sock, sender, null, 'nod', gifUrl, '😌');
    },
    async shake(sock, sender) {
        const gifUrl = await fetchAnimeGif('shake');
        await sendReactionMessage(sock, sender, null, 'shake', gifUrl, '😤');
    },
    async kick(sock, sender, args) {
        const target = args[0];
        if (!target) {
            await sock.sendMessage(sender, { text: '🦵 Please mention someone to kick' });
            return;
        }
        const gifUrl = await fetchAnimeGif('kick');
        await sendReactionMessage(sock, sender, target, 'kick', gifUrl, '🦵');
    },
    async throw(sock, sender, args) {
        const target = args[0];
        if (!target) {
            await sock.sendMessage(sender, { text: '🎯 Please mention someone to throw at' });
            return;
        }
        const gifUrl = await fetchAnimeGif('throw');
        await sendReactionMessage(sock, sender, target, 'throw', gifUrl, '🎯');
    },
    async shoot(sock, sender, args) {
        const target = args[0];
        if (!target) {
            await sock.sendMessage(sender, { text: '🔫 Please mention someone to shoot (jokingly)' });
            return;
        }
        const gifUrl = await fetchAnimeGif('shoot');
        await sendReactionMessage(sock, sender, target, 'shoot', gifUrl, '🔫');
    },
    async thumbsup(sock, sender) {
        const gifUrl = await fetchAnimeGif('thumbsup');
        await sendReactionMessage(sock, sender, null, 'thumbsup', gifUrl, '👍');
    },
    async thumbsdown(sock, sender) {
        const gifUrl = await fetchAnimeGif('thumbsdown');
        await sendReactionMessage(sock, sender, null, 'thumbsdown', gifUrl, '👎');
    },
    async excited(sock, sender) {
        const gifUrl = await fetchAnimeGif('excited');
        await sendReactionMessage(sock, sender, null, 'excited', gifUrl, '🤩');
    },
    async lewd(sock, sender) {
        const gifUrl = await fetchAnimeGif('lewd');
        await sendReactionMessage(sock, sender, null, 'lewd', gifUrl, '😳');
    },
    async bored(sock, sender) {
        const gifUrl = await fetchAnimeGif('bored');
        await sendReactionMessage(sock, sender, null, 'bored', gifUrl, '😑');
    },
    async nervous(sock, sender) {
        const gifUrl = await fetchAnimeGif('nervous');
        await sendReactionMessage(sock, sender, null, 'nervous', gifUrl, '😰');
    },
    async celebrate(sock, sender) {
        const gifUrl = await fetchAnimeGif('celebrate');
        await sendReactionMessage(sock, sender, null, 'celebrate', gifUrl, '🎉');
    },
    async dizzy(sock, sender) {
        const gifUrl = await fetchAnimeGif('dizzy');
        await sendReactionMessage(sock, sender, null, 'dizzy', gifUrl, '💫');
    },
    async bye(sock, sender) {
        const gifUrl = await fetchAnimeGif('bye');
        await sendReactionMessage(sock, sender, null, 'bye', gifUrl, '👋');
    },
    async smack(sock, sender, args) {
        const target = args[0];
        if (!target) {
            await sock.sendMessage(sender, { text: '💥 Please mention someone to smack' });
            return;
        }
        const gifUrl = await fetchAnimeGif('smack');
        await sendReactionMessage(sock, sender, target, 'smack', gifUrl, '💥');
    },
    async nuzzle(sock, sender, args) {
        const target = args[0];
        if (!target) {
            await sock.sendMessage(sender, { text: '🥰 Please mention someone to nuzzle' });
            return;
        }
        const gifUrl = await fetchAnimeGif('nuzzle');
        await sendReactionMessage(sock, sender, target, 'nuzzle', gifUrl, '🥰');
    },
    async growl(sock, sender, args) {
        const target = args[0];
        if (!target) {
            await sock.sendMessage(sender, { text: '😾 Please mention someone to growl at' });
            return;
        }
        const gifUrl = await fetchAnimeGif('growl');
        await sendReactionMessage(sock, sender, target, 'growl', gifUrl, '😾');
    },
    async disgusted(sock, sender) {
        const gifUrl = await fetchAnimeGif('disgusted');
        await sendReactionMessage(sock, sender, null, 'disgusted', gifUrl, '🤢');
    },
    async scared(sock, sender) {
        const gifUrl = await fetchAnimeGif('scared');
        await sendReactionMessage(sock, sender, null, 'scared', gifUrl, '😱');
    },
    // Alternative commands
    async hifive(sock, sender, args) {
        // Use the highfive handler since it's the same action
        await reactionCommands.highfive(sock, sender, args);
    },
    async init() {
        try {
            logger.info('Initializing reactions command handler...');

            // Log the state of the command handler
            const commandNames = Object.keys(reactionCommands).filter(key => key !== 'init');
            const endpointNames = Object.keys(ANIME_GIF_API);

            logger.info(`Available reaction commands: ${commandNames.length}`);
            logger.info(`Available API endpoints: ${endpointNames.length}`);

            // Check for mismatches between commands and endpoints
            const missingEndpoints = commandNames.filter(cmd => !ANIME_GIF_API[cmd]);
            const unusedEndpoints = endpointNames.filter(endpoint =>
                !commandNames.some(cmd => cmd === endpoint ||
                    (cmd === 'hifive' && endpoint === 'highfive'))
            );

            if (missingEndpoints.length > 0) {
                logger.warn(`Commands missing API endpoints: ${missingEndpoints.join(', ')}`);
            }

            if (unusedEndpoints.length > 0) {
                logger.warn(`Unused API endpoints: ${unusedEndpoints.join(', ')}`);
            }

            // Test each endpoint for at least one command
            logger.info('Testing API endpoints...');
            const testedEndpoints = new Set();
            const results = await Promise.allSettled(
                commandNames.map(async cmd => {
                    try {
                        const endpoint = ANIME_GIF_API[cmd];
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

            // Return success if we have working endpoints
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