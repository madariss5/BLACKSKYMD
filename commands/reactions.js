/**
 * Reaction Commands Module
 * Provides GIF-based reaction commands for interactive responses
 */

const fs = require('fs');
const path = require('path');

// Try to load the safe-send utility
let safeSend;
try {
    // First try the direct path
    safeSend = require('../src/utils/safe-send');
    console.log('Successfully loaded safe-send utility for reaction commands');
} catch (err) {
    try {
        // Try alternate path
        safeSend = require('./src/utils/safe-send');
        console.log('Successfully loaded safe-send utility (alternate path)');
    } catch (altErr) {
        console.log(`Could not load safe-send utility: ${err.message}`);
        // Create fallback message sending functions if utility is not available
        safeSend = {
            safeSendText: async (sock, jid, text) => {
                console.log(`[FALLBACK SEND] Sending text to ${jid}: ${text.substring(0, 50)}${text.length > 50 ? '...' : ''}`);
                return sock.sendMessage(jid, { text });
            },
            safeSendMessage: async (sock, jid, content) => {
                console.log(`[FALLBACK SEND] Sending message to ${jid}`);
                return sock.sendMessage(jid, content);
            }
        };
        console.log('Using fallback message sending (safe-send.js not available)');
    }
}

// Store reaction GIFs as buffers for faster responses
const gifCache = new Map();

// Directory where reaction GIFs are stored
const GIF_DIRECTORY = path.join(process.cwd(), 'attached_assets');

/**
 * Load a reaction GIF from the filesystem
 * @param {string} reactionName - Name of the reaction (e.g., 'hug', 'slap')
 * @returns {Promise<Buffer|null>} - GIF buffer or null if not found
 */
async function loadReactionGif(reactionName) {
    try {
        // Return from cache if available
        if (gifCache.has(reactionName)) {
            return gifCache.get(reactionName);
        }
        
        // Construct path to the GIF file
        const gifPath = path.join(GIF_DIRECTORY, `${reactionName}.gif`);
        
        // Check if file exists
        if (!fs.existsSync(gifPath)) {
            console.error(`Reaction GIF not found: ${gifPath}`);
            return null;
        }
        
        // Read file and store in cache
        const buffer = fs.readFileSync(gifPath);
        gifCache.set(reactionName, buffer);
        
        return buffer;
    } catch (err) {
        console.error(`Error loading reaction GIF '${reactionName}': ${err.message}`);
        return null;
    }
}

/**
 * Send a reaction GIF with message
 * @param {Object} sock - WhatsApp socket
 * @param {Object} msg - Message object
 * @param {string} reactionName - Reaction name
 * @param {string} caption - Message caption
 */
async function sendReaction(sock, msg, reactionName, caption) {
    const jid = msg.key.remoteJid;
    
    try {
        const gifBuffer = await loadReactionGif(reactionName);
        
        if (!gifBuffer) {
            await safeSend.safeSendText(sock, jid, `Sorry, the ${reactionName} reaction is currently unavailable.`);
            return;
        }
        
        // Send the GIF using safe-send
        await safeSend.safeSendMessage(sock, jid, {
            video: gifBuffer,
            caption: caption,
            gifPlayback: true
        }, {
            maxRetries: 2, // Retry up to 2 times
            retryDelay: 1500 // Wait 1.5 seconds between retries
        });
    } catch (err) {
        console.error(`Error sending ${reactionName} reaction: ${err.message}`);
        await safeSend.safeSendText(sock, jid, `Sorry, there was an error with the ${reactionName} reaction.`);
    }
}

// Define all reaction commands
const commands = {
    hug: async (sock, msg, args) => {
        const target = args.join(' ') || 'you';
        await sendReaction(sock, msg, 'hug', `*Hugs ${target}* 🤗`);
    },
    
    slap: async (sock, msg, args) => {
        const target = args.join(' ') || 'you';
        await sendReaction(sock, msg, 'slap', `*Slaps ${target}* 👋💥`);
    },
    
    pat: async (sock, msg, args) => {
        const target = args.join(' ') || 'you';
        await sendReaction(sock, msg, 'pat', `*Pats ${target}* ✋😊`);
    },
    
    kiss: async (sock, msg, args) => {
        const target = args.join(' ') || 'you';
        await sendReaction(sock, msg, 'kiss', `*Kisses ${target}* 💋`);
    },
    
    punch: async (sock, msg, args) => {
        const target = args.join(' ') || 'you';
        await sendReaction(sock, msg, 'punch', `*Punches ${target}* 👊💥`);
    },
    
    cry: async (sock, msg) => {
        await sendReaction(sock, msg, 'cry', `*Cries* 😭`);
    },
    
    dance: async (sock, msg) => {
        await sendReaction(sock, msg, 'dance', `*Dances happily* 💃`);
    },
    
    smile: async (sock, msg) => {
        await sendReaction(sock, msg, 'smile', `*Smiles* 😊`);
    },
    
    // List available reactions
    reactions: async (sock, msg) => {
        const jid = msg.key.remoteJid;
        
        // Read the reactions directory to list all available reactions
        try {
            const files = fs.readdirSync(GIF_DIRECTORY);
            const reactions = files
                .filter(file => file.endsWith('.gif'))
                .map(file => file.replace('.gif', ''))
                .sort();
            
            if (reactions.length === 0) {
                await safeSend.safeSendText(sock, jid, 'No reaction GIFs found.');
                return;
            }
            
            const reactionList = reactions.map(name => `!${name}`).join(', ');
            await safeSend.safeSendText(sock, jid, 
                `*Available Reaction Commands*\n\n${reactionList}\n\nUsage: !reaction [target]`
            );
        } catch (err) {
            console.error(`Error listing reactions: ${err.message}`);
            await safeSend.safeSendText(sock, jid, 'Error listing available reactions.');
        }
    }
};

// Add commands for all GIFs in the directory
try {
    const files = fs.readdirSync(GIF_DIRECTORY);
    files.forEach(file => {
        if (file.endsWith('.gif')) {
            const reactionName = file.replace('.gif', '');
            
            // Skip if command already defined
            if (commands[reactionName]) return;
            
            // Define command dynamically
            commands[reactionName] = async (sock, msg, args) => {
                const target = args.join(' ') || 'you';
                await sendReaction(sock, msg, reactionName, `*${reactionName.charAt(0).toUpperCase() + reactionName.slice(1)}s ${target}* 😄`);
            };
        }
    });
} catch (err) {
    console.error(`Error loading reaction GIFs: ${err.message}`);
}

// Define command descriptions
const descriptions = {
    hug: 'Send a hug to someone',
    slap: 'Slap someone (jokingly)',
    pat: 'Pat someone gently',
    kiss: 'Kiss someone',
    punch: 'Punch someone (jokingly)',
    cry: 'Show crying reaction',
    dance: 'Show dance reaction',
    smile: 'Show smile reaction',
    reactions: 'List all available reaction commands'
};

module.exports = {
    commands,
    descriptions
};