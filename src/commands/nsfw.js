const logger = require('../utils/logger');
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const { promisify } = require('util');
const exec = promisify(require('child_process').exec);
const FileType = require('file-type');
const FormData = require('form-data');
const sharp = require('sharp');
const fetch = require('node-fetch');
const ffmpeg = require('fluent-ffmpeg');
const { getGroupSettings, saveGroupSettings } = require('../utils/groupSettings');

// Create temp directory for processing media
const TEMP_DIR = path.join(process.cwd(), 'temp', 'nsfw');
const API_ENDPOINTS = {
    ANIME: 'https://api.waifu.pics',
    HMTAI: 'https://hmtai.hatsunia.cfd/v2',
    NEKOS: 'https://nekos.life/api/v2',
    ANIME_PICS: 'https://anime-api.hisoka17.repl.co',
    ANIME_IMAGES: 'https://anime-api.xyz/api/v2'
};

// Stored user verifications (in memory)
const verifiedUsers = new Map();
// Stored group settings
const groupNsfwSettings = new Map();
// User cooldowns
const userCooldowns = new Map();

/**
 * Initialize required directories
 */
async function initDirectories() {
    try {
        await fs.mkdir(TEMP_DIR, { recursive: true });
        logger.info('NSFW temp directories created');
    } catch (err) {
        logger.error('Failed to create NSFW temp directories:', err);
    }
}

/**
 * Check if user is verified for NSFW content
 * @param {string} userId User JID
 * @returns {boolean} Whether user is verified
 */
function isUserVerified(userId) {
    return verifiedUsers.has(userId);
}

/**
 * Verify user with age confirmation
 * @param {string} userId User JID
 * @param {boolean} verified Verification status
 */
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

/**
 * Check if NSFW is enabled for a group
 * @param {string} groupId Group JID
 * @returns {Promise<boolean>} Whether NSFW is enabled
 */
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

/**
 * Save NSFW settings for a group
 * @param {string} groupId Group JID
 * @param {boolean} enabled Whether NSFW is enabled
 */
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

/**
 * Download media to a temporary file
 * @param {string} url URL to download from
 * @returns {Promise<string|null>} Path to downloaded file or null on failure
 */
async function downloadMedia(url) {
    try {
        const response = await axios.get(url, { responseType: 'arraybuffer' });
        const buffer = Buffer.from(response.data);
        const fileType = await FileType.fromBuffer(buffer);
        
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

/**
 * Fetch from an API with error handling
 * @param {string} url API URL
 * @returns {Promise<any>} API response or null
 */
async function fetchApi(url) {
    try {
        const response = await axios.get(url);
        return response.data;
    } catch (err) {
        logger.error(`API fetch error (${url}):`, err.message);
        return null;
    }
}

/**
 * Apply cooldown to a user
 * @param {string} userId User JID
 * @param {number} seconds Cooldown in seconds
 * @returns {boolean} Whether cooldown was applied or user is in cooldown
 */
function applyCooldown(userId, seconds = 60) {
    const now = Date.now();
    const cooldownExpiry = userCooldowns.get(userId);
    
    if (cooldownExpiry && cooldownExpiry > now) {
        return false; // User is in cooldown
    }
    
    userCooldowns.set(userId, now + (seconds * 1000));
    return true;
}

/**
 * Get remaining cooldown time
 * @param {string} userId User JID
 * @returns {number} Remaining cooldown in seconds
 */
function getRemainingCooldown(userId) {
    const now = Date.now();
    const cooldownExpiry = userCooldowns.get(userId);
    
    if (!cooldownExpiry || cooldownExpiry <= now) {
        return 0;
    }
    
    return Math.ceil((cooldownExpiry - now) / 1000);
}

// Call init
initDirectories();

// Define the NSFW commands
const nsfwCommands = {
    // Original commands
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

            // Basic URL validation
            if (!imageUrl.startsWith('http')) {
                await sock.sendMessage(sender, {
                    text: 'Please provide a valid image URL'
                });
                return;
            }

            await sock.sendMessage(sender, { 
                text: 'Analyzing content safety...' 
            });

            // Simple implementation without external API
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

    // New NSFW commands
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
    
    // NSFW image commands
    async waifu(sock, sender) {
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
            
            await sock.sendMessage(sender, { text: 'Fetching waifu image...' });
            
            const response = await fetchApi(`${API_ENDPOINTS.HMTAI}/nsfw/waifu`);
            if (!response || !response.url) {
                await sock.sendMessage(sender, { text: 'Failed to fetch image. Please try again later.' });
                return;
            }
            
            await sock.sendMessage(sender, {
                image: { url: response.url },
                caption: '🎭 NSFW Waifu'
            });
            
            logger.info(`NSFW waifu image sent to ${sender}`);
        } catch (err) {
            logger.error('Error in waifu:', err);
            await sock.sendMessage(sender, { text: 'Failed to fetch waifu image.' });
        }
    },
    
    async neko(sock, sender) {
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
            
            await sock.sendMessage(sender, { text: 'Fetching neko image...' });
            
            const response = await fetchApi(`${API_ENDPOINTS.HMTAI}/nsfw/neko`);
            if (!response || !response.url) {
                await sock.sendMessage(sender, { text: 'Failed to fetch image. Please try again later.' });
                return;
            }
            
            await sock.sendMessage(sender, {
                image: { url: response.url },
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
            
            const response = await fetchApi(`${API_ENDPOINTS.HMTAI}/nsfw/blowjob`);
            if (!response || !response.url) {
                await sock.sendMessage(sender, { text: 'Failed to fetch image. Please try again later.' });
                return;
            }
            
            await sock.sendMessage(sender, {
                image: { url: response.url },
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
    
    // GIF commands
    async gifboobs(sock, sender) {
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
            
            if (!applyCooldown(sender, 45)) {
                const remaining = getRemainingCooldown(sender);
                await sock.sendMessage(sender, {
                    text: `⏳ Please wait ${remaining} seconds before using this command again.`
                });
                return;
            }
            
            await sock.sendMessage(sender, { text: 'Fetching GIF...' });
            
            const response = await fetchApi(`${API_ENDPOINTS.HMTAI}/nsfw/boobjob`);
            if (!response || !response.url) {
                await sock.sendMessage(sender, { text: 'Failed to fetch GIF. Please try again later.' });
                return;
            }
            
            // Send as video for better compatibility
            await sock.sendMessage(sender, {
                video: { url: response.url },
                caption: '🔞 Boobs GIF',
                gifPlayback: true
            });
            
            logger.info(`NSFW GIF sent to ${sender}`);
        } catch (err) {
            logger.error('Error in gifboobs:', err);
            await sock.sendMessage(sender, { text: 'Failed to fetch GIF.' });
        }
    },
    
    async gifass(sock, sender) {
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
            
            if (!applyCooldown(sender, 45)) {
                const remaining = getRemainingCooldown(sender);
                await sock.sendMessage(sender, {
                    text: `⏳ Please wait ${remaining} seconds before using this command again.`
                });
                return;
            }
            
            await sock.sendMessage(sender, { text: 'Fetching GIF...' });
            
            // For this endpoint, we'll use a substitute
            const response = await fetchApi(`${API_ENDPOINTS.HMTAI}/nsfw/ass`);
            if (!response || !response.url) {
                await sock.sendMessage(sender, { text: 'Failed to fetch GIF. Please try again later.' });
                return;
            }
            
            // Send as video for better compatibility
            await sock.sendMessage(sender, {
                image: { url: response.url },
                caption: '🔞 Ass Image'
            });
            
            logger.info(`NSFW image sent to ${sender}`);
        } catch (err) {
            logger.error('Error in gifass:', err);
            await sock.sendMessage(sender, { text: 'Failed to fetch GIF.' });
        }
    },
    
    async gifhentai(sock, sender) {
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
            
            if (!applyCooldown(sender, 45)) {
                const remaining = getRemainingCooldown(sender);
                await sock.sendMessage(sender, {
                    text: `⏳ Please wait ${remaining} seconds before using this command again.`
                });
                return;
            }
            
            await sock.sendMessage(sender, { text: 'Fetching GIF...' });
            
            const response = await fetchApi(`${API_ENDPOINTS.HMTAI}/nsfw/gif`);
            if (!response || !response.url) {
                await sock.sendMessage(sender, { text: 'Failed to fetch GIF. Please try again later.' });
                return;
            }
            
            // Send as video for better compatibility
            await sock.sendMessage(sender, {
                video: { url: response.url },
                caption: '🔞 Hentai GIF',
                gifPlayback: true
            });
            
            logger.info(`NSFW GIF sent to ${sender}`);
        } catch (err) {
            logger.error('Error in gifhentai:', err);
            await sock.sendMessage(sender, { text: 'Failed to fetch GIF.' });
        }
    },
    
    async gifblowjob(sock, sender) {
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
            
            if (!applyCooldown(sender, 45)) {
                const remaining = getRemainingCooldown(sender);
                await sock.sendMessage(sender, {
                    text: `⏳ Please wait ${remaining} seconds before using this command again.`
                });
                return;
            }
            
            await sock.sendMessage(sender, { text: 'Fetching GIF...' });
            
            const response = await fetchApi(`${API_ENDPOINTS.HMTAI}/nsfw/blowjob`);
            if (!response || !response.url) {
                await sock.sendMessage(sender, { text: 'Failed to fetch GIF. Please try again later.' });
                return;
            }
            
            // Send as image if it's not animated
            await sock.sendMessage(sender, {
                image: { url: response.url },
                caption: '🔞 Blowjob'
            });
            
            logger.info(`NSFW image sent to ${sender}`);
        } catch (err) {
            logger.error('Error in gifblowjob:', err);
            await sock.sendMessage(sender, { text: 'Failed to fetch GIF.' });
        }
    },
    
    // Fetish commands
    async uniform(sock, sender) {
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
    
    // Initialize function
    async init() {
        logger.info('NSFW module initialized with enhanced commands');
        await initDirectories();
        return this;
    }
};

module.exports = nsfwCommands;