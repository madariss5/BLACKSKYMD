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
            // Add your interactive quiz logic here.  This is a placeholder.
            await sock.sendMessage(remoteJid, { text: 'This interactive quiz feature is under development.' });
        } catch (err) {
            await handleError(sock, message.key.remoteJid, err, 'Error with interactive quiz');
        }
    },

    async chemReaction(sock, message, args) {
        try {
            const remoteJid = message.key.remoteJid;
            // Add your chemical reaction balancing logic here. This is a placeholder.
            await sock.sendMessage(remoteJid, { text: 'This chemical reaction balancer is under development.' });
        } catch (err) {
            await handleError(sock, message.key.remoteJid, err, 'Error with chemical reaction');
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
    }
};

module.exports = commands;