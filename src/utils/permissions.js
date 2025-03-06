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
        const groupMetadata = await sock.groupMetadata(groupId);
        const admins = groupMetadata.participants.filter(p => p.admin).map(p => p.id);
        return admins.includes(userId);
    } catch (err) {
        console.error('Error checking admin status:', err);
        return false;
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
        const botId = sock.user.id;
        const admins = groupMetadata.participants.filter(p => p.admin).map(p => p.id);
        return admins.includes(botId);
    } catch (err) {
        console.error('Error checking bot admin status:', err);
        return false;
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
        const groupMetadata = await sock.groupMetadata(groupId);
        return groupMetadata.owner === userId;
    } catch (err) {
        console.error('Error checking owner status:', err);
        return false;
    }
}

module.exports = {
    isAdmin,
    isBotAdmin,
    isOwner
};
