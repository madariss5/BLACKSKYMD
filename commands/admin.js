/**
 * Admin Commands Module
 * Contains commands for group administration and bot management
 */

const fs = require('fs');
const path = require('path');

// Owner check function
function isOwner(sender) {
  const ownerNumber = process.env.OWNER_NUMBER || '1234567890';
  return sender.includes(ownerNumber);
}

// Function to check if a user is a group admin
async function isGroupAdmin(sock, groupId, sender) {
  try {
    const groupMetadata = await sock.groupMetadata(groupId);
    const admins = groupMetadata.participants
      .filter(p => p.admin)
      .map(p => p.id);
    
    return admins.includes(sender);
  } catch (error) {
    console.error('Error checking group admin:', error);
    return false;
  }
}

// Kick a user from a group
async function kick(sock, m, args) {
  try {
    const messageInfo = m.messages[0];
    const jid = messageInfo.key.remoteJid;
    const sender = messageInfo.key.participant || messageInfo.key.remoteJid;
    
    // Check if this is a group
    if (!jid.endsWith('@g.us')) {
      await sock.sendMessage(jid, { text: '❌ This command can only be used in groups!' });
      return;
    }
    
    // Check if the sender is an admin
    const isAdmin = await isGroupAdmin(sock, jid, sender);
    if (!isAdmin) {
      await sock.sendMessage(jid, { text: '❌ This command can only be used by group admins!' });
      return;
    }
    
    // Check if a user is mentioned
    const mentionedJid = messageInfo.message?.extendedTextMessage?.contextInfo?.mentionedJid;
    if (!mentionedJid || mentionedJid.length === 0) {
      await sock.sendMessage(jid, { text: '❌ You need to @mention the user you want to kick!' });
      return;
    }
    
    // Get the first mentioned user
    const userToKick = mentionedJid[0];
    
    // Kick the user
    await sock.groupParticipantsUpdate(jid, [userToKick], 'remove');
    await sock.sendMessage(jid, { text: `✅ @${userToKick.split('@')[0]} has been removed from the group.` });
  } catch (error) {
    console.error('Error in kick command:', error);
    const jid = m.messages[0].key.remoteJid;
    await sock.sendMessage(jid, { text: `❌ Error: ${error.message}` });
  }
}

// Promote a user to admin
async function promote(sock, m, args) {
  try {
    const messageInfo = m.messages[0];
    const jid = messageInfo.key.remoteJid;
    const sender = messageInfo.key.participant || messageInfo.key.remoteJid;
    
    // Check if this is a group
    if (!jid.endsWith('@g.us')) {
      await sock.sendMessage(jid, { text: '❌ This command can only be used in groups!' });
      return;
    }
    
    // Check if the sender is an admin
    const isAdmin = await isGroupAdmin(sock, jid, sender);
    if (!isAdmin) {
      await sock.sendMessage(jid, { text: '❌ This command can only be used by group admins!' });
      return;
    }
    
    // Check if a user is mentioned
    const mentionedJid = messageInfo.message?.extendedTextMessage?.contextInfo?.mentionedJid;
    if (!mentionedJid || mentionedJid.length === 0) {
      await sock.sendMessage(jid, { text: '❌ You need to @mention the user you want to promote!' });
      return;
    }
    
    // Get the first mentioned user
    const userToPromote = mentionedJid[0];
    
    // Promote the user
    await sock.groupParticipantsUpdate(jid, [userToPromote], 'promote');
    await sock.sendMessage(jid, { text: `✅ @${userToPromote.split('@')[0]} has been promoted to admin.` });
  } catch (error) {
    console.error('Error in promote command:', error);
    const jid = m.messages[0].key.remoteJid;
    await sock.sendMessage(jid, { text: `❌ Error: ${error.message}` });
  }
}

// Demote a user from admin
async function demote(sock, m, args) {
  try {
    const messageInfo = m.messages[0];
    const jid = messageInfo.key.remoteJid;
    const sender = messageInfo.key.participant || messageInfo.key.remoteJid;
    
    // Check if this is a group
    if (!jid.endsWith('@g.us')) {
      await sock.sendMessage(jid, { text: '❌ This command can only be used in groups!' });
      return;
    }
    
    // Check if the sender is an admin
    const isAdmin = await isGroupAdmin(sock, jid, sender);
    if (!isAdmin) {
      await sock.sendMessage(jid, { text: '❌ This command can only be used by group admins!' });
      return;
    }
    
    // Check if a user is mentioned
    const mentionedJid = messageInfo.message?.extendedTextMessage?.contextInfo?.mentionedJid;
    if (!mentionedJid || mentionedJid.length === 0) {
      await sock.sendMessage(jid, { text: '❌ You need to @mention the user you want to demote!' });
      return;
    }
    
    // Get the first mentioned user
    const userToDemote = mentionedJid[0];
    
    // Demote the user
    await sock.groupParticipantsUpdate(jid, [userToDemote], 'demote');
    await sock.sendMessage(jid, { text: `✅ @${userToDemote.split('@')[0]} has been demoted from admin.` });
  } catch (error) {
    console.error('Error in demote command:', error);
    const jid = m.messages[0].key.remoteJid;
    await sock.sendMessage(jid, { text: `❌ Error: ${error.message}` });
  }
}

// Change group settings (only for group admins)
async function group(sock, m, args) {
  try {
    const messageInfo = m.messages[0];
    const jid = messageInfo.key.remoteJid;
    const sender = messageInfo.key.participant || messageInfo.key.remoteJid;
    
    // Check if this is a group
    if (!jid.endsWith('@g.us')) {
      await sock.sendMessage(jid, { text: '❌ This command can only be used in groups!' });
      return;
    }
    
    // Check if the sender is an admin
    const isAdmin = await isGroupAdmin(sock, jid, sender);
    if (!isAdmin) {
      await sock.sendMessage(jid, { text: '❌ This command can only be used by group admins!' });
      return;
    }
    
    // Check if a setting is specified
    if (args.length === 0) {
      await sock.sendMessage(jid, { text: '❌ Please specify a setting: open, close, or info' });
      return;
    }
    
    const setting = args[0].toLowerCase();
    
    switch (setting) {
      case 'open':
        await sock.groupSettingUpdate(jid, 'not_announcement');
        await sock.sendMessage(jid, { text: '✅ Group has been opened. Everyone can send messages now.' });
        break;
        
      case 'close':
        await sock.groupSettingUpdate(jid, 'announcement');
        await sock.sendMessage(jid, { text: '✅ Group has been closed. Only admins can send messages now.' });
        break;
        
      case 'info':
        try {
          const groupMetadata = await sock.groupMetadata(jid);
          const participantCount = groupMetadata.participants.length;
          const adminCount = groupMetadata.participants.filter(p => p.admin).length;
          
          const infoMessage = `
📊 *Group Information* 📊

• *Name*: ${groupMetadata.subject}
• *Description*: ${groupMetadata.desc || 'No description'}
• *Created*: ${new Date(groupMetadata.creation * 1000).toLocaleString()}
• *Participants*: ${participantCount}
• *Admins*: ${adminCount}
• *Group ID*: ${jid}
`;
          
          await sock.sendMessage(jid, { text: infoMessage });
        } catch (error) {
          console.error('Error getting group info:', error);
          await sock.sendMessage(jid, { text: `❌ Error getting group info: ${error.message}` });
        }
        break;
        
      default:
        await sock.sendMessage(jid, { text: '❌ Invalid setting. Use: open, close, or info' });
    }
  } catch (error) {
    console.error('Error in group command:', error);
    const jid = m.messages[0].key.remoteJid;
    await sock.sendMessage(jid, { text: `❌ Error: ${error.message}` });
  }
}

// Reset command (owner only)
async function reset(sock, m, args) {
  const messageInfo = m.messages[0];
  const jid = messageInfo.key.remoteJid;
  const sender = messageInfo.key.participant || messageInfo.key.remoteJid;
  
  // Check if sender is the owner
  if (!isOwner(sender)) {
    await sock.sendMessage(jid, { text: '❌ This command can only be used by the bot owner!' });
    return;
  }
  
  await sock.sendMessage(jid, { text: '🔄 Resetting bot...' });
  
  // Create a reset flag file
  fs.writeFileSync('reload_commands.lock', 'reset');
  
  await sock.sendMessage(jid, { text: '✅ Reset flag created. Bot will restart on next connection cycle.' });
}

// Export all command handlers
module.exports = {
  kick,
  promote,
  demote,
  group,
  reset
};