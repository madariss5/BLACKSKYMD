const logger = require('../utils/logger');
const path = require('path');
const fs = require('fs').promises;
const { isFeatureEnabled } = require('../utils/groupSettings');

/**
 * Helper function to check if games are enabled for a group
 * @param {Object} sock WhatsApp socket
 * @param {string} remoteJid Group or sender JID
 * @returns {Promise<boolean>} Whether games are enabled
 */
async function areGamesEnabled(sock, remoteJid) {
    // If it's a group, check if games feature is enabled
    if (remoteJid.endsWith('g.us')) {
        const gamesEnabled = await isFeatureEnabled(remoteJid, 'games');
        if (!gamesEnabled) {
            await sock.sendMessage(remoteJid, { 
                text: '❌ Games are disabled in this group. Ask an admin to enable them with *.feature games on*' 
            });
            return false;
        }
    }
    return true;
}

const funCommands = {
    // Text Fun
    async quote(sock, sender) {
        try {
            const quotes = [
                "Be yourself; everyone else is already taken. - Oscar Wilde",
                "Two things are infinite: the universe and human stupidity; and I'm not sure about the universe. - Albert Einstein",
                "Be the change that you wish to see in the world. - Mahatma Gandhi",
                "In three words I can sum up everything I've learned about life: it goes on. - Robert Frost",
                "Life is what happens when you're busy making other plans. - John Lennon",
                "Success is not final, failure is not fatal: it is the courage to continue that counts. - Winston Churchill",
                "The only way to do great work is to love what you do. - Steve Jobs",
                "If you want to live a happy life, tie it to a goal, not to people or things. - Albert Einstein",
                "The future belongs to those who believe in the beauty of their dreams. - Eleanor Roosevelt",
                "It does not matter how slowly you go as long as you do not stop. - Confucius"
            ];
            const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
            await sock.sendMessage(sender, { text: `📜 Quote of the moment:\n\n${randomQuote}` });
        } catch (err) {
            logger.error('Quote error:', err);
            await sock.sendMessage(sender, { text: '❌ An error occurred while fetching the quote.' });
        }
    },

    async joke(sock, sender) {
        try {
            const jokes = [
                "Why don't scientists trust atoms? Because they make up everything!",
                "What do you call a bear with no teeth? A gummy bear!",
                "Why did the scarecrow win an award? Because he was outstanding in his field!",
                "What do you call a fish wearing a bowtie? So-fish-ticated!",
                "What did the grape say when it got stepped on? Nothing, it just let out a little wine!",
                "Why don't eggs tell jokes? They'd crack up!",
                "What do you call a can opener that doesn't work? A can't opener!",
                "Why did the math book look so sad? Because it had too many problems!",
                "What do you call a fake noodle? An impasta!",
                "Why did the cookie go to the doctor? Because it was feeling crumbly!"
            ];
            const randomJoke = jokes[Math.floor(Math.random() * jokes.length)];
            await sock.sendMessage(sender, { text: `😄 Here's a joke for you:\n\n${randomJoke}` });
        } catch (err) {
            logger.error('Joke error:', err);
            await sock.sendMessage(sender, { text: '❌ An error occurred while fetching the joke.' });
        }
    },

    async meme(sock, sender) {
        // TODO: Implement meme generation/fetching here
        await sock.sendMessage(sender, { text: "Here's your meme! (Feature coming soon)" });
    },

    // Games
    async tictactoe(sock, sender, args) {
        try {
            // Check if games are enabled for this group
            if (!(await areGamesEnabled(sock, sender))) {
                return;
            }
            
            if (!global.games) global.games = new Map();

            const gameId = sender;
            let game = global.games.get(gameId);

            if (!args[0]) {
                await sock.sendMessage(sender, {
                    text: 'Usage:\n!tictactoe start - Start new game\n!tictactoe move [1-9] - Make a move'
                });
                return;
            }

            const action = args[0].toLowerCase();

            if (action === 'start') {
                if (game) {
                    await sock.sendMessage(sender, { text: '❌ A game is already in progress!' });
                    return;
                }

                game = {
                    board: Array(9).fill(' '),
                    currentPlayer: 'X',
                    moves: 0
                };
                global.games.set(gameId, game);

                const boardDisplay = renderBoard(game.board);
                await sock.sendMessage(sender, {
                    text: `🎮 New game started!\n\n${boardDisplay}\n\nMake a move (1-9):`
                });
                return;
            }

            if (action === 'move') {
                if (!game) {
                    await sock.sendMessage(sender, { text: '❌ No game in progress. Start with !tictactoe start' });
                    return;
                }

                const position = parseInt(args[1]);
                if (isNaN(position) || position < 1 || position > 9) {
                    await sock.sendMessage(sender, { text: '❌ Invalid move! Use numbers 1-9' });
                    return;
                }

                const index = position - 1;
                if (game.board[index] !== ' ') {
                    await sock.sendMessage(sender, { text: '❌ That position is already taken!' });
                    return;
                }

                game.board[index] = game.currentPlayer;
                game.moves++;

                const winner = checkWinner(game.board);
                const boardDisplay = renderBoard(game.board);

                if (winner) {
                    await sock.sendMessage(sender, {
                        text: `🎮 ${boardDisplay}\n\n🎉 Player ${winner} wins!`
                    });
                    global.games.delete(gameId);
                    return;
                }

                if (game.moves === 9) {
                    await sock.sendMessage(sender, {
                        text: `🎮 ${boardDisplay}\n\n🤝 It's a draw!`
                    });
                    global.games.delete(gameId);
                    return;
                }

                game.currentPlayer = game.currentPlayer === 'X' ? 'O' : 'X';
                global.games.set(gameId, game);

                // Bot's move
                if (game.currentPlayer === 'O') {
                    const botMove = getBotMove(game.board);
                    game.board[botMove] = 'O';
                    game.moves++;

                    const winner = checkWinner(game.board);
                    const boardDisplay = renderBoard(game.board);

                    if (winner) {
                        await sock.sendMessage(sender, {
                            text: `🎮 ${boardDisplay}\n\n${winner === 'O' ? '🤖 Bot wins!' : '🎉 You win!'}`
                        });
                        global.games.delete(gameId);
                        return;
                    }

                    if (game.moves === 9) {
                        await sock.sendMessage(sender, {
                            text: `🎮 ${boardDisplay}\n\n🤝 It's a draw!`
                        });
                        global.games.delete(gameId);
                        return;
                    }

                    game.currentPlayer = 'X';
                    global.games.set(gameId, game);

                    await sock.sendMessage(sender, {
                        text: `🎮 ${boardDisplay}\n\nYour turn! Make a move (1-9):`
                    });
                }
            }
        } catch (err) {
            logger.error('Tic-tac-toe error:', err);
            await sock.sendMessage(sender, { text: '❌ An error occurred during the game.' });
        }
    },

    async hangman(sock, sender, args) {
        try {
            // Check if games are enabled for this group
            if (!(await areGamesEnabled(sock, sender))) {
                return;
            }
            
            if (!global.hangmanGames) global.hangmanGames = new Map();

            const gameId = sender;
            let game = global.hangmanGames.get(gameId);

            if (!args[0]) {
                await sock.sendMessage(sender, {
                    text: 'Usage:\n!hangman start - Start new game\n!hangman guess [letter] - Guess a letter'
                });
                return;
            }

            const action = args[0].toLowerCase();

            if (action === 'start') {
                if (game) {
                    await sock.sendMessage(sender, { text: '❌ A game is already in progress!' });
                    return;
                }

                const words = [
                    'PROGRAMMING', 'JAVASCRIPT', 'COMPUTER', 'ALGORITHM',
                    'DATABASE', 'NETWORK', 'SECURITY', 'FRAMEWORK',
                    'DEVELOPER', 'SOFTWARE', 'INTERNET', 'PROTOCOL'
                ];
                const word = words[Math.floor(Math.random() * words.length)];

                game = {
                    word: word,
                    guessed: new Set(),
                    mistakes: 0,
                    maxMistakes: 6
                };

                global.hangmanGames.set(gameId, game);

                const display = getHangmanDisplay(game);
                await sock.sendMessage(sender, {
                    text: `🎮 Hangman Game Started!\n\n${display}\n\nGuess a letter using: !hangman guess [letter]`
                });
                return;
            }

            if (action === 'guess') {
                if (!game) {
                    await sock.sendMessage(sender, { text: '❌ No game in progress. Start with !hangman start' });
                    return;
                }

                const letter = args[1]?.toUpperCase();
                if (!letter || letter.length !== 1 || !/[A-Z]/.test(letter)) {
                    await sock.sendMessage(sender, { text: '❌ Please guess a single letter' });
                    return;
                }

                if (game.guessed.has(letter)) {
                    await sock.sendMessage(sender, { text: '❌ You already guessed that letter!' });
                    return;
                }

                game.guessed.add(letter);

                if (!game.word.includes(letter)) {
                    game.mistakes++;
                }

                const display = getHangmanDisplay(game);
                const isWon = [...game.word].every(l => game.guessed.has(l));
                const isLost = game.mistakes >= game.maxMistakes;

                if (isWon) {
                    await sock.sendMessage(sender, {
                        text: `${display}\n\n🎉 Congratulations! You won!\nThe word was: ${game.word}`
                    });
                    global.hangmanGames.delete(gameId);
                } else if (isLost) {
                    await sock.sendMessage(sender, {
                        text: `${display}\n\n💀 Game Over! You lost.\nThe word was: ${game.word}`
                    });
                    global.hangmanGames.delete(gameId);
                } else {
                    await sock.sendMessage(sender, {
                        text: `${display}\n\nGuessed letters: ${[...game.guessed].join(' ')}`
                    });
                }
            }
        } catch (err) {
            logger.error('Hangman error:', err);
            await sock.sendMessage(sender, { text: '❌ An error occurred during the game.' });
        }
    },

    async quiz(sock, sender, args) {
        try {
            // Check if games are enabled for this group
            if (!(await areGamesEnabled(sock, sender))) {
                return;
            }
            
            if (!global.quizGames) global.quizGames = new Map();

            const gameId = sender;
            let game = global.quizGames.get(gameId);

            const subjects = {
                math: [
                    {
                        question: "What is the result of 3² × 4²?",
                        options: ["36", "81", "144", "225"],
                        correct: 0,
                        explanation: "3² = 9, 4² = 16, 9 × 16 = 36"
                    },
                    {
                        question: "What is the value of π (pi) to 2 decimal places?",
                        options: ["3.14", "3.16", "3.12", "3.18"],
                        correct: 0,
                        explanation: "π ≈ 3.14159..."
                    }
                ],
                science: [
                    {
                        question: "Which planet is known as the 'Morning Star'?",
                        options: ["Mars", "Venus", "Mercury", "Jupiter"],
                        correct: 1,
                        explanation: "Venus appears bright in the morning sky"
                    },
                    {
                        question: "What is the atomic number of Carbon?",
                        options: ["12", "14", "6", "8"],
                        correct: 2,
                        explanation: "Carbon has 6 protons in its nucleus"
                    }
                ],
                english: [
                    {
                        question: "Which of these is a synonym for 'benevolent'?",
                        options: ["Kind", "Harsh", "Lazy", "Quick"],
                        correct: 0,
                        explanation: "'Benevolent' means kind and generous"
                    },
                    {
                        question: "What type of word is 'quickly'?",
                        options: ["Adjective", "Adverb", "Noun", "Verb"],
                        correct: 1,
                        explanation: "It describes how an action is performed"
                    }
                ]
            };

            if (!args[0]) {
                await sock.sendMessage(sender, {
                    text: `📚 Available subjects: ${Object.keys(subjects).join(', ')}\nUse: !quiz [subject] to start`
                });
                return;
            }

            const subject = args[0].toLowerCase();
            if (!subjects[subject]) {
                await sock.sendMessage(sender, {
                    text: `❌ Invalid subject. Available subjects: ${Object.keys(subjects).join(', ')}`
                });
                return;
            }

            if (!game) {
                // Start new game
                game = {
                    subject: subject,
                    questions: [...subjects[subject]], // Create copy to shuffle
                    currentQuestion: 0,
                    score: 0,
                    maxQuestions: subjects[subject].length
                };

                // Shuffle questions
                for (let i = game.questions.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [game.questions[i], game.questions[j]] = [game.questions[j], game.questions[i]];
                }

                global.quizGames.set(gameId, game);

                // Display first question
                const question = game.questions[0];
                const optionsText = question.options
                    .map((opt, i) => `${i + 1}. ${opt}`)
                    .join('\n');

                await sock.sendMessage(sender, {
                    text: `📝 Quiz - ${subject.toUpperCase()}\n\nQuestion 1/${game.maxQuestions}:\n${question.question}\n\n${optionsText}\n\nRespond with !answer [number]`
                });
                return;
            }

            // Handle answer
            if (args[0].toLowerCase() === 'answer') {
                const answer = parseInt(args[1]);
                if (isNaN(answer) || answer < 1 || answer > game.questions[game.currentQuestion].options.length) {
                    await sock.sendMessage(sender, {
                        text: '❌ Please provide a valid answer number'
                    });
                    return;
                }

                const currentQ = game.questions[game.currentQuestion];
                const isCorrect = (answer - 1) === currentQ.correct;
                if (isCorrect) game.score++;

                const feedbackText = `${isCorrect ? '✅ Correct!' : '❌ Wrong!'}\n${currentQ.explanation}`;
                game.currentQuestion++;

                if (game.currentQuestion >= game.maxQuestions) {
                    // Game over
                    await sock.sendMessage(sender, {
                        text: `${feedbackText}\n\n🎮 Quiz Complete!\nFinal Score: ${game.score}/${game.maxQuestions}`
                    });
                    global.quizGames.delete(gameId);
                } else {
                    // Next question
                    const nextQ = game.questions[game.currentQuestion];
                    const optionsText = nextQ.options
                        .map((opt, i) => `${i + 1}. ${opt}`)
                        .join('\n');

                    await sock.sendMessage(sender, {
                        text: `${feedbackText}\n\nQuestion ${game.currentQuestion + 1}/${game.maxQuestions}:\n${nextQ.question}\n\n${optionsText}\n\nRespond with !answer [number]`
                    });
                    global.quizGames.set(gameId, game);
                }
            }

        } catch (err) {
            logger.error('Quiz error:', err);
            await sock.sendMessage(sender, { text: '❌ An error occurred during the quiz.' });
            global.quizGames.delete(gameId);
        }
    },

    async mock(sock, sender, args) {
        const text = args.join(' ');
        if (!text) {
            await sock.sendMessage(sender, { text: 'Please provide text to mock' });
            return;
        }
        const mockedText = text.split('').map((char, i) =>
            i % 2 ? char.toUpperCase() : char.toLowerCase()
        ).join('');
        await sock.sendMessage(sender, { text: mockedText });
    },

    async reverse(sock, sender, args) {
        const text = args.join(' ');
        if (!text) {
            await sock.sendMessage(sender, { text: 'Please provide text to reverse' });
            return;
        }
        const reversedText = text.split('').reverse().join('');
        await sock.sendMessage(sender, { text: reversedText });
    },

    async ascii(sock, sender, args) {
        const text = args.join(' ');
        if (!text) {
            await sock.sendMessage(sender, { text: 'Please provide text to convert to ASCII art' });
            return;
        }
        // TODO: Implement ASCII art conversion here
        await sock.sendMessage(sender, { text: 'ASCII art feature coming soon!' });
    },

    // Random Generators
    async roll(sock, sender, args) {
        const sides = parseInt(args[0]) || 6;
        const result = Math.floor(Math.random() * sides) + 1;
        await sock.sendMessage(sender, { text: `🎲 You rolled: ${result}` });
    },

    async flip(sock, sender) {
        const result = Math.random() < 0.5 ? 'Heads' : 'Tails';
        await sock.sendMessage(sender, { text: `🪙 Coin flip: ${result}` });
    },

    async choose(sock, sender, args) {
        if (args.length < 2) {
            await sock.sendMessage(sender, {
                text: 'Please provide at least 2 options to choose from'
            });
            return;
        }
        const choice = args[Math.floor(Math.random() * args.length)];
        await sock.sendMessage(sender, { text: `🎯 I choose: ${choice}` });
    },

    // Fun Facts and Trivia
    async fact(sock, sender) {
        try {
            const facts = [
                "Honey never spoils. Archaeologists have found pots of honey in ancient Egyptian tombs that are over 3,000 years old and still perfectly good to eat.",
                "A day on Venus is longer than its year. Venus takes 243 Earth days to rotate on its axis but only 225 Earth days to orbit the Sun.",
                "The average person spends 6 months of their lifetime waiting for red lights to turn green.",
                "The shortest war in history was between Britain and Zanzibar on August 27, 1896. Zanzibar surrendered after just 38 minutes.",
                "A bolt of lightning is five times hotter than the surface of the sun.",
                "Bananas are berries, but strawberries aren't.",
                "The first oranges weren't orange; they were green.",
                "The inventor of the Pringles can was buried in a Pringles can at his request.",
                "Astronauts can't cry in space because tears don't fall in zero gravity.",
                "A group of flamingos is called a 'flamboyance'."
            ];
            const randomFact = facts[Math.floor(Math.random() * facts.length)];
            await sock.sendMessage(sender, { text: `📚 Did you know?\n${randomFact}` });
        } catch (err) {
            logger.error('Fact error:', err);
            await sock.sendMessage(sender, { text: '❌ An error occurred while fetching the fact.' });
        }
    },

    async riddle(sock, sender) {
        try {
            const riddles = [
                {
                    question: "What has keys, but no locks; space, but no room; and you can enter, but not go in?",
                    answer: "A keyboard!"
                },
                {
                    question: "What gets wetter and wetter the more it dries?",
                    answer: "A towel!"
                },
                {
                    question: "What has a head and a tail that will never meet?",
                    answer: "A coin!"
                },
                {
                    question: "What has cities, but no houses; forests, but no trees; and rivers, but no water?",
                    answer: "A map!"
                },
                {
                    question: "The more you take, the more you leave behind. What am I?",
                    answer: "Footsteps!"
                }
            ];
            const randomRiddle = riddles[Math.floor(Math.random() * riddles.length)];
            await sock.sendMessage(sender, {
                text: `🤔 Here's a riddle for you:\n\n${randomRiddle.question}\n\n(Answer will be revealed in 10 seconds...)`
            });

            // Send answer after a delay
            setTimeout(async () => {
                await sock.sendMessage(sender, {
                    text: `✨ The answer is: ${randomRiddle.answer}`
                });
            }, 10000);

        } catch (err) {
            logger.error('Riddle error:', err);
            await sock.sendMessage(sender, { text: '❌ An error occurred while fetching the riddle.' });
        }
    },

    // Horoscope and Fortune
    async horoscope(sock, sender, args) {
        try {
            const signs = ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo',
                'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'];

            if (!args[0] || !signs.includes(args[0].toLowerCase())) {
                await sock.sendMessage(sender, {
                    text: `⭐ Available zodiac signs: ${signs.join(', ')}\nUsage: !horoscope [sign]`
                });
                return;
            }

            const sign = args[0].toLowerCase();
            const horoscopes = {
                aries: [
                    "Today is perfect for starting new projects. Your energy is high!",
                    "Someone special may enter your life soon.",
                    "Focus on personal growth and development."
                ],
                taurus: [
                    "Financial opportunities are heading your way.",
                    "Your patience will be rewarded soon.",
                    "Take time to appreciate the simple pleasures."
                ],
                gemini: [
                    "Communication is key today. Express yourself clearly.",
                    "New learning opportunities are on the horizon.",
                    "Your adaptability will serve you well."
                ],
                cancer: [
                    "Trust your intuition in important decisions.",
                    "Family matters take center stage today.",
                    "Your emotional strength is your greatest asset."
                ],
                leo: [
                    "Your creative energy is at its peak.",
                    "Leadership opportunities await you.",
                    "Time to shine and showcase your talents."
                ],
                virgo: [
                    "Focus on organization and planning today.",
                    "Your attention to detail will be appreciated.",
                    "Health and wellness should be priorities."
                ],
                libra: [
                    "Balance in all things brings harmony today.",
                    "Relationships flourish under your diplomatic touch.",
                    "Artistic endeavors are favored."
                ],
                scorpio: [
                    "Trust your instincts in personal matters.",
                    "Transformation and change bring positive results.",
                    "Deep connections form easily today."
                ],
                sagittarius: [
                    "Adventure and travel are highlighted.",
                    "Your optimism attracts good fortune.",
                    "Educational pursuits are favored."
                ],
                capricorn: [
                    "Career goals move forward steadily.",
                    "Your practical approach yields results.",
                    "Long-term planning brings success."
                ],
                aquarius: [
                    "Innovation and originality are your strengths.",
                    "Social connections bring unexpected opportunities.",
                    "Your humanitarian side shines today."
                ],
                pisces: [
                    "Your intuition guides you correctly.",
                    "Artistic inspiration flows freely.",
                    "Spiritual connections deepen today."
                ]
            };

            const randomHoroscope = horoscopes[sign][Math.floor(Math.random() * horoscopes[sign].length)];
            const zodiacEmojis = {
                aries: '♈', taurus: '♉', gemini: '♊', cancer: '♋',
                leo: '♌', virgo: '♍', libra: '♎', scorpio: '♏',
                sagittarius: '♐', capricorn: '♑', aquarius: '♒', pisces: '♓'
            };

            await sock.sendMessage(sender, {
                text: `${zodiacEmojis[sign]} ${sign.charAt(0).toUpperCase() + sign.slice(1)} Horoscope:\n\n${randomHoroscope}\n\n✨ The stars have spoken!`
            });
        } catch (err) {
            logger.error('Horoscope error:', err);
            await sock.sendMessage(sender, { text: '❌ An error occurred while reading your horoscope.' });
        }
    },

    async fortune(sock, sender) {
        try {
            const fortunes = [
                "A beautiful, smart, and loving person will be coming into your life.",
                "A dubious friend may be an enemy in camouflage.",
                "A faithful friend is a strong defense.",
                "A fresh start will put you on your way.",
                "A golden egg of opportunity falls into your lap this month.",
                "A good friendship is often more important than a passionate romance.",
                "A lifetime friend shall soon be made.",
                "A light heart carries you through all the hard times.",
                "A new perspective will come with the new year.",
                "Adventure can be real happiness."
            ];

            const emojis = ['🔮', '🎯', '⭐', '🍀', '🎲'];
            const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
            const randomFortune = fortunes[Math.floor(Math.random() * fortunes.length)];

            await sock.sendMessage(sender, {
                text: `${randomEmoji} Your fortune tells me...\n\n"${randomFortune}"\n\nMay luck be on your side!`
            });
        } catch (err) {
            logger.error('Fortune error:', err);
            await sock.sendMessage(sender, { text: '❌ An error occurred while reading your fortune.' });
        }
    },

    // Game Commands
    async slot(sock, sender, args) {
        try {
            const bet = parseInt(args[0]) || 10;
            const symbols = ['🍎', '🍊', '🍇', '🍒', '💎', '7️⃣'];
            const result = Array(3).fill().map(() => symbols[Math.floor(Math.random() * symbols.length)]);

            const resultText = `
🎰 Slot Machine
═════════
║ ${result[0]} │ ${result[1]} │ ${result[2]} ║
═════════
${result[0] === result[1] && result[1] === result[2] ? '🎉 Jackpot! You won!' : '😢 Try again!'}
`.trim();

            await sock.sendMessage(sender, { text: resultText });
        } catch (err) {
            logger.error('Slot machine error:', err);
            await sock.sendMessage(sender, { text: '❌ An error occurred while playing slots.' });
        }
    },

    async rps(sock, sender, args) {
        try {
            const choices = ['rock', 'paper', 'scissors'];
            const userChoice = args[0]?.toLowerCase();

            if (!userChoice || !choices.includes(userChoice)) {
                await sock.sendMessage(sender, {
                    text: '🎮 Rock Paper Scissors\nUsage: !rps <rock|paper|scissors>\nExample: !rps rock'
                });
                return;
            }

            const botChoice = choices[Math.floor(Math.random() * choices.length)];
            let result;

            // Determine winner using clear logic
            if (userChoice === botChoice) {
                result = "It's a tie! 🤝";
            } else if (
                (userChoice === 'rock' && botChoice === 'scissors') ||
                (userChoice === 'paper' && botChoice === 'rock') ||
                (userChoice === 'scissors' && botChoice === 'paper')
            ) {
                result = 'You win! 🎉';
            } else {
                result = 'Bot wins! 🤖';
            }

            const emojis = {
                rock: '🪨',
                paper: '📄',
                scissors: '✂️'
            };

            const message = `
🎮 Rock Paper Scissors
You: ${emojis[userChoice]} ${userChoice}
Bot: ${emojis[botChoice]} ${botChoice}
Result: ${result}
        `.trim();

            await sock.sendMessage(sender, { text: message });
        } catch (err) {
            logger.error('RPS game error:', err);
            await sock.sendMessage(sender, { 
                text: '❌ An error occurred during the game. Please try again.'
            });
        }
    },

    async chess(sock, sender, args) {
        try {
            if (!global.chessGames) global.chessGames = new Map();

            const gameId = sender;
            let game = global.chessGames.get(gameId);

            if (!args[0]) {
                await sock.sendMessage(sender, {
                    text: 'Usage:\n!chess start - Start new game\n!chess move [from] [to] - Make a move (e.g., e2 e4)'
                });
                return;
            }

            const action = args[0].toLowerCase();

            if (action === 'start') {
                if (game) {
                    await sock.sendMessage(sender, { text: '❌ A game is already in progress!' });
                    return;
                }

                game = {
                    board: initializeChessBoard(),
                    currentPlayer: 'white',
                    moves: []
                };

                global.chessGames.set(gameId, game);

                const boardDisplay = renderChessBoard(game.board);
                await sock.sendMessage(sender, {
                    text: `♟️ Chess Game Started!\n\n${boardDisplay}\n\nMake a move using: !chess move [from] [to]\nExample: !chess move e2 e4`
                });
                return;
            }

            if (action === 'move') {
                if (!game) {
                    await sock.sendMessage(sender, { text: '❌ No game in progress. Start with !chess start' });
                    return;
                }

                const [from, to] = args.slice(1);
                if (!from || !to || !isValidPosition(from) || !isValidPosition(to)) {
                    await sock.sendMessage(sender, { text: '❌ Invalid move format! Use algebraic notation (e.g., e2 e4)' });
                    return;
                }

                const [fromRow, fromCol] = convertPosition(from);
                const [toRow, toCol] = convertPosition(to);
                const piece = game.board[fromRow][fromCol];

                if (!piece || piece.color !== game.currentPlayer) {
                    await sock.sendMessage(sender, { text: '❌ Invalid piece selection!' });
                    return;
                }

                if (!isValidMove(game.board, fromRow, fromCol, toRow, toCol)) {
                    await sock.sendMessage(sender, { text: '❌ Invalid move!' });
                    return;
                }

                // Make the move
                game.board[toRow][toCol] = piece;
                game.board[fromRow][fromCol] = null;
                game.moves.push({ from, to });

                // Check for check/checkmate (simplified)
                const isCheck = isKingInCheck(game.board, game.currentPlayer === 'white' ? 'black' : 'white');

                const boardDisplay = renderChessBoard(game.board);
                if (isCheck) {
                    await sock.sendMessage(sender, {
                        text: `${boardDisplay}\n\n⚔️ Check!`
                    });
                } else {
                    await sock.sendMessage(sender, {
                        text: `${boardDisplay}\n\nYour move!`
                    });
                }

                // Bot's move (simplified)
                const botMove = getBestMove(game.board);
                if (botMove) {
                    game.board[botMove.toRow][botMove.toCol] = game.board[botMove.fromRow][botMove.fromCol];
                    game.board[botMove.fromRow][botMove.fromCol] = null;

                    const boardDisplay = renderChessBoard(game.board);
                    await sock.sendMessage(sender, {
                        text: `${boardDisplay}\n\nYour turn!`
                    });
                }

                game.currentPlayer = game.currentPlayer === 'white' ? 'black' : 'white';
                global.chessGames.set(gameId, game);
            }

        } catch (err) {
            logger.error('Chess error:', err);
            await sock.sendMessage(sender, { text: '❌ An error occurred during the game.' });
        }
    },

    async wordle(sock, sender, args) {
        try {
            if (!global.wordleGames) global.wordleGames = new Map();

            const gameId = sender;
            let game = global.wordleGames.get(gameId);

            if (!args[0]) {
                await sock.sendMessage(sender, {
                    text: 'Usage:\n!wordle start - Start new game\n!wordle guess [word] - Make a guess'
                });
                return;
            }

            const action = args[0].toLowerCase();

            if (action === 'start') {
                if (game) {
                    await sock.sendMessage(sender, { text: '❌ A game is already in progress!' });
                    return;
                }

                const words = [
                    'SMILE', 'BEACH', 'DREAM', 'LIGHT', 'HAPPY',
                    'CLOUD', 'FRESH', 'HEART', 'MUSIC', 'DANCE'
                ];

                game = {
                    word: words[Math.floor(Math.random() * words.length)],
                    guesses: [],
                    maxAttempts: 6
                };

                global.wordleGames.set(gameId, game);

                await sock.sendMessage(sender, {
                    text: '🎮 Wordle Game Started!\nGuess the 5-letter word.\nYou have 6 attempts.\n\nUse: !wordle guess [word]'
                });
                return;
            }

            if (action === 'guess') {
                if (!game) {
                    await sock.sendMessage(sender, { text: '❌ No game in progress. Start with !wordle start' });
                    return;
                }

                const guess = args[1]?.toUpperCase();
                if (!guess || guess.length !== 5 || !/^[A-Z]+$/.test(guess)) {
                    await sock.sendMessage(sender, { text: '❌ Please provide a valid 5-letter word' });
                    return;
                }

                try {
                    const feedback = handleWordleGuess(game.word, guess);
                    game.guesses.push({ word: guess, feedback: feedback });
                    global.wordleGames.set(gameId, game);

                    const display = game.guesses.map(g => `${g.word} ${g.feedback}`).join('\n');
                    const isWon = guess === game.word;
                    const isLost = game.guesses.length >= game.maxAttempts;

                    if (isWon) {
                        await sock.sendMessage(sender, {
                            text: `${display}\n\n🎉 Congratulations! You found the word!`
                        });
                        global.wordleGames.delete(gameId);
                    } else if (isLost) {
                        await sock.sendMessage(sender, {
                            text: `${display}\n\n💀 Game Over! The word was: ${game.word}`
                        });
                        global.wordleGames.delete(gameId);
                    } else {
                        await sock.sendMessage(sender, {
                            text: `${display}\n\n${game.maxAttempts - game.guesses.length} attempts remaining`
                        });
                    }
                } catch (err) {
                    logger.error('Error processing Wordle guess:', err);
                    await sock.sendMessage(sender, { text: '❌ An error occurred while processing your guess.' });
                    global.wordleGames.delete(gameId);
                }
            }
        } catch (err) {
            logger.error('Wordle error:', err);
            await sock.sendMessage(sender, { text: '❌ An error occurred during the game.' });
            global.wordleGames.delete(gameId);
        }
    },

    // Enhanced RPS game with better validation and error handling

                    await sock.sendMessage(sender, { text: '❌ Please provide a valid 5-letter word' });
                    return;
                }

                try {
                    const feedback = handleWordleGuess(game.word, guess);
                    game.guesses.push({ word: guess, feedback: feedback });
                    global.wordleGames.set(gameId, game);

                    const display = game.guesses.map(g => `${g.word} ${g.feedback}`).join('\n');
                    const isWon = guess === game.word;
                    const isLost = game.guesses.length >= game.maxAttempts;

                    if (isWon) {
                        await sock.sendMessage(sender, {
                            text: `${display}\n\n🎉 Congratulations! You found the word!`
                        });
                        global.wordleGames.delete(gameId);
                    } else if (isLost) {
                        await sock.sendMessage(sender, {
                            text: `${display}\n\n💀 Game Over! The word was: ${game.word}`
                        });
                        global.wordleGames.delete(gameId);
                    } else {
                        await sock.sendMessage(sender, {
                            text: `${display}\n\n${game.maxAttempts - game.guesses.length} attempts remaining`
                        });
                    }
                } catch (err) {
                    logger.error('Error processing Wordle guess:', err);
                    await sock.sendMessage(sender, { text: '❌ An error occurred while processing your guess.' });
                    global.wordleGames.delete(gameId);
                }
            }
        } catch (err) {
            logger.error('Wordle error:', err);
            await sock.sendMessage(sender, { text: '❌ An error occurred during the game.' });
            global.wordleGames.delete(gameId);
        }
    },
    async trivia(sock, sender, args) {
        try {
            if (!global.triviaGames) global.triviaGames = new Map();

            const gameId = sender;
            let game = global.triviaGames.get(gameId);

            const categories = {
                general: [
                    {
                        question: "What is the capital of France?",
                        options: ["London", "Berlin", "Paris", "Madrid"],
                        correct: 2
                    },
                    {
                        question: "Which planet is known as the Red Planet?",
                        options: ["Venus", "Mars", "Jupiter", "Saturn"],
                        correct: 1
                    }
                ],
                science: [
                    {
                        question: "What is the chemical symbol for gold?",
                        options: ["Ag", "Fe", "Au", "Cu"],
                        correct: 2
                    },
                    {
                        question: "What is the hardest natural substance on Earth?",
                        options: ["Gold", "Iron", "Diamond", "Platinum"],
                        correct: 2
                    }
                ],
                history: [
                    {
                        question: "In which year did World War II end?",
                        options: ["1943", "1944", "1945", "1946"],
                        correct: 2
                    },
                    {
                        question: "Who was the first President of the United States?",
                        options: ["John Adams", "Thomas Jefferson", "George Washington", "Benjamin Franklin"],
                        correct: 2
                    }
                ]
            };

            if (!args[0]) {
                await sock.sendMessage(sender, {
                    text: `📚 Available categories: ${Object.keys(categories).join(', ')}\nUse: !trivia [category] to start`
                });
                return;
            }

            const category = args[0].toLowerCase();
            if (!categories[category]) {
                await sock.sendMessage(sender, {
                    text: `❌ Invalid category. Available categories: ${Object.keys(categories).join(', ')}`
                });
                return;
            }

            if (!game) {
                // Start new game
                game = {
                    category: category,
                    questions: [...categories[category]], // Create copy to shuffle
                    currentQuestion: 0,
                    score: 0,
                    maxQuestions: categories[category].length
                };

                // Shuffle questions
                for (let i = game.questions.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [game.questions[i], game.questions[j]] = [game.questions[j], game.questions[i]];
                }

                global.triviaGames.set(gameId, game);

                // Display first question
                const question = game.questions[0];
                const optionsText = question.options
                    .map((opt, i) => `${i + 1}. ${opt}`)
                    .join('\n');

                await sock.sendMessage(sender, {
                    text: `🎯 Trivia Game - ${category.toUpperCase()}\n\nQuestion 1/${game.maxQuestions}:\n${question.question}\n\n${optionsText}\n\nRespond with !answer [number]`
                });
                return;
            }

            // Handle answer
            if (args[0].toLowerCase() === 'answer') {
                const answer = parseInt(args[1]);
                if (isNaN(answer) || answer < 1 || answer > 4) {
                    await sock.sendMessage(sender, {
                        text: '❌ Please provide a valid answer number (1-4)'
                    });
                    return;
                }

                const currentQ = game.questions[game.currentQuestion];
                const isCorrect = (answer - 1) === currentQ.correct;
                if (isCorrect) game.score++;

                const feedbackText = isCorrect ? '✅ Correct!' : `❌ Wrong! The correct answer was: ${currentQ.options[currentQ.correct]}`;
                game.currentQuestion++;

                if (game.currentQuestion >= game.maxQuestions) {
                    // Game over
                    await sock.sendMessage(sender, {
                        text: `${feedbackText}\n\n🎮 Game Over!\nFinal Score: ${game.score}/${game.maxQuestions}`
                    });
                    global.triviaGames.delete(gameId);
                } else {
                    // Next question
                    const nextQ = game.questions[game.currentQuestion];
                    const optionsText = nextQ.options
                        .map((opt, i) => `${i + 1}. ${opt}`)
                        .join('\n');

                    await sock.sendMessage(sender, {
                        text: `${feedbackText}\n\nQuestion ${game.currentQuestion + 1}/${game.maxQuestions}:\n${nextQ.question}\n\n${optionsText}\n\nRespond with !answer [number]`
                    });
                    global.triviaGames.set(gameId, game);
                }
            }

        } catch (err) {
            logger.error('Trivia error:', err);
            await sock.sendMessage(sender, { text: '❌ An error occurred during the game.' });
            global.triviaGames.delete(gameId);
        }
    },

    // Social Commands
    async truth(sock, sender) {
        const questions = [
            "What's your biggest fear?",
            "What's your most embarrassing moment?",
            "What's your biggest secret?"
        ];
        await sock.sendMessage(sender, {
            text: `🤔 Truth: ${questions[Math.floor(Math.random() * questions.length)]}`
        });
    },

    async dare(sock, sender) {
        const dares = [
            "Send a funny selfie",
            "Do 10 push-ups",
            "Tell a joke in voice message"
        ];
        await sock.sendMessage(sender, {
            text: `😈 Dare: ${dares[Math.floor(Math.random() * dares.length)]}`
        });
    },

    async ship(sock, sender, args) {
        if (args.length < 2) {
            await sock.sendMessage(sender, { text: '💕 Please mention two people to ship!' });
            return;
        }
        const compatibility = Math.floor(Math.random() * 101);
        await sock.sendMessage(sender, {
            text: `💘 Love Calculator\n${args[0]} x ${args[1]}\nCompatibility: ${compatibility}%`
        });
    },

    // Virtual Pet System
    async pet(sock, sender, args) {
        const actions = ['feed', 'play', 'sleep', 'train'];
        if (!args[0] || !actions.includes(args[0].toLowerCase())) {
            await sock.sendMessage(sender, {
                text: `🐾 Available actions: ${actions.join(', ')}`
            });
            return;
        }
        // TODO: Implement virtual pet system
        await sock.sendMessage(sender, { text: 'Taking care of pet...' });
    },

    // Virtual Economy Commands
    async fish(sock, sender) {
        const items = ['🐟 Common Fish', '🐠 Tropical Fish', '🦈 Shark', '👢 Old Boot'];
        const caught = items[Math.floor(Math.random() * items.length)];
        await sock.sendMessage(sender, { text: `🎣 You caught: ${caught}` });
    },

    async hunt(sock, sender) {
        const items = ['🐰 Rabbit', '🦊 Fox', '🦌 Deer', '🐗 Boar'];
        const caught = items[Math.floor(Math.random() * items.length)];
        await sock.sendMessage(sender, { text: `🏹 You hunted: ${caught}` });
    },

    async mine(sock, sender) {
        const items = ['💎 Diamond', '🥇 Gold', '🥈 Silver', '🪨 Stone'];
        const found = items[Math.floor(Math.random() * items.length)];
        await sock.sendMessage(sender, { text: `⛏️ You found: ${found}` });
    },

    async collect(sock, sender) {
        // TODO: Implement daily rewards system
        await sock.sendMessage(sender, { text: 'Daily rewards feature coming soon!' });
    },

    },

    async shop(sock, sender, args) {
        if (!args[0]) {
            await sock.sendMessage(sender, {
                text: 'Usage: !shop [buy|sell] [item]'
            });
            return;
        }
        // TODO: Implement shop system
        await sock.sendMessage(sender, { text: 'Shop system coming soon!' });
    },

    async gift(sock, sender, args) {
        if (args.length < 2) {
            await sock.sendMessage(sender, {
                text: 'Usage: !gift @user [item]'
            });
            return;
        }
        // TODO: Implement gift system
        await sock.sendMessage(sender, { text: 'Gift system coming soon!' });
    },

    // Challenge System
    async challenge(sock, sender, args) {
        if (args.length < 2) {
            await sock.sendMessage(sender, {
                text: 'Usage: !challenge @user [type]'
            });
            return;
        }
        // TODO: Implement challenge system
        await sock.sendMessage(sender, { text: 'Challenge system coming soon!' });
    },

    async duel(sock, sender, args) {
        if (args.length < 2) {
            await sock.sendMessage(sender, {
                text: 'Usage: !duel @user [bet]'
            });
            return;
        }
        // TODO: Implement duel system
        await sock.sendMessage(sender, { text: 'Duel system coming soon!' });
    },

    // Virtual Marriage System
    async marry(sock, sender, args) {
        if (!args[0]) {
            await sock.sendMessage(sender, { text: 'Please mention someone to marry' });
            return;
        }
        // TODO: Implement marriage system
        await sock.sendMessage(sender, { text: 'Marriage system coming soon!' });
    },

    async divorce(sock, sender) {
        // TODO: Implement divorce system
        await sock.sendMessage(sender, { text: 'Divorce system coming soon!' });
    },

    // RPG Commands
    async adventure(sock, sender, args) {
        const locations = ['forest', 'cave', 'mountain', 'desert', 'dungeon'];
        if (!args[0] || !locations.includes(args[0].toLowerCase())) {
            await sock.sendMessage(sender, {
                text: `🗺️ Available locations: ${locations.join(', ')}`
            });
            return;
        }
        // TODO: Implement adventure system
        await sock.sendMessage(sender, { text: 'Starting adventure...' });
    },

    async dungeon(sock, sender, args) {
        const level = parseInt(args[0]) || 1;
        const maxLevel = 10;

        if (level < 1 || level > maxLevel) {
            await sock.sendMessage(sender, {
                text: `Please choose a level between 1 and ${maxLevel}`
            });
            return;
        }

        const events = [
            'found rare loot!',
            'defeated a boss!',
            'discovered a treasure chest!',
            'activated a trap!',
            'found a secret room!'
        ];

        const event = events[Math.floor(Math.random() * events.length)];
        await sock.sendMessage(sender, {
            text: `⚔️ Dungeon Level ${level}: You ${event}`
        });
    },

    async battle(sock, sender, args) {
        if (!args[0]) {
            await sock.sendMessage(sender, { text: '⚔️ Please mention someone to battle!' });
            return;
        }
        // TODO: Implement battle system
        await sock.sendMessage(sender, { text: 'Battle starting...' });
    },

    // Gambling Commands
    async blackjack(sock, sender, args) {
        const bet = parseInt(args[0]) || 10;
        const cards = ['A♠️', '2♠️', '3♠️', '4♠️', '5♠️', '6♠️', '7♠️', '8♠️', '9♠️', '10♠️', 'J♠️', 'Q♠️', 'K♠️'];
        const playerCards = [
            cards[Math.floor(Math.random() * cards.length)],
            cards[Math.floor(Math.random() * cards.length)]
        ];
        const dealerCards = [cards[Math.floor(Math.random() * cards.length)], '?️'];

        await sock.sendMessage(sender, {
            text: `🎰 Blackjack (Bet: ${bet})\nYour cards: ${playerCards.join(' ')}\nDealer cards: ${dealerCards.join(' ')}\nType !hit or !stand`
        });
    },

    async poker(sock, sender, args) {
        const bet = parseInt(args[0]) || 10;
        const cards = ['A♠️', '2♠️', '3♠️', '4♠️', '5♠️', '6♠️', '7♠️', '8♠️', '9♠️', '10♠️', 'J♠️', 'Q♠️', 'K♠️'];
        const playerCards = [
            cards[Math.floor(Math.random() * cards.length)],
            cards[Math.floor(Math.random() * cards.length)]
        ];

        await sock.sendMessage(sender, {
            text: `🎰 Poker (Bet: ${bet})\nYour cards: ${playerCards.join(' ')}\nType !call, !raise, or !fold`
        });
    },

    async roulette(sock, sender, args) {
        const [bet, choice] = args;
        const betAmount = parseInt(bet) || 10;

        if (!choice) {
            await sock.sendMessage(sender, {
                text: 'Please specify your bet (number 0-36 or color red/black)'
            });
            return;
        }

        const result = Math.floor(Math.random() * 37);
        const resultColor = result === 0 ? 'green' : (result % 2 === 0 ? 'red' : 'black');
        const won = (choice.toLowerCase() === resultColor) || (parseInt(choice) === result);

        await sock.sendMessage(sender, {
            text: `🎰 Roulette\nResult: ${result} (${resultColor})\nYou ${won ? 'won' : 'lost'}!`
        });
    },

    async heist(sock, sender, args) {
        const targets = ['bank', 'casino', 'mansion', 'vault', 'train'];
        const target = args[0]?.toLowerCase();

        if (!targets.includes(target)) {
            await sock.sendMessage(sender, {
                text: `Available heist targets: ${targets.join(', ')}`
            });
            return;
        }

        const outcomes = [
            'successfully completed the heist!',
            'got caught by security!',
            'found a secret vault!',
            'triggered the alarm!',
            'escaped with the loot!'
        ];

        const outcome = outcomes[Math.floor(Math.random() * outcomes.length)];
        await sock.sendMessage(sender, {
            text: `🦹 Heist: You ${outcome}`
        });
    },


    // Character System
    async class(sock, sender, args) {
        const classes = ['warrior', 'mage', 'rogue', 'priest'];
        const selectedClass = args[0]?.toLowerCase();

        if (!selectedClass || !classes.includes(selectedClass)) {
            await sock.sendMessage(sender, {
                text: `Available classes: ${classes.join(', ')}`
            });
            return;
        }

        await sock.sendMessage(sender, {
            text: `You are now a ${selectedClass}!`
        });
    },

    async skills(sock, sender, args) {
        const [action, skillName] = args;
        const actions = ['list', 'upgrade'];

        if (!action || !actions.includes(action.toLowerCase())) {
            await sock.sendMessage(sender, {
                text: 'Usage: !skills [list|upgrade] [skillname]'
            });
            return;
        }

        if (action === 'list') {
            await sock.sendMessage(sender, {
                text: '🎯 Available Skills:\n1. Attack\n2. Defense\n3. Magic\n4. Speed'
            });
        } else {
            if (!skillName) {
                await sock.sendMessage(sender, { text: 'Please specify a skill to upgrade' });
                return;
            }
            await sock.sendMessage(sender, {
                text: `Upgraded ${skillName}!`
            });
        }
    },

    async inventory(sock, sender, args) {
        const page = parseInt(args[0]) || 1;
        // TODO: Implement inventory system
        await sock.sendMessage(sender, {
            text: `📦 Inventory (Page ${page}):\n- Empty -`
        });
    },

    // Mini Games
    async _8ball(sock, sender, args) {
        const question = args.join(' ');
        if (!question) {
            await sock.sendMessage(sender, { text: 'Please ask a question' });
            return;
        }

        const responses = [
            'Yes, definitely',
            'No way',
            'Maybe',
            'Ask again later',
            'Cannot predict now'
        ];

        const response = responses[Math.floor(Math.random() * responses.length)];
        await sock.sendMessage(sender, {
            text: `🎱 ${question}\nAnswer: ${response}`
        });
    },

    async wordchain(sock, sender, args) {
        const [action, word] = args;
        if (!action || !['start', 'play'].includes(action.toLowerCase())) {
            await sock.sendMessage(sender, {
                text: 'Usage: !wordchain [start|play] [word]'
            });
            return;
        }

        if (action === 'start') {
            await sock.sendMessage(sender, {
                text: '🔤 Word Chain Game Started!\nRules: Reply with a word that starts with the last letter of the previous word'
            });
        } else {
            if (!word) {
                await sock.sendMessage(sender, { text: 'Please provide a word' });
                return;
            }
            // TODO: Implement word validation and game logic
            await sock.sendMessage(sender, {
                text: `Word accepted: ${word}`
            });
        }
    },

    async scramble(sock, sender, args) {
        const categories = ['animals', 'fruits', 'countries'];
        const category = args[0]?.toLowerCase();

        if (!category || !categories.includes(category)) {
            await sock.sendMessage(sender, {
                text: `Available categories: ${categories.join(', ')}`
            });
            return;
        }

        // TODO: Implement word scramble game
        await sock.sendMessage(sender, {
            text: 'Word Scramble game starting...'
        });
    },

    // Pet System
    async petadopt(sock, sender, args) {
        const pets = ['cat', 'dog', 'rabbit', 'hamster', 'bird'];
        const pet = args[0]?.toLowerCase();

        if (!pet || !pets.includes(pet)) {
            await sock.sendMessage(sender, {
                text: `Available pets to adopt: ${pets.join(', ')}`
            });
            return;
        }

        await sock.sendMessage(sender, {
            text: `🐾 Congratulations! You've adopted a ${pet}!`
        });
    },

    async petcare(sock, sender, args) {
        const actions = ['feed', 'play', 'clean', 'train', 'heal'];
        const action = args[0]?.toLowerCase();

        if (!action || !actions.includes(action)) {
            await sock.sendMessage(sender, {
                text: `Available pet care actions: ${actions.join(', ')}`
            });
            return;
        }

        await sock.sendMessage(sender, {
            text: `🐾 You ${action} your pet! They look happy!`
        });
    },

    async petstatus(sock, sender) {
        // TODO: Implement pet status system
        await sock.sendMessage(sender, {
            text: '🐱 Pet Status:\nHappiness: ❤️❤️❤️\nHunger: 🍖🍖\nEnergy: ⚡⚡⚡'
        });
    },


    // Additional Fun Commands
    async emojimix(sock, sender, args) {
        if (args.length !== 2) {
            return await sock.sendMessage(sender, {
                text: '⚠️ Please provide two emojis to mix!'
            });
        }
        // TODO: Implement emoji mixing using external API
        await sock.sendMessage(sender, { text: 'Emoji mixing feature coming soon!' });
    },

    async trigger(sock, sender) {
        // TODO: Implement triggered meme generation
        await sock.sendMessage(sender, { text: 'Triggered meme feature coming soon!' });
    },

    async wanted(sock, sender) {
        // TODO: Implement wanted poster generation
        await sock.sendMessage(sender, { text: 'Wanted poster feature coming soon!' });
    },

    async roast(sock, sender, args) {
        const target = args[0];
        if (!target) {
            await sock.sendMessage(sender, { text: 'Please mention someone to roast!' });
            return;
        }

        const roasts = [
            "You're so slow, you could win a race against a statue! 🐌",
            "Your jokes are so bad, even dad jokes feel embarrassed! 😅",
            "You're about as useful as a screen door on a submarine! 🚪",
            "I'd agree with you but then we'd both be wrong! 🤷",
            "Your fashion sense is like a randomizer gone wrong! 👕",
            "You're the reason why we have instructions on shampoo! 📝"
        ];

        const randomRoast = roasts[Math.floor(Math.random() * roasts.length)];
        await sock.sendMessage(sender, {
            text: `To ${target}:\n${randomRoast}`
        });
    },

    async compliment(sock, sender, args) {
        const target = args[0];
        if (!target) {
            await sock.sendMessage(sender, { text: 'Please mention someone to compliment!' });
            return;
        }

        const compliments = [
            "Your smile lights up the room! ✨",
            "You're amazing at making others feel special! 🌟",
            "Your positive energy is contagious! 🌈",
            "You have a heart of gold! 💝",
            "You make the world a better place! 🌍",
            "Your creativity knows no bounds! 🎨",
            "You're stronger than you know! 💪",
            "Your kindness is inspiring! 🤗"
        ];

        const randomCompliment = compliments[Math.floor(Math.random() * compliments.length)];
        await sock.sendMessage(sender, {
            text: `To ${target}:\n${randomCompliment}`
        });
    },

    async animegif(sock, sender, args) {
        const category = args[0]?.toLowerCase();
        const categories = ['action', 'romance', 'comedy', 'drama'];

        if (!category || !categories.includes(category)) {
            await sock.sendMessage(sender, {
                text: `🎬 Available categories: ${categories.join(', ')}`
            });
            return;
        }
        
        // Check if games and fun commands are enabled for the group
        if (sender.endsWith('@g.us') && !await areGamesEnabled(sock, sender)) {
            await sock.sendMessage(sender, { 
                text: '⚠️ Fun commands are disabled in this group. Ask an admin to enable them with !feature games on' 
            });
            return;
        }
        
        try {
            await sock.sendMessage(sender, { text: `🎭 Getting ${category} anime GIF...` });
            
            // Map the categories to appropriate API endpoints
            const apiEndpoints = {
                action: 'https://api.waifu.pics/sfw/kick',
                romance: 'https://api.waifu.pics/sfw/hug',
                comedy: 'https://api.waifu.pics/sfw/smile',
                drama: 'https://api.waifu.pics/sfw/cry'
            };
            
            // Fetch the GIF from the appropriate endpoint
            const response = await axios.get(apiEndpoints[category]);
            if (!response.data || !response.data.url) {
                await sock.sendMessage(sender, { text: `Failed to fetch ${category} anime GIF. Please try again later.` });
                return;
            }
            
            // Send the GIF
            await sock.sendMessage(sender, {
                image: { url: response.data.url },
                caption: `🎭 ${category.charAt(0).toUpperCase() + category.slice(1)} anime GIF`
            });
        } catch (error) {
            console.error(`Error fetching anime GIF for category ${category}:`, error);
            await sock.sendMessage(sender, { text: `Failed to fetch ${category} anime GIF. Please try again later.` });
        }
    },

    async waifu(sock, sender, args) {
        const [type] = args;
        const types = ['sfw', 'nsfw'];
        if (!type || !types.includes(type.toLowerCase())) {
            await sock.sendMessage(sender, {
                text: `👗 Usage: !waifu <sfw|nsfw>`
            });
            return;
        }
        // TODO: Implement waifu image fetching
        await sock.sendMessage(sender, { text: '👘 Getting waifu image...' });
    },

    async neko(sock, sender, args) {
        const [type] = args;
        const types = ['sfw', 'nsfw'];
        if (!type || !types.includes(type.toLowerCase())) {
            await sock.sendMessage(sender, {
                text: `🐱 Usage: !neko <sfw|nsfw>`
            });
            return;
        }
        // TODO: Implement neko image fetching
        await sock.sendMessage(sender, { text: '😺 Getting neko image...' });
    },

    async animeface(sock, sender) {
        // TODO: Implement anime face generation
        await sock.sendMessage(sender, { text: '👤 Generating anime face...' });
    },

    async animequote(sock, sender) {
        // TODO: Implement anime quote fetching
        await sock.sendMessage(sender, { text: '💭 Getting anime quote...' });
    },

    async animetrivia(sock, sender) {
        // TODO: Implement anime trivia
        await sock.sendMessage(sender, { text: '❓ Getting anime trivia question...' });
    }

};

function renderBoard(board) {
    const cells = board.map((cell, i) => cell === ' ' ? (i + 1).toString() : cell);
    return `${cells[0]} │ ${cells[1]} │ ${cells[2]}\n──┼───┼──\n${cells[3]} │ ${cells[4]} │ ${cells[5]}\n──┼───┼──\n${cells[6]} │ ${cells[7]} │ ${cells[8]}`;
}

function checkWinner(board) {
    const winPatterns = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
        [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
        [0, 4, 8], [2, 4, 6]             // Diagonals
    ];

    for (const pattern of winPatterns) {
        const [a, b, c] = pattern;
        if (board[a] !== ' ' && board[a] === board[b] && board[b] === board[c]) {
            return board[a];
        }
    }
    return null;
}

function getBotMove(board) {
    // First try to win
    const move = findWinningMove(board, 'O');
    if (move !== -1) return move;

    // Then block player's winning move
    const blockMove = findWinningMove(board, 'X');
    if (blockMove !== -1) return blockMove;

    // Take center if available
    if (board[4] === ' ') return 4;

    // Take any available corner
    const corners = [0, 2, 6, 8];
    const availableCorners = corners.filter(i => board[i] === ' ');
    if (availableCorners.length > 0) {
        return availableCorners[Math.floor(Math.random() * availableCorners.length)];
    }

    // Take any available side
    const sides = [1, 3, 5, 7];
    const availableSides = sides.filter(i => board[i] === ' ');
    if (availableSides.length > 0) {
        return availableSides[Math.floor(Math.random() * availableSides.length)];
    }

    return -1;
}

function findWinningMove(board, player) {
    const winPatterns = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8],
        [0, 3, 6], [1, 4, 7], [2, 5, 8],
        [0, 4, 8], [2, 4, 6]
    ];

    for (const pattern of winPatterns) {
        const [a, b, c] = pattern;
        const line = [board[a], board[b], board[c]];
        const playerCount = line.filter(cell => cell === player).length;
        const emptyCount = line.filter(cell => cell === ' ').length;

        if (playerCount === 2 && emptyCount === 1) {
            const emptyIndex = pattern[line.findIndex(cell => cell === ' ')];
            return emptyIndex;
        }
    }
    return -1;
}

function getHangmanDisplay(game) {
    const stages = [
        `
  +---+
  |   |
      |
      |
      |
      |
=========`,
        `
  +---+
  |   |
  O   |
      |
      |
      |
=========`,
        `
  +---+
  |   |
  O   |
  |   |
      |
      |
=========`,
        `
  +---+
  |   |
  O   |
 /|   |
      |
      |
=========`,
        `
  +---+
  |   |
  O   |
 /|\\  |
      |
      |
=========`,
        `
  +---+
  |   |
  O   |
 /|\\  |
 /    |
      |
=========`,
        `
  +---+
  |   |
  O   |
 /|\\  |
 / \\  |
      |
=========`
    ];

    const wordDisplay = [...game.word]
        .map(letter => game.guessed.has(letter) ? letter : '_')
        .join(' ');

    return `${stages[game.mistakes]}\n\nWord: ${wordDisplay}`;
}

function initializeChessBoard() {
    const board = Array(8).fill(null).map(() => Array(8).fill(null));

    // Set up pawns
    for (let i = 0; i < 8; i++) {
        board[1][i] = { type: 'pawn', color: 'white' };
        board[6][i] = { type: 'pawn', color: 'black' };
    }

    // Set up other pieces
    const pieces = ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook'];
    pieces.forEach((piece, i) => {
        board[0][i] = { type: piece, color: 'white' };
        board[7][i] = { type: piece, color: 'black' };
    });

    return board;
}

function renderChessBoard(board) {
    const pieces = {
        'white': {
            'pawn': '♙', 'rook': '♖', 'knight': '♘',
            'bishop': '♗', 'queen': '♕', 'king': '♔'
        },
        'black': {
            'pawn': '♟', 'rook': '♜', 'knight': '♞',
            'bishop': '♝', 'queen': '♛', 'king': '♚'
        }
    };

    let display = '  a b c d e f g h\n';
    for (let i = 7; i >= 0; i--) {
        display += (i + 1) + ' ';
        for (let j = 0; j < 8; j++) {
            const piece = board[i][j];
            if (piece) {
                display += pieces[piece.color][piece.type] + ' ';
            } else {
                display += (i + j) % 2 === 0 ? '□ ' : '■ ';
            }
        }
        display += (i + 1) + '\n';
    }
    display += '  a b c d e f g h';

    return display;
}

function isValidPosition(pos) {
    return /^[a-h][1-8]$/.test(pos);
}

function convertPosition(pos) {
    const col = pos.charCodeAt(0) - 'a'.charCodeAt(0);
    const row = parseInt(pos[1]) - 1;
    return [row, col];
}

function isValidMove(board, fromRow, fromCol, toRow, toCol) {
    // Simplified move validation
    const piece = board[fromRow][fromCol];
    if (!piece) return false;

    // Basic movement patterns (simplified)
    switch (piece.type) {
        case 'pawn':
            if (piece.color === 'white') {
                return toRow === fromRow + 1 && toCol === fromCol;
            } else {
                return toRow === fromRow - 1 && toCol === fromCol;
            }
        case 'rook':
            return fromRow === toRow || fromCol === toCol;
        case 'bishop':
            return Math.abs(toRow - fromRow) === Math.abs(toCol - fromCol);
        case 'knight':
            return (Math.abs(toRow - fromRow) === 2 && Math.abs(toCol - fromCol) === 1) ||
                   (Math.abs(toRow - fromRow) === 1 && Math.abs(toCol - fromCol) === 2);
        case 'queen':
            return fromRow === toRow || fromCol === toCol ||
                   Math.abs(toRow - fromRow) === Math.abs(toCol - fromCol);
        case 'king':
            return Math.abs(toRow - fromRow) <= 1 && Math.abs(toCol - fromCol) <= 1;
        default:
            return false;
    }
}

// Fix the syntax in the chess king detection loop
function isKingInCheck(board, color) {
    // Find the king
    let kingPos = null;

    // Find the king position
    for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 8; j++) {
            const piece = board[i][j];
            if (piece && piece.type === 'king' && piece.color === color) {
                kingPos = [i, j];
                break;
            }
        }
        if (kingPos) break;
    }

    if (!kingPos) return false;

    // Check if any opponent piece can capture the king
    for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 8; j++) {
            const piece = board[i][j];
            if (piece && piece.color !== color) {
                if (isValidMove(board, i, j, kingPos[0], kingPos[1])) {
                    return true;
                }
            }
        }
    }

    return false;
}

// Helper function for Wordle game
function handleWordleGuess(word, guess) {
    const feedback = [];
    const targetWord = word.split('');
    const remainingLetters = [...targetWord];

    // First pass: find correct letters in correct positions
    for (let i = 0; i < 5; i++) {
        if (guess[i] === targetWord[i]) {
            feedback[i] = '🟩'; // Green
            remainingLetters[i] = null;
        }
    }

    // Second pass: find correct letters in wrong positions
    for (let i = 0; i < 5; i++) {
        if (!feedback[i]) {
            const index = remainingLetters.indexOf(guess[i]);
            if (index !== -1) {
                feedback[i] = '🟨'; // Yellow
                remainingLetters[index] = null;
            } else {
                feedback[i] = '⬜'; // Gray
            }
        }
    }

    return feedback.join('');
}

// Game state initialization
function initializeGameState() {
    global.games = global.games || new Map();
    global.hangmanGames = global.hangmanGames || new Map();
    global.wordleGames = global.wordleGames || new Map();
    global.chessGames = global.chessGames || new Map();
    global.quizGames = global.quizGames || new Map();
    global.triviaGames = global.triviaGames || new Map();
}


module.exports = {
    commands: funCommands,
    category: 'fun',
    async init() {
        try {
            logger.info('Initializing fun command handler...');

            initializeGameState();

            // Create required directories
            const tempDir = path.join(__dirname, '../../temp/fun');
            await fs.mkdir(tempDir, { recursive: true });

            logger.info('Fun command handler initialized successfully');
            return true;
        } catch (err) {
            logger.error('Error initializing fun command handler:', err);
            return false;
        }
    }
};