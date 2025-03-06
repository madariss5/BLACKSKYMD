const config = {
    // Bot Owner Info
    owner: {
        name: process.env.OWNER_NAME || 'Bot Owner',  
        number: process.env.OWNER_NUMBER || '',  // Format: 1234567890@s.whatsapp.net
        email: process.env.OWNER_EMAIL || '',
    },

    // Session Configuration
    session: {
        // Unique session ID for multi-device support
        id: process.env.SESSION_ID || 'whatsapp-md-bot',
        // Directory to store auth files
        authDir: './auth_info',
        // Backup session directory
        backupDir: './sessions',
    },

    // Bot Configuration
    bot: {
        name: process.env.BOT_NAME || 'WhatsApp MD Bot',
        version: process.env.BOT_VERSION || '1.0.0',
        prefix: process.env.BOT_PREFIX || '!',
        language: process.env.BOT_LANGUAGE || 'en',
    },

    // Server Configuration
    server: {
        port: process.env.PORT || 5000,
        host: '0.0.0.0',
    },

    // API Keys (Optional)
    apis: {
        openweather: process.env.OPENWEATHERMAP_API_KEY,
        google: process.env.GOOGLE_API_KEY,
        removebg: process.env.REMOVEBG_API_KEY,
        wolfram: process.env.WOLFRAM_APP_ID,
        news: process.env.NEWS_API_KEY,
    },

    // Other settings
    settings: {
        autoRead: true,
        autoTyping: true,
        autoRecord: false,
        backupInterval: 6 * 60 * 60 * 1000, // 6 hours
    }
};

module.exports = config;
