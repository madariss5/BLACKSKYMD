const config = {
    // Bot Owner Info
    owner: {
        name: process.env.OWNER_NAME || 'Bot Owner',  
        number: process.env.OWNER_NUMBER ? 
            process.env.OWNER_NUMBER.replace(/[^0-9]/g, '') : 
            '4915563151347',
        email: process.env.OWNER_EMAIL || '',
    },

    // Bot Configuration
    bot: {
        name: process.env.BOT_NAME || '𝔹𝕃𝔸ℂ𝕂𝕊𝕂𝕐-𝕄𝔻',
        version: process.env.BOT_VERSION || '1.0.1',
        prefix: process.env.BOT_PREFIX || '.',
        language: process.env.BOT_LANGUAGE || 'en',
        debug: process.env.NODE_ENV !== 'production',
    },

    // Server Configuration
    server: {
        port: process.env.PORT || 5000,
        host: '0.0.0.0',
    },

    // API Keys Configuration
    apis: {
        openweather: process.env.OPENWEATHERMAP_API_KEY || '',
        google: process.env.GOOGLE_API_KEY || '',
        googleSearch: process.env.GOOGLE_SEARCH_API_KEY || '',
        googleTranslate: process.env.GOOGLE_TRANSLATE_API_KEY || '',
        googleMaps: process.env.GOOGLE_MAPS_API_KEY || '',
        youtube: process.env.YOUTUBE_API_KEY || process.env.GOOGLE_API_KEY || '',
        removebg: process.env.REMOVEBG_API_KEY || '',
        imageEnhance: process.env.IMAGE_ENHANCE_API_KEY || '',
        wolfram: process.env.WOLFRAM_APP_ID || '',
        dictionary: process.env.DICTIONARY_API_KEY || '',
        news: process.env.NEWS_API_KEY || '',
        weather: process.env.WEATHER_API_KEY || process.env.OPENWEATHERMAP_API_KEY || '',
        spotify: {
            clientId: process.env.SPOTIFY_CLIENT_ID || '',
            clientSecret: process.env.SPOTIFY_CLIENT_SECRET || '',
        },
        currencyConverter: process.env.CURRENCY_API_KEY || '',
        financialData: process.env.FINANCIAL_API_KEY || '',
        rapidapi: process.env.RAPIDAPI_KEY || '',
        deepl: process.env.DEEPL_API_KEY || '',
        twitter: {
            apiKey: process.env.TWITTER_API_KEY || '',
            apiSecret: process.env.TWITTER_API_SECRET || '',
            bearerToken: process.env.TWITTER_BEARER_TOKEN || '',
        },
        anilist: process.env.ANILIST_API_KEY || '',
        steam: process.env.STEAM_API_KEY || '',
        openai: process.env.OPENAI_API_KEY || '',
        tmdb: process.env.TMDB_API_KEY || '',

        getKey: function(name) {
            if (this[name] !== undefined) return this[name];
            for (const key in this) {
                if (typeof this[key] === 'object' && this[key] !== null) {
                    if (this[key][name] !== undefined) return this[key][name];
                }
            }
            return '';
        }
    },

    // Validation function for required environment variables
    validateConfig: () => {
        const missingVars = [];
        const warnings = [];
        const recommendedApis = [
            'OPENWEATHERMAP_API_KEY',
            'GOOGLE_API_KEY',
            'YOUTUBE_API_KEY', 
            'NEWS_API_KEY',
            'SPOTIFY_CLIENT_ID', 
            'SPOTIFY_CLIENT_SECRET'
        ];

        if (!process.env.OWNER_NUMBER) {
            console.warn('⚠️ OWNER_NUMBER not set in environment. Using default from config.js');
            console.warn('Format: Country code + number without any special characters');
            console.warn('Example: For +1 (234) 567-8900, set OWNER_NUMBER=12345678900');
        }

        if (process.env.OWNER_NUMBER) {
            const cleanNumber = process.env.OWNER_NUMBER.replace(/[^0-9]/g, '');
            if (!cleanNumber.match(/^\d+$/)) {
                missingVars.push('OWNER_NUMBER (invalid format)');
                console.error('Invalid OWNER_NUMBER format. Please provide only numbers including country code (e.g., 12345678900)');
            }
        }

        recommendedApis.forEach(api => {
            if (!process.env[api]) {
                warnings.push(api);
            }
        });

        if (warnings.length > 0) {
            console.warn('⚠️ Some recommended API keys are missing:');
            warnings.forEach(api => {
                console.warn(`   - ${api}: Required for certain features`);
            });
            console.warn('You can set these in your .env file to enable full functionality.');
        }

        return {
            isValid: missingVars.length === 0,
            missingVars,
            warnings
        };
    },

    // Application Settings
    settings: {
        autoRead: true,
        autoTyping: false,
        autoRecord: false,
        logLevel: process.env.NODE_ENV === 'production' ? 'info' : 'debug'
    }
};

module.exports = config;