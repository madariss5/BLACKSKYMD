/**
 * Permissions Utility
 * Handles verification of user permissions for command access
 */

/**
 * Check if a user is the bot owner
 * @param {string} jid User JID to check
 * @returns {Promise<boolean>} Whether the user is the bot owner
 */
async function isBotOwner(jid) {
  try {
    // Normalize JID to handle different formats
    const normalizedJid = jid.split('@')[0].replace(/[^0-9]/g, '');
    
    // Get owner number from environment variable
    const ownerNumber = process.env.OWNER_NUMBER || '';
    const normalizedOwner = ownerNumber.replace(/[^0-9]/g, '');
    
    return normalizedJid.includes(normalizedOwner) || normalizedJid === normalizedOwner;
  } catch (error) {
    console.error(`Error checking bot owner status: ${error.message}`);
    return false;
  }
}

/**
 * Check if a user is a group admin
 * @param {Object} sock WhatsApp socket connection
 * @param {string} groupJid Group JID
 * @param {string} userJid User JID to check
 * @returns {Promise<boolean>} Whether the user is a group admin
 */
async function isGroupAdmin(sock, groupJid, userJid) {
  try {
    const groupMetadata = await sock.groupMetadata(groupJid);
    const normalizedUserJid = userJid.split('@')[0];
    
    // Check if user is in the list of admins
    for (const participant of groupMetadata.participants) {
      if (participant.id.split('@')[0] === normalizedUserJid && 
          (participant.admin === 'admin' || participant.admin === 'superadmin')) {
        return true;
      }
    }
    
    return false;
  } catch (error) {
    console.error(`Error checking group admin status: ${error.message}`);
    return false;
  }
}

/**
 * Check if a command is allowed in the current context (DM or group)
 * @param {Object} msg Message object
 * @param {Object} command Command object with access property
 * @returns {Promise<boolean>} Whether the command is allowed
 */
async function isCommandAllowed(sock, msg, command) {
  const isGroupChat = msg.key.remoteJid.endsWith('@g.us');
  const senderJID = msg.key.fromMe ? sock.user.id : msg.key.remoteJid;
  
  // Always allow bot owner
  if (await isBotOwner(senderJID)) return true;
  
  // Check command access restrictions
  const access = command.access || 'all';
  
  switch (access) {
    case 'owner':
      return await isBotOwner(senderJID);
      
    case 'admin':
      if (!isGroupChat) return false;
      return await isGroupAdmin(sock, msg.key.remoteJid, senderJID);
      
    case 'group':
      return isGroupChat;
      
    case 'private':
      return !isGroupChat;
      
    case 'all':
    default:
      return true;
  }
}

module.exports = {
  isBotOwner,
  isGroupAdmin,
  isCommandAllowed
};