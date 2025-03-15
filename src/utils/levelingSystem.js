/**
 * Leveling System - Tracks user activity and manages level progression
 * Features multilingual support and optimized buffer handling with caching
 */
const fs = require('fs').promises;
const path = require('path');
const { createCanvas, loadImage } = require('canvas');
const userDatabase = require('./userDatabase');
const logger = require('./logger');
const { isFeatureEnabled } = require('./groupSettings');
const { languageManager } = require('./language');
const config = require('../config/config');

// XP gain settings
const XP_SETTINGS = {
    message: { min: 10, max: 25 },
    command: { min: 15, max: 30 },
    media: { min: 20, max: 40 },
    voice: { min: 25, max: 50 },
    daily: { min: 100, max: 100 }
};

// Cooldown map to prevent XP farming (userId => timestamp)
const xpCooldowns = new Map();
const COOLDOWN_MS = 60 * 1000; // 1 minute cooldown between XP gains

// Formula settings for level calculation
const BASE_XP = 100;
const XP_MULTIPLIER = 1.5;

// Cache settings
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

// LRU Cache implementation for level cards
class LRUCache {
    constructor(maxSize = 50) {
        this.maxSize = maxSize;
        this.cache = new Map();
        this.keys = [];
    }

    has(key) {
        return this.cache.has(key);
    }

    get(key) {
        if (!this.cache.has(key)) return null;
        
        // Move this key to the end of keys (most recently used)
        this.keys = this.keys.filter(k => k !== key);
        this.keys.push(key);
        
        return this.cache.get(key);
    }

    set(key, value) {
        // Add or update the value
        this.cache.set(key, value);
        
        // Remove key from keys array if it exists
        this.keys = this.keys.filter(k => k !== key);
        
        // Add key to the end (most recently used)
        this.keys.push(key);
        
        // Prune cache if it exceeds max size
        if (this.keys.length > this.maxSize) {
            const oldestKey = this.keys.shift();
            this.cache.delete(oldestKey);
            logger.debug(`Cache pruned, removed oldest key: ${oldestKey}`);
        }
    }

    delete(key) {
        this.cache.delete(key);
        this.keys = this.keys.filter(k => k !== key);
    }

    clear() {
        this.cache.clear();
        this.keys = [];
    }

    get size() {
        return this.cache.size;
    }
}

// Initialize LRU cache for level card buffers
const cardBufferCache = new LRUCache(20);

/**
 * Initialize a user's XP data
 * @param {string} userId User's unique identifier
 */
function initializeUser(userId) {
    const profile = userDatabase.getUserProfile(userId);
    
    if (!profile) {
        return userDatabase.initializeUserProfile(userId, { xp: 0, level: 1 });
    }
    
    if (profile.xp === undefined) {
        profile.xp = 0;
    }
    
    if (profile.level === undefined) {
        profile.level = calculateLevel(profile.xp);
    }
    
    return profile;
}

/**
 * Get user's level data
 * @param {string} userId User's unique identifier
 * @returns {Object} User's level data
 */
function getUserLevelData(userId) {
    const profile = userDatabase.getUserProfile(userId);
    
    if (!profile) {
        return initializeUser(userId);
    }
    
    return profile;
}

/**
 * Calculate user's level based on XP
 * @param {number} xp Total XP
 * @returns {number} Current level
 */
function calculateLevel(xp) {
    if (xp < BASE_XP) return 1;
    
    // Level formula: level = log(xp/BASE_XP) / log(XP_MULTIPLIER) + 1
    return Math.floor(Math.log(xp / BASE_XP) / Math.log(XP_MULTIPLIER) + 1);
}

/**
 * Calculate XP required for a given level
 * @param {number} level The level
 * @returns {number} XP required
 */
function calculateRequiredXP(level) {
    if (level <= 1) return BASE_XP;
    return Math.floor(BASE_XP * Math.pow(XP_MULTIPLIER, level - 1));
}

/**
 * Add XP to a user for an activity
 * @param {string} userId User's unique identifier 
 * @param {string} activityType Type of activity (message, command, media, voice, daily)
 * @param {string} groupJid Group JID (if in a group context)
 * @returns {Promise<Object|null>} Level up data if user leveled up, null otherwise
 */
async function addXP(userId, activityType = 'message', groupJid = null) {
    // If this is a group message, check if leveling is enabled for this group
    if (groupJid) {
        const levelingEnabled = await isFeatureEnabled(groupJid, 'leveling');
        if (!levelingEnabled) {
            logger.debug(`Leveling is disabled for group ${groupJid}, not adding XP`);
            return null;
        }
    }
    
    // Check if on cooldown (except for daily and command types)
    if (activityType !== 'daily' && activityType !== 'command') {
        const lastUpdate = xpCooldowns.get(userId);
        const now = Date.now();
        
        if (lastUpdate && (now - lastUpdate) < COOLDOWN_MS) {
            return null;
        }
        
        // Set cooldown
        xpCooldowns.set(userId, now);
    }
    
    // Get XP amount based on activity type
    const settings = XP_SETTINGS[activityType] || XP_SETTINGS.message;
    const xpAmount = Math.floor(Math.random() * (settings.max - settings.min + 1)) + settings.min;
    
    // Update user profile
    const profile = getUserLevelData(userId);
    const oldLevel = profile.level;
    profile.xp += xpAmount;
    
    // Calculate new level
    const newLevel = calculateLevel(profile.xp);
    profile.level = newLevel;
    
    // Save changes
    userDatabase.updateUserProfile(userId, { xp: profile.xp, level: newLevel });
    
    // Check for level up
    if (newLevel > oldLevel) {
        // Calculate rewards for leveling up
        const coinReward = Math.floor(50 * Math.pow(1.2, newLevel - 1));
        
        // Add coins to user profile
        profile.coins = (profile.coins || 0) + coinReward;
        userDatabase.updateUserProfile(userId, { coins: profile.coins });
        
        logger.info(`User ${userId} leveled up to level ${newLevel} and received ${coinReward} coins!`);
        
        return {
            oldLevel,
            newLevel,
            coinReward,
            totalXp: profile.xp,
            requiredXp: calculateRequiredXP(newLevel + 1)
        };
    }
    
    return null;
}

/**
 * Set user's notification preference for level up messages
 * @param {string} userId User's unique identifier
 * @param {boolean} enabled Whether to show level up notifications
 */
function setLevelUpNotification(userId, enabled = true) {
    const profile = getUserLevelData(userId);
    profile.levelUpNotification = enabled;
    userDatabase.updateUserProfile(userId, { levelUpNotification: enabled });
}

/**
 * Check if user has level up notifications enabled
 * @param {string} userId User's unique identifier
 * @returns {boolean} Whether level up notifications are enabled
 */
function hasLevelUpNotificationEnabled(userId) {
    const profile = getUserLevelData(userId);
    // Default to true if not set
    return profile.levelUpNotification !== false;
}

/**
 * Get progress to next level with enhanced error handling
 * @param {string} userId User's unique identifier
 * @returns {Object} Progress data
 */
function getLevelProgress(userId) {
    try {
        // Get user profile with defensive error handling
        let profile = null;
        try {
            profile = getUserLevelData(userId);
        } catch (profileError) {
            logger.error(`Error getting user level data for ${userId}:`, profileError);
            // Use fallback default profile
            profile = { xp: 0, level: 1 };
        }
        
        // Validate profile to prevent NaN in calculations
        const currentLevel = typeof profile.level === 'number' ? profile.level : 1;
        const userXP = typeof profile.xp === 'number' ? profile.xp : 0;
        const nextLevel = currentLevel + 1;
        
        let currentLevelXP = 0;
        let nextLevelXP = 100;
        
        try {
            currentLevelXP = calculateRequiredXP(currentLevel);
            nextLevelXP = calculateRequiredXP(nextLevel);
        } catch (xpError) {
            logger.error(`Error calculating XP requirements for user ${userId}:`, xpError);
            // Continue with default values
        }
        
        // Handle edge cases to prevent NaN or Infinity
        const xpForCurrentLevel = Math.max(0, userXP - currentLevelXP);
        const xpRequiredForNextLevel = Math.max(1, nextLevelXP - currentLevelXP); // Prevent division by zero
        
        const progressPercent = Math.min(100, Math.floor((xpForCurrentLevel / xpRequiredForNextLevel) * 100));
        let progressBar = '░░░░░░░░░░░░░░░░░░░░ 0%';
        try {
            progressBar = createProgressBar(progressPercent);
        } catch (barError) {
            logger.error(`Error creating progress bar for user ${userId}:`, barError);
            // Continue with default progress bar
        }
        
        return {
            currentLevel,
            nextLevel,
            currentXP: userXP,
            requiredXP: nextLevelXP,
            neededXP: nextLevelXP - userXP,
            progressPercent,
            progressBar
        };
    } catch (error) {
        logger.error(`Critical error in getLevelProgress for user ${userId}:`, error);
        // Return default data that won't break profile display
        return {
            currentLevel: 1,
            nextLevel: 2,
            currentXP: 0,
            requiredXP: 100,
            neededXP: 100,
            progressPercent: 0,
            progressBar: '░░░░░░░░░░░░░░░░░░░░ 0%'
        };
    }
}

/**
 * Get leaderboard data sorted by XP with robust error handling
 * @param {number} limit Maximum number of users to return
 * @returns {Array} Sorted array of user data
 */
function getLeaderboard(limit = 10) {
    try {
        // Safely access userProfiles with error handling
        if (!userDatabase.userProfiles || typeof userDatabase.userProfiles.entries !== 'function') {
            logger.error('userProfiles is not a valid Map in getLeaderboard');
            return []; // Return empty array to prevent crashes
        }
        
        // Use a safer approach with error handling for individual entries
        const users = [];
        try {
            for (const [id, profile] of userDatabase.userProfiles.entries()) {
                if (!id) continue; // Skip entries with invalid IDs
                
                try {
                    // Validate profile data
                    const validProfile = {
                        id,
                        name: (profile && typeof profile.name === 'string') ? profile.name : 'User',
                        xp: (profile && typeof profile.xp === 'number') ? profile.xp : 0,
                        level: (profile && typeof profile.level === 'number') ? profile.level : 1
                    };
                    users.push(validProfile);
                } catch (profileError) {
                    logger.error(`Error processing profile for leaderboard (${id}):`, profileError);
                    // Add a safe default entry to maintain user's presence in leaderboard
                    users.push({ id, name: 'User', xp: 0, level: 1 });
                }
            }
        } catch (iterationError) {
            logger.error('Error iterating over userProfiles in getLeaderboard:', iterationError);
            return []; // Fall back to empty array if iteration fails
        }
        
        // Safe sorting with error handling
        try {
            return users
                .sort((a, b) => (b.xp || 0) - (a.xp || 0)) // Ensure values are numbers
                .slice(0, Math.max(1, Math.min(limit || 10, 1000))); // Ensure sensible limit bounds
        } catch (sortError) {
            logger.error('Error sorting leaderboard data:', sortError);
            return users.slice(0, Math.min(limit || 10, 1000)); // Return unsorted if sorting fails
        }
    } catch (error) {
        logger.error('Critical error in getLeaderboard:', error);
        return []; // Return empty array on critical failure
    }
}

/**
 * Create a progress bar string
 * @param {number} progress Progress percentage (0-100)
 * @param {number} length Length of progress bar
 * @returns {string} Progress bar string
 */
function createProgressBar(progress, length = 20) {
    const filledLength = Math.floor(length * (progress / 100));
    const emptyLength = length - filledLength;
    
    const filled = '█'.repeat(filledLength);
    const empty = '░'.repeat(emptyLength);
    
    return `${filled}${empty} ${progress}%`;
}

/**
 * Generate a level card image with enhanced error handling
 * @param {string} userId User ID
 * @param {Object} userData User data including name
 * @returns {Promise<string>} Path to generated image
 */
async function generateLevelCard(userId, userData) {
    try {
        // Get user data with error handling
        let profile = null;
        try {
            profile = getUserLevelData(userId);
        } catch (profileError) {
            logger.error(`Error getting user level data for level card generation (${userId}):`, profileError);
            // Use userData as fallback if available, otherwise create minimal profile
            profile = {
                level: userData?.level || 1,
                xp: userData?.xp || 0
            };
        }
        
        // Get level progress with error handling
        let progress = null;
        try {
            progress = getLevelProgress(userId);
        } catch (progressError) {
            logger.error(`Error getting level progress for level card generation (${userId}):`, progressError);
            // Create fallback progress data
            progress = {
                currentLevel: profile.level || 1,
                requiredXP: 100,
                progressPercent: 0
            };
        }
        
        // Ensure temp directory exists
        try {
            const tempDir = path.join(process.cwd(), 'temp', 'user');
            await fs.mkdir(tempDir, { recursive: true });
            
            // Create canvas
            const canvas = createCanvas(800, 300);
            const ctx = canvas.getContext('2d');
            
            // Background
            ctx.fillStyle = '#36393f';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            // Add border
            ctx.strokeStyle = '#5865f2';
            ctx.lineWidth = 8;
            ctx.strokeRect(0, 0, canvas.width, canvas.height);
            
            // User name with error handling
            try {
                ctx.font = 'bold 36px Arial';
                ctx.fillStyle = '#ffffff';
                const name = userData?.name || 'User';
                const wrappedName = wrapText(ctx, name, 600, 36);
                ctx.fillText(wrappedName, 30, 60);
            } catch (nameError) {
                logger.error(`Error rendering name for level card (${userId}):`, nameError);
                // Fallback to simple text
                ctx.fillText('User', 30, 60);
            }
            
            // Get current language
            const currentLang = config.bot.language || 'en';
            
            // Level info with translation
            try {
                ctx.font = 'bold 32px Arial';
                ctx.fillStyle = '#5865f2';
                // Get translated "Level" text
                const levelText = languageManager.getText('user.level', currentLang);
                ctx.fillText(`${levelText} ${profile.level || 1}`, 30, 120);
            } catch (levelError) {
                logger.error(`Error rendering level for level card (${userId}):`, levelError);
                // Fallback to English
                ctx.fillText(`Level ${profile.level || 1}`, 30, 120);
            }
            
            // XP info with translation
            try {
                ctx.font = '24px Arial';
                ctx.fillStyle = '#bbbbbb';
                // Get XP text with translation
                const xpLabel = languageManager.getText('user.xp', currentLang);
                ctx.fillText(`${xpLabel}: ${profile.xp || 0} / ${progress.requiredXP || 100}`, 30, 160);
            } catch (xpError) {
                logger.error(`Error rendering XP for level card (${userId}):`, xpError);
                // Fallback to English
                ctx.fillText(`XP: ${profile.xp || 0} / ${progress.requiredXP || 100}`, 30, 160);
            }
            
            // Progress bar background
            ctx.fillStyle = '#292b2f';
            ctx.fillRect(30, 200, 740, 30);
            
            // Progress bar
            try {
                ctx.fillStyle = '#5865f2';
                const progressPercent = progress.progressPercent || 0;
                const progressWidth = (progressPercent / 100) * 740;
                ctx.fillRect(30, 200, progressWidth, 30);
            } catch (progressBarError) {
                logger.error(`Error rendering progress bar for level card (${userId}):`, progressBarError);
            }
            
            // Rank info (if available) with translation
            try {
                const leaderboard = getLeaderboard(100);
                const rank = leaderboard.findIndex(u => u.id === userId) + 1;
                
                if (rank > 0) {
                    ctx.font = 'bold 28px Arial';
                    ctx.fillStyle = '#ffffff';
                    
                    // Get translated "Rank" text
                    const rankText = languageManager.getText('user.rank', currentLang);
                    ctx.fillText(`${rankText}: #${rank}`, 600, 120);
                }
            } catch (rankError) {
                logger.error(`Error rendering rank for level card (${userId}):`, rankError);
                // Continue without rank display
            }
            
            try {
                // Create output path
                const outputPath = path.join(tempDir, `${userId.split('@')[0]}_level.png`);
                
                // Generate high-quality PNG buffer with better compression
                const buffer = canvas.toBuffer('image/png', {
                    compressionLevel: 6,
                    filters: canvas.PNG_FILTER_NONE,
                    resolution: 96
                });
                
                // Save buffer to file with explicit binary writing
                await fs.writeFile(outputPath, buffer);
                
                // Store the buffer in LRU cache for quicker access with memory efficiency
                try {
                    // Store in LRU cache - automatically manages size limits
                    cardBufferCache.set(userId, {
                        buffer,
                        path: outputPath,
                        timestamp: Date.now(),
                        expiry: Date.now() + CACHE_DURATION_MS
                    });
                    
                    logger.debug(`Stored level card in LRU cache for ${userId} (cache size: ${cardBufferCache.size})`);
                } catch (cacheError) {
                    // Just log - caching is optional
                    logger.debug(`Cache error for level card (${userId}):`, cacheError);
                }
                
                return outputPath;
            } catch (saveError) {
                logger.error(`Error saving level card image for ${userId}:`, saveError);
                return null;
            }
        } catch (dirError) {
            logger.error(`Error creating temp directory for level card (${userId}):`, dirError);
            return null;
        }
    } catch (error) {
        logger.error(`Critical error in generateLevelCard for ${userId}:`, error);
        return null;
    }
}

/**
 * Helper function to wrap text on canvas
 * @param {CanvasRenderingContext2D} ctx Canvas context
 * @param {string} text Text to wrap
 * @param {number} maxWidth Max width before wrapping
 * @param {number} fontSize Font size
 * @returns {string} Wrapped text
 */
function wrapText(ctx, text, maxWidth, fontSize) {
    // If text is short enough, return as is
    if (ctx.measureText(text).width < maxWidth) {
        return text;
    }
    
    // Otherwise, truncate with ellipsis
    let truncated = text;
    while (ctx.measureText(truncated + '...').width > maxWidth) {
        truncated = truncated.slice(0, -1);
    }
    
    return truncated + '...';
}

// Initialize the module
(async () => {
    try {
        // Create temp directories if needed
        const tempDir = path.join(process.cwd(), 'temp', 'user');
        await fs.mkdir(tempDir, { recursive: true }).catch(() => {});
        
        logger.info('Leveling system initialized');
    } catch (error) {
        logger.error('Error initializing leveling system:', error);
    }
})();

/**
 * Get the buffer for a level card image with LRU caching
 * @param {string} userId User ID
 * @param {Object} userData User data including name
 * @returns {Promise<{buffer: Buffer, path: string}|null>} Card buffer and path or null
 */
async function getLevelCardBuffer(userId, userData) {
    try {
        // Get current language for debug messages
        const currentLang = config.bot.language || 'en';
        
        // Check LRU cache first for optimal performance
        if (cardBufferCache.has(userId)) {
            const cached = cardBufferCache.get(userId);
            const now = Date.now();
            
            // Return cache if still valid
            if (cached && cached.expiry > now && cached.buffer) {
                logger.debug(`Using cached level card for ${userId} (${languageManager.getText('user.cache_hit', currentLang)})`);
                return {
                    buffer: cached.buffer,
                    path: cached.path,
                    cached: true
                };
            }
            
            // Remove expired cache entry
            cardBufferCache.delete(userId);
            logger.debug(`Cache expired for ${userId}, generating new card`);
        }
        
        // Generate new card
        const cardPath = await generateLevelCard(userId, userData);
        if (!cardPath) {
            logger.error(`Failed to generate level card for ${userId}`);
            return null;
        }
        
        // Read buffer directly with optimized error handling
        try {
            const buffer = await fs.readFile(cardPath);
            
            // Add to LRU cache for future requests
            cardBufferCache.set(userId, {
                buffer,
                path: cardPath,
                timestamp: Date.now(),
                expiry: Date.now() + CACHE_DURATION_MS
            });
            
            return { 
                buffer, 
                path: cardPath,
                cached: false
            };
        } catch (readErr) {
            logger.error(`Error reading level card buffer for ${userId}:`, readErr);
            return null;
        }
    } catch (error) {
        logger.error(`Error in getLevelCardBuffer for ${userId}:`, error);
        return null;
    }
}

module.exports = {
    initializeUser,
    getUserLevelData,
    calculateLevel,
    addXP,
    setLevelUpNotification,
    hasLevelUpNotificationEnabled,
    getLevelProgress,
    getLeaderboard,
    createProgressBar,
    generateLevelCard,
    getLevelCardBuffer
};