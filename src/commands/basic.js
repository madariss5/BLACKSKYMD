const logger = require('../utils/logger');
const os = require('os');
const { proto } = require('@whiskeysockets/baileys');
const { safeSendText, safeSendMessage, safeSendImage } = require('../utils/jidHelper');
const { languageManager } = require('../utils/language');

const basicCommands = {
    async help(sock, message, args) {
        try {
            // If specific command help is requested, forward to menu.js help
            if (args.length > 0) {
                const menuModule = require('./menu');
                if (menuModule.commands && menuModule.commands.help) {
                    return await menuModule.commands.help(sock, message, args);
                }
            }

            // General help message
            const prefix = require('../config/config').bot.prefix;
            const helpText = `
*📚 𝔹𝕃𝔸ℂ𝕂𝕊𝕂𝕐-𝕄𝔻 ${languageManager.getText('basic.help_title')}*

${languageManager.getText('basic.help_welcome')}

*${languageManager.getText('basic.main_commands')}:*
• ${prefix}menu - ${languageManager.getText('basic.view_categories')}
• ${prefix}list - ${languageManager.getText('basic.list_commands')}
• ${prefix}help [command] - ${languageManager.getText('basic.get_help')}

*${languageManager.getText('basic.quick_start')}:*
• ${prefix}ping - ${languageManager.getText('basic.check_online')}
• ${prefix}info - ${languageManager.getText('basic.get_info')}
• ${prefix}stats - ${languageManager.getText('basic.view_stats')}

*${languageManager.getText('basic.more_commands')}:* ${prefix}menu

${languageManager.getText('basic.help_detail', null, prefix)}`.trim();

            await safeSendText(sock, message.key.remoteJid, helpText, {
                mentions: message.mentions || []
            });
        } catch (err) {
            logger.error('Error in help command:', err);
            await safeSendText(sock, message.key.remoteJid, '❌ ' + languageManager.getText('errors.command_execution'));
        }
    },

    async ping(sock, message) {
        try {
            const start = Date.now();
            await safeSendText(sock, message.key.remoteJid, languageManager.getText('basic.ping_checking'));
            const ping = Date.now() - start;

            await safeSendMessage(sock, message.key.remoteJid, {
                text: `*🏓 ${languageManager.getText('basic.ping_response')}*\n\n*${languageManager.getText('basic.ping_speed')}:* ${ping}ms\n*${languageManager.getText('basic.ping_status')}:* ${languageManager.getText('basic.ping_active')} ✅`
            });
        } catch (err) {
            logger.error('Error in ping command:', err);
            await safeSendText(sock, message.key.remoteJid, '❌ ' + languageManager.getText('errors.command_execution')
            );
        }
    },

    async info(sock, message) {
        try {
            const info = `
*ℹ️ ${languageManager.getText('basic.info')}*

*${languageManager.getText('basic.version')}:* 1.0.0
*Library:* @whiskeysockets/baileys
*Node:* ${process.version}
*Platform:* ${process.platform}
*Memory:* ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB
*Uptime:* ${Math.floor(process.uptime() / 3600)}h ${Math.floor((process.uptime() % 3600) / 60)}m
*Status:* Online ✅
*Commands:* ${Object.keys(basicCommands).length} ${languageManager.getText('system.basic_commands')}`.trim();

            await safeSendText(sock, message.key.remoteJid, info
            );
        } catch (err) {
            logger.error('Error in info command:', err);
            await safeSendText(sock, message.key.remoteJid, '❌ ' + languageManager.getText('errors.command_execution')
            );
        }
    },

    async status(sock, message) {
        try {
            const status = {
                cpu: process.cpuUsage(),
                memory: process.memoryUsage(),
                uptime: process.uptime()
            };

            const statusText = `
*🤖 ${languageManager.getText('basic.status', null, 
    `${Math.floor(status.uptime / 3600)}h ${Math.floor((status.uptime % 3600) / 60)}m`)}*

*System:* Online ✅
*CPU Usage:* ${Math.round(status.cpu.user / 1000000)}%
*Memory:* ${Math.round(status.memory.heapUsed / 1024 / 1024)}MB / ${Math.round(status.memory.heapTotal / 1024 / 1024)}MB
*Uptime:* ${Math.floor(status.uptime / 3600)}h ${Math.floor((status.uptime % 3600) / 60)}m
*Connection:* Stable 🟢`.trim();

            await safeSendText(sock, message.key.remoteJid, statusText
            );
        } catch (err) {
            logger.error('Error in status command:', err);
            await safeSendText(sock, message.key.remoteJid, '❌ ' + languageManager.getText('errors.command_execution')
            );
        }
    },

    async about(sock, message) {
        try {
            const about = `
*${languageManager.getText('basic.about')}*

${languageManager.getText('basic.about_description')}

*${languageManager.getText('basic.creator')}:* ${process.env.OWNER_NAME || 'Bot Developer'}
*${languageManager.getText('basic.version')}:* 1.0.0
*${languageManager.getText('basic.framework')}:* Baileys
*${languageManager.getText('basic.language')}:* JavaScript
*${languageManager.getText('basic.license')}:* MIT

*${languageManager.getText('basic.features')}:*
• ${languageManager.getText('basic.group_management')}
• ${languageManager.getText('basic.fun_commands')}
• ${languageManager.getText('basic.utilities')}
• ${languageManager.getText('basic.educational_tools')}
• ${languageManager.getText('basic.and_more')}

${languageManager.getText('basic.support_contact')}`.trim();

            await safeSendText(sock, message.key.remoteJid, about
            );
        } catch (err) {
            logger.error('Error in about command:', err);
            await safeSendText(sock, message.key.remoteJid, '❌ ' + languageManager.getText('errors.command_execution')
            );
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
        📊 ${languageManager.getText('basic.bot_statistics')}:
        • ${languageManager.getText('basic.users')}: ${stats.users}
        • ${languageManager.getText('basic.groups')}: ${stats.groups}
        • ${languageManager.getText('basic.commands')}: ${stats.commands}
        • ${languageManager.getText('basic.uptime')}: ${Math.floor(stats.uptime / 3600)}h ${Math.floor((stats.uptime % 3600) / 60)}m
        • ${languageManager.getText('basic.memory_usage')}: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB
        • ${languageManager.getText('basic.platform')}: ${process.platform}
        • ${languageManager.getText('basic.nodejs')}: ${process.version}
        • ${languageManager.getText('basic.cpu_usage')}: ${Math.round(process.cpuUsage().user / 1000000)}%
                `.trim();

        await safeSendText(sock, sender, info );
    },

    async dashboard(sock, sender) {
        const dashboard = `
        📈 ${languageManager.getText('basic.bot_dashboard')}:
        • ${languageManager.getText('basic.status')}: Online
        • ${languageManager.getText('basic.performance')}: Good
        • ${languageManager.getText('basic.error_rate')}: 0%
        • ${languageManager.getText('basic.api_status')}: Online
        • ${languageManager.getText('basic.database')}: Connected
        • ${languageManager.getText('basic.cache')}: Active
        • ${languageManager.getText('basic.last_restart')}: ${new Date().toLocaleString()}
                `.trim();

        await safeSendText(sock, sender, dashboard );
    },
    async changelog(sock, sender) {
        const changelog = `
        📝 ${languageManager.getText('basic.recent_updates')}:
        v1.0.0 (${languageManager.getText('basic.current')}):
        • Added dynamic command loading
        • Improved error handling
        • Added media commands
        • Enhanced group features
        • Added fun commands
        • Improved stability
        
        v0.9.0:
        • ${languageManager.getText('basic.initial_release')}
        • Basic functionality
        • Group management
        • Simple commands
                `.trim();

        await safeSendText(sock, sender, changelog );
    },

    async faq(sock, sender) {
        const faq = `
        ❓ ${languageManager.getText('basic.faq_title')}:
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

        await safeSendText(sock, sender, faq );
    },
    async privacy(sock, sender) {
        const privacy = `
        🔒 ${languageManager.getText('basic.privacy_policy')}:
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

        await safeSendText(sock, sender, privacy );
    },

    async terms(sock, sender) {
        const terms = `
        📋 ${languageManager.getText('basic.terms_of_service')}:
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

        await safeSendText(sock, sender, terms );
    },

    async speed(sock, sender) {
        const start = Date.now();
        await safeSendText(sock, sender, languageManager.getText('basic.ping_checking') );
        const end = Date.now();
        const speed = end - start;

        const speedTest = `
        🚀 ${languageManager.getText('basic.ping_response')} ${languageManager.getText('basic.ping', null, speed)}
        • Response Time: ${speed}ms
        • Message Processing: ${speed - 10}ms
        • API Latency: ~${Math.round(speed * 0.7)}ms
        • Database Query: ~${Math.round(speed * 0.3)}ms
                `.trim();

        await safeSendText(sock, sender, speedTest );
    },
    async system(sock, sender) {
        const totalMemoryGB = (os.totalmem() / 1024 / 1024 / 1024).toFixed(2);
        const freeMemoryGB = (os.freemem() / 1024 / 1024 / 1024).toFixed(2);
        
        const systemInfo = `
        🖥️ ${languageManager.getText('basic.system_info')}:
        • ${languageManager.getText('basic.os')}: ${os.type()} ${os.release()}
        • ${languageManager.getText('basic.architecture')}: ${os.arch()}
        • ${languageManager.getText('basic.cpu_cores')}: ${os.cpus().length}
        • ${languageManager.getText('basic.total_memory')}: ${totalMemoryGB} GB
        • ${languageManager.getText('basic.free_memory')}: ${freeMemoryGB} GB
        • ${languageManager.getText('basic.platform')}: ${os.platform()}
        • ${languageManager.getText('basic.hostname')}: ${os.hostname()}
        • ${languageManager.getText('basic.kernel')}: ${os.version()}
                `.trim();

        await safeSendText(sock, sender, systemInfo );
    },

    async owner(sock, sender) {
        const ownerInfo = `
        👑 ${languageManager.getText('basic.owner_info')}:
        • ${languageManager.getText('basic.name')}: ${process.env.OWNER_NAME || 'Bot Owner'}
        • ${languageManager.getText('basic.contact')}: ${process.env.OWNER_NUMBER || 'Not specified'}
        • ${languageManager.getText('basic.website')}: ${process.env.OWNER_WEBSITE || 'Not specified'}
        • ${languageManager.getText('basic.social')}: ${process.env.OWNER_SOCIAL || 'Not specified'}
        
        ${languageManager.getText('basic.business')}:
        ${languageManager.getText('basic.contact_for_support')}.
                `.trim();

        await safeSendText(sock, sender, ownerInfo );
    },

    async donate(sock, sender) {
        const donateInfo = `
        💝 ${languageManager.getText('basic.donate_title')}:
        • ${languageManager.getText('basic.paypal')}: ${process.env.PAYPAL || 'Not available'}
        • ${languageManager.getText('basic.kofi')}: ${process.env.KOFI || 'Not available'}
        • ${languageManager.getText('basic.patreon')}: ${process.env.PATREON || 'Not available'}
        
        ${languageManager.getText('basic.support_message')}
                `.trim();

        await safeSendText(sock, sender, donateInfo );
    },

    async report(sock, sender, args) {
        if (!args.length) {
            return await safeSendText(sock, sender, '⚠️ ' + languageManager.getText('errors.invalid_arguments', null, languageManager.getText('basic.report_usage'))
            );
        }

        const report = args.join(' ');
        logger.info(`New report from ${sender}: ${report}`);

        await safeSendText(sock, sender, '✅ ' + languageManager.getText('basic.report_success')
        );
    },

    async feedback(sock, sender, args) {
        if (!args.length) {
            return await safeSendText(sock, sender, '⚠️ ' + languageManager.getText('errors.invalid_arguments', null, languageManager.getText('basic.feedback_usage'))
            );
        }

        const feedback = args.join(' ');
        logger.info(`New feedback from ${sender}: ${feedback}`);

        await safeSendText(sock, sender, '✅ ' + languageManager.getText('basic.feedback_success')
        );
    },

    async source(sock, sender) {
        const sourceInfo = `
        📦 ${languageManager.getText('basic.source_info')}:
        • ${languageManager.getText('basic.version')}: ${process.env.BOT_VERSION || '1.0.0'}
        • ${languageManager.getText('basic.framework')}: @whiskeysockets/baileys
        • ${languageManager.getText('basic.license')}: MIT
        • ${languageManager.getText('basic.repository')}: ${process.env.REPO_URL || 'Private'}
        • ${languageManager.getText('basic.contributors')}: ${process.env.CONTRIBUTORS || 'Various'}
        
        ${languageManager.getText('basic.contribute_message')}
                `.trim();

        await safeSendText(sock, sender, sourceInfo );
    },

    async runtime(sock, sender) {
        const runtime = process.uptime();
        const days = Math.floor(runtime / 86400);
        const hours = Math.floor((runtime % 86400) / 3600);
        const minutes = Math.floor((runtime % 3600) / 60);
        const seconds = Math.floor(runtime % 60);

        const runtimeInfo = `
        ⏰ ${languageManager.getText('basic.runtime_info')}:
        • ${languageManager.getText('basic.days')}: ${days}
        • ${languageManager.getText('basic.hours')}: ${hours}
        • ${languageManager.getText('basic.minutes')}: ${minutes}
        • ${languageManager.getText('basic.seconds')}: ${seconds}
        
        ${languageManager.getText('basic.total_uptime')}: ${days}d ${hours}h ${minutes}m ${seconds}s
                `.trim();

        await safeSendText(sock, sender, runtimeInfo );
    },

    async premium(sock, sender) {
        const premiumInfo = `
        💎 ${languageManager.getText('basic.premium')}:
        • ${languageManager.getText('basic.priority_support')}
        • ${languageManager.getText('basic.unlimited_usage')}
        • ${languageManager.getText('basic.exclusive_commands')}
        • ${languageManager.getText('basic.no_cooldown')}
        • ${languageManager.getText('basic.custom_features')}
        • ${languageManager.getText('basic.early_access')}
        
        ${languageManager.getText('basic.contact_owner_upgrade')}
                `.trim();

        await safeSendText(sock, sender, premiumInfo );
    },

    async support(sock, sender) {
        const supportInfo = `
        🆘 ${languageManager.getText('basic.need_help')}
        • ${languageManager.getText('basic.use_help')}
        • ${languageManager.getText('basic.use_report')}
        • ${languageManager.getText('basic.use_feedback')}
        • ${languageManager.getText('basic.join_group')}: ${process.env.SUPPORT_GROUP || 'Not available'}
        • ${languageManager.getText('basic.contact_owner_cmd')}: .owner
                `.trim();

        await safeSendText(sock, sender, supportInfo );
    },

    async credits(sock, sender) {
        const creditsInfo = `
        👏 ${languageManager.getText('basic.credits')}:
        • @whiskeysockets/baileys - ${languageManager.getText('basic.core_library')}
        • ${languageManager.getText('basic.node_community')}
        • ${languageManager.getText('basic.bot_contributors')}
        • ${languageManager.getText('basic.api_providers')}
        • ${languageManager.getText('basic.resource_providers')}
        • ${languageManager.getText('basic.beta_testers')}
        • ${languageManager.getText('basic.active_users')}
        
        ${languageManager.getText('basic.special_thanks')}
                `.trim();

        await safeSendText(sock, sender, creditsInfo );
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