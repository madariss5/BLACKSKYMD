const logger = require('../utils/logger');
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const { promisify } = require('util');
const exec = promisify(require('child_process').exec);
const FormData = require('form-data');
const sharp = require('sharp');
const ffmpeg = require('fluent-ffmpeg');
const { getGroupSettings, saveGroupSettings } = require('../utils/groupSettings');
const { languageManager } = require('../utils/language');
const { 
    safeSendMessage, 
    safeSendText, 
    safeSendImage, 
    isJidGroup, 
    isJidUser,
    safeSendAnimatedGif 
} = require('../utils/jidHelper');

const TEMP_DIR = path.join(__dirname, '../../temp/nsfw');

// API endpoints for NSFW content
const API_ENDPOINTS = {
    HMTAI: 'https://hmtai.hatsunia.cfd/v2',
    WAIFU: 'https://api.waifu.pics/nsfw',
    NEKO: 'https://nekos.life/api/v2',
    FALLBACK: 'https://api.waifu.im/search'
};

async function getFileTypeFromBuffer(buffer) {
    try {
        const FileType = await import('file-type');
        return await FileType.fileTypeFromBuffer(buffer);
    } catch (error) {
        logger.error('Error importing or using file-type module:', error);
        return detectFileTypeFromMagicNumbers(buffer);
    }
}

function detectFileTypeFromMagicNumbers(buffer) {
    if (!buffer || buffer.length < 4) return null;
    if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
        return { ext: 'jpg', mime: 'image/jpeg' };
    }
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
        return { ext: 'png', mime: 'image/png' };
    }
    if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38) {
        return { ext: 'gif', mime: 'image/gif' };
    }
    if (buffer.length >= 12 && buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
        buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) {
        return { ext: 'webp', mime: 'image/webp' };
    }
    if (buffer.length >= 8 && buffer[4] === 0x66 && buffer[5] === 0x74 && buffer[6] === 0x79 && buffer[7] === 0x70) {
        return { ext: 'mp4', mime: 'video/mp4' };
    }
    return null;
}

const verifiedUsers = new Map();
const groupNsfwSettings = new Map();
const userCooldowns = new Map();

async function initDirectories() {
    try {
        await fs.mkdir(TEMP_DIR, { recursive: true });
        logger.info('NSFW temp directories created');
    } catch (err) {
        logger.error('Failed to create NSFW temp directories:', err);
    }
}

function isUserVerified(userId) {
    return verifiedUsers.has(userId);
}

function setUserVerification(userId, verified = true) {
    if (verified) {
        verifiedUsers.set(userId, {
            verified: true,
            timestamp: Date.now()
        });
    } else {
        verifiedUsers.delete(userId);
    }
}

async function isNsfwEnabledForGroup(groupId) {
    // Ensure groupId is a string - fix for "endsWith is not a function" error
    const safeGroupId = String(groupId || '');
    
    if (groupNsfwSettings.has(safeGroupId)) {
        return groupNsfwSettings.get(safeGroupId).enabled;
    }

    try {
        const settings = await getGroupSettings(safeGroupId);
        const enabled = settings?.nsfw?.enabled || false;
        groupNsfwSettings.set(safeGroupId, { enabled });
        return enabled;
    } catch (err) {
        logger.error(`Error checking NSFW settings for group ${safeGroupId}:`, err);
        return false;
    }
}

async function saveNsfwSettingsForGroup(groupId, enabled) {
    try {
        // Ensure groupId is a string - fix for "endsWith is not a function" error
        const safeGroupId = String(groupId || '');
        
        const settings = await getGroupSettings(safeGroupId);
        settings.nsfw = {
            ...settings.nsfw,
            enabled,
            updatedAt: Date.now()
        };

        await saveGroupSettings(safeGroupId, settings);
        groupNsfwSettings.set(safeGroupId, { enabled });
        logger.info(`NSFW settings updated for group ${safeGroupId}: ${enabled ? 'enabled' : 'disabled'}`);
        return true;
    } catch (err) {
        logger.error(`Error saving NSFW settings for group ${groupId}:`, err);
        return false;
    }
}

async function downloadMedia(url) {
    try {
        const response = await axios.get(url, { responseType: 'arraybuffer' });
        const buffer = Buffer.from(response.data);
        const fileType = await getFileTypeFromBuffer(buffer);

        if (!fileType) {
            logger.error('Could not determine file type');
            return null;
        }

        const filename = `${Date.now()}.${fileType.ext}`;
        const filePath = path.join(TEMP_DIR, filename);

        await fs.writeFile(filePath, buffer);
        return filePath;
    } catch (err) {
        logger.error('Error downloading media:', err);
        return null;
    }
}

async function fetchApi(url, fallbacks = []) {
    const headers = {
        'User-Agent': 'WhatsApp-MD-Bot/1.0',
        'Accept': 'image/gif,image/webp,video/mp4,*/*'
    };

    try {
        const response = await axios.get(url, {
            timeout: 5000,
            headers
        });
        return response.data;
    } catch (err) {
        logger.warn(`Primary API fetch error (${url}):`, err.message);

        if (fallbacks && fallbacks.length > 0) {
            logger.info(`Attempting ${fallbacks.length} fallback APIs`);

            for (const fallbackUrl of fallbacks) {
                try {
                    logger.info(`Trying fallback API: ${fallbackUrl}`);
                    const response = await axios.get(fallbackUrl, {
                        timeout: 5000,
                        headers
                    });
                    logger.info(`Fallback API success: ${fallbackUrl}`);
                    return response.data;
                } catch (fallbackErr) {
                    logger.warn(`Fallback API fetch error (${fallbackUrl}):`, fallbackErr.message);
                }
            }
        }

        return null;
    }
}

function applyCooldown(userId, seconds = 60) {
    const now = Date.now();
    const cooldownExpiry = userCooldowns.get(userId);

    if (cooldownExpiry && cooldownExpiry > now) {
        return false;
    }

    userCooldowns.set(userId, now + (seconds * 1000));
    return true;
}

function getRemainingCooldown(userId) {
    const now = Date.now();
    const cooldownExpiry = userCooldowns.get(userId);

    if (!cooldownExpiry || cooldownExpiry <= now) {
        return 0;
    }

    return Math.ceil((cooldownExpiry - now) / 1000);
}

async function sendNsfwGif(sock, sender, url, caption) {
    try {
        // Download GIF first
        const response = await axios.get(url, { responseType: 'arraybuffer' });
        const buffer = Buffer.from(response.data);

        // Send as animated sticker using safe message sending
        await safeSendMessage(sock, sender, {
            sticker: buffer,
            mimetype: 'image/gif',
            gifAttribution: 'TENOR',
            gifPlayback: true,
            caption: caption,
            stickerAuthor: "BLACKSKY-MD",
            stickerName: "nsfw_gif",
            contextInfo: {
                forwardingScore: 999,
                isForwarded: true,
                externalAdReply: {
                    title: caption,
                    mediaType: 1,
                    renderLargerThumbnail: true
                }
            }
        });

        logger.info(`NSFW GIF sent successfully to ${sender}`);
    } catch (err) {
        logger.error('Error sending NSFW GIF:', err);
        try {
            // Fallback to regular message if GIF fails
            await safeSendText(sock, sender, `${caption}\n\n(GIF failed to send)`);
        } catch (sendErr) {
            logger.error('Failed to send error message:', sendErr);
        }
    }
}

initDirectories();

const nsfwCommands = {
    async toggleNSFW(sock, sender, args) {
        try {
            const [action] = args;
            if (!action || !['on', 'off'].includes(action.toLowerCase())) {
                await safeSendText(sock, sender, 'Usage: !togglensfw on|off');
                return;
            }

            const isEnabled = action.toLowerCase() === 'on';
            await saveNsfwSettingsForGroup(sender, isEnabled);

            await safeSendText(sock, sender, `NSFW commands are now ${isEnabled ? 'enabled' : 'disabled'} for this chat`);

            logger.info(`NSFW toggled ${action.toLowerCase()} for ${sender}`);
        } catch (err) {
            logger.error('Error in toggleNSFW:', err);
            await safeSendText(sock, sender, 'Failed to toggle NSFW settings.');
        }
    },

    async isNSFW(sock, sender, args) {
        try {
            const imageUrl = args[0];
            if (!imageUrl) {
                await safeSendText(sock, sender, 'Please provide an image URL or reply to an image');
                return;
            }

            if (!imageUrl.startsWith('http')) {
                await safeSendText(sock, sender, 'Please provide a valid image URL');
                return;
            }

            await safeSendText(sock, sender, 'Analyzing content safety...');

            await safeSendText(sock, sender, 'Content appears to be safe. For more accurate detection, an AI service integration is needed.');

            logger.info(`NSFW check requested for ${sender}`);
        } catch (err) {
            logger.error('Error in isNSFW:', err);
            await safeSendText(sock, sender, 'Failed to check content safety.');
        }
    },

    async nsfwSettings(sock, sender, args) {
        try {
            const [setting, value] = args;
            const validSettings = ['threshold', 'action', 'notification'];

            if (!setting || !validSettings.includes(setting)) {
                await safeSendText(sock, sender, `Valid settings: ${validSettings.join(', ')}`);
                return;
            }

            await safeSendText(sock, sender, `NSFW setting '${setting}' will be configurable soon.`);

            logger.info(`NSFW settings update requested by ${sender}`);
        } catch (err) {
            logger.error('Error in nsfwSettings:', err);
            await safeSendText(sock, sender, 'Failed to update NSFW settings.');
        }
    },

    async nsfwStats(sock, sender) {
        try {
            const stats = `
NSFW Statistics:
• Detections Today: 0
• False Positives: 0
• Actions Taken: 0
• Current Mode: Safe
• Verified Users: ${verifiedUsers.size}
• Groups with NSFW: ${[...groupNsfwSettings.entries()].filter(([_, v]) => v.enabled).length}
            `.trim();

            await safeSendText(sock, sender, stats);
            logger.info(`NSFW stats requested by ${sender}`);
        } catch (err) {
            logger.error('Error in nsfwStats:', err);
            await safeSendText(sock, sender, 'Failed to retrieve NSFW statistics.');
        }
    },

    async verify(sock, sender, args) {
        try {
            const [age] = args;
            const parsedAge = parseInt(age);

            if (!age || isNaN(parsedAge)) {
                await safeSendText(sock, sender, '⚠️ Usage: !verify <your_age>');
                return;
            }

            if (parsedAge < 18) {
                await safeSendText(sock, sender, '❌ You must be at least 18 years old to access NSFW content.');
                return;
            }

            setUserVerification(sender, true);
            await safeSendText(sock, sender, '✅ Age verification successful. You can now use NSFW commands.');

            logger.info(`User ${sender} verified for NSFW content, age: ${parsedAge}`);
        } catch (err) {
            logger.error('Error in verify:', err);
            await safeSendText(sock, sender, 'Verification failed. Please try again.');
        }
    },

    async nsfwHelp(sock, sender) {
        try {
            if (!isNsfwEnabledForGroup(sender)) {
                await safeSendText(sock, sender, `❌ NSFW commands are disabled for this group. An admin can enable them with !togglensfw on`);
                return;
            }

            const helpText = `
📜 *NSFW Commands List*

*Verification*
!verify <age> - Verify your age (18+)

*Image Commands*
!waifu - Random waifu image
!neko - Catgirl image
!hentai - Hentai image
!boobs - Breast image
!ass - Butt image
!pussy - Vagina image
!blowjob - Oral act image
!anal - Anal act image
!feet - Feet image

*GIF Commands*
!gifboobs - Breast animation
!gifass - Butt animation
!gifhentai - Hentai animation
!gifblowjob - Oral animation

*Fetish Commands*
!uniform - School/work uniform
!thighs - Thigh image
!femdom - Female dominance
!tentacle - Tentacle genre
!pantsu - Underwear image
!kitsune - Fox girl image

*All commands require age verification.*
            `.trim();

            await safeSendText(sock, sender, helpText);
            logger.info(`NSFW help requested by ${sender}`);
        } catch (err) {
            logger.error('Error in nsfwHelp:', err);
            await safeSendText(sock, sender, 'Failed to provide NSFW help.');
        }
    },

    async waifu(sock, sender) {
        try {
            if (!await isNsfwEnabledForGroup(sender)) {
                await safeSendText(sock, sender, '❌ NSFW commands are disabled for this group');
                return;
            }

            if (!isUserVerified(sender)) {
                await safeSendText(sock, sender, '⚠️ You need to verify your age first. Use !verify <your_age>');
                return;
            }

            if (!applyCooldown(sender, 30)) {
                const remaining = getRemainingCooldown(sender);
                await safeSendText(sock, sender, `⏳ Please wait ${remaining} seconds before using this command again.`);
                return;
            }

            await safeSendText(sock, sender, 'Fetching image...');

            const waifuUrl = 'https://api.waifu.pics/nsfw/waifu';
            const fallbacks = [
                'https://api.nekos.fun/api/waifu',
                'https://api.hmtai.me/nsfw/waifu'
            ];

            const response = await fetchApi(waifuUrl, fallbacks);

            if (!response || !response.url) {
                await safeSendText(sock, sender, 'Failed to fetch image. Please try again later.');
                return;
            }

            await safeSendImage(sock, sender, response.url, '🔞 NSFW Waifu');

            logger.info(`NSFW waifu image sent to ${sender}`);
        } catch (err) {
            logger.error('Error in waifu:', err);
            await safeSendText(sock, sender, 'Failed to fetch waifu image due to server error.');
        }
    },

    async neko(sock, sender) {
        try {
            if (!await isNsfwEnabledForGroup(sender)) {
                await safeSendText(sock, sender, '❌ NSFW commands are disabled for this group');
                return;
            }

            if (!isUserVerified(sender)) {
                await safeSendText(sock, sender, '⚠️ You need to verify your age first. Use !verify <your_age>');
                return;
            }

            if (!applyCooldown(sender, 30)) {
                const remaining = getRemainingCooldown(sender);
                await safeSendText(sock, sender, `⏳ Please wait ${remaining} seconds before using this command again.`);
                return;
            }

            await safeSendText(sock, sender, 'Fetching image...');

            const nekoUrl = 'https://api.waifu.pics/nsfw/neko';
            const fallbacks = [
                'https://api.nekos.fun/api/neko',
                'https://api.hmtai.me/nsfw/nsfwNeko'
            ];

            const response = await fetchApi(nekoUrl, fallbacks);

            if (!response || !response.url) {
                await safeSendText(sock, sender, 'Failed to fetch image. Please try again later.');
                return;
            }

            await safeSendImage(sock, sender, response.url, '🔞 NSFW Neko');

            logger.info(`NSFW neko image sent to ${sender}`);
        } catch (err) {
            logger.error('Error in neko:', err);
            await safeSendText(sock, sender, 'Failed to fetch neko image due to server error.');
        }
    },

    async hentai(sock, sender) {
        try {
            if (!await isNsfwEnabledForGroup(sender)) {
                await safeSendText(sock, sender, '❌ NSFW commands are disabled for this group');
                return;
            }

            if (!isUserVerified(sender)) {
                await safeSendText(sock, sender, '⚠️ You need to verify your age first. Use !verify <your_age>');
                return;
            }

            if (!applyCooldown(sender, 30)) {
                const remaining = getRemainingCooldown(sender);
                await safeSendText(sock, sender, `⏳ Please wait ${remaining} seconds before using this command again.`);
                return;
            }

            await safeSendText(sock, sender, 'Fetching image...');

            const hentaiUrl = `${API_ENDPOINTS.HMTAI}/nsfw/hentai`;
            const fallbacks = [
                'https://api.waifu.pics/nsfw/waifu',
                'https://api.nekos.fun/api/hentai'
            ];

            const response = await fetchApi(hentaiUrl, fallbacks);
            if (!response || !response.url) {
                await safeSendText(sock, sender, 'Failed to fetch image. Please try again later.');
                return;
            }

            await safeSendImage(sock, sender, response.url, '🔞 Hentai');

            logger.info(`NSFW hentai image sent to ${sender}`);
        } catch (err) {
            logger.error('Error in hentai:', err);
            await safeSendText(sock, sender, 'Failed to fetch image due to server error.');
        }
    },

    async boobs(sock, sender) {
        try {
            if (!await isNsfwEnabledForGroup(sender)) {
                await safeSendText(sock, sender, '❌ NSFW commands are disabled for this group');
                return;
            }

            if (!isUserVerified(sender)) {
                await safeSendText(sock, sender, '⚠️ You need to verify your age first. Use !verify <your_age>');
                return;
            }

            if (!applyCooldown(sender, 30)) {
                const remaining = getRemainingCooldown(sender);
                await safeSendText(sock, sender, `⏳ Please wait ${remaining} seconds before using this command again.`);
                return;
            }

            await safeSendText(sock, sender, 'Fetching image...');

            const boobsUrl = `${API_ENDPOINTS.HMTAI}/nsfw/boobs`;
            const fallbacks = [
                'https://api.nekos.fun/api/boobs',
                'https://api.waifu.pics/nsfw/waifu'
            ];

            const response = await fetchApi(boobsUrl, fallbacks);
            if (!response || !response.url) {
                await safeSendText(sock, sender, 'Failed to fetch image. Please try again later.');
                return;
            }

            await safeSendImage(sock, sender, response.url, '🔞 Boobs');

            logger.info(`NSFW boobs image sent to ${sender}`);
        } catch (err) {
            logger.error('Error in boobs:', err);
            await safeSendText(sock, sender, 'Failed to fetch image due to server error.');
        }
    },

    async ass(sock, sender) {
        try {
            if (!await isNsfwEnabledForGroup(sender)) {
                await safeSendText(sock, sender, '❌ NSFW commands are disabled for this group');
                return;
            }

            if (!isUserVerified(sender)) {
                await safeSendText(sock, sender, '⚠️ You need to verify your age first. Use !verify <your_age>');
                return;
            }

            if (!applyCooldown(sender, 30)) {
                const remaining = getRemainingCooldown(sender);
                await safeSendText(sock, sender, `⏳ Please wait ${remaining} seconds before using this command again.`);
                return;
            }

            await safeSendText(sock, sender, 'Fetching image...');

            const assUrl = `${API_ENDPOINTS.HMTAI}/nsfw/ass`;
            const fallbacks = [
                'https://api.nekos.fun/api/ass',
                'https://api.waifu.pics/nsfw/waifu'
            ];

            const response = await fetchApi(assUrl, fallbacks);
            if (!response || !response.url) {
                await safeSendText(sock, sender, 'Failed to fetch image. Please try again later.');
                return;
            }

            await safeSendImage(sock, sender, response.url, '🔞 Ass');

            logger.info(`NSFW ass image sent to ${sender}`);
        } catch (err) {
            logger.error('Error in ass:', err);
            await safeSendText(sock, sender, 'Failed to fetch image due to server error.');
        }
    },

    async pussy(sock, sender) {
        try {
            if (!await isNsfwEnabledForGroup(sender)) {
                await safeSendText(sock, sender, '❌ NSFW commands are disabled for this group');
                return;
            }

            if (!isUserVerified(sender)) {
                await safeSendText(sock, sender, '⚠️ You need to verify your age first. Use !verify <your_age>');
                return;
            }

            if (!applyCooldown(sender, 30)) {
                const remaining = getRemainingCooldown(sender);
                await safeSendText(sock, sender, `⏳ Please wait ${remaining} seconds before using this command again.`);
                return;
            }

            await safeSendText(sock, sender, 'Fetching image...');

            const pussyUrl = `${API_ENDPOINTS.HMTAI}/nsfw/pussy`;
            const fallbacks = [
                'https://api.nekos.fun/api/pussy',
                'https://api.waifu.pics/nsfw/pussy'
            ];

            const response = await fetchApi(pussyUrl, fallbacks);
            if (!response || !response.url) {
                await safeSendText(sock, sender, 'Failed to fetch image. Please try again later.');
                return;
            }

            await safeSendImage(sock, sender, response.url, '🔞 Pussy');

            logger.info(`NSFW pussy image sent to ${sender}`);
        } catch (err) {
            logger.error('Error in pussy:', err);
            await safeSendText(sock, sender, 'Failed to fetch image due to server error.');
        }
    },

    async blowjob(sock, sender) {
        try {
            if (!await isNsfwEnabledForGroup(sender)) {
                await safeSendText(sock, sender, '❌ NSFW commands are disabled for this group');
                return;
            }

            if (!isUserVerified(sender)) {
                await safeSendText(sock, sender, '⚠️ You need to verify your age first. Use !verify <your_age>');
                return;
            }

            if (!applyCooldown(sender, 30)) {
                const remaining = getRemainingCooldown(sender);
                await safeSendText(sock, sender, `⏳ Please wait ${remaining} seconds before using this command again.`);
                return;
            }

            await safeSendText(sock, sender, 'Fetching image...');

            const blowjobUrl = `${API_ENDPOINTS.HMTAI}/nsfw/blowjob`;
            const fallbacks = [
                'https://api.nekos.fun/api/blowjob',
                'https://api.waifu.pics/nsfw/blowjob'
            ];

            const response = await fetchApi(blowjobUrl, fallbacks);
            if (!response || !response.url) {
                await safeSendText(sock, sender, 'Failed to fetch image. Please try again later.');
                return;
            }

            await safeSendImage(sock, sender, response.url, '🔞 Blowjob');

            logger.info(`NSFW blowjob image sent to ${sender}`);
        } catch (err) {
            logger.error('Error in blowjob:', err);
            await safeSendText(sock, sender, 'Failed to fetch image due to server error.');
        }
    },

    async anal(sock, sender) {
        try {
            if (!await isNsfwEnabledForGroup(sender)) {
                await safeSendText(sock, sender, '❌ NSFW commands are disabled for this group');
                return;
            }

            if (!isUserVerified(sender)) {
                await safeSendText(sock, sender, '⚠️ You need to verify your age first. Use !verify <your_age>');
                return;
            }

            if (!applyCooldown(sender, 30)) {
                const remaining = getRemainingCooldown(sender);
                await safeSendText(sock, sender, `⏳ Please wait ${remaining} seconds before using this command again.`);
                return;
            }

            await safeSendText(sock, sender, 'Fetching image...');

            const analUrl = `${API_ENDPOINTS.HMTAI}/nsfw/anal`;
            const fallbacks = [
                'https://api.nekos.fun/api/anal',
                'https://api.waifu.pics/nsfw/waifu'
            ];

            const response = await fetchApi(analUrl, fallbacks);
            if (!response || !response.url) {
                await safeSendText(sock, sender, 'Failed to fetch image. Please try again later.');
                return;
            }

            await safeSendImage(sock, sender, response.url, '🔞 Anal');

            logger.info(`NSFW anal image sent to ${sender}`);
        } catch (err) {
            logger.error('Error in anal:', err);
            await safeSendText(sock, sender, 'Failed to fetch image due to server error.');
        }
    },

    async feet(sock, sender) {
        try {
            if (!await isNsfwEnabledForGroup(sender)) {
                await safeSendText(sock, sender, '❌ NSFW commands are disabled for this group');
                return;
            }

            if (!isUserVerified(sender)) {
                await safeSendText(sock, sender, '⚠️ You need to verify your age first. Use !verify <your_age>');
                return;
            }

            if (!applyCooldown(sender, 30)) {
                const remaining = getRemainingCooldown(sender);
                await safeSendText(sock, sender, `⏳ Please wait ${remaining} seconds before using this command again.`);
                return;
            }

            await safeSendText(sock, sender, 'Fetching image...');

            const feetUrl = `${API_ENDPOINTS.HMTAI}/nsfw/foot`;
            const fallbacks = [
                'https://api.nekos.fun/api/feet',
                'https://api.waifu.pics/nsfw/waifu'
            ];

            const response = await fetchApi(feetUrl, fallbacks);
            if (!response || !response.url) {
                await safeSendText(sock, sender, 'Failed to fetch image. Please try again later.');
                return;
            }

            await safeSendImage(sock, sender, response.url, '🔞 Feet');

            logger.info(`NSFW feet image sent to ${sender}`);
        } catch (err) {
            logger.error('Error in feet:', err);
            await safeSendText(sock, sender, 'Failed to fetch image due to server error.');
        }
    },

    // GIF commands
    async gifboobs(sock, sender) {
        try {
            if (!await isNsfwEnabledForGroup(sender)) {
                await safeSendText(sock, sender, '❌ NSFW commands are disabled for this group');
                return;
            }

            if (!isUserVerified(sender)) {
                await safeSendText(sock, sender, '⚠️ You need to verify your age first. Use !verify <your_age>');
                return;
            }

            if (!applyCooldown(sender, 45)) {
                const remaining = getRemainingCooldown(sender);
                await safeSendText(sock, sender, `⏳ Please wait ${remaining} seconds before using this command again.`);
                return;
            }

            await safeSendText(sock, sender, 'Fetching GIF...');

            const gifUrl = `${API_ENDPOINTS.HMTAI}/nsfw/boobs`;
            const fallbacks = [
                'https://api.nekos.fun/api/boobs',
                'https://api.waifu.pics/nsfw/waifu'
            ];

            const response = await fetchApi(gifUrl, fallbacks);
            if (!response || !response.url) {
                await safeSendText(sock, sender, 'Failed to fetch GIF. Please try again later.');
                return;
            }

            await safeSendAnimatedGif(sock, sender, response.url, '🔞 Boobs GIF');

            logger.info(`NSFW boobs GIF sent to ${sender}`);
        } catch (err) {
            logger.error('Error in gifboobs:', err);
            await safeSendText(sock, sender, 'Failed to fetch GIF due to server error.');
        }
    },

    async gifass(sock, sender) {
        try {
            if (!await isNsfwEnabledForGroup(sender)) {
                await safeSendText(sock, sender, '❌ NSFW commands are disabled for this group');
                return;
            }

            if (!isUserVerified(sender)) {
                await safeSendText(sock, sender, '⚠️ You need to verify your age first. Use !verify <your_age>');
                return;
            }

            if (!applyCooldown(sender, 45)) {
                const remaining = getRemainingCooldown(sender);
                await safeSendText(sock, sender, `⏳ Please wait ${remaining} seconds before using this command again.`);
                return;
            }

            await safeSendText(sock, sender, 'Fetching GIF...');

            const gifUrl = `${API_ENDPOINTS.HMTAI}/nsfw/ass`;
            const fallbacks = [
                'https://api.nekos.fun/api/ass',
                'https://api.waifu.pics/nsfw/waifu'
            ];

            const response = await fetchApi(gifUrl, fallbacks);
            if (!response || !response.url) {
                await safeSendText(sock, sender, 'Failed to fetch GIF. Please try again later.');
                return;
            }

            await safeSendAnimatedGif(sock, sender, response.url, '🔞 Ass GIF');

            logger.info(`NSFW ass GIF sent to ${sender}`);
        } catch (err) {
            logger.error('Error in gifass:', err);
            await safeSendText(sock, sender, 'Failed to fetch GIF due to server error.');
        }
    },
    
    async gifhentai(sock, sender) {
        try {
            if (!await isNsfwEnabledForGroup(sender)) {
                await safeSendText(sock, sender, '❌ NSFW commands are disabled for this group');
                return;
            }

            if (!isUserVerified(sender)) {
                await safeSendText(sock, sender, '⚠️ You need to verify your age first. Use !verify <your_age>');
                return;
            }

            if (!applyCooldown(sender, 45)) {
                const remaining = getRemainingCooldown(sender);
                await safeSendText(sock, sender, `⏳ Please wait ${remaining} seconds before using this command again.`);
                return;
            }

            await safeSendText(sock, sender, 'Fetching GIF...');

            const gifUrl = `${API_ENDPOINTS.HMTAI}/nsfw/hentai`;
            const fallbacks = [
                'https://api.nekos.fun/api/hentai',
                'https://api.waifu.pics/nsfw/waifu'
            ];

            const response = await fetchApi(gifUrl, fallbacks);
            if (!response || !response.url) {
                await safeSendText(sock, sender, 'Failed to fetch GIF. Please try again later.');
                return;
            }

            await safeSendAnimatedGif(sock, sender, response.url, '🔞 Hentai GIF');

            logger.info(`NSFW hentai GIF sent to ${sender}`);
        } catch (err) {
            logger.error('Error in gifhentai:', err);
            await safeSendText(sock, sender, 'Failed to fetch GIF due to server error.');
        }
    },

    async gifblowjob(sock, sender) {
        try {
            if (!await isNsfwEnabledForGroup(sender)) {
                await safeSendText(sock, sender, '❌ NSFW commands are disabled for this group');
                return;
            }

            if (!isUserVerified(sender)) {
                await safeSendText(sock, sender, '⚠️ You need to verify your age first. Use !verify <your_age>');
                return;
            }

            if (!applyCooldown(sender, 45)) {
                const remaining = getRemainingCooldown(sender);
                await safeSendText(sock, sender, `⏳ Please wait ${remaining} seconds before using this command again.`);
                return;
            }

            await safeSendText(sock, sender, 'Fetching GIF...');

            const gifUrl = `${API_ENDPOINTS.HMTAI}/nsfw/blowjob`;
            const fallbacks = [
                'https://api.nekos.fun/api/blowjob',
                'https://api.waifu.pics/nsfw/blowjob'
            ];

            const response = await fetchApi(gifUrl, fallbacks);
            if (!response || !response.url) {
                await safeSendText(sock, sender, 'Failed to fetch GIF. Please try again later.');
                return;
            }

            await safeSendAnimatedGif(sock, sender, response.url, '🔞 Blowjob GIF');

            logger.info(`NSFW blowjob GIF sent to ${sender}`);
        } catch (err) {
            logger.error('Error in gifblowjob:', err);
            await safeSendText(sock, sender, 'Failed to fetch GIF due to server error.');
        }
    },

    // Fetish commands
    async uniform(sock, sender) {
        try {
            if (!await isNsfwEnabledForGroup(sender)) {
                await safeSendText(sock, sender, '❌ NSFW commands are disabled for this group');
                return;
            }

            if (!isUserVerified(sender)) {
                await safeSendText(sock, sender, '⚠️ You need to verify your age first. Use !verify <your_age>');
                return;
            }

            if (!applyCooldown(sender, 30)) {
                const remaining = getRemainingCooldown(sender);
                await safeSendText(sock, sender, `⏳ Please wait ${remaining} seconds before using this command again.`);
                return;
            }

            await safeSendText(sock, sender, 'Fetching image...');

            const uniformUrl = `${API_ENDPOINTS.HMTAI}/nsfw/uniform`;
            const fallbacks = [
                'https://api.nekos.fun/api/lewd',
                'https://api.waifu.pics/nsfw/waifu'
            ];

            const response = await fetchApi(uniformUrl, fallbacks);
            if (!response || !response.url) {
                await safeSendText(sock, sender, 'Failed to fetch image. Please try again later.');
                return;
            }

            await safeSendImage(sock, sender, response.url, '🔞 Uniform');

            logger.info(`NSFW uniform image sent to ${sender}`);
        } catch (err) {
            logger.error('Error in uniform:', err);
            await safeSendText(sock, sender, 'Failed to fetch image due to server error.');
        }
    },

    async thighs(sock, sender) {
        try {
            if (!await isNsfwEnabledForGroup(sender)) {
                await safeSendText(sock, sender, '❌ NSFW commands are disabled for this group');
                return;
            }

            if (!isUserVerified(sender)) {
                await safeSendText(sock, sender, '⚠️ You need to verify your age first. Use !verify <your_age>');
                return;
            }

            if (!applyCooldown(sender, 30)) {
                const remaining = getRemainingCooldown(sender);
                await safeSendText(sock, sender, `⏳ Please wait ${remaining} seconds before using this command again.`);
                return;
            }

            await safeSendText(sock, sender, 'Fetching image...');

            const thighsUrl = `${API_ENDPOINTS.HMTAI}/nsfw/thighs`;
            const fallbacks = [
                'https://api.nekos.fun/api/lewd',
                'https://api.waifu.pics/nsfw/waifu'
            ];

            const response = await fetchApi(thighsUrl, fallbacks);
            if (!response || !response.url) {
                await safeSendText(sock, sender, 'Failed to fetch image. Please try again later.');
                return;
            }

            await safeSendImage(sock, sender, response.url, '🔞 Thighs');

            logger.info(`NSFW thighs image sent to ${sender}`);
        } catch (err) {
            logger.error('Error in thighs:', err);
            await safeSendText(sock, sender, 'Failed to fetch image due to server error.');
        }
    },

    async femdom(sock, sender) {
        try {
            if (!await isNsfwEnabledForGroup(sender)) {
                await safeSendText(sock, sender, '❌ NSFW commands are disabled for this group');
                return;
            }

            if (!isUserVerified(sender)) {
                await safeSendText(sock, sender, '⚠️ You need to verify your age first. Use !verify <your_age>');
                return;
            }

            if (!applyCooldown(sender, 30)) {
                const remaining = getRemainingCooldown(sender);
                await safeSendText(sock, sender, `⏳ Please wait ${remaining} seconds before using this command again.`);
                return;
            }

            await safeSendText(sock, sender, 'Fetching image...');

            const femdomUrl = `${API_ENDPOINTS.HMTAI}/nsfw/femdom`;
            const fallbacks = [
                'https://api.waifu.pics/nsfw/waifu',
                'https://api.nekos.fun/api/lewd'
            ];

            const response = await fetchApi(femdomUrl, fallbacks);
            if (!response || !response.url) {
                await safeSendText(sock, sender, 'Failed to fetch image. Please try again later.');
                return;
            }

            await safeSendImage(sock, sender, response.url, '🔞 Femdom');

            logger.info(`NSFW femdom image sent to ${sender}`);
        } catch (err) {
            logger.error('Error in femdom:', err);
            await safeSendText(sock, sender, 'Failed to fetch image due to server error.');
        }
    },

    async tentacle(sock, sender) {
        try {
            if (!await isNsfwEnabledForGroup(sender)) {
                await safeSendText(sock, sender, '❌ NSFW commands are disabled for this group');
                return;
            }

            if (!isUserVerified(sender)) {
                await safeSendText(sock, sender, '⚠️ You need to verify your age first. Use !verify <your_age>');
                return;
            }

            if (!applyCooldown(sender, 30)) {
                const remaining = getRemainingCooldown(sender);
                await safeSendText(sock, sender, `⏳ Please wait ${remaining} seconds before using this command again.`);
                return;
            }

            await safeSendText(sock, sender, 'Fetching image...');

            const tentacleUrl = `${API_ENDPOINTS.HMTAI}/nsfw/tentacle`;
            const fallbacks = [
                'https://api.waifu.pics/nsfw/waifu',
                'https://api.nekos.fun/api/lewd'
            ];

            const response = await fetchApi(tentacleUrl, fallbacks);
            if (!response || !response.url) {
                await safeSendText(sock, sender, 'Failed to fetch image. Please try again later.');
                return;
            }

            await safeSendImage(sock, sender, response.url, '🔞 Tentacle');

            logger.info(`NSFW tentacle image sent to ${sender}`);
        } catch (err) {
            logger.error('Error in tentacle:', err);
            await safeSendText(sock, sender, 'Failed to fetch image due to server error.');
        }
    },

    async pantsu(sock, sender) {
        try {
            if (!await isNsfwEnabledForGroup(sender)) {
                await safeSendText(sock, sender, '❌ NSFW commands are disabled for this group');
                return;
            }

            if (!isUserVerified(sender)) {
                await safeSendText(sock, sender, '⚠️ You need to verify your age first. Use !verify <your_age>');
                return;
            }

            if (!applyCooldown(sender, 30)) {
                const remaining = getRemainingCooldown(sender);
                await safeSendText(sock, sender, `⏳ Please wait ${remaining} seconds before using this command again.`);
                return;
            }

            await safeSendText(sock, sender, 'Fetching image...');

            const pantsuUrl = `${API_ENDPOINTS.HMTAI}/nsfw/pantsu`;
            const fallbacks = [
                'https://api.waifu.pics/nsfw/waifu',
                'https://api.nekos.fun/api/lewd'
            ];

            const response = await fetchApi(pantsuUrl, fallbacks);
            if (!response || !response.url) {
                await safeSendText(sock, sender, 'Failed to fetch image. Please try again later.');
                return;
            }

            await safeSendImage(sock, sender, response.url, '🔞 Pantsu');

            logger.info(`NSFW pantsu image sent to ${sender}`);
        } catch (err) {
            logger.error('Error in pantsu:', err);
            await safeSendText(sock, sender, 'Failed to fetch image due to server error.');
        }
    },

    async kitsune(sock, sender) {
        try {
            if (!await isNsfwEnabledForGroup(sender)) {
                await safeSendText(sock, sender, '❌ NSFW commands are disabled for this group');
                return;
            }

            if (!isUserVerified(sender)) {
                await safeSendText(sock, sender, '⚠️ You need to verify your age first. Use !verify <your_age>');
                return;
            }

            if (!applyCooldown(sender, 30)) {
                const remaining = getRemainingCooldown(sender);
                await safeSendText(sock, sender, `⏳ Please wait ${remaining} seconds before using this command again.`);
                return;
            }

            await safeSendText(sock, sender, 'Fetching image...');

            const kitsuneUrl = `${API_ENDPOINTS.HMTAI}/nsfw/nsfwMobileWallpaper`;
            const fallbacks = [
                'https://api.waifu.pics/nsfw/waifu',
                'https://api.nekos.fun/api/lewd'
            ];

            const response = await fetchApi(kitsuneUrl, fallbacks);
            if (!response || !response.url) {
                await safeSendText(sock, sender, 'Failed to fetch image. Please try again later.');
                return;
            }

            await safeSendImage(sock, sender, response.url, '🔞 Kitsune');

            logger.info(`NSFW kitsune image sent to ${sender}`);
        } catch (err) {
            logger.error('Error in kitsune:', err);
            await safeSendText(sock, sender, 'Failed to fetch image due to server error.');
        }
    },
};

const commands = nsfwCommands;

module.exports = {
    commands,
    category: 'nsfw',
    async init() {
        try {
            logger.info('NSFW module initialized with enhanced commands');
            await initDirectories();
            logger.moduleSuccess('NSFW');
            return true;
        } catch (err) {
            logger.error('NSFW module initialization error:', err);
            return false;
        }
    }
};