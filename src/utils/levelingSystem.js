/**
 * Leveling System - Tracks user activity and manages level progression
 * Inspired by popular Discord and WhatsApp bots
 */
const fs = require('fs').promises;
const path = require('path');
const { createCanvas, loadImage } = require('canvas');
const userDatabase = require('./userDatabase');
const logger = require('./logger');

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
 * @returns {Object|null} Level up data if user leveled up, null otherwise
 */
function addXP(userId, activityType = 'message') {
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
 * Get progress to next level
 * @param {string} userId User's unique identifier
 * @returns {Object} Progress data
 */
function getLevelProgress(userId) {
    const profile = getUserLevelData(userId);
    const currentLevel = profile.level;
    const nextLevel = currentLevel + 1;
    
    const currentLevelXP = calculateRequiredXP(currentLevel);
    const nextLevelXP = calculateRequiredXP(nextLevel);
    
    const xpForCurrentLevel = profile.xp - currentLevelXP;
    const xpRequiredForNextLevel = nextLevelXP - currentLevelXP;
    
    const progressPercent = Math.min(100, Math.floor((xpForCurrentLevel / xpRequiredForNextLevel) * 100));
    
    return {
        currentLevel,
        nextLevel,
        currentXP: profile.xp,
        requiredXP: nextLevelXP,
        neededXP: nextLevelXP - profile.xp,
        progressPercent,
        progressBar: createProgressBar(progressPercent)
    };
}

/**
 * Get leaderboard data sorted by XP
 * @param {number} limit Maximum number of users to return
 * @returns {Array} Sorted array of user data
 */
function getLeaderboard(limit = 10) {
    const users = [...userDatabase.userProfiles].map(([id, profile]) => ({
        id,
        name: profile.name || 'User',
        xp: profile.xp || 0,
        level: profile.level || 1
    }));
    
    return users
        .sort((a, b) => b.xp - a.xp)
        .slice(0, limit);
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
 * Generate a level card image
 * @param {string} userId User ID
 * @param {Object} userData User data including name
 * @returns {Promise<string>} Path to generated image
 */
async function generateLevelCard(userId, userData) {
    const profile = getUserLevelData(userId);
    const progress = getLevelProgress(userId);
    
    // Ensure temp directory exists
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
    
    // User name
    ctx.font = 'bold 36px Arial';
    ctx.fillStyle = '#ffffff';
    const name = userData.name || 'User';
    ctx.fillText(wrapText(ctx, name, 600, 36), 30, 60);
    
    // Level info
    ctx.font = 'bold 32px Arial';
    ctx.fillStyle = '#5865f2';
    ctx.fillText(`Level ${profile.level}`, 30, 120);
    
    // XP info
    ctx.font = '24px Arial';
    ctx.fillStyle = '#bbbbbb';
    ctx.fillText(`XP: ${profile.xp} / ${progress.requiredXP}`, 30, 160);
    
    // Progress bar background
    ctx.fillStyle = '#292b2f';
    ctx.fillRect(30, 200, 740, 30);
    
    // Progress bar
    ctx.fillStyle = '#5865f2';
    const progressWidth = (progress.progressPercent / 100) * 740;
    ctx.fillRect(30, 200, progressWidth, 30);
    
    // Rank info (if available)
    const leaderboard = getLeaderboard(100);
    const rank = leaderboard.findIndex(u => u.id === userId) + 1;
    
    if (rank > 0) {
        ctx.font = 'bold 28px Arial';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(`Rank: #${rank}`, 600, 120);
    }
    
    // Save the image
    const outputPath = path.join(tempDir, `${userId.split('@')[0]}_level.png`);
    const buffer = canvas.toBuffer('image/png');
    await fs.writeFile(outputPath, buffer);
    
    return outputPath;
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