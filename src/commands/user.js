const logger = require('../utils/logger');

// Simulated database for user profiles (should be replaced with actual database)
const userProfiles = new Map();

const levelThresholds = [0, 100, 300, 600, 1000, 1500, 2100, 2800, 3600, 4500];

const userCommands = {
    async register(sock, sender, args) {
        const [name, age] = args;
        if (!name || !age || isNaN(age)) {
            await sock.sendMessage(sender, { 
                text: '📝 Registration Usage:\n!register [name] [age]\nExample: !register John 25' 
            });
            return;
        }

        if (userProfiles.has(sender)) {
            await sock.sendMessage(sender, { text: '❌ You are already registered!' });
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
            text: `✅ Successfully registered!\n\nName: ${name}\nAge: ${age}\nLevel: 1\nXP: 0` 
        });
    },

    async profile(sock, sender, args) {
        const targetUser = args[0] || sender;
        const profile = userProfiles.get(targetUser);

        if (!profile) {
            await sock.sendMessage(sender, { 
                text: targetUser === sender ? 
                    '❌ You are not registered! Use !register to create a profile.' :
                    '❌ User not found!'
            });
            return;
        }

        const profileText = `
📊 User Profile
👤 Name: ${profile.name}
📈 Level: ${profile.level}
⭐ XP: ${profile.xp}/${levelThresholds[profile.level]}
💰 Coins: ${profile.coins}
🎯 Age: ${profile.age}
🏆 Achievements: ${profile.achievements.length}
📝 Bio: ${profile.bio || 'No bio set'}
👑 Title: ${profile.customTitle || 'No title set'}

🕒 Registered: ${new Date(profile.registeredAt).toLocaleDateString()}
        `.trim();

        await sock.sendMessage(sender, { text: profileText });
    },

    async setbio(sock, sender, args) {
        const profile = userProfiles.get(sender);
        if (!profile) {
            await sock.sendMessage(sender, { text: '❌ You need to register first!' });
            return;
        }

        const bio = args.join(' ');
        if (!bio) {
            await sock.sendMessage(sender, { text: '📝 Please provide a bio text' });
            return;
        }

        profile.bio = bio;
        await sock.sendMessage(sender, { text: '✅ Bio updated successfully!' });
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

    async daily(sock, sender) {
        const profile = userProfiles.get(sender);
        if (!profile) {
            await sock.sendMessage(sender, { text: '❌ You need to register first!' });
            return;
        }

        const now = new Date();
        const lastDaily = profile.lastDaily ? new Date(profile.lastDaily) : null;

        if (lastDaily && now.getDate() === lastDaily.getDate()) {
            await sock.sendMessage(sender, { text: '⏰ You already claimed your daily reward!' });
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

        await sock.sendMessage(sender, {
            text: `🎁 Daily Reward Claimed!\n\n⭐ +${xpReward} XP\n💰 +${coinsReward} coins`
        });

        // Send level up message if applicable
        if (profile.level > 1) {
            await sock.sendMessage(sender, {
                text: `🎉 Level Up! You are now level ${profile.level}!`
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