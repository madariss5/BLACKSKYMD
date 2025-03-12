const logger = require('../utils/logger');
const { isAdmin, isBotAdmin } = require('../utils/permissions');
const { downloadMediaMessage } = require('../utils/helpers');
const { getGroupSettings, saveGroupSettings } = require('../utils/groupSettings');
const path = require('path');
const fs = require('fs').promises;

// Extended group command handlers
const groupNewCommands = {
    async pin(sock, message, args) {
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

            // Get the message to pin
            const quoted = message.message.extendedTextMessage?.contextInfo?.quotedMessage;
            if (!quoted) {
                await sock.sendMessage(remoteJid, { text: '❌ Please reply to a message to pin it' });
                return;
            }

            // Store pinned message in group settings
            const settings = await getGroupSettings(remoteJid);
            if (!settings.pinnedMessages) settings.pinnedMessages = [];

            settings.pinnedMessages.push({
                message: quoted,
                pinnedBy: sender,
                timestamp: Date.now()
            });

            await saveGroupSettings(remoteJid, settings);
            await sock.sendMessage(remoteJid, { text: '📌 Message has been pinned' });

        } catch (err) {
            logger.error('Error in pin command:', err);
            await sock.sendMessage(message.key.remoteJid, { text: '❌ Failed to pin message' });
        }
    },

    async unpin(sock, message, args) {
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
            if (!settings.pinnedMessages || settings.pinnedMessages.length === 0) {
                await sock.sendMessage(remoteJid, { text: '❌ No pinned messages found' });
                return;
            }

            // Remove the last pinned message
            settings.pinnedMessages.pop();
            await saveGroupSettings(remoteJid, settings);

            await sock.sendMessage(remoteJid, { text: '📌 Last pinned message has been removed' });

        } catch (err) {
            logger.error('Error in unpin command:', err);
            await sock.sendMessage(message.key.remoteJid, { text: '❌ Failed to unpin message' });
        }
    },

    async pins(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;

            if (!remoteJid.endsWith('@g.us')) {
                await sock.sendMessage(remoteJid, { text: '❌ This command can only be used in groups' });
                return;
            }

            const settings = await getGroupSettings(remoteJid);
            if (!settings.pinnedMessages || settings.pinnedMessages.length === 0) {
                await sock.sendMessage(remoteJid, { text: '📌 No pinned messages' });
                return;
            }

            // Format pinned messages list
            const pinnedList = settings.pinnedMessages
                .map((pin, i) => `${i + 1}. Pinned by: @${pin.pinnedBy.split('@')[0]} (${new Date(pin.timestamp).toLocaleString()})`)
                .join('\n');

            await sock.sendMessage(remoteJid, { 
                text: `📌 Pinned Messages:\n\n${pinnedList}`,
                mentions: settings.pinnedMessages.map(pin => pin.pinnedBy)
            });

        } catch (err) {
            logger.error('Error in pins command:', err);
            await sock.sendMessage(message.key.remoteJid, { text: '❌ Failed to list pinned messages' });
        }
    }
};

module.exports = {
    commands: groupNewCommands,
    category: 'group',
    async init() {
        try {
            logger.moduleInit('Group Extended');

            // Check core dependencies
            const coreDeps = {
                isAdmin,
                isBotAdmin,
                path,
                logger,
                fs: fs.promises,
                getGroupSettings,
                saveGroupSettings
            };

            for (const [name, dep] of Object.entries(coreDeps)) {
                if (!dep) {
                    logger.error(`❌ Core extended group dependency '${name}' is not initialized`);
                    return false;
                }
                logger.info(`✓ Core extended group dependency '${name}' verified`);
            }

            // Check optional dependencies
            const optionalDeps = {
                downloadMediaMessage
            };

            for (const [name, dep] of Object.entries(optionalDeps)) {
                if (!dep) {
                    logger.warn(`⚠️ Optional extended group dependency '${name}' is not available`);
                } else {
                    logger.info(`✓ Optional extended group dependency '${name}' verified`);
                }
            }

            // Ensure required directories exist
            const dataDir = path.join(__dirname, '../../data/groups_extended');
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

            // Validate extended command functionality
            const { validateGroupCommands } = require('../utils/commandValidator');
            const validationResult = await validateGroupCommands();

            if (!validationResult) {
                logger.warn('⚠️ Extended group command validation reported issues');
            } else {
                logger.info('✓ Extended group command validation passed');
            }

            logger.moduleSuccess('Group Extended');
            return true;
        } catch (err) {
            logger.moduleError('Group Extended', err);
            return false;
        }
    }
};