const logger = require('../utils/logger');
const { isAdmin, isBotAdmin } = require('../utils/permissions');
const { downloadMediaMessage, formatPhoneNumber, formatPhoneForMention, formatNumber } = require('../utils/helpers');
const { getGroupSettings, saveGroupSettings } = require('../utils/groupSettings');
const { safeSendText, safeSendMessage, safeSendImage } = require('../utils/jidHelper');
const path = require('path');
const fs = require('fs');
const fsPromises = fs.promises;

// Initialize directories needed for group functionality
const initializeDirectories = async () => {
    try {
        const dirs = [
            path.join(process.cwd(), 'data/groups'),
            path.join(process.cwd(), 'data/groups/settings'),
            path.join(process.cwd(), 'data/groups/media')
        ];

        for (const dir of dirs) {
            try {
                if (!fs.existsSync(dir)) {
                    await fsPromises.mkdir(dir, { recursive: true });
                    logger.info(`✓ Group directory created: ${dir}`);
                }
            } catch (dirErr) {
                logger.error(`Failed to initialize directory ${dir}:`, dirErr);
                throw dirErr;
            }
        }
        return true;
    } catch (err) {
        logger.error('Failed to initialize group directories:', err);
        return false;
    }
};

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

// Group command handlers
const groupCommands = {
    async kick(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;

            if (!remoteJid.endsWith('@g.us')) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used in groups' );
                return;
            }

            const sender = message.key.participant || message.key.remoteJid;
            const isUserAdmin = await isAdmin(sock, remoteJid, sender);
            const isBotGroupAdmin = await isBotAdmin(sock, remoteJid);

            if (!isUserAdmin) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used by admins' );
                return;
            }

            if (!isBotGroupAdmin) {
                await safeSendText(sock, remoteJid, '❌ I need to be an admin to kick members' );
                return;
            }

            let target;
            if (message.message.extendedTextMessage?.contextInfo?.participant) {
                target = message.message.extendedTextMessage.contextInfo.participant;
            } else if (args[0]) {
                target = args[0].replace('@', '') + '@s.whatsapp.net';
            }

            if (!target) {
                await safeSendText(sock, remoteJid, '❌ Please mention a user to kick' );
                return;
            }

            const isTargetAdmin = await isAdmin(sock, remoteJid, target);
            if (isTargetAdmin) {
                await safeSendText(sock, remoteJid, '❌ Cannot kick an admin' );
                return;
            }

            await sock.groupParticipantsUpdate(remoteJid, [target], 'remove');
            await safeSendText(sock, remoteJid, '✅ User has been kicked from the group' );

        } catch (err) {
            logger.error('Error in kick command:', err);
            await safeSendText(sock, message.key.remoteJid, '❌ Failed to kick user' );
        }
    },

    async add(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;

            if (!remoteJid.endsWith('@g.us')) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used in groups' );
                return;
            }

            const sender = message.key.participant || message.key.remoteJid;
            const isUserAdmin = await isAdmin(sock, remoteJid, sender);
            const isBotGroupAdmin = await isBotAdmin(sock, remoteJid);

            if (!isUserAdmin) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used by admins' );
                return;
            }

            if (!isBotGroupAdmin) {
                await safeSendText(sock, remoteJid, '❌ I need to be an admin to add members' );
                return;
            }

            if (!args[0]) {
                await safeSendText(sock, remoteJid, '❌ Please provide the phone number to add' );
                return;
            }

            const number = args[0].replace(/[^0-9]/g, '') + '@s.whatsapp.net';

            await sock.groupParticipantsUpdate(remoteJid, [number], 'add');
            await safeSendText(sock, remoteJid, '✅ User has been added to the group' );

        } catch (err) {
            logger.error('Error in add command:', err);
            await safeSendText(sock, message.key.remoteJid, '❌ Failed to add user' );
        }
    },

    async promote(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;

            if (!remoteJid.endsWith('@g.us')) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used in groups' );
                return;
            }

            const sender = message.key.participant || message.key.remoteJid;
            const isUserAdmin = await isAdmin(sock, remoteJid, sender);
            const isBotGroupAdmin = await isBotAdmin(sock, remoteJid);

            if (!isUserAdmin) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used by admins' );
                return;
            }

            if (!isBotGroupAdmin) {
                await safeSendText(sock, remoteJid, '❌ I need to be an admin to promote members' );
                return;
            }

            let target;
            if (message.message.extendedTextMessage?.contextInfo?.participant) {
                target = message.message.extendedTextMessage.contextInfo.participant;
            } else if (args[0]) {
                target = args[0].replace('@', '') + '@s.whatsapp.net';
            }

            if (!target) {
                await safeSendText(sock, remoteJid, '❌ Please mention a user to promote' );
                return;
            }

            await sock.groupParticipantsUpdate(remoteJid, [target], 'promote');
            await safeSendText(sock, remoteJid, '✅ User has been promoted to admin' );

        } catch (err) {
            logger.error('Error in promote command:', err);
            await safeSendText(sock, message.key.remoteJid, '❌ Failed to promote user' );
        }
    },

    async demote(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;

            if (!remoteJid.endsWith('@g.us')) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used in groups' );
                return;
            }

            const sender = message.key.participant || message.key.remoteJid;
            const isUserAdmin = await isAdmin(sock, remoteJid, sender);
            const isBotGroupAdmin = await isBotAdmin(sock, remoteJid);

            if (!isUserAdmin) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used by admins' );
                return;
            }

            if (!isBotGroupAdmin) {
                await safeSendText(sock, remoteJid, '❌ I need to be an admin to demote members' );
                return;
            }

            let target;
            if (message.message.extendedTextMessage?.contextInfo?.participant) {
                target = message.message.extendedTextMessage.contextInfo.participant;
            } else if (args[0]) {
                target = args[0].replace('@', '') + '@s.whatsapp.net';
            }

            if (!target) {
                await safeSendText(sock, remoteJid, '❌ Please mention a user to demote' );
                return;
            }

            const isTargetOwner = await isAdmin(sock, remoteJid, target, true);
            if (isTargetOwner) {
                await safeSendText(sock, remoteJid, '❌ Cannot demote the group owner' );
                return;
            }

            await sock.groupParticipantsUpdate(remoteJid, [target], 'demote');
            await safeSendText(sock, remoteJid, '✅ User has been demoted from admin' );

        } catch (err) {
            logger.error('Error in demote command:', err);
            await safeSendText(sock, message.key.remoteJid, '❌ Failed to demote user' );
        }
    },

    async mute(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;

            if (!remoteJid.endsWith('@g.us')) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used in groups' );
                return;
            }

            const sender = message.key.participant || message.key.remoteJid;
            const isUserAdmin = await isAdmin(sock, remoteJid, sender);
            const isBotGroupAdmin = await isBotAdmin(sock, remoteJid);

            if (!isUserAdmin) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used by admins' );
                return;
            }

            if (!isBotGroupAdmin) {
                await safeSendText(sock, remoteJid, '❌ I need to be an admin to mute the group' );
                return;
            }

            await sock.groupSettingUpdate(remoteJid, 'announcement');
            await safeSendText(sock, remoteJid, '🔇 Group has been muted' );

        } catch (err) {
            logger.error('Error in mute command:', err);
            await safeSendText(sock, message.key.remoteJid, '❌ Failed to mute group' );
        }
    },

    async unmute(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;

            if (!remoteJid.endsWith('@g.us')) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used in groups' );
                return;
            }

            const sender = message.key.participant || message.key.remoteJid;
            const isUserAdmin = await isAdmin(sock, remoteJid, sender);
            const isBotGroupAdmin = await isBotAdmin(sock, remoteJid);

            if (!isUserAdmin) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used by admins' );
                return;
            }

            if (!isBotGroupAdmin) {
                await safeSendText(sock, remoteJid, '❌ I need to be an admin to unmute the group' );
                return;
            }

            await sock.groupSettingUpdate(remoteJid, 'not_announcement');
            await safeSendText(sock, remoteJid, '🔊 Group has been unmuted' );

        } catch (err) {
            logger.error('Error in unmute command:', err);
            await safeSendText(sock, message.key.remoteJid, '❌ Failed to unmute group' );
        }
    },
    async antispam(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;

            if (!remoteJid.endsWith('@g.us')) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used in groups' );
                return;
            }

            const sender = message.key.participant || message.key.remoteJid;
            const isUserAdmin = await isAdmin(sock, remoteJid, sender);
            if (!isUserAdmin) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used by admins' );
                return;
            }

            const [action] = args;
            if (!action || !['on', 'off'].includes(action.toLowerCase())) {
                await safeSendText(sock, remoteJid, '❌ Usage: !antispam <on/off>' );
                return;
            }

            // Store the setting in the group settings map
            const settings = await getGroupSettings(remoteJid);
            settings.antispam = action.toLowerCase() === 'on';
            await saveGroupSettings(remoteJid, settings);

            await safeSendMessage(sock, remoteJid, {
                text: `✅ Anti-spam has been turned ${action.toLowerCase()}`
            });

        } catch (err) {
            logger.error('Error in antispam command:', err);
            await safeSendText(sock, message.key.remoteJid, '❌ Failed to update anti-spam settings' );
        }
    },

    async antilink(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;

            if (!remoteJid.endsWith('@g.us')) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used in groups' );
                return;
            }

            const sender = message.key.participant || message.key.remoteJid;
            const isUserAdmin = await isAdmin(sock, remoteJid, sender);
            if (!isUserAdmin) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used by admins' );
                return;
            }

            const [action] = args;
            if (!action || !['on', 'off'].includes(action.toLowerCase())) {
                await safeSendText(sock, remoteJid, '❌ Usage: !antilink <on/off>' );
                return;
            }

            // Store the setting in the group settings map
            const settings = await getGroupSettings(remoteJid);
            settings.antilink = action.toLowerCase() === 'on';
            await saveGroupSettings(remoteJid, settings);

            await safeSendMessage(sock, remoteJid, {
                text: `✅ Anti-link has been turned ${action.toLowerCase()}`
            });

        } catch (err) {
            logger.error('Error in antilink command:', err);
            await safeSendText(sock, message.key.remoteJid, '❌ Failed to update anti-link settings' );
        }
    },

    async antitoxic(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;

            if (!remoteJid.endsWith('@g.us')) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used in groups' );
                return;
            }

            const sender = message.key.participant || message.key.remoteJid;
            const isUserAdmin = await isAdmin(sock, remoteJid, sender);
            if (!isUserAdmin) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used by admins' );
                return;
            }

            const [action] = args;
            if (!action || !['on', 'off'].includes(action.toLowerCase())) {
                await safeSendText(sock, remoteJid, '❌ Usage: !antitoxic <on/off>' );
                return;
            }

            // Store the setting in the group settings map
            const settings = await getGroupSettings(remoteJid);
            settings.antitoxic = action.toLowerCase() === 'on';
            await saveGroupSettings(remoteJid, settings);

            await safeSendMessage(sock, remoteJid, {
                text: `✅ Anti-toxic has been turned ${action.toLowerCase()}`
            });

        } catch (err) {
            logger.error('Error in antitoxic command:', err);
            await safeSendText(sock, message.key.remoteJid, '❌ Failed to update anti-toxic settings' );
        }
    },

    async antiraid(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;

            if (!remoteJid.endsWith('@g.us')) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used in groups' );
                return;
            }

            const sender = message.key.participant || message.key.remoteJid;
            const isUserAdmin = await isAdmin(sock, remoteJid, sender);
            if (!isUserAdmin) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used by admins' );
                return;
            }

            const [action, threshold] = args;
            if (!action || !['on', 'off'].includes(action.toLowerCase())) {
                await safeSendText(sock, remoteJid, '❌ Usage: !antiraid <on/off> [max_joins_per_minute]'
                );
                return;
            }

            // Store the settings in the group settings map
            const settings = await getGroupSettings(remoteJid);
            settings.antiraid = action.toLowerCase() === 'on';
            if (threshold && !isNaN(threshold)) {
                settings.raidThreshold = parseInt(threshold);
            }
            await saveGroupSettings(remoteJid, settings);

            await safeSendMessage(sock, remoteJid, {
                text: `✅ Anti-raid has been turned ${action.toLowerCase()}${
                    threshold ? ` with threshold of ${threshold} joins per minute` : ''
                }`
            });

        } catch (err) {
            logger.error('Error in antiraid command:', err);
            await safeSendText(sock, message.key.remoteJid, '❌ Failed to update anti-raid settings' );
        }
    },
    async warn(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;

            if (!remoteJid.endsWith('@g.us')) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used in groups' );
                return;
            }

            const sender = message.key.participant || message.key.remoteJid;
            const isUserAdmin = await isAdmin(sock, remoteJid, sender);
            if (!isUserAdmin) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used by admins' );
                return;
            }

            let target;
            if (message.message.extendedTextMessage?.contextInfo?.participant) {
                target = message.message.extendedTextMessage.contextInfo.participant;
            } else if (args[0]) {
                target = args[0].replace('@', '') + '@s.whatsapp.net';
            }

            if (!target) {
                await safeSendText(sock, remoteJid, '❌ Please mention a user to warn' );
                return;
            }

            const reason = args.slice(1).join(' ') || 'No reason provided';

            // Get current warnings
            const settings = await getGroupSettings(remoteJid);
            if (!settings.warnings) settings.warnings = {};
            if (!settings.warnings[target]) settings.warnings[target] = [];

            settings.warnings[target].push({
                reason,
                time: Date.now(),
                by: sender
            });

            await saveGroupSettings(remoteJid, settings);

            const warningCount = settings.warnings[target].length;
            await safeSendMessage(sock, remoteJid, {
                text: `⚠️ User has been warned (${warningCount} warnings)\nReason: ${reason}`
            });

            // Check if user should be kicked
            if (warningCount >= 3) {
                try {
                    await sock.groupParticipantsUpdate(remoteJid, [target], 'remove');
                    await safeSendText(sock, remoteJid, '🚫 User has been removed for receiving 3 warnings'
                    );
                } catch (err) {
                    logger.error('Failed to remove user after 3 warnings:', err);
                }
            }

        } catch (err) {
            logger.error('Error in warn command:', err);
            await safeSendText(sock, message.key.remoteJid, '❌ Failed to warn user' );
        }
    },

    async removewarn(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;

            if (!remoteJid.endsWith('@g.us')) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used in groups' );
                return;
            }

            const sender = message.key.participant || message.key.remoteJid;
            const isUserAdmin = await isAdmin(sock, remoteJid, sender);
            if (!isUserAdmin) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used by admins' );
                return;
            }

            let target;
            if (message.message.extendedTextMessage?.contextInfo?.participant) {
                target = message.message.extendedTextMessage.contextInfo.participant;
            } else if (args[0]) {
                target = args[0].replace('@', '') + '@s.whatsapp.net';
            }

            if (!target) {
                await safeSendText(sock, remoteJid, '❌ Please mention a user' );
                return;
            }

            // Get current warnings
            const settings = await getGroupSettings(remoteJid);
            if (!settings.warnings || !settings.warnings[target] || !settings.warnings[target].length) {
                await safeSendText(sock, remoteJid, '❌ User has no warnings' );
                return;
            }

            settings.warnings[target].pop(); // Remove the last warning
            await saveGroupSettings(remoteJid, settings);

            const warningCount = settings.warnings[target].length;
            await safeSendMessage(sock, remoteJid, {
                text: `✅ Removed 1 warning from user (${warningCount} warnings remaining)`
            });

        } catch (err) {
            logger.error('Error in removewarn command:', err);
            await safeSendText(sock, message.key.remoteJid, '❌ Failed to remove warning' );
        }
    },

    async warnings(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;

            if (!remoteJid.endsWith('@g.us')) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used in groups' );
                return;
            }

            let target;
            if (message.message.extendedTextMessage?.contextInfo?.participant) {
                target = message.message.extendedTextMessage.contextInfo.participant;
            } else if (args[0]) {
                target = args[0].replace('@', '') + '@s.whatsapp.net';
            } else {
                target = message.key.participant || message.key.remoteJid;
            }

            // Get current warnings
            const settings = await getGroupSettings(remoteJid);
            if (!settings.warnings || !settings.warnings[target] || !settings.warnings[target].length) {
                await safeSendText(sock, remoteJid, '✅ User has no warnings' );
                return;
            }

            const warningList = settings.warnings[target]
                .map((w, i) => `${i + 1}. ${w.reason} (${new Date(w.time).toLocaleString()})`)
                .join('\n');

            await safeSendMessage(sock, remoteJid, {
                text: `⚠️ Warnings for user:\n${warningList}`
            });

        } catch (err) {
            logger.error('Error in warnings command:', err);
            await safeSendText(sock, message.key.remoteJid, '❌ Failed to fetch warnings' );
        }
    },
    async setname(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;

            if (!remoteJid.endsWith('@g.us')) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used in groups' );
                return;
            }

            const sender = message.key.participant || message.key.remoteJid;
            const isUserAdmin = await isAdmin(sock, remoteJid, sender);
            if (!isUserAdmin) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used by admins' );
                return;
            }

            const newName = args.join(' ');
            if (!newName) {
                await safeSendText(sock, remoteJid, '❌ Please provide a new group name' );
                return;
            }

            await sock.groupUpdateSubject(remoteJid, newName);
            await safeSendText(sock, remoteJid, '✅ Group name has been updated' );

        } catch (err) {
            logger.error('Error in setname command:', err);
            await safeSendText(sock, message.key.remoteJid, '❌ Failed to update group name' );
        }
    },

    async setdesc(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;

            if (!remoteJid.endsWith('@g.us')) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used in groups' );
                return;
            }

            const sender = message.key.participant || message.key.remoteJid;
            const isUserAdmin = await isAdmin(sock, remoteJid, sender);
            if (!isUserAdmin) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used by admins' );
                return;
            }

            const newDesc = args.join(' ');
            if (!newDesc) {
                await safeSendText(sock, remoteJid, '❌ Please provide a new group description' );
                return;
            }

            await sock.groupUpdateDescription(remoteJid, newDesc);
            await safeSendText(sock, remoteJid, '✅ Group description has been updated' );

        } catch (err) {
            logger.error('Error in setdesc command:', err);
            await safeSendText(sock, message.key.remoteJid, '❌ Failed to update group description' );
        }
    },

    async setppic(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;

            if (!remoteJid.endsWith('@g.us')) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used in groups' );
                return;
            }

            const sender = message.key.participant || message.key.remoteJid;
            const isUserAdmin = await isAdmin(sock, remoteJid, sender);
            if (!isUserAdmin) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used by admins' );
                return;
            }

            const quoted = message.message.imageMessage || message.message.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage;
            if (!quoted) {
                await safeSendText(sock, remoteJid, '❌ Please send an image or reply to an image' );
                return;
            }

            const media = await downloadMediaMessage(message, 'buffer');
            await sock.updateProfilePicture(remoteJid, media);
            await safeSendText(sock, remoteJid, '✅ Group profile picture has been updated' );

        } catch (err) {
            logger.error('Error in setppic command:', err);
            await safeSendText(sock, message.key.remoteJid, '❌ Failed to update group profile picture' );
        }
    },

    async feature(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;

            if (!remoteJid.endsWith('@g.us')) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used in groups' );
                return;
            }

            const sender = message.key.participant || message.key.remoteJid;
            const isUserAdmin = await isAdmin(sock, remoteJid, sender);
            if (!isUserAdmin) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used by admins' );
                return;
            }

            // Get all available features if no arguments provided
            if (args.length === 0) {
                const features = await getFeatureSettings(remoteJid);
                const featureList = Object.entries(features)
                    .map(([feature, enabled]) => `${feature}: ${enabled ? '✅ Enabled' : '❌ Disabled'}`)
                    .join('\n');

                await safeSendMessage(sock, remoteJid, {
                    text: `*Group Features*\n\n${featureList}\n\nUse '.feature <name> <on/off>' to change settings`
                });
                return;
            }

            // Handle feature toggle
            const [featureName, action] = args;

            if (!featureName) {
                await safeSendText(sock, remoteJid, '❌ Usage: .feature <name> <on/off> or .feature to see all features'
                );
                return;
            }

            // Just show status of a specific feature if no action provided
            if (!action) {
                const isEnabled = await isFeatureEnabled(remoteJid, featureName);
                await safeSendMessage(sock, remoteJid, {
                    text: `Feature "${featureName}" is currently: ${isEnabled ? '✅ Enabled' : '❌ Disabled'}`
                });
                return;
            }

            // Validate action
            if (!['on', 'off'].includes(action.toLowerCase())) {
                await safeSendText(sock, remoteJid, '❌ Action must be either "on" or "off"'
                );
                return;
            }

            // Update feature setting
            const enabled = action.toLowerCase() === 'on';
            const success = await setFeatureEnabled(remoteJid, featureName, enabled);

            if (success) {
                await safeSendMessage(sock, remoteJid, {
                    text: `✅ Feature "${featureName}" has been ${enabled ? 'enabled' : 'disabled'}`
                });
            } else {
                await safeSendMessage(sock, remoteJid, {
                    text: `❌ Failed to update feature "${featureName}"`
                });
            }

        } catch (err) {
            logger.error('Error in feature command:', err);
            await safeSendText(sock, message.key.remoteJid, '❌ Failed to manage feature settings' );
        }
    },
    async link(sock, message) {
        try {
            const remoteJid = message.key.remoteJid;

            if (!remoteJid.endsWith('@g.us')) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used in groups' );
                return;
            }

            const sender = message.key.participant || message.key.remoteJid;
            const isUserAdmin = await isAdmin(sock, remoteJid, sender);

            if (!isUserAdmin) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used by admins' );
                return;
            }

            const code = await sock.groupInviteCode(remoteJid);
            await safeSendMessage(sock, remoteJid, {
                text: `🔗 Group Invite Link:\nhttps://chat.whatsapp.com/${code}`
            });

        } catch (err) {
            logger.error('Error in link command:', err);
            await safeSendText(sock, message.key.remoteJid, '❌ Failed to get group link' );
        }
    },

    async revoke(sock, message) {
        try {
            const remoteJid = message.key.remoteJid;

            if (!remoteJid.endsWith('@g.us')) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used in groups' );
                return;
            }

            const sender = message.key.participant || message.key.remoteJid;
            const isUserAdmin = await isAdmin(sock, remoteJid, sender);
            const isBotGroupAdmin = await isBotAdmin(sock, remoteJid);

            if (!isUserAdmin) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used by admins' );
                return;
            }

            if (!isBotGroupAdmin) {
                await safeSendText(sock, remoteJid, '❌ I need to be an admin to revoke the invite link' );
                return;
            }

            await sock.groupRevokeInvite(remoteJid);
            await safeSendText(sock, remoteJid, '✅ Group invite link has been revoked' );

        } catch (err) {
            logger.error('Error in revoke command:', err);
            await safeSendText(sock, message.key.remoteJid, '❌ Failed to revoke group link' );
        }
    },

    async tagall(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;

            if (!remoteJid.endsWith('@g.us')) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used in groups' );
                return;
            }

            const sender = message.key.participant || message.key.remoteJid;
            const isUserAdmin = await isAdmin(sock, remoteJid, sender);

            if (!isUserAdmin) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used by admins' );
                return;
            }

            // Get group metadata with participant details
            const metadata = await sock.groupMetadata(remoteJid);
            const { participants, subject } = metadata;
            
            // Create mentions array for everyone
            const mentions = participants.map(p => p.id);
            
            // Separate admins from regular members
            const admins = [];
            const members = [];
            
            for (const participant of participants) {
                const { id, admin } = participant;
                if (admin) {
                    admins.push(id);
                } else {
                    members.push(id);
                }
            }
            
            // Get custom message if provided
            const customMessage = args.length > 0 ? args.join(' ') : null;
            
            // Generate timestamp and random tag ID for professional look
            const timestamp = new Date().toLocaleTimeString();
            const tagId = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
            
            // Create a stylish header with border
            let formattedText = `┏━━━━━『 *TAG ALL* 』━━━━━┓\n`;
            
            // Add group name and announcement
            formattedText += `┃ *Group:* ${subject}\n`;
            formattedText += `┃ *Time:* ${timestamp}\n`;
            formattedText += `┃ *Tag ID:* #${tagId}\n`;
            if (customMessage) {
                formattedText += `┃ *Message:* ${customMessage}\n`;
            }
            formattedText += `┗━━━━━━━━━━━━━━━━━━━━━┛\n\n`;
            
            // Create a stylish admin section with sparkles
            if (admins.length > 0) {
                formattedText += `┏━━━『 *👑 ADMINS* 』━━━┓\n`;
                let count = 1;
                for (const admin of admins) {
                    const phoneNumber = admin.split('@')[0];
                    // Format with numbering and sparkling crown for admins
                    formattedText += `┃ ${count}. ✨ @${phoneNumber}\n`;
                    count++;
                }
                formattedText += `┗━━━━━━━━━━━━━━━━━━┛\n\n`;
            }
            
            // Create a stylish members section
            if (members.length > 0) {
                formattedText += `┏━━━『 *👥 MEMBERS* 』━━━┓\n`;
                
                // Create a grid layout for members (3 columns if many members)
                const useGrid = members.length > 15;
                let count = 1;
                let gridRow = '';
                
                for (const member of members) {
                    const phoneNumber = member.split('@')[0];
                    
                    if (useGrid) {
                        // For grid layout, put 3 members per row
                        gridRow += `${count}.@${phoneNumber} `;
                        
                        if (count % 3 === 0) {
                            formattedText += `┃ ${gridRow}\n`;
                            gridRow = '';
                        }
                    } else {
                        // For smaller groups, list vertically
                        formattedText += `┃ ${count}. @${phoneNumber}\n`;
                    }
                    count++;
                }
                
                // Add any remaining members in the last row
                if (useGrid && gridRow !== '') {
                    formattedText += `┃ ${gridRow}\n`;
                }
                
                formattedText += `┗━━━━━━━━━━━━━━━━━━┛\n\n`;
            }
            
            // Add stylish footer with statistics
            formattedText += `┏━━━『 *📊 STATS* 』━━━┓\n`;
            formattedText += `┃ *Total:* ${participants.length} members\n`;
            formattedText += `┃ *Admins:* ${admins.length}\n`;
            formattedText += `┃ *Regular:* ${members.length}\n`;
            formattedText += `┗━━━━━━━━━━━━━━━━━━┛\n\n`;
            
            // Add powered by footer
            formattedText += `╔═══『 *BLACKSKY-MD* 』═══╗\n`;
            formattedText += `║ _Professional WhatsApp Bot_ ║\n`;
            formattedText += `╚═════════════════════╝`;
            
            // Send the formatted message with mentions
            await safeSendMessage(sock, remoteJid, {
                text: formattedText,
                mentions
            });

        } catch (err) {
            logger.error('Error in tagall command:', err);
            await safeSendText(sock, message.key.remoteJid, '❌ Failed to tag all members' );
        }
    },
    
    async mentionall(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;

            if (!remoteJid.endsWith('@g.us')) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used in groups' );
                return;
            }

            const sender = message.key.participant || message.key.remoteJid;
            const isUserAdmin = await isAdmin(sock, remoteJid, sender);

            if (!isUserAdmin) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used by admins' );
                return;
            }

            // Get group metadata and participants
            const metadata = await sock.groupMetadata(remoteJid);
            const { participants, subject } = metadata;
            
            // Create mentions array for everyone
            const mentions = participants.map(p => p.id);
            
            // Get custom message if provided
            const customMessage = args.length > 0 ? args.join(' ') : '📣 Attention everyone!';
            
            // Generate timestamp and random tag ID for professional look
            const timestamp = new Date().toLocaleTimeString();
            const mentionId = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
            
            // Create a simpler format with formatted phone numbers
            const formattedParticipants = participants.map(participant => {
                const numberStr = participant.id.split('@')[0];
                const formatResult = formatPhoneForMention(participant.id);
                // Use different emoji for admin vs member
                const emoji = participant.admin ? '👑' : '👤';
                return {
                    id: participant.id,
                    number: numberStr,
                    formatted: formatResult.formatted,
                    international: formatResult.international,
                    stylish: formatResult.stylish,
                    md: formatResult.md,
                    emoji: emoji,
                    isAdmin: participant.admin
                };
            });
            
            // Separate admins from regular members
            const admins = formattedParticipants.filter(p => p.isAdmin);
            const members = formattedParticipants.filter(p => !p.isAdmin);
            
            // Build fancy MD-style message with border frames
            let mentionText = `┏━━━━━『 *MENTION ALL* 』━━━━━┓\n`;
            mentionText += `┃ *Group:* ${subject}\n`;
            mentionText += `┃ *Message:* ${customMessage}\n`;
            mentionText += `┃ *Time:* ${timestamp}\n`;
            mentionText += `┃ *ID:* #${mentionId}\n`;
            mentionText += `┗━━━━━━━━━━━━━━━━━━━━━━━┛\n\n`;
            
            // Add styled mention section
            mentionText += `┏━━━━『 *MENTIONS* 』━━━━┓\n`;
            
            // Create a grid layout for better visual appearance
            let currentLine = '┃ ';
            let count = 0;
            
            for (const participant of formattedParticipants) {
                // Show crown for admins in the group mention
                const displayEmoji = participant.isAdmin ? '👑' : '👤';
                currentLine += `${displayEmoji}@${participant.number} `;
                count++;
                
                // Start a new line after every 3 participants for cleaner look
                if (count % 3 === 0) {
                    mentionText += `${currentLine}\n`;
                    currentLine = '┃ ';
                }
            }
            
            // Add any remaining participants
            if (currentLine !== '┃ ') {
                mentionText += currentLine + '\n';
            }
            
            mentionText += `┗━━━━━━━━━━━━━━━━━━━━┛\n\n`;
            
            // Add admins section with MD-style formatting
            if (admins.length > 0) {
                mentionText += `┏━━━━『 *👑 ADMINS* 』━━━━┓\n`;
                admins.forEach((admin, index) => {
                    // Use the stylish format from our enhanced phone formatter
                    mentionText += `┃ ${index + 1}. ${admin.stylish}\n`;
                });
                mentionText += `┗━━━━━━━━━━━━━━━━━━━━┛\n\n`;
            }
            
            // Add country info section with MD-style formatting
            mentionText += `┏━━━━『 *📱 COUNTRIES* 』━━━━┓\n`;
            
            // Group users by country for cleaner display
            const countryGroups = {};
            formattedParticipants.forEach(p => {
                // Extract country from formatted text (e.g., "🇩🇪 DE +49 123456789")
                const countryCode = p.formatted.split(' ')[0]; // Get flag emoji
                if (!countryGroups[countryCode]) {
                    countryGroups[countryCode] = [];
                }
                countryGroups[countryCode].push(p);
            });
            
            // Display countries with member counts
            Object.entries(countryGroups).forEach(([country, users]) => {
                mentionText += `┃ ${country}: ${users.length} member${users.length > 1 ? 's' : ''}\n`;
            });
            
            mentionText += `┗━━━━━━━━━━━━━━━━━━━━┛\n\n`;
            
            // Add stats section
            mentionText += `┏━━━━『 *📊 STATS* 』━━━━┓\n`;
            mentionText += `┃ *Total:* ${formatNumber(participants.length)} members\n`;
            mentionText += `┃ *Admins:* ${formatNumber(admins.length)}\n`;
            mentionText += `┃ *Regular:* ${formatNumber(members.length)}\n`;
            mentionText += `┃ *Countries:* ${Object.keys(countryGroups).length}\n`;
            mentionText += `┗━━━━━━━━━━━━━━━━━━━━┛\n\n`;
            
            // Add powered by footer
            mentionText += `╔════『 *BLACKSKY-MD* 』════╗\n`;
            mentionText += `║  _Professional WhatsApp Bot_  ║\n`;
            mentionText += `╚══════════════════════╝`;
            
            // Send the mention message
            await safeSendMessage(sock, remoteJid, {
                text: mentionText,
                mentions
            });

        } catch (err) {
            logger.error('Error in mentionall command:', err);
            await safeSendText(sock, message.key.remoteJid, '❌ Failed to mention all members' );
        }
    },
    async poll(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;

            if (!remoteJid.endsWith('@g.us')) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used in groups' );
                return;
            }

            if (args.length < 3) {
                await safeSendText(sock, remoteJid, '❌ Usage: !poll [question] [option1] [option2] ...'
                );
                return;
            }

            const question = args[0];
            const options = args.slice(1);

            // Store the poll
            const settings = await getGroupSettings(remoteJid);
            if (!settings.polls) settings.polls = {};

            const pollId = Date.now().toString();
            settings.polls[pollId] = {
                question,
                options,
                votes: {},
                created: Date.now(),
                by: message.key.participant || message.key.remoteJid
            };

            await saveGroupSettings(remoteJid, settings);

            // Format poll message
            const pollMessage = `📊 *Poll: ${question}*\n\n` +
                options.map((opt, i) => `${i + 1}. ${opt}`).join('\n') +
                '\n\nVote using: !vote [number]';

            await safeSendText(sock, remoteJid, pollMessage );

        } catch (err) {
            logger.error('Error in poll command:', err);
            await safeSendText(sock, message.key.remoteJid, '❌ Failed to create poll' );
        }
    },

    async vote(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;

            if (!remoteJid.endsWith('@g.us')) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used in groups' );
                return;
            }

            if (!args[0] || isNaN(args[0])) {
                await safeSendText(sock, remoteJid, '❌ Please provide a valid option number' );
                return;
            }

            const settings = await getGroupSettings(remoteJid);
            if (!settings.polls || Object.keys(settings.polls).length === 0) {
                await safeSendText(sock, remoteJid, '❌ No active poll' );
                return;
            }

            // Get latest poll
            const pollId = Object.keys(settings.polls).sort().pop();
            const poll = settings.polls[pollId];

            const optionNum = parseInt(args[0]) - 1;
            if (optionNum < 0 || optionNum >= poll.options.length) {
                await safeSendText(sock, remoteJid, '❌ Invalid option number' );
                return;
            }

            const voter = message.key.participant || message.key.remoteJid;
            poll.votes[voter] = optionNum;
            await saveGroupSettings(remoteJid, settings);

            // Count votes
            const counts = poll.options.map((_, i) =>
                Object.values(poll.votes).filter(v => v === i).length
            );

            // Format results
            const results = `📊 *Poll Results*\n${poll.question}\n\n` +
                poll.options.map((opt, i) =>
                    `${i + 1}. ${opt}: ${counts[i]} votes`
                ).join('\n');

            await safeSendText(sock, remoteJid, results );

        } catch (err) {
            logger.error('Error in vote command:', err);
            await safeSendText(sock, message.key.remoteJid, '❌ Failed to register vote' );
        }
    },

    async endpoll(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;

            if (!remoteJid.endsWith('@g.us')) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used in groups' );
                return;
            }

            const sender = message.key.participant || message.key.remoteJid;
            const isUserAdmin = await isAdmin(sock, remoteJid, sender);
            if (!isUserAdmin) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used by admins' );
                return;
            }

            const settings = await getGroupSettings(remoteJid);
            if (!settings.polls || Object.keys(settings.polls).length === 0) {
                await safeSendText(sock, remoteJid, '❌ No active poll' );
                return;
            }

            // Get and delete latest poll
            const pollId = Object.keys(settings.polls).sort().pop();
            const poll = settings.polls[pollId];
            delete settings.polls[pollId];
            await saveGroupSettings(remoteJid, settings);

            // Count final votes
            const counts = poll.options.map((_, i) =>
                Object.values(poll.votes).filter(v => v === i).length
            );

            // Find winner(s)
            const maxVotes = Math.max(...counts);
            const winners = poll.options.filter((_, i) => counts[i] === maxVotes);

            // Format final results
            const results = `📊 *Final Poll Results*\n${poll.question}\n\n` +
                poll.options.map((opt, i) =>
                    `${i + 1}. ${opt}: ${counts[i]} votes`
                ).join('\n') +
                `\n\nWinner${winners.length > 1 ? 's' : ''}: ${winners.join(', ')}`;

            await safeSendText(sock, remoteJid, results );

        } catch (err) {
            logger.error('Error in endpoll command:', err);
            await safeSendText(sock, message.key.remoteJid, '❌ Failed to end poll' );
        }
    },

    async quiz(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;

            if (!remoteJid.endsWith('@g.us')) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used in groups' );
                return;
            }

            // For now, return a placeholder message
            await safeSendText(sock, remoteJid, '🎯 Quiz feature coming soon!'
            );

        } catch (err) {
            logger.error('Error in quiz command:', err);
            await safeSendText(sock, message.key.remoteJid, '❌ Failed to start quiz' );
        }
    },

    async trivia(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;

            if (!remoteJid.endsWith('@g.us')) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used in groups' );
                return;
            }

            // For now, return a placeholder message
            await safeSendText(sock, remoteJid, '🎮 Trivia feature coming soon!'
            );

        } catch (err) {
            logger.error('Error in trivia command:', err);
            await safeSendText(sock, message.key.remoteJid, '❌ Failed to start trivia' );
        }
    },

    async wordchain(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;

            if (!remoteJid.endsWith('@g.us')) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used in groups' );
                return;
            }

            // For now, return a placeholder message
            await safeSendText(sock, remoteJid, '🔠 Word Chain game coming soon!'
            );

        } catch (err) {
            logger.error('Error in wordchain command:', err);
            await safeSendText(sock, message.key.remoteJid, '❌ Failed to start word chain game' );
        }
    },

    async role(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;

            if (!remoteJid.endsWith('@g.us')) {
                await safeSendText(sock, remoteJid, '❌ Thiscommandcan only be used in groups' );
                return;
            }

            // For now, return a placeholder message
            await safeSendText(sock, remoteJid, '👥 Role management feature coming soon!'
            );

        } catch (err) {
            logger.error('Error in role command:', err);
            await safeSendText(sock, message.key.remoteJid, '❌ Failed to manage roles' );
        }
    },

    async setname(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;

            if (!remoteJid.endsWith('@g.us')) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used in groups' );
                return;
            }

            const sender = message.key.participant || message.key.remoteJid;
            const isUserAdmin = await isAdmin(sock, remoteJid, sender);
            if (!isUserAdmin) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used by admins' );
                return;
            }

            const newName = args.join(' ');
            if (!newName) {
                await safeSendText(sock, remoteJid, '❌ Please provide a new group name' );
                return;
            }

            await sock.groupUpdateSubject(remoteJid, newName);
            await safeSendText(sock, remoteJid, '✅ Group name has been updated' );

        } catch (err) {
            logger.error('Error in setname command:', err);
            await safeSendText(sock, message.key.remoteJid, '❌ Failed to update group name' );
        }
    },

    async setdesc(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;

            if (!remoteJid.endsWith('@g.us')) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used in groups' );
                return;
            }

            const sender = message.key.participant || message.key.remoteJid;
            const isUserAdmin = await isAdmin(sock, remoteJid, sender);
            if (!isUserAdmin) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used by admins' );
                return;
            }

            const newDesc = args.join(' ');
            if (!newDesc) {
                await safeSendText(sock, remoteJid, '❌ Please provide a new group description' );
                return;
            }

            await sock.groupUpdateDescription(remoteJid, newDesc);
            await safeSendText(sock, remoteJid, '✅ Group description has been updated' );

        } catch (err) {
            logger.error('Error in setdesc command:', err);
            await safeSendText(sock, message.key.remoteJid, '❌ Failed to update group description' );
        }
    },

    async setppic(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;

            if (!remoteJid.endsWith('@g.us')) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used in groups' );
                return;
            }

            const sender = message.key.participant || message.key.remoteJid;
            const isUserAdmin = await isAdmin(sock, remoteJid, sender);
            if (!isUserAdmin) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used by admins' );
                return;
            }

            const quoted = message.message.imageMessage || message.message.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage;
            if (!quoted) {
                await safeSendText(sock, remoteJid, '❌ Please send an image or reply to an image' );
                return;
            }

            const media = await downloadMediaMessage(message, 'buffer');
            await sock.updateProfilePicture(remoteJid, media);
            await safeSendText(sock, remoteJid, '✅ Group profile picture has been updated' );

        } catch (err) {
            logger.error('Error in setppic command:', err);
            await safeSendText(sock, message.key.remoteJid, '❌ Failed to update group profile picture' );
        }
    },

    async feature(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;

            if (!remoteJid.endsWith('@g.us')) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used in groups' );
                return;
            }

            const sender = message.key.participant || message.key.remoteJid;
            const isUserAdmin = await isAdmin(sock, remoteJid, sender);
            if (!isUserAdmin) {
                await safeSendText(sock, remoteJid, '❌ This command can only be used by admins' );
                return;
            }

            // Get all available features if no arguments provided
            if (args.length === 0) {
                const features = await getFeatureSettings(remoteJid);
                const featureList = Object.entries(features)
                    .map(([feature, enabled]) => `${feature}: ${enabled ? '✅ Enabled' : '❌ Disabled'}`)
                    .join('\n');

                await safeSendMessage(sock, remoteJid, {
                    text: `*Group Features*\n\n${featureList}\n\nUse '.feature <name> <on/off>' to change settings`
                });
                return;
            }

            // Handle feature toggle
            const [featureName, action] = args;

            if (!featureName) {
                await safeSendText(sock, remoteJid, '❌ Usage: .feature <name> <on/off> or .feature to see all features'
                );
                return;
            }

            // Just show status of a specific feature if no action provided
            if (!action) {
                const isEnabled = await isFeatureEnabled(remoteJid, featureName);
                await safeSendMessage(sock, remoteJid, {
                    text: `Feature "${featureName}" is currently: ${isEnabled ? '✅ Enabled' : '❌ Disabled'}`
                });
                return;
            }

            // Validate action
            if (!['on', 'off'].includes(action.toLowerCase())) {
                await safeSendText(sock, remoteJid, '❌ Action must be either "on" or "off"'
                );
                return;
            }

            // Update feature setting
            const enabled = action.toLowerCase() === 'on';
            const success = await setFeatureEnabled(remoteJid, featureName, enabled);

            if (success) {
                await safeSendMessage(sock, remoteJid, {
                    text: `✅ Feature "${featureName}" has been ${enabled ? 'enabled' : 'disabled'}`
                });
            } else {
                await safeSendMessage(sock, remoteJid, {
                    text: `❌ Failed to update feature "${featureName}"`
                });
            }

        } catch (err) {
            logger.error('Error in feature command:', err);
            await safeSendText(sock, message.key.remoteJid, '❌ Failed to manage feature settings' );
        }
    }
};

module.exports = {
    commands: groupCommands,
    category: 'group',
    async init() {
        try {
            logger.info('Initializing group command handler...');
            const initialized = await initializeDirectories();
            if (initialized) {
                logger.info('Group command handler initialized successfully');
                return true;
            }
            throw new Error('Failed to initialize group directories');
        } catch (err) {
            logger.error('Error initializing group command handler:', err);
            return false;
        }
    }
};