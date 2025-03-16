/**
 * Enhanced Reaction Commands for WhatsApp Bot
 * Sends animated GIFs with proper mention formatting
 */

const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const { safeSendMessage } = require('../utils/jidHelper');
const { convertGifToMp4 } = require('../utils/gifConverter');

// Path to reaction GIFs directory
const REACTIONS_DIR = path.join(process.cwd(), 'data', 'reaction_gifs');

// Define reaction GIF mapping
const REACTION_GIF_MAPPING = {
    // Self-reactions
    'smile': 'smile.gif',
    'happy': 'happy.gif',
    'dance': 'dance.gif',
    'cry': 'cry.gif',
    'blush': 'blush.gif',
    'laugh': 'laugh.gif',
    
    // Target-reactions
    'hug': 'hug.gif',
    'pat': 'pat.gif',
    'kiss': 'kiss.gif',
    'cuddle': 'cuddle.gif',
    'wave': 'wave.gif',
    'wink': 'wink.gif',
    'poke': 'poke.gif',
    'slap': 'slap.gif',
    'bonk': 'bonk.gif',
    'bite': 'bite.gif',
    'punch': 'punch.gif',
    'highfive': 'highfive.gif',
    'yeet': 'yeet.gif',
    'kill': 'kill.gif'
};

// Create reaction GIFs directory if it doesn't exist
function ensureDirectoriesExist() {
    if (!fs.existsSync(REACTIONS_DIR)) {
        try {
            fs.mkdirSync(REACTIONS_DIR, { recursive: true });
            logger.info(`Created reaction GIFs directory: ${REACTIONS_DIR}`);
        } catch (err) {
            logger.error(`Failed to create directory: ${err.message}`);
        }
    }
}

// Verify reaction GIFs exist
function verifyReactionGifs() {
    logger.info(`Using reaction GIFs from: ${REACTIONS_DIR}`);
    console.log(`Using reaction GIFs from: ${REACTIONS_DIR}`);

    Object.keys(commands).forEach(command => {
        if (command === 'init') return;

        const gifPath = path.join(REACTIONS_DIR, `${command}.gif`);
        if (fs.existsSync(gifPath)) {
            try {
                const stats = fs.statSync(gifPath);
                if (stats.size > 1024) {
                    logger.info(`✅ Verified ${command}.gif exists (${stats.size} bytes)`);
                } else {
                    logger.warn(`⚠️ GIF for ${command} is too small: ${stats.size} bytes`);
                }
            } catch (err) {
                logger.error(`Error checking GIF for ${command}: ${err.message}`);
            }
        } else {
            logger.warn(`❌ Missing GIF for ${command}`);
        }
    });
}

// Helper function to get user name from message
async function getUserName(sock, jid) {
    try {
        if (!jid) return "Someone";
        if (jid.endsWith('@g.us')) return "Group Chat";

        const phoneNumber = jid.split('@')[0];
        let name = null;

        if (sock.store && sock.store.contacts) {
            const contact = sock.store.contacts[jid];
            if (contact) {
                name = contact.name || contact.pushName;
            }
        }

        return name || `+${phoneNumber}`;
    } catch (err) {
        logger.error(`Error getting user name: ${err.message}`);
        return "User";
    }
}

// Simplified reaction command handler
async function handleReaction(sock, message, type, args) {
    try {
        const jid = message.key.remoteJid;
        const senderJid = message.key.participant || message.key.remoteJid;
        const senderName = await getUserName(sock, senderJid);

        // Get mentioned user or args as target
        let targetName = "themselves";
        let targetJid = null;
        let mentionedJids = [];

        // Check if there's a mention
        const mentionedJid = message.message?.extendedTextMessage?.contextInfo?.mentionedJid;
        if (mentionedJid && mentionedJid.length > 0) {
            targetJid = mentionedJid[0];
            targetName = await getUserName(sock, targetJid);
            mentionedJids.push(targetJid);
        } else if (args.length > 0) {
            targetName = args.join(' ');
        }

        // Add sender to mentions list
        mentionedJids.push(senderJid);

        // Format the sender name for mention
        const formattedSender = `@${senderJid.split('@')[0]}`;
        const formattedTarget = targetJid ? `@${targetJid.split('@')[0]}` : targetName;

        // Define reaction message
        let reactionMessage;
        switch (type) {
            // Self-reactions
            case 'smile': reactionMessage = `${formattedSender} smiles 😊`; break;
            case 'happy': reactionMessage = `${formattedSender} is happy 😄`; break;
            case 'dance': reactionMessage = `${formattedSender} is dancing 💃`; break;
            case 'cry': reactionMessage = `${formattedSender} is crying 😢`; break;
            case 'blush': reactionMessage = `${formattedSender} is blushing 😳`; break;
            case 'laugh': reactionMessage = `${formattedSender} is laughing 😂`; break;

            // Target-reactions
            case 'hug': reactionMessage = `${formattedSender} hugs ${formattedTarget} 🤗`; break;
            case 'pat': reactionMessage = `${formattedSender} pats ${formattedTarget} 👋`; break;
            case 'kiss': reactionMessage = `${formattedSender} kisses ${formattedTarget} 😘`; break;
            case 'cuddle': reactionMessage = `${formattedSender} cuddles with ${formattedTarget} 🥰`; break;
            case 'wave': reactionMessage = `${formattedSender} waves at ${formattedTarget} 👋`; break;
            case 'wink': reactionMessage = `${formattedSender} winks at ${formattedTarget} 😉`; break;
            case 'poke': reactionMessage = `${formattedSender} pokes ${formattedTarget} 👉`; break;
            case 'slap': reactionMessage = `${formattedSender} slaps ${formattedTarget} 👋`; break;
            case 'bonk': reactionMessage = `${formattedSender} bonks ${formattedTarget} 🔨`; break;
            case 'bite': reactionMessage = `${formattedSender} bites ${formattedTarget} 😬`; break;
            case 'punch': reactionMessage = `${formattedSender} punches ${formattedTarget} 👊`; break;
            case 'highfive': reactionMessage = `${formattedSender} high fives ${formattedTarget} ✋`; break;
            case 'yeet': reactionMessage = `${formattedSender} yeets ${formattedTarget} 🚀`; break;
            case 'kill': reactionMessage = `${formattedSender} kills ${formattedTarget} 💀`; break;

            default: reactionMessage = `${formattedSender} reacts with ${type}`; break;
        }

        // Send the text message with proper mentions
        await safeSendMessage(sock, jid, {
            text: reactionMessage,
            mentions: mentionedJids
        });

        // Check and send GIF
        const gifPath = path.join(REACTIONS_DIR, `${type}.gif`);
        if (fs.existsSync(gifPath)) {
            try {
                const gifBuffer = fs.readFileSync(gifPath);
                try {
                    const videoBuffer = await convertGifToMp4(gifBuffer);
                    
                    // Use safe send for video messages
                    await safeSendMessage(sock, jid, {
                        video: videoBuffer,
                        gifPlayback: true,
                        caption: '',
                        mimetype: 'video/mp4'
                    });
                    logger.info(`Sent reaction GIF for: ${type}`);
                } catch (conversionError) {
                    logger.error(`GIF conversion failed: ${conversionError.message}`);
                    
                    // Use safe send for fallback image
                    await safeSendMessage(sock, jid, {
                        image: gifBuffer,
                        caption: '',
                        mimetype: 'image/gif'
                    });
                    logger.info(`Sent reaction as image (fallback)`);
                }
            } catch (err) {
                logger.error(`Error sending reaction: ${err.message}`);
                await safeSendMessage(sock, jid, {
                    text: `❌ Failed to send reaction animation`
                });
            }
        } else {
            logger.warn(`Missing GIF for reaction: ${type}`);
            await safeSendMessage(sock, jid, {
                text: `❌ Could not find animation for this reaction`
            });
        }
    } catch (error) {
        logger.error(`Error in reaction command: ${error.message}`);
        try {
            await safeSendMessage(sock, message.key.remoteJid, {
                text: `❌ Could not process reaction command`
            });
        } catch (err) {
            logger.error('Failed to send error message:', err);
        }
    }
}

// Command implementations
const commands = {
    hug: async (sock, message, args) => await handleReaction(sock, message, 'hug', args),
    pat: async (sock, message, args) => await handleReaction(sock, message, 'pat', args),
    kiss: async (sock, message, args) => await handleReaction(sock, message, 'kiss', args),
    cuddle: async (sock, message, args) => await handleReaction(sock, message, 'cuddle', args),
    smile: async (sock, message, args) => await handleReaction(sock, message, 'smile', args),
    happy: async (sock, message, args) => await handleReaction(sock, message, 'happy', args),
    wave: async (sock, message, args) => await handleReaction(sock, message, 'wave', args),
    dance: async (sock, message, args) => await handleReaction(sock, message, 'dance', args),
    cry: async (sock, message, args) => await handleReaction(sock, message, 'cry', args),
    blush: async (sock, message, args) => await handleReaction(sock, message, 'blush', args),
    laugh: async (sock, message, args) => await handleReaction(sock, message, 'laugh', args),
    wink: async (sock, message, args) => await handleReaction(sock, message, 'wink', args),
    poke: async (sock, message, args) => await handleReaction(sock, message, 'poke', args),
    slap: async (sock, message, args) => await handleReaction(sock, message, 'slap', args),
    bonk: async (sock, message, args) => await handleReaction(sock, message, 'bonk', args),
    bite: async (sock, message, args) => await handleReaction(sock, message, 'bite', args),
    punch: async (sock, message, args) => await handleReaction(sock, message, 'punch', args),
    highfive: async (sock, message, args) => await handleReaction(sock, message, 'highfive', args),
    yeet: async (sock, message, args) => await handleReaction(sock, message, 'yeet', args),
    kill: async (sock, message, args) => await handleReaction(sock, message, 'kill', args)
};

async function init() {
    try {
        logger.info('Initializing reactions module...');
        ensureDirectoriesExist();
        verifyReactionGifs();
        return true;
    } catch (err) {
        logger.error(`Error initializing reactions: ${err.message}`);
        return false;
    }
}

module.exports = {
    commands,
    init,
    category: 'reactions'
};