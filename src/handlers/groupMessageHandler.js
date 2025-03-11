const logger = require('../utils/logger');
const { isAdmin } = require('../utils/permissions');

// Store message timestamps for spam detection
const messageTimestamps = new Map();

// Store warning counts for users
const userWarnings = new Map();

// Function to check if a message contains links
function containsLink(message) {
    try {
        const urlRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)/gi;
        return urlRegex.test(message);
    } catch (err) {
        logger.error('Error in containsLink check:', err);
        return false;
    }
}

// Function to check if a message contains toxic content
function containsToxicContent(message) {
    try {
        const toxicWords = ['toxic1', 'toxic2', 'toxic3']; // Add your toxic word list
        const messageWords = message.toLowerCase().split(/\s+/);
        return toxicWords.some(word => messageWords.includes(word.toLowerCase()));
    } catch (err) {
        logger.error('Error in toxicity check:', err);
        return false;
    }
}

// Function to check spam rate
function isSpamming(userId, groupId, limit) {
    try {
        const key = `${userId}-${groupId}`;
        const now = Date.now();
        const userTimestamps = messageTimestamps.get(key) || [];

        // Remove timestamps older than 1 minute
        const recentTimestamps = userTimestamps.filter(timestamp => 
            now - timestamp < 60000
        );

        // Update timestamps
        messageTimestamps.set(key, [...recentTimestamps, now]);

        // Check if message count exceeds limit
        return recentTimestamps.length >= limit;
    } catch (err) {
        logger.error('Error in spam check:', err);
        return false;
    }
}

// Function to manage warnings
function handleWarning(userId, groupId) {
    try {
        const key = `${userId}-${groupId}`;
        const warnings = userWarnings.get(key) || 0;
        userWarnings.set(key, warnings + 1);
        return warnings + 1;
    } catch (err) {
        logger.error('Error in warning management:', err);
        return 0;
    }
}

async function handleGroupMessage(sock, message) {
    try {
        const remoteJid = message.key.remoteJid;

        // Only process group messages
        if (!remoteJid.endsWith('@g.us')) {
            logger.debug('Message not from group, skipping');
            return;
        }

        const sender = message.key.participant;
        const messageText = message.message?.conversation || 
                          message.message?.extendedTextMessage?.text || '';

        logger.debug(`Processing group message from ${sender}`);

        // Get group metadata and settings
        const groupMetadata = await sock.groupMetadata(remoteJid);
        const settings = groupMetadata.settings || {};

        // Skip checks for admins
        const isUserAdmin = await isAdmin(sock, remoteJid, sender);
        if (isUserAdmin) {
            logger.debug('Message from admin, skipping checks');
            return;
        }

        // Anti-link check
        if (settings.antilink && containsLink(messageText)) {
            logger.info(`Link detected from ${sender}, taking action`);
            await sock.sendMessage(remoteJid, {
                text: `⚠️ @${sender.split('@')[0]} Links are not allowed in this group!`,
                mentions: [sender]
            });
            await sock.sendMessage(remoteJid, { delete: message.key });
            const warnings = handleWarning(sender, remoteJid);
            if (warnings >= 3) {
                await sock.groupParticipantsUpdate(remoteJid, [sender], 'remove');
                await sock.sendMessage(remoteJid, {
                    text: `🚫 @${sender.split('@')[0]} has been removed for multiple violations`,
                    mentions: [sender]
                });
            }
            return;
        }

        // Anti-spam check
        if (settings.antispam) {
            const spamLimit = settings.spamLimit || 10;
            if (isSpamming(sender, remoteJid, spamLimit)) {
                logger.info(`Spam detected from ${sender}, taking action`);
                await sock.sendMessage(remoteJid, {
                    text: `⚠️ @${sender.split('@')[0]} Please don't spam!`,
                    mentions: [sender]
                });
                await sock.sendMessage(remoteJid, { delete: message.key });
                const warnings = handleWarning(sender, remoteJid);
                if (warnings >= 3) {
                    await sock.groupParticipantsUpdate(remoteJid, [sender], 'remove');
                    await sock.sendMessage(remoteJid, {
                        text: `🚫 @${sender.split('@')[0]} has been removed for multiple violations`,
                        mentions: [sender]
                    });
                }
                return;
            }
        }

        // Anti-toxic check
        if (settings.antitoxic && containsToxicContent(messageText)) {
            logger.info(`Toxic content detected from ${sender}, taking action`);
            await sock.sendMessage(remoteJid, {
                text: `⚠️ @${sender.split('@')[0]} Please maintain group decorum!`,
                mentions: [sender]
            });
            await sock.sendMessage(remoteJid, { delete: message.key });
            const warnings = handleWarning(sender, remoteJid);
            if (warnings >= 3) {
                await sock.groupParticipantsUpdate(remoteJid, [sender], 'remove');
                await sock.sendMessage(remoteJid, {
                    text: `🚫 @${sender.split('@')[0]} has been removed for multiple violations`,
                    mentions: [sender]
                });
            }
            return;
        }

    } catch (err) {
        logger.error('Error in group message handler:', err);
    }
}

module.exports = { handleGroupMessage };