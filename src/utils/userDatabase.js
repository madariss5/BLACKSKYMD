/**
 * User Database
 * A centralized place to store and access user data
 */
const logger = require('./logger');
const fs = require('fs').promises;
const path = require('path');

// Simulated database for user profiles (should be replaced with actual database)
const userProfiles = new Map();

// Other user-related data
const userGames = new Map();
const marriageData = new Map();
const bankAccounts = new Map();
const userJobs = new Map();
const petData = new Map();
const userAfk = new Map();
const streakData = new Map();
const checkinData = new Map();
const lotteryParticipants = new Set();

/**
 * Initialize a user if they don't exist
 * @param {string} userId User's unique identifier
 * @param {Object} initialData Initial data to set
 * @returns {Object} User profile
 */
function initializeUserProfile(userId, initialData = {}) {
    if (!userProfiles.has(userId)) {
        const defaultProfile = {
            name: initialData.name || 'User',
            age: initialData.age || 0,
            xp: 0,
            level: 1,
            coins: 0,
            bio: '',
            registeredAt: new Date().toISOString(),
            lastDaily: null,
            inventory: [],
            achievements: [],
            customTitle: '',
            warnings: 0
        };
        
        userProfiles.set(userId, {
            ...defaultProfile,
            ...initialData
        });
    }
    
    return userProfiles.get(userId);
}

/**
 * Get a user's profile
 * @param {string} userId User's unique identifier
 * @returns {Object|null} User profile or null if not found
 */
function getUserProfile(userId) {
    return userProfiles.get(userId) || null;
}

/**
 * Update a user's profile
 * @param {string} userId User's unique identifier
 * @param {Object} data Data to update
 * @returns {Object} Updated user profile
 */
function updateUserProfile(userId, data) {
    const profile = getUserProfile(userId);
    
    if (!profile) {
        return initializeUserProfile(userId, data);
    }
    
    Object.assign(profile, data);
    return profile;
}

/**
 * Save all user data to a JSON file
 * @param {string} filename Filename to save to
 * @returns {Promise<boolean>} Whether save was successful
 */
async function saveAllUserData(filename = 'user_data.json') {
    try {
        const dataDir = path.join(process.cwd(), 'data');
        await fs.mkdir(dataDir, { recursive: true });
        
        const filePath = path.join(dataDir, filename);
        
        const userData = {
            profiles: Object.fromEntries(userProfiles),
            games: Object.fromEntries(userGames),
            marriages: Object.fromEntries(marriageData),
            bank: Object.fromEntries(bankAccounts),
            jobs: Object.fromEntries(userJobs),
            pets: Object.fromEntries(petData),
            afk: Object.fromEntries(userAfk),
            streaks: Object.fromEntries(streakData),
            checkins: Object.fromEntries(checkinData),
            lottery: [...lotteryParticipants]
        };
        
        await fs.writeFile(filePath, JSON.stringify(userData, null, 2));
        logger.info(`User data saved to ${filePath}`);
        return true;
    } catch (error) {
        logger.error('Error saving user data:', error);
        return false;
    }
}

/**
 * Load all user data from a JSON file
 * @param {string} filename Filename to load from
 * @returns {Promise<boolean>} Whether load was successful
 */
async function loadAllUserData(filename = 'user_data.json') {
    try {
        const filePath = path.join(process.cwd(), 'data', filename);
        
        // Check if file exists
        try {
            await fs.access(filePath);
        } catch (err) {
            logger.warn(`User data file ${filePath} not found. Starting with empty data.`);
            return false;
        }
        
        const data = JSON.parse(await fs.readFile(filePath, 'utf8'));
        
        // Clear existing data
        userProfiles.clear();
        userGames.clear();
        marriageData.clear();
        bankAccounts.clear();
        userJobs.clear();
        petData.clear();
        userAfk.clear();
        streakData.clear();
        checkinData.clear();
        lotteryParticipants.clear();
        
        // Load profiles
        if (data.profiles) {
            Object.entries(data.profiles).forEach(([key, value]) => {
                userProfiles.set(key, value);
            });
        }
        
        // Load games
        if (data.games) {
            Object.entries(data.games).forEach(([key, value]) => {
                userGames.set(key, value);
            });
        }
        
        // Load marriages
        if (data.marriages) {
            Object.entries(data.marriages).forEach(([key, value]) => {
                marriageData.set(key, value);
            });
        }
        
        // Load bank accounts
        if (data.bank) {
            Object.entries(data.bank).forEach(([key, value]) => {
                bankAccounts.set(key, value);
            });
        }
        
        // Load jobs
        if (data.jobs) {
            Object.entries(data.jobs).forEach(([key, value]) => {
                userJobs.set(key, value);
            });
        }
        
        // Load pets
        if (data.pets) {
            Object.entries(data.pets).forEach(([key, value]) => {
                petData.set(key, value);
            });
        }
        
        // Load AFK
        if (data.afk) {
            Object.entries(data.afk).forEach(([key, value]) => {
                userAfk.set(key, value);
            });
        }
        
        // Load streaks
        if (data.streaks) {
            Object.entries(data.streaks).forEach(([key, value]) => {
                streakData.set(key, value);
            });
        }
        
        // Load checkins
        if (data.checkins) {
            Object.entries(data.checkins).forEach(([key, value]) => {
                checkinData.set(key, value);
            });
        }
        
        // Load lottery
        if (data.lottery && Array.isArray(data.lottery)) {
            data.lottery.forEach(participant => {
                lotteryParticipants.add(participant);
            });
        }
        
        logger.info(`User data loaded from ${filePath}`);
        return true;
    } catch (error) {
        logger.error('Error loading user data:', error);
        return false;
    }
}

// Setup auto-save interval (every 5 minutes)
let autoSaveInterval = null;

/**
 * Start auto-saving user data
 * @param {number} interval Interval in milliseconds
 */
function startAutoSave(interval = 5 * 60 * 1000) {
    if (autoSaveInterval) {
        clearInterval(autoSaveInterval);
    }
    
    autoSaveInterval = setInterval(async () => {
        logger.info('Auto-saving user data...');
        await saveAllUserData();
    }, interval);
    
    logger.info(`Auto-save started with ${interval}ms interval`);
}

/**
 * Stop auto-saving user data
 */
function stopAutoSave() {
    if (autoSaveInterval) {
        clearInterval(autoSaveInterval);
        autoSaveInterval = null;
        logger.info('Auto-save stopped');
    }
}

// Start auto-save when this module is imported
startAutoSave();

// Initialize with attempt to load existing data
(async () => {
    try {
        await loadAllUserData();
    } catch (error) {
        logger.error('Failed to load initial user data:', error);
    }
})();

// Ensure data is saved when the process exits
process.on('SIGINT', async () => {
    logger.info('Process terminated, saving user data...');
    await saveAllUserData();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    logger.info('Process terminated, saving user data...');
    await saveAllUserData();
    process.exit(0);
});

module.exports = {
    userProfiles,
    userGames,
    marriageData,
    bankAccounts,
    userJobs,
    petData,
    userAfk,
    streakData,
    checkinData,
    lotteryParticipants,
    initializeUserProfile,
    getUserProfile,
    updateUserProfile,
    saveAllUserData,
    loadAllUserData,
    startAutoSave,
    stopAutoSave
};