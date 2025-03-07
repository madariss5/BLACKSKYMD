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

// Export with enhanced format and proper initialization
module.exports = {
    commands: groupCommands,
    category: 'group',
    async init() {
        try {
            logger.info('Initializing group command handler...');

            // Verify required modules with better error handling
            const requiredDeps = {
                isAdmin: isAdmin,
                isBotAdmin: isBotAdmin,
                downloadMediaMessage: downloadMediaMessage,
                fs: fs.promises,
                path: path,
                logger: logger
            };

            for (const [name, dep] of Object.entries(requiredDeps)) {
                if (!dep) {
                    logger.error(`Missing dependency: ${name}`);
                    throw new Error(`Required dependency '${name}' is not initialized`);
                }
            }

            // Create necessary directories with error handling
            const dataDir = path.join(__dirname, '../../data/groups');
            try {
                await fs.mkdir(dataDir, { recursive: true });
                logger.info(`Created directory: ${dataDir}`);
            } catch (err) {
                logger.error(`Failed to create directory ${dataDir}:`, err);
                throw err;
            }

            // Initialize settings storage
            const groupSettings = new Map();

            logger.info('Group command handler initialized successfully');
            return true;
        } catch (err) {
            logger.error('Error initializing group command handler:', err.message);
            logger.error('Stack trace:', err.stack);
            throw err;
        }
    }
};