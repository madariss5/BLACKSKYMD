const { processCommand } = require('./commandHandler');
const logger = require('../utils/logger');
const config = require('../config/config');
const levelingSystem = require('../utils/levelingSystem');
const userDatabase = require('../utils/userDatabase');
const { languageManager } = require('../utils/language');

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
        
        // Get user's preferred language or default to English
        const userLang = userData && userData.language ? userData.language : 'en';
        
        // Try to get level up message from translations
        let levelUpTitle = languageManager.getText('leveling.level_up_title', userLang);
        let levelUpCongrats = languageManager.getText('leveling.congrats', userLang);
        let levelUpReward = languageManager.getText('leveling.coin_reward', userLang);
        let levelUpTip = languageManager.getText('leveling.xp_tip', userLang);
        let levelUpCurrent = languageManager.getText('leveling.current_xp', userLang);
        let levelUpNext = languageManager.getText('leveling.next_level', userLang);
        
        // If translations are missing, fall back to keys (which helps identify missing translations)
        if (levelUpTitle === 'leveling.level_up_title') levelUpTitle = 'Level Up!';
        if (levelUpCongrats === 'leveling.congrats') levelUpCongrats = 'Congratulations! You\'ve reached level %s!';
        if (levelUpReward === 'leveling.coin_reward') levelUpReward = '+%s coins added to your balance';
        if (levelUpTip === 'leveling.xp_tip') levelUpTip = 'Keep chatting to earn more XP';
        if (levelUpCurrent === 'leveling.current_xp') levelUpCurrent = 'Current XP: %s';
        if (levelUpNext === 'leveling.next_level') levelUpNext = 'Next level: %s XP needed';
        
        // Format the strings with the values
        levelUpCongrats = levelUpCongrats.replace('%s', levelUpData.newLevel);
        levelUpReward = levelUpReward.replace('%s', levelUpData.coinReward);
        levelUpCurrent = levelUpCurrent.replace('%s', levelUpData.totalXp);
        levelUpNext = levelUpNext.replace('%s', levelUpData.requiredXp);
        
        // Create level up message
        const levelUpMessage = `
🎉 *${levelUpTitle}*
        
${levelUpCongrats}
🏆 ${levelUpReward}
⭐ ${levelUpTip}
        
${levelUpCurrent}
${levelUpNext}
        `.trim();
        
        // Send level up notification
        await sock.sendMessage(sender, { text: levelUpMessage });
        
        // Generate and send level card for every 5 levels
        if (levelUpData.newLevel % 5 === 0 && userData) {
            try {
                const cardPath = await levelingSystem.generateLevelCard(sender, userData);
                if (cardPath) {
                    // Try to get the achievement message from translations
                    let achievementText = languageManager.getText('leveling.achievement_unlocked', userLang);
                    if (achievementText === 'leveling.achievement_unlocked') {
                        achievementText = 'Level %s Achievement Unlocked!';
                    }
                    achievementText = achievementText.replace('%s', levelUpData.newLevel);
                    
                    await sock.sendMessage(sender, {
                        image: { url: cardPath },
                        caption: `🏆 ${achievementText}`
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
        // FAST PATH: Skip protocol messages immediately
        if (message.message?.protocolMessage) {
            return;
        }
        
        // Process messages even if they're marked as fromMe during testing
        if (message.key.fromMe) {
            // We continue execution instead of returning for testing
        }

        // Extract message content with optimized path for common types
        let messageContent;
        
        // Fast path for most common message types (ordered by frequency)
        if (message.message?.conversation) {
            messageContent = message.message.conversation;
        } else if (message.message?.extendedTextMessage?.text) {
            messageContent = message.message.extendedTextMessage.text;
        } else if (message.message?.imageMessage?.caption) {
            messageContent = message.message.imageMessage.caption;
        } else if (message.message?.videoMessage?.caption) {
            messageContent = message.message.videoMessage.caption;
        } else if (message.message?.documentWithCaptionMessage?.message?.documentMessage?.caption) {
            messageContent = message.message.documentWithCaptionMessage.message.documentMessage.caption;
        } else if (message.message?.buttonsResponseMessage?.selectedButtonId) {
            messageContent = message.message.buttonsResponseMessage.selectedButtonId;
        } else if (message.message?.listResponseMessage?.singleSelectReply?.selectedRowId) {
            messageContent = message.message.listResponseMessage.singleSelectReply.selectedRowId;
        } else {
            // For other message types that don't contain text
            messageContent = null;
        }

        // Get sender information
        const sender = message.key.remoteJid;
        if (!sender) {
            logger.warn('Message without remoteJid, skipping');
            return;
        }
        
        const isGroup = sender.endsWith('@g.us');
        const prefix = config.bot.prefix || '.';
        
        // Get user ID - for groups, we need participant (sender)
        let userId = sender;
        if (isGroup) {
            if (message.participant) {
                userId = message.participant;
            } else if (message.key.participant) {
                userId = message.key.participant;
            } else {
                logger.warn('Group message without participant ID, using group ID as fallback');
            }
        }
        
        // Get user profile for the sender if they are registered
        const userData = userDatabase.getUserProfile(userId);
        
        // Track activity and award XP if user is registered
        if (userData) {
            // Determine activity type
            let activityType = getMessageType(message);
            
            // If it's a command, use the command type instead
            if (messageContent && messageContent.startsWith(prefix)) {
                activityType = 'command';
            }
            
            // Add XP and check for level up (pass group JID if in a group)
            const groupJid = isGroup ? sender : null;
            const levelUpData = await levelingSystem.addXP(userId, activityType, groupJid);
            
            // Handle level up event if it occurred
            if (levelUpData) {
                await handleLevelUp(sock, userId, levelUpData, userData);
            }
        } else {
            // Auto-register new users with minimal details so they can start earning XP
            userDatabase.initializeUserProfile(userId, {
                name: 'User', // Default name, they can update it later
                registeredAt: new Date().toISOString()
            });
            
            logger.info(`Auto-registered new user: ${userId}`);
        }

        // FAST PATH: Skip empty messages immediately
        if (!messageContent) return;

        // FAST PATH: Command processing - highest priority
        if (messageContent.startsWith(prefix)) {
            const commandText = messageContent.slice(prefix.length).trim();
            if (commandText) {
                try {
                    // Process command directly without logging for speed
                    await processCommand(sock, message, commandText);
                } catch (err) {
                    // Minimal error response
                    await sock.sendMessage(sender, { 
                        text: '❌ Command failed. Try again.' 
                    });
                }
            }
            return; // Exit early after command processing
        } 
        
        // ONLY FOR DMs: Show welcome message with help info
        if (!isGroup) {
            const now = Date.now();
            const lastHelpMessage = helpMessageCache.get(sender);

            if (!lastHelpMessage || (now - lastHelpMessage) > HELP_MESSAGE_COOLDOWN) {
                helpMessageCache.set(sender, now);
                
                // Get welcome message in user's preferred language
                let welcomeMessage;
                if (userData && userData.language) {
                    // If user has a language preference, use it
                    const translationKey = 'system.welcome_message';
                    welcomeMessage = languageManager.getText(translationKey, userData.language, prefix);
                    
                    // If translation not found, fallback to a basic message
                    if (welcomeMessage === translationKey) {
                        welcomeMessage = `Use ${prefix}help to see available commands.`;
                    }
                } else {
                    // Default welcome message
                    welcomeMessage = `Use ${prefix}help to see available commands.`;
                    
                    // Add language suggestion if user doesn't have a language set
                    welcomeMessage += `\n\nTip: You can change the language with ${prefix}language`;
                }
                
                // Send welcome message
                await sock.sendMessage(sender, { text: welcomeMessage });
                
                // Clean cache in background
                setTimeout(() => {
                    try {
                        for (const [key, timestamp] of helpMessageCache.entries()) {
                            if (Date.now() - timestamp > HELP_MESSAGE_COOLDOWN * 2) {
                                helpMessageCache.delete(key);
                            }
                        }
                    } catch (e) {
                        // Ignore cache errors
                    }
                }, 0);
            }
        }

    } catch (err) {
        logger.error('Error in message handler:', err);
    }
}

module.exports = { messageHandler };