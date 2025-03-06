require('dotenv').config();

const config = {
    // Bot Owner Info
    owner: {
        name: process.env.OWNER_NAME || 'Bot Owner',  
        number: process.env.OWNER_NUMBER || '',  // Format: 1234567890@s.whatsapp.net
        email: process.env.OWNER_EMAIL || '',
    },

    // Session Configuration
    session: {
        id: process.env.SESSION_ID || 'whatsapp-md-bot',
        authDir: './auth_info',
        backupDir: './sessions',
    },

    // Bot Configuration
    bot: {
        name: process.env.BOT_NAME || '𝔹𝕃𝔸ℂ𝕂𝕊𝕂𝕐-𝕄𝔻',
        version: process.env.BOT_VERSION || '1.0.0',
        prefix: process.env.BOT_PREFIX || '.',
        language: process.env.BOT_LANGUAGE || 'de', // Set default language to German
        debug: process.env.NODE_ENV !== 'production',
    },

    // Server Configuration (for potential web features)
    server: {
        port: process.env.PORT || 5000,
        host: '0.0.0.0',
    },

    // API Keys
    apis: {
        openweather: process.env.OPENWEATHERMAP_API_KEY,
        google: process.env.GOOGLE_API_KEY,
        removebg: process.env.REMOVEBG_API_KEY,
        wolfram: process.env.WOLFRAM_APP_ID,
        news: process.env.NEWS_API_KEY,
        spotify: {
            clientId: process.env.SPOTIFY_CLIENT_ID,
            clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
        }
    },

    // Other settings
    settings: {
        autoRead: true,
        autoTyping: true,
        autoRecord: false,
        backupInterval: 6 * 60 * 60 * 1000, // 6 hours
        // Heroku-specific settings
        keepAlive: process.env.NODE_ENV === 'production',
        retryOnDisconnect: true,
        maxRetries: 5,
        retryDelay: 5000,
        // Production-specific logging
        logLevel: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
        // Heroku dyno prevention
        preventSleep: process.env.NODE_ENV === 'production'
    }
};

module.exports = config;