const { handleError } = require('../../utils/error');
const path = require('path');
const fs = require('fs').promises;
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
            let vocabulary = await safeFileOperation(async () => {
                const data = await fs.readFile(vocabPath, 'utf8');
                return JSON.parse(data);
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

                    await fs.writeFile(vocabPath, JSON.stringify(vocabulary, null, 2));
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
            let solutions = await safeFileOperation(async () => {
                const data = await fs.readFile(solutionsPath, 'utf8');
                return JSON.parse(data);
            }, {});

            solutions[remoteJid] = {
                problem: problem.question,
                solution: problem.solution,
                steps: problem.steps,
                timestamp: new Date().toISOString()
            };

            await fs.writeFile(solutionsPath, JSON.stringify(solutions, null, 2));
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
                const data = await fs.readFile(solutionsPath, 'utf8');
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
            let activeExercises = await safeFileOperation(async () => {
                const data = await fs.readFile(exercisesPath, 'utf8');
                return JSON.parse(data);
            }, {});

            activeExercises[remoteJid] = {
                exercise,
                timestamp: new Date().toISOString()
            };

            await fs.writeFile(exercisesPath, JSON.stringify(activeExercises, null, 2));
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
            let plans = await safeFileOperation(async () => {
                const data = await fs.readFile(plansPath, 'utf8');
                return JSON.parse(data);
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

                    await fs.writeFile(plansPath, JSON.stringify(plans, null, 2));
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

                    await fs.writeFile(plansPath, JSON.stringify(plans, null, 2));
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
            let mindmaps = {};

            try {
                const data = await fs.readFile(mindmapsPath, 'utf8');
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

                    await fs.writeFile(mindmapsPath, JSON.stringify(mindmaps, null, 2));
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

                    await fs.writeFile(mindmapsPath, JSON.stringify(mindmaps, null, 2));
                    await sock.sendMessage(remoteJid, {
                        text: '*✅ Nodes added to mind map*'
                    });
                    break;
            }

        } catch (err) {
            await handleError(sock, message.key.remoteJid, err, 'Error managing mind maps');
        }
    },


};

module.exports = commands;