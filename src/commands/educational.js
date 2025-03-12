const logger = require('../utils/logger');
const { default: axios } = require('axios');
const path = require('path');
const fs = require('fs');
const { ChartJSNodeCanvas } = require('chartjs-node-canvas');
const mathjs = require('mathjs');

// Helper functions
const handleError = async (sock, jid, err, message) => {
    logger.error(`${message}:`, err.message);
    logger.error('Stack trace:', err.stack);
    await sock.sendMessage(jid, { text: `❌ ${message}` });
};

// Ensure data directory exists
const ensureDataDir = async () => {
    const dataDir = path.join(__dirname, '../../data/educational');
    try {
        await fs.promises.mkdir(dataDir, { recursive: true });
        return dataDir;
    } catch (err) {
        logger.error('Error creating data directory:', err);
        throw err;
    }
};

// Create charts for math visualization
async function createMathChart(equation, xRange = [-10, 10]) {
    const width = 800;
    const height = 600;
    const chartCallback = (ChartJS) => {
        ChartJS.defaults.color = '#666';
    };
    const chartJSNodeCanvas = new ChartJSNodeCanvas({ width, height, chartCallback });

    const points = [];
    const step = (xRange[1] - xRange[0]) / 100;
    for (let x = xRange[0]; x <= xRange[1]; x += step) {
        try {
            const scope = { x };
            const y = mathjs.evaluate(equation, scope);
            if (isFinite(y)) {
                points.push({ x, y });
            }
        } catch (e) {
            continue;
        }
    }

    const data = {
        datasets: [{
            label: equation,
            data: points,
            borderColor: 'rgb(75, 192, 192)',
            tension: 0.1,
            fill: false
        }]
    };

    const config = {
        type: 'line',
        data: data,
        options: {
            responsive: true,
            scales: {
                x: {
                    type: 'linear',
                    position: 'center'
                },
                y: {
                    type: 'linear',
                    position: 'center'
                }
            }
        }
    };

    return await chartJSNodeCanvas.renderToBuffer(config);
}

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
        try {
            const remoteJid = message.key.remoteJid;
            const [action, language, ...words] = args;

            if (!action || !['add', 'test', 'list'].includes(action)) {
                await sock.sendMessage(remoteJid, {
                    text: '*📝 Usage:* .vocabulary [add|test|list] [language] [word1, word2, ...]\nExample: .vocabulary add es casa,perro,gato'
                });
                return;
            }

            const vocabPath = path.join(__dirname, '../../data/educational/vocabulary.json');
            let vocabulary = {};

            try {
                const data = await fs.promises.readFile(vocabPath, 'utf8');
                vocabulary = JSON.parse(data);
            } catch (err) {
                vocabulary = {};
            }

            switch (action) {
                case 'add':
                    vocabulary[language] = vocabulary[language] || [];
                    vocabulary[language].push(...words);
                    await fs.promises.writeFile(vocabPath, JSON.stringify(vocabulary, null, 2));
                    await sock.sendMessage(remoteJid, {
                        text: `*✅ Added ${words.length} words to ${language} vocabulary*`
                    });
                    break;

                case 'test':
                    if (!vocabulary[language] || vocabulary[language].length === 0) {
                        await sock.sendMessage(remoteJid, {
                            text: '*❌ No vocabulary found for this language*'
                        });
                        return;
                    }
                    const randomWords = vocabulary[language]
                        .sort(() => 0.5 - Math.random())
                        .slice(0, 5);
                    await sock.sendMessage(remoteJid, {
                        text: `*📝 Vocabulary Test:*\n\n${randomWords.join('\n')}`
                    });
                    break;

                case 'list':
                    const wordList = vocabulary[language] || [];
                    await sock.sendMessage(remoteJid, {
                        text: `*📚 ${language} Vocabulary:*\n\n${wordList.join(', ')}`
                    });
                    break;
            }

        } catch (err) {
            await handleError(sock, message.key.remoteJid, err, 'Error managing vocabulary');
        }
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
        try {
            const remoteJid = message.key.remoteJid;
            const equation = args.join(' ');

            if (!equation) {
                await sock.sendMessage(remoteJid, { 
                    text: '*📝 Usage:* .graph [equation]\nExample: .graph x^2 + 2*x + 1' 
                });
                return;
            }

            await sock.sendMessage(remoteJid, { text: '*📈 Graphing:* Generating visual representation...' });

            const chartBuffer = await createMathChart(equation);
            await sock.sendMessage(remoteJid, {
                image: chartBuffer,
                caption: `*Graph of:* ${equation}`
            });

        } catch (err) {
            await handleError(sock, message.key.remoteJid, err, 'Error creating graph');
        }
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
        try {
            const remoteJid = message.key.remoteJid;
            const [subject, difficulty = 'medium'] = args;

            if (!subject) {
                await sock.sendMessage(remoteJid, {
                    text: '*📝 Usage:* .quiz [subject] [difficulty]\nExample: .quiz math medium'
                });
                return;
            }

            // TODO: Implement actual quiz database
            const quizzes = {
                math: {
                    easy: [
                        {
                            question: 'What is 2 + 2?',
                            options: ['3', '4', '5', '6'],
                            answer: 1
                        }
                    ],
                    medium: [
                        {
                            question: 'Solve for x: 2x + 5 = 13',
                            options: ['3', '4', '5', '6'],
                            answer: 2
                        }
                    ],
                    hard: [
                        {
                            question: 'What is the derivative of x²?',
                            options: ['x', '2x', '2', 'x³'],
                            answer: 1
                        }
                    ]
                }
            };

            if (!quizzes[subject] || !quizzes[subject][difficulty]) {
                await sock.sendMessage(remoteJid, {
                    text: '*❌ No quiz available for this subject/difficulty*'
                });
                return;
            }

            const quiz = quizzes[subject][difficulty][0];
            await sock.sendMessage(remoteJid, {
                text: `*📝 Quiz Question:*\n\n${quiz.question}\n\n${quiz.options.map((opt, i) => `${i + 1}. ${opt}`).join('\n')}`
            });

        } catch (err) {
            await handleError(sock, message.key.remoteJid, err, 'Error generating quiz');
        }
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
        const [time, ...reminderText] = args;
        if (!time || !reminderText.length) {
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
    },

    // New advanced math commands
    async mathsolve(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            const equation = args.join(' ');

            if (!equation) {
                await sock.sendMessage(remoteJid, { 
                    text: '*📝 Usage:* .mathsolve [equation]\nExample: .mathsolve 2x + 5 = 15' 
                });
                return;
            }

            await sock.sendMessage(remoteJid, { text: '*⚡ Solving:* Processing mathematical equation...' });

            const solution = mathjs.solve(equation);
            await sock.sendMessage(remoteJid, { 
                text: `*📊 Solution:*\n${solution.toString()}` 
            });

        } catch (err) {
            await handleError(sock, message.key.remoteJid, err, 'Error solving equation');
        }
    },


    // Scientific calculator
    async calc(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            const expression = args.join(' ');

            if (!expression) {
                await sock.sendMessage(remoteJid, { 
                    text: '*📝 Usage:* .calc [expression]\nExample: .calc sin(45) * sqrt(16)' 
                });
                return;
            }

            const result = mathjs.evaluate(expression);
            await sock.sendMessage(remoteJid, {
                text: `*🧮 Expression:* ${expression}\n*Result:* ${result}`
            });

        } catch (err) {
            await handleError(sock, message.key.remoteJid, err, 'Error calculating expression');
        }
    },

    // Study notes management
    async notes(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            const [action, subject, ...content] = args;

            if (!action || !['add', 'view', 'list'].includes(action)) {
                await sock.sendMessage(remoteJid, {
                    text: '*📝 Usage:* .notes [add|view|list] [subject] [content]\nExample: .notes add math Quadratic formula: ax² + bx + c = 0'
                });
                return;
            }

            const notesPath = path.join(__dirname, '../../data/educational/notes.json');
            let notes = {};

            try {
                const data = await fs.promises.readFile(notesPath, 'utf8');
                notes = JSON.parse(data);
            } catch (err) {
                notes = {};
            }

            switch (action) {
                case 'add':
                    if (!subject || !content.length) {
                        await sock.sendMessage(remoteJid, {
                            text: '*❌ Please provide both subject and content*'
                        });
                        return;
                    }
                    notes[subject] = notes[subject] || [];
                    notes[subject].push({
                        content: content.join(' '),
                        date: new Date().toISOString()
                    });
                    await fs.promises.writeFile(notesPath, JSON.stringify(notes, null, 2));
                    await sock.sendMessage(remoteJid, {
                        text: '*✅ Note added successfully*'
                    });
                    break;

                case 'view':
                    if (!notes[subject]) {
                        await sock.sendMessage(remoteJid, {
                            text: '*❌ No notes found for this subject*'
                        });
                        return;
                    }
                    const subjectNotes = notes[subject]
                        .map((note, index) => `${index + 1}. ${note.content}\n   📅 ${new Date(note.date).toLocaleDateString()}`)
                        .join('\n\n');
                    await sock.sendMessage(remoteJid, {
                        text: `*📚 ${subject} Notes:*\n\n${subjectNotes}`
                    });
                    break;

                case 'list':
                    const subjects = Object.keys(notes);
                    if (subjects.length === 0) {
                        await sock.sendMessage(remoteJid, {
                            text: '*❌ No notes found*'
                        });
                        return;
                    }
                    await sock.sendMessage(remoteJid, {
                        text: `*📚 Available Subjects:*\n\n${subjects.join('\n')}`
                    });
                    break;
            }

        } catch (err) {
            await handleError(sock, message.key.remoteJid, err, 'Error managing notes');
        }
    },
    async convert(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            const [value, fromUnit, toUnit] = args;

            if (!value || !fromUnit || !toUnit) {
                await sock.sendMessage(remoteJid, {
                    text: '*📏 Usage:* .convert [value] [from_unit] [to_unit]\nExample: .convert 100 km mi'
                });
                return;
            }

            const result = mathjs.evaluate(`${value} ${fromUnit} to ${toUnit}`);
            await sock.sendMessage(remoteJid, {
                text: `*🔄 Conversion Result:*\n${value} ${fromUnit} = ${result} ${toUnit}`
            });
        } catch (err) {
            await handleError(sock, message.key.remoteJid, err, 'Error converting units');
        }
    },

    async formula(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            const [subject, formula] = args;

            const formulas = {
                physics: {
                    velocity: "v = d/t (velocity = distance/time)",
                    force: "F = ma (force = mass × acceleration)",
                    energy: "E = mc² (energy = mass × speed of light²)"
                },
                math: {
                    quadratic: "ax² + bx + c = 0",
                    pythagoras: "a² + b² = c²",
                    area_circle: "A = πr²"
                },
                chemistry: {
                    density: "ρ = m/V (density = mass/volume)",
                    molarity: "M = moles of solute/liters of solution",
                    gas: "PV = nRT (ideal gas law)"
                }
            };

            if (!subject || !formulas[subject]) {
                const subjects = Object.keys(formulas).join(', ');
                await sock.sendMessage(remoteJid, {
                    text: `*📚 Available Subjects:* ${subjects}\n*Usage:* .formula [subject] [formula_name]`
                });
                return;
            }

            if (!formula) {
                const availableFormulas = Object.keys(formulas[subject]).join(', ');
                await sock.sendMessage(remoteJid, {
                    text: `*📚 Available Formulas for ${subject}:*\n${availableFormulas}`
                });
                return;
            }

            const formulaText = formulas[subject][formula];
            if (!formulaText) {
                await sock.sendMessage(remoteJid, {
                    text: '*❌ Formula not found*'
                });
                return;
            }

            await sock.sendMessage(remoteJid, {
                text: `*📐 Formula:* ${formulaText}`
            });
        } catch (err) {
            await handleError(sock, message.key.remoteJid, err, 'Error displaying formula');
        }
    },

    async dictionary(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            const word = args.join(' ');

            if (!word) {
                await sock.sendMessage(remoteJid, {
                    text: '*📚 Usage:* .dictionary [word]\nExample: .dictionary serendipity'
                });
                return;
            }

            const response = await axios.get(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
            const entry = response.data[0];

            let result = `*📖 ${entry.word}*\n`;
            if (entry.phonetic) result += `*Pronunciation:* ${entry.phonetic}\n\n`;

            entry.meanings.forEach(meaning => {
                result += `*${meaning.partOfSpeech}*\n`;
                meaning.definitions.slice(0, 2).forEach((def, i) => {
                    result += `${i + 1}. ${def.definition}\n`;
                    if (def.example) result += `   Example: "${def.example}"\n`;
                });
                result += '\n';
            });

            await sock.sendMessage(remoteJid, { text: result });
        } catch (err) {
            await handleError(sock, message.key.remoteJid, err, 'Error looking up word');
        }
    },

    async study(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            const [action, subject, duration] = args;

            if (!action || !['start', 'stop', 'status'].includes(action)) {
                await sock.sendMessage(remoteJid, {
                    text: '*📚 Usage:* .study [start|stop|status] [subject] [duration_minutes]\nExample: .study start math 30'
                });
                return;
            }

            const studyPath = path.join(__dirname, '../../data/educational/study_sessions.json');
            let sessions = {};

            try {
                const data = await fs.promises.readFile(studyPath, 'utf8');
                sessions = JSON.parse(data);
            } catch (err) {
                sessions = {};
            }

            const userId = message.key.participant || message.key.remoteJid;

            switch (action) {
                case 'start':
                    if (!subject || !duration) {
                        await sock.sendMessage(remoteJid, {
                            text: '*❌ Please provide both subject and duration*'
                        });
                        return;
                    }

                    sessions[userId] = {
                        subject,
                        startTime: new Date().toISOString(),
                        duration: parseInt(duration),
                        active: true
                    };

                    await fs.promises.writeFile(studyPath, JSON.stringify(sessions, null, 2));
                    await sock.sendMessage(remoteJid, {
                        text: `*📚 Study Session Started*\nSubject: ${subject}\nDuration: ${duration} minutes`
                    });

                    // Set timer to notify when session ends
                    setTimeout(async () => {
                        if (sessions[userId]?.active) {
                            sessions[userId].active = false;
                            await fs.promises.writeFile(studyPath, JSON.stringify(sessions, null, 2));
                            await sock.sendMessage(remoteJid, {
                                text: `*⏰ Study Session Complete*\nSubject: ${subject}\nDuration: ${duration} minutes`
                            });
                        }
                    }, parseInt(duration) * 60 * 1000);
                    break;

                case 'stop':
                    if (!sessions[userId] || !sessions[userId].active) {
                        await sock.sendMessage(remoteJid, {
                            text: '*❌ No active study session found*'
                        });
                        return;
                    }

                    sessions[userId].active = false;
                    await fs.promises.writeFile(studyPath, JSON.stringify(sessions, null, 2));
                    await sock.sendMessage(remoteJid, {
                        text: '*✅ Study session stopped*'
                    });
                    break;

                case 'status':
                    if (!sessions[userId] || !sessions[userId].active) {
                        await sock.sendMessage(remoteJid, {
                            text: '*📊 No active study session*'
                        });
                        return;
                    }

                    const startTime = new Date(sessions[userId].startTime);
                    const elapsedMinutes = Math.floor((new Date() - startTime) / 60000);
                    const remainingMinutes = sessions[userId].duration - elapsedMinutes;

                    await sock.sendMessage(remoteJid, {
                        text: `*📊 Study Session Status*\nSubject: ${sessions[userId].subject}\nElapsed: ${elapsedMinutes} minutes\nRemaining: ${remainingMinutes} minutes`
                    });
                    break;
            }
        } catch (err) {
            await handleError(sock, message.key.remoteJid, err, 'Error managing study session');
        }
    }

};

module.exports = {
    commands: educationalCommands,
    category: 'educational',
    async init() {
        try {
            logger.moduleInit('Educational');

            // Initialize and check core dependencies
            const fsPromises = fs.promises;
            if (!fsPromises) {
                throw new Error('fs.promises is not available');
            }

            const coreDeps = {
                path,
                logger,
                fs: fsPromises,
                mathjs,
                ChartJSNodeCanvas
            };

            // Verify each dependency
            for (const [name, dep] of Object.entries(coreDeps)) {
                if (!dep) {
                    throw new Error(`Core educational dependency '${name}' is not initialized`);
                }
                logger.info(`✓ Core educational dependency '${name}' verified`);
            }

            // Create and verify data directory
            const dataDir = await ensureDataDir();
            logger.info(`✓ Data directory verified: ${dataDir}`);

            // Initialize module state
            logger.moduleSuccess('Educational');
            return true;
        } catch (err) {
            logger.moduleError('Educational', err);
            return false;
        }
    }
};