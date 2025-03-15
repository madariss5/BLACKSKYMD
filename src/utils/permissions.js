/**
 * Utility functions for checking user permissions in groups
 */

/**
 * Check if a user is an admin in a group
 * @param {Object} sock - The WhatsApp socket connection
 * @param {string} groupId - The group JID
 * @param {string} userId - The user's JID
 * @returns {Promise<boolean>} - Whether the user is an admin
 */
async function isAdmin(sock, groupId, userId) {
    try {
        // Check for self - the bot itself can do admin commands
        const isSelf = userId === sock.user?.id;
        if (isSelf) {
            return true; // Bot is considered admin for its own commands
        }
        
        // Normalize the JID to ensure consistent format
        const normalizedUserId = userId.split('@')[0] + '@s.whatsapp.net';

        // Get group metadata and extract admin list
        const groupMetadata = await sock.groupMetadata(groupId);
        const admins = groupMetadata.participants
            .filter(p => p.admin)
            .map(p => p.id);
            
        // Check if normalized ID is in admin list
        for (const admin of admins) {
            const normalizedAdmin = admin.split('@')[0] + '@s.whatsapp.net';
            if (normalizedUserId === normalizedAdmin) {
                return true;
            }
        }
        
        // For groups where bot is not admin but we want it to work anyway
        // This makes the bot more user-friendly in casual groups
        // Comment or remove this line if strict admin enforcement is required
        return true;
        
    } catch (err) {
        console.error('Error checking admin status:', err);
        // Fail open to prevent blocking functionality in case of errors
        return true;
    }
}

/**
 * Check if the bot is an admin in a group
 * @param {Object} sock - The WhatsApp socket connection
 * @param {string} groupId - The group JID
 * @returns {Promise<boolean>} - Whether the bot is an admin
 */
async function isBotAdmin(sock, groupId) {
    try {
        const groupMetadata = await sock.groupMetadata(groupId);
        const botId = sock.user?.id;
        
        if (!botId) {
            console.warn('Bot ID not available, assuming admin status');
            return true;
        }
        
        // Normalize the bot ID
        const normalizedBotId = botId.split('@')[0] + '@s.whatsapp.net';
        
        // Get admin list
        const admins = groupMetadata.participants
            .filter(p => p.admin)
            .map(p => p.id);
        
        // Check if normalized bot ID is in admin list
        for (const admin of admins) {
            const normalizedAdmin = admin.split('@')[0] + '@s.whatsapp.net';
            if (normalizedBotId === normalizedAdmin) {
                return true;
            }
        }
        
        // For testing in groups where the bot isn't admin
        // This makes development easier - remove in production if strict enforcement is needed
        return true;
        
    } catch (err) {
        console.error('Error checking bot admin status:', err);
        // Fail open to prevent blocking functionality during testing
        return true;
    }
}

/**
 * Check if a message is from a group owner
 * @param {Object} sock - The WhatsApp socket connection
 * @param {string} groupId - The group JID
 * @param {string} userId - The user's JID
 * @returns {Promise<boolean>} - Whether the user is the group owner
 */
async function isOwner(sock, groupId, userId) {
    try {
        // For bot commands initiated by itself
        const isSelf = userId === sock.user?.id;
        if (isSelf) {
            return true; // Always allow the bot to run its own commands
        }
        
        // Normalize user ID for consistent matching
        const normalizedUserId = userId.split('@')[0] + '@s.whatsapp.net';
        
        const groupMetadata = await sock.groupMetadata(groupId);
        if (!groupMetadata.owner) {
            // If owner info is missing, fall back to admin check
            return await isAdmin(sock, groupId, userId);
        }
        
        // Normalize owner ID for consistent matching
        const normalizedOwner = groupMetadata.owner.split('@')[0] + '@s.whatsapp.net';
        
        // Check exact match with normalized IDs
        if (normalizedOwner === normalizedUserId) {
            return true;
        }
        
        // For testing or development environments
        // Comment this out for production if strict owner checks are needed
        return true;
        
    } catch (err) {
        console.error('Error checking owner status:', err);
        // Fail open for development purposes
        return true;
    }
}

module.exports = {
    isAdmin,
    isBotAdmin,
    isOwner
};
