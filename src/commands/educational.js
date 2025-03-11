const logger = require('../utils/logger');
const path = require('path');
const fs = require('fs').promises;
const axios = require('axios');

// Helper functions
const handleError = async (sock, jid, err, message) => {
    logger.error(`${message}:`, err.message);
    logger.error('Stack trace:', err.stack);
    await sock.sendMessage(jid, { text: `❌ ${message}` });
};

const educationalCommands = {
    async define(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            const word = args.join(' ');
            if (!word) {
                await sock.sendMessage(remoteJid, { text: '📚 Please provide a word to define' });
                return;
            }

            await sock.sendMessage(remoteJid, { text: '📖 Looking up definition...' });

            // Free Dictionary API integration
            const response = await axios.get(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);

            if (response.data && response.data.length > 0) {
                const entry = response.data[0];
                let definition = `📚 *${entry.word}*\n\n`;

                if (entry.phonetic) {
                    definition += `Pronunciation: ${entry.phonetic}\n\n`;
                }

                entry.meanings.forEach((meaning, index) => {
                    definition += `*${meaning.partOfSpeech}*\n`;
                    meaning.definitions.slice(0, 2).forEach((def, i) => {
                        definition += `${i + 1}. ${def.definition}\n`;
                        if (def.example) {
                            definition += `   Example: "${def.example}"\n`;
                        }
                    });
                    definition += '\n';
                });

                await sock.sendMessage(remoteJid, { text: definition });
            } else {
                await sock.sendMessage(remoteJid, { text: '❌ No definition found for this word.' });
            }
        } catch (err) {
            await handleError(sock, message.key.remoteJid, err, 'Error looking up definition');
        }
    },

    async translate(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            if (args.length < 2) {
                await sock.sendMessage(remoteJid, { 
                    text: '🌐 Usage: !translate [target_language] [text]\nExample: !translate es Hello world' 
                });
                return;
            }

            const targetLang = args[0].toLowerCase();
            const text = args.slice(1).join(' ');

            // Using LibreTranslate API (self-hosted or public instance)
            const response = await axios.post('https://libretranslate.de/translate', {
                q: text,
                source: 'auto',
                target: targetLang
            });

            if (response.data && response.data.translatedText) {
                await sock.sendMessage(remoteJid, { 
                    text: `🔄 Translation:\n${response.data.translatedText}` 
                });
            } else {
                await sock.sendMessage(remoteJid, { 
                    text: '❌ Could not translate the text. Please check the language code and try again.' 
                });
            }
        } catch (err) {
            await handleError(sock, message.key.remoteJid, err, 'Error translating text');
        }
    },

    async grammar(sock, message, args) {
        const remoteJid = message.key.remoteJid;
        const text = args.join(' ');
        if (!text) {
            await sock.sendMessage(remoteJid, { text: '📝 Please provide text to check grammar' });
            return;
        }
        // TODO: Implement grammar checking API
        await sock.sendMessage(remoteJid, { text: '✍️ Checking grammar...' });
    },

    async conjugate(sock, message, args) {
        const remoteJid = message.key.remoteJid;
        if (args.length < 2) {
            await sock.sendMessage(remoteJid, { 
                text: '📚 Usage: !conjugate [language] [verb]' 
            });
            return;
        }
        // TODO: Implement verb conjugation
        await sock.sendMessage(remoteJid, { text: '🔄 Conjugating verb...' });
    },

    async vocabulary(sock, message, args) {
        const remoteJid = message.key.remoteJid;
        const [action, language] = args;
        if (!action || !['learn', 'practice', 'test'].includes(action)) {
            await sock.sendMessage(remoteJid, {
                text: '📚 Usage: !vocabulary <learn|practice|test> [language]'
            });
            return;
        }
        // TODO: Implement vocabulary learning system
        await sock.sendMessage(remoteJid, { text: '📝 Starting vocabulary session...' });
    },

    async idioms(sock, message, args) {
        const remoteJid = message.key.remoteJid;
        const language = args[0] || 'english';
        // TODO: Implement idioms database
        await sock.sendMessage(remoteJid, { text: '🗣️ Here\'s your daily idiom...' });
    },

    // Mathematics
    async calculate(sock, message, args) {
        const remoteJid = message.key.remoteJid;
        const expression = args.join(' ');
        if (!expression) {
            await sock.sendMessage(remoteJid, { text: '🔢 Please provide a mathematical expression' });
            return;
        }
        try {
            // Sanitize expression to only allow basic math operations
            const result = eval(expression.replace(/[^0-9+\-*/(). ]/g, ''));
            await sock.sendMessage(remoteJid, { text: `🧮 Result: ${result}` });
        } catch (err) {
            await handleError(sock, remoteJid, err, 'Invalid expression');
        }
    },

    async algebra(sock, message, args) {
        const remoteJid = message.key.remoteJid;
        const equation = args.join(' ');
        if (!equation) {
            await sock.sendMessage(remoteJid, { text: '📐 Please provide an algebraic equation' });
            return;
        }
        // TODO: Implement algebra solver
        await sock.sendMessage(remoteJid, { text: '🔢 Solving equation...' });
    },

    async geometry(sock, message, args) {
        const remoteJid = message.key.remoteJid;
        if (!args[0]) {
            await sock.sendMessage(remoteJid, { 
                text: '📐 Usage: !geometry [area|perimeter|volume] [shape] [dimensions]' 
            });
            return;
        }
        // TODO: Implement geometry calculations
        await sock.sendMessage(remoteJid, { text: '📏 Calculating...' });
    },

    async graph(sock, message, args) {
        const remoteJid = message.key.remoteJid;
        const function_str = args.join(' ');
        if (!function_str) {
            await sock.sendMessage(remoteJid, { text: '📈 Please provide a function to graph' });
            return;
        }
        // TODO: Implement function graphing
        await sock.sendMessage(remoteJid, { text: '📊 Generating graph...' });
    },

    async statistics(sock, message, args) {
        const remoteJid = message.key.remoteJid;
        const numbers = args.map(Number);
        if (!numbers.length) {
            await sock.sendMessage(remoteJid, { text: '📊 Please provide numbers for statistical analysis' });
            return;
        }
        // TODO: Implement statistical calculations
        await sock.sendMessage(remoteJid, { text: '📈 Calculating statistics...' });
    },

    // Science
    async periodic(sock, message, args) {
        const remoteJid = message.key.remoteJid;
        const element = args[0];
        if (!element) {
            await sock.sendMessage(remoteJid, { text: '⚗️ Please provide an element symbol or number' });
            return;
        }
        // TODO: Implement periodic table information
        await sock.sendMessage(remoteJid, { text: '🧪 Fetching element info...' });
    },

    async chemical(sock, message, args) {
        const remoteJid = message.key.remoteJid;
        const formula = args.join('');
        if (!formula) {
            await sock.sendMessage(remoteJid, { text: '🧪 Please provide a chemical formula' });
            return;
        }
        // TODO: Implement chemical formula analysis
        await sock.sendMessage(remoteJid, { text: '⚗️ Analyzing formula...' });
    },

    async physics(sock, message, args) {
        const remoteJid = message.key.remoteJid;
        if (args.length < 2) {
            await sock.sendMessage(remoteJid, { 
                text: '🔬 Usage: !physics [formula] [values]' 
            });
            return;
        }
        // TODO: Implement physics calculations
        await sock.sendMessage(remoteJid, { text: '⚡ Calculating...' });
    },

    async astronomy(sock, message, args) {
        const remoteJid = message.key.remoteJid;
        const [topic] = args;
        if (!topic) {
            await sock.sendMessage(remoteJid, { text: '🔭 Please specify an astronomy topic' });
            return;
        }
        // TODO: Implement astronomy information
        await sock.sendMessage(remoteJid, { text: '🌟 Fetching astronomy info...' });
    },

    // Programming
    async code(sock, message, args) {
        const remoteJid = message.key.remoteJid;
        if (args.length < 2) {
            await sock.sendMessage(remoteJid, { 
                text: '💻 Usage: !code [language] [code]' 
            });
            return;
        }
        // TODO: Implement code execution sandbox
        await sock.sendMessage(remoteJid, { text: '🔄 Executing code...' });
    },

    async regex(sock, message, args) {
        const remoteJid = message.key.remoteJid;
        if (args.length < 2) {
            await sock.sendMessage(remoteJid, { 
                text: '🔍 Usage: !regex [pattern] [text]' 
            });
            return;
        }
        // TODO: Implement regex testing
        await sock.sendMessage(remoteJid, { text: '🔎 Testing regex...' });
    },

    async git(sock, message, args) {
        const remoteJid = message.key.remoteJid;
        if (!args[0]) {
            await sock.sendMessage(remoteJid, { 
                text: '🔄 Usage: !git [command] (explains git commands)' 
            });
            return;
        }
        // TODO: Implement git command explanations
        await sock.sendMessage(remoteJid, { text: '📘 Explaining git command...' });
    },

    // Study Tools
    async flashcards(sock, message, args) {
        const remoteJid = message.key.remoteJid;
        const [action, ...rest] = args;
        if (!action || !['create', 'review', 'list'].includes(action)) {
            await sock.sendMessage(remoteJid, { 
                text: '📇 Usage: !flashcards [create|review|list] [subject]' 
            });
            return;
        }
        // TODO: Implement flashcard system
        await sock.sendMessage(remoteJid, { text: '📚 Managing flashcards...' });
    },

    async quiz(sock, message, args) {
        const remoteJid = message.key.remoteJid;
        const subject = args[0];
        if (!subject) {
            await sock.sendMessage(remoteJid, { text: '❓ Please specify a subject for the quiz' });
            return;
        }
        // TODO: Implement quiz generation
        await sock.sendMessage(remoteJid, { text: '📝 Generating quiz...' });
    },

    async studytimer(sock, message, args) {
        const remoteJid = message.key.remoteJid;
        const minutes = parseInt(args[0]) || 25;
        // TODO: Implement Pomodoro timer
        await sock.sendMessage(remoteJid, { text: `⏱️ Study timer set for ${minutes} minutes` });
    },

    async schedule(sock, message, args) {
        const remoteJid = message.key.remoteJid;
        const [action, ...details] = args;
        if (!action || !['add', 'view', 'remove'].includes(action)) {
            await sock.sendMessage(remoteJid, {
                text: '📅 Usage: !schedule <add|view|remove> [details]'
            });
            return;
        }
        // TODO: Implement study schedule management
        await sock.sendMessage(remoteJid, { text: '📆 Managing study schedule...' });
    },

    // Reference Tools
    async wikipedia(sock, message, args) {
        const remoteJid = message.key.remoteJid;
        const query = args.join(' ');
        if (!query) {
            await sock.sendMessage(remoteJid, { text: '📚 Please provide a search term' });
            return;
        }
        // TODO: Implement Wikipedia search
        await sock.sendMessage(remoteJid, { text: '🔍 Searching Wikipedia...' });
    },

    async cite(sock, message, args) {
        const remoteJid = message.key.remoteJid;
        if (args.length < 2) {
            await sock.sendMessage(remoteJid, { 
                text: '📝 Usage: !cite [style] [source details]' 
            });
            return;
        }
        // TODO: Implement citation generator
        await sock.sendMessage(remoteJid, { text: '📚 Generating citation...' });
    },

    async thesaurus(sock, message, args) {
        const remoteJid = message.key.remoteJid;
        const word = args.join(' ');
        if (!word) {
            await sock.sendMessage(remoteJid, { text: '📚 Please provide a word to find synonyms' });
            return;
        }
        // TODO: Implement thesaurus lookup
        await sock.sendMessage(remoteJid, { text: '📖 Finding synonyms...' });
    },

    async mindmap(sock, message, args) {
        const remoteJid = message.key.remoteJid;
        const [action, topic] = args;
        if (!action || !['create', 'view', 'edit'].includes(action)) {
            await sock.sendMessage(remoteJid, {
                text: '🧠 Usage: !mindmap <create|view|edit> [topic]'
            });
            return;
        }
        // TODO: Implement mind mapping
        await sock.sendMessage(remoteJid, { text: '🗺️ Managing mind map...' });
    },

    // Geography Commands
    async geography(sock, message, args) {
        const remoteJid = message.key.remoteJid;
        const [action, query] = args;
        if (!action || !['country', 'capital', 'continent'].includes(action)) {
            await sock.sendMessage(remoteJid, {
                text: '🌍 Usage: !geography <country|capital|continent> [query]'
            });
            return;
        }
        // TODO: Implement geography information system
        await sock.sendMessage(remoteJid, { text: '🗺️ Fetching geography info...' });
    },

    async timezone(sock, message, args) {
        const remoteJid = message.key.remoteJid;
        const location = args.join(' ');
        if (!location) {
            await sock.sendMessage(remoteJid, { text: '🕒 Please provide a location' });
            return;
        }
        // TODO: Implement timezone lookup
        await sock.sendMessage(remoteJid, { text: '⏰ Getting timezone info...' });
    },

    async worldfacts(sock, message, args) {
        const remoteJid = message.key.remoteJid;
        const [category] = args;
        const categories = ['population', 'climate', 'economy', 'culture'];
        if (!category || !categories.includes(category.toLowerCase())) {
            await sock.sendMessage(remoteJid, {
                text: `🌐 Available categories: ${categories.join(', ')}`
            });
            return;
        }
        // TODO: Implement world facts database
        await sock.sendMessage(remoteJid, { text: '📊 Fetching world facts...' });
    },

    // Biology Commands
    async anatomy(sock, message, args) {
        const remoteJid = message.key.remoteJid;
        const [system] = args;
        const systems = ['skeletal', 'muscular', 'nervous', 'digestive'];
        if (!system || !systems.includes(system.toLowerCase())) {
            await sock.sendMessage(remoteJid, {
                text: `🧬 Available systems: ${systems.join(', ')}`
            });
            return;
        }
        // TODO: Implement anatomy information
        await sock.sendMessage(remoteJid, { text: '🔬 Getting anatomy info...' });
    },

    async ecosystem(sock, message, args) {
        const remoteJid = message.key.remoteJid;
        const [type] = args;
        const types = ['forest', 'ocean', 'desert', 'tundra'];
        if (!type || !types.includes(type.toLowerCase())) {
            await sock.sendMessage(remoteJid, {
                text: `🌿 Available ecosystems: ${types.join(', ')}`
            });
            return;
        }
        // TODO: Implement ecosystem information
        await sock.sendMessage(remoteJid, { text: '🌳 Getting ecosystem info...' });
    },

    async species(sock, message, args) {
        const remoteJid = message.key.remoteJid;
        const query = args.join(' ');
        if (!query) {
            await sock.sendMessage(remoteJid, { text: '🦁 Please provide a species name' });
            return;
        }
        // TODO: Implement species database
        await sock.sendMessage(remoteJid, { text: '🔍 Searching species info...' });
    },

    // Advanced Study Tools
    async studygoal(sock, message, args) {
        const remoteJid = message.key.remoteJid;
        const [action, ...details] = args;
        if (!action || !['set', 'check', 'update'].includes(action)) {
            await sock.sendMessage(remoteJid, {
                text: '🎯 Usage: !studygoal <set|check|update> [details]'
            });
            return;
        }
        // TODO: Implement study goal tracking
        await sock.sendMessage(remoteJid, { text: '📝 Managing study goals...' });
    },

    async progress(sock, message, args) {
        const remoteJid = message.key.remoteJid;
        const [subject] = args;
        if (!subject) {
            await sock.sendMessage(remoteJid, { text: '📊 Please specify a subject' });
            return;
        }
        // TODO: Implement progress tracking
        await sock.sendMessage(remoteJid, { text: '📈 Checking progress...' });
    },

    async reminder(sock, message, args) {
        const remoteJid = message.key.remoteJid;
        const [time, ...message] = args;
        if (!time || !message.length) {
            await sock.sendMessage(remoteJid, {
                text: '⏰ Usage: !reminder [time] [message]'
            });
            return;
        }
        // TODO: Implement study reminders
        await sock.sendMessage(remoteJid, { text: '⏰ Setting reminder...' });
    },

    // History Commands
    async history(sock, message, args) {
        const remoteJid = message.key.remoteJid;
        const [period] = args;
        const periods = ['ancient', 'medieval', 'modern', 'contemporary'];
        if (!period || !periods.includes(period.toLowerCase())) {
            await sock.sendMessage(remoteJid, {
                text: `📜 Available periods: ${periods.join(', ')}`
            });
            return;
        }
        // TODO: Implement historical information
        await sock.sendMessage(remoteJid, { text: '📚 Getting historical info...' });
    },

    async timeline(sock, message, args) {
        const remoteJid = message.key.remoteJid;
        const [event] = args;
        if (!event) {
            await sock.sendMessage(remoteJid, { text: '📅 Please specify a historical event' });
            return;
        }
        // TODO: Implement timeline generation
        await sock.sendMessage(remoteJid, { text: '📜 Creating timeline...' });
    },

    async discovery(sock, message, args) {
        const remoteJid = message.key.remoteJid;
        const [field] = args;
        const fields = ['science', 'technology', 'medicine', 'space'];
        if (!field || !fields.includes(field.toLowerCase())) {
            await sock.sendMessage(remoteJid, {
                text: `🔬 Available fields: ${fields.join(', ')}`
            });
            return;
        }
        // TODO: Implement discoveries database
        await sock.sendMessage(remoteJid, { text: '💡 Getting discovery info...' });
    }
};

module.exports = {
    commands: educationalCommands,
    category: 'educational',
    async init() {
        try {
            logger.moduleInit('Educational');

            // Check core dependencies first
            const coreDeps = {
                path,
                logger,
                fs: fs.promises
            };

            // Check each dependency with detailed logging
            for (const [name, dep] of Object.entries(coreDeps)) {
                if (!dep) {
                    logger.error(`❌ Core educational dependency '${name}' is not initialized`);
                    return false;
                }
                logger.info(`✓ Core educational dependency '${name}' verified`);
            }

            // Create necessary directories
            const dataDir = path.join(__dirname, '../../data/educational');
            try {
                await fs.mkdir(dataDir, { recursive: true });
                const stats = await fs.stat(dataDir);
                if (!stats.isDirectory()) {
                    throw new Error('Path exists but is not a directory');
                }
                logger.info(`✓ Directory verified: ${dataDir}`);
            } catch (err) {
                logger.error(`❌ Directory creation failed for ${dataDir}:`, err);
                return false;
            }

            logger.moduleSuccess('Educational');
            return true;
        } catch (err) {
            logger.moduleError('Educational', err);
            return false;
        }
    }
};