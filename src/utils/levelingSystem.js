/**
 * Leveling System - Tracks user activity and manages level progression
 * Inspired by popular Discord and WhatsApp bots
 */
const fs = require('fs').promises;
const path = require('path');
const { createCanvas, loadImage } = require('canvas');
const userDatabase = require('./userDatabase');
const logger = require('./logger');
const { isFeatureEnabled } = require('./groupSettings');

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
            
            // Level info
            try {
                ctx.font = 'bold 32px Arial';
                ctx.fillStyle = '#5865f2';
                ctx.fillText(`Level ${profile.level || 1}`, 30, 120);
            } catch (levelError) {
                logger.error(`Error rendering level for level card (${userId}):`, levelError);
            }
            
            // XP info
            try {
                ctx.font = '24px Arial';
                ctx.fillStyle = '#bbbbbb';
                ctx.fillText(`XP: ${profile.xp || 0} / ${progress.requiredXP || 100}`, 30, 160);
            } catch (xpError) {
                logger.error(`Error rendering XP for level card (${userId}):`, xpError);
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
            
            // Rank info (if available)
            try {
                const leaderboard = getLeaderboard(100);
                const rank = leaderboard.findIndex(u => u.id === userId) + 1;
                
                if (rank > 0) {
                    ctx.font = 'bold 28px Arial';
                    ctx.fillStyle = '#ffffff';
                    ctx.fillText(`Rank: #${rank}`, 600, 120);
                }
            } catch (rankError) {
                logger.error(`Error rendering rank for level card (${userId}):`, rankError);
                // Continue without rank display
            }
            
            try {
                // Save the image
                const outputPath = path.join(tempDir, `${userId.split('@')[0]}_level.png`);
                const buffer = canvas.toBuffer('image/png');
                await fs.writeFile(outputPath, buffer);
                
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
    generateLevelCard
};