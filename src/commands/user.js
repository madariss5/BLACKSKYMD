const logger = require('../utils/logger');
const { checkPermission } = require('../utils/permissions');
const moment = require('moment');
const fs = require('fs').promises;
const path = require('path');
const { createCanvas, loadImage, registerFont } = require('canvas');
const Jimp = require('jimp');
const randomstring = require('randomstring');
const cryptoRandomString = require('crypto-random-string');
const axios = require('axios');
const { getCountry } = require('countries-list');

// Simulated database for user profiles (should be replaced with actual database)
const userProfiles = new Map();
const userGames = new Map();
const marriageData = new Map();
const bankAccounts = new Map();
const userJobs = new Map();
const petData = new Map();
const userAfk = new Map();
const streakData = new Map();
const checkinData = new Map();
const lotteryParticipants = new Set();

// Create temp directory for profile card images
const TEMP_DIR = path.join(process.cwd(), 'temp', 'user');

// Define color themes
const colorThemes = {
    default: { primary: '#3498db', secondary: '#2ecc71', text: '#ffffff', background: '#2c3e50' },
    dark: { primary: '#34495e', secondary: '#7f8c8d', text: '#ecf0f1', background: '#121212' },
    light: { primary: '#bdc3c7', secondary: '#95a5a6', text: '#2c3e50', background: '#ecf0f1' },
    red: { primary: '#e74c3c', secondary: '#c0392b', text: '#ffffff', background: '#2c3e50' },
    green: { primary: '#2ecc71', secondary: '#27ae60', text: '#ffffff', background: '#2c3e50' },
    purple: { primary: '#9b59b6', secondary: '#8e44ad', text: '#ffffff', background: '#2c3e50' },
    orange: { primary: '#e67e22', secondary: '#d35400', text: '#ffffff', background: '#2c3e50' },
    pink: { primary: '#e84393', secondary: '#fd79a8', text: '#ffffff', background: '#2c3e50' },
    teal: { primary: '#1abc9c', secondary: '#16a085', text: '#ffffff', background: '#2c3e50' }
};

// Define job list
const jobsList = [
    { name: 'Developer', income: 500, requirements: { level: 3 } },
    { name: 'Teacher', income: 300, requirements: { level: 2 } },
    { name: 'Doctor', income: 700, requirements: { level: 5 } },
    { name: 'Artist', income: 250, requirements: { level: 1 } },
    { name: 'Engineer', income: 600, requirements: { level: 4 } },
    { name: 'Chef', income: 350, requirements: { level: 2 } },
    { name: 'Police Officer', income: 400, requirements: { level: 3 } },
    { name: 'Entrepreneur', income: 800, requirements: { level: 6 } },
    { name: 'Musician', income: 400, requirements: { level: 3 } },
    { name: 'Scientist', income: 550, requirements: { level: 4 } }
];

// Available pet types
const petTypes = [
    { name: 'Dog', cost: 500, happiness: 10, health: 10, hunger: 5, loyalty: 8 },
    { name: 'Cat', cost: 400, happiness: 8, health: 8, hunger: 3, loyalty: 5 },
    { name: 'Bird', cost: 200, happiness: 6, health: 6, hunger: 2, loyalty: 4 },
    { name: 'Fish', cost: 100, happiness: 4, health: 5, hunger: 1, loyalty: 2 },
    { name: 'Hamster', cost: 150, happiness: 7, health: 5, hunger: 2, loyalty: 4 },
    { name: 'Rabbit', cost: 300, happiness: 8, health: 7, hunger: 4, loyalty: 6 },
    { name: 'Turtle', cost: 250, happiness: 5, health: 9, hunger: 1, loyalty: 7 },
    { name: 'Fox', cost: 800, happiness: 9, health: 7, hunger: 6, loyalty: 5 },
    { name: 'Dragon', cost: 5000, happiness: 15, health: 15, hunger: 10, loyalty: 10 },
    { name: 'Unicorn', cost: 10000, happiness: 20, health: 20, hunger: 8, loyalty: 15 }
];

// Achievement list
const achievementsList = [
    { id: 'register', name: 'New Arrival', description: 'Register a profile' },
    { id: 'level5', name: 'Leveling Up', description: 'Reach level 5' },
    { id: 'level10', name: 'Pro User', description: 'Reach level 10' },
    { id: 'daily7', name: 'Weekly Streak', description: 'Claim daily rewards 7 days in a row' },
    { id: 'daily30', name: 'Monthly Dedication', description: 'Claim daily rewards 30 days in a row' },
    { id: 'rich', name: 'Getting Rich', description: 'Accumulate 10,000 coins' },
    { id: 'millionaire', name: 'Millionaire', description: 'Accumulate 1,000,000 coins' },
    { id: 'married', name: 'Soul Bound', description: 'Get married' },
    { id: 'pet', name: 'Pet Lover', description: 'Adopt a pet' },
    { id: 'job', name: 'Employed', description: 'Get a job' },
    { id: 'bank', name: 'Banker', description: 'Open a bank account' },
    { id: 'deposit', name: 'Saver', description: 'Make a deposit' },
    { id: 'bio', name: 'Identity', description: 'Set a bio' },
    { id: 'lottery', name: 'Gambler', description: 'Participate in a lottery' },
    { id: 'lottery_win', name: 'Lucky Winner', description: 'Win the lottery' }
];

// Level thresholds
const levelThresholds = [0, 100, 300, 600, 1000, 1500, 2100, 2800, 3600, 4500, 5500, 6600, 7800, 9100, 10500, 12000, 13600, 15300, 17100, 19000];

/**
 * Create temp directories if they don't exist
 */
async function initDirectories() {
    try {
        await fs.mkdir(TEMP_DIR, { recursive: true });
        logger.info('User temp directories created');
    } catch (err) {
        logger.error('Failed to create user temp directories:', err);
    }
}

// Initialize directories
initDirectories();

/**
 * Get a user profile or show error message
 * @param {object} sock - WhatsApp socket
 * @param {string} userId - User ID
 * @param {boolean} sendError - Whether to send error message
 * @returns {object|null} User profile or null if not found
 */
async function getUserProfile(sock, userId, sendError = true) {
    const profile = userProfiles.get(userId);
    
    if (!profile && sendError) {
        await sock.sendMessage(userId, {
            text: '*❌ Error:* You need to register first! Use .register to create a profile.'
        });
        return null;
    }
    
    return profile;
}

/**
 * Add achievement to a user
 * @param {object} profile - User profile
 * @param {string} achievementId - Achievement ID
 * @returns {boolean} Whether achievement was added (false if already had)
 */
function addAchievement(profile, achievementId) {
    const achievement = achievementsList.find(a => a.id === achievementId);
    if (!achievement) return false;
    
    if (profile.achievements.includes(achievement.name)) {
        return false;
    }
    
    profile.achievements.push(achievement.name);
    return true;
}

/**
 * Calculate work time remaining (cooldown)
 * @param {object} job - User job data
 * @returns {number} Time remaining in seconds
 */
function calculateWorkCooldown(job) {
    if (!job.lastWork) return 0;
    
    const now = Date.now();
    const cooldown = 3600 * 1000; // 1 hour cooldown
    const remaining = (job.lastWork + cooldown) - now;
    
    return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
}

/**
 * Format time in seconds to readable format
 * @param {number} seconds - Time in seconds
 * @returns {string} Formatted time string
 */
function formatTimeRemaining(seconds) {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
    return `${Math.floor(seconds / 86400)}d ${Math.floor((seconds % 86400) / 3600)}h`;
}

/**
 * Format coins with commas
 * @param {number} amount - Amount of coins
 * @returns {string} Formatted amount
 */
function formatNumber(amount) {
    return amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/**
 * Convert number to Roman numerals
 * @param {number} num - Number to convert
 * @returns {string} Roman numeral
 */
function toRoman(num) {
    const romanNumerals = {
        M: 1000, CM: 900, D: 500, CD: 400, C: 100, XC: 90,
        L: 50, XL: 40, X: 10, IX: 9, V: 5, IV: 4, I: 1
    };
    
    let roman = '';
    for (let key in romanNumerals) {
        while (num >= romanNumerals[key]) {
            roman += key;
            num -= romanNumerals[key];
        }
    }
    return roman;
}

// Create a basic card image
async function createProfileCard(profile, theme = 'default') {
    try {
        const colors = colorThemes[theme] || colorThemes.default;
        const width = 600;
        const height = 300;
        
        // Create canvas
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');
        
        // Draw background
        ctx.fillStyle = colors.background;
        ctx.fillRect(0, 0, width, height);
        
        // Draw header
        ctx.fillStyle = colors.primary;
        ctx.fillRect(0, 0, width, 70);
        
        // Draw user info section
        ctx.fillStyle = colors.secondary;
        ctx.fillRect(20, 90, 560, 190);
        
        // Draw name
        ctx.fillStyle = colors.text;
        ctx.font = 'bold 36px Arial';
        ctx.fillText(profile.name, 30, 45);
        
        // Draw level badge
        ctx.fillStyle = colors.secondary;
        ctx.beginPath();
        ctx.arc(width - 40, 40, 25, 0, 2 * Math.PI);
        ctx.fill();
        
        ctx.fillStyle = colors.text;
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(profile.level, width - 40, 48);
        ctx.textAlign = 'left';
        
        // Draw profile details
        ctx.fillStyle = colors.text;
        ctx.font = '18px Arial';
        
        let y = 120;
        ctx.fillText(`XP: ${profile.xp}/${levelThresholds[profile.level]}`, 40, y); y += 30;
        ctx.fillText(`Coins: ${formatNumber(profile.coins)}`, 40, y); y += 30;
        
        // Draw bio if available
        if (profile.bio) {
            const bioLines = wrapText(ctx, profile.bio, 520, 18);
            for (let i = 0; i < Math.min(bioLines.length, 3); i++) {
                ctx.fillText(bioLines[i], 40, y);
                y += 24;
            }
        }
        
        // Draw registration date
        ctx.font = '12px Arial';
        ctx.fillText(`Registered: ${moment(profile.registeredAt).format('MMM DD, YYYY')}`, 40, y + 20);
        
        // Save image
        const filename = `profile_${Date.now()}.png`;
        const outputPath = path.join(TEMP_DIR, filename);
        
        const buffer = canvas.toBuffer();
        await fs.writeFile(outputPath, buffer);
        
        return outputPath;
    } catch (err) {
        logger.error('Error creating profile card:', err);
        return null;
    }
}

// Text wrapping helper
function wrapText(ctx, text, maxWidth, fontSize) {
    const words = text.split(' ');
    const lines = [];
    let currentLine = words[0];

    for (let i = 1; i < words.length; i++) {
        const word = words[i];
        const width = ctx.measureText(currentLine + " " + word).width;
        if (width < maxWidth) {
            currentLine += " " + word;
        } else {
            lines.push(currentLine);
            currentLine = word;
        }
    }
    lines.push(currentLine);
    return lines;
}

const userCommands = {
    async register(sock, message, args) {
        try {
            const sender = message.key.remoteJid;
            const [name, age] = args;

            if (!name || !age || isNaN(age)) {
                await sock.sendMessage(sender, { 
                    text: '*📝 Registration Usage:*\n.register [name] [age]\n\n*Example:* .register John 25' 
                });
                return;
            }

            if (userProfiles.has(sender)) {
                await sock.sendMessage(sender, { 
                    text: '*❌ Error:* You are already registered!' 
                });
                return;
            }

            const newProfile = {
                name: name,
                age: parseInt(age),
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

            userProfiles.set(sender, newProfile);

            await sock.sendMessage(sender, { 
                text: `*✅ Registration Successful!*\n\n*👤 Name:* ${name}\n*🎯 Age:* ${age}\n*📊 Level:* 1\n*⭐ XP:* 0` 
            });

            logger.info(`New user registered: ${sender}`);
        } catch (err) {
            logger.error('Error in register command:', err);
            await sock.sendMessage(message.key.remoteJid, {
                text: '*❌ Error:* Failed to register. Please try again.'
            });
        }
    },

    async profile(sock, message, args) {
        try {
            const sender = message.key.remoteJid;
            const targetUser = args[0]?.replace(/[^0-9]/g, '') || sender;
            const profile = userProfiles.get(targetUser);

            if (!profile) {
                await sock.sendMessage(sender, { 
                    text: targetUser === sender ? 
                        '*❌ Error:* You are not registered! Use .register to create a profile.' :
                        '*❌ Error:* User not found!'
                });
                return;
            }

            const profileText = `
*📊 User Profile*

*👤 Name:* ${profile.name}
*📈 Level:* ${profile.level}
*⭐ XP:* ${profile.xp}/${levelThresholds[profile.level]}
*💰 Coins:* ${profile.coins}
*🎯 Age:* ${profile.age}
*🏆 Achievements:* ${profile.achievements.length}
*📝 Bio:* ${profile.bio || 'No bio set'}
*👑 Title:* ${profile.customTitle || 'No title set'}

*🕒 Registered:* ${new Date(profile.registeredAt).toLocaleDateString()}`;

            await sock.sendMessage(sender, { text: profileText.trim() });
        } catch (err) {
            logger.error('Error in profile command:', err);
            await sock.sendMessage(message.key.remoteJid, {
                text: '*❌ Error:* Failed to fetch profile. Please try again.'
            });
        }
    },

    async setbio(sock, message, args) {
        try {
            const sender = message.key.remoteJid;
            const profile = userProfiles.get(sender);

            if (!profile) {
                await sock.sendMessage(sender, { 
                    text: '*❌ Error:* You need to register first!' 
                });
                return;
            }

            const bio = args.join(' ');
            if (!bio) {
                await sock.sendMessage(sender, { 
                    text: '*📝 Usage:* .setbio [text]\n\n*Example:* .setbio Hello, I love coding!' 
                });
                return;
            }

            if (bio.length > 100) {
                await sock.sendMessage(sender, { 
                    text: '*❌ Error:* Bio must be less than 100 characters!' 
                });
                return;
            }

            profile.bio = bio;
            await sock.sendMessage(sender, { 
                text: '*✅ Success:* Bio updated successfully!' 
            });
        } catch (err) {
            logger.error('Error in setbio command:', err);
            await sock.sendMessage(message.key.remoteJid, {
                text: '*❌ Error:* Failed to update bio. Please try again.'
            });
        }
    },

    async settitle(sock, sender, args) {
        const profile = userProfiles.get(sender);
        if (!profile) {
            await sock.sendMessage(sender, { text: '❌ You need to register first!' });
            return;
        }

        const title = args.join(' ');
        if (!title) {
            await sock.sendMessage(sender, { text: '👑 Please provide a title' });
            return;
        }

        profile.customTitle = title;
        await sock.sendMessage(sender, { text: '✅ Title updated successfully!' });
    },

    async level(sock, sender) {
        const profile = userProfiles.get(sender);
        if (!profile) {
            await sock.sendMessage(sender, { text: '❌ You need to register first!' });
            return;
        }

        const nextLevel = levelThresholds[profile.level];
        const progress = (profile.xp / nextLevel * 100).toFixed(1);

        const levelText = `
📊 Level Progress
📈 Current Level: ${profile.level}
⭐ XP: ${profile.xp}/${nextLevel}
📏 Progress: ${progress}%

🎯 Next level at: ${nextLevel} XP
        `.trim();

        await sock.sendMessage(sender, { text: levelText });
    },

    async daily(sock, message) {
        try {
            const sender = message.key.remoteJid;
            const profile = userProfiles.get(sender);

            if (!profile) {
                await sock.sendMessage(sender, { 
                    text: '*❌ Error:* You need to register first!' 
                });
                return;
            }

            const now = new Date();
            const lastDaily = profile.lastDaily ? new Date(profile.lastDaily) : null;

            if (lastDaily && now.getDate() === lastDaily.getDate()) {
                const nextReset = new Date(now);
                nextReset.setDate(nextReset.getDate() + 1);
                nextReset.setHours(0, 0, 0, 0);

                const timeLeft = nextReset - now;
                const hoursLeft = Math.floor(timeLeft / (1000 * 60 * 60));
                const minutesLeft = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));

                await sock.sendMessage(sender, { 
                    text: `*⏰ Daily Reward:* Already claimed!\n\n*Next claim in:* ${hoursLeft}h ${minutesLeft}m` 
                });
                return;
            }

            const xpReward = Math.floor(Math.random() * 50) + 50;
            const coinsReward = Math.floor(Math.random() * 100) + 100;

            profile.xp += xpReward;
            profile.coins += coinsReward;
            profile.lastDaily = now.toISOString();

            // Check for level up
            while (profile.xp >= levelThresholds[profile.level]) {
                profile.level++;
            }

            let rewardText = `*🎁 Daily Reward Claimed!*\n\n*⭐ XP:* +${xpReward}\n*💰 Coins:* +${coinsReward}`;

            if (profile.level > 1) {
                rewardText += `\n\n*🎉 Level Up!*\nYou are now level ${profile.level}!`;
            }

            await sock.sendMessage(sender, { text: rewardText });
        } catch (err) {
            logger.error('Error in daily command:', err);
            await sock.sendMessage(message.key.remoteJid, {
                text: '*❌ Error:* Failed to claim daily reward. Please try again.'
            });
        }
    },
    async leaderboard(sock, sender, args) {
        const [type = 'xp'] = args;
        const validTypes = ['xp', 'coins', 'level'];

        if (!validTypes.includes(type)) {
            await sock.sendMessage(sender, { 
                text: `📊 Available leaderboard types: ${validTypes.join(', ')}` 
            });
            return;
        }

        const users = Array.from(userProfiles.entries())
            .map(([id, profile]) => ({
                id,
                name: profile.name,
                value: profile[type]
            }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 10);

        const leaderboardText = `
🏆 ${type.toUpperCase()} Leaderboard
${users.map((user, i) => `${i + 1}. ${user.name}: ${user.value}`).join('\n')}
        `.trim();

        await sock.sendMessage(sender, { text: leaderboardText });
    },

    async achievements(sock, sender) {
        const profile = userProfiles.get(sender);
        if (!profile) {
            await sock.sendMessage(sender, { text: '❌ You need to register first!' });
            return;
        }

        const achievementsText = `
🏆 Achievements
Total: ${profile.achievements.length}

${profile.achievements.map(a => `• ${a}`).join('\n') || 'No achievements yet'}
        `.trim();

        await sock.sendMessage(sender, { text: achievementsText });
    },

    async inventory(sock, sender) {
        const profile = userProfiles.get(sender);
        if (!profile) {
            await sock.sendMessage(sender, { text: '❌ You need to register first!' });
            return;
        }

        const inventoryText = `
🎒 Inventory
Total Items: ${profile.inventory.length}

${profile.inventory.map(item => `• ${item}`).join('\n') || 'Inventory is empty'}
        `.trim();

        await sock.sendMessage(sender, { text: inventoryText });
    },

    async transfer(sock, sender, args) {
        const [target, amount] = args;
        if (!target || !amount || isNaN(amount)) {
            await sock.sendMessage(sender, { 
                text: '💰 Usage: !transfer @user [amount]' 
            });
            return;
        }

        const profile = userProfiles.get(sender);
        const targetProfile = userProfiles.get(target);

        if (!profile || !targetProfile) {
            await sock.sendMessage(sender, { text: '❌ Invalid user!' });
            return;
        }

        const transferAmount = parseInt(amount);
        if (transferAmount <= 0) {
            await sock.sendMessage(sender, { text: '❌ Invalid amount!' });
            return;
        }

        if (profile.coins < transferAmount) {
            await sock.sendMessage(sender, { text: '❌ Insufficient coins!' });
            return;
        }

        profile.coins -= transferAmount;
        targetProfile.coins += transferAmount;

        await sock.sendMessage(sender, {
            text: `✅ Successfully transferred ${transferAmount} coins to ${targetProfile.name}`
        });
    }
};

module.exports = userCommands;