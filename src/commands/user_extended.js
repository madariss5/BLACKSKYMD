/**
 * Extended User Commands for WhatsApp Bot
 * 
 * Inspired by popular WhatsApp MD bots' features
 */

const logger = require('../utils/logger');
const { checkPermission } = require('../utils/permissions');
const moment = require('moment');
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const userDatabase = require('../utils/userDatabase');

// Access centralized user data
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

// Create necessary directories
const TEMP_DIR = path.join(process.cwd(), 'temp', 'user_extended');

/**
 * Create temp directories if they don't exist
 */
async function initDirectories() {
    try {
        await fs.mkdir(TEMP_DIR, { recursive: true });
        logger.info('User extended temp directories created');
    } catch (err) {
        logger.error('Failed to create user extended temp directories:', err);
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
 * Format coins with commas
 * @param {number} amount - Amount of coins
 * @returns {string} Formatted amount
 */
function formatNumber(amount) {
    return amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
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
 * Add achievement to a user
 * @param {object} profile - User profile
 * @param {string} achievementId - Achievement ID
 * @returns {boolean} Whether achievement was added (false if already had)
 */
function addAchievement(profile, achievementId) {
    // Achievement list should be imported from userDatabase in a real implementation
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
        { id: 'lottery_win', name: 'Lucky Winner', description: 'Win the lottery' },
        // New achievements
        { id: 'crime', name: 'Criminal', description: 'Commit your first crime' },
        { id: 'investor', name: 'Investor', description: 'Make your first investment' },
        { id: 'crafting', name: 'Craftsman', description: 'Craft your first item' },
        { id: 'fishing', name: 'Fisherman', description: 'Catch your first fish' },
        { id: 'mining', name: 'Miner', description: 'Mine your first resource' }
    ];

    const achievement = achievementsList.find(a => a.id === achievementId);
    if (!achievement) return false;
    
    if (!profile.achievements) {
        profile.achievements = [];
    }
    
    if (profile.achievements.includes(achievement.name)) {
        return false;
    }
    
    profile.achievements.push(achievement.name);
    return true;
}

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
    { name: 'Scientist', income: 550, requirements: { level: 4 } },
    // New jobs
    { name: 'Farmer', income: 280, requirements: { level: 1 } },
    { name: 'Fisherman', income: 320, requirements: { level: 2 } },
    { name: 'Miner', income: 450, requirements: { level: 3 } },
    { name: 'Lawyer', income: 650, requirements: { level: 5 } },
    { name: 'Pilot', income: 750, requirements: { level: 6 } }
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
    { name: 'Unicorn', cost: 10000, happiness: 20, health: 20, hunger: 8, loyalty: 15 },
    // New pets
    { name: 'Snake', cost: 600, happiness: 6, health: 7, hunger: 3, loyalty: 4 },
    { name: 'Lion', cost: 2000, happiness: 12, health: 12, hunger: 8, loyalty: 7 },
    { name: 'Tiger', cost: 2500, happiness: 13, health: 13, hunger: 9, loyalty: 8 },
    { name: 'Bear', cost: 3000, happiness: 14, health: 14, hunger: 10, loyalty: 9 },
    { name: 'Panda', cost: 1500, happiness: 10, health: 10, hunger: 7, loyalty: 10 }
];

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

module.exports = {
    // 1. Economy System - Crime and Work
    async crime(sock, sender) {
        const profile = await getUserProfile(sock, sender);
        if (!profile) return;
        
        // Check cooldown (3 hours)
        const lastCrime = profile.lastCrime || 0;
        const cooldown = 3 * 60 * 60 * 1000; // 3 hours in ms
        
        if (Date.now() - lastCrime < cooldown) {
            const timeLeft = Math.ceil((lastCrime + cooldown - Date.now()) / (1000 * 60 * 60));
            await sock.sendMessage(sender, {
                text: `*⏳ Cooldown:* The police are still looking for you! Try again in ${timeLeft} hours.`
            });
            return;
        }
        
        // Crime success rate based on level (40% + 2% per level, max 80%)
        const successRate = Math.min(40 + (profile.level * 2), 80);
        const success = Math.random() * 100 <= successRate;
        
        // Crime rewards and penalties
        const baseReward = 300;
        const levelBonus = profile.level * 30;
        const maxReward = baseReward + levelBonus;
        
        // Random crime amount with variation
        const rewardVariation = Math.random() * 0.4 - 0.2; // -20% to +20%
        const reward = Math.floor(maxReward * (1 + rewardVariation));
        
        // Penalty is 20-50% of potential reward
        const penaltyPercent = Math.random() * 30 + 20;
        const penalty = Math.floor((maxReward * penaltyPercent) / 100);
        
        // Crime scenarios
        const crimeScenarios = [
            { name: "Bank robbery", risk: "high" },
            { name: "Pickpocketing", risk: "low" },
            { name: "Shoplifting", risk: "medium" },
            { name: "Car theft", risk: "high" },
            { name: "Hacking", risk: "medium" },
            { name: "Identity theft", risk: "medium" },
            { name: "Art theft", risk: "high" },
            { name: "Jewelry heist", risk: "high" },
            { name: "Drug dealing", risk: "medium" },
            { name: "Smuggling", risk: "high" }
        ];
        
        const scenario = crimeScenarios[Math.floor(Math.random() * crimeScenarios.length)];
        
        // Update profile based on outcome
        profile.lastCrime = Date.now();
        
        if (success) {
            profile.coins += reward;
            
            // Add achievement if first crime
            if (addAchievement(profile, 'crime')) {
                await sock.sendMessage(sender, {
                    text: '*🏆 Achievement Unlocked:* Criminal\nYou committed your first crime!'
                });
            }
            
            await sock.sendMessage(sender, {
                text: `*🦹‍♂️ Crime Successful:* Your ${scenario.name} went undetected!\n\nYou earned ${formatNumber(reward)} coins from your illegal activities.\n\nCurrent Balance: ${formatNumber(profile.coins)} coins`
            });
        } else {
            // Don't go below 0 coins
            profile.coins = Math.max(0, profile.coins - penalty);
            
            await sock.sendMessage(sender, {
                text: `*🚨 Crime Failed:* You were caught during your ${scenario.name}!\n\nYou paid ${formatNumber(penalty)} coins in fines and legal fees.\n\nCurrent Balance: ${formatNumber(profile.coins)} coins`
            });
        }
        
        // Save profile
        userProfiles.set(sender, profile);
    },
    
    async work(sock, sender) {
        const profile = await getUserProfile(sock, sender);
        if (!profile) return;
        
        let job = userJobs.get(sender);
        
        if (!job) {
            await sock.sendMessage(sender, {
                text: '*❌ Error:* You don\'t have a job yet. Use .getjob [job name] to get a job!\n\n*Available Jobs:*\n' + 
                jobsList.map(j => `• ${j.name} - Income: ${j.income} coins/hr (Level ${j.requirements.level}+)`).join('\n')
            });
            return;
        }
        
        const cooldown = calculateWorkCooldown(job);
        if (cooldown > 0) {
            await sock.sendMessage(sender, {
                text: `*⏳ Cooldown:* You need to rest before working again. Try again in ${formatTimeRemaining(cooldown)}.`
            });
            return;
        }
        
        // Work reward with random variation
        const baseReward = jobsList.find(j => j.name === job.name).income;
        const variationPercent = (Math.random() * 40) - 20; // -20% to +20%
        const earnedCoins = Math.floor(baseReward * (1 + variationPercent / 100));
        
        // Update profile
        profile.coins += earnedCoins;
        job.lastWork = Date.now();
        
        // Random work messages
        const workMessages = [
            `You worked hard as a ${job.name} and earned ${earnedCoins} coins!`,
            `Another day, another paycheck! You earned ${earnedCoins} coins as a ${job.name}.`,
            `Your skills as a ${job.name} earned you ${earnedCoins} coins today!`,
            `You completed your shift as a ${job.name} and received ${earnedCoins} coins!`,
            `Your boss was impressed with your work as a ${job.name}! You earned ${earnedCoins} coins.`
        ];
        
        const randomMessage = workMessages[Math.floor(Math.random() * workMessages.length)];
        
        // Save data
        userProfiles.set(sender, profile);
        userJobs.set(sender, job);
        
        await sock.sendMessage(sender, {
            text: `*💼 Work Complete!*\n\n${randomMessage}\n\nYour balance: ${formatNumber(profile.coins)} coins\nCooldown: 1 hour`
        });
    },
    
    async getjob(sock, sender, args) {
        const profile = await getUserProfile(sock, sender);
        if (!profile) return;
        
        if (args.length < 1) {
            await sock.sendMessage(sender, {
                text: '*⚠️ Usage:* .getjob [job name]\n\n*Available Jobs:*\n' + 
                jobsList.map(j => `• ${j.name} - Income: ${j.income} coins/hr (Level ${j.requirements.level}+)`).join('\n')
            });
            return;
        }
        
        const jobName = args.join(' ');
        const job = jobsList.find(j => j.name.toLowerCase() === jobName.toLowerCase());
        
        if (!job) {
            await sock.sendMessage(sender, {
                text: '*❌ Error:* Job not found. Please choose from the available jobs:\n\n' + 
                jobsList.map(j => `• ${j.name} - Income: ${j.income} coins/hr (Level ${j.requirements.level}+)`).join('\n')
            });
            return;
        }
        
        if (profile.level < job.requirements.level) {
            await sock.sendMessage(sender, {
                text: `*❌ Error:* You need to be level ${job.requirements.level} to work as a ${job.name}. Your current level: ${profile.level}`
            });
            return;
        }
        
        // Get the job and save data
        userJobs.set(sender, {
            name: job.name,
            lastWork: 0
        });
        
        // Add achievement if it's their first job
        if (addAchievement(profile, 'job')) {
            await sock.sendMessage(sender, {
                text: '*🏆 Achievement Unlocked:* Employed\nYou got your first job!'
            });
        }
        
        // Save profile
        userProfiles.set(sender, profile);
        
        await sock.sendMessage(sender, {
            text: `*💼 Job Acquired!*\n\nYou are now working as a ${job.name}!\nSalary: ${job.income} coins/hr\n\nUse .work to start earning coins.`
        });
    },
    
    async resign(sock, sender) {
        const profile = await getUserProfile(sock, sender);
        if (!profile) return;
        
        const job = userJobs.get(sender);
        if (!job) {
            await sock.sendMessage(sender, {
                text: '*❌ Error:* You don\'t have a job to resign from.'
            });
            return;
        }
        
        const jobName = job.name;
        userJobs.delete(sender);
        
        await sock.sendMessage(sender, {
            text: `*💼 Resignation:* You've successfully resigned from your position as a ${jobName}.\n\nUse .getjob to find a new job.`
        });
    },
    
    // 2. Social System - AFK and Reputation
    async afk(sock, sender, args) {
        const profile = await getUserProfile(sock, sender);
        if (!profile) return;
        
        // Set AFK status
        let reason = 'Away from keyboard';
        if (args.length > 0) {
            reason = args.join(' ');
        }
        
        userAfk.set(sender, {
            status: true,
            reason: reason,
            timestamp: Date.now()
        });
        
        await sock.sendMessage(sender, {
            text: `*💤 AFK Status Set:* You are now AFK.\nReason: ${reason}\n\nAnyone who mentions you will be informed of your AFK status.`
        });
    },
    
    async unafk(sock, sender) {
        const profile = await getUserProfile(sock, sender);
        if (!profile) return;
        
        // Check if user is AFK
        if (!userAfk.get(sender)?.status) {
            await sock.sendMessage(sender, {
                text: '*❌ Error:* You are not currently AFK.'
            });
            return;
        }
        
        // Calculate AFK duration
        const afkData = userAfk.get(sender);
        const duration = Date.now() - afkData.timestamp;
        const hours = Math.floor(duration / (1000 * 60 * 60));
        const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));
        
        // Remove AFK status
        userAfk.delete(sender);
        
        await sock.sendMessage(sender, {
            text: `*🔄 AFK Status Removed:* Welcome back! You were AFK for ${hours}h ${minutes}m.`
        });
    },
    
    async rep(sock, sender, args) {
        const profile = await getUserProfile(sock, sender);
        if (!profile) return;
        
        if (args.length < 1) {
            await sock.sendMessage(sender, {
                text: '*⚠️ Usage:* .rep @user'
            });
            return;
        }
        
        const targetId = args[0].replace('@', '') + '@s.whatsapp.net';
        
        if (targetId === sender) {
            await sock.sendMessage(sender, {
                text: '*❌ Error:* You cannot give reputation to yourself!'
            });
            return;
        }
        
        // Check target profile
        const targetProfile = userProfiles.get(targetId);
        if (!targetProfile) {
            await sock.sendMessage(sender, {
                text: '*❌ Error:* That user doesn\'t have a profile yet.'
            });
            return;
        }
        
        // Check cooldown (once per 12 hours)
        const lastRep = profile.lastRepGiven || 0;
        const cooldown = 12 * 60 * 60 * 1000; // 12 hours
        
        if (Date.now() - lastRep < cooldown) {
            const timeLeft = Math.ceil((lastRep + cooldown - Date.now()) / (1000 * 60 * 60));
            await sock.sendMessage(sender, {
                text: `*⏳ Cooldown:* You can give reputation again in ${timeLeft} hours.`
            });
            return;
        }
        
        // Initialize rep if needed
        if (!targetProfile.reputation) {
            targetProfile.reputation = 0;
        }
        
        // Add reputation
        targetProfile.reputation++;
        profile.lastRepGiven = Date.now();
        
        // Save profiles
        userProfiles.set(targetId, targetProfile);
        userProfiles.set(sender, profile);
        
        await sock.sendMessage(sender, {
            text: `*👍 Reputation:* You gave +1 reputation to ${targetProfile.name}!`
        });
        
        await sock.sendMessage(targetId, {
            text: `*👍 Reputation:* ${profile.name} gave you +1 reputation! Your reputation is now ${targetProfile.reputation}.`
        });
    },
    
    // 3. Mini-games - Fishing and Mining
    async fish(sock, sender) {
        const profile = await getUserProfile(sock, sender);
        if (!profile) return;
        
        // Check if player has a fishing rod
        if (!profile.inventory?.fishingRod) {
            await sock.sendMessage(sender, {
                text: '*❌ Error:* You need a fishing rod to fish! Buy one at the shop with .shop items'
            });
            return;
        }
        
        // Check cooldown (5 minutes)
        const lastFishing = profile.lastFishing || 0;
        const cooldown = 5 * 60 * 1000; // 5 minutes
        
        if (Date.now() - lastFishing < cooldown) {
            const timeLeft = Math.ceil((lastFishing + cooldown - Date.now()) / 1000);
            await sock.sendMessage(sender, {
                text: `*⏳ Cooldown:* You need to wait before fishing again. Try again in ${formatTimeRemaining(timeLeft)}.`
            });
            return;
        }
        
        // Initialize fishing inventory if needed
        if (!profile.inventory) {
            profile.inventory = {};
        }
        
        if (!profile.inventory.fish) {
            profile.inventory.fish = {};
        }
        
        // Define fish types and their rarity
        const fishTypes = [
            { name: 'Common Fish', value: 10, rarity: 50 },
            { name: 'Trout', value: 20, rarity: 25 },
            { name: 'Salmon', value: 40, rarity: 15 },
            { name: 'Tuna', value: 80, rarity: 8 },
            { name: 'Shark', value: 200, rarity: 1.5 },
            { name: 'Whale', value: 500, rarity: 0.5 }
        ];
        
        // Roll for success (80% chance)
        const success = Math.random() < 0.8;
        
        if (!success) {
            profile.lastFishing = Date.now();
            userProfiles.set(sender, profile);
            
            await sock.sendMessage(sender, {
                text: '*🎣 Fishing:* You didn\'t catch anything this time. Try again later!'
            });
            return;
        }
        
        // Determine which fish was caught based on rarity
        let caughtFish = null;
        const roll = Math.random() * 100;
        let cumulativeProbability = 0;
        
        for (const fish of fishTypes) {
            cumulativeProbability += fish.rarity;
            if (roll <= cumulativeProbability) {
                caughtFish = fish;
                break;
            }
        }
        
        if (!caughtFish) {
            caughtFish = fishTypes[0]; // Default to common fish
        }
        
        // Add fish to inventory
        profile.inventory.fish[caughtFish.name] = (profile.inventory.fish[caughtFish.name] || 0) + 1;
        
        // Update profile
        profile.lastFishing = Date.now();
        
        // Add achievement if first fish
        if (addAchievement(profile, 'fishing')) {
            await sock.sendMessage(sender, {
                text: '*🏆 Achievement Unlocked:* Fisherman\nYou caught your first fish!'
            });
        }
        
        // Save profile
        userProfiles.set(sender, profile);
        
        await sock.sendMessage(sender, {
            text: `*🎣 Fishing Success:* You caught a ${caughtFish.name} worth ${caughtFish.value} coins!\n\nYou can sell it with .sell fish [name|all]`
        });
    },
    
    async mine(sock, sender) {
        const profile = await getUserProfile(sock, sender);
        if (!profile) return;
        
        // Check if player has a pickaxe
        if (!profile.inventory?.pickaxe) {
            await sock.sendMessage(sender, {
                text: '*❌ Error:* You need a pickaxe to mine! Buy one at the shop with .shop items'
            });
            return;
        }
        
        // Check cooldown (8 minutes)
        const lastMining = profile.lastMining || 0;
        const cooldown = 8 * 60 * 1000; // 8 minutes
        
        if (Date.now() - lastMining < cooldown) {
            const timeLeft = Math.ceil((lastMining + cooldown - Date.now()) / 1000);
            await sock.sendMessage(sender, {
                text: `*⏳ Cooldown:* You need to rest before mining again. Try again in ${formatTimeRemaining(timeLeft)}.`
            });
            return;
        }
        
        // Initialize mining inventory if needed
        if (!profile.inventory) {
            profile.inventory = {};
        }
        
        if (!profile.inventory.minerals) {
            profile.inventory.minerals = {};
        }
        
        // Define mineral types and their rarity
        const mineralTypes = [
            { name: 'Stone', value: 2, rarity: 45 },
            { name: 'Coal', value: 10, rarity: 30 },
            { name: 'Iron', value: 30, rarity: 15 },
            { name: 'Silver', value: 60, rarity: 7 },
            { name: 'Gold', value: 120, rarity: 2.5 },
            { name: 'Diamond', value: 350, rarity: 0.5 }
        ];
        
        // Determine what was mined based on rarity
        let minedMineral = null;
        const roll = Math.random() * 100;
        let cumulativeProbability = 0;
        
        for (const mineral of mineralTypes) {
            cumulativeProbability += mineral.rarity;
            if (roll <= cumulativeProbability) {
                minedMineral = mineral;
                break;
            }
        }
        
        if (!minedMineral) {
            minedMineral = mineralTypes[0]; // Default to stone
        }
        
        // Determine quantity (1-3 for common, 1 for rare)
        const quantity = minedMineral.rarity > 10 ? Math.floor(Math.random() * 3) + 1 : 1;
        
        // Add minerals to inventory
        profile.inventory.minerals[minedMineral.name] = (profile.inventory.minerals[minedMineral.name] || 0) + quantity;
        
        // Update profile
        profile.lastMining = Date.now();
        
        // Add achievement if first mining
        if (addAchievement(profile, 'mining')) {
            await sock.sendMessage(sender, {
                text: '*🏆 Achievement Unlocked:* Miner\nYou mined your first resource!'
            });
        }
        
        // Save profile
        userProfiles.set(sender, profile);
        
        await sock.sendMessage(sender, {
            text: `*⛏️ Mining Success:* You mined ${quantity} ${minedMineral.name}${quantity !== 1 ? 's' : ''} worth ${minedMineral.value * quantity} coins!\n\nYou can sell them with .sell mineral [name|all]`
        });
    },
    
    async sell(sock, sender, args) {
        const profile = await getUserProfile(sock, sender);
        if (!profile) return;
        
        if (args.length < 2) {
            await sock.sendMessage(sender, {
                text: '*⚠️ Usage:* .sell [type] [name|all]\n\nTypes: fish, mineral'
            });
            return;
        }
        
        // Initialize inventory if needed
        if (!profile.inventory) {
            profile.inventory = {
                fish: {},
                minerals: {}
            };
        }
        
        const type = args[0].toLowerCase();
        const itemName = args.slice(1).join(' ').toLowerCase();
        
        if (type !== 'fish' && type !== 'mineral') {
            await sock.sendMessage(sender, {
                text: '*❌ Error:* Invalid type. Use "fish" or "mineral".'
            });
            return;
        }
        
        const inventory = type === 'fish' ? profile.inventory.fish : profile.inventory.minerals;
        
        if (!inventory || Object.keys(inventory).length === 0) {
            await sock.sendMessage(sender, {
                text: `*❌ Error:* You don't have any ${type === 'fish' ? 'fish' : 'minerals'} to sell.`
            });
            return;
        }
        
        // Define values of items
        const fishValues = {
            'Common Fish': 10,
            'Trout': 20,
            'Salmon': 40,
            'Tuna': 80,
            'Shark': 200,
            'Whale': 500
        };
        
        const mineralValues = {
            'Stone': 2,
            'Coal': 10,
            'Iron': 30,
            'Silver': 60,
            'Gold': 120,
            'Diamond': 350
        };
        
        const values = type === 'fish' ? fishValues : mineralValues;
        
        let totalEarned = 0;
        let itemsSold = 0;
        
        if (itemName === 'all') {
            // Sell all items
            for (const [item, quantity] of Object.entries(inventory)) {
                if (values[item]) {
                    totalEarned += values[item] * quantity;
                    itemsSold += quantity;
                    delete inventory[item];
                }
            }
        } else {
            // Find case-insensitive match
            const matchedItem = Object.keys(inventory).find(
                item => item.toLowerCase() === itemName
            );
            
            if (!matchedItem || !inventory[matchedItem]) {
                await sock.sendMessage(sender, {
                    text: `*❌ Error:* You don't have any ${itemName}. Check your inventory with .inventory.`
                });
                return;
            }
            
            totalEarned = values[matchedItem] * inventory[matchedItem];
            itemsSold = inventory[matchedItem];
            delete inventory[matchedItem];
        }
        
        // Update profile
        profile.coins += totalEarned;
        userProfiles.set(sender, profile);
        
        await sock.sendMessage(sender, {
            text: `*💰 Sale Complete:* You sold ${itemsSold} ${type === 'fish' ? 'fish' : 'minerals'} for ${formatNumber(totalEarned)} coins!\n\nYour balance: ${formatNumber(profile.coins)} coins`
        });
    },
    
    async inventory(sock, sender, args) {
        const profile = await getUserProfile(sock, sender);
        if (!profile) return;
        
        // Initialize inventory if needed
        if (!profile.inventory) {
            profile.inventory = {
                fish: {},
                minerals: {}
            };
        }
        
        // Get specific inventory type
        if (args.length > 0) {
            const type = args[0].toLowerCase();
            
            if (type === 'fish') {
                const fishInventory = profile.inventory.fish || {};
                if (Object.keys(fishInventory).length === 0) {
                    await sock.sendMessage(sender, {
                        text: '*🐟 Fish Inventory:* You don\'t have any fish yet. Use .fish to catch some!'
                    });
                    return;
                }
                
                let fishText = '*🐟 Fish Inventory:*\n\n';
                for (const [fish, quantity] of Object.entries(fishInventory)) {
                    fishText += `${fish}: ${quantity}\n`;
                }
                
                await sock.sendMessage(sender, { text: fishText });
                return;
            }
            
            if (type === 'mineral' || type === 'minerals') {
                const mineralInventory = profile.inventory.minerals || {};
                if (Object.keys(mineralInventory).length === 0) {
                    await sock.sendMessage(sender, {
                        text: '*⛏️ Mineral Inventory:* You don\'t have any minerals yet. Use .mine to mine some!'
                    });
                    return;
                }
                
                let mineralText = '*⛏️ Mineral Inventory:*\n\n';
                for (const [mineral, quantity] of Object.entries(mineralInventory)) {
                    mineralText += `${mineral}: ${quantity}\n`;
                }
                
                await sock.sendMessage(sender, { text: mineralText });
                return;
            }
        }
        
        // Get full inventory
        let inventoryText = '*📦 Inventory:*\n\n';
        
        // Tools section
        inventoryText += '*🔨 Tools:*\n';
        inventoryText += profile.inventory.fishingRod ? '🎣 Fishing Rod\n' : '';
        inventoryText += profile.inventory.pickaxe ? '⛏️ Pickaxe\n' : '';
        inventoryText += profile.inventory.axe ? '🪓 Axe\n' : '';
        
        if (!profile.inventory.fishingRod && !profile.inventory.pickaxe && !profile.inventory.axe) {
            inventoryText += 'No tools yet\n';
        }
        
        // Fish section
        const fishInventory = profile.inventory.fish || {};
        inventoryText += '\n*🐟 Fish:*\n';
        if (Object.keys(fishInventory).length === 0) {
            inventoryText += 'No fish yet\n';
        } else {
            for (const [fish, quantity] of Object.entries(fishInventory)) {
                inventoryText += `${fish}: ${quantity}\n`;
            }
        }
        
        // Minerals section
        const mineralInventory = profile.inventory.minerals || {};
        inventoryText += '\n*⛏️ Minerals:*\n';
        if (Object.keys(mineralInventory).length === 0) {
            inventoryText += 'No minerals yet\n';
        } else {
            for (const [mineral, quantity] of Object.entries(mineralInventory)) {
                inventoryText += `${mineral}: ${quantity}\n`;
            }
        }
        
        await sock.sendMessage(sender, { text: inventoryText });
    },
    
    // 4. Crafting System
    async craft(sock, sender, args) {
        const profile = await getUserProfile(sock, sender);
        if (!profile) return;
        
        // Define crafting recipes
        const recipes = {
            'fishing rod': {
                requires: { 'Wood': 5, 'String': 3 },
                result: 'fishingRod'
            },
            'pickaxe': {
                requires: { 'Wood': 3, 'Iron': 5 },
                result: 'pickaxe'
            },
            'axe': {
                requires: { 'Wood': 3, 'Iron': 3 },
                result: 'axe'
            },
            'shield': {
                requires: { 'Wood': 3, 'Iron': 8 },
                result: 'shield'
            },
            'helmet': {
                requires: { 'Iron': 10, 'Leather': 2 },
                result: 'helmet'
            },
            'armor': {
                requires: { 'Iron': 15, 'Leather': 5 },
                result: 'armor'
            }
        };
        
        // Show recipe list if no args
        if (args.length === 0) {
            let recipeText = '*🔨 Crafting Recipes:*\n\n';
            
            for (const [item, recipe] of Object.entries(recipes)) {
                recipeText += `*${item.charAt(0).toUpperCase() + item.slice(1)}*\n`;
                recipeText += 'Requires: ';
                
                const requirements = [];
                for (const [material, quantity] of Object.entries(recipe.requires)) {
                    requirements.push(`${material} x${quantity}`);
                }
                
                recipeText += requirements.join(', ') + '\n\n';
            }
            
            recipeText += 'Use .craft [item] to craft an item';
            
            await sock.sendMessage(sender, { text: recipeText });
            return;
        }
        
        // Get requested item
        const requestedItem = args.join(' ').toLowerCase();
        const recipe = recipes[requestedItem];
        
        if (!recipe) {
            await sock.sendMessage(sender, {
                text: '*❌ Error:* Invalid crafting recipe. Use .craft to see available recipes.'
            });
            return;
        }
        
        // Initialize inventory if needed
        if (!profile.inventory) {
            profile.inventory = {
                minerals: {},
                fish: {}
            };
        }
        
        // Check requirements
        let missingMaterials = [];
        
        for (const [material, requiredQuantity] of Object.entries(recipe.requires)) {
            const availableQuantity = (profile.inventory.minerals && profile.inventory.minerals[material]) || 0;
            
            if (availableQuantity < requiredQuantity) {
                missingMaterials.push(`${material} (need ${requiredQuantity}, have ${availableQuantity})`);
            }
        }
        
        if (missingMaterials.length > 0) {
            await sock.sendMessage(sender, {
                text: `*❌ Missing Materials:* You don't have all required materials to craft a ${requestedItem}.\n\nMissing: ${missingMaterials.join(', ')}`
            });
            return;
        }
        
        // Check if already has the item
        if (profile.inventory[recipe.result]) {
            await sock.sendMessage(sender, {
                text: `*❌ Error:* You already have a ${requestedItem}.`
            });
            return;
        }
        
        // Consume materials
        for (const [material, requiredQuantity] of Object.entries(recipe.requires)) {
            profile.inventory.minerals[material] -= requiredQuantity;
            
            // Remove entry if quantity becomes 0
            if (profile.inventory.minerals[material] <= 0) {
                delete profile.inventory.minerals[material];
            }
        }
        
        // Add crafted item
        profile.inventory[recipe.result] = true;
        
        // Add achievement if first craft
        if (addAchievement(profile, 'crafting')) {
            await sock.sendMessage(sender, {
                text: '*🏆 Achievement Unlocked:* Craftsman\nYou crafted your first item!'
            });
        }
        
        // Save profile
        userProfiles.set(sender, profile);
        
        await sock.sendMessage(sender, {
            text: `*🔨 Crafting Success:* You have crafted a ${requestedItem}!`
        });
    },
    
    // 5. Investment System
    async invest(sock, sender, args) {
        const profile = await getUserProfile(sock, sender);
        if (!profile) return;
        
        // Initialize investment data if needed
        if (!profile.investments) {
            profile.investments = [];
        }
        
        // Show current investments if no args
        if (args.length === 0) {
            if (profile.investments.length === 0) {
                await sock.sendMessage(sender, {
                    text: '*📊 Investments:* You don\'t have any active investments. Use .invest [amount] [duration] to invest.'
                });
                return;
            }
            
            let investmentText = '*📊 Your Investments:*\n\n';
            
            for (let i = 0; i < profile.investments.length; i++) {
                const investment = profile.investments[i];
                const remainingTime = investment.endTime - Date.now();
                
                if (remainingTime <= 0) {
                    // Investment matured, claim returns
                    const returnAmount = Math.floor(investment.amount * (1 + investment.interestRate));
                    profile.coins += returnAmount;
                    
                    investmentText += `*Investment #${i+1}:* MATURED\n`;
                    investmentText += `Initial: ${formatNumber(investment.amount)} coins\n`;
                    investmentText += `Return: ${formatNumber(returnAmount)} coins\n`;
                    investmentText += `Profit: ${formatNumber(returnAmount - investment.amount)} coins\n\n`;
                    
                    // Remove the matured investment
                    profile.investments.splice(i, 1);
                    i--; // Adjust index after removal
                } else {
                    // Active investment
                    const daysLeft = Math.ceil(remainingTime / (1000 * 60 * 60 * 24));
                    const expectedReturn = Math.floor(investment.amount * (1 + investment.interestRate));
                    
                    investmentText += `*Investment #${i+1}:*\n`;
                    investmentText += `Amount: ${formatNumber(investment.amount)} coins\n`;
                    investmentText += `Interest Rate: ${(investment.interestRate * 100).toFixed(1)}%\n`;
                    investmentText += `Expected Return: ${formatNumber(expectedReturn)} coins\n`;
                    investmentText += `Matures in: ${daysLeft} day${daysLeft !== 1 ? 's' : ''}\n\n`;
                }
            }
            
            // Save profile after processing matured investments
            userProfiles.set(sender, profile);
            
            await sock.sendMessage(sender, { text: investmentText });
            return;
        }
        
        // Check args
        if (args.length < 2) {
            await sock.sendMessage(sender, {
                text: '*⚠️ Usage:* .invest [amount] [duration in days (1-30)]'
            });
            return;
        }
        
        // Parse amount
        let amount;
        if (args[0].toLowerCase() === 'all') {
            amount = profile.coins;
        } else {
            amount = parseInt(args[0]);
        }
        
        if (!amount || amount <= 0 || isNaN(amount)) {
            await sock.sendMessage(sender, {
                text: '*❌ Error:* Please provide a valid positive amount to invest.'
            });
            return;
        }
        
        if (amount > profile.coins) {
            await sock.sendMessage(sender, {
                text: `*❌ Error:* You don't have enough coins. Your balance: ${formatNumber(profile.coins)} coins.`
            });
            return;
        }
        
        // Parse duration
        const duration = parseInt(args[1]);
        
        if (!duration || duration < 1 || duration > 30 || isNaN(duration)) {
            await sock.sendMessage(sender, {
                text: '*❌ Error:* Duration must be between 1 and 30 days.'
            });
            return;
        }
        
        // Calculate interest rate (higher for longer investments)
        // Base rate of 5% + 0.5% per day
        const interestRate = 0.05 + (duration * 0.005);
        
        // Create investment
        const investment = {
            amount: amount,
            startTime: Date.now(),
            endTime: Date.now() + (duration * 24 * 60 * 60 * 1000),
            interestRate: interestRate
        };
        
        // Add investment and deduct coins
        profile.investments.push(investment);
        profile.coins -= amount;
        
        // Add achievement if first investment
        if (addAchievement(profile, 'investor')) {
            await sock.sendMessage(sender, {
                text: '*🏆 Achievement Unlocked:* Investor\nYou made your first investment!'
            });
        }
        
        // Save profile
        userProfiles.set(sender, profile);
        
        const expectedReturn = Math.floor(amount * (1 + interestRate));
        
        await sock.sendMessage(sender, {
            text: `*📊 Investment Made:*\n\nAmount: ${formatNumber(amount)} coins\nDuration: ${duration} day${duration !== 1 ? 's' : ''}\nInterest Rate: ${(interestRate * 100).toFixed(1)}%\nExpected Return: ${formatNumber(expectedReturn)} coins\n\nYour investment will mature in ${duration} day${duration !== 1 ? 's' : ''}.`
        });
    },
    
    // 6. Email System
    async mail(sock, sender, args) {
        const profile = await getUserProfile(sock, sender);
        if (!profile) return;
        
        // Initialize mail system if needed
        global.mailSystem = global.mailSystem || {
            mailboxes: new Map(),
            lastMailId: 0
        };
        
        let mailbox = global.mailSystem.mailboxes.get(sender) || {
            inbox: [],
            outbox: []
        };
        
        // Show inbox
        if (args.length === 0 || args[0].toLowerCase() === 'inbox') {
            if (mailbox.inbox.length === 0) {
                await sock.sendMessage(sender, {
                    text: '*📬 Inbox:* Your inbox is empty.'
                });
                return;
            }
            
            let inboxText = '*📬 Your Inbox:*\n\n';
            
            for (let i = 0; i < mailbox.inbox.length; i++) {
                const mail = mailbox.inbox[i];
                const sender = mail.senderName || 'Unknown';
                
                inboxText += `*Mail #${i+1}*\n`;
                inboxText += `From: ${sender}\n`;
                inboxText += `Subject: ${mail.subject}\n`;
                inboxText += `Date: ${new Date(mail.timestamp).toLocaleString()}\n\n`;
            }
            
            inboxText += 'Use .mail read [number] to read a mail.';
            
            await sock.sendMessage(sender, { text: inboxText });
            return;
        }
        
        // Read a specific mail
        if (args[0].toLowerCase() === 'read') {
            if (args.length < 2) {
                await sock.sendMessage(sender, {
                    text: '*⚠️ Usage:* .mail read [mail number]'
                });
                return;
            }
            
            const mailNumber = parseInt(args[1]);
            
            if (isNaN(mailNumber) || mailNumber < 1 || mailNumber > mailbox.inbox.length) {
                await sock.sendMessage(sender, {
                    text: '*❌ Error:* Invalid mail number.'
                });
                return;
            }
            
            const mail = mailbox.inbox[mailNumber - 1];
            
            let mailText = '*📩 Mail:*\n\n';
            mailText += `From: ${mail.senderName || 'Unknown'}\n`;
            mailText += `Subject: ${mail.subject}\n`;
            mailText += `Date: ${new Date(mail.timestamp).toLocaleString()}\n\n`;
            mailText += `${mail.content}\n\n`;
            
            if (mail.attachment) {
                mailText += `Attachment: ${mail.attachment.name}\n`;
                mailText += `Use .mail claim ${mailNumber} to claim the attachment.`;
            }
            
            await sock.sendMessage(sender, { text: mailText });
            return;
        }
        
        // Claim attachment
        if (args[0].toLowerCase() === 'claim') {
            if (args.length < 2) {
                await sock.sendMessage(sender, {
                    text: '*⚠️ Usage:* .mail claim [mail number]'
                });
                return;
            }
            
            const mailNumber = parseInt(args[1]);
            
            if (isNaN(mailNumber) || mailNumber < 1 || mailNumber > mailbox.inbox.length) {
                await sock.sendMessage(sender, {
                    text: '*❌ Error:* Invalid mail number.'
                });
                return;
            }
            
            const mail = mailbox.inbox[mailNumber - 1];
            
            if (!mail.attachment) {
                await sock.sendMessage(sender, {
                    text: '*❌ Error:* This mail has no attachment to claim.'
                });
                return;
            }
            
            // Add attachment item/coins to player inventory
            if (mail.attachment.type === 'coins') {
                profile.coins += mail.attachment.amount;
                
                await sock.sendMessage(sender, {
                    text: `*💰 Attachment Claimed:* You received ${formatNumber(mail.attachment.amount)} coins!`
                });
            } else if (mail.attachment.type === 'item') {
                // Initialize inventory if needed
                if (!profile.inventory) {
                    profile.inventory = {};
                }
                
                // Add item
                profile.inventory[mail.attachment.item] = true;
                
                await sock.sendMessage(sender, {
                    text: `*📦 Attachment Claimed:* You received a ${mail.attachment.name}!`
                });
            }
            
            // Remove attachment to prevent claiming twice
            mail.attachment = null;
            
            // Save profile
            userProfiles.set(sender, profile);
            global.mailSystem.mailboxes.set(sender, mailbox);
            
            return;
        }
        
        // Send mail
        if (args[0].toLowerCase() === 'send') {
            if (args.length < 4) {
                await sock.sendMessage(sender, {
                    text: '*⚠️ Usage:* .mail send @user "subject" message'
                });
                return;
            }
            
            // Parse target
            const targetId = args[1].replace('@', '') + '@s.whatsapp.net';
            
            // Check target profile
            const targetProfile = userProfiles.get(targetId);
            if (!targetProfile) {
                await sock.sendMessage(sender, {
                    text: '*❌ Error:* That user doesn\'t have a profile yet.'
                });
                return;
            }
            
            // Find subject (enclosed in quotes)
            let subjectMatch = args.slice(2).join(' ').match(/"([^"]+)"/);
            
            if (!subjectMatch) {
                await sock.sendMessage(sender, {
                    text: '*❌ Error:* Subject must be enclosed in quotes, e.g., "Hello there"'
                });
                return;
            }
            
            const subject = subjectMatch[1];
            
            // Get content (everything after the subject)
            const content = args.slice(2).join(' ').replace(/"([^"]+)"/, '').trim();
            
            if (!content) {
                await sock.sendMessage(sender, {
                    text: '*❌ Error:* Mail content cannot be empty.'
                });
                return;
            }
            
            // Create mail
            const mailId = ++global.mailSystem.lastMailId;
            const mail = {
                id: mailId,
                senderId: sender,
                senderName: profile.name,
                subject: subject,
                content: content,
                timestamp: Date.now(),
                read: false
            };
            
            // Initialize target mailbox if needed
            let targetMailbox = global.mailSystem.mailboxes.get(targetId) || {
                inbox: [],
                outbox: []
            };
            
            // Add to target inbox and sender outbox
            targetMailbox.inbox.push(mail);
            mailbox.outbox.push(mail);
            
            // Save mailboxes
            global.mailSystem.mailboxes.set(sender, mailbox);
            global.mailSystem.mailboxes.set(targetId, targetMailbox);
            
            await sock.sendMessage(sender, {
                text: `*📨 Mail Sent:* Your mail to ${targetProfile.name} has been sent!`
            });
            
            // Notify recipient
            await sock.sendMessage(targetId, {
                text: `*📬 New Mail:* You have received a new mail from ${profile.name}!\n\nSubject: ${subject}\n\nUse .mail to check your inbox.`
            });
            
            return;
        }
        
        // Delete mail
        if (args[0].toLowerCase() === 'delete') {
            if (args.length < 2) {
                await sock.sendMessage(sender, {
                    text: '*⚠️ Usage:* .mail delete [mail number|all]'
                });
                return;
            }
            
            if (args[1].toLowerCase() === 'all') {
                // Delete all mails
                mailbox.inbox = [];
                
                // Save mailbox
                global.mailSystem.mailboxes.set(sender, mailbox);
                
                await sock.sendMessage(sender, {
                    text: '*🗑️ Inbox Cleared:* All mails have been deleted.'
                });
                return;
            }
            
            const mailNumber = parseInt(args[1]);
            
            if (isNaN(mailNumber) || mailNumber < 1 || mailNumber > mailbox.inbox.length) {
                await sock.sendMessage(sender, {
                    text: '*❌ Error:* Invalid mail number.'
                });
                return;
            }
            
            // Delete the mail
            mailbox.inbox.splice(mailNumber - 1, 1);
            
            // Save mailbox
            global.mailSystem.mailboxes.set(sender, mailbox);
            
            await sock.sendMessage(sender, {
                text: '*🗑️ Mail Deleted:* The mail has been deleted.'
            });
            return;
        }
        
        // Unknown command
        await sock.sendMessage(sender, {
            text: '*⚠️ Usage:* .mail [inbox|read|claim|send|delete]'
        });
    },
    
    // 7. Daily Reward System
    async reward(sock, sender) {
        const profile = await getUserProfile(sock, sender);
        if (!profile) return;
        
        // Check if rewards are available
        const now = Date.now();
        const lastReward = profile.lastReward || 0;
        const cooldown = 24 * 60 * 60 * 1000; // 24 hours in ms
        
        if (now - lastReward < cooldown) {
            const timeLeft = Math.ceil((lastReward + cooldown - now) / (1000 * 60 * 60));
            await sock.sendMessage(sender, {
                text: `*⏳ Cooldown:* You've already claimed your daily reward! Try again in ${timeLeft} hours.`
            });
            return;
        }
        
        // Get or initialize streak data
        let streak = streakData.get(sender) || {
            count: 0,
            lastClaim: 0
        };
        
        // Check if streak continues (within 48 hours of last claim)
        const streakContinues = (now - streak.lastClaim) < (48 * 60 * 60 * 1000);
        
        if (streakContinues) {
            streak.count++;
        } else {
            streak.count = 1; // Reset streak
        }
        
        streak.lastClaim = now;
        
        // Base reward
        let reward = 1000;
        
        // Bonus for streak
        const streakBonus = Math.min(streak.count * 100, 2000); // Max 2000 bonus
        reward += streakBonus;
        
        // Update profile
        profile.coins += reward;
        profile.lastReward = now;
        
        // Checkin tracking
        let checkin = checkinData.get(sender) || {
            count: 0,
            lastMonth: null
        };
        
        const currentMonth = new Date().getMonth();
        if (checkin.lastMonth !== currentMonth) {
            checkin.count = 1;
            checkin.lastMonth = currentMonth;
        } else {
            checkin.count++;
        }
        
        // Additional rewards for milestone streaks
        let milestoneReward = 0;
        let milestoneMessage = '';
        
        if (streak.count === 7) {
            milestoneReward = 3000;
            milestoneMessage = 'Week Complete! +3,000 coins bonus';
        } else if (streak.count === 30) {
            milestoneReward = 15000;
            milestoneMessage = 'Month Complete! +15,000 coins bonus';
        } else if (streak.count % 100 === 0) {
            milestoneReward = 50000;
            milestoneMessage = `${streak.count} Day Streak! +50,000 coins bonus`;
        }
        
        if (milestoneReward > 0) {
            profile.coins += milestoneReward;
            reward += milestoneReward;
        }
        
        // Save data
        streakData.set(sender, streak);
        checkinData.set(sender, checkin);
        userProfiles.set(sender, profile);
        
        // Send reward message
        let rewardText = `*🎁 Daily Reward Claimed!*\n\n`;
        rewardText += `Base Reward: ${formatNumber(1000)} coins\n`;
        rewardText += `Streak Bonus: ${formatNumber(streakBonus)} coins\n`;
        if (milestoneMessage) {
            rewardText += `${milestoneMessage}: ${formatNumber(milestoneReward)} coins\n`;
        }
        rewardText += `Total Reward: ${formatNumber(reward)} coins\n\n`;
        rewardText += `Current Streak: ${streak.count} day${streak.count !== 1 ? 's' : ''}\n`;
        rewardText += `Monthly Check-ins: ${checkin.count} day${checkin.count !== 1 ? 's' : ''}\n\n`;
        rewardText += `Your Balance: ${formatNumber(profile.coins)} coins`;
        
        await sock.sendMessage(sender, { text: rewardText });
    },
    
    // 8. Passive Income with Idle Game Mechanics
    async business(sock, sender, args) {
        const profile = await getUserProfile(sock, sender);
        if (!profile) return;
        
        // Initialize business data if needed
        if (!profile.business) {
            profile.business = {
                level: 0,
                lastCollected: Date.now(),
                totalProfit: 0,
                automated: false
            };
        }
        
        // Business stats
        const businessInfo = {
            baseProduction: 50, // Base production per hour
            upgradeMultiplier: 1.5, // Production multiplier per level
            upgradeBaseCost: 5000, // Base cost for first upgrade
            upgradeCostMultiplier: 2.2 // Cost multiplier per level
        };
        
        // Showing business info
        if (args.length === 0) {
            if (profile.business.level === 0) {
                await sock.sendMessage(sender, {
                    text: '*🏭 Business:* You don\'t have a business yet. Use .business start to set up a business for 5,000 coins.'
                });
                return;
            }
            
            // Calculate uncollected income
            const hoursPassed = Math.max(0, (Date.now() - profile.business.lastCollected) / (1000 * 60 * 60));
            const hourlyIncome = businessInfo.baseProduction * Math.pow(businessInfo.upgradeMultiplier, profile.business.level - 1);
            let pendingIncome = Math.floor(hourlyIncome * hoursPassed);
            
            // Cap at 24 hours if not automated
            if (!profile.business.automated && hoursPassed > 24) {
                pendingIncome = Math.floor(hourlyIncome * 24);
            }
            
            // Calculate upgrade cost
            const upgradeCost = Math.floor(businessInfo.upgradeBaseCost * Math.pow(businessInfo.upgradeCostMultiplier, profile.business.level));
            
            let businessText = '*🏭 Your Business:*\n\n';
            businessText += `Level: ${profile.business.level}\n`;
            businessText += `Hourly Income: ${formatNumber(Math.floor(hourlyIncome))} coins\n`;
            businessText += `Uncollected: ${formatNumber(pendingIncome)} coins\n`;
            businessText += `Total Profit: ${formatNumber(profile.business.totalProfit)} coins\n`;
            businessText += `Status: ${profile.business.automated ? 'Automated' : 'Manual'}\n\n`;
            businessText += `Upgrade Cost: ${formatNumber(upgradeCost)} coins\n\n`;
            businessText += 'Commands:\n';
            businessText += '.business collect - Collect earnings\n';
            businessText += '.business upgrade - Upgrade your business\n';
            businessText += '.business automate - Make collection automatic (50,000 coins)';
            
            await sock.sendMessage(sender, { text: businessText });
            return;
        }
        
        // Starting a business
        if (args[0].toLowerCase() === 'start') {
            if (profile.business.level > 0) {
                await sock.sendMessage(sender, {
                    text: '*❌ Error:* You already have a business! Use .business to see your stats.'
                });
                return;
            }
            
            const startupCost = businessInfo.upgradeBaseCost;
            
            if (profile.coins < startupCost) {
                await sock.sendMessage(sender, {
                    text: `*❌ Error:* You need ${formatNumber(startupCost)} coins to start a business. You have ${formatNumber(profile.coins)} coins.`
                });
                return;
            }
            
            // Deduct startup cost
            profile.coins -= startupCost;
            
            // Create business
            profile.business = {
                level: 1,
                lastCollected: Date.now(),
                totalProfit: 0,
                automated: false
            };
            
            // Save profile
            userProfiles.set(sender, profile);
            
            await sock.sendMessage(sender, {
                text: `*🏭 Business Started:* You've invested ${formatNumber(startupCost)} coins to start your own business!\n\nUse .business to view your business and .business collect to collect earnings.`
            });
            return;
        }
        
        // Make sure they have a business for other commands
        if (profile.business.level === 0) {
            await sock.sendMessage(sender, {
                text: '*❌ Error:* You don\'t have a business yet. Use .business start to set up a business.'
            });
            return;
        }
        
        // Collecting earnings
        if (args[0].toLowerCase() === 'collect') {
            // Calculate uncollected income
            const hoursPassed = Math.max(0, (Date.now() - profile.business.lastCollected) / (1000 * 60 * 60));
            const hourlyIncome = businessInfo.baseProduction * Math.pow(businessInfo.upgradeMultiplier, profile.business.level - 1);
            let pendingIncome = Math.floor(hourlyIncome * hoursPassed);
            
            // Cap at 24 hours if not automated
            if (!profile.business.automated && hoursPassed > 24) {
                pendingIncome = Math.floor(hourlyIncome * 24);
            }
            
            if (pendingIncome <= 0) {
                await sock.sendMessage(sender, {
                    text: '*❌ Error:* There are no earnings to collect yet. Wait a bit longer.'
                });
                return;
            }
            
            // Add income
            profile.coins += pendingIncome;
            profile.business.totalProfit += pendingIncome;
            profile.business.lastCollected = Date.now();
            
            // Save profile
            userProfiles.set(sender, profile);
            
            await sock.sendMessage(sender, {
                text: `*💰 Earnings Collected:* You collected ${formatNumber(pendingIncome)} coins from your business!\n\nTotal Profit: ${formatNumber(profile.business.totalProfit)} coins\nCurrent Balance: ${formatNumber(profile.coins)} coins`
            });
            return;
        }
        
        // Upgrading business
        if (args[0].toLowerCase() === 'upgrade') {
            const upgradeCost = Math.floor(businessInfo.upgradeBaseCost * Math.pow(businessInfo.upgradeCostMultiplier, profile.business.level));
            
            if (profile.coins < upgradeCost) {
                await sock.sendMessage(sender, {
                    text: `*❌ Error:* You need ${formatNumber(upgradeCost)} coins to upgrade your business. You have ${formatNumber(profile.coins)} coins.`
                });
                return;
            }
            
            // Deduct upgrade cost
            profile.coins -= upgradeCost;
            
            // Upgrade business
            profile.business.level++;
            
            // Calculate new hourly income
            const newHourlyIncome = businessInfo.baseProduction * Math.pow(businessInfo.upgradeMultiplier, profile.business.level - 1);
            
            // Save profile
            userProfiles.set(sender, profile);
            
            await sock.sendMessage(sender, {
                text: `*🏭 Business Upgraded:* You spent ${formatNumber(upgradeCost)} coins to upgrade your business to level ${profile.business.level}!\n\nNew Hourly Income: ${formatNumber(Math.floor(newHourlyIncome))} coins`
            });
            return;
        }
        
        // Automating business
        if (args[0].toLowerCase() === 'automate') {
            if (profile.business.automated) {
                await sock.sendMessage(sender, {
                    text: '*❌ Error:* Your business is already automated!'
                });
                return;
            }
            
            const automationCost = 50000;
            
            if (profile.coins < automationCost) {
                await sock.sendMessage(sender, {
                    text: `*❌ Error:* You need ${formatNumber(automationCost)} coins to automate your business. You have ${formatNumber(profile.coins)} coins.`
                });
                return;
            }
            
            // Deduct automation cost
            profile.coins -= automationCost;
            
            // Automate business
            profile.business.automated = true;
            
            // Save profile
            userProfiles.set(sender, profile);
            
            await sock.sendMessage(sender, {
                text: `*🤖 Business Automated:* You spent ${formatNumber(automationCost)} coins to fully automate your business!\n\nYour business will now continue to generate income beyond the 24-hour limit, and earnings will be automatically collected when you check your business status.`
            });
            return;
        }
        
        // Unknown command
        await sock.sendMessage(sender, {
            text: '*⚠️ Usage:* .business [start|collect|upgrade|automate]'
        });
    },
    
    // 9. Bounty hunting system
    async bounty(sock, sender, args) {
        const profile = await getUserProfile(sock, sender);
        if (!profile) return;
        
        // Initialize global bounty system if needed
        global.bountySystem = global.bountySystem || {
            activeBounties: [],
            completedBounties: [],
            lastBountyId: 0
        };
        
        // Initialize profile bounty data
        if (!profile.bounties) {
            profile.bounties = {
                completed: 0,
                earnings: 0,
                cooldown: 0
            };
        }
        
        // Helper function to create random bounties
        function generateBounty() {
            const bountyTypes = [
                { name: 'Wolf Pack', difficulty: 'easy', reward: 500, exp: 50 },
                { name: 'Bandit Camp', difficulty: 'easy', reward: 800, exp: 80 },
                { name: 'Goblin Raid', difficulty: 'medium', reward: 1500, exp: 150 },
                { name: 'Orc Warband', difficulty: 'medium', reward: 2000, exp: 200 },
                { name: 'Dragon Sighting', difficulty: 'hard', reward: 5000, exp: 500 },
                { name: 'Demon Summoning', difficulty: 'hard', reward: 8000, exp: 800 },
                { name: 'Witch Coven', difficulty: 'medium', reward: 3000, exp: 300 },
                { name: 'Giant Spider', difficulty: 'medium', reward: 2500, exp: 250 },
                { name: 'Undead Uprising', difficulty: 'hard', reward: 6000, exp: 600 },
                { name: 'Cursed Treasure', difficulty: 'hard', reward: 7000, exp: 700 }
            ];
            
            // Select random bounty type
            const bountyType = bountyTypes[Math.floor(Math.random() * bountyTypes.length)];
            
            // Random variation in reward
            const rewardVariation = Math.random() * 0.4 - 0.2; // -20% to +20%
            const finalReward = Math.floor(bountyType.reward * (1 + rewardVariation));
            const finalExp = Math.floor(bountyType.exp * (1 + rewardVariation));
            
            // Create bounty
            return {
                id: ++global.bountySystem.lastBountyId,
                name: bountyType.name,
                difficulty: bountyType.difficulty,
                reward: finalReward,
                exp: finalExp,
                timestamp: Date.now(),
                expires: Date.now() + (24 * 60 * 60 * 1000) // 24 hour expiration
            };
        }
        
        // Refresh bounties - remove expired ones and add new ones
        function refreshBounties() {
            const now = Date.now();
            
            // Remove expired bounties
            global.bountySystem.activeBounties = global.bountySystem.activeBounties.filter(
                bounty => bounty.expires > now
            );
            
            // Add new bounties if less than 5 active
            while (global.bountySystem.activeBounties.length < 5) {
                global.bountySystem.activeBounties.push(generateBounty());
            }
        }
        
        // View active bounties
        if (args.length === 0 || args[0].toLowerCase() === 'list') {
            refreshBounties();
            
            let bountyText = '*🎯 Active Bounties:*\n\n';
            
            if (global.bountySystem.activeBounties.length === 0) {
                bountyText += 'No active bounties available.';
            } else {
                for (const bounty of global.bountySystem.activeBounties) {
                    const timeLeft = Math.ceil((bounty.expires - Date.now()) / (1000 * 60 * 60));
                    
                    bountyText += `*${bounty.name}* (#${bounty.id})\n`;
                    bountyText += `Difficulty: ${bounty.difficulty}\n`;
                    bountyText += `Reward: ${formatNumber(bounty.reward)} coins, ${bounty.exp} XP\n`;
                    bountyText += `Expires in: ${timeLeft} hour${timeLeft !== 1 ? 's' : ''}\n\n`;
                }
            }
            
            bountyText += 'Use .bounty hunt [id] to accept a bounty.';
            
            await sock.sendMessage(sender, { text: bountyText });
            return;
        }
        
        // Hunt/complete a bounty
        if (args[0].toLowerCase() === 'hunt') {
            if (args.length < 2) {
                await sock.sendMessage(sender, {
                    text: '*⚠️ Usage:* .bounty hunt [bounty id]'
                });
                return;
            }
            
            // Check cooldown
            const cooldownTime = profile.bounties.cooldown;
            if (cooldownTime > Date.now()) {
                const timeLeft = Math.ceil((cooldownTime - Date.now()) / (1000 * 60));
                await sock.sendMessage(sender, {
                    text: `*⏳ Cooldown:* You need to rest before taking another bounty. Try again in ${timeLeft} minutes.`
                });
                return;
            }
            
            // Find the bounty
            const bountyId = parseInt(args[1]);
            refreshBounties();
            
            const bounty = global.bountySystem.activeBounties.find(b => b.id === bountyId);
            
            if (!bounty) {
                await sock.sendMessage(sender, {
                    text: '*❌ Error:* Bounty not found or expired. Use .bounty list to see active bounties.'
                });
                return;
            }
            
            // Success rate based on difficulty and level
            let successRate;
            
            switch(bounty.difficulty) {
                case 'easy':
                    successRate = 80 + (profile.level * 1); // 80% + 1% per level
                    break;
                case 'medium':
                    successRate = 60 + (profile.level * 1.5); // 60% + 1.5% per level
                    break;
                case 'hard':
                    successRate = 40 + (profile.level * 2); // 40% + 2% per level
                    break;
                default:
                    successRate = 70;
            }
            
            // Cap success rate at 95%
            successRate = Math.min(successRate, 95);
            
            // Roll for success
            const success = Math.random() * 100 <= successRate;
            
            // Remove bounty from active list
            global.bountySystem.activeBounties = global.bountySystem.activeBounties.filter(
                b => b.id !== bountyId
            );
            
            // Set cooldown - longer for harder difficulties
            let cooldownMinutes;
            switch(bounty.difficulty) {
                case 'easy': cooldownMinutes = 30; break;
                case 'medium': cooldownMinutes = 60; break;
                case 'hard': cooldownMinutes = 120; break;
                default: cooldownMinutes = 45;
            }
            
            profile.bounties.cooldown = Date.now() + (cooldownMinutes * 60 * 1000);
            
            if (success) {
                // Add to completed bounties
                global.bountySystem.completedBounties.push({
                    ...bounty,
                    completedBy: sender,
                    completedAt: Date.now()
                });
                
                // Update profile
                profile.coins += bounty.reward;
                profile.xp += bounty.exp;
                profile.bounties.completed++;
                profile.bounties.earnings += bounty.reward;
                
                // Add new random bounty
                global.bountySystem.activeBounties.push(generateBounty());
                
                await sock.sendMessage(sender, {
                    text: `*🎯 Bounty Completed:* You successfully completed the ${bounty.name} bounty!\n\nReward: ${formatNumber(bounty.reward)} coins\nXP Gained: ${bounty.exp}\n\nYour Balance: ${formatNumber(profile.coins)} coins\nCooldown: ${cooldownMinutes} minutes`
                });
            } else {
                // Failed attempt
                await sock.sendMessage(sender, {
                    text: `*❌ Bounty Failed:* You were unable to complete the ${bounty.name} bounty.\n\nThe bounty was too challenging. Try an easier one next time.\n\nCooldown: ${cooldownMinutes} minutes`
                });
            }
            
            // Save profile
            userProfiles.set(sender, profile);
            return;
        }
        
        // View bounty stats
        if (args[0].toLowerCase() === 'stats') {
            const completed = profile.bounties.completed || 0;
            const earnings = profile.bounties.earnings || 0;
            
            let statsText = '*🎯 Your Bounty Hunter Stats:*\n\n';
            statsText += `Bounties Completed: ${completed}\n`;
            statsText += `Total Earnings: ${formatNumber(earnings)} coins\n`;
            
            if (completed >= 50) {
                statsText += `\nRank: Master Bounty Hunter`;
            } else if (completed >= 25) {
                statsText += `\nRank: Expert Bounty Hunter`;
            } else if (completed >= 10) {
                statsText += `\nRank: Seasoned Bounty Hunter`;
            } else if (completed >= 5) {
                statsText += `\nRank: Regular Bounty Hunter`;
            } else {
                statsText += `\nRank: Novice Bounty Hunter`;
            }
            
            await sock.sendMessage(sender, { text: statsText });
            return;
        }
        
        // Unknown command
        await sock.sendMessage(sender, {
            text: '*⚠️ Usage:* .bounty [list|hunt|stats]'
        });
    },
    
    // 10. Clans/guilds system
    async clan(sock, sender, args) {
        const profile = await getUserProfile(sock, sender);
        if (!profile) return;
        
        // Initialize global clan system if needed
        global.clanSystem = global.clanSystem || {
            clans: new Map()
        };
        
        // View current clan or clan list
        if (args.length === 0 || args[0].toLowerCase() === 'list') {
            // Check if user is in a clan
            let userClan = null;
            let userRole = null;
            
            for (const [clanName, clan] of global.clanSystem.clans.entries()) {
                if (clan.leader === sender) {
                    userClan = clan;
                    userRole = 'leader';
                    break;
                } else if (clan.officers.includes(sender)) {
                    userClan = clan;
                    userRole = 'officer';
                    break;
                } else if (clan.members.includes(sender)) {
                    userClan = clan;
                    userRole = 'member';
                    break;
                }
            }
            
            if (userClan && args.length === 0) {
                // Display user's clan info
                let clanText = `*👥 Clan: ${userClan.name}*\n\n`;
                clanText += `Level: ${userClan.level}\n`;
                clanText += `Members: ${userClan.members.length + userClan.officers.length + 1}/50\n`;
                clanText += `Your Role: ${userRole.charAt(0).toUpperCase() + userRole.slice(1)}\n\n`;
                
                // Show leader
                const leaderProfile = userProfiles.get(userClan.leader);
                clanText += `Leader: ${leaderProfile ? leaderProfile.name : 'Unknown'}\n\n`;
                
                // Show officers
                if (userClan.officers.length > 0) {
                    clanText += `*Officers:*\n`;
                    for (const officerId of userClan.officers) {
                        const officerProfile = userProfiles.get(officerId);
                        clanText += `- ${officerProfile ? officerProfile.name : 'Unknown'}\n`;
                    }
                    clanText += '\n';
                }
                
                // Show description
                if (userClan.description) {
                    clanText += `*Description:*\n${userClan.description}\n\n`;
                }
                
                clanText += 'Commands:\n.clan chat [message] - Send message to clan\n.clan leave - Leave your clan';
                
                if (userRole === 'leader' || userRole === 'officer') {
                    clanText += '\n.clan invite @user - Invite a user\n.clan kick @user - Remove a member';
                }
                
                if (userRole === 'leader') {
                    clanText += '\n.clan promote @user - Promote to officer\n.clan demote @user - Demote an officer\n.clan setdesc [text] - Set clan description';
                }
                
                await sock.sendMessage(sender, { text: clanText });
                return;
            } else if (args[0]?.toLowerCase() === 'list') {
                // Show list of all clans
                if (global.clanSystem.clans.size === 0) {
                    await sock.sendMessage(sender, {
                        text: '*👥 Clans:* No clans have been created yet. Use .clan create [name] to create one!'
                    });
                    return;
                }
                
                let clanListText = '*👥 Active Clans:*\n\n';
                
                for (const [clanName, clan] of global.clanSystem.clans.entries()) {
                    const memberCount = clan.members.length + clan.officers.length + 1;
                    const leaderProfile = userProfiles.get(clan.leader);
                    
                    clanListText += `*${clanName}*\n`;
                    clanListText += `Level: ${clan.level}\n`;
                    clanListText += `Members: ${memberCount}/50\n`;
                    clanListText += `Leader: ${leaderProfile ? leaderProfile.name : 'Unknown'}\n\n`;
                }
                
                clanListText += 'Use .clan join [name] to join a clan or .clan create [name] to create your own.';
                
                await sock.sendMessage(sender, { text: clanListText });
                return;
            } else {
                // User not in a clan
                await sock.sendMessage(sender, {
                    text: '*👥 Clan:* You are not in a clan.\n\nUse .clan list to see available clans, .clan join [name] to join one, or .clan create [name] to create your own.'
                });
                return;
            }
        }
        
        // Create a new clan
        if (args[0].toLowerCase() === 'create') {
            if (args.length < 2) {
                await sock.sendMessage(sender, {
                    text: '*⚠️ Usage:* .clan create [name]'
                });
                return;
            }
            
            // Check if user is already in a clan
            for (const [clanName, clan] of global.clanSystem.clans.entries()) {
                if (clan.leader === sender || clan.officers.includes(sender) || clan.members.includes(sender)) {
                    await sock.sendMessage(sender, {
                        text: '*❌ Error:* You are already in a clan. Leave your current clan first with .clan leave.'
                    });
                    return;
                }
            }
            
            // Check if clan name already exists
            const clanName = args.slice(1).join(' ');
            
            if (clanName.length > 20) {
                await sock.sendMessage(sender, {
                    text: '*❌ Error:* Clan name must be 20 characters or less.'
                });
                return;
            }
            
            if (global.clanSystem.clans.has(clanName.toLowerCase())) {
                await sock.sendMessage(sender, {
                    text: '*❌ Error:* A clan with this name already exists. Choose a different name.'
                });
                return;
            }
            
            // Check if player has enough coins
            const creationCost = 10000;
            
            if (profile.coins < creationCost) {
                await sock.sendMessage(sender, {
                    text: `*❌ Error:* You need ${formatNumber(creationCost)} coins to create a clan. You have ${formatNumber(profile.coins)} coins.`
                });
                return;
            }
            
            // Deduct creation cost
            profile.coins -= creationCost;
            
            // Create clan
            const newClan = {
                name: clanName,
                leader: sender,
                officers: [],
                members: [],
                level: 1,
                treasury: 0,
                description: '',
                createdAt: Date.now()
            };
            
            global.clanSystem.clans.set(clanName.toLowerCase(), newClan);
            
            // Save profile
            userProfiles.set(sender, profile);
            
            await sock.sendMessage(sender, {
                text: `*👥 Clan Created:* You've successfully created the clan "${clanName}"!\n\nYou are the clan leader. Use .clan setdesc [text] to set a description and .clan invite @user to invite members.`
            });
            return;
        }
        
        // Join a clan
        if (args[0].toLowerCase() === 'join') {
            if (args.length < 2) {
                await sock.sendMessage(sender, {
                    text: '*⚠️ Usage:* .clan join [name]'
                });
                return;
            }
            
            // Check if user is already in a clan
            for (const [clanName, clan] of global.clanSystem.clans.entries()) {
                if (clan.leader === sender || clan.officers.includes(sender) || clan.members.includes(sender)) {
                    await sock.sendMessage(sender, {
                        text: '*❌ Error:* You are already in a clan. Leave your current clan first with .clan leave.'
                    });
                    return;
                }
            }
            
            // Find clan
            const clanName = args.slice(1).join(' ').toLowerCase();
            const clan = global.clanSystem.clans.get(clanName);
            
            if (!clan) {
                await sock.sendMessage(sender, {
                    text: '*❌ Error:* Clan not found. Use .clan list to see available clans.'
                });
                return;
            }
            
            // Check if clan is full
            const memberCount = clan.members.length + clan.officers.length + 1;
            if (memberCount >= 50) {
                await sock.sendMessage(sender, {
                    text: '*❌ Error:* This clan is already at maximum capacity (50 members).'
                });
                return;
            }
            
            // Join the clan
            clan.members.push(sender);
            
            // Notify leader
            await sock.sendMessage(clan.leader, {
                text: `*👥 Clan Update:* ${profile.name} has joined your clan!`
            });
            
            await sock.sendMessage(sender, {
                text: `*👥 Clan Joined:* You have successfully joined the clan "${clan.name}"!`
            });
            return;
        }
        
        // Leave current clan
        if (args[0].toLowerCase() === 'leave') {
            let userClan = null;
            let userRole = null;
            let clanName = null;
            
            for (const [name, clan] of global.clanSystem.clans.entries()) {
                if (clan.leader === sender) {
                    userClan = clan;
                    userRole = 'leader';
                    clanName = name;
                    break;
                } else if (clan.officers.includes(sender)) {
                    userClan = clan;
                    userRole = 'officer';
                    clanName = name;
                    break;
                } else if (clan.members.includes(sender)) {
                    userClan = clan;
                    userRole = 'member';
                    clanName = name;
                    break;
                }
            }
            
            if (!userClan) {
                await sock.sendMessage(sender, {
                    text: '*❌ Error:* You are not in a clan.'
                });
                return;
            }
            
            if (userRole === 'leader') {
                // Leader is leaving - disband the clan or transfer leadership
                if (userClan.officers.length > 0) {
                    // Transfer to first officer
                    const newLeaderId = userClan.officers[0];
                    userClan.leader = newLeaderId;
                    userClan.officers.splice(0, 1);
                    
                    // Notify new leader
                    const newLeaderProfile = userProfiles.get(newLeaderId);
                    await sock.sendMessage(newLeaderId, {
                        text: `*👑 Leadership Transferred:* ${profile.name} has left the clan and transferred leadership to you!`
                    });
                    
                    await sock.sendMessage(sender, {
                        text: `*👥 Clan Left:* You have left the clan "${userClan.name}" and transferred leadership to ${newLeaderProfile ? newLeaderProfile.name : 'another member'}.`
                    });
                } else if (userClan.members.length > 0) {
                    // Transfer to first member
                    const newLeaderId = userClan.members[0];
                    userClan.leader = newLeaderId;
                    userClan.members.splice(0, 1);
                    
                    // Notify new leader
                    const newLeaderProfile = userProfiles.get(newLeaderId);
                    await sock.sendMessage(newLeaderId, {
                        text: `*👑 Leadership Transferred:* ${profile.name} has left the clan and transferred leadership to you!`
                    });
                    
                    await sock.sendMessage(sender, {
                        text: `*👥 Clan Left:* You have left the clan "${userClan.name}" and transferred leadership to ${newLeaderProfile ? newLeaderProfile.name : 'another member'}.`
                    });
                } else {
                    // No other members, disband the clan
                    global.clanSystem.clans.delete(clanName);
                    
                    await sock.sendMessage(sender, {
                        text: `*👥 Clan Disbanded:* As you were the only member, the clan "${userClan.name}" has been disbanded.`
                    });
                }
            } else if (userRole === 'officer') {
                // Remove from officers
                userClan.officers = userClan.officers.filter(id => id !== sender);
                
                // Notify leader
                await sock.sendMessage(userClan.leader, {
                    text: `*👥 Clan Update:* ${profile.name}, an officer, has left your clan.`
                });
                
                await sock.sendMessage(sender, {
                    text: `*👥 Clan Left:* You have left the clan "${userClan.name}".`
                });
            } else {
                // Remove from members
                userClan.members = userClan.members.filter(id => id !== sender);
                
                // Notify leader
                await sock.sendMessage(userClan.leader, {
                    text: `*👥 Clan Update:* ${profile.name} has left your clan.`
                });
                
                await sock.sendMessage(sender, {
                    text: `*👥 Clan Left:* You have left the clan "${userClan.name}".`
                });
            }
            
            return;
        }
        
        // Check if user is in a clan for other commands
        let userClan = null;
        let userRole = null;
        let clanName = null;
        
        for (const [name, clan] of global.clanSystem.clans.entries()) {
            if (clan.leader === sender) {
                userClan = clan;
                userRole = 'leader';
                clanName = name;
                break;
            } else if (clan.officers.includes(sender)) {
                userClan = clan;
                userRole = 'officer';
                clanName = name;
                break;
            } else if (clan.members.includes(sender)) {
                userClan = clan;
                userRole = 'member';
                clanName = name;
                break;
            }
        }
        
        if (!userClan) {
            await sock.sendMessage(sender, {
                text: '*❌ Error:* You are not in a clan. Use .clan list to see available clans or .clan create to create one.'
            });
            return;
        }
        
        // Clan chat
        if (args[0].toLowerCase() === 'chat') {
            if (args.length < 2) {
                await sock.sendMessage(sender, {
                    text: '*⚠️ Usage:* .clan chat [message]'
                });
                return;
            }
            
            const message = args.slice(1).join(' ');
            
            // Send message to all clan members
            const chatMessage = `*👥 [${userClan.name} Clan Chat]*\n${profile.name}: ${message}`;
            
            // Send to leader
            if (userClan.leader !== sender) {
                await sock.sendMessage(userClan.leader, { text: chatMessage });
            }
            
            // Send to officers
            for (const officerId of userClan.officers) {
                if (officerId !== sender) {
                    await sock.sendMessage(officerId, { text: chatMessage });
                }
            }
            
            // Send to members
            for (const memberId of userClan.members) {
                if (memberId !== sender) {
                    await sock.sendMessage(memberId, { text: chatMessage });
                }
            }
            
            // Confirmation to sender
            await sock.sendMessage(sender, {
                text: `*👥 Message Sent:* Your message has been sent to all clan members.`
            });
            return;
        }
        
        // Leader/officer commands
        if (userRole !== 'leader' && userRole !== 'officer') {
            await sock.sendMessage(sender, {
                text: '*❌ Error:* You must be a clan leader or officer to use this command.'
            });
            return;
        }
        
        // Invite a user
        if (args[0].toLowerCase() === 'invite') {
            if (args.length < 2) {
                await sock.sendMessage(sender, {
                    text: '*⚠️ Usage:* .clan invite @user'
                });
                return;
            }
            
            const targetId = args[1].replace('@', '') + '@s.whatsapp.net';
            
            // Check if target has a profile
            const targetProfile = userProfiles.get(targetId);
            if (!targetProfile) {
                await sock.sendMessage(sender, {
                    text: '*❌ Error:* That user doesn\'t have a profile yet.'
                });
                return;
            }
            
            // Check if clan is full
            const memberCount = userClan.members.length + userClan.officers.length + 1;
            if (memberCount >= 50) {
                await sock.sendMessage(sender, {
                    text: '*❌ Error:* Your clan is already at maximum capacity (50 members).'
                });
                return;
            }
            
            // Check if user is already in the clan
            if (userClan.leader === targetId || userClan.officers.includes(targetId) || userClan.members.includes(targetId)) {
                await sock.sendMessage(sender, {
                    text: '*❌ Error:* That user is already in your clan.'
                });
                return;
            }
            
            // Check if user is in another clan
            let targetInClan = false;
            for (const [name, clan] of global.clanSystem.clans.entries()) {
                if (clan.leader === targetId || clan.officers.includes(targetId) || clan.members.includes(targetId)) {
                    targetInClan = true;
                    break;
                }
            }
            
            if (targetInClan) {
                await sock.sendMessage(sender, {
                    text: '*❌ Error:* That user is already in another clan.'
                });
                return;
            }
            
            // Send invitation
            await sock.sendMessage(targetId, {
                text: `*👥 Clan Invitation:*\n\n${profile.name} has invited you to join the clan "${userClan.name}"!\n\nUse .clan join ${clanName} to accept the invitation.`
            });
            
            await sock.sendMessage(sender, {
                text: `*👥 Invitation Sent:* You've invited ${targetProfile.name} to join your clan.`
            });
            return;
        }
        
        // Kick a member
        if (args[0].toLowerCase() === 'kick') {
            if (args.length < 2) {
                await sock.sendMessage(sender, {
                    text: '*⚠️ Usage:* .clan kick @user'
                });
                return;
            }
            
            const targetId = args[1].replace('@', '') + '@s.whatsapp.net';
            
            // Check permissions
            if (userRole === 'officer' && userClan.leader === targetId) {
                await sock.sendMessage(sender, {
                    text: '*❌ Error:* You cannot kick the clan leader.'
                });
                return;
            }
            
            if (userRole === 'officer' && userClan.officers.includes(targetId)) {
                await sock.sendMessage(sender, {
                    text: '*❌ Error:* Officers cannot kick other officers.'
                });
                return;
            }
            
            // Check if target is in the clan
            let targetRole = null;
            if (userClan.leader === targetId) {
                targetRole = 'leader';
            } else if (userClan.officers.includes(targetId)) {
                targetRole = 'officer';
            } else if (userClan.members.includes(targetId)) {
                targetRole = 'member';
            }
            
            if (!targetRole) {
                await sock.sendMessage(sender, {
                    text: '*❌ Error:* That user is not in your clan.'
                });
                return;
            }
            
            // Kick the user
            if (targetRole === 'officer') {
                userClan.officers = userClan.officers.filter(id => id !== targetId);
            } else {
                userClan.members = userClan.members.filter(id => id !== targetId);
            }
            
            // Get target name
            const targetProfile = userProfiles.get(targetId);
            const targetName = targetProfile ? targetProfile.name : 'the user';
            
            // Notify target
            await sock.sendMessage(targetId, {
                text: `*👥 Clan Notification:* You have been removed from the clan "${userClan.name}" by ${profile.name}.`
            });
            
            await sock.sendMessage(sender, {
                text: `*👥 Member Removed:* You have removed ${targetName} from your clan.`
            });
            return;
        }
        
        // Leader-only commands
        if (userRole !== 'leader') {
            await sock.sendMessage(sender, {
                text: '*❌ Error:* You must be the clan leader to use this command.'
            });
            return;
        }
        
        // Promote a member to officer
        if (args[0].toLowerCase() === 'promote') {
            if (args.length < 2) {
                await sock.sendMessage(sender, {
                    text: '*⚠️ Usage:* .clan promote @user'
                });
                return;
            }
            
            const targetId = args[1].replace('@', '') + '@s.whatsapp.net';
            
            // Check if target is a member
            if (!userClan.members.includes(targetId)) {
                await sock.sendMessage(sender, {
                    text: '*❌ Error:* That user is not a member of your clan or is already an officer.'
                });
                return;
            }
            
            // Promote to officer
            userClan.members = userClan.members.filter(id => id !== targetId);
            userClan.officers.push(targetId);
            
            // Get target name
            const targetProfile = userProfiles.get(targetId);
            const targetName = targetProfile ? targetProfile.name : 'the user';
            
            // Notify target
            await sock.sendMessage(targetId, {
                text: `*👥 Clan Promotion:* You have been promoted to officer in the clan "${userClan.name}"!`
            });
            
            await sock.sendMessage(sender, {
                text: `*👥 Member Promoted:* You have promoted ${targetName} to officer.`
            });
            return;
        }
        
        // Demote an officer to member
        if (args[0].toLowerCase() === 'demote') {
            if (args.length < 2) {
                await sock.sendMessage(sender, {
                    text: '*⚠️ Usage:* .clan demote @user'
                });
                return;
            }
            
            const targetId = args[1].replace('@', '') + '@s.whatsapp.net';
            
            // Check if target is an officer
            if (!userClan.officers.includes(targetId)) {
                await sock.sendMessage(sender, {
                    text: '*❌ Error:* That user is not an officer in your clan.'
                });
                return;
            }
            
            // Demote to member
            userClan.officers = userClan.officers.filter(id => id !== targetId);
            userClan.members.push(targetId);
            
            // Get target name
            const targetProfile = userProfiles.get(targetId);
            const targetName = targetProfile ? targetProfile.name : 'the user';
            
            // Notify target
            await sock.sendMessage(targetId, {
                text: `*👥 Clan Demotion:* You have been demoted from officer to member in the clan "${userClan.name}".`
            });
            
            await sock.sendMessage(sender, {
                text: `*👥 Officer Demoted:* You have demoted ${targetName} to member.`
            });
            return;
        }
        
        // Set clan description
        if (args[0].toLowerCase() === 'setdesc') {
            if (args.length < 2) {
                await sock.sendMessage(sender, {
                    text: '*⚠️ Usage:* .clan setdesc [description]'
                });
                return;
            }
            
            const description = args.slice(1).join(' ');
            
            if (description.length > 200) {
                await sock.sendMessage(sender, {
                    text: '*❌ Error:* Clan description must be 200 characters or less.'
                });
                return;
            }
            
            // Set description
            userClan.description = description;
            
            await sock.sendMessage(sender, {
                text: `*👥 Description Updated:* You have updated your clan's description.`
            });
            return;
        }
        
        // Unknown command
        await sock.sendMessage(sender, {
            text: '*⚠️ Usage:* .clan [list|create|join|leave|chat|invite|kick|promote|demote|setdesc]'
        });
    },
    
    category: 'user',
    async init() {
        try {
            logger.info('Initializing user extended command handler...');
            await initDirectories();
            return true;
        } catch (err) {
            logger.error('Failed to initialize user extended command handler:', err);
            return false;
        }
    }
};