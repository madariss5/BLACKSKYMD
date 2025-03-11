const logger = require('../utils/logger');
const { isAdmin, isBotAdmin } = require('../utils/permissions');
const { downloadMediaMessage } = require('../utils/helpers');
const { getGroupSettings, saveGroupSettings, isFeatureEnabled, setFeatureEnabled, getFeatureSettings } = require('../utils/groupSettings');
const path = require('path');
const fs = require('fs').promises;

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
                await sock.sendMessage(remoteJid, { text: '❌ This command can only be used in groups' });
                return;
            }

            const sender = message.key.participant || message.key.remoteJid;
            const isUserAdmin = await isAdmin(sock, remoteJid, sender);
            if (!isUserAdmin) {
                await sock.sendMessage(remoteJid, { text: '❌ This command can only be used by admins' });
                return;
            }

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

            const isTargetAdmin = await isAdmin(sock, remoteJid, target);
            if (isTargetAdmin) {
                await sock.sendMessage(remoteJid, { text: '❌ Cannot kick an admin' });
                return;
            }

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

            if (!remoteJid.endsWith('@g.us')) {
                await sock.sendMessage(remoteJid, { text: '❌ This command can only be used in groups' });
                return;
            }

            const sender = message.key.participant || message.key.remoteJid;
            const isUserAdmin = await isAdmin(sock, remoteJid, sender);
            if (!isUserAdmin) {
                await sock.sendMessage(remoteJid, { text: '❌ This command can only be used by admins' });
                return;
            }

            if (!args[0]) {
                await sock.sendMessage(remoteJid, { text: '❌ Please provide the phone number to add' });
                return;
            }

            const number = args[0].replace(/[^0-9]/g, '') + '@s.whatsapp.net';

            await sock.groupParticipantsUpdate(remoteJid, [number], 'add');
            await sock.sendMessage(remoteJid, { text: '✅ User has been added to the group' });

        } catch (err) {
            logger.error('Error in add command:', err);
            await sock.sendMessage(message.key.remoteJid, { text: '❌ Failed to add user' });
        }
    },

    async promote(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;

            if (!remoteJid.endsWith('@g.us')) {
                await sock.sendMessage(remoteJid, { text: '❌ This command can only be used in groups' });
                return;
            }

            const sender = message.key.participant || message.key.remoteJid;
            const isUserAdmin = await isAdmin(sock, remoteJid, sender);
            if (!isUserAdmin) {
                await sock.sendMessage(remoteJid, { text: '❌ This command can only be used by admins' });
                return;
            }

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

            if (!remoteJid.endsWith('@g.us')) {
                await sock.sendMessage(remoteJid, { text: '❌ This command can only be used in groups' });
                return;
            }

            const sender = message.key.participant || message.key.remoteJid;
            const isUserAdmin = await isAdmin(sock, remoteJid, sender);
            if (!isUserAdmin) {
                await sock.sendMessage(remoteJid, { text: '❌ This command can only be used by admins' });
                return;
            }

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

            const isTargetOwner = await isAdmin(sock, remoteJid, target, true);
            if (isTargetOwner) {
                await sock.sendMessage(remoteJid, { text: '❌ Cannot demote the group owner' });
                return;
            }

            await sock.groupParticipantsUpdate(remoteJid, [target], 'demote');
            await sock.sendMessage(remoteJid, { text: '✅ User has been demoted from admin' });

        } catch (err) {
            logger.error('Error in demote command:', err);
            await sock.sendMessage(message.key.remoteJid, { text: '❌ Failed to demote user' });
        }
    },

    async mute(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;

            if (!remoteJid.endsWith('@g.us')) {
                await sock.sendMessage(remoteJid, { text: '❌ This command can only be used in groups' });
                return;
            }

            const sender = message.key.participant || message.key.remoteJid;
            const isUserAdmin = await isAdmin(sock, remoteJid, sender);
            if (!isUserAdmin) {
                await sock.sendMessage(remoteJid, { text: '❌ This command can only be used by admins' });
                return;
            }

            await sock.groupSettingUpdate(remoteJid, 'announcement');
            await sock.sendMessage(remoteJid, { text: '🔇 Group has been muted' });

        } catch (err) {
            logger.error('Error in mute command:', err);
            await sock.sendMessage(message.key.remoteJid, { text: '❌ Failed to mute group' });
        }
    },

    async unmute(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;

            if (!remoteJid.endsWith('@g.us')) {
                await sock.sendMessage(remoteJid, { text: '❌ This command can only be used in groups' });
                return;
            }

            const sender = message.key.participant || message.key.remoteJid;
            const isUserAdmin = await isAdmin(sock, remoteJid, sender);
            if (!isUserAdmin) {
                await sock.sendMessage(remoteJid, { text: '❌ This command can only be used by admins' });
                return;
            }

            await sock.groupSettingUpdate(remoteJid, 'not_announcement');
            await sock.sendMessage(remoteJid, { text: '🔊 Group has been unmuted' });

        } catch (err) {
            logger.error('Error in unmute command:', err);
            await sock.sendMessage(message.key.remoteJid, { text: '❌ Failed to unmute group' });
        }
    },
    async antispam(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;

            if (!remoteJid.endsWith('@g.us')) {
                await sock.sendMessage(remoteJid, { text: '❌ This command can only be used in groups' });
                return;
            }

            const sender = message.key.participant || message.key.remoteJid;
            const isUserAdmin = await isAdmin(sock, remoteJid, sender);
            if (!isUserAdmin) {
                await sock.sendMessage(remoteJid, { text: '❌ This command can only be used by admins' });
                return;
            }

            const [action] = args;
            if (!action || !['on', 'off'].includes(action.toLowerCase())) {
                await sock.sendMessage(remoteJid, { text: '❌ Usage: !antispam <on/off>' });
                return;
            }

            // Store the setting in the group settings map
            const settings = await getGroupSettings(remoteJid);
            settings.antispam = action.toLowerCase() === 'on';
            await saveGroupSettings(remoteJid, settings);

            await sock.sendMessage(remoteJid, {
                text: `✅ Anti-spam has been turned ${action.toLowerCase()}`
            });

        } catch (err) {
            logger.error('Error in antispam command:', err);
            await sock.sendMessage(message.key.remoteJid, { text: '❌ Failed to update anti-spam settings' });
        }
    },

    async antilink(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;

            if (!remoteJid.endsWith('@g.us')) {
                await sock.sendMessage(remoteJid, { text: '❌ This command can only be used in groups' });
                return;
            }

            const sender = message.key.participant || message.key.remoteJid;
            const isUserAdmin = await isAdmin(sock, remoteJid, sender);
            if (!isUserAdmin) {
                await sock.sendMessage(remoteJid, { text: '❌ This command can only be used by admins' });
                return;
            }

            const [action] = args;
            if (!action || !['on', 'off'].includes(action.toLowerCase())) {
                await sock.sendMessage(remoteJid, { text: '❌ Usage: !antilink <on/off>' });
                return;
            }

            // Store the setting in the group settings map
            const settings = await getGroupSettings(remoteJid);
            settings.antilink = action.toLowerCase() === 'on';
            await saveGroupSettings(remoteJid, settings);

            await sock.sendMessage(remoteJid, {
                text: `✅ Anti-link has been turned ${action.toLowerCase()}`
            });

        } catch (err) {
            logger.error('Error in antilink command:', err);
            await sock.sendMessage(message.key.remoteJid, { text: '❌ Failed to update anti-link settings' });
        }
    },

    async antitoxic(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;

            if (!remoteJid.endsWith('@g.us')) {
                await sock.sendMessage(remoteJid, { text: '❌ This command can only be used in groups' });
                return;
            }

            const sender = message.key.participant || message.key.remoteJid;
            const isUserAdmin = await isAdmin(sock, remoteJid, sender);
            if (!isUserAdmin) {
                await sock.sendMessage(remoteJid, { text: '❌ This command can only be used by admins' });
                return;
            }

            const [action] = args;
            if (!action || !['on', 'off'].includes(action.toLowerCase())) {
                await sock.sendMessage(remoteJid, { text: '❌ Usage: !antitoxic <on/off>' });
                return;
            }

            // Store the setting in the group settings map
            const settings = await getGroupSettings(remoteJid);
            settings.antitoxic = action.toLowerCase() === 'on';
            await saveGroupSettings(remoteJid, settings);

            await sock.sendMessage(remoteJid, {
                text: `✅ Anti-toxic has been turned ${action.toLowerCase()}`
            });

        } catch (err) {
            logger.error('Error in antitoxic command:', err);
            await sock.sendMessage(message.key.remoteJid, { text: '❌ Failed to update anti-toxic settings' });
        }
    },

    async antiraid(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;

            if (!remoteJid.endsWith('@g.us')) {
                await sock.sendMessage(remoteJid, { text: '❌ This command can only be used in groups' });
                return;
            }

            const sender = message.key.participant || message.key.remoteJid;
            const isUserAdmin = await isAdmin(sock, remoteJid, sender);
            if (!isUserAdmin) {
                await sock.sendMessage(remoteJid, { text: '❌ This command can only be used by admins' });
                return;
            }

            const [action, threshold] = args;
            if (!action || !['on', 'off'].includes(action.toLowerCase())) {
                await sock.sendMessage(remoteJid, {
                    text: '❌ Usage: !antiraid <on/off> [max_joins_per_minute]'
                });
                return;
            }

            // Store the settings in the group settings map
            const settings = await getGroupSettings(remoteJid);
            settings.antiraid = action.toLowerCase() === 'on';
            if (threshold && !isNaN(threshold)) {
                settings.raidThreshold = parseInt(threshold);
            }
            await saveGroupSettings(remoteJid, settings);

            await sock.sendMessage(remoteJid, {
                text: `✅ Anti-raid has been turned ${action.toLowerCase()}${
                    threshold ? ` with threshold of ${threshold} joins per minute` : ''
                }`
            });

        } catch (err) {
            logger.error('Error in antiraid command:', err);
            await sock.sendMessage(message.key.remoteJid, { text: '❌ Failed to update anti-raid settings' });
        }
    },
    async warn(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;

            if (!remoteJid.endsWith('@g.us')) {
                await sock.sendMessage(remoteJid, { text: '❌ This command can only be used in groups' });
                return;
            }

            const sender = message.key.participant || message.key.remoteJid;
            const isUserAdmin = await isAdmin(sock, remoteJid, sender);
            if (!isUserAdmin) {
                await sock.sendMessage(remoteJid, { text: '❌ This command can only be used by admins' });
                return;
            }

            let target;
            if (message.message.extendedTextMessage?.contextInfo?.participant) {
                target = message.message.extendedTextMessage.contextInfo.participant;
            } else if (args[0]) {
                target = args[0].replace('@', '') + '@s.whatsapp.net';
            }

            if (!target) {
                await sock.sendMessage(remoteJid, { text: '❌ Please mention a user to warn' });
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
            await sock.sendMessage(remoteJid, {
                text: `⚠️ User has been warned (${warningCount} warnings)\nReason: ${reason}`
            });

            // Check if user should be kicked
            if (warningCount >= 3) {
                try {
                    await sock.groupParticipantsUpdate(remoteJid, [target], 'remove');
                    await sock.sendMessage(remoteJid, {
                        text: '🚫 User has been removed for receiving 3 warnings'
                    });
                } catch (err) {
                    logger.error('Failed to remove user after 3 warnings:', err);
                }
            }

        } catch (err) {
            logger.error('Error in warn command:', err);
            await sock.sendMessage(message.key.remoteJid, { text: '❌ Failed to warn user' });
        }
    },

    async removewarn(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;

            if (!remoteJid.endsWith('@g.us')) {
                await sock.sendMessage(remoteJid, { text: '❌ This command can only be used in groups' });
                return;
            }

            const sender = message.key.participant || message.key.remoteJid;
            const isUserAdmin = await isAdmin(sock, remoteJid, sender);
            if (!isUserAdmin) {
                await sock.sendMessage(remoteJid, { text: '❌ This command can only be used by admins' });
                return;
            }

            let target;
            if (message.message.extendedTextMessage?.contextInfo?.participant) {
                target = message.message.extendedTextMessage.contextInfo.participant;
            } else if (args[0]) {
                target = args[0].replace('@', '') + '@s.whatsapp.net';
            }

            if (!target) {
                await sock.sendMessage(remoteJid, { text: '❌ Please mention a user' });
                return;
            }

            // Get current warnings
            const settings = await getGroupSettings(remoteJid);
            if (!settings.warnings || !settings.warnings[target] || !settings.warnings[target].length) {
                await sock.sendMessage(remoteJid, { text: '❌ User has no warnings' });
                return;
            }

            settings.warnings[target].pop(); // Remove the last warning
            await saveGroupSettings(remoteJid, settings);

            const warningCount = settings.warnings[target].length;
            await sock.sendMessage(remoteJid, {
                text: `✅ Removed 1 warning from user (${warningCount} warnings remaining)`
            });

        } catch (err) {
            logger.error('Error in removewarn command:', err);
            await sock.sendMessage(message.key.remoteJid, { text: '❌ Failed to remove warning' });
        }
    },

    async warnings(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;

            if (!remoteJid.endsWith('@g.us')) {
                await sock.sendMessage(remoteJid, { text: '❌ This command can only be used in groups' });
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
                await sock.sendMessage(remoteJid, { text: '✅ User has no warnings' });
                return;
            }

            const warningList = settings.warnings[target]
                .map((w, i) => `${i + 1}. ${w.reason} (${new Date(w.time).toLocaleString()})`)
                .join('\n');

            await sock.sendMessage(remoteJid, {
                text: `⚠️ Warnings for user:\n${warningList}`
            });

        } catch (err) {
            logger.error('Error in warnings command:', err);
            await sock.sendMessage(message.key.remoteJid, { text: '❌ Failed to fetch warnings' });
        }
    },
    async announce(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;

            if (!remoteJid.endsWith('@g.us')) {
                await sock.sendMessage(remoteJid, { text: '❌ This command can only be used in groups' });
                return;
            }

            const sender = message.key.participant || message.key.remoteJid;
            const isUserAdmin = await isAdmin(sock, remoteJid, sender);
            if (!isUserAdmin) {
                await sock.sendMessage(remoteJid, { text: '❌ This command can only be used by admins' });
                return;
            }

            const announcement = args.join(' ');
            if (!announcement) {
                await sock.sendMessage(remoteJid, { text: '❌ Please provide an announcement message' });
                return;
            }

            await sock.sendMessage(remoteJid, {
                text: `📢 *Group Announcement*\n\n${announcement}`
            });

        } catch (err) {
            logger.error('Error in announce command:', err);
            await sock.sendMessage(message.key.remoteJid, { text: '❌ Failed to send announcement' });
        }
    },

    async schedule(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;

            if (!remoteJid.endsWith('@g.us')) {
                await sock.sendMessage(remoteJid, { text: '❌ This command can only be used in groups' });
                return;
            }

            const sender = message.key.participant || message.key.remoteJid;
            const isUserAdmin = await isAdmin(sock, remoteJid, sender);
            if (!isUserAdmin) {
                await sock.sendMessage(remoteJid, { text: '❌ This command can only be used by admins' });
                return;
            }

            if (args.length < 2) {
                await sock.sendMessage(remoteJid, {
                    text: '❌ Usage: !schedule [time] [message]\nTime format: 1h, 2d, etc.'
                });
                return;
            }

            const timeStr = args[0];
            const scheduleMessage = args.slice(1).join(' ');

            const seconds = parseDuration(timeStr);
            if (!seconds) {
                await sock.sendMessage(remoteJid, {
                    text: '❌ Invalid time format. Use 1h, 2d, etc.'
                });
                return;
            }

            // Store the scheduled message
            const settings = await getGroupSettings(remoteJid);
            if (!settings.scheduled) settings.scheduled = [];

            settings.scheduled.push({
                message: scheduleMessage,
                time: Date.now() + (seconds * 1000),
                by: sender
            });

            await saveGroupSettings(remoteJid, settings);

            await sock.sendMessage(remoteJid, {
                text: `✅ Message scheduled for ${formatDuration(seconds)} from now`
            });

        } catch (err) {
            logger.error('Error in schedule command:', err);
            await sock.sendMessage(message.key.remoteJid, { text: '❌ Failed to schedule message' });
        }
    },

    async poll(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;

            if (!remoteJid.endsWith('@g.us')) {
                await sock.sendMessage(remoteJid, { text: '❌ This command can only be used in groups' });
                return;
            }

            if (args.length < 3) {
                await sock.sendMessage(remoteJid, {
                    text: '❌ Usage: !poll [question] [option1] [option2] ...'
                });
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

            await sock.sendMessage(remoteJid, { text: pollMessage });

        } catch (err) {
            logger.error('Error in poll command:', err);
            await sock.sendMessage(message.key.remoteJid, { text: '❌ Failed to create poll' });
        }
    },

    async vote(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;

            if (!remoteJid.endsWith('@g.us')) {
                await sock.sendMessage(remoteJid, { text: '❌ This command can only be used in groups' });
                return;
            }

            if (!args[0] || isNaN(args[0])) {
                await sock.sendMessage(remoteJid, { text: '❌ Please provide a valid option number' });
                return;
            }

            const settings = await getGroupSettings(remoteJid);
            if (!settings.polls || Object.keys(settings.polls).length === 0) {
                await sock.sendMessage(remoteJid, { text: '❌ No active poll' });
                return;
            }

            // Get latest poll
            const pollId = Object.keys(settings.polls).sort().pop();
            const poll = settings.polls[pollId];

            const optionNum = parseInt(args[0]) - 1;
            if (optionNum < 0 || optionNum >= poll.options.length) {
                await sock.sendMessage(remoteJid, { text: '❌ Invalid option number' });
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

            await sock.sendMessage(remoteJid, { text: results });

        } catch (err) {
            logger.error('Error in vote command:', err);
            await sock.sendMessage(message.key.remoteJid, { text: '❌ Failed to register vote' });
        }
    },

    async endpoll(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;

            if (!remoteJid.endsWith('@g.us')) {
                await sock.sendMessage(remoteJid, { text: '❌ This command can only be used in groups' });
                return;
            }

            const sender = message.key.participant || message.key.remoteJid;
            const isUserAdmin = await isAdmin(sock, remoteJid, sender);
            if (!isUserAdmin) {
                await sock.sendMessage(remoteJid, { text: '❌ This command can only be used by admins' });
                return;
            }

            const settings = await getGroupSettings(remoteJid);
            if (!settings.polls || Object.keys(settings.polls).length === 0) {
                await sock.sendMessage(remoteJid, { text: '❌ No active poll' });
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

            await sock.sendMessage(remoteJid, { text: results });

        } catch (err) {
            logger.error('Error in endpoll command:', err);
            await sock.sendMessage(message.key.remoteJid, { text: '❌ Failed to end poll' });
        }
    },

    async quiz(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;

            if (!remoteJid.endsWith('@g.us')) {
                await sock.sendMessage(remoteJid, { text: '❌ This command can only be used in groups' });
                return;
            }

            // For now, return a placeholder message
            await sock.sendMessage(remoteJid, {
                text: '🎯 Quiz feature coming soon!'
            });

        } catch (err) {
            logger.error('Error in quiz command:', err);
            await sock.sendMessage(message.key.remoteJid, { text: '❌ Failed to start quiz' });
        }
    },

    async trivia(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;

            if (!remoteJid.endsWith('@g.us')) {
                await sock.sendMessage(remoteJid, { text: '❌ This command can only be used in groups' });
                return;
            }

            // For now, return a placeholder message
            await sock.sendMessage(remoteJid, {
                text: '🎮 Trivia feature coming soon!'
            });

        } catch (err) {
            logger.error('Error in trivia command:', err);
            await sock.sendMessage(message.key.remoteJid, { text: '❌ Failed to start trivia' });
        }
    },

    async wordchain(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;

            if (!remoteJid.endsWith('@g.us')) {
                await sock.sendMessage(remoteJid, { text: '❌ This command can only be used in groups' });
                return;
            }

            // For now, return a placeholder message
            await sock.sendMessage(remoteJid, {
                text: '🔠 Word Chain game coming soon!'
            });

        } catch (err) {
            logger.error('Error in wordchain command:', err);
            await sock.sendMessage(message.key.remoteJid, { text: '❌ Failed to start word chain game' });
        }
    },

    async role(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;

            if (!remoteJid.endsWith('@g.us')) {
                await sock.sendMessage(remoteJid, { text: '❌ Thiscommandcan only be used in groups' });
                return;
            }

            // For now, return a placeholder message
            await sock.sendMessage(remoteJid, {
                text: '👥 Role management feature coming soon!'
            });

        } catch (err) {
            logger.error('Error in role command:', err);
            await sock.sendMessage(message.key.remoteJid, { text: '❌ Failed to manage roles' });
        }
    },

    async setname(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;

            if (!remoteJid.endsWith('@g.us')) {
                await sock.sendMessage(remoteJid, { text: '❌ This command can only be used in groups' });
                return;
            }

            const sender = message.key.participant || message.key.remoteJid;
            const isUserAdmin = await isAdmin(sock, remoteJid, sender);
            if (!isUserAdmin) {
                await sock.sendMessage(remoteJid, { text: '❌ This command can only be used by admins' });
                return;
            }

            const newName = args.join(' ');
            if (!newName) {
                await sock.sendMessage(remoteJid, { text: '❌ Please provide a new group name' });
                return;
            }

            await sock.groupUpdateSubject(remoteJid, newName);
            await sock.sendMessage(remoteJid, { text: '✅ Group name has been updated' });

        } catch (err) {
            logger.error('Error in setname command:', err);
            await sock.sendMessage(message.key.remoteJid, { text: '❌ Failed to update group name' });
        }
    },

    async setdesc(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;

            if (!remoteJid.endsWith('@g.us')) {
                await sock.sendMessage(remoteJid, { text: '❌ This command can only be used in groups' });
                return;
            }

            const sender = message.key.participant || message.key.remoteJid;
            const isUserAdmin = await isAdmin(sock, remoteJid, sender);
            if (!isUserAdmin) {
                await sock.sendMessage(remoteJid, { text: '❌ This command can only be used by admins' });
                return;
            }

            const newDesc = args.join(' ');
            if (!newDesc) {
                await sock.sendMessage(remoteJid, { text: '❌ Please provide a new group description' });
                return;
            }

            await sock.groupUpdateDescription(remoteJid, newDesc);
            await sock.sendMessage(remoteJid, { text: '✅ Group description has been updated' });

        } catch (err) {
            logger.error('Error in setdesc command:', err);
            await sock.sendMessage(message.key.remoteJid, { text: '❌ Failed to update group description' });
        }
    },

    async setppic(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;

            if (!remoteJid.endsWith('@g.us')) {
                await sock.sendMessage(remoteJid, { text: '❌ This command can only be used in groups' });
                return;
            }

            const sender = message.key.participant || message.key.remoteJid;
            const isUserAdmin = await isAdmin(sock, remoteJid, sender);
            if (!isUserAdmin) {
                await sock.sendMessage(remoteJid, { text: '❌ This command can only be used by admins' });
                return;
            }

            const quoted = message.message.imageMessage || message.message.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage;
            if (!quoted) {
                await sock.sendMessage(remoteJid, { text: '❌ Please send an image or reply to an image' });
                return;
            }

            const media = await downloadMediaMessage(message, 'buffer');
            await sock.updateProfilePicture(remoteJid, media);
            await sock.sendMessage(remoteJid, { text: '✅ Group profile picture has been updated' });

        } catch (err) {
            logger.error('Error in setppic command:', err);
            await sock.sendMessage(message.key.remoteJid, { text: '❌ Failed to update group profile picture' });
        }
    },

    async feature(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;

            if (!remoteJid.endsWith('@g.us')) {
                await sock.sendMessage(remoteJid, { text: '❌ This command can only be used in groups' });
                return;
            }

            const sender = message.key.participant || message.key.remoteJid;
            const isUserAdmin = await isAdmin(sock, remoteJid, sender);
            if (!isUserAdmin) {
                await sock.sendMessage(remoteJid, { text: '❌ This command can only be used by admins' });
                return;
            }

            // Get all available features if no arguments provided
            if (args.length === 0) {
                const features = await getFeatureSettings(remoteJid);
                const featureList = Object.entries(features)
                    .map(([feature, enabled]) => `${feature}: ${enabled ? '✅ Enabled' : '❌ Disabled'}`)
                    .join('\n');
                
                await sock.sendMessage(remoteJid, { 
                    text: `*Group Features*\n\n${featureList}\n\nUse '.feature <name> <on/off>' to change settings` 
                });
                return;
            }

            // Handle feature toggle
            const [featureName, action] = args;
            
            if (!featureName) {
                await sock.sendMessage(remoteJid, { 
                    text: '❌ Usage: .feature <name> <on/off> or .feature to see all features' 
                });
                return;
            }

            // Just show status of a specific feature if no action provided
            if (!action) {
                const isEnabled = await isFeatureEnabled(remoteJid, featureName);
                await sock.sendMessage(remoteJid, { 
                    text: `Feature "${featureName}" is currently: ${isEnabled ? '✅ Enabled' : '❌ Disabled'}` 
                });
                return;
            }

            // Validate action
            if (!['on', 'off'].includes(action.toLowerCase())) {
                await sock.sendMessage(remoteJid, { 
                    text: '❌ Action must be either "on" or "off"' 
                });
                return;
            }

            // Update feature setting
            const enabled = action.toLowerCase() === 'on';
            const success = await setFeatureEnabled(remoteJid, featureName, enabled);
            
            if (success) {
                await sock.sendMessage(remoteJid, { 
                    text: `✅ Feature "${featureName}" has been ${enabled ? 'enabled' : 'disabled'}` 
                });
            } else {
                await sock.sendMessage(remoteJid, { 
                    text: `❌ Failed to update feature "${featureName}"` 
                });
            }

        } catch (err) {
            logger.error('Error in feature command:', err);
            await sock.sendMessage(message.key.remoteJid, { text: '❌ Failed to manage feature settings' });
        }
    }

};

module.exports = {
    commands: groupCommands,
    category: 'group_base',
    async init() {
        try {
            logger.moduleInit('Group Base');

            // Check core dependencies first
            const coreDeps = {
                isAdmin,
                isBotAdmin,
                path,
                logger,
                fs: fs.promises,
                getGroupSettings,
                saveGroupSettings,
                isFeatureEnabled,
                setFeatureEnabled,
                getFeatureSettings
            };

            for (const [name, dep] of Object.entries(coreDeps)) {
                if (!dep) {
                    logger.error(`❌ Core group dependency '${name}' is not initialized`);
                    return false;
                }
                logger.info(`✓ Core group dependency '${name}' verified`);
            }

            // Check optional dependencies
            const optionalDeps = {
                downloadMediaMessage
            };

            for (const [name, dep] of Object.entries(optionalDeps)) {
                if (!dep) {
                    logger.warn(`⚠️ Optional group dependency '${name}' is not available`);
                } else {
                    logger.info(`✓ Optional group dependency '${name}' verified`);
                }
            }

            // Ensure required directories exist
            const dataDir = path.join(__dirname, '../../data/groups');
            try {
                await fs.mkdir(dataDir, { recursive: true });
                const stats = await fs.stat(dataDir);
                if (!stats.isDirectory()) {
                    throw new Error('Path exists but is not a directory');
                }
                logger.info(`✓ Directory verified: ${dataDir}`);
            } catch (err) {
                logger.error(`❌ Directory creation failed for ${dataDir}:`, err);
                return false;
            }

            // Validate command functionality
            const { validateGroupCommands } = require('../utils/commandValidator');
            const validationResult = await validateGroupCommands();

            if (!validationResult) {
                logger.warn('⚠️ Group command validation reported issues');
            } else {
                logger.info('✓ Group command validation passed');
            }

            logger.moduleSuccess('Group Base');
            return true;
        } catch (err) {
            logger.moduleError('Group Base', err);
            return false;
        }
    }
};