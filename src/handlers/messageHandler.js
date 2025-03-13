const { processCommand } = require('./commandHandler');
const logger = require('../utils/logger');
const config = require('../config/config');
const levelingSystem = require('../utils/levelingSystem');
const userDatabase = require('../utils/userDatabase');
const { languageManager } = require('../utils/language');
const reactionCommands = require('../commands/reactions');

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

// Handle message processing
async function messageHandler(sock, message) {
    try {
        // FAST PATH: Skip protocol messages immediately
        if (message.message?.protocolMessage) {
            return;
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

        // FAST PATH: Skip empty messages immediately
        if (!messageContent) return;

        // FAST PATH: Command processing - highest priority
        if (messageContent.startsWith(prefix)) {
            const commandText = messageContent.slice(prefix.length).trim();
            if (commandText) {
                logger.debug(`Processing command: ${commandText}`);
                try {
                    // Check if it's a reaction command
                    const [cmd, ...args] = commandText.split(' ');
                    if (reactionCommands[cmd]) {
                        logger.info(`Executing reaction command: ${cmd}`);
                        await reactionCommands[cmd](sock, sender, args);
                        return;
                    }

                    // Process other commands
                    await processCommand(sock, message, commandText);
                } catch (err) {
                    logger.error('Command execution failed:', err);
                    await sock.sendMessage(sender, { 
                        text: '❌ Command failed. Try again.' 
                    });
                }
            }
            return;
        }

        // Handle other message types...

    } catch (err) {
        logger.error('Error in message handler:', err);
    }
}

module.exports = { messageHandler, handleLevelUp };