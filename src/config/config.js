require('dotenv').config();

const config = {
    // Bot Owner Info
    owner: {
        name: process.env.OWNER_NAME || 'Bot Owner',  
        // ============================================
        // ENTER YOUR WHATSAPP NUMBER HERE
        // ============================================
        // Format: Country code + number (no spaces/symbols)
        // Example: For number +1 (234) 567-8900
        //    - Country code: 1
        //    - Number: 2345678900
        //    - Enter as: 12345678900
        // 
        // ⚠️ REPLACE THE NUMBER BELOW WITH YOURS ⚠️
        number: process.env.OWNER_NUMBER ? 
            `${process.env.OWNER_NUMBER.replace(/[^0-9]/g, '')}@s.whatsapp.net` : 
            '4915561048015@s.whatsapp.net',
        email: process.env.OWNER_EMAIL || '',
    },

    // Session Configuration
    session: {
        id: process.env.SESSION_ID || 'whatsapp-bot', // Provide a default session ID
        authDir: './auth_info',
        backupDir: './sessions',
    },

    // Bot Configuration
    bot: {
        name: process.env.BOT_NAME || '𝔹𝕃𝔸ℂ𝕂𝕊𝕂𝕐-𝕄𝔻',
        version: process.env.BOT_VERSION || '1.0.0',
        prefix: process.env.BOT_PREFIX || '.',
        language: process.env.BOT_LANGUAGE || 'en',
        debug: process.env.NODE_ENV !== 'production',
    },

    // Server Configuration
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

    // Validation function for required environment variables
    validateConfig: () => {
        const missingVars = [];

        // Check required variables
        if (!process.env.OWNER_NUMBER) {
            console.warn('⚠️ OWNER_NUMBER not set in environment. Please set your WhatsApp number in the config.js file.');
            console.warn('Format: Country code + number without any special characters');
            console.warn('Example: For +1 (234) 567-8900, set OWNER_NUMBER=12345678900');
        }
        if (!process.env.SESSION_ID) missingVars.push('SESSION_ID');

        // Additional validation for owner number format
        if (process.env.OWNER_NUMBER) {
            const cleanNumber = process.env.OWNER_NUMBER.replace(/[^0-9]/g, '');
            if (!cleanNumber.match(/^\d+$/)) {
                missingVars.push('OWNER_NUMBER (invalid format)');
                console.error('Invalid OWNER_NUMBER format. Please provide only numbers including country code (e.g., 12345678900)');
            }
        }

        return {
            isValid: missingVars.length === 0,
            missingVars
        };
    },

    // Other settings
    settings: {
        autoRead: true,
        autoTyping: true,
        autoRecord: false,
        backupInterval: 6 * 60 * 60 * 1000, // 6 hours
        keepAlive: process.env.NODE_ENV === 'production',
        retryOnDisconnect: true,
        maxRetries: 5,
        retryDelay: 5000,
        logLevel: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
        preventSleep: process.env.NODE_ENV === 'production',
        connectionTimeout: 60000, // 1 minute
        queryTimeout: 60000, // 1 minute
        reconnectInterval: 5000 // 5 seconds
    }
};

module.exports = config;