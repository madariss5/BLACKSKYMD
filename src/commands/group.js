const logger = require('../utils/logger');
const { isAdmin, isBotAdmin } = require('../utils/permissions');
const { downloadMediaMessage } = require('../utils/helpers');
const path = require('path');
const fs = require('fs/promises');

// Helper functions for duration parsing
function parseDuration(str) {
    const match = str.match(/^(\d+)(s|m|h|d)$/);
    if (!match) return null;

    const num = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
        case 's': return num;
        case 'm': return num * 60;
        case 'h': return num * 60 * 60;
        case 'd': return num * 24 * 60 * 60;
        default: return null;
    }
}

function formatDuration(seconds) {
    if (seconds < 60) return `${seconds} seconds`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours`;
    return `${Math.floor(seconds / 86400)} days`;
}

const groupCommands = {
    async kick(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;

            // Check if command is used in a group
            if (!remoteJid.endsWith('@g.us')) {
                await sock.sendMessage(remoteJid, { text: '❌ This command can only be used in groups' });
                return;
            }

            // Check if sender is admin
            const sender = message.key.participant || message.key.remoteJid;
            const isUserAdmin = await isAdmin(sock, remoteJid, sender);
            if (!isUserAdmin) {
                await sock.sendMessage(remoteJid, { text: '❌ This command can only be used by admins' });
                return;
            }

            // Get mentioned user or quoted message
            let target;
            if (message.message.extendedTextMessage?.contextInfo?.participant) {
                target = message.message.extendedTextMessage.contextInfo.participant;
            } else if (args[0]) {
                target = args[0].replace('@', '') + '@s.whatsapp.net';
            }

            if (!target) {
                await sock.sendMessage(remoteJid, { text: '❌ Please mention a user to kick' });
                return;
            }

            // Check if target is admin
            const isTargetAdmin = await isAdmin(sock, remoteJid, target);
            if (isTargetAdmin) {
                await sock.sendMessage(remoteJid, { text: '❌ Cannot kick an admin' });
                return;
            }

            // Kick user
            await sock.groupParticipantsUpdate(remoteJid, [target], 'remove');
            await sock.sendMessage(remoteJid, { text: '✅ User has been kicked from the group' });

        } catch (err) {
            logger.error('Error in kick command:', err);
            await sock.sendMessage(message.key.remoteJid, { text: '❌ Failed to kick user' });
        }
    },

    async add(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;

            // Check if command is used in a group
            if (!remoteJid.endsWith('@g.us')) {
                await sock.sendMessage(remoteJid, { text: '❌ This command can only be used in groups' });
                return;
            }

            // Check if sender is admin
            const sender = message.key.participant || message.key.remoteJid;
            const isUserAdmin = await isAdmin(sock, remoteJid, sender);
            if (!isUserAdmin) {
                await sock.sendMessage(remoteJid, { text: '❌ This command can only be used by admins' });
                return;
            }

            if (!args[0]) {
                await sock.sendMessage(remoteJid, { text: '❌ Please provide a phone number to add' });
                return;
            }

            // Format phone number
            let number = args[0].replace(/[+ -]/g, '');
            if (!number.includes('@s.whatsapp.net')) {
                number = number + '@s.whatsapp.net';
            }

            // Add user
            try {
                await sock.groupParticipantsUpdate(remoteJid, [number], 'add');
                await sock.sendMessage(remoteJid, { text: '✅ User has been added to the group' });
            } catch (err) {
                if (err.toString().includes('not-authorized')) {
                    await sock.sendMessage(remoteJid, { text: '❌ Bot must be admin to add users' });
                } else if (err.toString().includes('403')) {
                    await sock.sendMessage(remoteJid, { text: '❌ Cannot add user. They may have privacy settings enabled' });
                } else {
                    throw err;
                }
            }

        } catch (err) {
            logger.error('Error in add command:', err);
            await sock.sendMessage(message.key.remoteJid, { text: '❌ Failed to add user' });
        }
    },

    async promote(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;

            // Check if command is used in a group
            if (!remoteJid.endsWith('@g.us')) {
                await sock.sendMessage(remoteJid, { text: '❌ This command can only be used in groups' });
                return;
            }

            // Check if sender is admin
            const sender = message.key.participant || message.key.remoteJid;
            const isUserAdmin = await isAdmin(sock, remoteJid, sender);
            if (!isUserAdmin) {
                await sock.sendMessage(remoteJid, { text: '❌ This command can only be used by admins' });
                return;
            }

            // Get mentioned user or quoted message
            let target;
            if (message.message.extendedTextMessage?.contextInfo?.participant) {
                target = message.message.extendedTextMessage.contextInfo.participant;
            } else if (args[0]) {
                target = args[0].replace('@', '') + '@s.whatsapp.net';
            }

            if (!target) {
                await sock.sendMessage(remoteJid, { text: '❌ Please mention a user to promote' });
                return;
            }

            // Check if target is already admin
            const isTargetAdmin = await isAdmin(sock, remoteJid, target);
            if (isTargetAdmin) {
                await sock.sendMessage(remoteJid, { text: '❌ User is already an admin' });
                return;
            }

            // Promote user
            await sock.groupParticipantsUpdate(remoteJid, [target], 'promote');
            await sock.sendMessage(remoteJid, { text: '✅ User has been promoted to admin' });

        } catch (err) {
            logger.error('Error in promote command:', err);
            await sock.sendMessage(message.key.remoteJid, { text: '❌ Failed to promote user' });
        }
    },

    async demote(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;

            // Check if command is used in a group
            if (!remoteJid.endsWith('@g.us')) {
                await sock.sendMessage(remoteJid, { text: '❌ This command can only be used in groups' });
                return;
            }

            // Check if sender is admin
            const sender = message.key.participant || message.key.remoteJid;
            const isUserAdmin = await isAdmin(sock, remoteJid, sender);
            if (!isUserAdmin) {
                await sock.sendMessage(remoteJid, { text: '❌ This command can only be used by admins' });
                return;
            }

            // Get mentioned user or quoted message
            let target;
            if (message.message.extendedTextMessage?.contextInfo?.participant) {
                target = message.message.extendedTextMessage.contextInfo.participant;
            } else if (args[0]) {
                target = args[0].replace('@', '') + '@s.whatsapp.net';
            }

            if (!target) {
                await sock.sendMessage(remoteJid, { text: '❌ Please mention a user to demote' });
                return;
            }

            // Check if target is not admin
            const isTargetAdmin = await isAdmin(sock, remoteJid, target);
            if (!isTargetAdmin) {
                await sock.sendMessage(remoteJid, { text: '❌ User is not an admin' });
                return;
            }

            // Demote user
            await sock.groupParticipantsUpdate(remoteJid, [target], 'demote');
            await sock.sendMessage(remoteJid, { text: '✅ User has been demoted from admin' });

        } catch (err) {
            logger.error('Error in demote command:', err);
            await sock.sendMessage(message.key.remoteJid, { text: '❌ Failed to demote user' });
        }
    },
    // Anti-spam and Security
    async antispam(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;

            // Check if command is used in a group
            if (!remoteJid.endsWith('@g.us')) {
                await sock.sendMessage(remoteJid, { text: '❌ This command can only be used in groups' });
                return;
            }

            // Check if sender is admin
            const sender = message.key.participant || message.key.remoteJid;
            const isUserAdmin = await isAdmin(sock, remoteJid, sender);
            if (!isUserAdmin) {
                await sock.sendMessage(remoteJid, { text: '❌ This command can only be used by admins' });
                return;
            }

            const [action, limit] = args;
            if (!action || !['on', 'off', 'status'].includes(action)) {
                await sock.sendMessage(remoteJid, { 
                    text: '❌ Usage: !antispam <on|off|status> [messages/minute]' 
                });
                return;
            }

            // Get group metadata
            const groupMetadata = await sock.groupMetadata(remoteJid);

            // Initialize settings if not exists
            if (!groupMetadata.settings) {
                groupMetadata.settings = {};
            }

            if (action === 'status') {
                const status = groupMetadata.settings.antispam ? 'enabled' : 'disabled';
                const currentLimit = groupMetadata.settings.spamLimit || 10;
                await sock.sendMessage(remoteJid, { 
                    text: `🛡️ Anti-spam is currently ${status}\nLimit: ${currentLimit} messages/minute` 
                });
                return;
            }

            // Update settings
            const spamLimit = parseInt(limit) || 10; // Default: 10 messages per minute
            groupMetadata.settings.antispam = action === 'on';
            groupMetadata.settings.spamLimit = spamLimit;

            await sock.sendMessage(remoteJid, { 
                text: `✅ Anti-spam has been ${action === 'on' ? 'enabled' : 'disabled'}\n` +
                    (action === 'on' ? `Limit set to ${spamLimit} messages/minute` : '') 
            });

        } catch (err) {
            logger.error('Error in antispam command:', err);
            await sock.sendMessage(message.key.remoteJid, { text: '❌ Failed to update anti-spam setting' });
        }
    },

    async antilink(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;

            // Check if command is used in a group
            if (!remoteJid.endsWith('@g.us')) {
                await sock.sendMessage(remoteJid, { text: '❌ This command can only be used in groups' });
                return;
            }

            // Check if sender is admin
            const sender = message.key.participant || message.key.remoteJid;
            const isUserAdmin = await isAdmin(sock, remoteJid, sender);
            if (!isUserAdmin) {
                await sock.sendMessage(remoteJid, { text: '❌ This command can only be used by admins' });
                return;
            }

            const [action] = args;
            if (!action || !['on', 'off', 'status'].includes(action)) {
                await sock.sendMessage(remoteJid, { text: '❌ Usage: !antilink <on|off|status>' });
                return;
            }

            // Get group metadata
            const groupMetadata = await sock.groupMetadata(remoteJid);

            // Initialize settings if not exists
            if (!groupMetadata.settings) {
                groupMetadata.settings = {};
            }

            if (action === 'status') {
                const status = groupMetadata.settings.antilink ? 'enabled' : 'disabled';
                await sock.sendMessage(remoteJid, { text: `🔗 Anti-link is currently ${status}` });
                return;
            }

            // Update setting
            groupMetadata.settings.antilink = action === 'on';
            await sock.sendMessage(remoteJid, { 
                text: `✅ Anti-link has been ${action === 'on' ? 'enabled' : 'disabled'}` 
            });

        } catch (err) {
            logger.error('Error in antilink command:', err);
            await sock.sendMessage(message.key.remoteJid, { text: '❌ Failed to update anti-link setting' });
        }
    },

    async antitoxic(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;

            // Check if command is used in a group
            if (!remoteJid.endsWith('@g.us')) {
                await sock.sendMessage(remoteJid, { text: '❌ This command can only be used in groups' });
                return;
            }

            // Check if sender is admin
            const sender = message.key.participant || message.key.remoteJid;
            const isUserAdmin = await isAdmin(sock, remoteJid, sender);
            if (!isUserAdmin) {
                await sock.sendMessage(remoteJid, { text: '❌ This command can only be used by admins' });
                return;
            }

            const [action] = args;
            if (!action || !['on', 'off', 'status'].includes(action)) {
                await sock.sendMessage(remoteJid, { text: '❌ Usage: !antitoxic <on|off|status>' });
                return;
            }

            // Get group metadata
            const groupMetadata = await sock.groupMetadata(remoteJid);

            // Initialize settings if not exists
            if (!groupMetadata.settings) {
                groupMetadata.settings = {};
            }

            if (action === 'status') {
                const status = groupMetadata.settings.antitoxic ? 'enabled' : 'disabled';
                await sock.sendMessage(remoteJid, { text: `🛡️ Anti-toxic is currently ${status}` });
                return;
            }

            // Update setting
            groupMetadata.settings.antitoxic = action === 'on';
            await sock.sendMessage(remoteJid, { 
                text: `✅ Anti-toxic has been ${action === 'on' ? 'enabled' : 'disabled'}` 
            });

        } catch (err) {
            logger.error('Error in antitoxic command:', err);
            await sock.sendMessage(message.key.remoteJid, { text: '❌ Failed to update anti-toxic setting' });
        }
    },

    async antiraid(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;

            // Check if command is used in a group
            if (!remoteJid.endsWith('@g.us')) {
                await sock.sendMessage(remoteJid, { text: '❌ This command can only be used in groups' });
                return;
            }

            // Check if sender is admin
            const sender = message.key.participant || message.key.remoteJid;
            const isUserAdmin = await isAdmin(sock, remoteJid, sender);
            if (!isUserAdmin) {
                await sock.sendMessage(remoteJid, { text: '❌ This command can only be used by admins' });
                return;
            }

            const [action] = args;
            if (!action || !['on', 'off', 'status'].includes(action)) {
                await sock.sendMessage(remoteJid, { text: '❌ Usage: !antiraid <on|off|status>' });
                return;
            }

            // Get group metadata
            const groupMetadata = await sock.groupMetadata(remoteJid);

            // Initialize settings if not exists
            if (!groupMetadata.settings) {
                groupMetadata.settings = {};
            }

            if (action === 'status') {
                const status = groupMetadata.settings.antiraid ? 'enabled' : 'disabled';
                const cooldown = groupMetadata.settings.raidCooldown || 60; // Default 60 seconds
                await sock.sendMessage(remoteJid, { 
                    text: `🛡️ Anti-raid is currently ${status}\nNew member join cooldown: ${cooldown} seconds` 
                });
                return;
            }

            // Update setting
            groupMetadata.settings.antiraid = action === 'on';
            groupMetadata.settings.raidCooldown = 60; // Default cooldown period
            groupMetadata.settings.lastJoinTime = Date.now();
            groupMetadata.settings.joinQueue = new Set();

            await sock.sendMessage(remoteJid, { 
                text: `✅ Anti-raid has been ${action === 'on' ? 'enabled' : 'disabled'}` 
            });

        } catch (err) {
            logger.error('Error in antiraid command:', err);
            await sock.sendMessage(message.key.remoteJid, { text: '❌ Failed to update anti-raid setting' });
        }
    },

    // Member Control
    async warn(sock, message, args) {
        const remoteJid = message.key.remoteJid;
        const [user, ...reason] = args;
        if (!user) {
            await sock.sendMessage(remoteJid, { text: '⚠️ Please specify a user to warn' });
            return;
        }
        // TODO: Implement warning system
        await sock.sendMessage(remoteJid, { text: `⚠️ Warned ${user}${reason.length ? ` for: ${reason.join(' ')}` : ''}` });
    },

    async removewarn(sock, message, args) {
        const remoteJid = message.key.remoteJid;
        const user = args[0];
        if (!user) {
            await sock.sendMessage(remoteJid, { text: '⚠️ Please specify a user' });
            return;
        }
        // TODO: Implement warning removal
        await sock.sendMessage(remoteJid, { text: `✅ Removed warning from ${user}` });
    },

    async warnings(sock, message, args) {
        const remoteJid = message.key.remoteJid;
        const user = args[0];
        // TODO: Implement warnings check
        await sock.sendMessage(remoteJid, { text: user ? `📋 Warnings for ${user}: [Count]` : '📋 Group warnings: [List]' });
    },

    async mute(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;

            // Check if command is used in a group
            if (!remoteJid.endsWith('@g.us')) {
                await sock.sendMessage(remoteJid, { text: '❌ This command can only be used in groups' });
                return;
            }

            // Check if sender is admin
            const sender = message.key.participant || message.key.remoteJid;
            const isUserAdmin = await isAdmin(sock, remoteJid, sender);
            if (!isUserAdmin) {
                await sock.sendMessage(remoteJid, { text: '❌ This command can only be used by admins' });
                return;
            }

            // Check if bot is admin
            const isBotAdminInGroup = await isBotAdmin(sock, remoteJid);
            if (!isBotAdminInGroup) {
                await sock.sendMessage(remoteJid, { text: '❌ Bot must be admin to mute the group' });
                return;
            }

            // Parse duration
            let duration = args[0] ? parseDuration(args[0]) : 1 * 60 * 60; // Default 1 hour
            if (duration === null) {
                await sock.sendMessage(remoteJid, {
                    text: '❌ Invalid duration format. Use numbers followed by s/m/h/d\nExample: 30s, 5m, 2h, 1d'
                });
                return;
            }

            // Update group settings
            await sock.groupSettingUpdate(remoteJid, 'announcement');

            // Send confirmation
            const durationText = formatDuration(duration);
            await sock.sendMessage(remoteJid, {
                text: `🔇 Group has been muted for ${durationText}`
            });

            // Schedule unmute
            setTimeout(async () => {
                try {
                    await sock.groupSettingUpdate(remoteJid, 'not_announcement');
                    await sock.sendMessage(remoteJid, { text: '🔊 Group has been automatically unmuted' });
                } catch (err) {
                    logger.error('Error in auto-unmute:', err);
                }
            }, duration * 1000);

        } catch (err) {
            logger.error('Error in mute command:', err);
            await sock.sendMessage(message.key.remoteJid, { text: '❌ Failed to mute group' });
        }
    },

    async unmute(sock, message) {
        try {
            const remoteJid = message.key.remoteJid;

            // Check if command is used in a group
            if (!remoteJid.endsWith('@g.us')) {
                await sock.sendMessage(remoteJid, { text: '❌ This command can only be used in groups' });
                return;
            }

            // Check if sender is admin
            const sender = message.key.participant || message.key.remoteJid;
            const isUserAdmin = await isAdmin(sock, remoteJid, sender);
            if (!isUserAdmin) {
                await sock.sendMessage(remoteJid, { text: '❌ This command can only be used by admins' });
                return;
            }

            // Check if bot is admin
            const isBotAdminInGroup = await isBotAdmin(sock, remoteJid);
            if (!isBotAdminInGroup) {
                await sock.sendMessage(remoteJid, { text: '❌ Bot must be admin to unmute the group' });
                return;
            }

            // Update group settings
            await sock.groupSettingUpdate(remoteJid, 'not_announcement');
            await sock.sendMessage(remoteJid, { text: '🔊 Group has been unmuted' });

        } catch (err) {
            logger.error('Error in unmute command:', err);
            await sock.sendMessage(message.key.remoteJid, { text: '❌ Failed to unmute group' });
        }
    },

    // Group Settings
    async setdesc(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;

            // Check if command is used in a group
            if (!remoteJid.endsWith('@g.us')) {
                await sock.sendMessage(remoteJid, { text: '❌ This command can only be used in groups' });
                return;
            }

            // Check if sender is admin
            const sender = message.key.participant || message.key.remoteJid;
            const isUserAdmin = await isAdmin(sock, remoteJid, sender);
            if (!isUserAdmin) {
                await sock.sendMessage(remoteJid, { text: '❌ This command can only be used by admins' });
                return;
            }

            const desc = args.join(' ');
            if (!desc) {
                await sock.sendMessage(remoteJid, { text: '❌ Please provide a description' });
                return;
            }

            // Update group description
            await sock.groupUpdateDescription(remoteJid, desc);
            await sock.sendMessage(remoteJid, { text: '✅ Group description has been updated' });

        } catch (err) {
            logger.error('Error in setdesc command:', err);
            await sock.sendMessage(message.key.remoteJid, { text: '❌ Failed to update group description' });
        }
    },

    async setname(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;

            // Check if command is used in a group
            if (!remoteJid.endsWith('@g.us')) {
                await sock.sendMessage(remoteJid, { text: '❌ This command can only be used in groups' });
                return;
            }

            // Check if sender is admin
            const sender = message.key.participant || message.key.remoteJid;
            const isUserAdmin = await isAdmin(sock, remoteJid, sender);
            if (!isUserAdmin) {
                await sock.sendMessage(remoteJid, { text: '❌ This command can only be used by admins' });
                return;
            }

            const name = args.join(' ');
            if (!name) {
                await sock.sendMessage(remoteJid, { text: '❌ Please provide a name' });
                return;
            }

            // Update group name
            await sock.groupUpdateSubject(remoteJid, name);
            await sock.sendMessage(remoteJid, { text: '✅ Group name has been updated' });

        } catch (err) {
            logger.error('Error in setname command:', err);
            await sock.sendMessage(message.key.remoteJid, { text: '❌ Failed to update group name' });
        }
    },

    async setppic(sock, message) {
        try {
            const remoteJid = message.key.remoteJid;

            // Check if command is used in a group
            if (!remoteJid.endsWith('@g.us')) {
                await sock.sendMessage(remoteJid, { text: '❌ This command can only be used in groups' });
                return;
            }

            // Check if sender is admin
            const sender = message.key.participant || message.key.remoteJid;
            const isUserAdmin = await isAdmin(sock, remoteJid, sender);
            if (!isUserAdmin) {
                await sock.sendMessage(remoteJid, { text: '❌ This command can only be used by admins' });
                return;
            }

            // Check if image is provided
            if (!message.message?.imageMessage) {
                await sock.sendMessage(remoteJid, { text: '❌ Please send an image with the command' });
                return;
            }

            const buffer = await downloadMediaMessage(message, 'buffer', {});

            // Update group profile picture
            await sock.updateProfilePicture(remoteJid, buffer);
            await sock.sendMessage(remoteJid, { text: '✅ Group profile picture has been updated' });

        } catch (err) {
            logger.error('Error in setppic command:', err);
            await sock.sendMessage(message.key.remoteJid, { text: '❌ Failed to update group profile picture' });
        }
    },

    // Polls and Voting
    async poll(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;

            // Check if command is used in a group
            if (!remoteJid.endsWith('@g.us')) {
                await sock.sendMessage(remoteJid, { text: '❌ This command can only be used in groups' });
                return;
            }

            // Check if sender is admin
            const sender = message.key.participant || message.key.remoteJid;
            const isUserAdmin = await isAdmin(sock, remoteJid, sender);
            if (!isUserAdmin) {
                await sock.sendMessage(remoteJid, { text: '❌ This command can only be used by admins' });
                return;
            }

            // Parse poll options
            const [title, ...options] = args;
            if (!title || options.length < 2) {
                await sock.sendMessage(remoteJid, {
                    text: '❌ Usage: !poll [title] [option1] [option2] ...\nExample: !poll "Best food?" Pizza Burger Sushi'
                });
                return;
            }

            // Create poll message
            const pollMessage = {
                poll: {
                    name: title,
                    values: options,
                    selectableCount: 1
                }
            };

            await sock.sendMessage(remoteJid, pollMessage);

        } catch (err) {
            logger.error('Error in poll command:', err);
            await sock.sendMessage(message.key.remoteJid, { text: '❌ Failed to create poll' });
        }
    },

    async vote(sock, message, args) {
        const remoteJid = message.key.remoteJid;
        const [pollId, choice] = args;
        if (!pollId || !choice) {
            await sock.sendMessage(remoteJid, { text: '⚠️ Usage: !vote [poll_id] [choice]' });
            return;
        }
        // TODO: Implement voting
        await sock.sendMessage(remoteJid, { text: '✅ Vote recorded' });
    },

    async endpoll(sock, message, args) {
        const remoteJid = message.key.remoteJid;
        const [pollId] = args;
        if (!pollId) {
            await sock.sendMessage(remoteJid, { text: '⚠️ Please specify poll ID' });
            return;
        }
        // TODO: Implement poll ending
        await sock.sendMessage(remoteJid, { text: '📊 Poll ended' });
    },

    // Group Games and Engagement
    async quiz(sock, message, args) {
        const remoteJid = message.key.remoteJid;
        const [action] = args;
        if (!action || !['start', 'stop', 'score'].includes(action)) {
            await sock.sendMessage(remoteJid, { text: '⚠️ Usage: !quiz <start|stop|score>' });
            return;
        }
        // TODO: Implement quiz game
        await sock.sendMessage(remoteJid, { text: '🎮 Quiz game started' });
    },

    async trivia(sock, message, args) {
        const remoteJid = message.key.remoteJid;
        const [category] = args;
        const categories = ['general', 'science', 'history', 'entertainment'];
        if (!category || !categories.includes(category)) {
            await sock.sendMessage(remoteJid, { text: `📚 Available categories: ${categories.join(', ')}` });
            return;
        }
        // TODO: Implement trivia
        await sock.sendMessage(remoteJid, { text: '❓ Trivia question sent' });
    },

    async wordchain(sock, message, args) {
        const remoteJid = message.key.remoteJid;
        const [action] = args;
        if (!action || !['start', 'play', 'end'].includes(action)) {
            await sock.sendMessage(remoteJid, { text: '⚠️ Usage: !wordchain <start|play|end>' });
            return;
        }
        // TODO: Implement word chain game
        await sock.sendMessage(remoteJid, { text: '🎮 Word chain game started' });
    },

    // Announcement System
    async announce(sock, message, args) {
        const remoteJid = message.key.remoteJid;
        const messageText = args.join(' ');
        if (!messageText) {
            await sock.sendMessage(remoteJid, { text: '⚠️ Please provide an announcement message' });
            return;
        }
        // TODO: Implement announcement
        await sock.sendMessage(remoteJid, { text: '📢 Announcement sent' });
    },

    async schedule(sock, message, args) {
        const remoteJid = message.key.remoteJid;
        const [time, ...messageText] = args;
        if (!time || !messageText.length) {
            await sock.sendMessage(remoteJid, { text: '⚠️ Usage: !schedule [time] [message]' });
            return;
        }
        // TODO: Implement scheduled announcement
        await sock.sendMessage(remoteJid, { text: '⏰ Announcement scheduled' });
    },

    // Implement role management
    async role(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;

            // Check if command is used in a group
            if (!remoteJid.endsWith('@g.us')) {
                await sock.sendMessage(remoteJid, { text: '❌ This command can only be used in groups' });
                return;
            }

            // Check if sender is admin
            const sender = message.key.participant || message.key.remoteJid;
            const isUserAdmin = await isAdmin(sock, remoteJid, sender);
            if (!isUserAdmin) {
                await sock.sendMessage(remoteJid, { text: '❌ This command can only be used by admins' });
                return;
            }

            const [action, userMention, roleName] = args;
            if (!action || !['add', 'remove', 'list'].includes(action)) {
                await sock.sendMessage(remoteJid, { text: '❌ Usage: !role <add|remove|list> @user [role]' });
                return;
            }

            // Get group metadata
            const groupMetadata = await sock.groupMetadata(remoteJid);

            // Initialize roles if not exists
            if (!groupMetadata.roles) {
                groupMetadata.roles = new Map();
            }

            switch (action) {
                case 'add':
                    if (!userMention || !roleName) {
                        await sock.sendMessage(remoteJid, { text: '❌ Please specify both user and role' });
                        return;
                    }

                    const userToAdd = userMention.replace('@', '') + '@s.whatsapp.net';
                    
                    // Add role to user
                    if (!groupMetadata.roles.has(userToAdd)) {
                        groupMetadata.roles.set(userToAdd, new Set());
                    }
                    groupMetadata.roles.get(userToAdd).add(roleName);

                    await sock.sendMessage(remoteJid, {
                        text: `✅ Role "${roleName}" has been assigned to @${userToAdd.split('@')[0]}`,
                        mentions: [userToAdd]
                    });
                    break;

                case 'remove':
                    if (!userMention || !roleName) {
                        await sock.sendMessage(remoteJid, { text: '❌ Please specify both user and role' });
                        return;
                    }

                    const userToRemove = userMention.replace('@', '') + '@s.whatsapp.net';
                    
                    // Remove role from user
                    if (groupMetadata.roles.has(userToRemove)) {
                        groupMetadata.roles.get(userToRemove).delete(roleName);
                        if (groupMetadata.roles.get(userToRemove).size === 0) {
                            groupMetadata.roles.delete(userToRemove);
                        }
                    }

                    await sock.sendMessage(remoteJid, {
                        text: `✅ Role "${roleName}" has been removed from @${userToRemove.split('@')[0]}`,
                        mentions: [userToRemove]
                    });
                    break;

                case 'list':
                    if (userMention) {
                        // List roles for specific user
                        const user = userMention.replace('@', '') + '@s.whatsapp.net';
                        const userRoles = groupMetadata.roles.get(user);
                        
                        if (!userRoles || userRoles.size === 0) {
                            await sock.sendMessage(remoteJid, {
                                text: `📋 @${user.split('@')[0]} has no roles assigned`,
                                mentions: [user]
                            });
                        } else {
                            await sock.sendMessage(remoteJid, {
                                text: `📋 Roles for @${user.split('@')[0]}:\n${Array.from(userRoles).join('\n')}`,
                                mentions: [user]
                            });
                        }
                    } else {
                        // List all role assignments
                        let roleList = '*📋 Group Roles:*\n\n';
                        for (const [user, roles] of groupMetadata.roles) {
                            roleList += `@${user.split('@')[0]}: ${Array.from(roles).join(', ')}\n`;
                        }

                        if (groupMetadata.roles.size === 0) {
                            roleList = '📋 No roles have been assigned';
                        }

                        await sock.sendMessage(remoteJid, {
                            text: roleList,
                            mentions: Array.from(groupMetadata.roles.keys())
                        });
                    }
                    break;
            }

        } catch (err) {
            logger.error('Error in role command:', err);
            await sock.sendMessage(message.key.remoteJid, { text: '❌ Failed to manage roles' });
        }
    },

    // Welcome/Leave Settings
    async setwelcome(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;

            // Check if command is used in a group
            if (!remoteJid.endsWith('@g.us')) {
                await sock.sendMessage(remoteJid, { text: '❌ This command can only be used in groups' });
                return;
            }

            // Check if sender is admin
            const sender = message.key.participant || message.key.remoteJid;
            const isUserAdmin = await isAdmin(sock, remoteJid, sender);
            if (!isUserAdmin) {
                await sock.sendMessage(remoteJid, { text: '❌ This command can only be used by admins' });
                return;
            }

            const welcomeMsg = args.join(' ');
            if (!welcomeMsg) {
                await sock.sendMessage(remoteJid, { text: '❌ Please provide a welcome message' });
                return;
            }

            // Get group metadata
            const groupMetadata = await sock.groupMetadata(remoteJid);

            // Initialize settings if not exists
            if (!groupMetadata.settings) {
                groupMetadata.settings = {};
            }

            // Update welcome message
            groupMetadata.settings.welcomeMessage = welcomeMsg;
            await sock.sendMessage(remoteJid, { text: '✅ Welcome message has been set' });

        } catch (err) {
            logger.error('Error in setwelcome command:', err);
            await sock.sendMessage(message.key.remoteJid, { text: '❌ Failed to set welcome message' });
        }
    },

    async setgoodbye(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;

            // Check if command is used in a group
            if (!remoteJid.endsWith('@g.us')) {
                await sock.sendMessage(remoteJid, { text: '❌ This command can only be used in groups' });
                return;
            }

            // Check if sender is admin
            const sender = message.key.participant || message.key.remoteJid;
            const isUserAdmin = await isAdmin(sock, remoteJid, sender);
            if (!isUserAdmin) {
                await sock.sendMessage(remoteJid, { text: '❌ This command can only be used by admins' });
                return;
            }

            const goodbyeMsg = args.join(' ');
            if (!goodbyeMsg) {
                await sock.sendMessage(remoteJid, { text: '❌ Please provide a goodbye message' });
                return;
            }

            // Get group metadata
            const groupMetadata = await sock.groupMetadata(remoteJid);

            // Initialize settings if not exists
            if (!groupMetadata.settings) {
                groupMetadata.settings = {};
            }

            // Update goodbye message
            groupMetadata.settings.goodbyeMessage = goodbyeMsg;
            await sock.sendMessage(remoteJid, { text: '✅ Goodbye message has been set' });

        } catch (err) {
            logger.error('Error in setgoodbye command:', err);
            await sock.sendMessage(message.key.remoteJid, { text: '❌ Failed to set goodbye message' });
        }
    },

    // Group Statistics
    async stats(sock, message) {
        try {
            const remoteJid = message.key.remoteJid;

            // Check if command is used in a group
            if (!remoteJid.endsWith('@g.us')) {
                await sock.sendMessage(remoteJid, { text: '❌ This command can only be used in groups' });
                return;
            }

            // Get group metadata
            const groupMetadata = await sock.groupMetadata(remoteJid);
            const participants = groupMetadata.participants;

            // Calculate statistics
            const totalMembers = participants.length;
            const admins = participants.filter(p => p.admin).length;
            const regularMembers = totalMembers - admins;

            // Format statistics message
            const statsMessage = `*📊 Group Statistics*\n\n` +
                `*Total Members:* ${totalMembers}\n` +
                `*Admins:* ${admins}\n` +
                `*Regular Members:* ${regularMembers}\n` +
                `*Group Created:* ${new Date(groupMetadata.creation * 1000).toLocaleString()}\n`;

            await sock.sendMessage(remoteJid, { text: statsMessage });

        } catch (err) {
            logger.error('Error in stats command:', err);
            await sock.sendMessage(message.key.remoteJid, { text: '❌ Failed to get group statistics' });
        }
    },

    // Fix the purge command section
    async purge(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;

            // Check if command is used in a group
            if (!remoteJid.endsWith('@g.us')) {
                await sock.sendMessage(remoteJid, { text: '❌ This command can only be used in groups' });
                return;
            }

            // Check if sender is admin
            const sender = message.key.participant || message.key.remoteJid;
            const isUserAdmin = await isAdmin(sock, remoteJid, sender);
            if (!isUserAdmin) {
                await sock.sendMessage(remoteJid, { text: '❌ This command can only be used by admins' });
                return;
            }

            const count = parseInt(args[0]);
            if (isNaN(count) || count < 1 || count > 100) {
                await sock.sendMessage(remoteJid, { 
                    text: '❌ Please provide a valid number of messages to delete (1-100)' 
                });
                return;
            }

            await sock.sendMessage(remoteJid, { text: `⏳ Deleting ${count} messages...` });

            // Get message keys
            const chat = await sock.groupFetchAllParticipating();
            const messages = Object.values(chat[remoteJid].messages)
                .filter(m => m.key.fromMe)
                .slice(0, count);

            // Delete messages
            for (const msg of messages) {
                await sock.sendMessage(remoteJid, { delete: msg.key });
            }

            await sock.sendMessage(remoteJid, { text: `✅ Deleted ${messages.length} messages` });

        } catch (err) {
            logger.error('Error in purge command:', err);
            await sock.sendMessage(message.key.remoteJid, { text: '❌ Failed to purge messages' });
        }
    },

    // Fix the lock command section
    async lock(sock, message) {
        try {
            const remoteJid = message.key.remoteJid;

            // Check if command is used in a group
            if (!remoteJid.endsWith('@g.us')) {
                await sock.sendMessage(remoteJid, { text: '❌ This command can only be used in groups' });
                return;
            }

            // Check if sender is admin
            const sender = message.key.participant || message.key.remoteJid;
            const isUserAdmin = await isAdmin(sock, remoteJid, sender);
            if (!isUserAdmin) {
                await sock.sendMessage(remoteJid, { text: '❌ This command can only be used by admins' });
                return;
            }

            // Check if bot is admin
            const isBotAdminInGroup = await isBotAdmin(sock, remoteJid);
            if (!isBotAdminInGroup) {
                await sock.sendMessage(remoteJid, { text: '❌ Bot must be admin to lock the group' });
                return;
            }

            // Lock group (only admins can send messages)
            await sock.groupSettingUpdate(remoteJid, 'announcement');
            await sock.sendMessage(remoteJid, { text: '🔒 Group has been locked (only admins can send messages)' });

        } catch (err) {
            logger.error('Error in lock command:', err);
            await sock.sendMessage(message.key.remoteJid, { text: '❌ Failed to lock group' });
        }
    },

    async unlock(sock, message) {
        try {
            const remoteJid = message.key.remoteJid;

            // Check if command is used in a group
            if (!remoteJid.endsWith('@g.us')) {
                await sock.sendMessage(remoteJid, { text: '❌ This command can only be used in groups' });
                return;
            }

            // Check if sender is admin
            const sender = message.key.participant || message.key.remoteJid;
            const isUserAdmin = await isAdmin(sock, remoteJid, sender);
            if (!isUserAdmin) {
                await sock.sendMessage(remoteJid, { text: '❌ This command can only be used by admins' });
                return;
            }

            // Check if bot is admin
            const isBotAdminInGroup = await isBotAdmin(sock, remoteJid);
            if (!isBotAdminInGroup) {
                await sock.sendMessage(remoteJid, { text: '❌ Bot must be admin to unlock the group' });
                return;
            }

            // Unlock group
            await sock.groupSettingUpdate(remoteJid, 'not_announcement');
            await sock.sendMessage(remoteJid, { text: '🔓 Group has been unlocked' });

        } catch (err) {
            logger.error('Error in unlock command:', err);
            await sock.sendMessage(message.key.remoteJid, { text: '❌ Failed to unlock group' });
        }
    },

    // Group Information
    async groupinfo(sock, message) {
        try {
            const remoteJid = message.key.remoteJid;

            // Check if command is used in a group
            if (!remoteJid.endsWith('@g.us')) {
                await sock.sendMessage(remoteJid, { text: '❌ This command can only be used in groups' });
                return;
            }

            // Get group metadata
            const groupMetadata = await sock.groupMetadata(remoteJid);
            const { subject, desc, participants, owner } = groupMetadata;

            // Count admins and members
            const adminCount = participants.filter(p => p.admin).length;
            const memberCount = participants.length;

            // Format creation date
            const createdDate = new Date(groupMetadata.creation * 1000).toLocaleString();

            // Create info message
            const infoMessage = `*📊 Group Information*\n\n` +
                `*Name:* ${subject}\n` +
                `*Created:* ${createdDate}\n` +
                `*Members:* ${memberCount}\n` +
                `*Admins:* ${adminCount}\n` +
                `*Owner:* @${owner.split('@')[0]}\n\n` +
                `*Description:*\n${desc || 'No description set'}`;

            await sock.sendMessage(remoteJid, {
                text: infoMessage,
                mentions: [owner]
            });

        } catch (err) {
            logger.error('Error in groupinfo command:', err);
            await sock.sendMessage(message.key.remoteJid, { text: '❌ Failed to get group information' });
        }
    },

    async listmembers(sock, message) {
        const remoteJid = message.key.remoteJid;
        // TODO: Implement member list logic
        await sock.sendMessage(remoteJid, { text: 'Members List:\n• [Member List]' });
    },

    async listadmins(sock, message) {
        const remoteJid = message.key.remoteJid;
        // TODO: Implement admin list logic
        await sock.sendMessage(remoteJid, { text: 'Admins List:\n• [Admin List]' });
    },

    // Advanced Group Settings
    async settings(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;

            // Check if command is used in a group
            if (!remoteJid.endsWith('@g.us')) {
                await sock.sendMessage(remoteJid, { text: '❌ This command can only be used in groups' });
                return;
            }

            // Check if sender is admin
            const sender = message.key.participant || message.key.remoteJid;
            const isUserAdmin = await isAdmin(sock, remoteJid, sender);
            if (!isUserAdmin) {
                await sock.sendMessage(remoteJid, { text: '❌ This command can only be used by admins' });
                return;
            }

            const validSettings = ['antilink', 'antispam', 'welcome', 'goodbye', 'moderation'];
            const [setting, value] = args;

            if (!setting || !validSettings.includes(setting)) {
                await sock.sendMessage(remoteJid, {
                    text: `*⚙️ Available Settings:*\n${validSettings.join('\n')}\n\nUsage: !settings [setting] [on/off]`
                });
                return;
            }

            if (!value || !['on', 'off'].includes(value)) {
                await sock.sendMessage(remoteJid, { text: '❌ Please specify either "on" or "off"' });
                return;
            }

            // TODO: Implement settings storage
            await sock.sendMessage(remoteJid, { text: `✅ ${setting} has been turned ${value}` });

        } catch (err) {
            logger.error('Error in settings command:', err);
            await sock.sendMessage(message.key.remoteJid, { text: '❌ Failed to update settings' });
        }
    },


    async group(sock, message, args) {
        const remoteJid = message.key.remoteJid;
        if (!args[0]) {
            await sock.sendMessage(remoteJid, {
                text: 'Usage: !group <open|close|settings>'
            });
            return;
        }
        // Implement group settings logic here
        await sock.sendMessage(remoteJid, { text: 'Group settings updated' });
    },

    async groupname(sock, message, args) {
        const remoteJid = message.key.remoteJid;
        const name = args.join(' ');
        if (!name) {
            await sock.sendMessage(remoteJid, { text: 'Please specify a new group name' });
            return;
        }
        // Implement group name change logic here
        await sock.sendMessage(remoteJid, { text: `Group name changed to: ${name}` });
    },

    async groupdesc(sock, message, args) {
        const remoteJid = message.key.remoteJid;
        const desc = args.join(' ');
        if (!desc) {
            await sock.sendMessage(remoteJid, { text: 'Please specify a new group description' });
            return;
        }
        // Implement group description change logic here
        await sock.sendMessage(remoteJid, { text: 'Group description updated' });
    },

    async groupicon(sock, message) {
        const remoteJid = message.key.remoteJid;
        // Implement group icon change logic here
        await sock.sendMessage(remoteJid, { text: 'Group icon updated' });
    },

    // Group Configuration Commands
    async setprefix(sock, message, args) {
        const remoteJid = message.key.remoteJid;
        const prefix = args[0];
        if (!prefix) {
            await sock.sendMessage(remoteJid, { text: 'Please specify a new prefix' });
            return;
        }
        // TODO: Implement prefix change
        await sock.sendMessage(remoteJid, { text: `Group prefix set to: ${prefix}` });
    },

    async chatfilter(sock, message, args) {
        const remoteJid = message.key.remoteJid;
        const [action, word] = args;
        if (!action || (action !== 'list' && !word)) {
            await sock.sendMessage(remoteJid, {
                text: 'Usage: !chatfilter <add|remove|list> [word]'
            });
            return;
        }
        // TODO: Implement chat filter
        await sock.sendMessage(remoteJid, { text: `Chat filter ${action} command received` });
    },

    async slowmode(sock, message, args) {
        const remoteJid = message.key.remoteJid;
        const duration = args[0] || '10s';
        // TODO: Implement slowmode
        await sock.sendMessage(remoteJid, { text: `Slowmode set to ${duration}` });
    },

    async antisticker(sock, message, args) {
        const remoteJid = message.key.remoteJid;
        const status = args[0];
        if (!status || !['on', 'off'].includes(status)) {
            await sock.sendMessage(remoteJid, {
                text: 'Usage: !antisticker <on|off>'
            });
            return;
        }
        // TODO: Implement anti-sticker
        await sock.sendMessage(remoteJid, { text: `Anti-sticker ${status}` });
    },

    async grouplist(sock, message) {
        const remoteJid = message.key.remoteJid;
        // Implement group list logic here
        await sock.sendMessage(remoteJid, { text: 'Groups List:\n• No groups yet' });
    },

    // Additional Group Security
    async groupbackup(sock, message) {
        try {
            const remoteJid = message.key.remoteJid;

            // Check if command is used in a group
            if (!remoteJid.endsWith('@g.us')) {
                await sock.sendMessage(remoteJid, { text: '❌ This command can only be used in groups' });
                return;
            }

            // Check if sender is admin
            const sender = message.key.participant || message.key.remoteJid;
            const isUserAdmin = await isAdmin(sock, remoteJid, sender);
            if (!isUserAdmin) {
                await sock.sendMessage(remoteJid, { text: '❌ This command can only be used by admins' });
                return;
            }

            await sock.sendMessage(remoteJid, { text: '⏳ Creating group backup...' });

            // Get group metadata
            const groupMetadata = await sock.groupMetadata(remoteJid);

            // Create backup object
            const backup = {
                id: remoteJid,
                name: groupMetadata.subject,
                description: groupMetadata.desc,
                participants: groupMetadata.participants.map(p => ({
                    id: p.id,
                    admin: p.admin
                })),
                settings: groupMetadata.settings || {},
                rules: groupMetadata.rules || [],
                creation: groupMetadata.creation,
                timestamp: Date.now()
            };

            // Save backup to file
            const backupDir = path.join(__dirname, '../../backups');
            await fs.mkdir(backupDir, { recursive: true });
            const backupPath = path.join(backupDir, `group_${remoteJid.split('@')[0]}_${Date.now()}.json`);
            await fs.writeFile(backupPath, JSON.stringify(backup, null, 2));

            await sock.sendMessage(remoteJid, { text: '✅ Group backup created successfully' });

        } catch (err) {
            logger.error('Error in groupbackup command:', err);
            await sock.sendMessage(message.key.remoteJid, { text: '❌ Failed to create group backup' });
        }
    },

    async grouprestore(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;

            // Check if command is used in a group
            if (!remoteJid.endsWith('@g.us')) {
                await sock.sendMessage(remoteJid, { text: '❌ This command can only be used in groups' });
                return;
            }

            // Check if sender is admin
            const sender = message.key.participant || message.key.remoteJid;
            const isUserAdmin = await isAdmin(sock, remoteJid, sender);
            if (!isUserAdmin) {
                await sock.sendMessage(remoteJid, { text: '❌ This command can only be used by admins' });
                return;
            }

            const [backupId] = args;
            if (!backupId) {
                await sock.sendMessage(remoteJid, { text: '❌ Please provide a backup ID' });
                return;
            }

            await sock.sendMessage(remoteJid, { text: '⏳ Restoring group from backup...' });

            // Load backup file
            const backupDir = path.join(__dirname, '../../backups');
            const backupFiles = await fs.readdir(backupDir);
            const backupFile = backupFiles.find(f => f.includes(backupId));

            if (!backupFile) {
                await sock.sendMessage(remoteJid, { text: '❌ Backup not found' });
                return;
            }

            const backupPath = path.join(backupDir, backupFile);
            const backup = JSON.parse(await fs.readFile(backupPath, 'utf8'));

            // Restore group settings
            if (backup.name) {
                await sock.groupUpdateSubject(remoteJid, backup.name);
            }
            if (backup.description) {
                await sock.groupUpdateDescription(remoteJid, backup.description);
            }

            // Restore participants (admins)
            const currentMetadata = await sock.groupMetadata(remoteJid);
            const currentAdmins = currentMetadata.participants.filter(p => p.admin).map(p => p.id);
            const backupAdmins = backup.participants.filter(p => p.admin).map(p => p.id);

            // Promote new admins
            const adminsToPromote = backupAdmins.filter(id => !currentAdmins.includes(id));
            if (adminsToPromote.length) {
                await sock.groupParticipantsUpdate(remoteJid, adminsToPromote, 'promote');
            }

            await sock.sendMessage(remoteJid, { text: '✅ Group restored from backup' });

        } catch (err) {
            logger.error('Error in grouprestore command:', err);
            await sock.sendMessage(message.key.remoteJid, { text: '❌ Failed to restore group' });
        }
    },

    async antivirus(sock, message, args) {
        const remoteJid = message.key.remoteJid;
        const [action] = args;
        if (!action || !['on', 'off', 'status'].includes(action)) {
            await sock.sendMessage(remoteJid, { text: '⚠️ Usage: !antivirus <on|off|status>' });
            return;
        }
        // TODO: Implement anti-virus protection
        await sock.sendMessage(remoteJid, { text: `🛡️ Anti-virus ${action}` });
    },

    async antibadwords(sock, message, args) {
        const remoteJid = message.key.remoteJid;
        const [action, word] = args;
        if (!action || !['add', 'remove', 'list'].includes(action)) {
            await sock.sendMessage(remoteJid, { text: '⚠️ Usage: !antibadwords <add|remove|list> [word]' });
            return;
        }
        // TODO: Implement bad words filter
        await sock.sendMessage(remoteJid, { text: '🚫 Bad words filter updated' });
    },

    // Message Control
    async purge(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;

            // Check if command is used in a group
            if (!remoteJid.endsWith('@g.us')) {
                await sock.sendMessage(remoteJid, { text: '❌ This command can only be used in groups' });
                return;
            }

            // Check if sender is admin
            const sender = message.key.participant || message.key.remoteJid;
            const isUserAdmin = await isAdmin(sock, remoteJid, sender);
            if (!isUserAdmin) {
                await sock.sendMessage(remoteJid, { text: '❌ This command can only be used by admins' });
                return;
            }

            const count = parseInt(args[0]);
            if (isNaN(count) || count < 1 || count > 100) {
                await sock.sendMessage(remoteJid, { 
                    text: '❌ Please provide a valid number of messages to delete (1-100)' 
                });
                return;
            }

            await sock.sendMessage(remoteJid, { text: `⏳ Deleting ${count} messages...` });

            // Get message keys
            const chat = await sock.groupFetchAllParticipating();
            const messages = Object.values(chat[remoteJid].messages)
                .filter(m => m.key.fromMe)
                .slice(0, count);

            // Delete messages
            for (const msg of messages) {
                await sock.sendMessage(remoteJid, { delete: msg.key });
            }

            await sock.sendMessage(remoteJid, { text: `✅ Deleted ${messages.length} messages` });

        } catch (err) {
            logger.error('Error in purge command:', err);
            await sock.sendMessage(message.key.remoteJid, { text: '❌ Failed to purge messages' });
        }
    },

    async lock(sock, message) {
        try {
            const remoteJid = message.key.remoteJid;

            // Check if command is used in a group
            if (!remoteJid.endsWith('@g.us')) {
                await sock.sendMessage(remoteJid, { text: '❌ This command can only be used in groups' });
                return;
            }

            // Check if sender is admin
            const sender = message.key.participant || message.key.remoteJid;
            const isUserAdmin = await isAdmin(sock, remoteJid, sender);
            if (!isUserAdmin) {
                await sock.sendMessage(remoteJid, { text: '❌ This command can only be used by admins' });
                return;
            }

            // Check if bot is admin
            const isBotAdminInGroup = await isBotAdmin(sock, remoteJid);
            if (!isBotAdminInGroup) {
                await sock.sendMessage(remoteJid, { text: '❌ Bot must be admin to lock the group' });
                return;
            }

            // Lock group (only admins can send messages)
            await sock.groupSettingUpdate(remoteJid, 'announcement');
            await sock.sendMessage(remoteJid, { text: '🔒 Group has been locked (only admins can send messages)' });

        } catch (err) {
            logger.error('Error in lock command:', err);
            await sock.sendMessage(message.key.remoteJid, { text: '❌ Failed to lock group' });
        }
    },

    async unlock(sock, message) {
        try {
            const remoteJid = message.key.remoteJid;

            // Check if command is used in a group
            if (!remoteJid.endsWith('@g.us')) {
                await sock.sendMessage(remoteJid, { text: '❌ This command can only be used in groups' });
                return;
            }

            // Check if sender is admin
            const sender = message.key.participant || message.key.remoteJid;
            const isUserAdmin = await isAdmin(sock, remoteJid, sender);
            if (!isUserAdmin) {
                await sock.sendMessage(remoteJid, { text: '❌ This command can only be used by admins' });
                return;
            }

            // Check if bot is admin
            const isBotAdminInGroup = await isBotAdmin(sock, remoteJid);
            if (!isBotAdminInGroup) {
                await sock.sendMessage(remoteJid, { text: '❌ Bot must be admin to unlock the group' });
                return;
            }

            // Unlock group
            await sock.groupSettingUpdate(remoteJid, 'not_announcement');
            await sock.sendMessage(remoteJid, { text: '🔓 Group has been unlocked' });

        } catch (err) {
            logger.error('Error in unlock command:', err);
            await sock.sendMessage(message.key.remoteJid, { text: '❌ Failed to unlock group' });
        }
    },

    // Member List Management
    async blacklist(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;

            // Check if command is used in a group
            if (!remoteJid.endsWith('@g.us')) {
                await sock.sendMessage(remoteJid, { text: '❌ This command can only be used in groups' });
                return;
            }

            // Check if sender is admin
            const sender = message.key.participant || message.key.remoteJid;
            const isUserAdmin = await isAdmin(sock, remoteJid, sender);
            if (!isUserAdmin) {
                await sock.sendMessage(remoteJid, { text: '❌ This command can only be used by admins' });
                return;
            }

            const [action, ...userArgs] = args;
            if (!action || !['add', 'remove', 'list'].includes(action)) {
                await sock.sendMessage(remoteJid, { text: '❌ Usage: !blacklist <add|remove|list> [user]' });
                return;
            }

            // Get group metadata for storing blacklist
            const groupMetadata = await sock.groupMetadata(remoteJid);

            // Initialize blacklist if not exists
            if (!groupMetadata.blacklist) {
                groupMetadata.blacklist = new Set();
            }

            switch (action) {
                case 'add':
                    if (!userArgs.length) {
                        await sock.sendMessage(remoteJid, { text: '❌ Please specify a user to blacklist' });
                        return;
                    }

                    const userToBlacklist = userArgs[0].replace('@', '') + '@s.whatsapp.net';

                    // Check if user is admin
                    const isTargetAdmin = await isAdmin(sock, remoteJid, userToBlacklist);
                    if (isTargetAdmin) {
                        await sock.sendMessage(remoteJid, { text: '❌ Cannot blacklist an admin' });
                        return;
                    }

                    groupMetadata.blacklist.add(userToBlacklist);
                    await sock.sendMessage(remoteJid, { text: '✅ User has been added to blacklist' });
                    break;

                case 'remove':
                    if (!userArgs.length) {
                        await sock.sendMessage(remoteJid, { text: '❌ Please specify a user to remove from blacklist' });
                        return;
                    }

                    const userToRemove = userArgs[0].replace('@', '') + '@s.whatsapp.net';
                    groupMetadata.blacklist.delete(userToRemove);
                    await sock.sendMessage(remoteJid, { text: '✅ User has been removed from blacklist' });
                    break;

                case 'list':
                    if (groupMetadata.blacklist.size === 0) {
                        await sock.sendMessage(remoteJid, { text: '📋 Blacklist is empty' });
                        return;
                    }

                    const blacklistedUsers = Array.from(groupMetadata.blacklist);
                    const mentions = blacklistedUsers.map(user => ({
                        tag: user,
                        mention: user.split('@')[0]
                    }));

                    let listMessage = '*📋 Blacklisted Users:*\n\n';
                    mentions.forEach(({ mention }) => {
                        listMessage += `@${mention}\n`;
                    });

                    await sock.sendMessage(remoteJid, {
                        text: listMessage,
                        mentions: blacklistedUsers
                    });
                    break;
            }

        } catch (err) {
            logger.error('Error in blacklist command:', err);
            await sock.sendMessage(message.key.remoteJid, { text: '❌ Failed to manage blacklist' });
        }
    },

    async whitelist(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;

            // Check if command is used in a group
            if (!remoteJid.endsWith('@g.us')) {
                await sock.sendMessage(remoteJid, { text: '❌ This command can only be used in groups' });
                return;
            }

            // Check if sender is admin
            const sender = message.key.participant || message.key.remoteJid;
            const isUserAdmin = await isAdmin(sock, remoteJid, sender);
            if (!isUserAdmin) {
                await sock.sendMessage(remoteJid, { text: '❌ This command can only be used by admins' });
                return;
            }

            const [action, ...userArgs] = args;
            if (!action || !['add', 'remove', 'list'].includes(action)) {
                await sock.sendMessage(remoteJid, { text: '❌ Usage: !whitelist <add|remove|list> [user]' });
                return;
            }

            // Get group metadata for storing whitelist
            const groupMetadata = await sock.groupMetadata(remoteJid);

            // Initialize whitelist if not exists
            if (!groupMetadata.whitelist) {
                groupMetadata.whitelist = new Set();
            }

            switch (action) {
                case 'add':
                    if (!userArgs.length) {
                        await sock.sendMessage(remoteJid, { text: '❌ Please specify a user to whitelist' });
                        return;
                    }

                    const userToWhitelist = userArgs[0].replace('@', '') + '@s.whatsapp.net';
                    groupMetadata.whitelist.add(userToWhitelist);
                    await sock.sendMessage(remoteJid, { text: '✅ User has been added to whitelist' });
                    break;

                case 'remove':
                    if (!userArgs.length) {
                        await sock.sendMessage(remoteJid, { text: '❌ Please specify a user to remove from whitelist' });
                        return;
                    }

                    const userToRemove = userArgs[0].replace('@', '') + '@s.whatsapp.net';
                    groupMetadata.whitelist.delete(userToRemove);
                    await sock.sendMessage(remoteJid, { text: '✅ User has been removed from whitelist' });
                    break;

                case 'list':
                    if (groupMetadata.whitelist.size === 0) {
                        await sock.sendMessage(remoteJid, { text: '📋 Whitelist is empty' });
                        return;
                    }

                    const whitelistedUsers = Array.from(groupMetadata.whitelist);
                    const mentions = whitelistedUsers.map(user => ({
                        tag: user,
                        mention: user.split('@')[0]
                    }));

                    let listMessage = '*📋 Whitelisted Users:*\n\n';
                    mentions.forEach(({ mention }) => {
                        listMessage += `@${mention}\n`;
                    });

                    await sock.sendMessage(remoteJid, {
                        text: listMessage,
                        mentions: whitelistedUsers
                    });
                    break;
            }

        } catch (err) {
            logger.error('Error in whitelist command:', err);
            await sock.sendMessage(message.key.remoteJid, { text: '❌ Failed to manage whitelist' });
        }
    },

    // Group Rules Management
    async rules(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;

            // Check if command is used in a group
            if (!remoteJid.endsWith('@g.us')) {
                await sock.sendMessage(remoteJid, { text: '❌ This command can only be used in groups' });
                return;
            }

            // Check if sender is admin for add/remove actions
            const [action, ...content] = args;
            if (action && ['add', 'remove'].includes(action)) {
                const sender = message.key.participant || message.key.remoteJid;
                const isUserAdmin = await isAdmin(sock, remoteJid, sender);
                if (!isUserAdmin) {
                    await sock.sendMessage(remoteJid, { text: '❌ Only admins can modify rules' });
                    return;
                }
            }

            // Get group metadata for storing/retrieving rules
            const groupMetadata = await sock.groupMetadata(remoteJid);

            // Initialize rules if not exists
            if (!groupMetadata.rules) {
                groupMetadata.rules = [];
            }

            switch (action) {
                case 'add':
                    const newRule = content.join(' ');
                    if (!newRule) {
                        await sock.sendMessage(remoteJid, { text: '❌ Please provide a rule to add' });
                        return;
                    }
                    groupMetadata.rules.push(newRule);
                    await sock.sendMessage(remoteJid, { text: '✅ Rule has been added' });
                    break;

                case 'remove':
                    const index = parseInt(content[0]) - 1;
                    if (isNaN(index) || index < 0 || index >= groupMetadata.rules.length) {
                        await sock.sendMessage(remoteJid, { text: '❌ Please provide a valid rule number to remove' });
                        return;
                    }
                    groupMetadata.rules.splice(index, 1);
                    await sock.sendMessage(remoteJid, { text: '✅ Rule has been removed' });
                    break;

                case 'list':
                default:
                    if (groupMetadata.rules.length === 0) {
                        await sock.sendMessage(remoteJid, { text: '📜 No rules have been set for this group' });
                        return;
                    }
                    const rulesList = groupMetadata.rules
                        .map((rule, index) => `${index + 1}. ${rule}`)
                        .join('\n');
                    await sock.sendMessage(remoteJid, {
                        text: `*📜 Group Rules:*\n\n${rulesList}`
                    });
            }

        } catch (err) {
            logger.error('Error in rules command:', err);
            await sock.sendMessage(message.key.remoteJid, { text: '❌ Failed to manage rules' });
        }
    },

    async autorules(sock, message, args) {
        const remoteJid = message.key.remoteJid;
        const [action] = args;
        if (!action || !['on', 'off'].includes(action)) {
            await sock.sendMessage(remoteJid, { text: '⚠️ Usage: !autorules <on|off>' });
            return;
        }
        // TODO: Implement auto rules sending
        await sock.sendMessage(remoteJid, { text: `📜 Auto rules ${action}` });
    },

    // Additional Utility Commands
    async tagall(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;

            // Check if command is used in a group
            if (!remoteJid.endsWith('@g.us')) {
                await sock.sendMessage(remoteJid, { text: '❌ This command can only be used in groups' });
                return;
            }

            // Check if sender is admin
            const sender = message.key.participant || message.key.remoteJid;
            const isUserAdmin = await isAdmin(sock, remoteJid, sender);
            if (!isUserAdmin) {
                await sock.sendMessage(remoteJid, { text: '❌ This command can only be used by admins' });
                return;
            }

            // Get group members
            const groupMetadata = await sock.groupMetadata(remoteJid);
            const participants = groupMetadata.participants;

            // Create mention message
            let mentionText = '👥 Attention everyone!\n\n';
            if (args.length) {
                mentionText += args.join(' ') + '\n\n';
            }

            mentionText += participants.map(p => `@${p.id.split('@')[0]}`).join(' ');

            await sock.sendMessage(remoteJid, {
                text: mentionText,
                mentions: participants.map(p => p.id)
            });

        } catch (err) {
            logger.error('Error in tagall command:', err);
            await sock.sendMessage(message.key.remoteJid, { text: '❌ Failed to tag members' });
        }
    },

    async admins(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;

            // Check if command is used in a group
            if (!remoteJid.endsWith('@g.us')) {
                await sock.sendMessage(remoteJid, { text: '❌ This command can only be used in groups' });
                return;
            }

            // Get group metadata
            const groupMetadata = await sock.groupMetadata(remoteJid);
            const admins = groupMetadata.participants.filter(p => p.admin);

            // Create mention message
            let mentionText = '👑 Group Admins:\n\n';
            if (args.length) {
                mentionText += args.join(' ') + '\n\n';
            }

            mentionText += admins.map(p => `@${p.id.split('@')[0]}`).join(' ');

            await sock.sendMessage(remoteJid, {
                text: mentionText,
                mentions: admins.map(p => p.id)
            });

        } catch (err) {
            logger.error('Error in admins command:', err);
            await sock.sendMessage(message.key.remoteJid, { text: '❌ Failed to tag admins' });
        }
    },

    async link(sock, message) {
        try {
            const remoteJid = message.key.remoteJid;

            // Check if command is used in a group
            if (!remoteJid.endsWith('@g.us')) {
                await sock.sendMessage(remoteJid, { text: '❌ This command can only be used in groups' });
                return;
            }

            // Check if sender is admin
            const sender = message.key.participant || message.key.remoteJid;
            const isUserAdmin = await isAdmin(sock, remoteJid, sender);
            if (!isUserAdmin) {
                await sock.sendMessage(remoteJid, { text: '❌ This command can only be used by admins' });
                return;
            }

            // Generate group invite link
            const code = await sock.groupInviteCode(remoteJid);
            const inviteLink = `https://chat.whatsapp.com/${code}`;
            await sock.sendMessage(remoteJid, { text: `🔗 Group invite link:\n${inviteLink}` });

        } catch (err) {
            logger.error('Error in link command:', err);
            await sock.sendMessage(message.key.remoteJid, { text: '❌ Failed to generate group link' });
        }
    },

    async revoke(sock, message) {
        try {
            const remoteJid = message.key.remoteJid;

            // Check if command is used in a group
            if (!remoteJid.endsWith('@g.us')) {
                await sock.sendMessage(remoteJid, { text: '❌ This command can only be used in groups' });
                return;
            }

            // Check if sender is admin
            const sender = message.key.participant || message.key.remoteJid;
            const isUserAdmin = await isAdmin(sock, remoteJid, sender);
            if (!isUserAdmin) {
                await sock.sendMessage(remoteJid, { text: '❌ This command can only be used by admins' });
                return;
            }

            // Revoke group invite link
            await sock.groupRevokeInvite(remoteJid);
            await sock.sendMessage(remoteJid, { text: '✅ Group invite link has been revoked' });

        } catch (err) {
            logger.error('Error in revoke command:', err);
            await sock.sendMessage(message.key.remoteJid, { text: '❌ Failed to revoke group link' });
        }
    },

    // Advanced Group Security
    async groupbackup(sock, message) {
        try {
            const remoteJid = message.key.remoteJid;

            // Check if command is used in a group
            if (!remoteJid.endsWith('@g.us')) {
                await sock.sendMessage(remoteJid, { text: '❌ This command can only be used in groups' });
                return;
            }

            // Check if sender is admin
            const sender = message.key.participant || message.key.remoteJid;
            const isUserAdmin = await isAdmin(sock, remoteJid, sender);
            if (!isUserAdmin) {
                await sock.sendMessage(remoteJid, { text: '❌ This command can only be used by admins' });
                return;
            }

            await sock.sendMessage(remoteJid, { text: '⏳ Creating group backup...' });

            // Get group metadata
            const groupMetadata = await sock.groupMetadata(remoteJid);

            // Create backup object
            const backup = {
                id: remoteJid,
                name: groupMetadata.subject,
                description: groupMetadata.desc,
                participants: groupMetadata.participants.map(p => ({
                    id: p.id,
                    admin: p.admin
                })),
                settings: groupMetadata.settings || {},
                rules: groupMetadata.rules || [],
                creation: groupMetadata.creation,
                timestamp: Date.now()
            };

            // Save backup to file
            const backupDir = path.join(__dirname, '../../backups');
            await fs.mkdir(backupDir, { recursive: true });
            const backupPath = path.join(backupDir, `group_${remoteJid.split('@')[0]}_${Date.now()}.json`);
            await fs.writeFile(backupPath, JSON.stringify(backup, null, 2));

            await sock.sendMessage(remoteJid, { text: '✅ Group backup created successfully' });

        } catch (err) {
            logger.error('Error in groupbackup command:', err);
            await sock.sendMessage(message.key.remoteJid, { text: '❌ Failed to create group backup' });
        }
    },

    async grouprestore(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;

            // Check if command is used in a group
            if (!remoteJid.endsWith('@g.us')) {
                await sock.sendMessage(remoteJid, { text: '❌ This command can only be used in groups' });
                return;
            }

            // Check if sender is admin
            const sender = message.key.participant || message.key.remoteJid;
            const isUserAdmin = await isAdmin(sock, remoteJid, sender);
            if (!isUserAdmin) {
                await sock.sendMessage(remoteJid, { text: '❌ This command can only be used by admins' });
                return;
            }

            const [backupId] = args;
            if (!backupId) {
                await sock.sendMessage(remoteJid, { text: '❌ Please provide a backup ID' });
                return;
            }

            await sock.sendMessage(remoteJid, { text: '⏳ Restoring group from backup...' });

            // Load backup file
            const backupDir = path.join(__dirname, '../../backups');
            const backupFiles = await fs.readdir(backupDir);
            const backupFile = backupFiles.find(f => f.includes(backupId));

            if (!backupFile) {
                await sock.sendMessage(remoteJid, { text: '❌ Backup not found' });
                return;
            }

            const backupPath = path.join(backupDir, backupFile);
            const backup = JSON.parse(await fs.readFile(backupPath, 'utf8'));

            // Restore group settings
            if (backup.name) {
                await sock.groupUpdateSubject(remoteJid, backup.name);
            }
            if (backup.description) {
                await sock.groupUpdateDescription(remoteJid, backup.description);
            }

            // Restore participants (admins)
            const currentMetadata = await sock.groupMetadata(remoteJid);
            const currentAdmins = currentMetadata.participants.filter(p => p.admin).map(p => p.id);
            const backupAdmins = backup.participants.filter(p => p.admin).map(p => p.id);

            // Promote new admins
            const adminsToPromote = backupAdmins.filter(id => !currentAdmins.includes(id));
            if (adminsToPromote.length) {
                await sock.groupParticipantsUpdate(remoteJid, adminsToPromote, 'promote');
            }

            await sock.sendMessage(remoteJid, { text: '✅ Group restored from backup' });

        } catch (err) {
            logger.error('Error in grouprestore command:', err);
            await sock.sendMessage(message.key.remoteJid, { text: '❌ Failed to restore group' });
        }
    },

    async antivirus(sock, message, args) {
        const remoteJid = message.key.remoteJid;
        const [action] = args;
        if (!action || !['on', 'off', 'status'].includes(action)) {
            await sock.sendMessage(remoteJid, { text: '⚠️ Usage: !antivirus <on|off|status>' });
            return;
        }
        // TODO: Implement anti-virus protection
        await sock.sendMessage(remoteJid, { text: `🛡️ Anti-virus ${action}` });
    },

    async antibadwords(sock, message, args) {
        const remoteJid = message.key.remoteJid;
        const [action, word] = args;
        if (!action || !['add', 'remove', 'list'].includes(action)) {
            await sock.sendMessage(remoteJid, { text: '⚠️ Usage: !antibadwords <add|remove|list> [word]' });
            return;
        }
        // TODO: Implement bad words filter
        await sock.sendMessage(remoteJid, { text: '🚫 Bad words filter updated' });
    },

    // Message Control
    async purge(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;

            // Check if command is used in a group
            if (!remoteJid.endsWith('@g.us')) {
                await sock.sendMessage(remoteJid, { text: '❌ This command can only be used in groups' });
                return;
            }

            // Check if sender is admin
            const sender = message.key.participant || message.key.remoteJid;
            const isUserAdmin = await isAdmin(sock, remoteJid, sender);
            if (!isUserAdmin) {
                await sock.sendMessage(remoteJid, { text: '❌ This command can only be used by admins' });
                return;
            }

            const count = parseInt(args[0]);
            if (isNaN(count) || count < 1 || count > 100) {
                await sock.sendMessage(remoteJid, { 
                    text: '❌ Please provide a valid number of messages to delete (1-100)' 
                });
                return;
            }

            await sock.sendMessage(remoteJid, { text: `⏳ Deleting ${count} messages...` });

            // Get message keys
            const chat = await sock.groupFetchAllParticipating();
            const messages = Object.values(chat[remoteJid].messages)
                .filter(m => m.key.fromMe)
                .slice(0, count);

            // Delete messages
            for (const msg of messages) {
                await sock.sendMessage(remoteJid, { delete: msg.key });
            }

            await sock.sendMessage(remoteJid, { text: `✅ Deleted ${messages.length} messages` });

        } catch (err) {
            logger.error('Error in purge command:', err);
            await sock.sendMessage(message.key.remoteJid, { text: '❌ Failed to purge messages' });
        }
    },

    async lock(sock, message) {
        try {
            const remoteJid = message.key.remoteJid;

            // Check if command is used in a group
            if (!remoteJid.endsWith('@g.us')) {
                await sock.sendMessage(remoteJid, { text: '❌ This command can only be used in groups' });
                return;
            }

            // Check if sender is admin
            const sender = message.key.participant || message.key.remoteJid;
            const isUserAdmin = await isAdmin(sock, remoteJid, sender);
            if (!isUserAdmin) {
                await sock.sendMessage(remoteJid, { text: '❌ This command can only be used by admins' });
                return;
            }

            // Check if bot is admin
            const isBotAdminInGroup = await isBotAdmin(sock, remoteJid);
            if (!isBotAdminInGroup) {
                await sock.sendMessage(remoteJid, { text: '❌ Bot must be admin to lock the group' });
                return;
            }

            // Lock group (only admins can send messages)
            await sock.groupSettingUpdate(remoteJid, 'announcement');
            await sock.sendMessage(remoteJid, { text: '🔒 Group has been locked (only admins can send messages)' });

        } catch (err) {
            logger.error('Error in lock command:', err);
            await sock.sendMessage(message.key.remoteJid, { text: '❌ Failed to lock group' });
        }
    },

    async unlock(sock, message) {
        try {
            const remoteJid = message.key.remoteJid;

            // Check if command is used in a group
            if (!remoteJid.endsWith('@g.us')) {
                await sock.sendMessage(remoteJid, { text: '❌ This command can only be used in groups' });
                return;
            }

            // Check if sender is admin
            const sender = message.key.participant || message.key.remoteJid;
            const isUserAdmin = await isAdmin(sock, remoteJid, sender);
            if (!isUserAdmin) {
                await sock.sendMessage(remoteJid, { text: '❌ This command can only be used by admins' });
                return;
            }

            // Check if bot is admin
            const isBotAdminInGroup = await isBotAdmin(sock, remoteJid);
            if (!isBotAdminInGroup) {
                await sock.sendMessage(remoteJid, { text: '❌ Bot must be admin to unlock the group' });
                return;
            }

            // Unlock group
            await sock.groupSettingUpdate(remoteJid, 'not_announcement');
            await sock.sendMessage(remoteJid, { text: '🔓 Group has been unlocked' });

        } catch (err) {
            logger.error('Error in unlock command:', err);
            await sock.sendMessage(message.key.remoteJid, { text: '❌ Failed to unlock group' });
        }
    },

    // Advanced Moderation
    async warn2(sock, message, args) {
        const remoteJid = message.key.remoteJid;
        const [user, level, ...reason] = args;
        if (!user || !level) {
            await sock.sendMessage(remoteJid, { text: '⚠️ Usage: !warn2 @user [level] [reason]' });
            return;
        }
        // TODO: Implement advanced warning
        await sock.sendMessage(remoteJid, { text: `⚠️ Level ${level} warning issued to ${user}` });
    },

    async autowarn(sock, message, args) {
        const remoteJid = message.key.remoteJid;
        const [action, trigger] = args;
        if (!action || !['add', 'remove', 'list'].includes(action)) {
            await sock.sendMessage(remoteJid, { text: '⚠️ Usage: !autowarn <add|remove|list> [trigger]' });
            return;
        }
        // TODO: Implement auto-warning
        await sock.sendMessage(remoteJid, { text: '⚠️ Auto-warning settings updated' });
    },

    // User Management
    async nickname(sock, message, args) {
        const remoteJid = message.key.remoteJid;
        const [user, ...nickname] = args;
        if (!user || !nickname.length) {
            await sock.sendMessage(remoteJid, { text: '⚠️ Usage: !nickname @user [nickname]' });
            return;
        }
        // TODO: Implement nickname setting
        await sock.sendMessage(remoteJid, { text: '📝 Nickname updated' });
    },

    async resetname(sock, message, args) {
        const remoteJid = message.key.remoteJid;
        const [user] = args;
        if (!user) {
            await sock.sendMessage(remoteJid, { text: '⚠️ Usage: !resetname @user' });
            return;
        }
        // TODO: Implement name reset
        await sock.sendMessage(remoteJid, { text: '📝 Name reset' });
    },

    // Role Management
    async role(sock, message, args) {
        const remoteJid = message.key.remoteJid;
        const [action, user, role] = args;
        if (!action || !['add', 'remove', 'list'].includes(action)) {
            await sock.sendMessage(remoteJid, { text: '⚠️ Usage: !role <add|remove|list> @user [role]' });
            return;
        }        // TODO: Implement role management
        await sock.sendMessage(remoteJid, { text: '👥 Role updated' });
    },

    async viewroles(sock, message) {
        const remoteJid = message.key.remoteJid;
        // TODO: Implement role viewing
        await sock.sendMessage(remoteJid, { text: '📋 Available roles:\n• [Role List]' });
    },

    // Event Management
    async event(sock, message, args) {
        const remoteJid = message.key.remoteJid;
        const [action, ...details] = args;
        if (!action || !['create', 'end', 'list'].includes(action)) {
            await sock.sendMessage(remoteJid, { text: '⚠️ Usage: !event <create|end|list> [details]' });
            return;
        }
        // TODO: Implement event management
        await sock.sendMessage(remoteJid, { text: '📅 Event command processed' });
    },

    async reminder(sock, message, args) {
        const remoteJid = message.key.remoteJid;
        const [time, ...messageText] = args;
        if (!time || !messageText.length) {
            await sock.sendMessage(remoteJid, { text: '⚠️ Usage: !reminder [time] [message]' });
            return;
        }
        // TODO: Implement group reminder
        await sock.sendMessage(remoteJid, { text: '⏰ Reminder set' });
    },

    // Advanced Settings
    async autoreact(sock, message, args) {
        const remoteJid = message.key.remoteJid;
        const [action] = args;
        if (!action || !['on', 'off', 'list'].includes(action)) {
            await sock.sendMessage(remoteJid, { text: '⚠️ Usage: !autoreact <on|off|list>' });
            return;
        }
        // TODO: Implement auto-reactions
        await sock.sendMessage(remoteJid, { text: '😄 Auto-react settings updated' });
    },

    async chatbot(sock, message, args) {
        const remoteJid = message.key.remoteJid;
        const [action] = args;
        if (!action || !['on', 'off', 'config'].includes(action)) {
            await sock.sendMessage(remoteJid, { text: '⚠️ Usage: !chatbot <on|off|config>' });
            return;
        }
        // TODO: Implement chatbot
        await sock.sendMessage(remoteJid, { text: '🤖 Chatbot settings updated' });
    },

    // Group Analytics
    async analytics(sock, message, args) {
        const remoteJid = message.key.remoteJid;
        const [timeframe] = args;
        if (!timeframe || !['day', 'week', 'month'].includes(timeframe)) {
            await sock.sendMessage(remoteJid, { text: '⚠️ Usage: !analytics <day|week|month>' });
            return;
        }
        // TODO: Implement analytics
        await sock.sendMessage(remoteJid, { text: '📊 Generating analytics...' });
    },

    async activityrank(sock, message) {
        const remoteJid = message.key.remoteJid;
        // TODO: Implement activity ranking
        await sock.sendMessage(remoteJid, { text: '📈 Activity Rankings:\n• [Rankings]' });
    },

    // Moderation Tools
    async filter(sock, message, args) {
        const remoteJid = message.key.remoteJid;
        const [action, ...pattern] = args;
        if (!action || !['add', 'remove', 'list'].includes(action)) {
            await sock.sendMessage(remoteJid, { text: '⚠️ Usage: !filter <add|remove|list> [pattern]' });
            return;
        }
        // TODO: Implement message filtering
        await sock.sendMessage(remoteJid, { text: '🔍 Message filter updated' });
    },

    async automod(sock, message, args) {
        const remoteJid = message.key.remoteJid;
        const [action, level] = args;
        if (!action || !['on', 'off', 'config'].includes(action)) {
            await sock.sendMessage(remoteJid, { text: '⚠️ Usage: !automod <on|off|config> [level]' });
            return;
        }
        // TODO: Implement auto-moderation
        await sock.sendMessage(remoteJid, { text: '🛡️ Auto-moderation updated' });
    }
};

// Export the command handlers
module.exports = {
    commands: groupCommands,
    category: 'group',
    // Initialize any required state or configurations
    async init() {
        try {
            // Create backup directory if it doesn't exist
            const backupDir = path.join(__dirname, '../../backups');
            await fs.mkdir(backupDir, { recursive: true });
            logger.info('Group command handler initialized successfully');
        } catch (err) {
            logger.error('Error initializing group command handler:', err);
            throw err; // Re-throw to be handled by the command loader
        }
    }
};