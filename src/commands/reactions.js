/**
 * Simplified Reaction Commands for WhatsApp Bot
 * Sends animated GIFs with proper mention formatting
 */

const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');
const { safeSendMessage } = require('../utils/jidHelper');

// Paths to reaction GIFs directories
const REACTIONS_DIR = path.join(process.cwd(), 'data', 'reaction_gifs');
const ANIMATED_GIFS_DIR = path.join(process.cwd(), 'animated_gifs');

// Create directories if they don't exist
function ensureDirectoriesExist() {
    const dirs = [REACTIONS_DIR, ANIMATED_GIFS_DIR];
    
    for (const dir of dirs) {
        if (!fs.existsSync(dir)) {
            logger.info(`Creating reaction GIFs directory: ${dir}`);
            fs.mkdirSync(dir, { recursive: true });
        }
    }
}

// Ensure directories exist when module loads
ensureDirectoriesExist();

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
        return "User";
    }
}

// Simplified reaction command handler - with proper WhatsApp mentions
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
        
        // Add sender to mentions list for proper highlighting
        mentionedJids.push(senderJid);
        
        // Define reaction message with proper mention formatting
        let reactionMessage;
        
        // Format the sender name for mention
        const formattedSender = `@${senderJid.split('@')[0]}`;
        
        // Format target for mention if we have their JID
        const formattedTarget = targetJid ? `@${targetJid.split('@')[0]}` : targetName;
        
        switch (type) {
            // Self-reactions (only mention the sender)
            case 'smile': reactionMessage = `${formattedSender} smiles 😊`; break;
            case 'happy': reactionMessage = `${formattedSender} is happy 😄`; break;
            case 'dance': reactionMessage = `${formattedSender} is dancing 💃`; break;
            case 'cry': reactionMessage = `${formattedSender} is crying 😢`; break;
            case 'blush': reactionMessage = `${formattedSender} is blushing 😳`; break;
            case 'laugh': reactionMessage = `${formattedSender} is laughing 😂`; break;
            
            // Target-reactions (mention both sender and target)
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
        
        // Send the GIF if available
        const gifPath = path.join(REACTIONS_DIR, `${type}.gif`);
        
        if (fs.existsSync(gifPath)) {
            const gifBuffer = fs.readFileSync(gifPath);
            
            await safeSendMessage(sock, jid, {
                video: gifBuffer,
                gifPlayback: true,
                caption: ''
            });
        }
    } catch (error) {
        logger.error(`Error in ${type} command: ${error.message}`);
        try {
            const jid = message.key.remoteJid;
            await safeSendMessage(sock, jid, { text: `❌ Could not send ${type} reaction` });
        } catch (err) {
            logger.error('Failed to send error message:', err);
        }
    }
}

// Command implementation with explicit commands
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

/**
 * Initialize the module - validate all reaction GIFs
 */
async function init() {
    logger.info('Initializing reactions module...');
    
    // Make sure directories exist
    ensureDirectoriesExist();
    
    // Validate all reaction GIFs
    const validGifs = [];
    const missingGifs = [];
    
    Object.keys(commands).forEach(cmdName => {
        if (cmdName === 'init') return;
        
        const gifPath = path.join(REACTIONS_DIR, `${cmdName}.gif`);
        
        if (fs.existsSync(gifPath)) {
            const stats = fs.statSync(gifPath);
            if (stats.size > 1024) {
                validGifs.push(cmdName);
                logger.info(`✅ Found valid GIF for ${cmdName}: ${gifPath}`);
            } else {
                missingGifs.push(cmdName);
                logger.warn(`⚠️ GIF file for ${cmdName} is too small: ${stats.size} bytes`);
            }
        } else {
            missingGifs.push(cmdName);
            logger.warn(`❌ Missing GIF for ${cmdName}`);
        }
    });
    
    logger.info(`Reaction GIFs validation complete. Valid: ${validGifs.length}, Missing: ${missingGifs.length}`);
    
    return true;
}

// Export module with appropriate properties
module.exports = {
    commands,
    category: 'reactions',
    init
};