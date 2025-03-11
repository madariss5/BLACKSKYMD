const { processCommand } = require('./commandHandler');
const logger = require('../utils/logger');
const config = require('../config/config');
const levelingSystem = require('../utils/levelingSystem');
const userDatabase = require('../utils/userDatabase');

// Cache for help messages to prevent spam
const helpMessageCache = new Map();
const HELP_MESSAGE_COOLDOWN = 5 * 60 * 1000; // 5 minutes

// Handle level up event
async function handleLevelUp(sock, sender, levelUpData, userData) {
    if (!levelUpData) return;
    
    try {
        // Check if user has enabled level up notifications
        if (!levelingSystem.hasLevelUpNotificationEnabled(sender)) return;
        
        // Add achievements for level milestones
        if (userData) {
            userData.achievements = userData.achievements || [];
            
            // Check for level achievements
            if (levelUpData.newLevel >= 5) {
                if (!userData.achievements.includes('Leveling Up')) {
                    userData.achievements.push('Leveling Up');
                    userDatabase.updateUserProfile(sender, { achievements: userData.achievements });
                }
            }
            
            if (levelUpData.newLevel >= 10) {
                if (!userData.achievements.includes('Pro User')) {
                    userData.achievements.push('Pro User');
                    userDatabase.updateUserProfile(sender, { achievements: userData.achievements });
                }
            }
            
            if (levelUpData.newLevel >= 25) {
                if (!userData.achievements.includes('Dedicated User')) {
                    userData.achievements.push('Dedicated User');
                    userDatabase.updateUserProfile(sender, { achievements: userData.achievements });
                }
            }
        }
        
        // Create level up message
        const levelUpMessage = `
🎉 *Level Up!*
        
Congratulations! You've reached level ${levelUpData.newLevel}!
🏆 +${levelUpData.coinReward} coins added to your balance
⭐ Keep chatting to earn more XP
        
Current XP: ${levelUpData.totalXp}
Next level: ${levelUpData.requiredXp} XP needed
        `.trim();
        
        // Send level up notification
        await sock.sendMessage(sender, { text: levelUpMessage });
        
        // Generate and send level card for every 5 levels
        if (levelUpData.newLevel % 5 === 0 && userData) {
            try {
                const cardPath = await levelingSystem.generateLevelCard(sender, userData);
                if (cardPath) {
                    await sock.sendMessage(sender, {
                        image: { url: cardPath },
                        caption: `🏆 Level ${levelUpData.newLevel} Achievement Unlocked!`
                    });
                }
            } catch (err) {
                logger.error('Error generating level card:', err);
            }
        }
    } catch (error) {
        logger.error('Error sending level up notification:', error);
    }
}

// Detect message type for XP calculation
function getMessageType(message) {
    if (message.message?.imageMessage || message.message?.stickerMessage) {
        return 'media';
    }
    
    if (message.message?.audioMessage || message.message?.videoMessage) {
        return 'voice';
    }
    
    if (message.message?.conversation || message.message?.extendedTextMessage) {
        return 'message';
    }
    
    return 'message'; // Default
}

async function messageHandler(sock, message) {
    try {
        // Extract message content with support for different message types
        const messageContent = message.message?.conversation || 
                           message.message?.extendedTextMessage?.text || 
                           message.message?.imageMessage?.caption ||
                           message.message?.videoMessage?.caption;

        // Get sender information
        const sender = message.key.remoteJid;
        const isGroup = sender.endsWith('@g.us');
        const prefix = config.bot.prefix || '.';
        const fromMe = message.key.fromMe;
        
        // Skip processing messages from self
        if (fromMe) return;
        
        // Get user ID - for groups, we need participant (sender)
        let userId = sender;
        if (isGroup && message.participant) {
            userId = message.participant;
        }
        
        // Get user profile for the sender if they are registered
        const userData = userDatabase.getUserProfile(userId);
        
        // Track activity and award XP if user is registered
        if (userData && !fromMe) {
            // Determine activity type
            let activityType = getMessageType(message);
            
            // If it's a command, use the command type instead
            if (messageContent && messageContent.startsWith(prefix)) {
                activityType = 'command';
            }
            
            // Add XP and check for level up
            const levelUpData = levelingSystem.addXP(userId, activityType);
            
            // Handle level up event if it occurred
            if (levelUpData) {
                await handleLevelUp(sock, userId, levelUpData, userData);
            }
        } else if (!fromMe) {
            // Auto-register new users with minimal details so they can start earning XP
            userDatabase.initializeUserProfile(userId, {
                name: 'User', // Default name, they can update it later
                registeredAt: new Date().toISOString()
            });
            
            logger.info(`Auto-registered new user: ${userId}`);
        }

        // Process message if it contains content
        if (!messageContent) return;

        // Check if message starts with prefix
        if (messageContent.startsWith(prefix)) {
            const commandText = messageContent.slice(prefix.length).trim();
            if (commandText) {
                logger.info(`Processing command: ${commandText} from ${sender}`);
                try {
                    await processCommand(sock, message, commandText);
                } catch (err) {
                    logger.error('Error processing command:', err);
                    await sock.sendMessage(sender, { 
                        text: '❌ Error processing command. Please try again.' 
                    });
                }
            }
        } else if (!isGroup && !fromMe) {
            // Check if we've sent a help message recently
            const now = Date.now();
            const lastHelpMessage = helpMessageCache.get(sender);

            if (!lastHelpMessage || (now - lastHelpMessage) > HELP_MESSAGE_COOLDOWN) {
                helpMessageCache.set(sender, now);
                const response = `Welcome! To use the bot, start your message with ${prefix}\nExample: ${prefix}help`;
                await sock.sendMessage(sender, { text: response });

                // Clean up old cache entries
                for (const [key, timestamp] of helpMessageCache.entries()) {
                    if (now - timestamp > HELP_MESSAGE_COOLDOWN * 2) { //Clean up older entries to prevent memory leaks.
                        helpMessageCache.delete(key);
                    }
                }
            }
        }

    } catch (err) {
        logger.error('Error in message handler:', err);
    }
}

module.exports = { messageHandler };