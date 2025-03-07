const logger = require('../utils/logger');
const { isAdmin, isBotAdmin } = require('../utils/permissions');
const { downloadMediaMessage } = require('../utils/helpers');
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
        // ... copy implementation
    },
    async promote(sock, message, args) {
        // ... copy implementation
    },
    async demote(sock, message, args) {
        // ... copy implementation
    },
    async mute(sock, message, args) {
        // ... copy implementation
    },
    async unmute(sock, message, args) {
        // ... copy implementation
    },
    async antispam(sock, message, args) {
        // ... copy implementation
    },
    async antilink(sock, message, args) {
        // ... copy implementation
    },
    async antitoxic(sock, message, args) {
        // ... copy implementation
    },
    async antiraid(sock, message, args) {
        // ... copy implementation
    },
    async warn(sock, message, args) {
        // ... copy implementation
    },
    async removewarn(sock, message, args) {
        // ... copy implementation
    },
    async warnings(sock, message, args) {
        // ... copy implementation
    },
    async announce(sock, message, args) {
        // ... copy implementation
    },
    async schedule(sock, message, args) {
        // ... copy implementation
    },
    async poll(sock, message, args) {
        // ... copy implementation
    },
    async vote(sock, message, args) {
        // ... copy implementation
    },
    async endpoll(sock, message, args) {
        // ... copy implementation
    },
    async quiz(sock, message, args) {
        // ... copy implementation
    },
    async trivia(sock, message, args) {
        // ... copy implementation
    },
    async wordchain(sock, message, args) {
        // ... copy implementation
    },
    async role(sock, message, args) {
        // ... copy implementation
    },
    async setname(sock, message, args) {
        // ... copy implementation
    },
    async setdesc(sock, message, args) {
        // ... copy implementation
    },
    async setppic(sock, message, args) {
        // ... copy implementation
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
                fs: fs.promises
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

            // Initialize settings storage
            const groupSettings = new Map();
            logger.info('✓ Group settings map initialized');

            logger.moduleSuccess('Group Base');
            return true;
        } catch (err) {
            logger.moduleError('Group Base', err);
            return false;
        }
    }
};