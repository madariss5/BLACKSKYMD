const logger = require('../utils/logger');

const utilityCommands = {
    async weather(sock, sender, args) {
        const city = args.join(' ');
        if (!city) {
            await sock.sendMessage(sender, { text: 'Please provide a city name' });
            return;
        }
        // TODO: Implement weather API integration
        await sock.sendMessage(sender, { text: `Getting weather for ${city}...` });
    },

    async translate(sock, sender, args) {
        const [from, to, ...text] = args;
        if (!from || !to || text.length === 0) {
            await sock.sendMessage(sender, { 
                text: 'Usage: !translate [from] [to] [text]\nExample: !translate en es Hello' 
            });
            return;
        }
        // TODO: Implement translation
        await sock.sendMessage(sender, { text: 'Translating...' });
    },

    async calculate(sock, sender, args) {
        const expression = args.join(' ');
        if (!expression) {
            await sock.sendMessage(sender, { text: 'Please provide a mathematical expression' });
            return;
        }
        try {
            // Basic sanitization and evaluation
            const sanitized = expression.replace(/[^0-9+\-*/(). ]/g, '');
            const result = eval(sanitized);
            await sock.sendMessage(sender, { text: `${expression} = ${result}` });
        } catch (err) {
            await sock.sendMessage(sender, { text: 'Invalid expression' });
        }
    },

    async dictionary(sock, sender, args) {
        const word = args[0];
        if (!word) {
            await sock.sendMessage(sender, { text: 'Please provide a word to look up' });
            return;
        }
        // TODO: Implement dictionary API integration
        await sock.sendMessage(sender, { text: `Looking up definition for: ${word}` });
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
                result = input.split('').map(char => char.charCodeAt(0).toString(2)).join(' ');
                break;
            default:
                await sock.sendMessage(sender, { text: 'Invalid encoding type' });
                return;
        }
        await sock.sendMessage(sender, { text: `Encoded (${type}): ${result}` });
    },

    async decode(sock, sender, args) {
        const [type, ...text] = args;
        if (!type || text.length === 0) {
            await sock.sendMessage(sender, { 
                text: 'Usage: !decode [type] [text]\nTypes: base64, hex, binary' 
            });
            return;
        }
        let result;
        const input = text.join(' ');
        try {
            switch (type.toLowerCase()) {
                case 'base64':
                    result = Buffer.from(input, 'base64').toString();
                    break;
                case 'hex':
                    result = Buffer.from(input, 'hex').toString();
                    break;
                case 'binary':
                    result = input.split(' ').map(bin => String.fromCharCode(parseInt(bin, 2))).join('');
                    break;
                default:
                    await sock.sendMessage(sender, { text: 'Invalid decoding type' });
                    return;
            }
            await sock.sendMessage(sender, { text: `Decoded: ${result}` });
        } catch (err) {
            await sock.sendMessage(sender, { text: 'Invalid input for decoding' });
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

    async poll(sock, sender, args) {
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

    async language(sock, sender, args) {
        try {
            const newLang = args[0]?.toLowerCase();
            if (!newLang) {
                const availableLangs = languageManager.getAvailableLanguages();
                await sock.sendMessage(sender, { 
                    text: `Available languages: ${availableLangs.join(', ')}\nCurrent language: ${config.bot.language}`
                });
                return;
            }

            if (!languageManager.isLanguageSupported(newLang)) {
                await sock.sendMessage(sender, {
                    text: `Language "${newLang}" is not supported. Available languages: ${languageManager.getAvailableLanguages().join(', ')}`
                });
                return;
            }

            config.bot.language = newLang;
            await sock.sendMessage(sender, {
                text: languageManager.getText('system.language_changed', newLang)
            });

        } catch (err) {
            logger.error('Error in language command:', err);
            await sock.sendMessage(sender, { text: 'Failed to change language.' });
        }
    },
};

module.exports = utilityCommands;