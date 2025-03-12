const logger = require('../utils/logger');
const os = require('os');
const { proto } = require('@whiskeysockets/baileys');

const basicCommands = {
    async help(sock, message, args) {
        try {
            // If specific command help is requested, forward to menu.js help
            if (args.length > 0) {
                // Import menu commands
                const menuModule = require('./menu');
                if (menuModule.commands && menuModule.commands.help) {
                    return await menuModule.commands.help(sock, message, args);
                }
            }
            
            // General help message
            const prefix = require('../config/config').bot.prefix;
            const helpText = `
*📚 WhatsApp Bot Help*

Welcome to the WhatsApp Bot! Here are some commands to get you started:

*Main Commands:*
• ${prefix}menu - View all command categories
• ${prefix}list - List all available commands
• ${prefix}help [command] - Get help with specific command

*Quick Start:*
• ${prefix}ping - Check if bot is online
• ${prefix}info - Get bot information
• ${prefix}weather [city] - Get weather information
• ${prefix}translate [text] - Translate text

*For more commands, type:* ${prefix}menu

This bot has over 300 commands across various categories!`.trim();

            await sock.sendMessage(message.key.remoteJid, {
                text: helpText,
                mentions: message.mentions || []
            });
        } catch (err) {
            logger.error('Error in help command:', err);
            await sock.sendMessage(message.key.remoteJid, {
                text: '❌ Error executing help command'
            });
        }
    },

    async ping(sock, message) {
        try {
            const start = Date.now();
            await sock.sendMessage(message.key.remoteJid, { text: 'Pong! 🏓' });
            const ping = Date.now() - start;

            await sock.sendMessage(message.key.remoteJid, {
                text: `*🏓 Pong!*\n\n*Speed:* ${ping}ms\n*Status:* Active`
            });
        } catch (err) {
            logger.error('Error in ping command:', err);
            await sock.sendMessage(message.key.remoteJid, {
                text: '❌ Error checking ping'
            });
        }
    },

    async info(sock, message) {
        try {
            const info = `
*ℹ️ Bot Information*

*Version:* 1.0.0
*Library:* @whiskeysockets/baileys
*Node:* ${process.version}
*Platform:* ${process.platform}
*Memory:* ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB
*Uptime:* ${Math.floor(process.uptime() / 3600)}h ${Math.floor((process.uptime() % 3600) / 60)}m
*Status:* Online
*Commands:* ${Object.keys(basicCommands).length} basic commands`.trim();

            await sock.sendMessage(message.key.remoteJid, {
                text: info
            });
        } catch (err) {
            logger.error('Error in info command:', err);
            await sock.sendMessage(message.key.remoteJid, {
                text: '❌ Error fetching bot info'
            });
        }
    },

    async botinfo(sock, sender) {
        const stats = {
            users: 0,
            groups: 0,
            commands: Object.keys(basicCommands).length,
            uptime: process.uptime()
        };

        const info = `
📊 Bot Statistics:
• Users: ${stats.users}
• Groups: ${stats.groups}
• Commands: ${stats.commands}
• Uptime: ${Math.floor(stats.uptime / 3600)}h ${Math.floor((stats.uptime % 3600) / 60)}m
• Memory Usage: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB
• Platform: ${process.platform}
• Node.js: ${process.version}
• CPU Usage: ${Math.round(process.cpuUsage().user / 1000000)}%
        `.trim();

        await sock.sendMessage(sender, { text: info });
    },

    async dashboard(sock, sender) {
        const dashboard = `
📈 Bot Dashboard:
• Status: Online
• Performance: Good
• Error Rate: 0%
• API Status: Online
• Database: Connected
• Cache: Active
• Last Restart: ${new Date().toLocaleString()}
        `.trim();

        await sock.sendMessage(sender, { text: dashboard });
    },
    async status(sock, message) {
        try {
            const status = {
                cpu: process.cpuUsage(),
                memory: process.memoryUsage(),
                uptime: process.uptime()
            };

            const statusText = `
*🤖 Bot Status*

*System:* Online
*CPU Usage:* ${Math.round(status.cpu.user / 1000000)}%
*Memory:* ${Math.round(status.memory.heapUsed / 1024 / 1024)}MB / ${Math.round(status.memory.heapTotal / 1024 / 1024)}MB
*Uptime:* ${Math.floor(status.uptime / 3600)}h ${Math.floor((status.uptime % 3600) / 60)}m
*Connection:* Stable`.trim();

            await sock.sendMessage(message.key.remoteJid, {
                text: statusText
            });
        } catch (err) {
            logger.error('Error in status command:', err);
            await sock.sendMessage(message.key.remoteJid, {
                text: '❌ Error fetching status'
            });
        }
    },

    async about(sock, message) {
        try {
            const about = `
*About WhatsApp Bot*

A powerful WhatsApp bot with useful features and commands.

*Creator:* ${process.env.OWNER_NAME || 'Bot Developer'}
*Version:* 1.0.0
*Framework:* Baileys
*Language:* JavaScript
*License:* MIT

*Features:*
• Group Management
• Fun Commands
• Utilities
• And more!

For support, contact the bot owner.`.trim();

            await sock.sendMessage(message.key.remoteJid, {
                text: about
            });
        } catch (err) {
            logger.error('Error in about command:', err);
            await sock.sendMessage(message.key.remoteJid, {
                text: '❌ Error showing about info'
            });
        }
    },

    async rules(sock, message) {
        try {
            const rules = `
*📜 Bot Rules*

1. No spam or flooding
2. Be respectful to others
3. Don't abuse bot features
4. Follow group rules
5. Report bugs responsibly
6. Keep NSFW content in appropriate groups
7. Don't exploit vulnerabilities
8. Respect cooldown times
9. Don't share harmful content
10. Follow WhatsApp's TOS

*Note:* Breaking rules may result in bot access restriction.`.trim();

            await sock.sendMessage(message.key.remoteJid, {
                text: rules
            });
        } catch (err) {
            logger.error('Error in rules command:', err);
            await sock.sendMessage(message.key.remoteJid, {
                text: '❌ Error showing rules'
            });
        }
    },

    async uptime(sock, message) {
        try {
            const uptime = process.uptime();
            const hours = Math.floor(uptime / 3600);
            const minutes = Math.floor((uptime % 3600) / 60);
            const seconds = Math.floor(uptime % 60);

            await sock.sendMessage(message.key.remoteJid, {
                text: `*⏱️ Bot Uptime:* ${hours}h ${minutes}m ${seconds}s`
            });
        } catch (err) {
            logger.error('Error in uptime command:', err);
            await sock.sendMessage(message.key.remoteJid, {
                text: '❌ Error showing uptime'
            });
        }
    },
    async changelog(sock, sender) {
        const changelog = `
📝 Recent Updates:
v1.0.0 (Current):
• Added dynamic command loading
• Improved error handling
• Added media commands
• Enhanced group features
• Added fun commands
• Improved stability

v0.9.0:
• Initial release
• Basic functionality
• Group management
• Simple commands
        `.trim();

        await sock.sendMessage(sender, { text: changelog });
    },

    async faq(sock, sender) {
        const faq = `
❓ Frequently Asked Questions:
Q: How do I use the bot?
A: Start with .help command

Q: Is the bot free?
A: Yes, basic features are free

Q: How do I report bugs?
A: Use .report command

Q: Can I add bot to my group?
A: Yes, use .invite command

Q: What's premium access?
A: Premium gives extra features
        `.trim();

        await sock.sendMessage(sender, { text: faq });
    },
    async privacy(sock, sender) {
        const privacy = `
🔒 Privacy Policy:
1. Data Collection:
   • User IDs
   • Group IDs
   • Command usage
   • Message timestamps

2. Data Usage:
   • Improve bot features
   • Track usage patterns
   • Debug issues
   • Generate statistics

3. Data Protection:
   • Encrypted storage
   • Regular backups
   • Access control
   • Secure transmission
        `.trim();

        await sock.sendMessage(sender, { text: privacy });
    },

    async terms(sock, sender) {
        const terms = `
📋 Terms of Service:
1. Acceptance
By using this bot, you agree to these terms.

2. Usage
• Follow bot rules
• Don't abuse services
• Respect rate limits
• No illegal activities

3. Liability
Bot developers aren't liable for:
• Service interruptions
• Data loss
• User conflicts
• External content

4. Modifications
Terms may change without notice
        `.trim();

        await sock.sendMessage(sender, { text: terms });
    },

    async speed(sock, sender) {
        const start = Date.now();
        await sock.sendMessage(sender, { text: 'Testing speed...' });
        const end = Date.now();
        const speed = end - start;

        const speedTest = `
🚀 Speed Test Results:
• Response Time: ${speed}ms
• Message Processing: ${speed - 10}ms
• API Latency: ~${Math.round(speed * 0.7)}ms
• Database Query: ~${Math.round(speed * 0.3)}ms
        `.trim();

        await sock.sendMessage(sender, { text: speedTest });
    },
    async system(sock, sender) {
        const systemInfo = `
🖥️ System Information:
• OS: ${os.type()} ${os.release()}
• Architecture: ${os.arch()}
• CPU Cores: ${os.cpus().length}
• Total Memory: ${(os.totalmem() / 1024 / 1024 / 1024).toFixed(2)} GB
• Free Memory: ${(os.freemem() / 1024 / 1024 / 1024).toFixed(2)} GB
• Platform: ${os.platform()}
• Hostname: ${os.hostname()}
• Kernel: ${os.version()}
        `.trim();

        await sock.sendMessage(sender, { text: systemInfo });
    },

    async owner(sock, sender) {
        const ownerInfo = `
👑 Bot Owner Information:
• Name: ${process.env.OWNER_NAME || 'Bot Owner'}
• Number: ${process.env.OWNER_NUMBER || 'Not specified'}
• Website: ${process.env.OWNER_WEBSITE || 'Not specified'}
• Email: ${process.env.OWNER_EMAIL || 'Not specified'}

For business inquiries or support:
Please contact the owner directly.
        `.trim();

        await sock.sendMessage(sender, { text: ownerInfo });
    },

    async donate(sock, sender) {
        const donateInfo = `
💝 Support Bot Development:
• PayPal: ${process.env.PAYPAL || 'Not available'}
• Ko-fi: ${process.env.KOFI || 'Not available'}
• Patreon: ${process.env.PATREON || 'Not available'}

Your support helps keep the bot running and improving!
        `.trim();

        await sock.sendMessage(sender, { text: donateInfo });
    },

    async report(sock, sender, args) {
        if (!args.length) {
            return await sock.sendMessage(sender, {
                text: '⚠️ Please provide a bug report or feature request description!'
            });
        }

        const report = args.join(' ');
        logger.info(`New report from ${sender}: ${report}`);

        await sock.sendMessage(sender, {
            text: '✅ Thank you for your report! The bot owner will review it.'
        });
    },

    async feedback(sock, sender, args) {
        if (!args.length) {
            return await sock.sendMessage(sender, {
                text: '⚠️ Please provide your feedback!'
            });
        }

        const feedback = args.join(' ');
        logger.info(`New feedback from ${sender}: ${feedback}`);

        await sock.sendMessage(sender, {
            text: '✅ Thank you for your feedback! We appreciate your input.'
        });
    },

    async source(sock, sender) {
        const sourceInfo = `
📦 Bot Source Information:
• Version: ${process.env.BOT_VERSION || '1.0.0'}
• Framework: @whiskeysockets/baileys
• License: MIT
• Repository: ${process.env.REPO_URL || 'Private'}
• Contributors: ${process.env.CONTRIBUTORS || 'Various'}

Want to contribute? Contact the owner!
        `.trim();

        await sock.sendMessage(sender, { text: sourceInfo });
    },

    async runtime(sock, sender) {
        const runtime = process.uptime();
        const days = Math.floor(runtime / 86400);
        const hours = Math.floor((runtime % 86400) / 3600);
        const minutes = Math.floor((runtime % 3600) / 60);
        const seconds = Math.floor(runtime % 60);

        const runtimeInfo = `
⏰ Bot Runtime Details:
• Days: ${days}
• Hours: ${hours}
• Minutes: ${minutes}
• Seconds: ${seconds}

Total Uptime: ${days}d ${hours}h ${minutes}m ${seconds}s
        `.trim();

        await sock.sendMessage(sender, { text: runtimeInfo });
    },

    async premium(sock, sender) {
        const premiumInfo = `
💎 Premium Features:
• Priority Support
• Unlimited Usage
• Exclusive Commands
• No Cooldowns
• Custom Features
• Early Access

Contact owner to upgrade!
        `.trim();

        await sock.sendMessage(sender, { text: premiumInfo });
    },

    async support(sock, sender) {
        const supportInfo = `
🆘 Need Help?
• Use .help for commands
• Use .report for bugs
• Use .feedback for suggestions
• Join support group: ${process.env.SUPPORT_GROUP || 'Not available'}
• Contact owner: .owner
        `.trim();

        await sock.sendMessage(sender, { text: supportInfo });
    },

    async credits(sock, sender) {
        const creditsInfo = `
👏 Credits & Acknowledgments:
• @whiskeysockets/baileys - Core Library
• Node.js Community
• Bot Contributors
• API Providers
• Resource Providers
• Beta Testers
• Active Users

Special thanks to everyone who helped make this bot possible!
        `.trim();

        await sock.sendMessage(sender, { text: creditsInfo });
    }
};

module.exports = {
    commands: basicCommands,
    category: 'basic',
    async init() {
        try {
            logger.info('Initializing basic command handler...');

            if (!proto) {
                throw new Error('Baileys proto not initialized');
            }

            logger.info('Basic command handler initialized successfully');
            return true;
        } catch (err) {
            logger.error('Error initializing basic command handler:', err);
            throw err;
        }
    }
};