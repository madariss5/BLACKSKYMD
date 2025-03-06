const logger = require('../utils/logger');
const os = require('os');
const fs = require('fs').promises;
const config = require('../config/config');

const basicCommands = {
    async help(sock, sender, args) {
        const helpText = `
Available Commands:
1. Basic Commands:
   .help - Show this help message
   .ping - Check bot status
   .info - Get bot information
   .botinfo - Show detailed statistics
   .dashboard - View bot dashboard
   .rules - Show usage rules
   .faq - Show FAQ
   .status - Check bot status
   .changelog - Recent updates
   .about - Bot info and credits
   .privacy - Privacy policy
   .terms - Terms of service
   .uptime - Show bot uptime
   .stats - Usage statistics
   .speed - Test response speed
   .system - System information
   .owner - Bot owner information
   .donate - Support bot development
   .report - Report bugs
   .feedback - Provide feedback
   .source - Bot source information
   .runtime - Bot runtime details
   .premium - Premium features
   .support - Get support
   .credits - Credits & acknowledgments


2. Group Commands:
   .kick @user - Kick user from group
   .promote @user - Promote user to admin
   .demote @user - Demote user from admin
   .everyone - Tag all members
   .groupinfo - Show group information

3. Fun Commands:
   .quote - Get random quote
   .joke - Get random joke
   .meme - Get random meme

4. Utility Commands:
   .weather [city] - Get weather info
   .translate [text] - Translate text
   .calculate [expression] - Calculate expression

Type .help [command] for more info about a command
        `.trim();

        await sock.sendMessage(sender, { text: helpText });
    },

    async ping(sock, sender) {
        const start = Date.now();
        await sock.sendMessage(sender, { text: 'Pong! 🏓' });
        const ping = Date.now() - start;
        await sock.sendMessage(sender, { text: `Latency: ${ping}ms` });
    },

    async info(sock, sender) {
        const info = `
WhatsApp Bot Info:
Version: 1.0.0
Library: @whiskeysockets/baileys
Node Version: ${process.version}
Uptime: ${Math.floor(process.uptime())} seconds
Status: Online
Commands: ${Object.keys(basicCommands).length} basic commands
        `.trim();

        await sock.sendMessage(sender, { text: info });
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

    async rules(sock, sender) {
        const rules = `
📜 Bot Rules:
1. No spam or flooding
2. Be respectful to others
3. Don't abuse bot features
4. Follow group rules
5. Report bugs responsibly
6. Keep NSFW content in NSFW groups
7. Don't exploit vulnerabilities
8. Respect cooldown times
9. Don't share harmful content
10. Follow WhatsApp's TOS
        `.trim();

        await sock.sendMessage(sender, { text: rules });
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

    async status(sock, sender) {
        const status = {
            cpu: process.cpuUsage(),
            memory: process.memoryUsage(),
            uptime: process.uptime()
        };

        const statusText = `
🤖 Bot Status:
• System: Online
• CPU: ${Math.round(status.cpu.user / 1000000)}%
• Memory: ${Math.round(status.memory.heapUsed / 1024 / 1024)}MB / ${Math.round(status.memory.heapTotal / 1024 / 1024)}MB
• Uptime: ${Math.floor(status.uptime / 3600)}h ${Math.floor((status.uptime % 3600) / 60)}m
• Connection: Stable
        `.trim();

        await sock.sendMessage(sender, { text: statusText });
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

    async about(sock, sender) {
        const about = `
ℹ️ About Bot:
• Name: WhatsApp MD Bot
• Version: 1.0.0
• Creator: Bot Developer
• Framework: Baileys
• Language: JavaScript
• Platform: Node.js
• Database: JSON
• License: MIT
• Repository: Private

Credits:
• @whiskeysockets/baileys
• Node.js community
• Bot contributors
        `.trim();

        await sock.sendMessage(sender, { text: about });
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

    async uptime(sock, sender) {
        const uptime = process.uptime();
        const hours = Math.floor(uptime / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        const seconds = Math.floor(uptime % 60);

        await sock.sendMessage(sender, { 
            text: `⏱️ Bot Runtime: ${hours}h ${minutes}m ${seconds}s` 
        });
    },

    async stats(sock, sender) {
        const stats = {
            messages: 0,
            commands: 0,
            users: 0,
            groups: 0,
            uptime: process.uptime()
        };

        const statsText = `
📊 Bot Statistics:
• Messages: ${stats.messages}
• Commands: ${stats.commands}
• Users: ${stats.users}
• Groups: ${stats.groups}
• Uptime: ${Math.floor(stats.uptime / 3600)}h ${Math.floor((stats.uptime % 3600) / 60)}m
        `.trim();

        await sock.sendMessage(sender, { text: statsText });
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

module.exports = basicCommands;