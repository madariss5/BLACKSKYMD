const logger = require('../utils/logger');
const { checkPermission } = require('../utils/permissions');
const moment = require('moment');
const fs = require('fs').promises;
const path = require('path');
const { createCanvas, loadImage, registerFont } = require('canvas');
const Jimp = require('jimp');
const randomstring = require('randomstring');
// Remove crypto-random-string as it's an ESM module and not used in this file
const axios = require('axios');
const { getCountry } = require('countries-list');
const userDatabase = require('../utils/userDatabase');
const levelingSystem = require('../utils/levelingSystem');

// Use the centralized userDatabase instead of separate maps
const { 
    userProfiles, 
    userGames, 
    marriageData, 
    bankAccounts, 
    userJobs, 
    petData, 
    userAfk, 
    streakData, 
    checkinData, 
    lotteryParticipants 
} = userDatabase;

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
    blue: { primary: '#3498db', secondary: '#2980b9', text: '#ffffff', background: '#1a2530' },
    pink: { primary: '#ff79c6', secondary: '#bd93f9', text: '#ffffff', background: '#282a36' },
    gaming: { primary: '#ff3e3e', secondary: '#7289da', text: '#ffffff', background: '#23272a' },
    teal: { primary: '#1abc9c', secondary: '#16a085', text: '#ffffff', background: '#2c3e50' },
    neon: { primary: '#00ff00', secondary: '#ff00ff', text: '#ffffff', background: '#000000' }
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
const { safeSendText, safeSendMessage, safeSendImage, formatJidForLogging } = require('../utils/jidHelper');

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
        await safeSendText(sock, userId, '*❌ Error:* You need to register first! Use .register to create a profile.'
        );
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
    // Define achievements list if not available globally
    const achievementsList = [
        { id: 'first_message', name: 'First Message' },
        { id: 'daily_streak', name: 'Weekly Streak' },
        { id: 'monthly_dedication', name: 'Monthly Dedication' },
        { id: 'level_10', name: 'Level 10 Reached' },
        { id: 'level_50', name: 'Level 50 Reached' },
        { id: 'level_100', name: 'Level 100 Reached' },
        { id: 'rich', name: 'Wealthy' },
        { id: 'social', name: 'Social Butterfly' },
        { id: 'helpful', name: 'Helpful Member' },
        { id: 'collector', name: 'Collector' }
    ];
    
    // Check if achievement exists
    const achievement = achievementsList.find(a => a.id === achievementId);
    if (!achievement) return false;
    
    // Initialize achievements array if it doesn't exist
    profile.achievements = profile.achievements || [];
    
    // Check if user already has this achievement
    if (profile.achievements.includes(achievement.name)) {
        return false;
    }
    
    // Add achievement
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

// Create a simpler profile card image without the profile picture
async function createProfileCard(profile, theme = null, jid = null) {
    try {
        // Use provided theme, user's preferred theme, or default
        const selectedTheme = theme || profile.theme || 'default';
        const colors = colorThemes[selectedTheme] || colorThemes.default;
        const width = 800;
        const height = 400;
        
        // Create canvas
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');
        
        // Draw background
        ctx.fillStyle = colors.background;
        ctx.fillRect(0, 0, width, height);
        
        // Create a gradient for the header
        const gradient = ctx.createLinearGradient(0, 0, width, 0);
        gradient.addColorStop(0, colors.primary);
        gradient.addColorStop(1, colors.secondary);
        
        // Draw header with gradient
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, 100);
        
        // Draw decorative elements (sidebar)
        ctx.fillStyle = colors.primary;
        ctx.globalAlpha = 0.3;
        ctx.fillRect(0, 100, 30, height - 100);
        ctx.globalAlpha = 1.0;
        
        // Save context state for further drawing
        ctx.save();
        
        // Draw name
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 48px Arial';
        ctx.fillText(profile.name, 50, 60);
        
        // Draw user title if available
        if (profile.customTitle) {
            ctx.font = 'italic 24px Arial';
            ctx.fillText(profile.customTitle, 50, 90);
        }
        
        // Draw user info section - right side panel
        ctx.fillStyle = colors.secondary;
        ctx.globalAlpha = 0.7;
        ctx.fillRect(220, 120, 560, 260);
        ctx.globalAlpha = 1.0;
        
        // Draw profile details
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 24px Arial';
        
        let y = 160;
        
        // Stats section
        ctx.fillText(`📈 Level: ${profile.level}`, 240, y); y += 40;
        
        // Calculate level progress
        const currentLevelXP = profile.level > 1 ? levelThresholds[profile.level - 1] : 0;
        const nextLevelXP = levelThresholds[profile.level];
        const progressXP = profile.xp - currentLevelXP;
        const totalNeededXP = nextLevelXP - currentLevelXP;
        const progressPercent = Math.min(100, Math.floor((progressXP / totalNeededXP) * 100));
        
        // Display XP
        ctx.fillText(`⭐ XP: ${profile.xp}/${nextLevelXP}`, 240, y); y += 40;
        
        // Draw progress bar
        const progressBarX = 240;
        const progressBarY = y;
        const progressBarWidth = 500;
        const progressBarHeight = 20;
        
        // Progress bar background
        ctx.fillStyle = '#333333';
        ctx.fillRect(progressBarX, progressBarY, progressBarWidth, progressBarHeight);
        
        // Progress bar fill
        ctx.fillStyle = colors.primary;
        ctx.fillRect(progressBarX, progressBarY, progressBarWidth * (progressPercent / 100), progressBarHeight);
        
        // Progress text
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`${progressPercent}%`, progressBarX + progressBarWidth/2, progressBarY + 15);
        ctx.textAlign = 'left';
        
        y += 40;
        
        // Other stats
        ctx.font = '24px Arial';
        ctx.fillText(`💰 Coins: ${formatNumber(profile.coins)}`, 240, y); y += 40;
        ctx.fillText(`🎯 Age: ${profile.age}`, 240, y); y += 40;
        ctx.fillText(`🏆 Achievements: ${profile.achievements?.length || 0}`, 240, y); y += 40;
        
        // Draw bio if available
        if (profile.bio) {
            y = 340;
            ctx.fillStyle = '#FFFFFF';
            ctx.font = 'italic 18px Arial';
            ctx.fillText(`"${wrapText(ctx, profile.bio, 520, 18)[0]}"`, 240, y);
        }
        
        // Draw registration date
        ctx.font = '16px Arial';
        ctx.fillText(`Registered: ${moment(profile.registeredAt).format('MMM DD, YYYY')}`, 20, height - 20);
        
        // Save image
        const filename = `profile_${Date.now()}.png`;
        const outputPath = path.join(TEMP_DIR, filename);
        
        const buffer = canvas.toBuffer('image/png');
        await fs.writeFile(outputPath, buffer);
        
        return outputPath;
    } catch (err) {
        logger.error(`Error creating profile card${jid ? ` for ${formatJidForLogging(jid)}` : ''}:`, err);
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
            
            // Extract name and age from arguments
            const name = args.slice(0, -1).join(' ') || args[0];
            const age = args[args.length - 1];

            if (!name || !age || isNaN(age)) {
                await safeSendText(sock, sender, '*📝 Registration Usage:*\n.register [name] [age]\n\n*Examples:*\n.register John 25\n.register John Doe 25' 
                );
                return;
            }

            if (userProfiles.has(sender)) {
                await safeSendText(sock, sender, '*❌ Error:* You are already registered!' 
                );
                return;
            }

            // Validate age
            const ageInt = parseInt(age);
            if (ageInt < 13 || ageInt > 120) {
                await safeSendText(sock, sender, '*❌ Error:* Please enter a valid age between 13 and 120.' 
                );
                return;
            }

            // Create new user profile with achievements
            const newProfile = {
                name: name,
                age: ageInt,
                xp: 0,
                level: 1,
                coins: 100, // Starting coins
                bio: '',
                registeredAt: new Date().toISOString(),
                lastDaily: null,
                inventory: [],
                achievements: ['New Arrival'], // First achievement for registering
                customTitle: '',
                warnings: 0,
                profilePic: null,
                theme: 'default' // Default theme
            };

            // Add to user database
            userDatabase.updateUserProfile(sender, newProfile);

            // Create welcome message
            const welcomeMsg = `*✅ Registration Successful!*\n
*👤 Name:* ${name}
*🎯 Age:* ${ageInt}
*📊 Level:* 1
*⭐ XP:* 0/100
*💰 Coins:* 100

*🏆 Achievement Unlocked:* New Arrival
*🎮 Commands to try:*
• .profile - See your profile
• .daily - Claim daily rewards
• .level - Check your level progress`;

            await safeSendText(sock, sender, welcomeMsg
            );
            
            // Generate and send a profile card
            try {
                const cardPath = await createProfileCard(newProfile, null, sender);
                if (cardPath) {
                    await safeSendMessage(sock, sender, {
                        image: { url: cardPath },
                        caption: '🎉 Here\'s your new profile card!'
                    });
                }
            } catch (err) {
                logger.error(`Error generating new profile card for ${formatJidForLogging(sender)}:`, err);
                // Continue even if card generation fails
            }

            logger.info(`New user registered: ${formatJidForLogging(sender)} (${name}, ${ageInt})`);
        } catch (err) {
            logger.error(`Error in register command for ${formatJidForLogging(message.key.remoteJid)}:`, err);
            await safeSendText(sock, message.key.remoteJid, '*❌ Error:* Failed to register. Please try again.'
            );
        }
    },

    async profile(sock, message, args) {
        try {
            const sender = message.key.remoteJid;
            const targetUser = args[0]?.replace(/[^0-9]/g, '') || sender;
            const targetJid = targetUser.includes('@') ? targetUser : `${targetUser}@s.whatsapp.net`;
            
            // Send initial feedback
            await safeSendText(sock, sender, '🔍 Fetching profile information...');
            
            // Get the profile with defensive error handling
            let profile = null;
            try {
                profile = userDatabase.getUserProfile(targetJid);
            } catch (profileErr) {
                logger.error(`Error getting user profile for ${formatJidForLogging(targetJid)}:`, profileErr);
                // Continue with null profile to trigger the not found error message
            }

            if (!profile) {
                await safeSendText(sock, sender, targetUser === sender ? 
                        '*❌ Error:* You are not registered! Use .register [name] [age] to create a profile.' :
                        '*❌ Error:* User not found!'
                );
                return;
            }

            // Ensure profile has required fields with sensible defaults
            profile.achievements = profile.achievements || [];
            profile.coins = profile.coins || 0;
            profile.level = profile.level || 1;
            profile.xp = profile.xp || 0;
            profile.bio = profile.bio || '';
            profile.customTitle = profile.customTitle || '';
            profile.theme = profile.theme || 'default';
            profile.registeredAt = profile.registeredAt || new Date().toISOString();
            
            // Try to fetch profile picture from WhatsApp if not already set
            if (!profile.profilePic || !(await fs.access(profile.profilePic).then(() => true).catch(() => false))) {
                try {
                    await fs.mkdir(TEMP_DIR, { recursive: true });
                    logger.info(`Attempting to fetch WhatsApp profile picture for ${formatJidForLogging(targetJid)}`);
                    
                    // Try to get profile picture URL from WhatsApp
                    const ppUrl = await sock.profilePictureUrl(targetJid, 'image').catch(() => null);
                    
                    if (ppUrl) {
                        // Download profile picture
                        const profilePicPath = path.join(TEMP_DIR, `profile_${targetJid.split('@')[0]}_${Date.now()}.jpg`);
                        
                        // Use axios to download the image
                        const axios = require('axios');
                        const response = await axios.get(ppUrl, { responseType: 'arraybuffer' });
                        await fs.writeFile(profilePicPath, Buffer.from(response.data));
                        
                        // Update the profile with the new picture path
                        profile.profilePic = profilePicPath;
                        userDatabase.updateUserProfile(targetJid, { profilePic: profilePicPath });
                        logger.info(`Successfully fetched and saved profile picture for ${formatJidForLogging(targetJid)}`);
                    } else {
                        logger.info(`No profile picture available for ${formatJidForLogging(targetJid)}`);
                    }
                } catch (ppErr) {
                    logger.error(`Error fetching profile picture for ${formatJidForLogging(targetJid)}:`, ppErr);
                    // Continue without profile picture
                }
            }

            // Get level progress with error handling
            let progress = { progressBar: '░░░░░░░░░░░░░░░░░░░░ 0%', requiredXP: 100 };
            try {
                progress = levelingSystem.getLevelProgress(targetUser);
            } catch (progressErr) {
                logger.error(`Error getting level progress for ${formatJidForLogging(targetUser)}:`, progressErr);
                // Continue with default progress
            }
            
            // Calculate rank if available
            let rankText = '';
            try {
                const leaderboard = levelingSystem.getLeaderboard(100);
                const rank = leaderboard.findIndex(u => u.id === targetUser) + 1;
                rankText = rank > 0 ? `*🏆 Rank:* #${rank}` : '';
            } catch (rankErr) {
                logger.error(`Error calculating rank for ${formatJidForLogging(targetUser)}:`, rankErr);
                // Continue without rank information
            }

            // Create detailed profile text
            const profileText = `
*📊 User Profile*

*👤 Name:* ${profile.name}
*📈 Level:* ${profile.level}
*⭐ XP:* ${profile.xp}/${progress.requiredXP}
*💰 Coins:* ${formatNumber(profile.coins)}
*🎯 Age:* ${profile.age}
${rankText}
*🏆 Achievements:* ${profile.achievements.length}
*📝 Bio:* ${profile.bio || 'No bio set'}
*👑 Title:* ${profile.customTitle || 'No title set'}
*🎨 Theme:* ${profile.theme || 'default'}

*Progress:* ${progress.progressBar}
*🕒 Registered:* ${new Date(profile.registeredAt).toLocaleDateString()}`;

            // Send profile picture first if available
            if (profile.profilePic && await fs.access(profile.profilePic).then(() => true).catch(() => false)) {
                try {
                    // Read profile picture as buffer
                    const profilePicBuffer = await fs.readFile(profile.profilePic);
                    
                    // Send profile picture with caption
                    await safeSendMessage(sock, sender, {
                        image: profilePicBuffer,
                        caption: `*👤 ${profile.name}'s Profile Picture*`
                    });
                    logger.info(`Successfully sent profile picture for ${formatJidForLogging(targetJid)}`);
                    
                    // Short delay to ensure messages are sent in order
                    await new Promise(resolve => setTimeout(resolve, 500));
                } catch (picErr) {
                    logger.error(`Error sending profile picture for ${formatJidForLogging(targetJid)}:`, picErr);
                    // Continue even if sending profile picture fails
                }
            }
            
            // Send profile text
            await safeSendText(sock, sender, profileText.trim());
            
            // Generate and send profile card with robust error handling
            try {
                // Generate a custom profile card
                let cardPath = null;
                try {
                    cardPath = await createProfileCard(profile, null, sender);
                } catch (cardErr) {
                    logger.error(`Error creating profile card for ${formatJidForLogging(targetUser)}:`, cardErr);
                    // Will try fallback
                }
                
                // If that fails, fall back to level card
                if (!cardPath) {
                    try {
                        cardPath = await levelingSystem.generateLevelCard(targetUser, profile);
                    } catch (levelCardErr) {
                        logger.error(`Error generating level card for ${formatJidForLogging(targetUser)}:`, levelCardErr);
                        // Both card methods failed
                    }
                }
                
                if (cardPath) {
                    const caption = targetUser === sender ? 
                        '🎭 Your Profile Card' : 
                        `🎭 Profile Card: ${profile.name}`;
                    
                    // Check if file exists and is readable
                    const fileExists = await fs.access(cardPath).then(() => true).catch(() => false);
                    
                    if (fileExists) {
                        try {
                            // Send as buffer for better reliability
                            const imageBuffer = await fs.readFile(cardPath);
                            
                            await safeSendMessage(sock, sender, {
                                image: imageBuffer,
                                caption: caption
                            });
                            logger.info(`Successfully sent profile card to ${formatJidForLogging(sender)}`);
                        } catch (fileErr) {
                            logger.error(`Error reading profile card file: ${fileErr.message}`);
                            throw fileErr; // Will be caught by outer catch and send fallback
                        }
                    } else {
                        logger.error(`Profile card file not accessible: ${cardPath}`);
                        throw new Error('Card file not accessible'); // Will be caught by outer catch
                    }
                } else {
                    // Inform the user that profile card generation failed but profile info was displayed
                    await safeSendText(sock, sender, 
                        '*Note:* Unable to generate profile card image, but your profile information is displayed above.'
                    );
                }
            } catch (err) {
                logger.error(`Error in profile card generation for ${formatJidForLogging(sender)}:`, err);
                // Continue execution even if card generation fails
                await safeSendText(sock, sender, 
                    '*Note:* Unable to generate profile card image, but your profile information is displayed above.'
                );
            }
        } catch (err) {
            logger.error(`Error in profile command for ${formatJidForLogging(message.key.remoteJid)}:`, err);
            await safeSendText(sock, message.key.remoteJid, 
                '*❌ Error:* Failed to fetch profile. Please try again.\n\n' +
                'If this error persists, please try registering with .register [name] [age]'
            );
        }
    },

    async setbio(sock, message, args) {
        try {
            const sender = message.key.remoteJid;
            const profile = userProfiles.get(sender);

            if (!profile) {
                await safeSendText(sock, sender, '*❌ Error:* You need to register first!' 
                );
                return;
            }

            const bio = args.join(' ');
            if (!bio) {
                await safeSendText(sock, sender, '*📝 Usage:* .setbio [text]\n\n*Example:* .setbio Hello, I love coding!' 
                );
                return;
            }

            if (bio.length > 100) {
                await safeSendText(sock, sender, '*❌ Error:* Bio must be less than 100 characters!' 
                );
                return;
            }

            profile.bio = bio;
            await safeSendText(sock, sender, '*✅ Success:* Bio updated successfully!' 
            );
        } catch (err) {
            logger.error(`Error in setbio command for ${formatJidForLogging(message.key.remoteJid)}:`, err);
            await safeSendText(sock, message.key.remoteJid, '*❌ Error:* Failed to update bio. Please try again.'
            );
        }
    },

    async settitle(sock, sender, args) {
        const profile = userProfiles.get(sender);
        if (!profile) {
            await safeSendText(sock, sender, '❌ You need to register first!' );
            return;
        }

        const title = args.join(' ');
        if (!title) {
            await safeSendText(sock, sender, '👑 Please provide a title' );
            return;
        }

        profile.customTitle = title;
        await safeSendText(sock, sender, '✅ Title updated successfully!' );
    },
    
    async settheme(sock, message, args) {
        try {
            const sender = message.key.remoteJid;
            const profile = userDatabase.getUserProfile(sender);
            
            if (!profile) {
                await safeSendText(sock, sender, '*❌ Error:* You need to register first! Use .register [name] [age]' 
                );
                return;
            }
            
            const [theme] = args;
            
            // If no theme provided, list available themes
            if (!theme) {
                const availableThemes = Object.keys(colorThemes).join(', ');
                await safeSendMessage(sock, sender, { 
                    text: `*🎨 Available Themes:*\n${availableThemes}\n\n*Usage:* .settheme [theme]\n*Example:* .settheme blue` 
                });
                return;
            }
            
            // Check if theme exists
            if (!colorThemes[theme]) {
                const availableThemes = Object.keys(colorThemes).join(', ');
                await safeSendMessage(sock, sender, { 
                    text: `*❌ Error:* Invalid theme!\n\n*Available Themes:*\n${availableThemes}` 
                });
                return;
            }
            
            // Update user profile
            profile.theme = theme;
            userDatabase.updateUserProfile(sender, { theme: theme });
            
            // Send success message
            await safeSendMessage(sock, sender, { 
                text: `*✅ Success:* Profile theme set to *${theme}*!` 
            });
            
            // Generate and send a preview of the profile card with the new theme
            try {
                const cardPath = await createProfileCard(profile, theme, sender);
                if (cardPath && await fs.access(cardPath).then(() => true).catch(() => false)) {
                    try {
                        // Read card as buffer for better quality
                        const cardBuffer = await fs.readFile(cardPath);
                        
                        await safeSendMessage(sock, sender, {
                            image: cardBuffer,
                            caption: `🎨 Here's a preview of your profile card with the *${theme}* theme!`
                        });
                    } catch (cardErr) {
                        logger.error(`Error reading theme preview card: ${cardErr.message}`);
                        // Continue without preview
                    }
                }
            } catch (err) {
                logger.error(`Error generating theme preview for ${formatJidForLogging(sender)}:`, err);
                // Continue execution even if preview generation fails
            }
        } catch (err) {
            logger.error(`Error in settheme command for ${formatJidForLogging(message.key.remoteJid)}:`, err);
            await safeSendText(sock, message.key.remoteJid, '*❌ Error:* Failed to set theme. Please try again.'
            );
        }
    },
    
    async setprofilepic(sock, message, args) {
        try {
            const sender = message.key.remoteJid;
            const profile = userDatabase.getUserProfile(sender);
            
            if (!profile) {
                await safeSendText(sock, sender, '*❌ Error:* You need to register first! Use .register [name] [age]' 
                );
                return;
            }
            
            // Check if the message contains an image
            const quoted = message.message.imageMessage || 
                           message.message.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage;
            
            if (!quoted) {
                await safeSendText(sock, sender, '*📝 Usage:* Send or reply to an image with .setprofilepic\n\n*Example:* Reply to an image with .setprofilepic' 
                );
                return;
            }
            
            try {
                // Ensure temp directory exists
                await fs.mkdir(TEMP_DIR, { recursive: true });
                
                // Download image
                const media = await sock.downloadAndSaveMediaMessage(quoted, path.join(TEMP_DIR, `profile_pic_${sender.split('@')[0]}`));
                
                // Update user profile
                profile.profilePic = media;
                userDatabase.updateUserProfile(sender, { profilePic: media });
                
                // Send success message
                await safeSendText(sock, sender, '*✅ Success:* Profile picture updated successfully!' 
                );
                
                // Generate and send a new profile card with the picture
                try {
                    const cardPath = await createProfileCard(profile, null, sender);
                    if (cardPath && await fs.access(cardPath).then(() => true).catch(() => false)) {
                        try {
                            // Read card as buffer for better quality
                            const cardBuffer = await fs.readFile(cardPath);
                            
                            await safeSendMessage(sock, sender, {
                                image: cardBuffer,
                                caption: '🎭 Here\'s your updated profile card!'
                            });
                        } catch (cardErr) {
                            logger.error(`Error reading profile card in setprofilepic: ${cardErr.message}`);
                            // Continue without preview if there's an error
                        }
                    }
                } catch (err) {
                    logger.error(`Error generating profile card for ${formatJidForLogging(sender)}:`, err);
                    // Continue execution even if card generation fails
                }
                
            } catch (err) {
                logger.error(`Error downloading profile picture for ${formatJidForLogging(sender)}:`, err);
                await safeSendText(sock, sender, '*❌ Error:* Failed to download and save profile picture. Please try again.' 
                );
            }
        } catch (err) {
            logger.error(`Error in setprofilepic command for ${formatJidForLogging(message.key.remoteJid)}:`, err);
            await safeSendText(sock, message.key.remoteJid, '*❌ Error:* Failed to update profile picture. Please try again.'
            );
        }
    },

    async level(sock, sender) {
        try {
            // Use our userDatabase and levelingSystem
            const profile = userDatabase.getUserProfile(sender);
            if (!profile) {
                await safeSendText(sock, sender, '❌ You need to register first! Use .register to create a profile.' );
                return;
            }

            const progress = levelingSystem.getLevelProgress(sender);
            
            // Create fancy level information text
            const levelText = `
*📊 Level Information*

📈 Current Level: ${progress.currentLevel}
⭐ Current XP: ${progress.currentXP}
🎯 Next level at: ${progress.requiredXP} XP
📉 Progress: ${progress.progressBar}
            `.trim();

            await safeSendText(sock, sender, levelText );
            
            // Generate and send level card image
            try {
                // Use the new buffer cache method
                const cardResult = await levelingSystem.getLevelCardBuffer(sender, profile);
                if (cardResult && cardResult.buffer) {
                    try {
                        await safeSendMessage(sock, sender, {
                            image: cardResult.buffer,
                            caption: `🏆 Your Level ${progress.currentLevel} Status Card`
                        });
                    } catch (cardErr) {
                        logger.error(`Error sending level card buffer: ${cardErr.message}`);
                        // If buffer fails, try URL as fallback
                        if (cardResult.path && await fs.access(cardResult.path).then(() => true).catch(() => false)) {
                            await safeSendMessage(sock, sender, {
                                image: { url: cardResult.path },
                                caption: `🏆 Your Level ${progress.currentLevel} Status Card`
                            });
                        }
                    }
                }
            } catch (err) {
                logger.error(`Error generating level card in level command for ${formatJidForLogging(sender)}:`, err);
                // Continue execution even if card generation fails
            }
        } catch (err) {
            logger.error(`Error in level command for ${formatJidForLogging(sender)}:`, err);
            await safeSendText(sock, sender, '❌ Error fetching level information.' );
        }
    },

    async daily(sock, message) {
        try {
            const sender = message.key.remoteJid;
            const profile = userDatabase.getUserProfile(sender);

            if (!profile) {
                await safeSendText(sock, sender, '*❌ Error:* You need to register first! Use .register to create a profile.' 
                );
                return;
            }

            const now = new Date();
            const lastDaily = profile.lastDaily ? new Date(profile.lastDaily) : null;

            // Check if already claimed today
            if (lastDaily && now.getDate() === lastDaily.getDate() && 
                now.getMonth() === lastDaily.getMonth() && 
                now.getFullYear() === lastDaily.getFullYear()) {
                
                const nextReset = new Date(now);
                nextReset.setDate(nextReset.getDate() + 1);
                nextReset.setHours(0, 0, 0, 0);

                const timeLeft = nextReset - now;
                const hoursLeft = Math.floor(timeLeft / (1000 * 60 * 60));
                const minutesLeft = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));

                await safeSendMessage(sock, sender, { 
                    text: `*⏰ Daily Reward:* Already claimed!\n\n*Next claim in:* ${hoursLeft}h ${minutesLeft}m` 
                });
                return;
            }

            // Calculate streak (consecutive days)
            let streak = profile.dailyStreak || 0;
            
            if (lastDaily) {
                const yesterday = new Date(now);
                yesterday.setDate(yesterday.getDate() - 1);
                
                // Check if last claim was yesterday
                if (lastDaily.getDate() === yesterday.getDate() && 
                    lastDaily.getMonth() === yesterday.getMonth() && 
                    lastDaily.getFullYear() === yesterday.getFullYear()) {
                    streak++;
                } else {
                    streak = 1; // Reset streak if not consecutive
                }
            } else {
                streak = 1; // First time claiming
            }
            
            // Store the updated streak
            profile.dailyStreak = streak;
            
            // Calculate rewards - more rewards for longer streaks
            const baseXP = 100;
            const baseCoins = 100;
            const streakMultiplier = Math.min(2, 1 + (streak * 0.1)); // Max 2x multiplier for 10+ day streak
            
            const xpReward = Math.floor((Math.random() * 50 + baseXP) * streakMultiplier);
            const coinsReward = Math.floor((Math.random() * 100 + baseCoins) * streakMultiplier);

            // Update user profile
            profile.coins += coinsReward;
            profile.lastDaily = now.toISOString();
            userDatabase.updateUserProfile(sender, { 
                coins: profile.coins, 
                lastDaily: profile.lastDaily,
                dailyStreak: profile.dailyStreak
            });

            // Add XP and check for level up
            const levelUpData = levelingSystem.addXP(sender, 'daily');
            
            // Create reward message
            let rewardText = `*🎁 Daily Reward Claimed!*\n\n*⭐ XP:* +${xpReward}\n*💰 Coins:* +${coinsReward}\n*📅 Streak:* ${streak} day${streak !== 1 ? 's' : ''}`;

            // Add streak bonus info if applicable
            if (streak > 1) {
                const bonusPercent = Math.floor((streakMultiplier - 1) * 100);
                rewardText += `\n*🔥 Streak Bonus:* +${bonusPercent}%`;
            }
            
            // Add level up info if leveled up
            if (levelUpData) {
                rewardText += `\n\n*🎉 Level Up!*\nYou are now level ${levelUpData.newLevel}!`;
            }

            await safeSendText(sock, sender, rewardText );
            
            // Award achievements for streaks
            if (streak >= 7) {
                profile.achievements = profile.achievements || [];
                if (!profile.achievements.includes('Weekly Streak')) {
                    profile.achievements.push('Weekly Streak');
                    userDatabase.updateUserProfile(sender, { achievements: profile.achievements });
                    
                    await safeSendText(sock, sender, `*🏆 Achievement Unlocked:* Weekly Streak\n\nYou've claimed daily rewards for 7 days in a row!` 
                    );
                }
            }
            
            if (streak >= 30) {
                profile.achievements = profile.achievements || [];
                if (!profile.achievements.includes('Monthly Dedication')) {
                    profile.achievements.push('Monthly Dedication');
                    userDatabase.updateUserProfile(sender, { achievements: profile.achievements });
                    
                    await safeSendText(sock, sender, `*🏆 Achievement Unlocked:* Monthly Dedication\n\nYou've claimed daily rewards for 30 days in a row!` 
                    );
                }
            }
        } catch (err) {
            logger.error(`Error in daily command for ${formatJidForLogging(message.key.remoteJid)}:`, err);
            await safeSendText(sock, message.key.remoteJid, '*❌ Error:* Failed to claim daily reward. Please try again.'
            );
        }
    },
    async leaderboard(sock, sender, args) {
        try {
            const [type = 'xp'] = args;
            const validTypes = ['xp', 'coins', 'level'];

            if (!validTypes.includes(type)) {
                await safeSendMessage(sock, sender, { 
                    text: `*📊 Available Leaderboard Types:*\n${validTypes.join(', ')}` 
                });
                return;
            }

            // Use the leveling system's leaderboard function for XP leaderboard
            let users;
            
            if (type === 'xp') {
                users = levelingSystem.getLeaderboard(10);
            } else {
                // For other types, use the user database
                users = Array.from(userProfiles.entries())
                    .map(([id, profile]) => ({
                        id,
                        name: profile.name || 'User',
                        value: profile[type] || 0
                    }))
                    .sort((a, b) => b.value - a.value)
                    .slice(0, 10);
            }

            // Format the leaderboard nicely
            const leaderboardText = `
*🏆 ${type.toUpperCase()} Leaderboard*

${users.map((user, i) => `${i + 1}. *${user.name}*: ${formatNumber(user.value)} ${type === 'xp' ? 'XP' : type === 'coins' ? '💰' : '📊'}`).join('\n')}
            `.trim();

            await safeSendText(sock, sender, leaderboardText );
            
            // Send top user card if it's XP leaderboard
            if (type === 'xp' && users.length > 0) {
                try {
                    const topUser = users[0];
                    const topUserProfile = userDatabase.getUserProfile(topUser.id);
                    
                    if (topUserProfile) {
                        // Use the new buffer cache method
                        const cardResult = await levelingSystem.getLevelCardBuffer(topUser.id, topUserProfile);
                        if (cardResult && cardResult.buffer) {
                            try {
                                await safeSendMessage(sock, sender, {
                                    image: cardResult.buffer,
                                    caption: `👑 Top user: ${topUser.name} (Level ${topUserProfile.level || 1})`
                                });
                            } catch (cardErr) {
                                logger.error(`Error sending leaderboard card buffer: ${cardErr.message}`);
                                // If buffer fails, try URL as fallback
                                if (cardResult.path && await fs.access(cardResult.path).then(() => true).catch(() => false)) {
                                    await safeSendMessage(sock, sender, {
                                        image: { url: cardResult.path },
                                        caption: `👑 Top user: ${topUser.name} (Level ${topUserProfile.level || 1})`
                                    });
                                }
                            }
                        }
                    }
                } catch (err) {
                    logger.error(`Error generating top user card for ${formatJidForLogging(sender)}:`, err);
                    // Continue execution even if card generation fails
                }
            }
        } catch (err) {
            logger.error(`Error in leaderboard command for ${formatJidForLogging(sender)}:`, err);
            await safeSendText(sock, sender, '❌ Error fetching leaderboard data. Please try again.' 
            );
        }
    },

    async achievements(sock, sender) {
        const profile = userProfiles.get(sender);
        if (!profile) {
            await safeSendText(sock, sender, '❌ You need to register first!' );
            return;
        }

        const achievementsText = `
🏆 Achievements
Total: ${profile.achievements.length}

${profile.achievements.map(a => `• ${a}`).join('\n') || 'No achievements yet'}
        `.trim();

        await safeSendText(sock, sender, achievementsText );
    },

    async inventory(sock, sender) {
        const profile = userProfiles.get(sender);
        if (!profile) {
            await safeSendText(sock, sender, '❌ You need to register first!' );
            return;
        }

        const inventoryText = `
🎒 Inventory
Total Items: ${profile.inventory.length}

${profile.inventory.map(item => `• ${item}`).join('\n') || 'Inventory is empty'}
        `.trim();

        await safeSendText(sock, sender, inventoryText );
    },

    async transfer(sock, sender, args) {
        const [target, amount] = args;
        if (!target || !amount || isNaN(amount)) {
            await safeSendText(sock, sender, '💰 Usage: !transfer @user [amount]' 
            );
            return;
        }

        const profile = userProfiles.get(sender);
        const targetProfile = userProfiles.get(target);

        if (!profile || !targetProfile) {
            await safeSendText(sock, sender, '❌ Invalid user!' );
            return;
        }

        const transferAmount = parseInt(amount);
        if (transferAmount <= 0) {
            await safeSendText(sock, sender, '❌ Invalid amount!' );
            return;
        }

        if (profile.coins < transferAmount) {
            await safeSendText(sock, sender, '❌ Insufficient coins!' );
            return;
        }

        profile.coins -= transferAmount;
        targetProfile.coins += transferAmount;

        await safeSendMessage(sock, sender, {
            text: `✅ Successfully transferred ${transferAmount} coins to ${targetProfile.name}`
        });
    }
};

// Export the commands object directly to ensure it's accessible
module.exports = {
    commands: userCommands,
    category: 'user',
    async init() {
        try {
            logger.info('Initializing user command handler...');
            await initDirectories();
            return true;
        } catch (err) {
            logger.error('Failed to initialize user command handler:', err);
            return false;
        }
    }
};