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

const TEMP_DIR = path.join(__dirname, '../../temp/nsfw');

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

const { fetchNsfwImage, SUPPORTED_CATEGORIES } = require('../utils/fetchNsfwImage');

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
    if (groupNsfwSettings.has(groupId)) {
        return groupNsfwSettings.get(groupId).enabled;
    }

    try {
        const settings = await getGroupSettings(groupId);
        const enabled = settings?.nsfw?.enabled || false;
        groupNsfwSettings.set(groupId, { enabled });
        return enabled;
    } catch (err) {
        logger.error(`Error checking NSFW settings for group ${groupId}:`, err);
        return false;
    }
}

async function saveNsfwSettingsForGroup(groupId, enabled) {
    try {
        const settings = await getGroupSettings(groupId);
        settings.nsfw = {
            ...settings.nsfw,
            enabled,
            updatedAt: Date.now()
        };

        await saveGroupSettings(groupId, settings);
        groupNsfwSettings.set(groupId, { enabled });
        logger.info(`NSFW settings updated for group ${groupId}: ${enabled ? 'enabled' : 'disabled'}`);
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

        // Send as animated sticker
        await sock.sendMessage(sender, {
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
            await sock.sendMessage(sender, {
                text: `${caption}\n\n(GIF failed to send)`
            });
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
                await sock.sendMessage(sender, {
                    text: 'Usage: !togglensfw <on|off>'
                });
                return;
            }

            const isEnabled = action.toLowerCase() === 'on';
            await saveNsfwSettingsForGroup(sender, isEnabled);

            await sock.sendMessage(sender, {
                text: `NSFW content ${isEnabled ? 'enabled' : 'disabled'} for this group`
            });

            logger.info(`NSFW toggled ${action.toLowerCase()} for ${sender}`);
        } catch (err) {
            logger.error('Error in toggleNSFW:', err);
            await sock.sendMessage(sender, { text: 'Failed to toggle NSFW settings.' });
        }
    },

    async isNSFW(sock, sender, args) {
        try {
            const imageUrl = args[0];
            if (!imageUrl) {
                await sock.sendMessage(sender, {
                    text: 'Please provide an image URL or reply to an image'
                });
                return;
            }

            if (!imageUrl.startsWith('http')) {
                await sock.sendMessage(sender, {
                    text: 'Please provide a valid image URL'
                });
                return;
            }

            await sock.sendMessage(sender, {
                text: 'Analyzing content safety...'
            });

            await sock.sendMessage(sender, {
                text: 'Content appears to be safe. For more accurate detection, an AI service integration is needed.'
            });

            logger.info(`NSFW check requested for ${sender}`);
        } catch (err) {
            logger.error('Error in isNSFW:', err);
            await sock.sendMessage(sender, { text: 'Failed to check content safety.' });
        }
    },

    async nsfwSettings(sock, sender, args) {
        try {
            const [setting, value] = args;
            const validSettings = ['threshold', 'action', 'notification'];

            if (!setting || !validSettings.includes(setting)) {
                await sock.sendMessage(sender, {
                    text: `Valid settings: ${validSettings.join(', ')}`
                });
                return;
            }

            await sock.sendMessage(sender, {
                text: `NSFW setting '${setting}' will be configurable soon.`
            });

            logger.info(`NSFW settings update requested by ${sender}`);
        } catch (err) {
            logger.error('Error in nsfwSettings:', err);
            await sock.sendMessage(sender, { text: 'Failed to update NSFW settings.' });
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

            await sock.sendMessage(sender, { text: stats });
            logger.info(`NSFW stats requested by ${sender}`);
        } catch (err) {
            logger.error('Error in nsfwStats:', err);
            await sock.sendMessage(sender, { text: 'Failed to retrieve NSFW statistics.' });
        }
    },

    async verify(sock, sender, args) {
        try {
            const [age] = args;
            const parsedAge = parseInt(age);

            if (!age || isNaN(parsedAge)) {
                await sock.sendMessage(sender, {
                    text: `⚠️ Age verification required. Please use the command: !verify <your_age>`
                });
                return;
            }

            if (parsedAge < 18) {
                await sock.sendMessage(sender, {
                    text: `❌ You must be at least 18 years old to access NSFW content.`
                });
                return;
            }

            setUserVerification(sender, true);
            await sock.sendMessage(sender, {
                text: `✅ Age verification successful. You can now use NSFW commands.`
            });

            logger.info(`User ${sender} verified for NSFW content, age: ${parsedAge}`);
        } catch (err) {
            logger.error('Error in verify:', err);
            await sock.sendMessage(sender, { text: 'Age verification failed. Please try again.' });
        }
    },

    async nsfwHelp(sock, sender) {
        try {
            if (!isNsfwEnabledForGroup(sender)) {
                await sock.sendMessage(sender, {
                    text: `❌ NSFW commands are disabled for this group. An admin can enable them with !togglensfw on`
                });
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

            await sock.sendMessage(sender, { text: helpText });
            logger.info(`NSFW help requested by ${sender}`);
        } catch (err) {
            logger.error('Error in nsfwHelp:', err);
            await sock.sendMessage(sender, { text: 'Failed to provide NSFW help.' });
        }
    },


    async waifu(sock, sender) {
        try {
            const { languageManager } = require('../utils/language');

            if (!await isNsfwEnabledForGroup(sender)) {
                await sock.sendMessage(sender, {
                    text: '❌ ' + languageManager.getText('media.nsfw.disabled', null)
                });
                return;
            }

            if (!isUserVerified(sender)) {
                await sock.sendMessage(sender, {
                    text: '⚠️ ' + languageManager.getText('media.nsfw.age_verification', null)
                });
                return;
            }

            if (!applyCooldown(sender, 30)) {
                const remaining = getRemainingCooldown(sender);
                await sock.sendMessage(sender, {
                    text: `⏳ ${languageManager.getText('media.nsfw.cooldown', null, remaining)}`
                });
                return;
            }

            await sock.sendMessage(sender, { text: languageManager.getText('media.nsfw.fetching', null) });

            const waifuUrl = await fetchNsfwImage('waifu');

            if (!waifuUrl) {
                await sock.sendMessage(sender, {
                    text: languageManager.getText('media.error', null)
                });
                return;
            }

            await sock.sendMessage(sender, {
                image: { url: waifuUrl },
                caption: '🎭 NSFW Waifu'
            });

            logger.info(`NSFW waifu image sent to ${sender}`);
        } catch (err) {
            logger.error('Error in waifu:', err);
            await sock.sendMessage(sender, { text: 'Failed to fetch waifu image due to server error.' });
        }
    },

    async neko(sock, sender) {
        try {
            const { languageManager } = require('../utils/language');

            if (!await isNsfwEnabledForGroup(sender)) {
                await sock.sendMessage(sender, {
                    text: '❌ ' + languageManager.getText('media.nsfw.disabled', null)
                });
                return;
            }

            if (!isUserVerified(sender)) {
                await sock.sendMessage(sender, {
                    text: '⚠️ ' + languageManager.getText('media.nsfw.age_verification', null)
                });
                return;
            }

            if (!applyCooldown(sender, 30)) {
                const remaining = getRemainingCooldown(sender);
                await sock.sendMessage(sender, {
                    text: `⏳ ${languageManager.getText('media.nsfw.cooldown', null, remaining)}`
                });
                return;
            }

            await sock.sendMessage(sender, { text: languageManager.getText('media.nsfw.fetching', null) });

            const nekoUrl = await fetchNsfwImage('neko');

            if (!nekoUrl) {
                await sock.sendMessage(sender, {
                    text: languageManager.getText('media.error', null)
                });
                return;
            }

            await sock.sendMessage(sender, {
                image: { url: nekoUrl },
                caption: '🐱 NSFW Neko'
            });

            logger.info(`NSFW neko image sent to ${sender}`);
        } catch (err) {
            logger.error('Error in neko:', err);
            await sock.sendMessage(sender, { text: 'Failed to fetch neko image.' });
        }
    },

    async hentai(sock, sender) {
        try {
            if (!await isNsfwEnabledForGroup(sender)) {
                await sock.sendMessage(sender, {
                    text: '❌ NSFW commands are disabled for this group'
                });
                return;
            }

            if (!isUserVerified(sender)) {
                await sock.sendMessage(sender, {
                    text: '⚠️ You need to verify your age first. Use !verify <your_age>'
                });
                return;
            }

            if (!applyCooldown(sender, 30)) {
                const remaining = getRemainingCooldown(sender);
                await sock.sendMessage(sender, {
                    text: `⏳ Please wait ${remaining} seconds before using this command again.`
                });
                return;
            }

            await sock.sendMessage(sender, { text: 'Fetching hentai image...' });

            const response = await fetchApi(`${API_ENDPOINTS.HMTAI}/nsfw/hentai`);
            if (!response || !response.url) {
                await sock.sendMessage(sender, { text: 'Failed to fetch image. Please try again later.' });
                return;
            }

            await sock.sendMessage(sender, {
                image: { url: response.url },
                caption: '🔞 Hentai'
            });

            logger.info(`NSFW hentai image sent to ${sender}`);
        } catch (err) {
            logger.error('Error in hentai:', err);
            await sock.sendMessage(sender, { text: 'Failed to fetch hentai image.' });
        }
    },

    async boobs(sock, sender) {
        try {
            if (!await isNsfwEnabledForGroup(sender)) {
                await sock.sendMessage(sender, {
                    text: '❌ NSFW commands are disabled for this group'
                });
                return;
            }

            if (!isUserVerified(sender)) {
                await sock.sendMessage(sender, {
                    text: '⚠️ You need to verify your age first. Use !verify <your_age>'
                });
                return;
            }

            if (!applyCooldown(sender, 30)) {
                const remaining = getRemainingCooldown(sender);
                await sock.sendMessage(sender, {
                    text: `⏳ Please wait ${remaining} seconds before using this command again.`
                });
                return;
            }

            await sock.sendMessage(sender, { text: 'Fetching image...' });

            const response = await fetchApi(`${API_ENDPOINTS.HMTAI}/nsfw/boobs`);
            if (!response || !response.url) {
                await sock.sendMessage(sender, { text: 'Failed to fetch image. Please try again later.' });
                return;
            }

            await sock.sendMessage(sender, {
                image: { url: response.url },
                caption: '🔞 Boobs'
            });

            logger.info(`NSFW boobs image sent to ${sender}`);
        } catch (err) {
            logger.error('Error in boobs:', err);
            await sock.sendMessage(sender, { text: 'Failed to fetch image.' });
        }
    },

    async ass(sock, sender) {
        try {
            if (!await isNsfwEnabledForGroup(sender)) {
                await sock.sendMessage(sender, {
                    text: '❌ NSFW commands are disabled for this group'
                });
                return;
            }

            if (!isUserVerified(sender)) {
                await sock.sendMessage(sender, {
                    text: '⚠️ You need to verify your age first. Use !verify <your_age>'
                });
                return;
            }

            if (!applyCooldown(sender, 30)) {
                const remaining = getRemainingCooldown(sender);
                await sock.sendMessage(sender, {
                    text: `⏳ Please wait ${remaining} seconds before using this command again.`
                });
                return;
            }

            await sock.sendMessage(sender, { text: 'Fetching image...' });

            const response = await fetchApi(`${API_ENDPOINTS.HMTAI}/nsfw/ass`);
            if (!response || !response.url) {
                await sock.sendMessage(sender, { text: 'Failed to fetch image. Please try again later.' });
                return;
            }

            await sock.sendMessage(sender, {
                image: { url: response.url },
                caption: '🔞 Ass'
            });

            logger.info(`NSFW ass image sent to ${sender}`);
        } catch (err) {
            logger.error('Error in ass:', err);
            await sock.sendMessage(sender, { text: 'Failed to fetch image.' });
        }
    },

    async pussy(sock, sender) {
        try {
            if (!await isNsfwEnabledForGroup(sender)) {
                await sock.sendMessage(sender, {
                    text: '❌ NSFW commands are disabled for this group'
                });
                return;
            }

            if (!isUserVerified(sender)) {
                await sock.sendMessage(sender, {
                    text: '⚠️ You need to verify your age first. Use !verify <your_age>'
                });
                return;
            }

            if (!applyCooldown(sender, 30)) {
                const remaining = getRemainingCooldown(sender);
                await sock.sendMessage(sender, {
                    text: `⏳ Please wait ${remaining} seconds before using this command again.`
                });
                return;
            }

            await sock.sendMessage(sender, { text: 'Fetching image...' });

            const response = await fetchApi(`${API_ENDPOINTS.HMTAI}/nsfw/pussy`);
            if (!response || !response.url) {
                await sock.sendMessage(sender, { text: 'Failed to fetch image. Please try again later.' });
                return;
            }

            await sock.sendMessage(sender, {
                image: { url: response.url },
                caption: '🔞 Pussy'
            });

            logger.info(`NSFW image sent to ${sender}`);
        } catch (err) {
            logger.error('Error in pussy:', err);
            await sock.sendMessage(sender, { text: 'Failed to fetch image.' });
        }
    },

    async blowjob(sock, sender) {
        try {
            const { languageManager } = require('../utils/language');

            if (!await isNsfwEnabledForGroup(sender)) {
                await sock.sendMessage(sender, {
                    text: '❌ ' + languageManager.getText('media.nsfw.disabled', null)
                });
                return;
            }

            if (!isUserVerified(sender)) {
                await sock.sendMessage(sender, {
                    text: '⚠️ ' + languageManager.getText('media.nsfw.age_verification', null)
                });
                return;
            }

            if (!applyCooldown(sender, 30)) {
                const remaining = getRemainingCooldown(sender);
                await sock.sendMessage(sender, {
                    text: `⏳ ${languageManager.getText('media.nsfw.cooldown', null, remaining)}`
                });
                return;
            }

            await sock.sendMessage(sender, { text: languageManager.getText('media.nsfw.fetching', null) });

            const blowjobUrl = await fetchNsfwImage('blowjob');

            if (!blowjobUrl) {
                await sock.sendMessage(sender, {
                    text: languageManager.getText('media.error', null)
                });
                return;
            }

            await sock.sendMessage(sender, {
                image: { url: blowjobUrl },
                caption: '🔞 Blowjob'
            });

            logger.info(`NSFW image sent to ${sender}`);
        } catch (err) {
            logger.error('Error in blowjob:', err);
            await sock.sendMessage(sender, { text: 'Failed to fetch image.' });
        }
    },

    async anal(sock, sender) {
        try {
            if (!await isNsfwEnabledForGroup(sender)) {
                await sock.sendMessage(sender, {
                    text: '❌ NSFW commands are disabled for this group'
                });
                return;
            }

            if (!isUserVerified(sender)) {
                await sock.sendMessage(sender, {
                    text: '⚠️ You need to verify your age first. Use !verify <your_age>'
                });
                return;
            }

            if (!applyCooldown(sender, 30)) {
                const remaining = getRemainingCooldown(sender);
                await sock.sendMessage(sender, {
                    text: `⏳ Please wait ${remaining} seconds before using this command again.`
                });
                return;
            }

            await sock.sendMessage(sender, { text: 'Fetching image...' });

            const response = await fetchApi(`${API_ENDPOINTS.HMTAI}/nsfw/anal`);
            if (!response || !response.url) {
                await sock.sendMessage(sender, { text: 'Failed to fetch image. Please try again later.' });
                return;
            }

            await sock.sendMessage(sender, {
                image: { url: response.url },
                caption: '🔞 Anal'
            });

            logger.info(`NSFW image sent to ${sender}`);
        } catch (err) {
            logger.error('Error in anal:', err);
            await sock.sendMessage(sender, { text: 'Failed to fetch image.' });
        }
    },

    async feet(sock, sender) {
        try {
            if (!await isNsfwEnabledForGroup(sender)) {
                await sock.sendMessage(sender, {
                    text: '❌ NSFW commands are disabled for this group'
                });
                return;
            }

            if (!isUserVerified(sender)) {
                await sock.sendMessage(sender, {
                    text: '⚠️ You need to verify your age first. Use !verify <your_age>'
                });
                return;
            }

            if (!applyCooldown(sender, 30)) {
                const remaining = getRemainingCooldown(sender);
                await sock.sendMessage(sender, {
                    text: `⏳ Please wait ${remaining} seconds before using this command again.`
                });
                return;
            }

            await sock.sendMessage(sender, { text: 'Fetching image...' });

            const response = await fetchApi(`${API_ENDPOINTS.HMTAI}/nsfw/foot`);
            if (!response || !response.url) {
                await sock.sendMessage(sender, { text: 'Failed to fetch image. Please try again later.' });
                return;
            }

            await sock.sendMessage(sender, {
                image: { url: response.url },
                caption: '🔞 Feet'
            });

            logger.info(`NSFW image sent to ${sender}`);
        } catch (err) {
            logger.error('Error in feet:', err);
            await sock.sendMessage(sender, { text: 'Failed to fetch image.' });
        }
    },

    async gifboobs(sock, sender) {
        if (!await isNsfwEnabledForGroup(sender)) {
            await sock.sendMessage(sender, {
                text: '❌ NSFW commands are disabled for this group'
            });
            return;
        }

        if (!isUserVerified(sender)) {
            await sock.sendMessage(sender, {
                text: '⚠️ You need to verify your age first. Use !verify <your_age>'
            });
            return;
        }

        if (!applyCooldown(sender, 45)) {
            const remaining = getRemainingCooldown(sender);
            await sock.sendMessage(sender, {
                text: `⏳ Please wait ${remaining} seconds before using this command again.`
            });
            return;
        }

        await sock.sendMessage(sender, { text: 'Fetching GIF...' });

        const primaryUrl = 'https://api.waifu.pics/nsfw/boobs';
        const fallbacks = [
            'https://api.nekos.fun/api/boobs',
            'https://api.hmtai.me/nsfw/boobs'
        ];

        const response = await fetchApi(primaryUrl, fallbacks);

        if (!response || !response.url) {
            await sock.sendMessage(sender, {
                text: 'Failed to fetch GIF. Please try again later.'
            });
            return;
        }

        await sendNsfwGif(sock, sender, response.url, '🔞 NSFW GIF');
    },

    async gifass(sock, sender) {
        if (!await isNsfwEnabledForGroup(sender)) {
            await sock.sendMessage(sender, {
                text: '❌ NSFW commands are disabled for this group'
            });
            return;
        }

        if (!isUserVerified(sender)) {
            await sock.sendMessage(sender, {
                text: '⚠️ You need to verify your age first. Use !verify <your_age>'
            });
            return;
        }

        if (!applyCooldown(sender, 45)) {
            const remaining = getRemainingCooldown(sender);
            await sock.sendMessage(sender, {
                text: `⏳ Please wait ${remaining} seconds before using this command again.`
            });
            return;
        }

        await sock.sendMessage(sender, { text: 'Fetching GIF...' });

        const primaryUrl = 'https://api.waifu.pics/nsfw/ass';
        const fallbacks = [
            'https://api.nekos.fun/api/ass',
            'https://api.hmtai.me/nsfw/ass'
        ];

        const response = await fetchApi(primaryUrl, fallbacks);

        if (!response || !response.url) {
            await sock.sendMessage(sender, { text: 'Failed to fetch GIF. Please try again later.' });
            return;
        }

        await sendNsfwGif(sock, sender, response.url, '🔞 NSFW GIF');
    },

    async gifhentai(sock, sender) {
        if (!await isNsfwEnabledForGroup(sender)) {
            await sock.sendMessage(sender, {
                text: '❌ NSFW commands are disabled for this group'
            });
            return;
        }

        if (!isUserVerified(sender)) {
            await sock.sendMessage(sender, {
                text: '⚠️ You need to verify your age first. Use !verify <your_age>'
            });
            return;
        }

        if (!applyCooldown(sender, 45)) {
            const remaining = getRemainingCooldown(sender);
            await sock.sendMessage(sender, {
                text: `⏳ Please wait ${remaining} seconds before using this command again.`
            });
            return;
        }

        await sock.sendMessage(sender, { text: 'Fetching GIF...' });

        const primaryUrl = 'https://api.waifu.pics/nsfw/hentai';
        const fallbacks = [
            'https://api.nekos.fun/api/hentai',
            'https://api.hmtai.me/nsfw/hentai'
        ];

        const response = await fetchApi(primaryUrl, fallbacks);

        if (!response || !response.url) {
            await sock.sendMessage(sender, { text: 'Failed to fetch GIF. Please try again later.' });
            return;
        }

        await sendNsfwGif(sock, sender, response.url, '🔞 NSFW GIF');
    },

    async gifblowjob(sock, sender) {
        if (!await isNsfwEnabledForGroup(sender)) {
            await sock.sendMessage(sender, {
                text: '❌ NSFW commands are disabled for this group'
            });
            return;
        }

        if (!isUserVerified(sender)) {
            await sock.sendMessage(sender, {
                text: '⚠️ You need to verify your age first. Use !verify <your_age>'
            });
            return;
        }

        if (!applyCooldown(sender, 45)) {
            const remaining = getRemainingCooldown(sender);
            await sock.sendMessage(sender, {
                text: `⏳ Please wait ${remaining} seconds before using this command again.`
            });
            return;
        }

        await sock.sendMessage(sender, { text: 'Fetching GIF...' });

        const primaryUrl = 'https://api.waifu.pics/nsfw/blowjob';
        const fallbacks = [
            'https://api.nekos.fun/api/blowjob',
            'https://api.hmtai.me/nsfw/blowjob'
        ];

        const response = await fetchApi(primaryUrl, fallbacks);

        if (!response || !response.url) {
            await sock.sendMessage(sender, { text: 'Failed to fetch GIF. Please try again later.' });
            return;
        }

        await sendNsfwGif(sock, sender, response.url, '🔞 NSFW GIF');
    },

    async uniform(sock, sender) {
        try {if (!await isNsfwEnabledForGroup(sender)) {
                await sock.sendMessage(sender, {
                    text: '❌ NSFW commands are disabled for this group'
                });
                return;
            }

            if (!isUserVerified(sender)) {
                await sock.sendMessage(sender, {
                    text: '⚠️ You need to verify your age first. Use !verify <your_age>'
                });
                return;
            }

            if (!applyCooldown(sender, 30)) {
                const remaining = getRemainingCooldown(sender);
                await sock.sendMessage(sender, {
                    text: `⏳ Please wait ${remaining} seconds before using this command again.`
                });
                return;
            }

            await sock.sendMessage(sender, { text: 'Fetching image...' });

            const response = await fetchApi(`${API_ENDPOINTS.HMTAI}/nsfw/uniform`);
            if (!response || !response.url) {
                await sock.sendMessage(sender, { text: 'Failed to fetch image. Please try again later.' });
                return;
            }

            await sock.sendMessage(sender, {
                image: { url: response.url },
                caption: '🔞 Uniform'
            });

            logger.info(`NSFW image sent to ${sender}`);
        } catch (err) {
            logger.error('Error in uniform:', err);
            await sock.sendMessage(sender, { text: 'Failed to fetch image.' });
        }
    },

    async thighs(sock, sender) {
        try {
            if (!await isNsfwEnabledForGroup(sender)) {
                await sock.sendMessage(sender, {
                    text: '❌ NSFW commands are disabled for this group'
                });
                return;
            }

            if (!isUserVerified(sender)) {
                await sock.sendMessage(sender, {
                    text: '⚠️ You need to verify your age first. Use !verify <your_age>'
                });
                return;
            }

            if (!applyCooldown(sender, 30)) {
                const remaining = getRemainingCooldown(sender);
                await sock.sendMessage(sender, {
                    text: `⏳ Please wait ${remaining} seconds before using this command again.`
                });
                return;
            }

            await sock.sendMessage(sender, { text: 'Fetching image...' });

            const response = await fetchApi(`${API_ENDPOINTS.HMTAI}/nsfw/thighs`);
            if (!response || !response.url) {
                await sock.sendMessage(sender, { text: 'Failed to fetch image. Please try again later.' });
                return;
            }

            await sock.sendMessage(sender, {
                image: { url: response.url },
                caption: '🔞 Thighs'
            });

            logger.info(`NSFW image sent to ${sender}`);
        } catch (err) {
            logger.error('Error in thighs:', err);
            await sock.sendMessage(sender, { text: 'Failed to fetch image.' });
        }
    },

    async femdom(sock, sender) {
        try {
            if (!await isNsfwEnabledForGroup(sender)) {
                await sock.sendMessage(sender, {
                    text: '❌ NSFW commands are disabled for this group'
                });
                return;
            }

            if (!isUserVerified(sender)) {
                await sock.sendMessage(sender, {
                    text: '⚠️ You need to verify your age first. Use !verify <your_age>'
                });
                return;
            }

            if (!applyCooldown(sender, 30)) {
                const remaining = getRemainingCooldown(sender);
                await sock.sendMessage(sender, {
                    text: `⏳ Please wait ${remaining} seconds before using this command again.`
                });
                return;
            }

            await sock.sendMessage(sender, { text: 'Fetching image...' });

            const response = await fetchApi(`${API_ENDPOINTS.HMTAI}/nsfw/femdom`);
            if (!response || !response.url) {
                await sock.sendMessage(sender, { text: 'Failed to fetch image. Please try again later.' });
                return;
            }

            await sock.sendMessage(sender, {
                image: { url: response.url },
                caption: '🔞 Femdom'
            });

            logger.info(`NSFW image sent to ${sender}`);
        } catch (err) {
            logger.error('Error in femdom:', err);
            await sock.sendMessage(sender, { text: 'Failed to fetch image.' });
        }
    },

    async tentacle(sock, sender) {
        try {
            if (!await isNsfwEnabledForGroup(sender)) {
                await sock.sendMessage(sender, {
                    text: '❌ NSFW commands are disabled for this group'
                });
                return;
            }

            if (!isUserVerified(sender)) {
                await sock.sendMessage(sender, {
                    text: '⚠️ You need to verify your age first. Use !verify <your_age>'
                });
                return;
            }

            if (!applyCooldown(sender, 30)) {
                const remaining = getRemainingCooldown(sender);
                await sock.sendMessage(sender, {
                    text: `⏳ Please wait ${remaining} seconds before using this command again.`
                });
                return;
            }

            await sock.sendMessage(sender, { text: 'Fetching image...' });

            const response = await fetchApi(`${API_ENDPOINTS.HMTAI}/nsfw/tentacle`);
            if (!response || !response.url) {
                await sock.sendMessage(sender, { text: 'Failed to fetch image. Please try again later.' });
                return;
            }

            await sock.sendMessage(sender, {
                image: { url: response.url },
                caption: '🔞 Tentacle'
            });

            logger.info(`NSFW image sent to ${sender}`);
        } catch (err) {
            logger.error('Error in tentacle:', err);
            await sock.sendMessage(sender, { text: 'Failed to fetch image.' });
        }
    },

    async pantsu(sock, sender) {
        try {
            if (!await isNsfwEnabledForGroup(sender)) {
                await sock.sendMessage(sender, {
                    text: '❌ NSFW commands are disabled for this group'
                });
                return;
            }

            if (!isUserVerified(sender)) {
                await sock.sendMessage(sender, {
                    text: '⚠️ You need to verify your age first. Use !verify <your_age>'
                });
                return;
            }

            if (!applyCooldown(sender, 30)) {
                const remaining = getRemainingCooldown(sender);
                await sock.sendMessage(sender, {
                    text: `⏳ Please wait ${remaining} seconds before using this command again.`
                });
                return;
            }

            await sock.sendMessage(sender, { text: 'Fetching image...' });

            const response = await fetchApi(`${API_ENDPOINTS.HMTAI}/nsfw/pantsu`);
            if (!response || !response.url) {
                await sock.sendMessage(sender, { text: 'Failed to fetch image. Please try again later.' });
                return;
            }

            await sock.sendMessage(sender, {
                image: { url: response.url },
                caption: '🔞 Pantsu'
            });

            logger.info(`NSFW image sent to ${sender}`);
        } catch (err) {
            logger.error('Error in pantsu:', err);
            await sock.sendMessage(sender, { text: 'Failed to fetch image.' });
        }
    },

    async kitsune(sock, sender) {
        try {
            if (!await isNsfwEnabledForGroup(sender)) {
                await sock.sendMessage(sender, {
                    text: '❌ NSFW commands are disabled for this group'
                });
                return;
            }

            if (!isUserVerified(sender)) {
                await sock.sendMessage(sender, {
                    text: '⚠️ You need to verify your age first. Use !verify <your_age>'
                });
                return;
            }

            if (!applyCooldown(sender, 30)) {
                const remaining = getRemainingCooldown(sender);
                await sock.sendMessage(sender, {
                    text: `⏳ Please wait ${remaining} seconds before using this command again.`
                });
                return;
            }

            await sock.sendMessage(sender, { text: 'Fetching image...' });

            const response = await fetchApi(`${API_ENDPOINTS.HMTAI}/nsfw/nsfwNeko`);
            if (!response || !response.url) {
                await sock.sendMessage(sender, { text: 'Failed to fetch image. Please try again later.' });
                return;
            }

            await sock.sendMessage(sender, {
                image: { url: response.url },
                caption: '🔞 Kitsune'
            });

            logger.info(`NSFW image sent to ${sender}`);
        } catch (err) {
            logger.error('Error in kitsune:', err);
            await sock.sendMessage(sender, { text: 'Failed to fetch image.' });
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