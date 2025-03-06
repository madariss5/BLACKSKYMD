const logger = require('../utils/logger');
const { checkPermission } = require('../utils/permissions');

// Simulated database for user profiles (should be replaced with actual database)
const userProfiles = new Map();

const levelThresholds = [0, 100, 300, 600, 1000, 1500, 2100, 2800, 3600, 4500];

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