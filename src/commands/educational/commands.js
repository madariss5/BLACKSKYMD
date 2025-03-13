const { handleError } = require('../../utils/error');
const path = require('path');
const fs = require('fs');
const fsPromises = fs.promises;
const mathjs = require('mathjs');
const { ChartJSNodeCanvas } = require('chartjs-node-canvas');
const logger = require('../../utils/logger');
const axios = require('axios');

// Safe file operations wrapper
async function safeFileOperation(operation, defaultValue = {}) {
    try {
        return await operation();
    } catch (err) {
        if (err.code === 'ENOENT') {
            return defaultValue;
        }
        throw err;
    }
}

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

// Ensure directory exists
async function ensureDirectory(dirPath) {
    if (!fs.existsSync(dirPath)) {
        await fsPromises.mkdir(dirPath, { recursive: true });
    }
}

// Command implementations
const commands = {
    // Language Translation Command
    async translate(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            const [targetLang, ...textParts] = args;
            const textToTranslate = textParts.join(' ');

            if (!targetLang || !textToTranslate) {
                await sock.sendMessage(remoteJid, {
                    text: '*🌐 Usage:* .translate [target_language] [text]\nExample: .translate es Hello, how are you?'
                });
                return;
            }

            // Target language should be a valid 2-letter ISO language code
            const validLanguageCodes = ['af', 'sq', 'am', 'ar', 'hy', 'az', 'eu', 'be', 'bn', 'bs', 'bg', 'ca', 'ceb', 'zh', 'zh-CN', 'zh-TW', 'co', 'hr', 'cs', 'da', 'nl', 'en', 'eo', 'et', 'fi', 'fr', 'fy', 'gl', 'ka', 'de', 'el', 'gu', 'ht', 'ha', 'haw', 'he', 'hi', 'hmn', 'hu', 'is', 'ig', 'id', 'ga', 'it', 'ja', 'jv', 'kn', 'kk', 'km', 'rw', 'ko', 'ku', 'ky', 'lo', 'la', 'lv', 'lt', 'lb', 'mk', 'mg', 'ms', 'ml', 'mt', 'mi', 'mr', 'mn', 'my', 'ne', 'no', 'ny', 'or', 'ps', 'fa', 'pl', 'pt', 'pa', 'ro', 'ru', 'sm', 'gd', 'sr', 'st', 'sn', 'sd', 'si', 'sk', 'sl', 'so', 'es', 'su', 'sw', 'sv', 'tl', 'tg', 'ta', 'tt', 'te', 'th', 'tr', 'tk', 'uk', 'ur', 'ug', 'uz', 'vi', 'cy', 'xh', 'yi', 'yo', 'zu'];
            
            if (!validLanguageCodes.includes(targetLang.toLowerCase())) {
                await sock.sendMessage(remoteJid, {
                    text: '*❌ Invalid target language code*\nPlease use a valid 2-letter ISO language code (e.g., "es" for Spanish).'
                });
                return;
            }

            await sock.sendMessage(remoteJid, { text: '🔄 Translating...' });

            // Use a free translation API
            const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(textToTranslate)}`;
            
            const response = await axios.get(url);
            
            if (response.data && response.data[0] && response.data[0][0]) {
                const translation = response.data[0].map(item => item[0]).join('');
                const detectedLang = response.data[2];
                
                await sock.sendMessage(remoteJid, {
                    text: `*🌐 Translation (${detectedLang} → ${targetLang})*\n\n${translation}`
                });
            } else {
                await sock.sendMessage(remoteJid, {
                    text: '*❌ Translation failed*\nPlease try again with a different text or language.'
                });
            }
        } catch (err) {
            await handleError(sock, message.key.remoteJid, err, 'Error translating text');
        }
    },
    
    // Grammar Checking Command
    async grammar(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            const text = args.join(' ');

            if (!text) {
                await sock.sendMessage(remoteJid, {
                    text: '*📝 Usage:* .grammar [text]\nExample: .grammar I have went to the store yesterday.'
                });
                return;
            }

            await sock.sendMessage(remoteJid, { text: '🔍 Checking grammar...' });

            try {
                // Since we don't want to use a paid API here, we'll implement a simple grammar checker
                // with common grammar rules
                const grammarIssues = [];
                
                // Check for common grammar mistakes
                const rules = [
                    { pattern: /\b(i|we|they|you|he|she|it) (is)\b/i, fix: 'are', issue: 'subject-verb agreement' },
                    { pattern: /\b(he|she|it) (are)\b/i, fix: 'is', issue: 'subject-verb agreement' },
                    { pattern: /\bhave went\b/i, fix: 'have gone', issue: 'incorrect past participle' },
                    { pattern: /\btheir is\b/i, fix: 'there is', issue: 'homophones' },
                    { pattern: /\btheir are\b/i, fix: 'there are', issue: 'homophones' },
                    { pattern: /\byour welcome\b/i, fix: "you're welcome", issue: 'contraction' },
                    { pattern: /\bits yours\b/i, fix: "it's yours", issue: 'contraction' },
                    { pattern: /\bit's color\b/i, fix: "its color", issue: 'possessive pronoun' },
                    { pattern: /\balot\b/i, fix: "a lot", issue: 'compound word' },
                    { pattern: /\bcould of\b/i, fix: "could have", issue: 'verb phrase' },
                    { pattern: /\bshould of\b/i, fix: "should have", issue: 'verb phrase' },
                    { pattern: /\bwould of\b/i, fix: "would have", issue: 'verb phrase' },
                    { pattern: /\bmust of\b/i, fix: "must have", issue: 'verb phrase' },
                    { pattern: /\bi seen\b/i, fix: "I saw", issue: 'past tense' },
                    { pattern: /\bless people\b/i, fix: "fewer people", issue: 'countable nouns' },
                    { pattern: /\bmore better\b/i, fix: "better", issue: 'comparative adjective' },
                    { pattern: /\bmost easiest\b/i, fix: "easiest", issue: 'superlative adjective' }
                ];

                for (const rule of rules) {
                    if (rule.pattern.test(text)) {
                        grammarIssues.push({
                            issue: rule.issue,
                            fix: text.replace(rule.pattern, rule.fix)
                        });
                    }
                }

                // Check for double negatives
                if (/\b(not|no|never|none|nobody|nowhere|neither)\b.*\b(not|no|never|none|nobody|nowhere|neither)\b/i.test(text)) {
                    grammarIssues.push({
                        issue: 'double negative',
                        fix: 'Remove one of the negatives'
                    });
                }

                // Check for missing apostrophes in common contractions
                const contractions = [
                    { pattern: /\bdont\b/i, fix: "don't" },
                    { pattern: /\bcant\b/i, fix: "can't" },
                    { pattern: /\bwont\b/i, fix: "won't" },
                    { pattern: /\bhasnt\b/i, fix: "hasn't" },
                    { pattern: /\bhavent\b/i, fix: "haven't" },
                    { pattern: /\bwouldnt\b/i, fix: "wouldn't" },
                    { pattern: /\bcouldnt\b/i, fix: "couldn't" },
                    { pattern: /\bshouldnt\b/i, fix: "shouldn't" },
                    { pattern: /\bwasnt\b/i, fix: "wasn't" },
                    { pattern: /\bisnt\b/i, fix: "isn't" },
                    { pattern: /\barent\b/i, fix: "aren't" },
                    { pattern: /\bthats\b/i, fix: "that's" }
                ];

                for (const contraction of contractions) {
                    if (contraction.pattern.test(text)) {
                        grammarIssues.push({
                            issue: 'missing apostrophe',
                            fix: text.replace(contraction.pattern, contraction.fix)
                        });
                    }
                }

                if (grammarIssues.length > 0) {
                    let response = `*📝 Grammar Check Results*\n\n`;
                    response += `*Original text:*\n${text}\n\n`;
                    response += `*Issues Found:* ${grammarIssues.length}\n\n`;
                    
                    grammarIssues.forEach((issue, index) => {
                        response += `*${index + 1}. Issue:* ${issue.issue}\n`;
                        response += `*Suggestion:* ${issue.fix}\n\n`;
                    });

                    await sock.sendMessage(remoteJid, { text: response });
                } else {
                    await sock.sendMessage(remoteJid, {
                        text: `*✅ Grammar Check*\n\nNo common grammatical issues found in your text. Note that this is a simple check and may not catch all errors.`
                    });
                }
            } catch (error) {
                await sock.sendMessage(remoteJid, {
                    text: `*❌ Grammar check failed*\nAn error occurred while checking your text.`
                });
                logger.error(`Grammar check error: ${error.message}`);
            }
        } catch (err) {
            await handleError(sock, message.key.remoteJid, err, 'Error checking grammar');
        }
    },
    
    // Language Learning Commands
    async vocabulary(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            const [action, language, ...words] = args;

            if (!action || !['add', 'test', 'list'].includes(action)) {
                await sock.sendMessage(remoteJid, {
                    text: '*📝 Usage:* .vocabulary [add|test|list] [language] [words]\nExample: .vocabulary add es casa,perro,gato'
                });
                return;
            }

            const vocabPath = path.join(__dirname, '../../../data/educational/vocabulary.json');
            await ensureDirectory(path.dirname(vocabPath));

            let vocabulary = await safeFileOperation(async () => {
                if (fs.existsSync(vocabPath)) {
                    const data = await fsPromises.readFile(vocabPath, 'utf8');
                    return JSON.parse(data);
                }
                return {};
            }, {});

            switch (action) {
                case 'add':
                    if (!language || words.length === 0) {
                        await sock.sendMessage(remoteJid, {
                            text: '*❌ Please provide language and words*'
                        });
                        return;
                    }

                    vocabulary[language] = vocabulary[language] || [];
                    const newWords = words.join(' ').split(',');
                    vocabulary[language].push(...newWords);

                    await fsPromises.writeFile(vocabPath, JSON.stringify(vocabulary, null, 2));
                    await sock.sendMessage(remoteJid, {
                        text: `*✅ Added ${newWords.length} words to ${language} vocabulary*`
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
                        text: `*📝 Vocabulary Test (${language}):*\n\n${randomWords.join('\n')}`
                    });
                    break;

                case 'list':
                    if (!vocabulary[language]) {
                        await sock.sendMessage(remoteJid, {
                            text: '*❌ No vocabulary found for this language*'
                        });
                        return;
                    }

                    await sock.sendMessage(remoteJid, {
                        text: `*📚 ${language} Vocabulary:*\n\n${vocabulary[language].join(', ')}`
                    });
                    break;
            }
        } catch (err) {
            await handleError(sock, message.key.remoteJid, err, 'Error managing vocabulary');
        }
    },

    // Mathematical Commands
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

            const problem = problems[topic][Math.floor(Math.random() * problems[topic].length)];

            let response = `*📝 Math Practice - ${topic}*\n\n`;
            response += `*Question:*\n${problem.question}\n\n`;
            response += `*Need help? Use .solution to see the steps.*`;

            const solutionsPath = path.join(__dirname, '../../../data/educational/math_solutions.json');
            await ensureDirectory(path.dirname(solutionsPath));
            let solutions = await safeFileOperation(async () => {
                if (fs.existsSync(solutionsPath)) {
                    const data = await fsPromises.readFile(solutionsPath, 'utf8');
                    return JSON.parse(data);
                }
                return {};
            }, {});

            solutions[remoteJid] = {
                problem: problem.question,
                solution: problem.solution,
                steps: problem.steps,
                timestamp: new Date().toISOString()
            };

            await fsPromises.writeFile(solutionsPath, JSON.stringify(solutions, null, 2));
            await sock.sendMessage(remoteJid, { text: response });

        } catch (err) {
            await handleError(sock, message.key.remoteJid, err, 'Error generating math practice');
        }
    },

    async solution(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;

            const solutionsPath = path.join(__dirname, '../../../data/educational/math_solutions.json');
            let solutions = await safeFileOperation(async () => {
                const data = await fsPromises.readFile(solutionsPath, 'utf8');
                return JSON.parse(data);
            }, {});

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

    async define(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            const word = args.join(' ');
            if (!word) {
                await sock.sendMessage(remoteJid, { text: '📚 Please provide a word to define' });
                return;
            }

            await sock.sendMessage(remoteJid, { text: '📖 Looking up definition...' });

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
    
    async calculate(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            const expression = args.join(' ');

            if (!expression) {
                await sock.sendMessage(remoteJid, {
                    text: '*🧮 Usage:* .calculate [expression]\nExample: .calculate 5 * (3 + 2) / 4'
                });
                return;
            }

            try {
                // Clean up the expression to prevent malicious code execution
                const cleanExpression = expression.replace(/[^0-9+\-*/^().,%\s]/g, '');
                
                // Evaluate using mathjs which is safe against code execution
                const result = mathjs.evaluate(cleanExpression);
                
                // Format different result types
                let formattedResult;
                if (typeof result === 'number') {
                    // Format the number to avoid excessive decimal places
                    formattedResult = result % 1 === 0 ? result.toString() : result.toFixed(6).replace(/\.?0+$/, '');
                } else if (typeof result === 'object' && result !== null) {
                    // Handle matrix results
                    formattedResult = mathjs.format(result, { precision: 6 });
                } else {
                    formattedResult = result.toString();
                }
                
                await sock.sendMessage(remoteJid, {
                    text: `*🧮 Calculation Result:*\n\n*Expression:* ${cleanExpression}\n*Result:* ${formattedResult}`
                });
            } catch (error) {
                await sock.sendMessage(remoteJid, {
                    text: `*❌ Calculation Error:*\n\n${error.message}\n\nPlease check your expression and try again.`
                });
            }
        } catch (err) {
            await handleError(sock, message.key.remoteJid, err, 'Error performing calculation');
        }
    },

    async wikipedia(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            const query = args.join(' ');

            if (!query) {
                await sock.sendMessage(remoteJid, {
                    text: '*🔍 Usage:* .wikipedia [search term]\nExample: .wikipedia Albert Einstein'
                });
                return;
            }

            await sock.sendMessage(remoteJid, { text: '🔍 Searching Wikipedia...' });

            try {
                // Use the Wikipedia API to get search results
                const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&utf8=1`;
                const searchResponse = await axios.get(searchUrl);
                
                if (!searchResponse.data.query.search.length) {
                    await sock.sendMessage(remoteJid, {
                        text: `*❌ No Wikipedia articles found for:* ${query}`
                    });
                    return;
                }
                
                // Get the first search result
                const firstResult = searchResponse.data.query.search[0];
                const pageId = firstResult.pageid;
                
                // Get the content of the page
                const contentUrl = `https://en.wikipedia.org/w/api.php?action=query&prop=extracts&exintro=1&explaintext=1&pageids=${pageId}&format=json&utf8=1`;
                const contentResponse = await axios.get(contentUrl);
                
                const page = contentResponse.data.query.pages[pageId];
                const extract = page.extract || 'No extract available.';
                
                // Truncate if too long
                const maxLength = 1500;
                let truncatedExtract = extract.length > maxLength 
                    ? extract.substring(0, maxLength) + '...\n\n(Content truncated, visit Wikipedia for more)'
                    : extract;
                
                // Get the URL for the article
                const articleUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, '_'))}`;
                
                let response = `*📚 Wikipedia: ${page.title}*\n\n`;
                response += truncatedExtract;
                response += `\n\n*Read more:* ${articleUrl}`;
                
                await sock.sendMessage(remoteJid, { text: response });
                
                // If there are more search results, mention them
                if (searchResponse.data.query.search.length > 1) {
                    const otherResults = searchResponse.data.query.search.slice(1, 4)
                        .map(result => result.title)
                        .join('\n• ');
                        
                    await sock.sendMessage(remoteJid, {
                        text: `*📋 Other relevant articles:*\n\n• ${otherResults}\n\nTo view any of these, use .wikipedia followed by the article title.`
                    });
                }
            } catch (error) {
                await sock.sendMessage(remoteJid, {
                    text: `*❌ Error searching Wikipedia:*\n\n${error.message}`
                });
                logger.error(`Wikipedia search error: ${error.message}`);
            }
        } catch (err) {
            await handleError(sock, message.key.remoteJid, err, 'Error searching Wikipedia');
        }
    },

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

            logger.info(`Solving equation: ${equation}`);
            const solution = mathjs.solve(equation);
            await sock.sendMessage(remoteJid, {
                text: `*📊 Solution:*\n${solution.toString()}`
            });
        } catch (err) {
            await handleError(sock, message.key.remoteJid, err, 'Error solving equation');
        }
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

    async scienceSimulation(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            const [topic, ...parameters] = args;

            if (!topic) {
                await sock.sendMessage(remoteJid, {
                    text: '*🔬 Usage:* .scienceSimulation [topic] [parameters]\nAvailable topics: gravity, waves, circuits'
                });
                return;
            }

            const simulations = {
                gravity: {
                    title: "Gravitational Motion",
                    calculate: (height, time) => ({
                        distance: (0.5 * 9.81 * time * time).toFixed(2),
                        velocity: (9.81 * time).toFixed(2)
                    }),
                    parameters: ["initial height (m)", "time (s)"],
                    description: "Simulates free fall motion under gravity"
                },
                waves: {
                    title: "Wave Properties",
                    calculate: (amplitude, frequency) => ({
                        wavelength: (3e8 / frequency).toFixed(2),
                        period: (1 / frequency).toFixed(4)
                    }),
                    parameters: ["amplitude (m)", "frequency (Hz)"],
                    description: "Calculates wave characteristics"
                },
                circuits: {
                    title: "Electric Circuit",
                    calculate: (voltage, resistance) => ({
                        current: (voltage / resistance).toFixed(2),
                        power: (voltage * voltage / resistance).toFixed(2)
                    }),
                    parameters: ["voltage (V)", "resistance (Ω)"],
                    description: "Analyzes simple electrical circuits"
                }
            };

            if (!simulations[topic]) {
                await sock.sendMessage(remoteJid, {
                    text: '*❌ Invalid simulation topic*\nAvailable topics: ' + Object.keys(simulations).join(', ')
                });
                return;
            }

            const sim = simulations[topic];
            if (parameters.length !== sim.parameters.length) {
                await sock.sendMessage(remoteJid, {
                    text: `*❌ Required parameters:* ${sim.parameters.join(', ')}`
                });
                return;
            }

            const values = parameters.map(Number);
            const result = sim.calculate(...values);

            let response = `*🔬 ${sim.title} Simulation*\n\n`;
            response += `*Description:* ${sim.description}\n\n`;
            response += `*Parameters:*\n`;
            sim.parameters.forEach((param, i) => {
                response += `${param}: ${values[i]}\n`;
            });
            response += `\n*Results:*\n`;
            Object.entries(result).forEach(([key, value]) => {
                response += `${key}: ${value}\n`;
            });

            await sock.sendMessage(remoteJid, { text: response });
        } catch (err) {
            await handleError(sock, message.key.remoteJid, err, 'Error running simulation');
        }
    },

    async languageExercise(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            const [language, level = 'beginner'] = args;

            if (!language) {
                await sock.sendMessage(remoteJid, {
                    text: '*🗣️ Usage:* .languageExercise [language] [level]\nSupported languages: spanish, french, german'
                });
                return;
            }

            const exercises = {
                spanish: {
                    beginner: {
                        exercises: [
                            {
                                type: "fill-in-blank",
                                question: "Yo ___ estudiante. (ser)",
                                answer: "soy",
                                hint: "First person singular of 'ser'"
                            },
                            {
                                type: "translation",
                                question: "How are you?",
                                answer: "¿Cómo estás?",
                                hint: "Common greeting"
                            }
                        ]
                    },
                    intermediate: {
                        exercises: [
                            {
                                type: "conjugation",
                                question: "Conjugate 'hablar' in present tense",
                                answer: "hablo, hablas, habla, hablamos, habláis, hablan",
                                hint: "Regular -ar verb"
                            }
                        ]
                    }
                },
                french: {
                    beginner: {
                        exercises: [
                            {
                                type: "fill-in-blank",
                                question: "Je ___ étudiant. (être)",
                                answer: "suis",
                                hint: "First person singular of 'être'"
                            }
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

            const exerciseSet = exercises[language][level].exercises;
            const exercise = exerciseSet[Math.floor(Math.random() * exerciseSet.length)];

            let response = `*🗣️ Language Exercise - ${language} (${level})*\n\n`;
            response += `*Type:* ${exercise.type}\n`;
            response += `*Question:* ${exercise.question}\n\n`;
            response += `*Need a hint? Use .hint*\n`;
            response += `*Check your answer with .answer [your answer]*`;

            const exercisesPath = path.join(__dirname, '../../../data/educational/language_exercises.json');
            await ensureDirectory(path.dirname(exercisesPath));
            let activeExercises = await safeFileOperation(async () => {
                if (fs.existsSync(exercisesPath)) {
                    const data = await fsPromises.readFile(exercisesPath, 'utf8');
                    return JSON.parse(data);
                }
                return {};
            }, {});

            activeExercises[remoteJid] = {
                exercise,
                timestamp: new Date().toISOString()
            };

            await fsPromises.writeFile(exercisesPath, JSON.stringify(activeExercises, null, 2));
            await sock.sendMessage(remoteJid, { text: response });

        } catch (err) {
            await handleError(sock, message.key.remoteJid, err, 'Error creating language exercise');
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

            const plansPath = path.join(__dirname, '../../../data/educational/study_plans.json');
            await ensureDirectory(path.dirname(plansPath));
            let plans = await safeFileOperation(async () => {
                if (fs.existsSync(plansPath)) {
                    const data = await fsPromises.readFile(plansPath, 'utf8');
                    return JSON.parse(data);
                }
                return {};
            }, {});

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

                    await fsPromises.writeFile(plansPath, JSON.stringify(plans, null, 2));
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

                    await fsPromises.writeFile(plansPath, JSON.stringify(plans, null, 2));
                    await sock.sendMessage(remoteJid, {
                        text: `*✅ Progress updated to ${progress}%*`
                    });
                    break;
            }

        } catch (err) {
            await handleError(sock, message.key.remoteJid, err, 'Error managing study plan');
        }
    },

    async interactiveQuiz(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            const [subject = '', difficulty = 'medium'] = args;

            if (!subject) {
                await sock.sendMessage(remoteJid, {
                    text: '*📚 Interactive Quiz*\n\nAvailable subjects:\n• Math\n• Science\n• Language\n• History\n\nUsage: .interactiveQuiz [subject] [easy|medium|hard]'
                });
                return;
            }

            const questions = {
                math: {
                    easy: [
                        {
                            question: "What is 15 + 7?",
                            options: ["21", "22", "23", "24"],
                            correct: 1,
                            explanation: "15 + 7 = 22"
                        },
                        {
                            question: "What is 8 × 4?",
                            options: ["28", "30", "32", "34"],
                            correct: 2,
                            explanation: "8 × 4 = 32"
                        }
                    ],
                    medium: [
                        {
                            question: "Solve: 3x + 5 = 20",
                            options: ["x = 3", "x = 5", "x = 7", "x = 8"],
                            correct: 1,
                            explanation: "3x + 5 = 20\n3x = 15\nx = 5"
                        }
                    ],
                    hard: [
                        {
                            question: "Find the derivative of x² + 3x",
                            options: ["2x + 3", "x + 3", "2x", "x² + 3"],
                            correct: 0,
                            explanation: "The derivative of x² is 2x, and the derivative of 3x is 3"
                        }
                    ]
                },
                science: {
                    easy: [
                        {
                            question: "What is the chemical symbol for water?",
                            options: ["H2O", "CO2", "O2", "N2"],
                            correct: 0,
                            explanation: "Water's chemical formula is H2O (two hydrogen atoms and one oxygen atom)"
                        }
                    ],
                    medium: [
                        {
                            question: "Which planet is known as the Red Planet?",
                            options: ["Venus", "Mars", "Jupiter", "Saturn"],
                            correct: 1,
                            explanation: "Mars appears red due to iron oxide (rust) on its surface"
                        }
                    ],
                    hard: [
                        {
                            question: "What is the speed of light in meters per second?",
                            options: ["299,792,458", "300,000,000", "199,792,458", "250,000,000"],
                            correct: 0,
                            explanation: "Light travels at exactly 299,792,458 meters per second in a vacuum"
                        }
                    ]
                }
            };

            if (!questions[subject.toLowerCase()]) {
                await sock.sendMessage(remoteJid, {
                    text: '❌ Invalid subject. Available subjects: Math, Science'
                });
                return;
            }

            if (!['easy', 'medium', 'hard'].includes(difficulty.toLowerCase())) {
                difficulty = 'medium';
            }

            const subjectQuestions = questions[subject.toLowerCase()][difficulty.toLowerCase()];
            if (!subjectQuestions || subjectQuestions.length === 0) {
                await sock.sendMessage(remoteJid, {
                    text: `❌ No questions available for ${subject} (${difficulty})`
                });
                return;
            }

            const randomQuestion = subjectQuestions[Math.floor(Math.random() * subjectQuestions.length)];

            // Store the question and answer for later verification
            if (!global.quizzes) global.quizzes = new Map();
            global.quizzes.set(remoteJid, {
                question: randomQuestion,
                timestamp: Date.now(),
                attempts: 0
            });

            let quizMessage = `*📚 ${subject} Quiz (${difficulty})*\n\n`;
            quizMessage += `*Question:*\n${randomQuestion.question}\n\n`;
            quizMessage += `*Options:*\n${randomQuestion.options.map((opt, i) => `${i + 1}. ${opt}`).join('\n')}\n\n`;
            quizMessage += 'Reply with .answer [number] to submit your answer!';

            await sock.sendMessage(remoteJid, { text: quizMessage });
        } catch (err) {
            logger.error('Error in interactive quiz:', err);
            await sock.sendMessage(message.key.remoteJid, {
                text: '❌ Error creating quiz. Please try again.'
            });
        }
    },

    async answer(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            const answer = parseInt(args[0]);

            if (!global.quizzes || !global.quizzes.has(remoteJid)) {
                await sock.sendMessage(remoteJid, {
                    text: '❌ No active quiz found. Use .interactiveQuiz to start a new quiz!'
                });
                return;
            }

            const quiz = global.quizzes.get(remoteJid);

            // Check if quiz has expired (5 minutes)
            if (Date.now() - quiz.timestamp > 5 * 60 * 1000) {
                global.quizzes.delete(remoteJid);
                await sock.sendMessage(remoteJid, {
                    text: '⏰ Quiz has expired. Use .interactiveQuiz to start a new one!'
                });
                return;
            }

            if (isNaN(answer) || answer < 1 || answer > quiz.question.options.length) {
                await sock.sendMessage(remoteJid, {
                    text: `❌ Invalid answer. Please choose a number between 1 and ${quiz.question.options.length}`
                });
                return;
            }

            quiz.attempts++;

            if (answer - 1 === quiz.question.correct) {
                let response = `✅ Correct answer!\n\n`;
                response += `*Explanation:*\n${quiz.question.explanation}\n\n`;
                response += `You got it in ${quiz.attempts} attempt${quiz.attempts > 1 ? 's' : ''}!`;

                await sock.sendMessage(remoteJid, { text: response });
                global.quizzes.delete(remoteJid);
            } else {
                const attemptsLeft = 3 - quiz.attempts;
                if (attemptsLeft > 0) {
                    await sock.sendMessage(remoteJid, {
                        text: `❌ Wrong answer. You have ${attemptsLeft} attempt${attemptsLeft > 1 ? 's' : ''} left!`
                    });
                } else {
                    let response = `❌ Wrong answer. The correct answer was: ${quiz.question.options[quiz.question.correct]}\n\n`;
                    response += `*Explanation:*\n${quiz.question.explanation}`;

                    await sock.sendMessage(remoteJid, { text: response });
                    global.quizzes.delete(remoteJid);
                }
            }
        } catch (err) {
            logger.error('Error in quiz answer:', err);
            await sock.sendMessage(message.key.remoteJid, {
                text: '❌ Error processing answer. Please try again.'
            });
        }
    },

    async chemReaction(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            const reaction = args.join(' ');

            if (!reaction) {
                await sock.sendMessage(remoteJid, {
                    text: `*⚗️ Chemical Reaction Balancer*
Usage: .chemReaction [reaction]
Example: .chemReaction H2 + O2 -> H2O

*Supported Formats:*
• Use + between reactants
• Use -> or = for products
• Use numbers for coefficients
• Use subscripts as numbers (H2O)`
                });
                return;
            }

            // Parse reaction components
            const [reactants, products] = reaction.split(/->|=/);
            if (!reactants || !products) {
                await sock.sendMessage(remoteJid, {
                    text: '❌ Invalid reaction format. Use -> or = between reactants and products.'
                });
                return;
            }

            // Split reactants and products
            const reactantList = reactants.split('+').map(r => r.trim());
            const productList = products.split('+').map(p => p.trim());

            // Simple balancing for common reactions
            const commonReactions = {
                'H2 O2': {
                    balanced: '2H2 + O2 -> 2H2O',
                    explanation: 'This is the formation of water. We need 2 hydrogen molecules and 1 oxygen molecule to form 2 water molecules.'
                },
                'CH4 O2': {
                    balanced: 'CH4 + 2O2 -> CO2 + 2H2O',
                    explanation: 'This is the combustion of methane. Carbon and hydrogen are oxidized to form carbon dioxide and water.'
                },
                'Na Cl2': {
                    balanced: '2Na + Cl2 -> 2NaCl',
                    explanation: 'This is the formation of table salt. Two sodium atoms react with one chlorine molecule.'
                }
            };

            // Simplified matching
            const key = reactantList.map(r => r.replace(/[0-9]/g, '')).join(' ');
            const matchedReaction = commonReactions[key];

            if (matchedReaction) {
                await sock.sendMessage(remoteJid, {
                    text: `*⚗️ Balanced Reaction:*\n${matchedReaction.balanced}\n\n*Explanation:*\n${matchedReaction.explanation}`
                });
            } else {
                await sock.sendMessage(remoteJid, {
                    text: '❌ Sorry, I can only balance common reactions at the moment. Try H2 + O2, CH4 + O2, or Na + Cl2'
                });
            }

        } catch (err) {
            logger.error('Error in chemical reaction:', err);
            await sock.sendMessage(message.key.remoteJid, {
                text: '❌ Error balancing reaction. Please check your input.'
            });
        }
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

            const mindmapsPath = path.join(__dirname, '../../../data/educational/mindmaps.json');
            await ensureDirectory(path.dirname(mindmapsPath));
            let mindmaps = {};

            try {
                if (fs.existsSync(mindmapsPath)) {
                    const data = await fsPromises.readFile(mindmapsPath, 'utf8');
                    mindmaps = JSON.parse(data);
                }
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

                    await fsPromises.writeFile(mindmapsPath, JSON.stringify(mindmaps, null, 2));
                    await sock.sendMessage(remoteJid, {
                        text: '*✅ Mind map created successfully*'
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

                    await fsPromises.writeFile(mindmapsPath, JSON.stringify(mindmaps, null, 2));
                    await sock.sendMessage(remoteJid, {
                        text: '*✅ Nodes added to mind map*'
                    });
                    break;
            }

        } catch (err) {
            await handleError(sock, message.key.remoteJid, err, 'Error managing mind maps');
        }
    },


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
    async flashcards(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            const [action = '', subject = '', ...content] = args;

            if (!action || !['create', 'review', 'list'].includes(action)) {
                await sock.sendMessage(remoteJid, {
                    text: `*📚 Flashcards*\n\nUsage:\n.flashcards create [subject] [front::back]\n.flashcards review [subject]\n.flashcards list [subject]`
                });
                return;
            }

            const flashcardsPath = path.join(__dirname, '../../../data/educational/flashcards.json');
            await ensureDirectory(path.dirname(flashcardsPath));

            let flashcards = await safeFileOperation(async () => {
                if (fs.existsSync(flashcardsPath)) {
                    const data = await fsPromises.readFile(flashcardsPath, 'utf8');
                    return JSON.parse(data);
                }
                return {};
            }, {});

            switch (action) {
                case 'create':
                    if (!subject || content.length === 0) {
                        await sock.sendMessage(remoteJid, {
                            text: '❌ Please provide subject and content (front::back)'
                        });
                        return;
                    }

                    const [front, back] = content.join(' ').split('::').map(s => s.trim());
                    if (!front || !back) {
                        await sock.sendMessage(remoteJid, {
                            text: '❌ Invalid format. Use front::back'
                        });
                        return;
                    }

                    flashcards[subject] = flashcards[subject] || [];
                    flashcards[subject].push({
                        front,
                        back,
                        created: new Date().toISOString(),
                        reviews: 0
                    });

                    await fsPromises.writeFile(flashcardsPath, JSON.stringify(flashcards, null, 2));
                    await sock.sendMessage(remoteJid, {
                        text: '✅ Flashcard created successfully'
                    });
                    break;

                case 'review':
                    if (!subject || !flashcards[subject] || flashcards[subject].length === 0) {
                        await sock.sendMessage(remoteJid, {
                            text: '❌ No flashcards found for this subject'
                        });
                        return;
                    }

                    const card = flashcards[subject][Math.floor(Math.random() * flashcards[subject].length)];
                    card.reviews++;

                    await fsPromises.writeFile(flashcardsPath, JSON.stringify(flashcards, null, 2));
                    await sock.sendMessage(remoteJid, {
                        text: `*📝 Flashcard Review*\n\n*Front:*\n${card.front}\n\n_Send .reveal to see the answer_`
                    });

                    // Store current card for reveal command
                    if (!global.flashcardReviews) global.flashcardReviews = new Map();
                    global.flashcardReviews.set(remoteJid, {
                        card,
                        timestamp: Date.now()
                    });
                    break;

                case 'list':
                    if (!subject && Object.keys(flashcards).length === 0) {
                        await sock.sendMessage(remoteJid, {
                            text: '❌ No flashcards found'
                        });
                        return;
                    }

                    if (!subject) {
                        const subjects = Object.keys(flashcards);
                        let response = '*📚 Available Subjects:*\n\n';
                        subjects.forEach(s => {
                            response += `• ${s} (${flashcards[s].length} cards)\n`;
                        });
                        await sock.sendMessage(remoteJid, { text: response });
                        return;
                    }

                    if (!flashcards[subject]) {
                        await sock.sendMessage(remoteJid, {
                            text: '❌ No flashcards found for this subject'
                        });
                        return;
                    }

                    let response = `*📚 Flashcards for ${subject}:*\n\n`;
                    flashcards[subject].forEach((card, i) => {
                        response += `${i + 1}. ${card.front}\n`;
                    });
                    await sock.sendMessage(remoteJid, { text: response });
                    break;
            }
        } catch (err) {
            logger.error('Error in flashcards command:', err);
            await sock.sendMessage(message.key.remoteJid, {
                text: '❌ Error managing flashcards'
            });
        }
    },

    async reveal(sock, message) {
        try {
            const remoteJid = message.key.remoteJid;

            if (!global.flashcardReviews || !global.flashcardReviews.has(remoteJid)) {
                await sock.sendMessage(remoteJid, {
                    text: '❌ No active flashcard review. Use .flashcards review [subject] to start'
                });
                return;
            }

            const review = global.flashcardReviews.get(remoteJid);
            if (Date.now() - review.timestamp > 5 * 60 * 1000) {
                global.flashcardReviews.delete(remoteJid);
                await sock.sendMessage(remoteJid, {
                    text: '⏰ Review expired. Start a new review with .flashcards review'
                });
                return;
            }

            await sock.sendMessage(remoteJid, {
                text: `*📝 Answer:*\n${review.card.back}\n\n_Use .flashcards review to get another card_`
            });
            global.flashcardReviews.delete(remoteJid);

        } catch (err) {
            logger.error('Error in reveal command:', err);
            await sock.sendMessage(message.key.remoteJid, {
                text: '❌ Error revealing answer'
            });
        }
    },

    async studytimer(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            const [minutes = '25'] = args;
            const duration = parseInt(minutes);

            if (isNaN(duration) || duration < 1 || duration > 120) {
                await sock.sendMessage(remoteJid, {
                    text: '❌ Please provide a valid duration (1-120 minutes)\n\nUsage: .studytimer [minutes]'
                });
                return;
            }

            if (!global.studyTimers) global.studyTimers = new Map();

            // Clear existing timer
            if (global.studyTimers.has(remoteJid)) {
                clearTimeout(global.studyTimers.get(remoteJid).timer);
            }

            await sock.sendMessage(remoteJid, {
                text: `⏰ Starting ${duration} minute study session`
            });

            const timer = setTimeout(async () => {
                await sock.sendMessage(remoteJid, {
                    text: `✅ Study session complete!\n\nTime to take a break.`
                });
                global.studyTimers.delete(remoteJid);
            }, duration * 60 * 1000);

            global.studyTimers.set(remoteJid, {
                timer,
                startTime: Date.now(),
                duration: duration * 60 * 1000
            });

        } catch (err) {
            logger.error('Error in studytimer command:', err);
            await sock.sendMessage(message.key.remoteJid, {
                text: '❌ Error starting study timer'
            });
        }
    },

    async periodic(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            const element = args.join(' ').trim();

            if (!element) {
                await sock.sendMessage(remoteJid, {
                    text: '*⚛️ Periodic Table*\n\nUsage: .periodic [element]\nExample: .periodic Hydrogen'
                });
                return;
            }

            const elements = {
                'hydrogen': {
                    symbol: 'H',
                    number: 1,
                    mass: 1.008,
                    category: 'Nonmetal',
                    properties: 'Lightest and most abundant element in the universe'
                },
                'helium': {
                    symbol: 'He',
                    number: 2,
                    mass: 4.003,
                    category: 'Noble Gas',
                    properties: 'Unreactive, used in balloons and cooling'
                },
                'carbon': {
                    symbol: 'C',
                    number: 6,
                    mass: 12.011,
                    category: 'Nonmetal',
                    properties: 'Basis for organic chemistry and life'
                },
                'oxygen': {
                    symbol: 'O',
                    number: 8,
                    mass: 15.999,
                    category: 'Nonmetal',
                    properties: 'Essential for respiration'
                },
                'sodium': {
                    symbol: 'Na',
                    number: 11,
                    mass: 22.990,
                    category: 'Alkali Metal',
                    properties: 'Highly reactive metal, important in biology'
                }
            };

            const elementData = elements[element.toLowerCase()];
            if (!elementData) {
                await sock.sendMessage(remoteJid, {
                    text: '❌ Element not found in database.\n\nAvailable elements: ' + Object.keys(elements).join(', ')
                });
                return;
            }

            const response = `*⚛️ ${element.toUpperCase()}*
Symbol: ${elementData.symbol}
Atomic Number: ${elementData.number}
Atomic Mass: ${elementData.mass}
Category: ${elementData.category}
Properties: ${elementData.properties}`;

            await sock.sendMessage(remoteJid, { text: response });

        } catch (err) {
            logger.error('Error in periodic command:', err);
            await sock.sendMessage(message.key.remoteJid, {
                text: '❌ Error fetching element data'
            });
        }
    },

    async history(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            const [period = '', ...event] = args;
            const eventQuery = event.join(' ');

            if (!period) {
                await sock.sendMessage(remoteJid, {
                    text: `*📜 Historical Events*

Usage: .history [period] [event]
Example: .history ancient egypt

Available periods:
• ancient
• medieval
• modern
• contemporary`
                });
                return;
            }

            const historicalEvents = {
                'ancient': {
                    'egypt': 'Ancient Egypt (3100 BCE - 30 BCE)\n\nFamous for pyramids, hieroglyphs, and pharaohs. The civilization developed along the Nile River.',
                    'rome': 'Ancient Rome (753 BCE - 476 CE)\n\nStarted as a small town, became one of the largest empires in history. Known for its architecture, law, and military.',
                    'greece': 'Ancient Greece (800 BCE - 146 BCE)\n\nBirthplace of democracy, philosophy, and the Olympic Games. Major influence on modern civilization.'
                },
                'medieval': {
                    'crusades': 'The Crusades (1095 - 1291)\n\nSeries of religious wars between Christians and Muslims for control of holy sites in Jerusalem.',
                    'plague': 'The Black Death (1347 - 1351)\n\nDeadly pandemic that killed 30-60% of Europe\'s population. Changed the social structure of medieval society.'
                },
                'modern': {
                    'revolution': 'Industrial Revolution (1760 - 1840)\n\nTransition to new manufacturing processes. Changed economic and social systems forever.',
                    'wwii': 'World War II (1939 - 1945)\n\nLargest conflict in human history. Involved most of the world\'s nations.'
                }
            };

            if (!historicalEvents[period.toLowerCase()]) {
                await sock.sendMessage(remoteJid, {
                    text: '❌ Invalid period. Available periods: ancient, medieval, modern'
                });
                return;
            }

            if (!eventQuery) {
                const events = Object.keys(historicalEvents[period.toLowerCase()]);
                await sock.sendMessage(remoteJid, {
                    text: `*📜 Available ${period} Events:*\n\n${events.join('\n')}`
                });
                return;
            }

            const event = historicalEvents[period.toLowerCase()][eventQuery.toLowerCase()];
            if (!event) {
                await sock.sendMessage(remoteJid, {
                    text: '❌ Event not found for this period'
                });
                return;
            }

            await sock.sendMessage(remoteJid, { text: `*📜 Historical Event*\n\n${event}` });

        } catch (err) {
            logger.error('Error in history command:', err);
            await sock.sendMessage(message.key.remoteJid, {
                text: '❌ Error fetching historical data'
            });
        }
    }
};

// Add init function for proper module initialization
commands.init = async function() {
    try {
        logger.info('🔄 Initializing Educational Commands...');
        
        // Initialize required directories
        await ensureDirectory('data/educational');
        await ensureDirectory('data/educational/flashcards');
        await ensureDirectory('data/educational/mindmaps');
        await ensureDirectory('data/educational/quiz_scores');
        await ensureDirectory('data/educational/study_materials');
        await ensureDirectory('data/educational/language_exercises');
        await ensureDirectory('data/educational/math_solutions');
        await ensureDirectory('data/educational/study_plans');
        
        logger.info('✅ Educational Commands initialized successfully');
        return true;
    } catch (err) {
        logger.error('❌ Failed to initialize Educational Commands:', err);
        logger.error('Stack trace:', err.stack);
        return false;
    }
};

// Ensure directory exists
async function ensureDirectory(dirPath) {
    try {
        const fullPath = path.join(process.cwd(), dirPath);
        if (!fs.existsSync(fullPath)) {
            await fsPromises.mkdir(fullPath, { recursive: true });
            logger.info(`✓ Created directory: ${dirPath}`);
        }
    } catch (err) {
        logger.error(`Failed to create directory ${dirPath}:`, err);
        throw err;
    }
}

module.exports = commands;