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
        try {
            const remoteJid = message.key.remoteJid;
            const [action, topic, ...nodes] = args;

            if (!action || !['create', 'view', 'add'].includes(action)) {
                await sock.sendMessage(remoteJid, {
                    text: '*🧠 Usage:* .mindmap [create|view|add] [topic] [nodes]\nExample: .mindmap create physics "Forces,Motion,Energy"'
                });
                return;
            }

            const mindmapsPath = path.join(__dirname, '../../data/educational/mindmaps.json');
            let mindmaps = {};

            try {
                const data = await fs.promises.readFile(mindmapsPath, 'utf8');
                mindmaps = JSON.parse(data);
            } catch (err) {
                mindmaps = {};
            }

            switch (action) {
                case 'create':
                    if (!topic || nodes.length === 0) {
                        await sock.sendMessage(remoteJid, {
                            text: '*❌ Please provide topic and initial nodes*'
                        });
                        return;
                    }

                    mindmaps[topic] = {
                        nodes: nodes[0].split(','),
                        created: new Date().toISOString(),
                        updated: new Date().toISOString()
                    };

                    await fs.promises.writeFile(mindmapsPath, JSON.stringify(mindmaps, null, 2));
                    await sock.sendMessage(remoteJid, {
                        text: '*✅ Mind map created successfully*'
                    });
                    break;

                case 'add':
                    if (!mindmaps[topic]) {
                        await sock.sendMessage(remoteJid, {
                            text: '*❌ Mind map not found*'
                        });
                        return;
                    }

                    const newNodes = nodes[0].split(',');
                    mindmaps[topic].nodes.push(...newNodes);
                    mindmaps[topic].updated = new Date().toISOString();

                    await fs.promises.writeFile(mindmapsPath, JSON.stringify(mindmaps, null, 2));
                    await sock.sendMessage(remoteJid, {
                        text: '*✅ Nodes added to mind map*'
                    });
                    break;

                case 'view':
                    if (!mindmaps[topic]) {
                        await sock.sendMessage(remoteJid, {
                            text: '*❌ Mind map not found*'
                        });
                        return;
                    }

                    const mindmap = mindmaps[topic];
                    let display = `*🧠 Mind Map: ${topic}*\n\n`;
                    display += `*Nodes:*\n${mindmap.nodes.map(node => `• ${node}`).join('\n')}\n\n`;
                    display += `Created: ${new Date(mindmap.created).toLocaleDateString()}\n`;
                    display += `Last Updated: ${new Date(mindmap.updated).toLocaleDateString()}`;

                    await sock.sendMessage(remoteJid, { text: display });
                    break;
            }
        } catch (err) {
            await handleError(sock, message.key.remoteJid, err, 'Error managing mind maps');
        }
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
    async historicalEvent(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            const [era, ...eventQuery] = args;

            if (!era || eventQuery.length === 0) {
                await sock.sendMessage(remoteJid, {
                    text: '*📅 Usage:* .historicalEvent [ancient|medieval|modern|contemporary] [event]\nExample: .historicalEvent modern "World War II"'
                });
                return;
            }

            const historicalData = {
                ancient: {
                    "Roman Empire": {
                        period: "27 BC - 476 AD",
                        location: "Europe, North Africa, Middle East",
                        keyEvents: [
                            "Foundation by Augustus (27 BC)",
                            "Peak under Trajan (117 AD)",
                            "Fall of Western Empire (476 AD)"
                        ],
                        significance: "Established lasting cultural, legal, and linguistic influences"
                    }
                },
                medieval: {
                    "Crusades": {
                        period: "1095 - 1291",
                        location: "Europe and Middle East",
                        keyEvents: [
                            "First Crusade (1095-1099)",
                            "Capture of Jerusalem (1099)",
                            "Fall of Acre (1291)"
                        ],
                        significance: "Cultural exchange between Europe and Middle East"
                    }
                },
                modern: {
                    "World War II": {
                        period: "1939 - 1945",
                        location: "Global",
                        keyEvents: [
                            "German invasion of Poland (1939)",
                            "Pearl Harbor Attack (1941)",
                            "D-Day (1944)",
                            "Atomic bombings (1945)"
                        ],
                        significance: "Reshaped global political landscape"
                    }
                }
            };

            const event = eventQuery.join(' ');
            if (!historicalData[era] || !historicalData[era][event]) {
                await sock.sendMessage(remoteJid, {
                    text: '*❌ Event not found in database*'
                });
                return;
            }

            const data = historicalData[era][event];
            let response = `*📜 Historical Event: ${event}*\n\n`;
            response += `*Period:* ${data.period}\n`;
            response += `*Location:* ${data.location}\n\n`;
            response += `*Key Events:*\n${data.keyEvents.map(e => `• ${e}`).join('\n')}\n\n`;
            response += `*Historical Significance:*\n${data.significance}`;

            await sock.sendMessage(remoteJid, { text: response });
        } catch (err) {
            await handleError(sock, message.key.remoteJid, err, 'Error retrieving historical event');
        }
    },

    async academicCite(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            const [style, ...sourceDetails] = args;

            if (!style || sourceDetails.length === 0) {
                await sock.sendMessage(remoteJid, {
                    text: '*📚 Usage:* .academicCite [apa|mla|chicago] [author] [title] [year] [source]\nExample: .academicCite apa "John Smith" "Research Paper" 2024 "Journal of Science"'
                });
                return;
            }

            const citationStyles = {
                apa: (author, title, year, source) => 
                    `${author}. (${year}). ${title}. ${source}.`,
                mla: (author, title, year, source) =>
                    `${author}. "${title}." ${source}, ${year}.`,
                chicago: (author, title, year, source) =>
                    `${author}. "${title}." ${source} (${year}).`
            };

            if (!citationStyles[style.toLowerCase()]) {
                await sock.sendMessage(remoteJid, {
                    text: '*❌ Invalid citation style*\nAvailable styles: apa, mla, chicago'
                });
                return;
            }

            const [author, title, year, source] = sourceDetails;
            const citation = citationStyles[style.toLowerCase()](author, title, year, source);

            await sock.sendMessage(remoteJid, {
                text: `*📝 Citation (${style.toUpperCase()}):*\n\n${citation}`
            });
        } catch (err) {
            await handleError(sock, message.key.remoteJid, err, 'Error generating citation');
        }
    },

    async mathPractice(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            const [topic] = args;

            if (!topic) {
                await sock.sendMessage(remoteJid, {
                    text: '*🔢 Usage:* .mathPractice [topic]\nAvailable topics: algebra, calculus, geometry'
                });
                return;
            }

            const problems = {
                algebra: [
                    {
                        question: "Solve for x: 3x + 5 = 14",
                        solution: "x = 3",
                        steps: [
                            "1. Subtract 5 from both sides: 3x = 9",
                            "2. Divide both sides by 3: x = 3",
                            "3. Verify: 3(3) + 5 = 14 ✓"
                        ]
                    },
                    {
                        question: "Simplify: 2(x + 3) - 4x",
                        solution: "2x + 6 - 4x = -2x + 6",
                        steps: [
                            "1. Distribute 2: 2x + 6",
                            "2. Combine like terms: 2x - 4x + 6",
                            "3. Simplify: -2x + 6"
                        ]
                    }
                ],
                calculus: [
                    {
                        question: "Find d/dx of x² + 3x",
                        solution: "2x + 3",
                        steps: [
                            "1. Power rule on x²: 2x",
                            "2. Power rule on 3x: 3",
                            "3. Add terms: 2x + 3"
                        ]
                    }
                ],
                geometry: [
                    {
                        question: "Find the area of a triangle with base 6 and height 8",
                        solution: "24 square units",
                        steps: [
                            "1. Use formula: A = ½bh",
                            "2. Plug in values: A = ½(6)(8)",
                            "3. Calculate: A = 24"
                        ]
                    }
                ]
            };

            if (!problems[topic]) {
                await sock.sendMessage(remoteJid, {
                    text: '*❌ Invalid topic*\nAvailable topics: ' + Object.keys(problems).join(', ')
                });
                return;
            }

            // Select random problem
            const problem = problems[topic][Math.floor(Math.random() * problems[topic].length)];
            
            let response = `*📝 Math Practice - ${topic}*\n\n`;
            response += `*Question:*\n${problem.question}\n\n`;
            response += `*Need help? Use .solution to see the steps.*`;

            // Store the solution for later
            const solutionsPath = path.join(__dirname, '../../data/educational/math_solutions.json');
            let solutions = {};
            try {
                const data = await fs.promises.readFile(solutionsPath, 'utf8');
                solutions = JSON.parse(data);
            } catch (err) {
                solutions = {};
            }

            solutions[remoteJid] = {
                problem: problem.question,
                solution: problem.solution,
                steps: problem.steps,
                timestamp: new Date().toISOString()
            };

            await fs.promises.writeFile(solutionsPath, JSON.stringify(solutions, null, 2));
            await sock.sendMessage(remoteJid, { text: response });

        } catch (err) {
            await handleError(sock, message.key.remoteJid, err, 'Error generating math practice');
        }
    },

    async solution(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            
            const solutionsPath = path.join(__dirname, '../../data/educational/math_solutions.json');
            let solutions = {};
            try {
                const data = await fs.promises.readFile(solutionsPath, 'utf8');
                solutions = JSON.parse(data);
            } catch (err) {
                await sock.sendMessage(remoteJid, {
                    text: '*❌ No active math problem found*'
                });
                return;
            }

            const userSolution = solutions[remoteJid];
            if (!userSolution || new Date() - new Date(userSolution.timestamp) > 3600000) {
                await sock.sendMessage(remoteJid, {
                    text: '*❌ No active math problem found or solution expired*'
                });
                return;
            }

            let response = `*📊 Solution:*\n\n`;
            response += `*Problem:*\n${userSolution.problem}\n\n`;
            response += `*Steps:*\n${userSolution.steps.join('\n')}\n\n`;
            response += `*Final Answer:*\n${userSolution.solution}`;

            await sock.sendMessage(remoteJid, { text: response });

        } catch (err) {
            await handleError(sock, message.key.remoteJid, err, 'Error showing solution');
        }
    },

    async studyPlan(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            const [action, subject, ...details] = args;

            if (!action || !['create', 'view', 'update'].includes(action)) {
                await sock.sendMessage(remoteJid, {
                    text: '*📚 Usage:* .studyPlan [create|view|update] [subject] [details]\nExample: .studyPlan create math "Chapter 1: 30min, Chapter 2: 45min"'
                });
                return;
            }

            const plansPath = path.join(__dirname, '../../data/educational/study_plans.json');
            let plans = {};

            try {
                const data = await fs.promises.readFile(plansPath, 'utf8');
                plans = JSON.parse(data);
            } catch (err) {
                plans = {};
            }

            switch (action) {
                case 'create':
                    if (!subject || details.length === 0) {
                        await sock.sendMessage(remoteJid, {
                            text: '*❌ Please provide subject and study plan details*'
                        });
                        return;
                    }

                    plans[subject] = {
                        details: details.join(' '),
                        created: new Date().toISOString(),
                        lastStudied: null,
                        progress: 0
                    };

                    await fs.promises.writeFile(plansPath, JSON.stringify(plans, null, 2));
                    await sock.sendMessage(remoteJid, {
                        text: '*✅ Study plan created successfully*'
                    });
                    break;

                case 'view':
                    if (!subject) {
                        const subjects = Object.keys(plans);
                        if (subjects.length === 0) {
                            await sock.sendMessage(remoteJid, {
                                text: '*❌ No study plans found*'
                            });
                            return;
                        }

                        let response = '*📚 Study Plans:*\n\n';
                        subjects.forEach(s => {
                            response += `• ${s} (Progress: ${plans[s].progress}%)\n`;
                        });
                        await sock.sendMessage(remoteJid, { text: response });
                        return;
                    }

                    if (!plans[subject]) {
                        await sock.sendMessage(remoteJid, {
                            text: '*❌ Study plan not found*'
                        });
                        return;
                    }

                    const plan = plans[subject];
                    let response = `*📚 Study Plan for ${subject}*\n\n`;
                    response += `*Details:*\n${plan.details}\n\n`;
                    response += `*Progress:* ${plan.progress}%\n`;
                    response += `*Created:* ${new Date(plan.created).toLocaleDateString()}\n`;
                    if (plan.lastStudied) {
                        response += `*Last Studied:* ${new Date(plan.lastStudied).toLocaleDateString()}`;
                    }

                    await sock.sendMessage(remoteJid, { text: response });
                    break;

                case 'update':
                    if (!subject || details.length === 0) {
                        await sock.sendMessage(remoteJid, {
                            text: '*❌ Please provide subject and progress update*'
                        });
                        return;
                    }

                    if (!plans[subject]) {
                        await sock.sendMessage(remoteJid, {
                            text: '*❌ Study plan not found*'
                        });
                        return;
                    }

                    const progress = parseInt(details[0]);
                    if (isNaN(progress) || progress < 0 || progress > 100) {
                        await sock.sendMessage(remoteJid, {
                            text: '*❌ Progress must be a number between 0 and 100*'
                        });
                        return;
                    }

                    plans[subject].progress = progress;
                    plans[subject].lastStudied = new Date().toISOString();

                    await fs.promises.writeFile(plansPath, JSON.stringify(plans, null, 2));
                    await sock.sendMessage(remoteJid, {
                        text: `*✅ Progress updated to ${progress}%*`
                    });
                    break;
            }

        } catch (err) {
            await handleError(sock, message.key.remoteJid, err, 'Error managing study plan');
        }
    },

    async literatureAnalysis(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            const text = args.join(' ');

            if (!text) {
                await sock.sendMessage(remoteJid, {
                    text: '*📖 Usage:* .literatureAnalysis [text]\nExample: .literatureAnalysis "To be or not to be"'
                });
                return;
            }

            // Basic literary analysis
            const analysis = {
                wordCount: text.split(/\s+/).length,
                sentenceCount: text.split(/[.!?]+/).length,
                themes: [],
                tone: '',
                literaryDevices: []
            };

            // Detect themes and tone
            const themeKeywords = {
                love: ['love', 'heart', 'passion'],
                death: ['death', 'die', 'mortality'],
                nature: ['nature', 'tree', 'flower'],
                freedom: ['freedom', 'liberty', 'free']
            };

            for (const [theme, keywords] of Object.entries(themeKeywords)) {
                if (keywords.some(keyword => text.toLowerCase().includes(keyword))) {
                    analysis.themes.push(theme);
                }
            }

            // Detect literary devices
            const devices = {
                alliteration: /(\b\w)\w+\s+\1\w+/i,
                repetition: /\b(\w+)\b(?:\s+\w+){0,5}\s+\1\b/i,
                metaphor: /(like|as)\s+a?\s+\w+/i
            };

            for (const [device, pattern] of Object.entries(devices)) {
                if (pattern.test(text)) {
                    analysis.literaryDevices.push(device);
                }
            }

            let response = `*📚 Literary Analysis:*\n\n`;
            response += `*Text Length:*\n• Words: ${analysis.wordCount}\n• Sentences: ${analysis.sentenceCount}\n\n`;
            
            if (analysis.themes.length > 0) {
                response += `*Detected Themes:*\n${analysis.themes.map(t => `• ${t}`).join('\n')}\n\n`;
            }

            if (analysis.literaryDevices.length > 0) {
                response += `*Literary Devices:*\n${analysis.literaryDevices.map(d => `• ${d}`).join('\n')}`;
            }

            await sock.sendMessage(remoteJid, { text: response });
        } catch (err) {
            await handleError(sock, message.key.remoteJid, err, 'Error analyzing text');
        }
    },

    async mathExplain(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            const problem = args.join(' ');

            if (!problem) {
                await sock.sendMessage(remoteJid, {
                    text: '*🔢 Usage:* .mathExplain [problem]\nExample: .mathExplain solve quadratic equation x^2 + 2x + 1 = 0'
                });
                return;
            }

            const explanations = {
                'quadratic': {
                    steps: [
                        "1. Identify the coefficients a, b, and c",
                        "2. Use the quadratic formula: x = (-b ± √(b² - 4ac)) / 2a",
                        "3. Calculate the discriminant: b² - 4ac",
                        "4. Solve for both possible values of x"
                    ],
                    example: "For x² + 2x + 1 = 0:\na = 1, b = 2, c = 1\nDiscriminant = 4 - 4(1)(1) = 0\nx = -1 (double root)"
                },
                'derivative': {
                    steps: [
                        "1. Apply the power rule: d/dx(x^n) = nx^(n-1)",
                        "2. Apply the constant rule: d/dx(c) = 0",
                        "3. Apply the sum rule: d/dx(f + g) = f' + g'",
                        "4. Combine the terms"
                    ],
                    example: "For d/dx(x² + 2x):\nd/dx(x²) = 2x\nd/dx(2x) = 2\nResult: 2x + 2"
                }
            };

            let explanation = `*📝 Mathematical Explanation:*\n\n`;
            explanation += `*Problem:* ${problem}\n\n`;

            // Identify the type of problem
            if (problem.includes('quadratic')) {
                explanation += `*Steps for Solving Quadratic Equations:*\n${explanations.quadratic.steps.join('\n')}\n\n`;
                explanation += `*Example:*\n${explanations.quadratic.example}`;
            } else if (problem.includes('derivative')) {
                explanation += `*Steps for Finding Derivatives:*\n${explanations.derivative.steps.join('\n')}\n\n`;
                explanation += `*Example:*\n${explanations.derivative.example}`;
            } else {
                // Default explanation
                explanation += `*General Problem-Solving Steps:*\n`;
                explanation += `1. Understand the problem\n`;
                explanation += `2. Identify known and unknown variables\n`;
                explanation += `3. Select appropriate formula or method\n`;
                explanation += `4. Solve step by step\n`;
                explanation += `5. Verify the solution`;
            }

            await sock.sendMessage(remoteJid, { text: explanation });
        } catch (err) {
            await handleError(sock, message.key.remoteJid, err, 'Error explaining math problem');
        }
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
    },
    async flashcard(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            const [action, subject, ...content] = args;

            if (!action || !['create', 'review', 'list'].includes(action)) {
                await sock.sendMessage(remoteJid, {
                    text: '*📝 Usage:* .flashcard [create|review|list] [subject] [front::back]\nExample: .flashcard create biology "What is DNA::Deoxyribonucleic acid"'
                });
                return;
            }

            const flashcardsPath = path.join(__dirname, '../../data/educational/flashcards.json');
            let flashcards = {};

            try {
                const data = await fs.promises.readFile(flashcardsPath, 'utf8');
                flashcards = JSON.parse(data);
            } catch (err) {
                flashcards = {};
            }

            switch (action) {
                case 'create':
                    if (!subject || content.length === 0) {
                        await sock.sendMessage(remoteJid, {
                            text: '*❌ Please provide subject and flashcard content*'
                        });
                        return;
                    }

                    const [front, back] = content.join(' ').split('::');
                    if (!front || !back) {
                        await sock.sendMessage(remoteJid, {
                            text: '*❌ Invalid flashcard format. Use front::back*'
                        });
                        return;
                    }

                    flashcards[subject] = flashcards[subject] || [];
                    flashcards[subject].push({
                        front,
                        back,
                        created: new Date().toISOString()
                    });

                    await fs.promises.writeFile(flashcardsPath, JSON.stringify(flashcards, null, 2));
                    await sock.sendMessage(remoteJid, {
                        text: '*✅ Flashcard created successfully*'
                    });
                    break;

                case 'review':
                    if (!flashcards[subject] || flashcards[subject].length === 0) {
                        await sock.sendMessage(remoteJid, {
                            text: '*❌ No flashcards found for this subject*'
                        });
                        return;
                    }

                    const randomCard = flashcards[subject][Math.floor(Math.random() * flashcards[subject].length)];
                    await sock.sendMessage(remoteJid, {
                        text: `*📚 Flashcard Review*\n\n*Question:*\n${randomCard.front}\n\n*Answer (reply with .answer to reveal):*\n||${randomCard.back}||`
                    });
                    break;

                case 'list':
                    const subjects = Object.keys(flashcards);
                    if (subjects.length === 0) {
                        await sock.sendMessage(remoteJid, {
                            text: '*❌ No flashcards found*'
                        });
                        return;
                    }

                    const subjectsList = subjects.map(s => `📚 ${s}: ${flashcards[s].length} cards`).join('\n');
                    await sock.sendMessage(remoteJid, {
                        text: `*Available Flashcard Subjects:*\n\n${subjectsList}`
                    });
                    break;
            }
        } catch (err) {
            await handleError(sock, message.key.remoteJid, err, 'Error managing flashcards');
        }
    },

    async research(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            const query = args.join(' ');

            if (!query) {
                await sock.sendMessage(remoteJid, {
                    text: '*📚 Usage:* .research [topic]\nExample: .research quantum physics'
                });
                return;
            }

            await sock.sendMessage(remoteJid, { text: '*🔍 Searching scholarly articles...*' });

            // Using Open Access API for academic research
            const response = await axios.get(`https://core.ac.uk/api/v3/search/articles`, {
                params: {
                    q: query,
                    limit: 5,
                    metadata: true
                },
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (response.data && response.data.results) {
                let results = '*📚 Research Results:*\n\n';
                response.data.results.forEach((article, index) => {
                    results += `${index + 1}. *${article.title}*\n`;
                    if (article.authors) results += `Authors: ${article.authors.join(', ')}\n`;
                    if (article.abstract) results += `Abstract: ${article.abstract.substring(0, 200)}...\n`;
                    results += '\n';
                });

                await sock.sendMessage(remoteJid, { text: results });
            } else {
                await sock.sendMessage(remoteJid, {
                    text: '*❌ No research articles found*'
                });
            }
        } catch (err) {
            await handleError(sock, message.key.remoteJid, err, 'Error searching research articles');
        }
    },

    async mindmap(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            const [action, topic, ...nodes] = args;

            if (!action || !['create', 'view', 'add'].includes(action)) {
                await sock.sendMessage(remoteJid, {
                    text: '*🧠 Usage:* .mindmap [create|view|add] [topic] [nodes]\nExample: .mindmap create physics "Forces,Motion,Energy"'
                });
                return;
            }

            const mindmapsPath = path.join(__dirname, '../../data/educational/mindmaps.json');
            let mindmaps = {};

            try {
                const data = await fs.promises.readFile(mindmapsPath, 'utf8');
                mindmaps = JSON.parse(data);
            } catch (err) {
                mindmaps = {};
            }

            switch (action) {
                case 'create':
                    if (!topic || nodes.length === 0) {
                        await sock.sendMessage(remoteJid, {
                            text: '*❌ Please provide topic and initial nodes*'
                        });
                        return;
                    }

                    mindmaps[topic] = {
                        nodes: nodes[0].split(','),
                        created: new Date().toISOString(),
                        updated: new Date().toISOString()
                    };

                    await fs.promises.writeFile(mindmapsPath, JSON.stringify(mindmaps, null, 2));
                    await sock.sendMessage(remoteJid, {
                        text: '*✅ Mind map created successfully*'
                    });
                    break;

                case 'add':
                    if (!mindmaps[topic]) {
                        await sock.sendMessage(remoteJid, {
                            text: '*❌ Mind map not found*'
                        });
                        return;
                    }

                    const newNodes = nodes[0].split(',');
                    mindmaps[topic].nodes.push(...newNodes);
                    mindmaps[topic].updated = new Date().toISOString();

                    await fs.promises.writeFile(mindmapsPath, JSON.stringify(mindmaps, null, 2));
                    await sock.sendMessage(remoteJid, {
                        text: '*✅ Nodes added to mind map*'
                    });
                    break;

                case 'view':
                    if (!mindmaps[topic]) {
                        await sock.sendMessage(remoteJid, {
                            text: '*❌ Mind map not found*'
                        });
                        return;
                    }

                    const mindmap = mindmaps[topic];
                    let display = `*🧠 Mind Map: ${topic}*\n\n`;
                    display += `*Nodes:*\n${mindmap.nodes.map(node => `• ${node}`).join('\n')}\n\n`;
                    display += `Created: ${new Date(mindmap.created).toLocaleDateString()}\n`;
                    display += `Last Updated: ${new Date(mindmap.updated).toLocaleDateString()}`;

                    await sock.sendMessage(remoteJid, { text: display });
                    break;
            }
        } catch (err) {
            await handleError(sock, message.key.remoteJid, err, 'Error managing mind maps');
        }
    },
    // Adding new advanced scientific commands
    async molecule(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            const formula = args.join('');

            if (!formula) {
                await sock.sendMessage(remoteJid, {
                    text: '*🧪 Usage:* .molecule [chemical_formula]\nExample: .molecule H2O'
                });
                return;
            }

            // Use regex to parse chemical formula
            const elements = formula.match(/[A-Z][a-z]?\d*/g);
            if (!elements) {
                await sock.sendMessage(remoteJid, {
                    text: '*❌ Invalid chemical formula*'
                });
                return;
            }

            let analysis = '*🔬 Molecular Analysis:*\n\n';
            let totalMass = 0;
            const atomicMasses = {
                H: 1.008, He: 4.003, Li: 6.941, Be: 9.012,
                B: 10.811, C: 12.011, N: 14.007, O: 15.999,
                F: 18.998, Ne: 20.180, Na: 22.990, Mg: 24.305,
                Al: 26.982, Si: 28.086, P: 30.974, S: 32.065,
                Cl: 35.453, Ar: 39.948, K: 39.098, Ca: 40.078
            };

            elements.forEach(element => {
                const [, symbol, count = '1'] = element.match(/([A-Z][a-z]?)(\d*)/);
                const quantity = parseInt(count);
                const mass = atomicMasses[symbol] * quantity;
                totalMass += mass;
                analysis += `${symbol}: ${quantity} atom(s) × ${atomicMasses[symbol]} g/mol = ${mass.toFixed(3)} g/mol\n`;
            });

            analysis += `\n*Total Molecular Mass:* ${totalMass.toFixed(3)} g/mol`;
            await sock.sendMessage(remoteJid, { text: analysis });
        } catch (err) {
            await handleError(sock, message.key.remoteJid, err, 'Error analyzing molecule');
        }
    },

    async equation(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            const equation = args.join(' ');

            if (!equation) {
                await sock.sendMessage(remoteJid, {
                    text: '*📝 Usage:* .equation [math_equation]\nExample: .equation x^2 + 2x + 1 = 0'
                });
                return;
            }

            // Parse and solve equation using mathjs
            const solution = mathjs.solve(equation, 'x');
            let response = '*🔢 Equation Solution:*\n\n';
            response += `Equation: ${equation}\n`;
            response += `Solution: x = ${Array.isArray(solution) ? solution.join(' or x = ') : solution}`;

            await sock.sendMessage(remoteJid, { text: response });
        } catch (err) {
            await handleError(sock, message.key.remoteJid, err, 'Error solving equation');
        }
    },

    async unitconvert(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            const [value, fromUnit, toUnit] = args;

            if (!value || !fromUnit || !toUnit) {
                await sock.sendMessage(remoteJid, {
                    text: '*📏 Usage:* .unitconvert [value] [from_unit] [to_unit]\nExample: .unitconvert 100 km mi'
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

    async factorize(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            const number = parseInt(args[0]);

            if (!number || isNaN(number)) {
                await sock.sendMessage(remoteJid, {
                    text: '*🔢 Usage:* .factorize [number]\nExample: .factorize 24'
                });
                return;
            }

            const factors = [];
            for (let i = 1; i <= Math.sqrt(number); i++) {
                if (number % i === 0) {
                    factors.push(i);
                    if (i !== number / i) {
                        factors.push(number / i);
                    }
                }
            }

            factors.sort((a, b) => a - b);
            await sock.sendMessage(remoteJid, {
                text: `*🔢 Factors of ${number}:*\n${factors.join(', ')}`
            });
        } catch (err) {
            await handleError(sock, message.key.remoteJid, err, 'Error factorizing number');
        }
    },
    // Adding new language learning commands
    async pronunciation(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            const word = args.join(' ');

            if (!word) {
                await sock.sendMessage(remoteJid, {
                    text: '*🗣️ Usage:* .pronunciation [word]\nExample: .pronunciation hello'
                });
                return;
            }

            // Using FreeDictionaryAPI for pronunciation
            const response = await axios.get(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);

            if (response.data && response.data.length > 0) {
                const entry = response.data[0];
                let result = `*🔊 Pronunciation Guide:*\n\n`;
                result += `Word: ${entry.word}\n`;

                if (entry.phonetics && entry.phonetics.length > 0) {
                    entry.phonetics.forEach(phonetic => {
                        if (phonetic.text) result += `IPA: ${phonetic.text}\n`;
                        if (phonetic.audio) result += `Audio: ${phonetic.audio}\n`;
                    });
                }

                await sock.sendMessage(remoteJid, { text: result });
            } else {
                await sock.sendMessage(remoteJid, {
                    text: '*❌ Pronunciation not found*'
                });
            }
        } catch (err) {
            await handleError(sock, message.key.remoteJid, err, 'Error getting pronunciation');
        }
    },

    async functionAnalysis(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            const expression = args.join(' ');

            if (!expression) {
                await sock.sendMessage(remoteJid, {
                    text: '*📊 Usage:* .functionAnalysis [function]\nExample: .functionAnalysis x^2 + 2x + 1'
                });
                return;
            }

            // Analyze function using mathjs
            const scope = { x: 0 };
            const derivative = mathjs.derivative(expression, 'x').toString();
            const integral = mathjs.integral(expression, 'x').toString();

            // Find critical points
            const criticalPoints = [];
            for (let x = -10; x <= 10; x += 0.1) {
                scope.x = x;
                const dy = mathjs.evaluate(derivative, scope);
                if (Math.abs(dy) < 0.1) {
                    criticalPoints.push(x.toFixed(2));
                }
            }

            let analysis = `*📈 Function Analysis:*\n\n`;
            analysis += `Function: ${expression}\n`;
            analysis += `Derivative: ${derivative}\n`;
            analysis += `Integral: ${integral}\n`;
            analysis += `Critical Points: ${criticalPoints.join(', ') || 'None found in range [-10, 10]'}\n`;

            await sock.sendMessage(remoteJid, { text: analysis });

            // Generate and send graph
            const chartBuffer = await createMathChart(expression);
            await sock.sendMessage(remoteJid, {
                image: chartBuffer,
                caption: `*Graph of:* ${expression}`
            });

        } catch (err) {
            await handleError(sock, message.key.remoteJid, err, 'Error analyzing function');
        }
    },

    async studyMaterial(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            const [subject, topic] = args;

            if (!subject || !topic) {
                await sock.sendMessage(remoteJid, {
                    text: '*📚 Usage:* .studyMaterial [subject] [topic]\nExample: .studyMaterial physics mechanics'
                });
                return;
            }

            const materialsPath = path.join(__dirname, '../../data/educational/study_materials.json');
            let materials = {};

            try {
                const data = await fs.promises.readFile(materialsPath, 'utf8');
                materials = JSON.parse(data);
            } catch (err) {
                materials = {
                    physics: {
                        mechanics: {
                            title: "Introduction to Mechanics",
                            content: [
                                "• Newton's Laws of Motion",
                                "• Conservation of Energy",
                                "• Momentum and Collisions",
                                "• Rotational Motion"
                            ],
                            examples: [
                                "1. A car accelerating on a straight road",
                                "2. A pendulum swinging back and forth",
                                "3. Two objects colliding elastically"
                            ],
                            practice: [
                                "Q1: Calculate the force needed to accelerate a 2kg mass at 5 m/s²",
                                "Q2: Find the potential energy of a 1kg mass at height 10m"
                            ]
                        }
                    }
                };
                await fs.promises.writeFile(materialsPath, JSON.stringify(materials, null, 2));
            }

            if (!materials[subject] || !materials[subject][topic]) {
                await sock.sendMessage(remoteJid, {
                    text: '*❌ Study material not found for this subject and topic*'
                });
                return;
            }

            const material = materials[subject][topic];
            let content = `*📚 ${material.title}*\n\n`;
            content += `*Key Concepts:*\n${material.content.join('\n')}\n\n`;
            content += `*Examples:*\n${material.examples.join('\n')}\n\n`;
            content += `*Practice Problems:*\n${material.practice.join('\n')}`;

            await sock.sendMessage(remoteJid, { text: content });
        } catch (err) {
            await handleError(sock, message.key.remoteJid, err, 'Error fetching study material');
        }
    },
    async quizScore(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            const [subject] = args;
            const userId = message.key.participant || message.key.remoteJid;

            if (!subject) {
                await sock.sendMessage(remoteJid, {
                    text: '*📊 Usage:* .quizScore [subject]\nExample: .quizScore math'
                });
                return;
            }

            const scoresPath = path.join(__dirname, '../../data/educational/quiz_scores.json');
            let scores = {};

            try {
                const data = await fs.promises.readFile(scoresPath, 'utf8');
                scores = JSON.parse(data);
            } catch (err) {
                scores = {};
            }

            scores[userId] = scores[userId] || {};
            scores[userId][subject] = scores[userId][subject] || {
                total: 0,
                correct: 0,
                history: []
            };

            const userScore = scores[userId][subject];
            let response = `*📊 Quiz Score for ${subject}*\n\n`;
            response += `Total Questions: ${userScore.total}\n`;
            response += `Correct Answers: ${userScore.correct}\n`;
            response += `Success Rate: ${((userScore.correct / userScore.total) * 100 || 0).toFixed(1)}%\n\n`;

            if (userScore.history.length > 0) {
                response += '*Recent Attempts:*\n';
                userScore.history.slice(-5).forEach((attempt, i) => {
                    response += `${i + 1}. ${attempt.date}: ${attempt.correct}/${attempt.total}\n`;
                });
            }

            await sock.sendMessage(remoteJid, { text: response });
        } catch (err) {
            await handleError(sock, message.key.remoteJid, err, 'Error retrieving quiz scores');
        }
    },

    async experiment(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            const [type] = args;

            if (!type) {
                await sock.sendMessage(remoteJid, {
                    text: '*🧪 Usage:* .experiment [type]\nAvailable types: pendulum, wave, chemical'
                });
                return;
            }

            const experiments = {
                pendulum: {
                    title: "Simple Pendulum",
                    description: "A weight suspended from a pivot point that swings back and forth under gravity.",
                    variables: [
                        "Length of string (L)",
                        "Mass of bob (m)",
                        "Gravity (g)",
                        "Maximum angle (θ)"
                    ],
                    formula: "Period T = 2π√(L/g)",
                    observations: [
                        "Period is independent of mass",
                        "Period increases with length",
                        "Small angle approximation valid for θ < 15°"
                    ]
                },
                wave: {
                    title: "Wave Properties",
                    description: "Study of mechanical waves and their properties.",
                    variables: [
                        "Frequency (f)",
                        "Wavelength (λ)",
                        "Amplitude (A)",
                        "Speed (v)"
                    ],
                    formula: "v = fλ",
                    observations: [
                        "Higher frequency = shorter wavelength",
                        "Energy proportional to amplitude squared",
                        "Speed depends on medium"
                    ]
                },
                chemical: {
                    title: "Acid-Base Reaction",
                    description: "Study of reaction between acids and bases.",
                    variables: [
                        "pH levels",
                        "Concentration",
                        "Temperature",
                        "Reaction rate"
                    ],
                    formula: "H+ + OH- → H2O",
                    observations: [
                        "Neutralization produces salt and water",
                        "pH changes during reaction",
                        "Temperature affects reaction rate"
                    ]
                }
            };

            if (!experiments[type]) {
                await sock.sendMessage(remoteJid, {
                    text: '*❌ Invalid experiment type*'
                });
                return;
            }

            const exp = experiments[type];
            let response = `*🔬 ${exp.title}*\n\n`;
            response += `*Description:*\n${exp.description}\n\n`;
            response += `*Variables:*\n${exp.variables.map(v => `• ${v}`).join('\n')}\n\n`;
            response += `*Key Formula:*\n${exp.formula}\n\n`;
            response += `*Observations:*\n${exp.observations.map(o => `• ${o}`).join('\n')}`;

            await sock.sendMessage(remoteJid, { text: response });
        } catch (err) {
            await handleError(sock, message.key.remoteJid, err, 'Error displaying experiment');
        }
    },

    async solveStep(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            const equation = args.join(' ');

            if (!equation) {
                await sock.sendMessage(remoteJid, {
                    text: '*📝 Usage:* .solveStep [equation]\nExample: .solveStep 2x + 5 = 15'
                });
                return;
            }

            // Parse equation
            const sides = equation.split('=').map(side => side.trim());
            if (sides.length !== 2) {
                await sock.sendMessage(remoteJid, {
                    text: '*❌ Invalid equation format. Use format: ax + b = c*'
                });
                return;
            }

            let steps = `*🔢 Step-by-Step Solution:*\n\n`;
            steps += `Original equation: ${equation}\n\n`;

            // Solve step by step
            try {
                const leftSide = sides[0];
                const rightSide = sides[1];

                // Step 1: Combine like terms on left side
                steps += `1️⃣ Combine like terms on left side:\n`;
                const combinedLeft = mathjs.simplify(leftSide).toString();
                steps += `${combinedLeft} = ${rightSide}\n\n`;

                // Step 2: Move all terms with x to left side
                steps += `2️⃣ Move all terms with x to left side:\n`;
                const withX = mathjs.simplify(`${combinedLeft} - ${rightSide}`).toString();
                steps += `${withX} = 0\n\n`;

                // Step 3: Solve for x
                steps += `3️⃣ Solve for x:\n`;
                const solution = mathjs.solve(equation, 'x');
                steps += `x = ${solution}\n\n`;

                // Step 4: Verify
                steps += `4️⃣ Verify solution:\n`;
                const verification = mathjs.evaluate(equation.replace(/x/g, `(${solution})`));
                steps += `Both sides equal: ${verification}`;

                await sock.sendMessage(remoteJid, { text: steps });
            } catch (err) {
                await sock.sendMessage(remoteJid, {
                    text: '*❌ Error solving equation. Please check format.*'
                });
            }
        } catch (err) {
            awaithandleError(sock, message.key.remoteJid, err, 'Error solving equation step by step');
        }
    },

    async languagePractice(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            const [language, level = 'beginner'] = args;

            if (!language) {
                await sock.sendMessage(remoteJid, {
                    text: '*🗣️ Usage:* .languagePractice [language] [level]\nExample: .languagePractice spanish beginner'
                });
                return;
            }

            const exercises = {
                spanish: {
                    beginner: {
                        vocabulary: [
                            { word: "hola", translation: "hello" },
                            { word: "gracias", translation: "thank you" },
                            { word: "por favor", translation: "please" }
                        ],
                        phrases: [
                            { text: "¿Cómo estás?", translation: "How are you?" },
                            { text: "Me llamo...", translation: "My name is..." },
                            { text: "Buenos días", translation: "Good morning" }
                        ],
                        grammar: [
                            "Present tense conjugation",
                            "Gender of nouns",
                            "Basic pronouns"
                        ]
                    },
                    intermediate: {
                        vocabulary: [
                            { word: "desarrollar", translation: "to develop" },
                            { word: "mientras", translation: "while" },
                            { word: "aunque", translation: "although" }
                        ],
                        phrases: [
                            { text: "¿Qué te parece?", translation: "What do you think?" },
                            { text: "Me da igual", translation: "I don't mind" },
                            { text: "Vale la pena", translation: "It's worth it" }
                        ],
                        grammar: [
                            "Past tenses",
                            "Subjunctive mood",
                            "Conditional sentences"
                        ]
                    }
                }
            };

            if (!exercises[language] || !exercises[language][level]) {
                await sock.sendMessage(remoteJid, {
                    text: '*❌ Language or level not available*'
                });
                return;
            }

            const practice = exercises[language][level];
            let response = `*📚 ${language.charAt(0).toUpperCase() + language.slice(1)} Practice (${level})*\n\n`;

            response += '*Vocabulary:*\n';
            practice.vocabulary.forEach(item => {
                response += `• ${item.word} - ${item.translation}\n`;
            });

            response += '\n*Common Phrases:*\n';
            practice.phrases.forEach(item => {
                response += `• ${item.text} - ${item.translation}\n`;
            });

            response += '\n*Grammar Focus:*\n';
            practice.grammar.forEach(item => {
                response += `• ${item}\n`;
            });

            await sock.sendMessage(remoteJid, { text: response });
        } catch (err) {
            await handleError(sock, message.key.remoteJid, err, 'Error providing language practice');
        }
    },
    // Add new scientific visualization commands
    async chemReaction(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            const [reactant1, reactant2] = args;

            if (!reactant1 || !reactant2) {
                await sock.sendMessage(remoteJid, {
                    text: '*🧪 Usage:* .chemReaction [reactant1] [reactant2]\nExample: .chemReaction HCl NaOH'
                });
                return;
            }

            const reactions = {
                'HCl+NaOH': {
                    products: ['NaCl', 'H2O'],
                    type: 'Neutralization',
                    balanced: 'HCl + NaOH → NaCl + H2O',
                    description: 'Acid-base neutralization reaction',
                    conditions: 'Room temperature, aqueous solution'
                },
                'H2+O2': {
                    products: ['H2O'],
                    type: 'Synthesis',
                    balanced: '2H2 + O2 → 2H2O',
                    description: 'Formation of water',
                    conditions: 'Requires activation energy (spark)'
                }
            };

            const reactionKey = `${reactant1}+${reactant2}`;
            const reaction = reactions[reactionKey];

            if (!reaction) {
                await sock.sendMessage(remoteJid, {
                    text: '*❌ Reaction not found in database*'
                });
                return;
            }

            let response = `*⚗️ Chemical Reaction Analysis:*\n\n`;
            response += `*Balanced Equation:*\n${reaction.balanced}\n\n`;
            response += `*Reaction Type:*\n${reaction.type}\n\n`;
            response += `*Products:*\n${reaction.products.join(', ')}\n\n`;
            response += `*Description:*\n${reaction.description}\n\n`;
            response += `*Conditions:*\n${reaction.conditions}`;

            await sock.sendMessage(remoteJid, { text: response });
        } catch (err) {
            await handleError(sock, message.key.remoteJid, err, 'Error analyzing chemical reaction');
        }
    },

    async physicsCalc(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            const [formula, ...values] = args;

            if (!formula || values.length === 0) {
                await sock.sendMessage(remoteJid, {
                    text: '*🔬 Usage:* .physicsCalc [formula] [values...]\nExample: .physicsCalc velocity 100 2'
                });
                return;
            }

            const formulas = {
                velocity: {
                    variables: ['distance', 'time'],
                    calculate: (d, t) => d / t,
                    unit: 'm/s',
                    equation: 'v = d/t'
                },
                force: {
                    variables: ['mass', 'acceleration'],
                    calculate: (m, a) => m * a,
                    unit: 'N',
                    equation: 'F = ma'
                },
                energy: {
                    variables: ['mass', 'height'],
                    calculate: (m, h) => m * 9.81 * h,
                    unit: 'J',
                    equation: 'E = mgh'
                }
            };

            if (!formulas[formula]) {
                await sock.sendMessage(remoteJid, {
                    text: '*❌ Formula not found*\nAvailable formulas: ' + Object.keys(formulas).join(', ')
                });
                return;
            }

            const calc = formulas[formula];
            if (values.length !== calc.variables.length) {
                await sock.sendMessage(remoteJid, {
                    text: `*❌ Required variables:* ${calc.variables.join(', ')}`
                });
                return;
            }

            const numValues = values.map(Number);
            const result = calc.calculate(...numValues);

            let response = `*📊 Physics Calculation:*\n\n`;
            response += `*Formula:* ${calc.equation}\n\n`;
            response += `*Given Values:*\n`;
            calc.variables.forEach((v, i) => {
                response += `${v}: ${numValues[i]}\n`;
            });
            response += `\n*Result:* ${result} ${calc.unit}`;

            await sock.sendMessage(remoteJid, { text: response });
        } catch (err) {
            await handleError(sock, message.key.remoteJid, err, 'Error in physics calculation');
        }
    },

    async bioSystem(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            const [system] = args;

            if (!system) {
                await sock.sendMessage(remoteJid, {
                    text: '*🧬 Usage:* .bioSystem [system]\nExample: .bioSystem circulatory'
                });
                return;
            }

            const systems = {
                circulatory: {
                    components: [
                        'Heart',
                        'Blood vessels',
                        'Blood'
                    ],
                    functions: [
                        'Transport of oxygen and nutrients',
                        'Removal of waste products',
                        'Temperature regulation'
                    ],
                    diseases: [
                        'Hypertension',
                        'Atherosclerosis',
                        'Heart disease'
                    ]
                },
                respiratory: {
                    components: [
                        'Lungs',
                        'Trachea',
                        'Bronchi'
                    ],
                    functions: [
                        'Gas exchange',
                        'Oxygen intake',
                        'Carbon dioxide removal'
                    ],
                    diseases: [
                        'Asthma',
                        'Bronchitis',
                        'Pneumonia'
                    ]
                }
            };

            if (!systems[system]) {
                await sock.sendMessage(remoteJid, {
                    text: '*❌ System not found*\nAvailable systems: ' + Object.keys(systems).join(', ')
                });
                return;
            }

            const bioSystem = systems[system];
            let response = `*🔬 ${system.charAt(0).toUpperCase() + system.slice(1)} System:*\n\n`;
            response += `*Components:*\n${bioSystem.components.map(c => `• ${c}`).join('\n')}\n\n`;
            response += `*Functions:*\n${bioSystem.functions.map(f => `• ${f}`).join('\n')}\n\n`;
            response += `*Common Diseases:*\n${bioSystem.diseases.map(d => `• ${d}`).join('\n')}`;

            await sock.sendMessage(remoteJid, { text: response });
        } catch (err) {
            await handleError(sock, message.key.remoteJid, err, 'Error displaying biological system');
        }
    },

    async mathVisualize(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            const [type, ...params] = args;

            if (!type || params.length === 0) {
                await sock.sendMessage(remoteJid, {
                    text: '*📊 Usage:* .mathVisualize [type] [parameters...]\nExample: .mathVisualize parabola 1 0 0'
                });
                return;
            }

            let equation;
            let title;
            switch (type) {
                case 'parabola':
                    const [a = 1, b = 0, c = 0] = params.map(Number);
                    equation = `${a}x^2 + ${b}x + ${c}`;
                    title = 'Quadratic Function';
                    break;
                case 'sine':
                    const [amplitude = 1, frequency = 1] = params.map(Number);
                    equation = `${amplitude}*sin(${frequency}*x)`;
                    title = 'Sine Wave';
                    break;
                case 'exponential':
                    const [base = Math.E, coefficient = 1] = params.map(Number);
                    equation = `${coefficient}*${base}^x`;
                    title = 'Exponential Function';
                    break;
                default:
                    await sock.sendMessage(remoteJid, {
                        text: '*❌ Invalid visualization type*\nAvailable types: parabola, sine, exponential'
                    });
                    return;
            }

            await sock.sendMessage(remoteJid, { text: '*📈 Generating visualization...*' });

            const chartBuffer = await createMathChart(equation);
            await sock.sendMessage(remoteJid, {
                image: chartBuffer,
                caption: `*${title}:* ${equation}`
            });
        } catch (err) {
            await handleError(sock, message.key.remoteJid, err, 'Error creating math visualization');
        }
    }
};

module.exports = {
    educationalCommands,
    init: async () => {
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
            logger.error('Educational module initialization failed:', err);
            return false;
        }
    }
};