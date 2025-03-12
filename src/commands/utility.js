const logger = require('../utils/logger');
const config = require('../config/config');
const { languageManager } = require('../utils/language');
const axios = require('axios');

const utilityCommands = {
    async weather(sock, sender, args) {
        try {
            const city = args.join(' ');
            if (!city) {
                await sock.sendMessage(sender, { text: 'Please provide a city name' });
                return;
            }

            const API_KEY = process.env.OPENWEATHER_API_KEY;
            if (!API_KEY) {
                logger.error('OpenWeather API key not found');
                await sock.sendMessage(sender, { text: 'Weather service is currently unavailable' });
                return;
            }

            const response = await axios.get(
                `http://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${API_KEY}&units=metric`
            );

            const weather = response.data;
            const message = `Weather in ${weather.name}:
🌡️ Temperature: ${weather.main.temp}°C
💧 Humidity: ${weather.main.humidity}%
🌪️ Wind: ${weather.wind.speed} m/s
☁️ Conditions: ${weather.weather[0].description}`;

            await sock.sendMessage(sender, { text: message });
        } catch (err) {
            logger.error('Weather command error:', err);
            await sock.sendMessage(sender, { text: 'Error fetching weather data. Please try again later.' });
        }
    },

    async translate(sock, sender, args) {
        try {
            const [from, to, ...text] = args;
            if (!from || !to || text.length === 0) {
                await sock.sendMessage(sender, { 
                    text: 'Usage: !translate [from] [to] [text]\nExample: !translate en es Hello' 
                });
                return;
            }

            const API_KEY = process.env.TRANSLATION_API_KEY;
            if (!API_KEY) {
                logger.error('Translation API key not found');
                await sock.sendMessage(sender, { text: 'Translation service is currently unavailable' });
                return;
            }

            // Using a mock translation for now - implement actual API later
            const translatedText = `Translated text will appear here (${from} -> ${to}): ${text.join(' ')}`;
            await sock.sendMessage(sender, { text: translatedText });
        } catch (err) {
            logger.error('Translation error:', err);
            await sock.sendMessage(sender, { text: 'Error during translation. Please try again later.' });
        }
    },

    async calculate(sock, sender, args) {
        try {
            const expression = args.join(' ');
            if (!expression) {
                await sock.sendMessage(sender, { text: 'Please provide a mathematical expression' });
                return;
            }

            // Basic sanitization and evaluation
            const sanitized = expression.replace(/[^0-9+\-*/(). ]/g, '');
            const result = eval(sanitized);

            if (isNaN(result)) {
                throw new Error('Invalid expression');
            }

            await sock.sendMessage(sender, { text: `${expression} = ${result}` });
        } catch (err) {
            logger.error('Calculate command error:', err);
            await sock.sendMessage(sender, { text: 'Invalid expression. Please try again with a valid mathematical expression.' });
        }
    },

    async dictionary(sock, sender, args) {
        try {
            const word = args[0];
            if (!word) {
                await sock.sendMessage(sender, { text: 'Please provide a word to look up' });
                return;
            }

            const API_KEY = process.env.DICTIONARY_API_KEY;
            if (!API_KEY) {
                logger.error('Dictionary API key not found');
                await sock.sendMessage(sender, { text: 'Dictionary service is currently unavailable' });
                return;
            }

            // Mock dictionary response - implement actual API later
            const definition = `Definition for ${word} will appear here`;
            await sock.sendMessage(sender, { text: definition });
        } catch (err) {
            logger.error('Dictionary lookup error:', err);
            await sock.sendMessage(sender, { text: 'Error looking up word. Please try again later.' });
        }
    },
    async covid(sock, sender, args) {
        const country = args.join(' ') || 'World';
        // TODO: Implement COVID-19 statistics API integration
        await sock.sendMessage(sender, { text: `Getting COVID-19 stats for ${country}...` });
    },

    async currency(sock, sender, args) {
        const [amount, from, to] = args;
        if (!amount || !from || !to) {
            await sock.sendMessage(sender, { 
                text: 'Usage: !currency [amount] [from] [to]\nExample: !currency 100 USD EUR' 
            });
            return;
        }
        // TODO: Implement currency conversion
        await sock.sendMessage(sender, { text: 'Converting currency...' });
    },

    async shortlink(sock, sender, args) {
        const url = args[0];
        if (!url) {
            await sock.sendMessage(sender, { text: 'Please provide a URL to shorten' });
            return;
        }
        // TODO: Implement URL shortening
        await sock.sendMessage(sender, { text: 'Shortening URL...' });
    },

    async wiki(sock, sender, args) {
        const query = args.join(' ');
        if (!query) {
            await sock.sendMessage(sender, { text: 'Please provide a search term' });
            return;
        }
        // TODO: Implement Wikipedia API integration
        await sock.sendMessage(sender, { text: `Searching Wikipedia for: ${query}` });
    },

    async poll(sock, sender, args) {
        const [question, ...options] = args.join(' ').split('|').map(item => item.trim());
        if (!question || options.length < 2) {
            await sock.sendMessage(sender, { 
                text: 'Usage: !poll Question | Option1 | Option2 | ...' 
            });
            return;
        }
        const pollText = `📊 Poll: ${question}\n\n${options.map((opt, i) => `${i + 1}. ${opt}`).join('\n')}`;
        await sock.sendMessage(sender, { text: pollText });
    },

    async news(sock, sender, args) {
        const category = args[0] || 'general';
        // TODO: Implement news API integration
        await sock.sendMessage(sender, { text: `Getting ${category} news...` });
    },

    async timezone(sock, sender, args) {
        const location = args.join(' ');
        if (!location) {
            await sock.sendMessage(sender, { text: 'Please provide a city or country' });
            return;
        }
        // TODO: Implement timezone API integration
        await sock.sendMessage(sender, { text: `Getting time for ${location}...` });
    },

    async encode(sock, sender, args) {
        try {
            const [type, ...text] = args;
            if (!type || text.length === 0) {
                await sock.sendMessage(sender, { 
                    text: 'Usage: !encode [type] [text]\nTypes: base64, hex, binary' 
                });
                return;
            }

            let result;
            const input = text.join(' ');

            switch (type.toLowerCase()) {
                case 'base64':
                    result = Buffer.from(input).toString('base64');
                    break;
                case 'hex':
                    result = Buffer.from(input).toString('hex');
                    break;
                case 'binary':
                    result = input.split('').map(char => char.charCodeAt(0).toString(2).padStart(8, '0')).join(' ');
                    break;
                default:
                    await sock.sendMessage(sender, { text: 'Invalid encoding type. Available types: base64, hex, binary' });
                    return;
            }

            await sock.sendMessage(sender, { text: `Encoded (${type}): ${result}` });
        } catch (err) {
            logger.error('Encode command error:', err);
            await sock.sendMessage(sender, { text: 'Error encoding text. Please try again.' });
        }
    },

    async decode(sock, sender, args) {
        try {
            const [type, ...text] = args;
            if (!type || text.length === 0) {
                await sock.sendMessage(sender, { 
                    text: 'Usage: !decode [type] [text]\nTypes: base64, hex, binary' 
                });
                return;
            }

            let result;
            const input = text.join(' ');

            switch (type.toLowerCase()) {
                case 'base64':
                    result = Buffer.from(input, 'base64').toString();
                    break;
                case 'hex':
                    result = Buffer.from(input, 'hex').toString();
                    break;
                case 'binary':
                    result = input.split(' ')
                        .map(bin => String.fromCharCode(parseInt(bin, 2)))
                        .join('');
                    break;
                default:
                    await sock.sendMessage(sender, { text: 'Invalid decoding type. Available types: base64, hex, binary' });
                    return;
            }

            await sock.sendMessage(sender, { text: `Decoded: ${result}` });
        } catch (err) {
            logger.error('Decode command error:', err);
            await sock.sendMessage(sender, { text: 'Invalid input for decoding. Please check your input and try again.' });
        }
    },

    async qrread(sock, sender) {
        // TODO: Implement QR code reading from image
        await sock.sendMessage(sender, { text: 'QR code reading feature coming soon!' });
    },

    async wolfram(sock, sender, args) {
        const query = args.join(' ');
        if (!query) {
            await sock.sendMessage(sender, { text: 'Please provide a query' });
            return;
        }
        // TODO: Implement Wolfram Alpha API integration
        await sock.sendMessage(sender, { text: `Querying Wolfram Alpha: ${query}` });
    },

    async github(sock, sender, args) {
        const query = args.join(' ');
        if (!query) {
            await sock.sendMessage(sender, { text: 'Please provide a search term' });
            return;
        }
        // TODO: Implement GitHub API integration
        await sock.sendMessage(sender, { text: `Searching GitHub for: ${query}` });
    },

    async npm(sock, sender, args) {
        const packageName = args[0];
        if (!packageName) {
            await sock.sendMessage(sender, { text: 'Please provide a package name' });
            return;
        }
        // TODO: Implement NPM API integration
        await sock.sendMessage(sender, { text: `Searching NPM for: ${packageName}` });
    },

    async ipinfo(sock, sender, args) {
        const ip = args[0] || 'self';
        // TODO: Implement IP information API integration
        await sock.sendMessage(sender, { text: `Getting information for IP: ${ip}` });
    },

    async whois(sock, sender, args) {
        const domain = args[0];
        if (!domain) {
            await sock.sendMessage(sender, { text: 'Please provide a domain name' });
            return;
        }
        // TODO: Implement WHOIS lookup
        await sock.sendMessage(sender, { text: `Looking up WHOIS for: ${domain}` });
    },
    async ocr(sock, sender) {
        // TODO: Implement optical character recognition
        await sock.sendMessage(sender, { text: 'OCR feature coming soon!' });
    },

    async qrgen(sock, sender, args) {
        const text = args.join(' ');
        if (!text) {
            await sock.sendMessage(sender, { text: 'Please provide text to generate QR code' });
            return;
        }
        // TODO: Implement QR code generation
        await sock.sendMessage(sender, { text: 'Generating QR code...' });
    },

    async screenshot(sock, sender, args) {
        const url = args[0];
        if (!url) {
            await sock.sendMessage(sender, { text: 'Please provide a URL to screenshot' });
            return;
        }
        // TODO: Implement website screenshot
        await sock.sendMessage(sender, { text: 'Taking screenshot...' });
    },

    async color(sock, sender, args) {
        const colorCode = args[0];
        if (!colorCode) {
            await sock.sendMessage(sender, { text: 'Please provide a color code (hex/rgb)' });
            return;
        }
        // TODO: Implement color information
        await sock.sendMessage(sender, { text: 'Getting color information...' });
    },

    async lyrics(sock, sender, args) {
        const song = args.join(' ');
        if (!song) {
            await sock.sendMessage(sender, { text: 'Please provide a song name' });
            return;
        }
        // TODO: Implement lyrics search
        await sock.sendMessage(sender, { text: 'Searching lyrics...' });
    },

    async movie(sock, sender, args) {
        const title = args.join(' ');
        if (!title) {
            await sock.sendMessage(sender, { text: 'Please provide a movie title' });
            return;
        }
        // TODO: Implement movie information search
        await sock.sendMessage(sender, { text: 'Searching movie info...' });
    },

    async anime(sock, sender, args) {
        const title = args.join(' ');
        if (!title) {
            await sock.sendMessage(sender, { text: 'Please provide an anime title' });
            return;
        }
        // TODO: Implement anime information search
        await sock.sendMessage(sender, { text: 'Searching anime info...' });
    },

    async spotify(sock, sender, args) {
        const track = args.join(' ');
        if (!track) {
            await sock.sendMessage(sender, { text: 'Please provide a track name' });
            return;
        }
        // TODO: Implement Spotify track search
        await sock.sendMessage(sender, { text: 'Searching Spotify...' });
    },

    async urban(sock, sender, args) {
        const term = args.join(' ');
        if (!term) {
            await sock.sendMessage(sender, { text: 'Please provide a term to look up' });
            return;
        }
        // TODO: Implement Urban Dictionary lookup
        await sock.sendMessage(sender, { text: 'Searching Urban Dictionary...' });
    },

    async crypto(sock, sender, args) {
        const coin = args[0]?.toLowerCase() || 'bitcoin';
        // TODO: Implement cryptocurrency price check
        await sock.sendMessage(sender, { text: `Getting ${coin} price...` });
    },

    async stocks(sock, sender, args) {
        const symbol = args[0]?.toUpperCase();
        if (!symbol) {
            await sock.sendMessage(sender, { text: 'Please provide a stock symbol' });
            return;
        }
        // TODO: Implement stock price check
        await sock.sendMessage(sender, { text: `Getting ${symbol} stock price...` });
    },

    async reminder(sock, sender, args) {
        if (args.length < 2) {
            await sock.sendMessage(sender, { 
                text: 'Usage: !reminder [time] [message]\nExample: !reminder 30m Check laundry' 
            });
            return;
        }
        // TODO: Implement reminder system
        await sock.sendMessage(sender, { text: 'Setting reminder...' });
    },

    async countdown(sock, sender, args) {
        const event = args.join(' ');
        if (!event) {
            await sock.sendMessage(sender, { text: 'Please provide an event name and date' });
            return;
        }
        // TODO: Implement countdown timer
        await sock.sendMessage(sender, { text: 'Starting countdown...' });
    },

    async poll2(sock, sender, args) {
        const [question, ...options] = args.join(' ').split('|');
        if (!question || options.length < 2) {
            await sock.sendMessage(sender, { 
                text: 'Usage: !poll Question | Option1 | Option2 | ...' 
            });
            return;
        }
        // TODO: Implement poll creation
        await sock.sendMessage(sender, { text: 'Creating poll...' });
    },

    async todo(sock, sender, args) {
        const [action, ...item] = args;
        if (!action || !['add', 'remove', 'list'].includes(action)) {
            await sock.sendMessage(sender, { 
                text: 'Usage: !todo <add|remove|list> [item]' 
            });
            return;
        }
        // TODO: Implement todo list
        await sock.sendMessage(sender, { text: 'Managing todo list...' });
    },

    async notes(sock, sender, args) {
        const [action, ...content] = args;
        if (!action || !['add', 'view', 'delete'].includes(action)) {
            await sock.sendMessage(sender, { 
                text: 'Usage: !notes <add|view|delete> [content]' 
            });
            return;
        }
        // TODO: Implement notes system
        await sock.sendMessage(sender, { text: 'Managing notes...' });
    },

    async reverse(sock, sender, args) {
        try {
            const text = args.join(' ');
            if (!text) {
                await sock.sendMessage(sender, { text: 'Please provide text to reverse' });
                return;
            }

            const reversed = text.split('').reverse().join('');
            await sock.sendMessage(sender, { text: reversed });
        } catch (err) {
            logger.error('Reverse command error:', err);
            await sock.sendMessage(sender, { text: 'Error reversing text. Please try again.' });
        }
    },

    async mock(sock, sender, args) {
        try {
            const text = args.join(' ');
            if (!text) {
                await sock.sendMessage(sender, { text: 'Please provide text to mock' });
                return;
            }

            const mocked = text
                .toLowerCase()
                .split('')
                .map((char, i) => i % 2 === 0 ? char : char.toUpperCase())
                .join('');

            await sock.sendMessage(sender, { text: mocked });
        } catch (err) {
            logger.error('Mock command error:', err);
            await sock.sendMessage(sender, { text: 'Error mocking text. Please try again.' });
        }
    },

    async roll(sock, sender, args) {
        try {
            const sides = parseInt(args[0]) || 6;
            if (sides < 2 || sides > 100) {
                await sock.sendMessage(sender, { text: 'Please specify a number of sides between 2 and 100' });
                return;
            }

            const result = Math.floor(Math.random() * sides) + 1;
            await sock.sendMessage(sender, { text: `🎲 You rolled a ${result} (d${sides})` });
        } catch (err) {
            logger.error('Roll command error:', err);
            await sock.sendMessage(sender, { text: 'Error rolling dice. Please try again.' });
        }
    },

    async flip(sock, sender) {
        try {
            const result = Math.random() < 0.5 ? 'Heads' : 'Tails';
            await sock.sendMessage(sender, { text: `🪙 Coin flip: ${result}!` });
        } catch (err) {
            logger.error('Flip command error:', err);
            await sock.sendMessage(sender, { text: 'Error flipping coin. Please try again.' });
        }
    },

    async choose(sock, sender, args) {
        try {
            const options = args.join(' ').split('|').map(opt => opt.trim());
            if (options.length < 2) {
                await sock.sendMessage(sender, { 
                    text: 'Please provide at least 2 options separated by | \nExample: !choose option1 | option2 | option3' 
                });
                return;
            }

            const choice = options[Math.floor(Math.random() * options.length)];
            await sock.sendMessage(sender, { text: `🎯 I choose: ${choice}` });
        } catch (err) {
            logger.error('Choose command error:', err);
            await sock.sendMessage(sender, { text: 'Error making a choice. Please try again.' });
        }
    },

    async language(sock, sender, args) {
        try {
            const newLang = args[0]?.toLowerCase();

            if (!newLang) {
                const availableLangs = languageManager.getAvailableLanguages();
                const currentLang = config.bot.language || languageManager.defaultLanguage;

                await sock.sendMessage(sender, { 
                    text: `Available languages: ${availableLangs.join(', ')}\nCurrent language: ${currentLang}`
                });
                return;
            }

            if (!languageManager.isLanguageSupported(newLang)) {
                const availableLangs = languageManager.getAvailableLanguages();
                await sock.sendMessage(sender, {
                    text: `Language '${newLang}' is not supported.\nAvailable languages: ${availableLangs.join(', ')}`
                });
                return;
            }

            config.bot.language = newLang;
            await sock.sendMessage(sender, {
                text: `Language changed to ${newLang}`
            });

        } catch (err) {
            logger.error('Language command error:', err);
            await sock.sendMessage(sender, { 
                text: 'Error changing language. Please try again.' 
            });
        }
    },
    async wordcount(sock, sender, args) {
        try {
            const text = args.join(' ');
            if (!text) {
                await sock.sendMessage(sender, { text: 'Please provide text to count' });
                return;
            }

            const words = text.trim().split(/\s+/).length;
            const chars = text.length;
            const chars_no_space = text.replace(/\s+/g, '').length;

            const message = `📊 Word Count:
Words: ${words}
Characters (with spaces): ${chars}
Characters (no spaces): ${chars_no_space}`;

            await sock.sendMessage(sender, { text: message });
        } catch (err) {
            logger.error('Word count command error:', err);
            await sock.sendMessage(sender, { text: 'Error counting words. Please try again.' });
        }
    },

    async random(sock, sender, args) {
        try {
            const [min = 1, max = 100] = args.map(Number);
            if (isNaN(min) || isNaN(max)) {
                await sock.sendMessage(sender, { 
                    text: 'Please provide valid numbers\nUsage: .random [min] [max]' 
                });
                return;
            }

            const result = Math.floor(Math.random() * (max - min + 1)) + min;
            await sock.sendMessage(sender, { text: `🎲 Random number between ${min} and ${max}: ${result}` });
        } catch (err) {
            logger.error('Random command error:', err);
            await sock.sendMessage(sender, { text: 'Error generating random number. Please try again.' });
        }
    },

    async time(sock, sender) {
        try {
            const now = new Date();
            const timeString = now.toLocaleTimeString();
            const dateString = now.toLocaleDateString();
            const utc = now.toUTCString();

            const message = `🕒 Current Time:
Local: ${timeString}
Date: ${dateString}
UTC: ${utc}`;

            await sock.sendMessage(sender, { text: message });
        } catch (err) {
            logger.error('Time command error:', err);
            await sock.sendMessage(sender, { text: 'Error getting current time. Please try again.' });
        }
    },

    async case(sock, sender, args) {
        try {
            const [type, ...text] = args;
            if (!type || !text.length) {
                await sock.sendMessage(sender, { 
                    text: 'Usage: .case <upper|lower> [text]' 
                });
                return;
            }

            const input = text.join(' ');
            let result;

            switch (type.toLowerCase()) {
                case 'upper':
                    result = input.toUpperCase();
                    break;
                case 'lower':
                    result = input.toLowerCase();
                    break;
                default:
                    await sock.sendMessage(sender, { text: 'Invalid case type. Use "upper" or "lower"' });
                    return;
            }

            await sock.sendMessage(sender, { text: result });
        } catch (err) {
            logger.error('Case command error:', err);
            await sock.sendMessage(sender, { text: 'Error converting case. Please try again.' });
        }
    },
    
    async language(sock, sender, args) {
        try {
            // Get reference to language manager and user database
            const { languageManager } = require('../utils/language');
            const { getUserProfile, updateUserProfile } = require('../utils/userDatabase');
            
            // If no arguments, show available languages
            if (!args.length) {
                const availableLangs = languageManager.getAvailableLanguages();
                const currentLang = getUserProfile(sender) ? 
                    getUserProfile(sender).language || 'en' : 'en';
                
                await sock.sendMessage(sender, { 
                    text: `🌐 *Language Settings*\n\n` +
                          `Current language: ${currentLang}\n` +
                          `Available languages: ${availableLangs.join(', ')}\n\n` +
                          `To change your language, use:\n.language [code]` 
                });
                return;
            }
            
            // Get the requested language
            const lang = args[0].toLowerCase();
            
            // Check if language is supported
            if (!languageManager.isLanguageSupported(lang)) {
                const availableLangs = languageManager.getAvailableLanguages().join(', ');
                await sock.sendMessage(sender, { 
                    text: `❌ Language '${lang}' is not supported.\nAvailable languages: ${availableLangs}` 
                });
                return;
            }
            
            // Update user's preferred language in the database
            let profile = getUserProfile(sender);
            if (!profile) {
                profile = { id: sender, language: lang };
            } else {
                profile.language = lang;
            }
            updateUserProfile(sender, profile);
            
            // Use the appropriate translation to respond
            const response = languageManager.getText('system.language_changed', lang);
            await sock.sendMessage(sender, { text: `✅ ${response}` });
            logger.info(`User ${sender} changed language to: ${lang}`);
        } catch (err) {
            logger.error('Language command error:', err);
            await sock.sendMessage(sender, { text: '❌ Error changing language. Please try again.' });
        }
    }

};

module.exports = {
    commands: utilityCommands,
    category: 'utility',
    async init() {
        try {
            logger.info('Initializing utility command handler...');
            return true;
        } catch (error) {
            logger.error('Failed to initialize utility commands:', error);
            return false;
        }
    }
};