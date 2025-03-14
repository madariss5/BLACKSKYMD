const logger = require('../utils/logger');
const path = require('path');
const fs = require('fs').promises;
const { isFeatureEnabled } = require('../utils/groupSettings');
const axios = require('axios');
const { createCanvas, loadImage } = require('canvas');
const { formatNumber, randomInt, shuffleArray, sleep } = require('../utils/helpers');
const crypto = require('crypto');
const mathjs = require('mathjs');
const moment = require('moment');
const { safeSendText, safeSendMessage, safeSendImage } = require('../utils/jidHelper');

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
            await safeSendText(sock, remoteJid, '❌ Games are disabled in this group. Ask an admin to enable them with *.feature games on*' 
            );
            return false;
        }
    }
    return true;
}

// Game state initialization - improved with timeouts and better state tracking
function initializeGameState() {
    if (!global.games) {
        global.games = {
            tictactoe: new Map(),
            hangman: new Map(),
            wordle: new Map(),
            quiz: new Map(),
            trivia: new Map()
        };
    }

    // Clean up expired games every hour
    if (!global.gameCleanupInterval) {
        global.gameCleanupInterval = setInterval(() => {
            const now = Date.now();
            const TIMEOUT = 30 * 60 * 1000; // 30 minutes

            for (const [gameType, gameMap] of Object.entries(global.games)) {
                for (const [id, game] of gameMap.entries()) {
                    if (now - game.lastActivity > TIMEOUT) {
                        gameMap.delete(id);
                        logger.info(`Cleaned up inactive ${gameType} game for ${id}`);
                    }
                }
            }
        }, 60 * 60 * 1000); // Run every hour
    }
}

// Board rendering with improved aesthetics 
function renderBoard(board) {
    const cells = board.map((cell, i) => cell === ' ' ? `[${i + 1}]` : ` ${cell} `);
    return `${cells[0]}│${cells[1]}│${cells[2]}\n───┼───┼───\n${cells[3]}│${cells[4]}│${cells[5]}\n───┼───┼───\n${cells[6]}│${cells[7]}│${cells[8]}`;
}

// Enhanced win checking
function checkWinner(board) {
    const patterns = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
        [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
        [0, 4, 8], [2, 4, 6]             // Diagonals
    ];

    for (const [a, b, c] of patterns) {
        if (board[a] !== ' ' && board[a] === board[b] && board[b] === board[c]) {
            return { winner: board[a], line: [a, b, c] };
        }
    }

    return board.includes(' ') ? null : { winner: 'draw' };
}

// Improved bot move calculation
function getBotMove(board) {
    // First try to win
    const winMove = findWinningMove(board, 'O');
    if (winMove !== -1) return winMove;

    // Then block player
    const blockMove = findWinningMove(board, 'X');
    if (blockMove !== -1) return blockMove;

    // Take center
    if (board[4] === ' ') return 4;

    // Take corners
    const corners = [0, 2, 6, 8];
    const availableCorners = corners.filter(i => board[i] === ' ');
    if (availableCorners.length > 0) {
        return availableCorners[Math.floor(Math.random() * availableCorners.length)];
    }

    // Take sides
    const sides = [1, 3, 5, 7];
    const availableSides = sides.filter(i => board[i] === ' ');
    if (availableSides.length > 0) {
        return availableSides[Math.floor(Math.random() * availableSides.length)];
    }

    return -1;
}

// Enhanced winning move detection
function findWinningMove(board, player) {
    const patterns = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
        [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
        [0, 4, 8], [2, 4, 6]             // Diagonals
    ];

    for (const [a, b, c] of patterns) {
        // Check each position in the pattern
        if (board[a] === player && board[b] === player && board[c] === ' ') return c;
        if (board[a] === player && board[c] === player && board[b] === ' ') return b;
        if (board[b] === player && board[c] === player && board[a] === ' ') return a;
    }
    return -1;
}

// Improved Hangman display
function getHangmanDisplay(game) {
    const stages = [
        '\n      +---+\n      |   |\n          |\n          |\n          |\n          |\n    =========',
        '\n      +---+\n      |   |\n      O   |\n          |\n          |\n          |\n    =========',
        '\n      +---+\n      |   |\n      O   |\n      |   |\n          |\n          |\n    =========',
        '\n      +---+\n      |   |\n      O   |\n     /|   |\n          |\n          |\n    =========',
        '\n      +---+\n      |   |\n      O   |\n     /|\\  |\n          |\n          |\n    =========',
        '\n      +---+\n      |   |\n      O   |\n     /|\\  |\n     /    |\n          |\n    =========',
        '\n      +---+\n      |   |\n      O   |\n     /|\\  |\n     / \\  |\n          |\n    ========='
    ];

    const displayWord = game.word
        .split('')
        .map(letter => game.guessedLetters.includes(letter.toLowerCase()) ? letter : '_')
        .join(' ');

    const wrongGuesses = game.guessedLetters
        .filter(letter => !game.word.toLowerCase().includes(letter));
    
    const unusedLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
        .split('')
        .filter(letter => !game.guessedLetters.includes(letter.toLowerCase()))
        .join(' ');

    return `${stages[Math.min(wrongGuesses.length, stages.length - 1)]}\n
📝 Word: ${displayWord}
❌ Wrong guesses (${wrongGuesses.length}/${game.maxWrongGuesses}): ${wrongGuesses.join(' ') || 'None'}
✨ Available letters: ${unusedLetters}`;
}

// Enhanced Wordle feedback
function handleWordleGuess(word, guess) {
    const feedback = [];
    const wordLetters = word.toLowerCase().split('');
    const guessLetters = guess.toLowerCase().split('');
    
    // First pass: Mark exact matches
    for (let i = 0; i < 5; i++) {
        if (guessLetters[i] === wordLetters[i]) {
            feedback[i] = '🟩'; // Green
            wordLetters[i] = null; // Mark as used
            guessLetters[i] = null;
        }
    }
    
    // Second pass: Mark partial matches
    for (let i = 0; i < 5; i++) {
        if (feedback[i]) continue; // Skip if already matched
        if (!guessLetters[i]) continue; // Skip if marked in first pass
        
        const letterIndex = wordLetters.indexOf(guessLetters[i]);
        if (letterIndex !== -1) {
            feedback[i] = '🟨'; // Yellow
            wordLetters[letterIndex] = null; // Mark as used
        } else {
            feedback[i] = '⬜'; // Gray
        }
    }
    
    return feedback.join('');
}

// Command exports
const funCommands = {
    // Fun Text Commands with improved error handling and feedback
    async quote(sock, sender) {
        try {
            const quotes = [
                "Be yourself; everyone else is already taken. - Oscar Wilde",
                "Two things are infinite: the universe and human stupidity; and I'm not sure about the universe. - Albert Einstein",
                "Be the change that you wish to see in the world. - Mahatma Gandhi",
                "Life is what happens when you're busy making other plans. - John Lennon",
                "The only way to do great work is to love what you do. - Steve Jobs",
                "Stay hungry, stay foolish. - Steve Jobs",
                "The future belongs to those who believe in the beauty of their dreams. - Eleanor Roosevelt",
                "Success is not final, failure is not fatal: it is the courage to continue that counts. - Winston Churchill",
                "The only impossible journey is the one you never begin. - Tony Robbins",
                "Life is either a daring adventure or nothing at all. - Helen Keller"
            ];
            const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
            await safeSendMessage(sock, sender, { 
                text: `📜 *Quote of the Moment*\n\n_${randomQuote}_\n\n💭 Need inspiration? Use *!quote* again.` 
            });
        } catch (err) {
            logger.error('Quote error:', err);
            await safeSendText(sock, sender, '❌ Oops! Something went wrong fetching your quote.\nPlease try again in a moment.' 
            );
        }
    },

    async joke(sock, sender) {
        try {
            // Import the jidHelper directly to ensure it's available
            const { safeSendText } = require('../utils/jidHelper');
            
            const jokes = [
                "Why don't scientists trust atoms? Because they make up everything!",
                "Did you hear about the mathematician who's afraid of negative numbers? He'll stop at nothing to avoid them!",
                "Why don't skeletons fight each other? They don't have the guts!",
                "What do you call a fake noodle? An impasta!",
                "Why did the scarecrow win an award? Because he was outstanding in his field!",
                "I told my wife she was drawing her eyebrows too high. She looked surprised!",
                "What do you call a bear with no teeth? A gummy bear!",
                "Why don't eggs tell jokes? They'd crack each other up!",
                "What's orange and sounds like a parrot? A carrot!",
                "How do you organize a space party? You planet!"
            ];
            const randomJoke = jokes[Math.floor(Math.random() * jokes.length)];
            
            // Use the safeSendText function to prevent JID errors
            await safeSendText(sock, sender, `😂 Joke time:\n\n${randomJoke}`);
        } catch (err) {
            logger.error('Joke error:', err);
            await safeSendText(sock, sender, "❌ Sorry, couldn't tell a joke right now.");
        }
    },

    async meme(sock, sender) {
        try {
            // TODO: Implement meme fetching from API
            await safeSendText(sock, sender, '🎭 Meme functionality coming soon!' );
        } catch (err) {
            logger.error('Meme error:', err);
            await safeSendText(sock, sender, '❌ An error occurred while fetching the meme.' );
        }
    },

    // Games
    async tictactoe(sock, message, args) {
        try {
            const sender = message.key.remoteJid;
            if (!(await areGamesEnabled(sock, sender))) return;
            
            if (!global.games.tictactoe) global.games.tictactoe = new Map();
            const gameId = sender;
            let game = global.games.tictactoe.get(gameId);
            
            // Create new game if no active game
            if (!game) {
                game = {
                    board: [' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' '],
                    currentPlayer: 'X',
                    moves: 0,
                    lastActivity: Date.now()
                };
                global.games.tictactoe.set(gameId, game);
                
                await safeSendMessage(sock, sender, {
                    text: `🎮 *Tic-Tac-Toe*\nYou are X, Bot is O\n\n${renderBoard(game.board)}\n\nSelect position (1-9):`
                });
                return;
            }
            
            // Check for game timeout
            if (Date.now() - game.lastActivity > 5 * 60 * 1000) {
                global.games.tictactoe.delete(gameId);
                await safeSendText(sock, sender, '⏰ Game expired. Start a new game with !tictactoe'
                );
                return;
            }
            
            // Process player move
            const move = parseInt(args[0]);
            if (isNaN(move) || move < 1 || move > 9) {
                await safeSendText(sock, sender, '❌ Please choose a number between 1 and 9'
                );
                return;
            }
            
            const index = move - 1;
            if (game.board[index] !== ' ') {
                await safeSendText(sock, sender, '❌ That position is already taken! Choose another'
                );
                return;
            }
            
            // Apply player move
            game.board[index] = 'X';
            game.moves++;
            game.lastActivity = Date.now();
            
            // Check for win or draw
            let result = checkWinner(game.board);
            if (result || game.moves === 9) {
                let message = '';
                if (result?.winner === 'X') {
                    message = '🎉 You win! Congratulations!';
                } else if (result?.winner === 'O') {
                    message = '😢 Bot wins! Better luck next time.';
                } else {
                    message = '🤝 It\'s a draw!';
                }
                
                await safeSendMessage(sock, sender, {
                    text: `${renderBoard(game.board)}\n\n${message}\n\nType *!tictactoe* to play again`
                });
                global.games.tictactoe.delete(gameId);
                return;
            }
            
            // Bot's turn
            const botMove = getBotMove(game.board);
            if (botMove !== -1) {
                game.board[botMove] = 'O';
                game.moves++;
                
                // Check for win or draw after bot move
                result = checkWinner(game.board);
                if (result || game.moves === 9) {
                    let message = '';
                    if (result?.winner === 'X') {
                        message = '🎉 You win! Congratulations!';
                    } else if (result?.winner === 'O') {
                        message = '😢 Bot wins! Better luck next time.';
                    } else {
                        message = '🤝 It\'s a draw!';
                    }
                    
                    await safeSendMessage(sock, sender, {
                        text: `${renderBoard(game.board)}\n\n${message}\n\nType *!tictactoe* to play again`
                    });
                    global.games.tictactoe.delete(gameId);
                    return;
                }
            }
            
            global.games.tictactoe.set(gameId, game);
            await safeSendMessage(sock, sender, {
                text: `${renderBoard(game.board)}\n\nYour turn! Choose position (1-9):`
            });
        } catch (err) {
            logger.error('Tic-tac-toe error:', err);
            await safeSendText(sock, sender, '❌ An error occurred during the game'
            );
            global.games.tictactoe.delete(sender);
        }
    },

    async hangman(sock, message, args) {
        try {
            const sender = message.key.remoteJid;
            if (!(await areGamesEnabled(sock, sender))) return;
            
            if (!global.games.hangman) global.games.hangman = new Map();
            
            const gameId = sender;
            let game = global.games.hangman.get(gameId);
            
            if (!game) {
                // Start a new game with filtered word list
                const words = [
                    'PYTHON', 'JAVASCRIPT', 'PROGRAMMING', 'COMPUTER', 'DATABASE',
                    'NETWORK', 'ALGORITHM', 'INTERNET', 'SOFTWARE', 'DEVELOPER',
                    'CODING', 'WEBSITE', 'SECURITY', 'MOBILE', 'CLOUD'
                ];
                const randomWord = words[Math.floor(Math.random() * words.length)];
                
                game = {
                    word: randomWord,
                    guessedLetters: [],
                    maxWrongGuesses: 6,
                    lastActivity: Date.now()
                };
                
                global.games.hangman.set(gameId, game);
                
                const hangmanDisplay = getHangmanDisplay(game);
                await safeSendMessage(sock, sender, {
                    text: `🎮 *Hangman Game*\n${hangmanDisplay}\n\nGuess a letter using *!hangman [letter]*`
                });
                return;
            }
            
            // Check for game timeout
            if (Date.now() - game.lastActivity > 5 * 60 * 1000) {
                global.games.hangman.delete(gameId);
                await safeSendText(sock, sender, '⏰ Game expired. Start a new game with !hangman'
                );
                return;
            }
            
            // Process a guess
            const guess = args[0]?.toUpperCase();
            if (!guess || guess.length !== 1 || !guess.match(/[A-Z]/)) {
                await safeSendText(sock, sender, '❌ Please guess a single letter (A-Z)'
                );
                return;
            }
            
            if (game.guessedLetters.includes(guess)) {
                await safeSendText(sock, sender, '❌ You already guessed that letter!'
                );
                return;
            }
            
            game.guessedLetters.push(guess);
            game.lastActivity = Date.now();
            global.games.hangman.set(gameId, game);
            
            const wrongGuesses = game.guessedLetters.filter(letter => !game.word.includes(letter));
            const isWon = game.word.split('').every(letter => game.guessedLetters.includes(letter));
            const isLost = wrongGuesses.length >= game.maxWrongGuesses;
            
            const hangmanDisplay = getHangmanDisplay(game);
            
            if (isWon) {
                await safeSendMessage(sock, sender, {
                    text: `${hangmanDisplay}\n\n🎉 You won! The word was: ${game.word}\n\nType *!hangman* to play again`
                });
                global.games.hangman.delete(gameId);
            } else if (isLost) {
                await safeSendMessage(sock, sender, {
                    text: `${hangmanDisplay}\n\n💀 Game Over! The word was: ${game.word}\n\nType *!hangman* to try again`
                });
                global.games.hangman.delete(gameId);
            } else {
                await safeSendMessage(sock, sender, {
                    text: `${hangmanDisplay}\n\nGuess another letter using *!hangman [letter]*`
                });
            }
        } catch (err) {
            logger.error('Hangman error:', err);
            await safeSendText(sock, sender, '❌ An error occurred during the game'
            );
            global.games.hangman.delete(sender);
        }
    },

    async wordle(sock, message, args) {
        try {
            const sender = message.key.remoteJid;
            if (!(await areGamesEnabled(sock, sender))) return;
            
            if (!global.games.wordle) global.games.wordle = new Map();
            
            const gameId = sender;
            let game = global.games.wordle.get(gameId);
            
            if (!game) {
                // Curated 5-letter word list
                const words = [
                    'SPEAK', 'DREAM', 'LEARN', 'BUILD', 'TEACH',
                    'THINK', 'SOLVE', 'WRITE', 'SHARE', 'STUDY',
                    'FOCUS', 'SKILL', 'LOGIC', 'BRAIN', 'SMART'
                ];
                const randomWord = words[Math.floor(Math.random() * words.length)];
                
                game = {
                    word: randomWord,
                    guesses: [],
                    maxAttempts: 6,
                    lastActivity: Date.now(),
                    hint: false
                };
                
                global.games.wordle.set(gameId, game);
                
                await safeSendText(sock, sender, `🎮 *Wordle Game*\n\nI'm thinking of a 5-letter word. You have 6 tries to guess it!\n\n🟩 - Correct letter, correct position\n🟨 - Correct letter, wrong position\n⬜ - Letter not in word\n\nMake your first guess with *!wordle [word]*\n\nNeed a hint? Use *!wordle hint*`
                );
                return;
            }
            
            // Check for game timeout
            if (Date.now() - game.lastActivity > 10 * 60 * 1000) {
                global.games.wordle.delete(gameId);
                await safeSendText(sock, sender, '⏰ Game expired. Start a new game with !wordle'
                );
                return;
            }

            // Handle hint request
            if (args[0]?.toLowerCase() === 'hint' && !game.hint) {
                game.hint = true;
                const firstLetter = game.word[0];
                await safeSendMessage(sock, sender, {
                    text: `💡 Hint: The word starts with '${firstLetter}'`
                });
                return;
            }
            
            // Process a guess
            const guess = args[0]?.toUpperCase();
            if (!guess || guess.length !== 5 || !guess.match(/^[A-Z]{5}$/)) {
                await safeSendText(sock, sender, '❌ Please provide a valid 5-letter word'
                );
                return;
            }
            
            game.lastActivity = Date.now();
            
            try {
                const feedback = handleWordleGuess(game.word, guess);
                game.guesses.push({ word: guess, feedback: feedback });
                global.games.wordle.set(gameId, game);
                
                const display = game.guesses.map(g => `${g.word} ${g.feedback}`).join('\n');
                const isWon = guess === game.word;
                const isLost = game.guesses.length >= game.maxAttempts;
                
                if (isWon) {
                    const attempts = game.guesses.length;
                    let rating = '';
                    if (attempts === 1) rating = '🌟 Genius!';
                    else if (attempts === 2) rating = '🎯 Magnificent!';
                    else if (attempts === 3) rating = '✨ Impressive!';
                    else if (attempts === 4) rating = '👏 Great!';
                    else if (attempts === 5) rating = '😊 Good!';
                    else rating = '😌 Phew!';

                    await safeSendMessage(sock, sender, {
                        text: `${display}\n\n🎉 ${rating}\nYou found the word in ${attempts} ${attempts === 1 ? 'try' : 'tries'}!\n\nPlay again with *!wordle*`
                    });
                    global.games.wordle.delete(gameId);
                } else if (isLost) {
                    await safeSendMessage(sock, sender, {
                        text: `${display}\n\n💀 Game Over!\nThe word was: ${game.word}\n\nTry again with *!wordle*`
                    });
                    global.games.wordle.delete(gameId);
                } else {
                    await safeSendMessage(sock, sender, {
                        text: `${display}\n\n${game.maxAttempts - game.guesses.length} attempts remaining`
                    });
                }
            } catch (err) {
                logger.error('Error processing Wordle guess:', err);
                await safeSendText(sock, sender, '❌ Error processing your guess'
                );
                global.games.wordle.delete(gameId);
            }
        } catch (err) {
            logger.error('Wordle error:', err);
            await safeSendText(sock, sender, '❌ An error occurred during the game'
            );
            global.games.wordle.delete(sender);
        }
    },

    async quiz(sock, message, args) {
        try {
            const sender = message.key.remoteJid;
            if (!(await areGamesEnabled(sock, sender))) return;
            
            if (!global.games.quiz) global.games.quiz = new Map();
            const gameId = sender;
            let game = global.games.quiz.get(gameId);

            const categories = {
                general: [
                    {
                        question: "Which programming language is known as the 'language of the web'?",
                        options: ["Python", "JavaScript", "Java", "C++"],
                        correct: 1,
                        explanation: "JavaScript is essential for web development and runs in all modern browsers."
                    },
                    {
                        question: "What does CPU stand for?",
                        options: ["Central Process Unit", "Central Programming Unit", "Central Processing Unit", "Computer Processing Unit"],
                        correct: 2,
                        explanation: "CPU (Central Processing Unit) is the brain of a computer."
                    }
                ],
                coding: [
                    {
                        question: "What is the result of 2 + '2' in JavaScript?",
                        options: ["4", "22", "TypeError", "NaN"],
                        correct: 1,
                        explanation: "In JavaScript, when + is used with a string, it performs concatenation."
                    },
                    {
                        question: "Which data structure follows LIFO?",
                        options: ["Queue", "Stack", "Array", "Tree"],
                        correct: 1,
                        explanation: "Stack follows Last In, First Out (LIFO) principle."
                    }
                ]
            };

            if (!args[0]) {
                await safeSendMessage(sock, sender, {
                    text: `📚 *Quiz Game*\n\nAvailable categories:\n${Object.keys(categories).map(c => `• ${c}`).join('\n')}\n\nStart with *!quiz [category]*`
                });
                return;
            }

            const category = args[0].toLowerCase();
            if (!categories[category]) {
                await safeSendText(sock, sender, '❌ Invalid category. Available categories: ' + Object.keys(categories).join(', ')
                );
                return;
            }

            if (!game) {
                game = {
                    category,
                    questions: [...categories[category]], // Create copy to shuffle
                    currentQuestion: 0,
                    score: 0,
                    maxQuestions: categories[category].length,
                    lastActivity: Date.now(),
                    attempts: 0
                };

                // Shuffle questions
                for (let i = game.questions.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [game.questions[i], game.questions[j]] = [game.questions[j], game.questions[i]];
                }

                global.games.quiz.set(gameId, game);

                // Display first question
                const question = game.questions[0];
                const optionsText = question.options
                    .map((opt, i) => `${i + 1}. ${opt}`)
                    .join('\n');

                await safeSendMessage(sock, sender, {
                    text: `🎯 *Quiz - ${category.toUpperCase()}*\n\nQuestion 1/${game.maxQuestions}:\n${question.question}\n\n${optionsText}\n\nRespond with *!answer [number]*`
                });
                return;
            }

            // Check for game timeout
            if (Date.now() - game.lastActivity > 5 * 60 * 1000) {
                global.games.quiz.delete(gameId);
                await safeSendText(sock, sender, '⏰ Quiz expired. Start a new quiz with !quiz'
                );
                return;
            }

            // Handle answer
            if (args[0].toLowerCase() === 'answer') {
                const answer = parseInt(args[1]);
                if (isNaN(answer) || answer < 1 || answer > 4) {
                    await safeSendText(sock, sender, '❌ Please provide a valid answer number (1-4)'
                    );
                    return;
                }

                const currentQ = game.questions[game.currentQuestion];
                const isCorrect = (answer - 1) === currentQ.correct;
                
                if (isCorrect) {
                    game.score++;
                    await safeSendMessage(sock, sender, {
                        text: `✅ Correct!\n\n${currentQ.explanation}`
                    });
                } else {
                    await safeSendMessage(sock, sender, {
                        text: `❌ Wrong! The correct answer was: ${currentQ.options[currentQ.correct]}\n\n${currentQ.explanation}`
                    });
                }

                game.currentQuestion++;
                game.lastActivity = Date.now();

                if (game.currentQuestion >= game.maxQuestions) {
                    // Quiz complete
                    const percentage = (game.score / game.maxQuestions) * 100;
                    let grade = '';
                    if (percentage === 100) grade = '🌟 Perfect!';
                    else if (percentage >= 80) grade = '🎉 Excellent!';
                    else if (percentage >= 60) grade = '👏 Good job!';
                    else if (percentage >= 40) grade = '😊 Nice try!';
                    else grade = '📚 Keep learning!';

                    await safeSendMessage(sock, sender, {
                        text: `🎮 Quiz Complete!\n\nFinal Score: ${game.score}/${game.maxQuestions}\n${grade}\n\nPlay again with *!quiz*`
                    });
                    global.games.quiz.delete(gameId);
                } else {
                    // Next question
                    const nextQ = game.questions[game.currentQuestion];
                    const optionsText = nextQ.options
                        .map((opt, i) => `${i + 1}. ${opt}`)
                        .join('\n');

                    await safeSendMessage(sock, sender, {
                        text: `🎯 Question ${game.currentQuestion + 1}/${game.maxQuestions}:\n${nextQ.question}\n\n${optionsText}\n\nRespond with *!answer [number]*`
                    });
                    global.games.quiz.set(gameId, game);
                }
            }
        } catch (err) {
            logger.error('Quiz error:', err);
            await safeSendText(sock, sender, '❌ An error occurred during the quiz'
            );
            global.games.quiz.delete(sender);
        }
    },

    async rps(sock, message, args) {
        try {
            const sender = message.key.remoteJid;
            if (!(await areGamesEnabled(sock, sender))) return;
            
            const choices = ['rock', 'paper', 'scissors'];
            const userChoice = args.join(' ').toLowerCase();
            
            if (!choices.includes(userChoice)) {
                await safeSendText(sock, sender, '⚔️ *Rock Paper Scissors*\n\nChoose your weapon:\n• rock 🪨\n• paper 📄\n• scissors ✂️' 
                );
                return;
            }
            
            const botChoice = choices[Math.floor(Math.random() * choices.length)];
            const emojis = {
                rock: '🪨',
                paper: '📄',
                scissors: '✂️'
            };

            let result = '';
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
            
            const response = `*⚔️ Rock Paper Scissors*\n\nYou chose: ${userChoice} ${emojis[userChoice]}\nBot chose: ${botChoice} ${emojis[botChoice]}\n\n${result}\n\nPlay again with !rps [choice]`;
            await safeSendText(sock, sender, response );
        } catch (err) {
            logger.error('RPS error:', err);
            await safeSendText(sock, message.key.remoteJid, '❌ An error occurred during the game. Please try again.' 
            );
        }
    },

    async roll(sock, message, args) {
        try {
            const sender = message.key.remoteJid;
            const sides = parseInt(args[0]) || 6;

            if (sides < 2 || sides > 100) {
                await safeSendText(sock, sender, '🎲 Please specify a number of sides between 2 and 100\nExample: !roll 20'
                );
                return;
            }

            const result = Math.floor(Math.random() * sides) + 1;
            await safeSendText(sock, sender, `🎲 *Dice Roll (d${sides})*\n\nYou rolled: ${result}\n\nRoll again with !roll [sides]`);
        } catch (err) {
            logger.error('Dice roll error:', err);
            await safeSendText(sock, message.key.remoteJid, '❌ Error rolling dice. Please try again.');
        }
    },

    async riddle(sock, message) {
        try {
            const sender = message.key.remoteJid;
            const riddles = [
                {
                    question: "I speak without a mouth and hear without ears. I have no body, but I come alive with wind. What am I?",
                    answer: "An echo"
                },
                {
                    question: "What has keys, but no locks; space, but no room; and you can enter, but not go in?",
                    answer: "A keyboard"
                },
                {
                    question: "The more you take, the more you leave behind. What am I?",
                    answer: "Footsteps"
                },
                {
                    question: "What has cities, but no houses; forests, but no trees; and rivers, but no water?",
                    answer: "A map"
                },
                {
                    question: "What is always in front of you but can't be seen?",
                    answer: "The future"
                }
            ];

            // Store current riddle for reveal
            if (!global.riddles) global.riddles = new Map();
            
            const currentRiddle = riddles[Math.floor(Math.random() * riddles.length)];
            global.riddles.set(sender, {
                riddle: currentRiddle,
                timestamp: Date.now()
            });

            await safeSendMessage(sock, sender, {
                text: `🤔 *Riddle*\n\n${currentRiddle.question}\n\nUse *!reveal* to see the answer`
            });
        } catch (err) {
            logger.error('Riddle error:', err);
            await safeSendText(sock, message.key.remoteJid, '❌ Error generating riddle. Please try again.'
            );
        }
    },

    async reveal(sock, message) {
        try {
            const sender = message.key.remoteJid;
            
            if (!global.riddles || !global.riddles.has(sender)) {
                await safeSendText(sock, sender, '❌ No active riddle. Use !riddle to get a new riddle'
                );
                return;
            }

            const riddle = global.riddles.get(sender);
            
            // Check for timeout (5 minutes)
            if (Date.now() - riddle.timestamp > 5 * 60 * 1000) {
                global.riddles.delete(sender);
                await safeSendText(sock, sender, '⏰ Riddle expired. Use !riddle to get a new one'
                );
                return;
            }

            await safeSendMessage(sock, sender, {
                text: `🎯 *Answer:* ${riddle.riddle.answer}\n\nGet another riddle with !riddle`
            });
            global.riddles.delete(sender);
        } catch (err) {
            logger.error('Reveal error:', err);
            await safeSendText(sock, message.key.remoteJid, '❌ Error revealing answer. Please try again.'
            );
        }
    },

    async fact(sock, message) {
        try {
            const sender = message.key.remoteJid;
            const facts = [
                "A day on Venus is longer than its year. 🌟",
                "Honey never spoils. Archaeologists have found pots of honey in ancient Egyptian tombs that are over 3,000 years old! 🍯",
                "The first oranges weren't orange! The original oranges from Southeast Asia were actually green. 🍊",
                "A cloud can weigh more than a million pounds. ☁️",
                "Octopuses have three hearts. 🐙",
                "The Great Wall of China isn't visible from space. 🌍", 
                "Bananas are berries, but strawberries aren't! 🍌",
                "A bolt of lightning is six times hotter than the sun's surface. ⚡",
                "The average person spends 6 months of their lifetime waiting for red lights to turn green. 🚦",
                "Dogs' sense of smell is 40 times greater than humans. 🐕"
            ];

            const randomFact = facts[Math.floor(Math.random() * facts.length)];
            await safeSendMessage(sock, sender, {
                text: `📚 *Fun Fact*\n\n${randomFact}\n\nGet another fact with !fact`
            });
        } catch (err) {
            logger.error('Fact error:', err);
            await safeSendText(sock, message.key.remoteJid, '❌ Error generating fact. Please try again.'
            );
        }
    },

    async trivia(sock, message, args) {
        try {
            const sender = message.key.remoteJid;
            if (!(await areGamesEnabled(sock, sender))) return;

            if (!global.games.trivia) global.games.trivia = new Map();

            const gameId = sender;
            let game = global.games.trivia.get(gameId);

            const categories = {
                tech: [
                    {
                        question: "Which company created JavaScript?",
                        options: ["Microsoft", "Netscape", "Oracle", "Google"],
                        correct: 1
                    },
                    {
                        question: "What does CPU stand for?",
                        options: ["Central Processing Unit", "Computer Personal Unit", "Central Program Utility", "Computer Program Unit"],
                        correct: 0
                    },
                    {
                        question: "What does HTML stand for?",
                        options: ["Hyper Text Markup Language", "High Tech Modern Language", "Hyper Transfer Markup Logic", "Home Tool Markup Language"],
                        correct: 0
                    }
                ],
                coding: [
                    {
                        question: "Which of these is not a programming language?",
                        options: ["Java", "Python", "Cobra", "Photoshop"],
                        correct: 3
                    },
                    {
                        question: "What is the most basic data structure?",
                        options: ["Tree", "Array", "Queue", "Stack"],
                        correct: 1
                    },
                    {
                        question: "Which symbol is used for single-line comments in JavaScript?",
                        options: ["#", "//", "/*", "--"],
                        correct: 1
                    }
                ]
            };

            if (!args[0]) {
                await safeSendMessage(sock, sender, {
                    text: `📚 *Trivia Categories*\n\n${Object.keys(categories).join(', ')}\n\nUse: *!trivia [category]* to start`
                });
                return;
            }

            const category = args[0].toLowerCase();
            if (!categories[category]) {
                await safeSendMessage(sock, sender, {
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
                    maxQuestions: categories[category].length,
                    lastActivity: Date.now()
                };

                // Shuffle questions
                for (let i = game.questions.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [game.questions[i], game.questions[j]] = [game.questions[j], game.questions[i]];
                }

                global.games.trivia.set(gameId, game);

                // Display first question
                const question = game.questions[0];
                const optionsText = question.options
                    .map((opt, i) => `${i + 1}. ${opt}`)
                    .join('\n');

                await safeSendMessage(sock, sender, {
                    text: `🎯 *Trivia Game - ${category.toUpperCase()}*\n\nQuestion 1/${game.maxQuestions}:\n${question.question}\n\n${optionsText}\n\nRespond with *!trivia answer [number]*`
                });
                return;
            }

            // Check for game timeout
            if (Date.now() - game.lastActivity > 5 * 60 * 1000) {
                global.games.trivia.delete(gameId);
                await safeSendText(sock, sender, '⏰ Game expired. Start a new game with !trivia'
                );
                return;
            }

            // Handle answer
            if (args[0].toLowerCase() === 'answer') {
                const answer = parseInt(args[1]);
                if (isNaN(answer) || answer < 1 || answer > 4) {
                    await safeSendText(sock, sender, '❌ Please provide a valid answer number (1-4)'
                    );
                    return;
                }

                const currentQ = game.questions[game.currentQuestion];
                const isCorrect = (answer - 1) === currentQ.correct;
                if (isCorrect) game.score++;

                const feedbackText = isCorrect ? 
                    '✅ *Correct!*' : 
                    `❌ *Wrong!* The correct answer was: ${currentQ.options[currentQ.correct]}`;
                game.currentQuestion++;
                game.lastActivity = Date.now();

                if (game.currentQuestion >= game.maxQuestions) {
                    // Game over
                    const scoreText = game.score === game.maxQuestions ? 
                        '🏆 Perfect Score!' : 
                        `Final Score: ${game.score}/${game.maxQuestions}`;

                    await safeSendMessage(sock, sender, {
                        text: `${feedbackText}\n\n🎮 Game Over!\n${scoreText}\n\nType *!trivia* to play again`
                    });
                    global.games.trivia.delete(gameId);
                } else {
                    // Next question
                    const nextQ = game.questions[game.currentQuestion];
                    const optionsText = nextQ.options
                        .map((opt, i) => `${i + 1}. ${opt}`)
                        .join('\n');

                    await safeSendMessage(sock, sender, {
                        text: `${feedbackText}\n\n*Question ${game.currentQuestion + 1}/${game.maxQuestions}:*\n${nextQ.question}\n\n${optionsText}\n\nRespond with *!trivia answer [number]*`
                    });
                    global.games.trivia.set(gameId, game);
                }
            }
        } catch (err) {
            logger.error('Trivia error:', err);
            await safeSendText(sock, sender, '❌ An error occurred during the game'
            );
            global.games.trivia.delete(gameId);
        }
    },

    async slot(sock, message, args) {
        try {
            const sender = message.key.remoteJid;
            if (!(await areGamesEnabled(sock, sender))) return;

            const symbols = ['🍒', '🍊', '🍇', '💎', '7️⃣', '🎰'];
            const lines = 3;
            const reels = 3;

            // Generate random slot results
            const board = Array(lines).fill().map(() => 
                Array(reels).fill().map(() => symbols[Math.floor(Math.random() * symbols.length)])
            );

            // Format board display
            const boardDisplay = board.map(line => line.join(' | ')).join('\n');
            
            // Check for wins
            const winningLines = board.filter(line => 
                line.every(symbol => symbol === line[0])
            ).length;

            let message = `🎰 *Slot Machine*\n\n${boardDisplay}\n\n`;
            
            if (winningLines > 0) {
                message += `🎉 Congratulations! You got ${winningLines} winning line${winningLines > 1 ? 's' : ''}!`;
            } else {
                message += '😢 No winning lines. Try again!';
            }

            await safeSendText(sock, sender, message );
        } catch (err) {
            logger.error('Slot error:', err);
            await safeSendText(sock, message.key.remoteJid, '❌ Error running slot machine. Please try again.' 
            );
        }
    },

    async fortune(sock, message) {
        const { safeSendText } = require('../utils/jidHelper');
        
        try {
            const sender = message.key.remoteJid;
            const fortunes = [
                "A beautiful, smart, and loving person will be coming into your life. 🌟",
                "Your creativity will bring you great success. 🎨",
                "A thrilling opportunity lies ahead. Be ready to seize it! 🎯",
                "A friendly encounter will lead to a lasting relationship. 🤝",
                "Your hard work is about to pay off. Keep pushing forward! 💪",
                "A pleasant surprise is waiting for you. 🎁",
                "Your positive attitude will guide you to success. ✨",
                "An unexpected journey will bring great joy. 🌈",
                "Your talents will be recognized and rewarded. 🏆",
                "New friendships will brighten your path. 🌟"
            ];

            const randomFortune = fortunes[Math.floor(Math.random() * fortunes.length)];
            await safeSendText(sock, sender, `🔮 *Your Fortune*\n\n${randomFortune}\n\nGet another fortune with !fortune`);
        } catch (err) {
            logger.error('Fortune error:', err);
            await safeSendText(sock, message.key.remoteJid, '❌ Error reading your fortune. Please try again.' 
            );
        }
    },

    async horoscope(sock, message, args) {
        try {
            const sender = message.key.remoteJid;
            const signs = [
                'aries', 'taurus', 'gemini', 'cancer', 
                'leo', 'virgo', 'libra', 'scorpio', 
                'sagittarius', 'capricorn', 'aquarius', 'pisces'
            ];

            const sign = args[0]?.toLowerCase();
            if (!sign || !signs.includes(sign)) {
                const signList = signs.map(s => `• ${s.charAt(0).toUpperCase() + s.slice(1)}`).join('\n');
                await safeSendMessage(sock, sender, { 
                    text: `⭐ *Daily Horoscope*\n\nPlease specify your zodiac sign:\n${signList}\n\nUsage: !horoscope [sign]` 
                });
                return;
            }

            const horoscopes = {
                aries: "Your energy is high today. Take on new challenges! 🔥",
                taurus: "Focus on practical matters and financial planning. 💰",
                gemini: "Communication flows easily. Share your ideas! 💭",
                cancer: "Trust your intuition in emotional matters. 🌙",
                leo: "Your creative energy shines bright today. ☀️",
                virgo: "Pay attention to details but don't overthink. ✨",
                libra: "Balance is key in all your endeavors today. ⚖️",
                scorpio: "Your determination leads to breakthroughs. 🦂",
                sagittarius: "Adventure calls! Explore new horizons. 🎯",
                capricorn: "Your hard work brings recognition. 🏔️",
                aquarius: "Innovation and originality are highlighted. ⚡",
                pisces: "Trust your creative instincts today. 🌊"
            };

            const response = `🌟 *${sign.toUpperCase()} Horoscope*\n\n${horoscopes[sign]}\n\nCheck again tomorrow!`;
            await safeSendText(sock, sender, response );
        } catch (err) {
            logger.error('Horoscope error:', err);
            await safeSendText(sock, message.key.remoteJid, '❌ Error reading your horoscope. Please try again.' 
            );
        }
    },

    async roll(sock, sender, args) {
        try {
            let sides = 6;
            if (args[0] && !isNaN(args[0])) {
                sides = parseInt(args[0]);
                if (sides < 2 || sides > 100) {
                    await safeSendText(sock, sender, '❌ Please enter a number between 2 and 100.' );
                    return;
                }
            }
            
            const result = Math.floor(Math.random() * sides) + 1;
            await safeSendMessage(sock, sender, { text: `🎲 You rolled: ${result} (d${sides})` });
        } catch (err) {
            logger.error('Roll error:', err);
            await safeSendText(sock, sender, '❌ An error occurred.' );
        }
    },

    async flip(sock, sender) {
        try {
            const result = Math.random() < 0.5 ? 'Heads' : 'Tails';
            await safeSendMessage(sock, sender, { text: `🪙 Coin flip: ${result}` });
        } catch (err) {
            logger.error('Flip error:', err);
            await safeSendText(sock, sender, '❌ An error occurred.' );
        }
    },

    async choose(sock, sender, args) {
        try {
            const choices = args.join(' ').split(',').map(choice => choice.trim()).filter(Boolean);
            
            if (choices.length < 2) {
                await safeSendText(sock, sender, '❌ Please provide at least 2 options separated by commas.' 
                );
                return;
            }
            
            const randomChoice = choices[Math.floor(Math.random() * choices.length)];
            await safeSendMessage(sock, sender, { text: `🎯 I choose: ${randomChoice}` });
        } catch (err) {
            logger.error('Choose error:', err);
            await safeSendText(sock, sender, '❌ An error occurred.' );
        }
    },
    
    // 1. Truth or Dare
    async truthordare(sock, sender, args) {
        try {
            if (!(await areGamesEnabled(sock, sender))) return;
            
            const type = args[0]?.toLowerCase();
            if (!type || (type !== 'truth' && type !== 'dare')) {
                await safeSendText(sock, sender, '🎮 Truth or Dare\n\nChoose either *!truthordare truth* or *!truthordare dare*' 
                );
                return;
            }
            
            const truths = [
                "What's the most embarrassing thing you've ever done?",
                "What's your biggest fear?",
                "What's a secret you've never told anyone?",
                "What's the worst thing you've ever done?",
                "What's the craziest dream you've had?",
                "What's your biggest regret?",
                "What's the last lie you told?",
                "What's something you're still hiding from your parents?",
                "What's the most childish thing you still do?",
                "What's the most embarrassing music you listen to?"
            ];
            
            const dares = [
                "Send the last photo you took",
                "Send a screenshot of your most recent call history",
                "Text your crush and say hi",
                "Send a voice message singing your favorite song",
                "Call someone and speak in a funny accent",
                "Send a selfie with a funny face",
                "Change your profile picture to a cartoon character for 24 hours",
                "Send a message to your family group saying you need help with laundry",
                "Video call the next person in your contacts for 10 seconds",
                "Send 'I love you' to the 3rd person in your WhatsApp contacts"
            ];
            
            const options = type === 'truth' ? truths : dares;
            const randomOption = options[Math.floor(Math.random() * options.length)];
            
            await safeSendMessage(sock, sender, { 
                text: `🎮 ${type.toUpperCase()}:\n\n${randomOption}` 
            });
        } catch (err) {
            logger.error('Truth or Dare error:', err);
            await safeSendText(sock, sender, '❌ An error occurred during the game.' );
        }
    },
    
    // 2. Would You Rather
    async wouldyourather(sock, sender) {
        try {
            if (!(await areGamesEnabled(sock, sender))) return;
            
            const questions = [
                "Would you rather be able to fly or be invisible?",
                "Would you rather be the best player on a losing team or the worst player on a winning team?",
                "Would you rather lose all your memories or never be able to make new ones?",
                "Would you rather be famous for something terrible or never be famous for something great?",
                "Would you rather be able to speak every language or play every instrument?",
                "Would you rather live without the internet or without AC and heating?",
                "Would you rather be stuck on a broken ski lift or in a broken elevator?",
                "Would you rather have unlimited battery life on devices or unlimited free WiFi wherever you go?",
                "Would you rather never age physically or have a perfect memory?",
                "Would you rather have 3 feet or 3 hands?"
            ];
            
            const randomQuestion = questions[Math.floor(Math.random() * questions.length)];
            
            await safeSendMessage(sock, sender, { 
                text: `🤔 Would You Rather:\n\n${randomQuestion}` 
            });
        } catch (err) {
            logger.error('Would You Rather error:', err);
            await safeSendText(sock, sender, '❌ An error occurred.' );
        }
    },
    
    // 3. Never Have I Ever
    async neverhaveiever(sock, sender) {
        try {
            if (!(await areGamesEnabled(sock, sender))) return;
            
            const statements = [
                "Never have I ever sent a text to the wrong person",
                "Never have I ever pretended to be sick to avoid something",
                "Never have I ever stayed up for more than 24 hours",
                "Never have I ever forgotten someone's name while introducing them",
                "Never have I ever broken a bone",
                "Never have I ever been kicked out of a venue",
                "Never have I ever gone a day without showering",
                "Never have I ever lied in a job interview",
                "Never have I ever been on TV",
                "Never have I ever stolen something"
            ];
            
            const randomStatement = statements[Math.floor(Math.random() * statements.length)];
            
            await safeSendMessage(sock, sender, { 
                text: `🎮 Never Have I Ever:\n\n${randomStatement}\n\nRespond with 🍺 if you have, or 🙅‍♂️ if you haven't!` 
            });
        } catch (err) {
            logger.error('Never Have I Ever error:', err);
            await safeSendText(sock, sender, '❌ An error occurred.' );
        }
    },
    
    // 4. Fact
    async fact(sock, sender) {
        try {
            const facts = [
                "Bananas are berries, but strawberries aren't.",
                "The shortest war in history was between Britain and Zanzibar on August 27, 1896. Zanzibar surrendered after 38 minutes.",
                "A group of flamingos is called a 'flamboyance'.",
                "The average person spends 6 months of their life waiting for red lights to turn green.",
                "The fingerprints of koalas are so similar to humans that they have been confused at crime scenes.",
                "A day on Venus is longer than a year on Venus. It takes 243 Earth days to rotate once on its axis and 225 Earth days to orbit the sun.",
                "Honey never spoils. Archaeologists have found pots of honey in ancient Egyptian tombs that are over 3,000 years old and still perfectly preserved.",
                "The world's oldest known living tree is a Great Basin Bristlecone Pine, believed to have lived over 5,000 years.",
                "Octopuses have three hearts, nine brains, and blue blood.",
                "Cats have a specialized collarbone that allows them to always land on their feet when falling."
            ];
            
            const randomFact = facts[Math.floor(Math.random() * facts.length)];
            
            await safeSendMessage(sock, sender, { 
                text: `📚 Random Fact:\n\n${randomFact}` 
            });
        } catch (err) {
            logger.error('Fact error:', err);
            await safeSendText(sock, sender, '❌ An error occurred while fetching a fact.' );
        }
    },
    
    // 5. Fortune Cookie
    async fortune(sock, sender) {
        try {
            const fortunes = [
                "A beautiful, smart, and loving person will be coming into your life.",
                "Your ability to juggle many tasks will take you far.",
                "A lifetime of happiness awaits you.",
                "You will be traveling and coming into a fortune.",
                "Now is the time to try something new.",
                "The greatest risk is not taking one.",
                "Your hard work is about to pay off. Remember, dreams are the seedlings of reality.",
                "You will be successful in your work.",
                "Your creative side will shine today.",
                "Your life will be happy and peaceful."
            ];
            
            const randomFortune = fortunes[Math.floor(Math.random() * fortunes.length)];
            
            await safeSendMessage(sock, sender, { 
                text: `🥠 Your Fortune:\n\n${randomFortune}` 
            });
        } catch (err) {
            logger.error('Fortune error:', err);
            await safeSendText(sock, sender, '❌ An error occurred while fetching your fortune.' );
        }
    },
    
    // 6. Riddle
    async riddle(sock, sender) {
        try {
            if (!(await areGamesEnabled(sock, sender))) return;
            
            if (!global.riddles) global.riddles = new Map();
            
            // Clear any existing riddle
            global.riddles.delete(sender);
            
            const riddles = [
                {
                    question: "I speak without a mouth and hear without ears. I have no body, but I come alive with wind. What am I?",
                    answer: "echo"
                },
                {
                    question: "You see a boat filled with people. It has not sunk, but when you look again you don't see a single person on the boat. Why?",
                    answer: "all the people were married"
                },
                {
                    question: "What is always in front of you but can't be seen?",
                    answer: "future"
                },
                {
                    question: "What can you break, even if you never pick it up or touch it?",
                    answer: "promise"
                },
                {
                    question: "What has many keys but can't open a single lock?",
                    answer: "piano"
                },
                {
                    question: "What gets wet while drying?",
                    answer: "towel"
                },
                {
                    question: "I have branches, but no fruit, trunk or leaves. What am I?",
                    answer: "bank"
                },
                {
                    question: "What can't talk but will reply when spoken to?",
                    answer: "echo"
                },
                {
                    question: "The more of this there is, the less you see. What is it?",
                    answer: "darkness"
                },
                {
                    question: "What has a head and a tail but no body?",
                    answer: "coin"
                }
            ];
            
            const randomRiddle = riddles[Math.floor(Math.random() * riddles.length)];
            
            // Store the riddle for the user
            global.riddles.set(sender, randomRiddle);
            
            await safeSendMessage(sock, sender, { 
                text: `🧩 Riddle:\n\n${randomRiddle.question}\n\nGuess the answer using *!riddleguess [your answer]*` 
            });
        } catch (err) {
            logger.error('Riddle error:', err);
            await safeSendText(sock, sender, '❌ An error occurred.' );
        }
    },
    
    // 7. Riddleguess - companion command for Riddle
    async riddleguess(sock, sender, args) {
        try {
            if (!(await areGamesEnabled(sock, sender))) return;
            
            if (!global.riddles || !global.riddles.has(sender)) {
                await safeSendText(sock, sender, '❌ No active riddle found. Start a new riddle with *!riddle*' 
                );
                return;
            }
            
            if (!args.length) {
                await safeSendText(sock, sender, '❓ Please provide your guess!' 
                );
                return;
            }
            
            const riddle = global.riddles.get(sender);
            const guess = args.join(' ').toLowerCase().trim();
            
            if (guess === riddle.answer.toLowerCase()) {
                await safeSendText(sock, sender, '🎉 Correct! You solved the riddle!\n\nAsk for another with *!riddle*' 
                );
                global.riddles.delete(sender);
            } else {
                await safeSendText(sock, sender, '❌ Incorrect! Try again or use *!riddlehint* for a hint.' 
                );
            }
        } catch (err) {
            logger.error('Riddle guess error:', err);
            await safeSendText(sock, sender, '❌ An error occurred.' );
        }
    },
    
    // 8. Riddlehint - hint for active riddle
    async riddlehint(sock, sender) {
        try {
            if (!(await areGamesEnabled(sock, sender))) return;
            
            if (!global.riddles || !global.riddles.has(sender)) {
                await safeSendText(sock, sender, '❌ No active riddle found. Start a new riddle with *!riddle*' 
                );
                return;
            }
            
            const riddle = global.riddles.get(sender);
            const answer = riddle.answer;
            
            // Create hint by revealing random characters
            let hint = '';
            for (let i = 0; i < answer.length; i++) {
                if (answer[i] === ' ') {
                    hint += ' ';
                } else if (Math.random() < 0.3) {
                    hint += answer[i];
                } else {
                    hint += '_ ';
                }
            }
            
            await safeSendMessage(sock, sender, { 
                text: `🔍 Hint: ${hint}` 
            });
        } catch (err) {
            logger.error('Riddle hint error:', err);
            await safeSendText(sock, sender, '❌ An error occurred.' );
        }
    },
    
    // 9. Word Scramble
    async scramble(sock, sender) {
        try {
            if (!(await areGamesEnabled(sock, sender))) return;
            
            if (!global.wordScramble) global.wordScramble = new Map();
            
            // Clear any existing game
            global.wordScramble.delete(sender);
            
            const words = [
                "apple", "banana", "chocolate", "diamond", "elephant", 
                "giraffe", "hospital", "internet", "knowledge", "library"
            ];
            
            const randomWord = words[Math.floor(Math.random() * words.length)];
            
            // Scramble the word
            const scrambled = randomWord.split('').sort(() => 0.5 - Math.random()).join('');
            
            // Store the original word
            global.wordScramble.set(sender, randomWord);
            
            await safeSendMessage(sock, sender, { 
                text: `🔤 Unscramble this word: *${scrambled}*\n\nGuess using *!unscramble [your guess]*` 
            });
        } catch (err) {
            logger.error('Word scramble error:', err);
            await safeSendText(sock, sender, '❌ An error occurred.' );
        }
    },
    
    // 10. Unscramble - companion command for Word Scramble
    async unscramble(sock, sender, args) {
        try {
            if (!(await areGamesEnabled(sock, sender))) return;
            
            if (!global.wordScramble || !global.wordScramble.has(sender)) {
                await safeSendText(sock, sender, '❌ No active word scramble found. Start a new game with *!scramble*' 
                );
                return;
            }
            
            if (!args.length) {
                await safeSendText(sock, sender, '❓ Please provide your guess!' 
                );
                return;
            }
            
            const word = global.wordScramble.get(sender);
            const guess = args[0].toLowerCase().trim();
            
            if (guess === word) {
                await safeSendText(sock, sender, '🎉 Correct! You unscrambled the word!\n\nPlay again with *!scramble*' 
                );
                global.wordScramble.delete(sender);
            } else {
                await safeSendText(sock, sender, '❌ Incorrect! Try again or use *!scramblehint* for a hint.' 
                );
            }
        } catch (err) {
            logger.error('Unscramble error:', err);
            await safeSendText(sock, sender, '❌ An error occurred.' );
        }
    },
    
    // 11. Scramblehint - hint for active word scramble
    async scramblehint(sock, sender) {
        try {
            if (!(await areGamesEnabled(sock, sender))) return;
            
            if (!global.wordScramble || !global.wordScramble.has(sender)) {
                await safeSendText(sock, sender, '❌ No active word scramble found. Start a new game with *!scramble*' 
                );
                return;
            }
            
            const word = global.wordScramble.get(sender);
            
            // Reveal the first and last letter
            const hint = word[0] + '...' + word[word.length - 1];
            
            await safeSendMessage(sock, sender, { 
                text: `🔍 Hint: The word starts with "${word[0]}" and ends with "${word[word.length - 1]}"` 
            });
        } catch (err) {
            logger.error('Scramble hint error:', err);
            await safeSendText(sock, sender, '❌ An error occurred.' );
        }
    },
    
    // 12. Akinator-like game
    async akinator(sock, sender, args) {
        try {
            if (!(await areGamesEnabled(sock, sender))) return;
            
            if (!global.akinator) global.akinator = new Map();
            
            const gameId = sender;
            let game = global.akinator.get(gameId);
            
            // Reset or start game
            if (!game || args[0]?.toLowerCase() === 'restart') {
                game = {
                    step: 0,
                    character: '',
                    questions: [
                        "Is your character real (yes/no)?",
                        "Is your character female (yes/no)?",
                        "Is your character known for movies or TV (yes/no)?",
                        "Is your character a musician (yes/no)?",
                        "Is your character from a cartoon or anime (yes/no)?",
                        "Is your character a historical figure (yes/no)?",
                        "Is your character still alive (yes/no)?",
                        "Is your character a political figure (yes/no)?",
                        "Is your character associated with sports (yes/no)?",
                        "Is your character from America (yes/no)?"
                    ],
                    answers: []
                };
                
                global.akinator.set(gameId, game);
                
                await safeSendMessage(sock, sender, {
                    text: `🔮 *Akinator Game*\n\nThink of a character, and I'll try to guess who it is!\n\nQuestion 1: ${game.questions[0]}\n\nReply with *!akinator yes* or *!akinator no*`
                });
                return;
            }
            
            const answer = args[0]?.toLowerCase();
            
            if (answer !== 'yes' && answer !== 'no') {
                await safeSendText(sock, sender, '❓ Please answer with *!akinator yes* or *!akinator no*.' 
                );
                return;
            }
            
            // Store the answer
            game.answers.push(answer);
            game.step++;
            
            // Simple guessing logic (very simplified version of real Akinator)
            if (game.step >= 5) {
                // Make a guess based on the pattern of answers
                const answerPattern = game.answers.join('');
                
                let guess = "I'm not sure who your character is.";
                
                // Very simplified guessing logic with a few examples
                if (answerPattern.startsWith('yesno')) {
                    guess = "Is it Marilyn Monroe?";
                } else if (answerPattern.startsWith('yesyes')) {
                    guess = "Is it Jennifer Lawrence?";
                } else if (answerPattern.startsWith('noyes')) {
                    guess = "Is it Wonder Woman?";
                } else if (answerPattern.startsWith('nono')) {
                    guess = "Is it Mario from Super Mario Bros?";
                }
                
                await safeSendMessage(sock, sender, {
                    text: `🔮 Based on your answers, I think...\n\n${guess}\n\nWas I right? Play again with *!akinator restart*!`
                });
                
                // End the game
                global.akinator.delete(gameId);
            } else {
                // Ask the next question
                await safeSendMessage(sock, sender, {
                    text: `Question ${game.step + 1}: ${game.questions[game.step]}\n\nReply with *!akinator yes* or *!akinator no*`
                });
                
                // Update game state
                global.akinator.set(gameId, game);
            }
        } catch (err) {
            logger.error('Akinator error:', err);
            await safeSendText(sock, sender, '❌ An error occurred during the game.' );
            global.akinator.delete(sender);
        }
    },
    
    // 13. Number Guessing Game
    async numbergame(sock, sender, args) {
        try {
            if (!(await areGamesEnabled(sock, sender))) return;
            
            if (!global.numberGames) global.numberGames = new Map();
            
            const gameId = sender;
            let game = global.numberGames.get(gameId);
            
            if (!game) {
                // Start a new game
                const max = 100;
                game = {
                    number: Math.floor(Math.random() * max) + 1,
                    attempts: 0,
                    maxAttempts: 10
                };
                
                global.numberGames.set(gameId, game);
                
                await safeSendMessage(sock, sender, {
                    text: `🔢 Number Guessing Game\n\nI'm thinking of a number between 1 and ${max}.\nYou have ${game.maxAttempts} attempts to guess it!\n\nMake a guess using *!numbergame [number]*`
                });
                return;
            }
            
            // Process a guess
            const guess = parseInt(args[0]);
            if (isNaN(guess)) {
                await safeSendText(sock, sender, '❌ Please enter a valid number.' );
                return;
            }
            
            game.attempts++;
            
            if (guess === game.number) {
                await safeSendMessage(sock, sender, {
                    text: `🎉 Correct! The number was ${game.number}.\nYou guessed it in ${game.attempts} attempts!\n\nPlay again with *!numbergame*`
                });
                global.numberGames.delete(gameId);
            } else if (game.attempts >= game.maxAttempts) {
                await safeSendMessage(sock, sender, {
                    text: `😢 Game Over! You've used all ${game.maxAttempts} attempts.\nThe number was ${game.number}.\n\nTry again with *!numbergame*`
                });
                global.numberGames.delete(gameId);
            } else {
                const hint = guess < game.number ? 'higher' : 'lower';
                await safeSendMessage(sock, sender, {
                    text: `❌ Wrong! The number is ${hint} than ${guess}.\nAttempts: ${game.attempts}/${game.maxAttempts}`
                });
                global.numberGames.set(gameId, game);
            }
        } catch (err) {
            logger.error('Number game error:', err);
            await safeSendText(sock, sender, '❌ An error occurred during the game.' );
            global.numberGames.delete(sender);
        }
    },
    
    // 14. Coin flip with emoji
    async coinflip(sock, sender) {
        try {
            const result = Math.random() < 0.5 ? 'heads' : 'tails';
            const emoji = result === 'heads' ? '🪙' : '💰';
            
            await safeSendMessage(sock, sender, { 
                text: `${emoji} Coin flip result: *${result.toUpperCase()}*!` 
            });
        } catch (err) {
            logger.error('Coin flip error:', err);
            await safeSendText(sock, sender, '❌ An error occurred.' );
        }
    },
    
    // 15. Dice roll
    async diceroll(sock, sender, args) {
        try {
            // Parse number of dice to roll
            const count = Math.min(4, Math.max(1, parseInt(args[0]) || 1));
            
            const results = [];
            for (let i = 0; i < count; i++) {
                results.push(Math.floor(Math.random() * 6) + 1);
            }
            
            // Calculate total
            const total = results.reduce((sum, val) => sum + val, 0);
            
            const diceEmojis = {
                1: '⚀',
                2: '⚁',
                3: '⚂',
                4: '⚃',
                5: '⚄',
                6: '⚅'
            };
            
            const diceDisplay = results.map(r => diceEmojis[r]).join(' ');
            
            await safeSendMessage(sock, sender, {
                text: `🎲 Dice roll: ${diceDisplay}\nValues: ${results.join(', ')}\nTotal: ${total}`
            });
        } catch (err) {
            logger.error('Dice roll error:', err);
            const result = Math.floor(Math.random() * 6) + 1;
            await safeSendMessage(sock, sender, { text: `❌ An error occurred. Dice roll: ${result}` });
        }
    },
    
    // 16. Crack the code (mastermind-like game)
    async crackthecode(sock, sender, args) {
        try {
            if (!(await areGamesEnabled(sock, sender))) return;
            
            if (!global.codeGames) global.codeGames = new Map();
            
            const gameId = sender;
            let game = global.codeGames.get(gameId);
            
            if (!game || args[0]?.toLowerCase() === 'restart') {
                // Start a new game
                game = {
                    code: Array.from({length: 4}, () => Math.floor(Math.random() * 6) + 1),
                    attempts: 0,
                    maxAttempts: 10,
                    guesses: []
                };
                
                global.codeGames.set(gameId, game);
                
                await safeSendMessage(sock, sender, {
                    text: `🔐 Crack the Code\n\nI've created a 4-digit code with numbers from 1-6.\nYou have ${game.maxAttempts} attempts to guess it!\n\nMake a guess using *!crackthecode 1234* (four digits from 1-6)\n\n🟢 = correct number in correct position\n🟡 = correct number in wrong position\n⚪ = number not in the code`
                });
                return;
            }
            
            // Process a guess
            const guess = args[0];
            
            if (!guess || !/^[1-6]{4}$/.test(guess)) {
                await safeSendText(sock, sender, '❌ Please enter a valid 4-digit code using only numbers 1-6.' 
                );
                return;
            }
            
            const guessArray = guess.split('').map(Number);
            game.attempts++;
            
            // Evaluate guess
            const feedback = [];
            const codeCopy = [...game.code];
            const guessCopy = [...guessArray];
            
            // Check for correct numbers in correct positions
            for (let i = 0; i < 4; i++) {
                if (guessArray[i] === game.code[i]) {
                    feedback.push('🟢');
                    codeCopy[i] = null;
                    guessCopy[i] = null;
                }
            }
            
            // Check for correct numbers in wrong positions
            for (let i = 0; i < 4; i++) {
                if (guessCopy[i] !== null) {
                    const idx = codeCopy.indexOf(guessCopy[i]);
                    if (idx !== -1) {
                        feedback.push('🟡');
                        codeCopy[idx] = null;
                    } else {
                        feedback.push('⚪');
                    }
                }
            }
            
            // Shuffle feedback to not give away positions
            feedback.sort((a, b) => {
                const order = {'🟢': 0, '🟡': 1, '⚪': 2};
                return order[a] - order[b];
            });
            
            // Store guess and feedback
            game.guesses.push({
                guess,
                feedback: feedback.join('')
            });
            
            // Check if they won
            if (feedback.filter(f => f === '🟢').length === 4) {
                await safeSendMessage(sock, sender, {
                    text: `🎉 You cracked the code! It was ${game.code.join('')}.\nYou guessed it in ${game.attempts} attempts!\n\nPlay again with *!crackthecode restart*`
                });
                global.codeGames.delete(gameId);
                return;
            }
            
            // Check if game over
            if (game.attempts >= game.maxAttempts) {
                await safeSendMessage(sock, sender, {
                    text: `😢 Game Over! You've used all ${game.maxAttempts} attempts.\nThe code was ${game.code.join('')}.\n\nTry again with *!crackthecode restart*`
                });
                global.codeGames.delete(gameId);
                return;
            }
            
            // Show game state
            let message = `Attempt ${game.attempts}/${game.maxAttempts}:\n`;
            
            for (const {guess, feedback} of game.guesses) {
                message += `\n${guess} - ${feedback}`;
            }
            
            message += `\n\nYou have ${game.maxAttempts - game.attempts} attempts left.`;
            
            await safeSendText(sock, sender, message );
            global.codeGames.set(gameId, game);
        } catch (err) {
            logger.error('Crack the code error:', err);
            await safeSendText(sock, sender, '❌ An error occurred during the game.' );
            global.codeGames.delete(sender);
        }
    },
    
    // 17. Rock Paper Scissors Lizard Spock
    async rpsls(sock, sender, args) {
        try {
            if (!(await areGamesEnabled(sock, sender))) return;
            
            const choices = ['rock', 'paper', 'scissors', 'lizard', 'spock'];
            const emojis = {
                'rock': '🪨',
                'paper': '📄',
                'scissors': '✂️',
                'lizard': '🦎',
                'spock': '🖖'
            };
            
            const rules = {
                'rock': ['scissors', 'lizard'],
                'paper': ['rock', 'spock'],
                'scissors': ['paper', 'lizard'],
                'lizard': ['paper', 'spock'],
                'spock': ['rock', 'scissors']
            };
            
            const explanations = {
                'rock': { 'scissors': 'Rock crushes Scissors', 'lizard': 'Rock crushes Lizard' },
                'paper': { 'rock': 'Paper covers Rock', 'spock': 'Paper disproves Spock' },
                'scissors': { 'paper': 'Scissors cut Paper', 'lizard': 'Scissors decapitate Lizard' },
                'lizard': { 'paper': 'Lizard eats Paper', 'spock': 'Lizard poisons Spock' },
                'spock': { 'rock': 'Spock vaporizes Rock', 'scissors': 'Spock smashes Scissors' }
            };
            
            if (!args.length) {
                let message = '🎮 Rock Paper Scissors Lizard Spock\n\n';
                message += 'Choose one of the following:\n\n';
                
                for (const choice of choices) {
                    message += `${emojis[choice]} *!rpsls ${choice}*\n`;
                }
                
                message += '\nRules:\n';
                message += '- Rock crushes Scissors and Lizard\n';
                message += '- Paper covers Rock and disproves Spock\n';
                message += '- Scissors cut Paper and decapitate Lizard\n';
                message += '- Lizard eats Paper and poisons Spock\n';
                message += '- Spock vaporizes Rock and smashes Scissors';
                
                await safeSendText(sock, sender, message );
                return;
            }
            
            const playerChoice = args[0].toLowerCase();
            
            if (!choices.includes(playerChoice)) {
                await safeSendText(sock, sender, '❌ Invalid choice! Please choose rock, paper, scissors, lizard, or spock.' 
                );
                return;
            }
            
            const botChoice = choices[Math.floor(Math.random() * choices.length)];
            
            let result;
            let explanation = '';
            
            if (playerChoice === botChoice) {
                result = "It's a tie!";
            } else if (rules[playerChoice].includes(botChoice)) {
                result = "You win!";
                explanation = explanations[playerChoice][botChoice];
            } else {
                result = "I win!";
                explanation = explanations[botChoice][playerChoice];
            }
            
            const message = `🎮 Rock Paper Scissors Lizard Spock\n\n` +
                            `You chose: ${emojis[playerChoice]} ${playerChoice}\n` +
                            `I chose: ${emojis[botChoice]} ${botChoice}\n\n` +
                            `${result}${explanation ? ' ' + explanation : ''}`;
            
            await safeSendText(sock, sender, message );
        } catch (err) {
            logger.error('RPSLS error:', err);
            await safeSendText(sock, sender, '❌ An error occurred during the game.' );
        }
    },
    
    // 18. This or That
    async thisorthat(sock, sender) {
        try {
            const pairs = [
                "Coffee or Tea?",
                "Beach or Mountains?",
                "Summer or Winter?",
                "Books or Movies?",
                "Morning or Night?",
                "Dogs or Cats?",
                "Sweet or Savory?",
                "City or Countryside?",
                "Call or Text?",
                "Pizza or Burger?"
            ];
            
            const randomPair = pairs[Math.floor(Math.random() * pairs.length)];
            
            await safeSendMessage(sock, sender, { 
                text: `🤔 This or That:\n\n${randomPair}\n\nWhat's your choice?` 
            });
        } catch (err) {
            logger.error('This or That error:', err);
            await safeSendText(sock, sender, '❌ An error occurred.' );
        }
    },
    
    // 19. Dare
    async dare(sock, sender) {
        try {
            const dares = [
                "Send the most recent photo in your gallery",
                "Text a friend with just the 🐢 emoji and nothing else",
                "Send a voice message singing the chorus of your favorite song",
                "Change your profile picture to a cartoon character for 24 hours",
                "Send a screenshot of your most recent call log",
                "Text your best friend and tell them you have a secret to share",
                "Send a selfie with a funny face",
                "Write a short poem about the last thing you ate",
                "Call someone on your contact list and say 'meow' 3 times, then hang up",
                "Tell a joke in a voice message with your best accent"
            ];
            
            const randomDare = dares[Math.floor(Math.random() * dares.length)];
            
            await safeSendMessage(sock, sender, { 
                text: `🎲 Dare:\n\n${randomDare}` 
            });
        } catch (err) {
            logger.error('Dare error:', err);
            await safeSendText(sock, sender, '❌ An error occurred.' );
        }
    },
    
    // 20. Truth
    async truth(sock, sender) {
        try {
            const truths = [
                "What's your biggest fear?",
                "What's the most embarrassing thing you've ever done?",
                "What's a secret you've never told anyone?",
                "What's your worst habit?",
                "What's the weirdest dream you've ever had?",
                "What's something you wish more people knew about you?",
                "What's your biggest regret?",
                "Who's your celebrity crush?",
                "What's the most childish thing you still do?",
                "What's the most embarrassing music you listen to?"
            ];
            
            const randomTruth = truths[Math.floor(Math.random() * truths.length)];
            
            await safeSendMessage(sock, sender, { 
                text: `🎲 Truth:\n\n${randomTruth}` 
            });
        } catch (err) {
            logger.error('Truth error:', err);
            await safeSendText(sock, sender, '❌ An error occurred.' );
        }
    },
    
    // 21. Pickup Line
    async pickupline(sock, sender) {
        try {
            const lines = [
                "Are you a magician? Because whenever I look at you, everyone else disappears.",
                "Do you have a map? I just got lost in your eyes.",
                "I'm not a photographer, but I can picture us together.",
                "Do you like raisins? How do you feel about a date?",
                "If you were a vegetable, you'd be a cute-cumber.",
                "Are you made of copper and tellurium? Because you're Cu-Te.",
                "Is your name Google? Because you have everything I've been searching for.",
                "Are you a bank loan? Because you have my interest.",
                "Are you a time traveler? Because I see you in my future.",
                "I must be a snowflake, because I've fallen for you."
            ];
            
            const randomLine = lines[Math.floor(Math.random() * lines.length)];
            
            await safeSendMessage(sock, sender, { 
                text: `💘 Pickup Line:\n\n${randomLine}` 
            });
        } catch (err) {
            logger.error('Pickup Line error:', err);
            await safeSendText(sock, sender, '❌ An error occurred.' );
        }
    },
    
    // 22. Dad Joke
    async dadjoke(sock, sender) {
        try {
            const jokes = [
                "I'm afraid for the calendar. Its days are numbered.",
                "Why don't eggs tell jokes? They'd crack each other up.",
                "I don't trust stairs. They're always up to something.",
                "What do you call someone with no body and no nose? Nobody knows.",
                "Did you hear about the mathematician who's afraid of negative numbers? He'll stop at nothing to avoid them.",
                "Why couldn't the bicycle stand up by itself? It was two tired.",
                "How do you make a tissue dance? You put a little boogie in it.",
                "Why did the scarecrow win an award? Because he was outstanding in his field.",
                "I used to be a baker, but I couldn't make enough dough.",
                "I would avoid the sushi if I was you. It's a little fishy."
            ];
            
            const randomJoke = jokes[Math.floor(Math.random() * jokes.length)];
            
            await safeSendMessage(sock, sender, { 
                text: `👨 Dad Joke:\n\n${randomJoke}` 
            });
        } catch (err) {
            logger.error('Dad Joke error:', err);
            await safeSendText(sock, sender, '❌ An error occurred.' );
        }
    },
    
    // 23. Yo Mama Joke
    async yomama(sock, sender) {
        try {
            // Import the jidHelper utilities directly
            const { safeSendText, safeSendMessage } = require('../utils/jidHelper');
            const logger = require('../utils/logger');
            
            // Collection of yo mama jokes
            const jokes = [
                "Yo mama's so old, her birth certificate is in Roman numerals.",
                "Yo mama's so old, she sat next to Jesus in school.",
                "Yo mama's so tall, she tripped over in London and bumped her head in Paris.",
                "Yo mama's so small, she uses a cheerio as a hula hoop.",
                "Yo mama's so clever, she finished the puzzle box in 1 day when it said 2-4 years.",
                "Yo mama's so clumsy, she got tangled up in a cordless phone.",
                "Yo mama's so polite, she apologizes to Siri.",
                "Yo mama's so nice, even her shadow waves back.",
                "Yo mama's so generous, she gave away all her dad jokes.",
                "Yo mama's so cool, penguins ask her for advice.",
                "Yo mama's so kind, even telemarketers enjoy talking to her.",
                "Yo mama's so sweet, sugar asks for her autograph.",
                "Yo mama's so talented, she can play Mozart with a kazoo."
            ];
            
            // Select a random joke
            const randomJoke = jokes[Math.floor(Math.random() * jokes.length)];
            
            // Try to send with direct sock.sendMessage first for higher reliability
            try {
                await safeSendMessage(sock, sender, {
                    text: `😂 *Yo Mama Joke:*\n\n${randomJoke}`
                });
                logger.info('Yo Mama joke sent successfully with direct method');
                return;
            } catch (directErr) {
                logger.warn(`Direct message failed, trying safeSendText: ${directErr.message}`);
            }
            
            // Fallback to safeSendText
            await safeSendText(sock, sender, `😂 *Yo Mama Joke:*\n\n${randomJoke}`);
            logger.info('Yo Mama joke sent successfully with safeSendText');
            
        } catch (err) {
            logger.error('Yo Mama Joke error:', err);
            
            // Try one more fallback with minimal formatting
            try {
                await safeSendMessage(sock, sender, { text: `Joke: ${jokes[0]}` });
            } catch (finalErr) {
                logger.error(`Final fallback also failed: ${finalErr.message}`);
            }
        }
    },
    
    // 24. Compliment
    async compliment(sock, sender) {
        const { safeSendText } = require('../utils/jidHelper');
        
        try {
            const compliments = [
                "Your smile could light up even the darkest room.",
                "You have a great sense of humor that brightens everyone's day.",
                "Your kindness is like a warm blanket on a cold day.",
                "You have an incredible way of making people feel valued and heard.",
                "Your determination and perseverance are truly inspiring.",
                "You bring out the best in those around you.",
                "Your creativity and imagination know no bounds.",
                "You have a gift for seeing the good in every situation.",
                "Your positive energy is absolutely contagious.",
                "You're the type of friend everyone wishes they had."
            ];
            
            const randomCompliment = compliments[Math.floor(Math.random() * compliments.length)];
            
            // Use our enhanced safe send function
            await safeSendText(sock, sender, `✨ Compliment:\n\n${randomCompliment}`);
            
            logger.info('Compliment sent successfully');
        } catch (err) {
            logger.error('Compliment error:', err);
            // No need for fallback - the safeSendText already handles error cases
        }
    },
    
    // 25. Random Emoji Story
    async emojistory(sock, sender) {
        const { safeSendText } = require('../utils/jidHelper');
        
        try {
            const stories = [
                "🧙‍♂️✨🐉👑💎 - A wizard cast a spell on a dragon to protect the royal jewels.",
                "🚗💨🌧️🌉🏙️ - Driving through the rain across the bridge into the city.",
                "👩‍🍳🍕🔥😱💦 - The chef burned the pizza and had to put out the fire.",
                "🐶🦴🐱😾🙀 - The dog found a bone but the cat wasn't happy about it.",
                "👨‍💻📱🕹️🎮😴 - He worked on his phone and played games until he fell asleep.",
                "🏃‍♀️🌳🐻😱🏃‍♀️💨 - She was running in the forest when she saw a bear and ran away quickly.",
                "🧑‍🚀🚀🌕👽🤝 - The astronaut flew to the moon and made friends with an alien.",
                "🏊‍♂️🌊🦈😱🏄‍♂️ - The swimmer saw a shark and climbed onto a surfboard.",
                "👸💤🧙‍♀️🍎💋👨 - Sleeping Beauty, the witch, the poisoned apple, and the kiss.",
                "🐸👑💋👸💖 - The frog prince was kissed by the princess and fell in love."
            ];
            
            const randomStory = stories[Math.floor(Math.random() * stories.length)];
            
            await safeSendText(sock, sender, `📖 Emoji Story:\n\n${randomStory}`);
            logger.info('Emoji story sent successfully');
        } catch (err) {
            logger.error('Emoji Story error:', err);
            // No need for fallback - the safeSendText already handles error cases
        }
    },
    
    // 26. Trivia questions with multiple choice
    async quiztrivia(sock, sender, args) {
        try {
            if (!(await areGamesEnabled(sock, sender))) return;
            
            if (!global.triviaQuizzes) global.triviaQuizzes = new Map();
            
            const quizId = sender;
            let quiz = global.triviaQuizzes.get(quizId);
            
            if (!quiz) {
                // Questions with multiple choice answers
                const questions = [
                    {
                        question: "Which planet is known as the Red Planet?",
                        options: ["Venus", "Mars", "Jupiter", "Saturn"],
                        answer: "B"
                    },
                    {
                        question: "Which animal is known as the 'King of the Jungle'?",
                        options: ["Tiger", "Lion", "Elephant", "Gorilla"],
                        answer: "B"
                    },
                    {
                        question: "How many sides does a pentagon have?",
                        options: ["4", "5", "6", "7"],
                        answer: "B"
                    },
                    {
                        question: "What is the capital of Japan?",
                        options: ["Seoul", "Beijing", "Tokyo", "Bangkok"],
                        answer: "C"
                    },
                    {
                        question: "Which element has the chemical symbol 'O'?",
                        options: ["Gold", "Silver", "Oxygen", "Osmium"],
                        answer: "C"
                    }
                ];
                
                // Select a random question
                const questionIndex = Math.floor(Math.random() * questions.length);
                
                quiz = {
                    ...questions[questionIndex],
                    asked: Date.now()
                };
                
                global.triviaQuizzes.set(quizId, quiz);
                
                let message = `❓ Trivia Question:\n\n${quiz.question}\n\n`;
                quiz.options.forEach((option, index) => {
                    message += `${String.fromCharCode(65 + index)}) ${option}\n`;
                });
                
                message += "\nReply with *!quiztrivia [letter]* (e.g., !quiztrivia A)";
                
                await safeSendText(sock, sender, message );
                return;
            }
            
            // Process answer
            const answer = args[0]?.toUpperCase();
            
            if (!answer || !['A', 'B', 'C', 'D'].includes(answer)) {
                await safeSendText(sock, sender, '❓ Please answer with A, B, C, or D!' );
                return;
            }
            
            const isCorrect = answer === quiz.answer;
            const correctOption = quiz.options[quiz.answer.charCodeAt(0) - 65];
            
            if (isCorrect) {
                await safeSendMessage(sock, sender, { 
                    text: `✅ Correct! ${correctOption} is the right answer.\n\nTry another question with *!quiztrivia*` 
                });
            } else {
                await safeSendMessage(sock, sender, { 
                    text: `❌ Wrong! The correct answer is ${quiz.answer}: ${correctOption}.\n\nTry another question with *!quiztrivia*` 
                });
            }
            
            global.triviaQuizzes.delete(quizId);
        } catch (err) {
            logger.error('Quiz Trivia error:', err);
            await safeSendText(sock, sender, '❌ An error occurred.' );
            global.triviaQuizzes.delete(sender);
        }
    },
    
    // 27. Horoscope
    async horoscope(sock, sender, args) {
        try {
            const signs = [
                "aries", "taurus", "gemini", "cancer", 
                "leo", "virgo", "libra", "scorpio", 
                "sagittarius", "capricorn", "aquarius", "pisces"
            ];
            
            const sign = args[0]?.toLowerCase();
            
            if (!sign || !signs.includes(sign)) {
                let message = "♈ Please specify your zodiac sign:\n\n";
                signs.forEach(s => {
                    message += `*!horoscope ${s}*\n`;
                });
                await safeSendText(sock, sender, message );
                return;
            }
            
            const horoscopes = {
                "aries": "Today is a day for boldness and initiative. Take the lead in a project or relationship that matters to you. Your energy is high, so channel it into productive pursuits. Avoid impulsive decisions regarding finances.",
                "taurus": "Stability is highlighted today. Focus on building security in your work and home life. Your practical approach will be appreciated by others. Take time to enjoy simple pleasures and connect with nature.",
                "gemini": "Communication flows easily today. It's a great time for meetings, conversations, and sharing ideas. Your curiosity leads you to interesting discoveries. Balance social interaction with some quiet reflection time.",
                "cancer": "Emotional intelligence serves you well today. Trust your intuition, especially in family matters. Home improvements or changes will bring satisfaction. Practice self-care and set healthy boundaries.",
                "leo": "Your creative energy shines today. Express yourself through art or leadership. Romance may blossom or deepen. Be generous but avoid excessive spending to impress others. Your natural charisma attracts positive attention.",
                "virgo": "Details matter today. Your analytical skills help solve a persistent problem. Health routines established now will have lasting benefits. Don't be too critical of yourself or others - celebrate progress.",
                "libra": "Harmony in relationships is highlighted today. Diplomatic approaches to conflict will succeed. Aesthetic pursuits bring joy - redecorate or update your wardrobe. Balance socializing with personal time.",
                "scorpio": "Today brings opportunities for meaningful transformation. Research and investigation yield valuable insights. Financial matters require your attention and strategic thinking. Trust selectively and protect your energy.",
                "sagittarius": "Adventure calls today. Explore new ideas, places, or philosophies. Teaching and learning bring fulfillment. Avoid overpromising - be honest about what you can deliver. Optimism attracts favorable circumstances.",
                "capricorn": "Professional progress is likely today. Your disciplined approach earns recognition. Long-term planning pays off - stay the course. Make time for family despite work demands. Traditions bring comfort.",
                "aquarius": "Innovation is your strength today. Unconventional solutions to problems will succeed. Connect with groups and communities that share your ideals. Technology upgrades improve efficiency. Balance intellectualism with emotional awareness.",
                "pisces": "Intuition and imagination are powerful today. Creative and spiritual pursuits bring fulfillment. Help someone in need, but maintain healthy boundaries. Dreams contain important messages. Seek beauty in everyday moments."
            };
            
            const emoji = {
                "aries": "♈",
                "taurus": "♉",
                "gemini": "♊",
                "cancer": "♋",
                "leo": "♌",
                "virgo": "♍",
                "libra": "♎",
                "scorpio": "♏",
                "sagittarius": "♐",
                "capricorn": "♑",
                "aquarius": "♒",
                "pisces": "♓"
            };
            
            const capitalizedSign = sign.charAt(0).toUpperCase() + sign.slice(1);
            
            await safeSendMessage(sock, sender, { 
                text: `${emoji[sign]} Horoscope for ${capitalizedSign}:\n\n${horoscopes[sign]}` 
            });
        } catch (err) {
            logger.error('Horoscope error:', err);
            await safeSendText(sock, sender, '❌ An error occurred.' );
        }
    },
    
    // 28. Fortune Teller
    async predict(sock, sender, args) {
        try {
            if (!args.length) {
                await safeSendText(sock, sender, '🔮 Ask me a yes/no question, and I shall reveal your destiny!' 
                );
                return;
            }
            
            const responses = [
                "It is certain.",
                "It is decidedly so.",
                "Without a doubt.",
                "Yes, definitely.",
                "You may rely on it.",
                "As I see it, yes.",
                "Most likely.",
                "Outlook good.",
                "Signs point to yes.",
                "Reply hazy, try again.",
                "Ask again later.",
                "Better not tell you now.",
                "Cannot predict now.",
                "Concentrate and ask again.",
                "Don't count on it.",
                "My reply is no.",
                "My sources say no.",
                "Outlook not so good.",
                "Very doubtful.",
                "The stars are not aligned for this."
            ];
            
            // Use a hash of the question to make predictions consistent for the same question
            const hash = crypto.createHash('md5').update(args.join(' ')).digest('hex');
            const hashValue = parseInt(hash.substring(0, 8), 16);
            const responseIndex = hashValue % responses.length;
            
            const randomResponse = responses[responseIndex];
            
            await safeSendMessage(sock, sender, { 
                text: `🔮 *The Fortune Teller says:*\n\n"${randomResponse}"` 
            });
        } catch (err) {
            logger.error('Predict error:', err);
            await safeSendText(sock, sender, '❌ An error occurred.' );
        }
    },
    
    // 29. Love Calculator
    async lovecalc(sock, sender, args) {
        try {
            if (args.length < 2) {
                await safeSendText(sock, sender, '❤️ Love Calculator\n\nPlease provide two names to calculate compatibility!\nUsage: *!lovecalc [name1] [name2]*' 
                );
                return;
            }
            
            const name1 = args[0].toLowerCase();
            const name2 = args[1].toLowerCase();
            
            // Use a hash of the names to make the score consistent for the same pair
            const combinedNames = name1 + name2;
            const hash = crypto.createHash('md5').update(combinedNames).digest('hex');
            const hashValue = parseInt(hash.substring(0, 8), 16);
            const score = hashValue % 101; // 0-100
            
            let message = `❤️ Love Calculator\n\n${args[0]} + ${args[1]} = ${score}%\n\n`;
            
            if (score < 20) {
                message += "Not much chemistry here. Maybe you're better as friends?";
            } else if (score < 40) {
                message += "There's some potential, but you'll need to work at it.";
            } else if (score < 60) {
                message += "There's a decent connection. Worth exploring further!";
            } else if (score < 80) {
                message += "Great compatibility! You have a strong foundation for love.";
            } else {
                message += "Incredible match! The stars have aligned for this relationship.";
            }
            
            await safeSendText(sock, sender, message );
        } catch (err) {
            logger.error('Love Calculator error:', err);
            await safeSendText(sock, sender, '❌ An error occurred.' );
        }
    },
    
    // 30. Random Character Generator
    async character(sock, sender) {
        try {
            const races = ["Human", "Elf", "Dwarf", "Orc", "Halfling", "Gnome", "Tiefling", "Dragonborn"];
            const classes = ["Warrior", "Mage", "Rogue", "Cleric", "Bard", "Ranger", "Paladin", "Warlock"];
            const backgrounds = ["Noble", "Sailor", "Criminal", "Soldier", "Hermit", "Acolyte", "Merchant", "Orphan"];
            const traits = ["Brave", "Cautious", "Curious", "Honorable", "Reckless", "Secretive", "Loyal", "Ambitious"];
            const flaws = ["Greedy", "Arrogant", "Paranoid", "Impulsive", "Vengeful", "Cowardly", "Envious", "Stubborn"];
            
            const race = races[Math.floor(Math.random() * races.length)];
            const characterClass = classes[Math.floor(Math.random() * classes.length)];
            const background = backgrounds[Math.floor(Math.random() * backgrounds.length)];
            const trait = traits[Math.floor(Math.random() * traits.length)];
            const flaw = flaws[Math.floor(Math.random() * flaws.length)];
            
            const strength = Math.floor(Math.random() * 10) + 8;
            const dexterity = Math.floor(Math.random() * 10) + 8;
            const constitution = Math.floor(Math.random() * 10) + 8;
            const intelligence = Math.floor(Math.random() * 10) + 8;
            const wisdom = Math.floor(Math.random() * 10) + 8;
            const charisma = Math.floor(Math.random() * 10) + 8;
            
            const message = `🎭 Random Character Generated:\n\n` +
                            `*Race:* ${race}\n` +
                            `*Class:* ${characterClass}\n` +
                            `*Background:* ${background}\n\n` +
                            `*Personality Trait:* ${trait}\n` +
                            `*Flaw:* ${flaw}\n\n` +
                            `*Stats:*\n` +
                            `Strength: ${strength}\n` +
                            `Dexterity: ${dexterity}\n` +
                            `Constitution: ${constitution}\n` +
                            `Intelligence: ${intelligence}\n` +
                            `Wisdom: ${wisdom}\n` +
                            `Charisma: ${charisma}\n\n` +
                            `Use this character for your next game!`;
            
            await safeSendText(sock, sender, message );
        } catch (err) {
            logger.error('Character Generator error:', err);
            await safeSendText(sock, sender, '❌ An error occurred.' );
        }
    },
    
    // 31. Roast (gentle humor)
    async roast(sock, sender) {
        try {
            const roasts = [
                "Your fashion sense is so unique, you could probably make a trash bag look like it came from the thrift store.",
                "You're so slow that internet explorer is embarrassed for you.",
                "Your cooking is so bad, even the fire alarm cheers you on when you leave the kitchen.",
                "You're the human version of a participation trophy.",
                "You have the focusing ability of a goldfish with ADHD.",
                "Your playlist is so bad, Spotify sends you apology emails.",
                "You dance like you're trying to fight off a swarm of invisible bees.",
                "Your jokes are so dry, they make the Sahara look like a water park.",
                "If procrastination was an Olympic sport, you'd compete later.",
                "Your room is so messy, even your dust bunnies have dust bunnies."
            ];
            
            const randomRoast = roasts[Math.floor(Math.random() * roasts.length)];
            
            await safeSendMessage(sock, sender, { 
                text: `🔥 Friendly Roast:\n\n${randomRoast}\n\n(All in good fun, of course!)` 
            });
        } catch (err) {
            logger.error('Roast error:', err);
            await safeSendText(sock, sender, '❌ An error occurred.' );
        }
    },
    
    // 32. Find Missing Number game
    async findnumber(sock, sender, args) {
        try {
            if (!(await areGamesEnabled(sock, sender))) return;
            
            if (!global.numberSequenceGames) global.numberSequenceGames = new Map();
            
            const gameId = sender;
            let game = global.numberSequenceGames.get(gameId);
            
            if (!game) {
                // Start a new game
                const sequences = [
                    {
                        pattern: [2, 4, 6, 8, 10, '?', 14],
                        answer: 12,
                        rule: "Add 2 to each number"
                    },
                    {
                        pattern: [1, 2, 4, 8, 16, '?', 64],
                        answer: 32,
                        rule: "Multiply by 2"
                    },
                    {
                        pattern: [3, 6, 9, 12, '?', 18],
                        answer: 15,
                        rule: "Add 3 to each number"
                    },
                    {
                        pattern: [1, 3, 6, 10, 15, '?'],
                        answer: 21,
                        rule: "Add increasing numbers (1, 2, 3, 4, 5, 6)"
                    },
                    {
                        pattern: [2, 6, 12, 20, '?', 42],
                        answer: 30,
                        rule: "Add 4, then 6, then 8, etc."
                    }
                ];
                
                const randomSequence = sequences[Math.floor(Math.random() * sequences.length)];
                
                game = {
                    pattern: randomSequence.pattern,
                    answer: randomSequence.answer,
                    rule: randomSequence.rule,
                    attempts: 0,
                    maxAttempts: 3
                };
                
                global.numberSequenceGames.set(gameId, game);
                
                await safeSendMessage(sock, sender, {
                    text: `🔢 Find the Missing Number\n\nWhat number should replace the '?' in this sequence?\n\n${game.pattern.join(', ')}\n\nGuess using *!findnumber [number]*`
                });
                return;
            }
            
            // Process a guess
            const guess = parseInt(args[0]);
            if (isNaN(guess)) {
                await safeSendText(sock, sender, '❌ Please enter a valid number.' );
                return;
            }
            
            game.attempts++;
            
            if (guess === game.answer) {
                await safeSendMessage(sock, sender, {
                    text: `✅ Correct! ${guess} is the right answer.\n\nRule: ${game.rule}\n\nPlay again with *!findnumber*`
                });
                global.numberSequenceGames.delete(gameId);
            } else if (game.attempts >= game.maxAttempts) {
                await safeSendMessage(sock, sender, {
                    text: `❌ Wrong! You've used all ${game.maxAttempts} attempts.\nThe correct answer was ${game.answer}.\n\nRule: ${game.rule}\n\nTry again with *!findnumber*`
                });
                global.numberSequenceGames.delete(gameId);
            } else {
                await safeSendMessage(sock, sender, {
                    text: `❌ Wrong! Try again. Attempts: ${game.attempts}/${game.maxAttempts}`
                });
                global.numberSequenceGames.set(gameId, game);
            }
        } catch (err) {
            logger.error('Find Number error:', err);
            await safeSendText(sock, sender, '❌ An error occurred during the game.' );
            global.numberSequenceGames.delete(sender);
        }
    },
    
    // 33. Random Video Game Fact
    async gamefact(sock, sender) {
        try {
            const facts = [
                "The first commercially successful video game was Pong, released by Atari in 1972.",
                "Nintendo was founded in 1889 as a playing card company before eventually moving into video games.",
                "The PlayStation 2 is the best-selling video game console of all time, with over 155 million units sold.",
                "The term 'Easter Egg' in video games originated from the 1979 Atari game 'Adventure,' where developer Warren Robinett hid his name in a secret room.",
                "Minecraft is the best-selling video game of all time, having sold over 238 million copies across all platforms.",
                "The first video game 'Easter Egg' was in the 1979 Atari game 'Adventure'. When players found a hidden item, they could access a room with the creator's name.",
                "Mario was originally called 'Jumpman' in the 1981 arcade game Donkey Kong. His profession was also changed from carpenter to plumber when Mario Bros. was released.",
                "The highest-grossing video game of all time is not a console or PC game but the mobile game 'Honor of Kings' (also known as 'Arena of Valor').",
                "The Game Boy's processor was so energy-efficient that one model survived a bombing during the Gulf War and still worked perfectly, only needing new batteries.",
                "The term 'boss fight' originated from Big Boss in the game Final Fantasy, who was designed to be noticeably different from the normal enemies."
            ];
            
            const randomFact = facts[Math.floor(Math.random() * facts.length)];
            
            await safeSendMessage(sock, sender, { 
                text: `🎮 Video Game Fact:\n\n${randomFact}` 
            });
        } catch (err) {
            logger.error('Game Fact error:', err);
            await safeSendText(sock, sender, '❌ An error occurred.' );
        }
    },
    
    // 34. Hangman with Movie Titles
    async moviehangman(sock, sender, args) {
        try {
            if (!(await areGamesEnabled(sock, sender))) return;
            
            if (!global.movieHangmanGames) global.movieHangmanGames = new Map();
            
            const gameId = sender;
            let game = global.movieHangmanGames.get(gameId);
            
            if (!game) {
                // Start a new game with movie titles
                const movies = [
                    "THE GODFATHER",
                    "STAR WARS",
                    "PULP FICTION",
                    "THE MATRIX",
                    "FORREST GUMP",
                    "THE DARK KNIGHT",
                    "FIGHT CLUB",
                    "INCEPTION",
                    "JURASSIC PARK",
                    "AVATAR",
                    "TITANIC",
                    "THE LION KING",
                    "INTERSTELLAR",
                    "THE AVENGERS",
                    "BACK TO THE FUTURE"
                ];
                
                const randomMovie = movies[Math.floor(Math.random() * movies.length)];
                
                game = {
                    word: randomMovie,
                    guessedLetters: [],
                    maxWrongGuesses: 6
                };
                
                global.movieHangmanGames.set(gameId, game);
                
                const hangmanDisplay = getHangmanDisplay(game);
                await safeSendMessage(sock, sender, {
                    text: `🎬 Movie Hangman\n${hangmanDisplay}\n\nGuess a letter using *!moviehangman [letter]*`
                });
                return;
            }
            
            // Process a guess
            const guess = args[0]?.toUpperCase();
            if (!guess || guess.length !== 1 || !guess.match(/[A-Z]/)) {
                await safeSendText(sock, sender, '❌ Please guess a single letter (A-Z).' );
                return;
            }
            
            if (game.guessedLetters.includes(guess)) {
                await safeSendText(sock, sender, '❌ You already guessed that letter!' );
                return;
            }
            
            game.guessedLetters.push(guess);
            global.movieHangmanGames.set(gameId, game);
            
            const wrongGuesses = game.guessedLetters.filter(letter => !game.word.includes(letter));
            const displayWord = game.word.split('').map(letter => 
                letter === ' ' ? ' ' : (game.guessedLetters.includes(letter) ? letter : '_')
            ).join(' ');
            
            const isWon = game.word.split('').every(letter => letter === ' ' || game.guessedLetters.includes(letter));
            const isLost = wrongGuesses.length >= game.maxWrongGuesses;
            
            const hangmanDisplay = getHangmanDisplay(game);
            
            if (isWon) {
                await safeSendMessage(sock, sender, {
                    text: `${hangmanDisplay}\n\n🎉 You win! The movie was: ${game.word}\n\nPlay again with *!moviehangman*`
                });
                global.movieHangmanGames.delete(gameId);
            } else if (isLost) {
                await safeSendMessage(sock, sender, {
                    text: `${hangmanDisplay}\n\n💀 Game Over! The movie was: ${game.word}\n\nPlay again with *!moviehangman*`
                });
                global.movieHangmanGames.delete(gameId);
            } else {
                await safeSendMessage(sock, sender, {
                    text: `${hangmanDisplay}\n\nGuess another letter using *!moviehangman [letter]*`
                });
            }
        } catch (err) {
            logger.error('Movie Hangman error:', err);
            await safeSendText(sock, sender, '❌ An error occurred during the game.' );
            global.movieHangmanGames.delete(sender);
        }
    },
    
    // 35. Movie Quote Quiz
    async moviequiz(sock, sender) {
        try {
            if (!(await areGamesEnabled(sock, sender))) return;
            
            const quizzes = [
                {
                    quote: "I'll make him an offer he can't refuse.",
                    movie: "The Godfather"
                },
                {
                    quote: "May the Force be with you.",
                    movie: "Star Wars"
                },
                {
                    quote: "I'm the king of the world!",
                    movie: "Titanic"
                },
                {
                    quote: "There's no place like home.",
                    movie: "The Wizard of Oz"
                },
                {
                    quote: "Life is like a box of chocolates, you never know what you're gonna get.",
                    movie: "Forrest Gump"
                },
                {
                    quote: "I see dead people.",
                    movie: "The Sixth Sense"
                },
                {
                    quote: "Why so serious?",
                    movie: "The Dark Knight"
                },
                {
                    quote: "You're gonna need a bigger boat.",
                    movie: "Jaws"
                },
                {
                    quote: "Houston, we have a problem.",
                    movie: "Apollo 13"
                },
                {
                    quote: "To infinity and beyond!",
                    movie: "Toy Story"
                }
            ];
            
            const randomQuiz = quizzes[Math.floor(Math.random() * quizzes.length)];
            
            await safeSendMessage(sock, sender, {
                text: `🎬 Movie Quote Quiz\n\nGuess the movie from this famous quote:\n\n"${randomQuiz.quote}"\n\nSend your guess with *!movieanswer [movie name]*`
            });
            
            // Store the quiz in global state
            if (!global.movieQuizzes) global.movieQuizzes = new Map();
            global.movieQuizzes.set(sender, randomQuiz);
            
        } catch (err) {
            logger.error('Movie Quiz error:', err);
            await safeSendText(sock, sender, '❌ An error occurred.' );
        }
    },
    
    // 36. Movie Answer - companion for Movie Quiz
    async movieanswer(sock, sender, args) {
        try {
            if (!(await areGamesEnabled(sock, sender))) return;
            
            if (!global.movieQuizzes || !global.movieQuizzes.has(sender)) {
                await safeSendText(sock, sender, '❌ No active movie quiz found. Start a new quiz with *!moviequiz*' 
                );
                return;
            }
            
            if (!args.length) {
                await safeSendText(sock, sender, '❓ Please provide your guess!' 
                );
                return;
            }
            
            const quiz = global.movieQuizzes.get(sender);
            const guess = args.join(' ').toLowerCase().trim();
            const correctAnswer = quiz.movie.toLowerCase();
            
            // Allow for some flexibility in the answer
            if (guess === correctAnswer || correctAnswer.includes(guess) || guess.includes(correctAnswer)) {
                await safeSendMessage(sock, sender, { 
                    text: `🎉 Correct! "${quiz.quote}" is from the movie "${quiz.movie}"!\n\nTry another with *!moviequiz*` 
                });
                global.movieQuizzes.delete(sender);
            } else {
                await safeSendMessage(sock, sender, { 
                    text: `❌ Incorrect! The quote "${quiz.quote}" is from the movie "${quiz.movie}".\n\nTry another with *!moviequiz*` 
                });
                global.movieQuizzes.delete(sender);
            }
        } catch (err) {
            logger.error('Movie Answer error:', err);
            await safeSendText(sock, sender, '❌ An error occurred.' );
        }
    },
    
    // 37. Word Chain game
    async wordchain(sock, sender, args) {
        try {
            if (!(await areGamesEnabled(sock, sender))) return;
            
            if (!global.wordChainGames) global.wordChainGames = new Map();
            
            const gameId = sender;
            let game = global.wordChainGames.get(gameId);
            
            if (!game || args[0]?.toLowerCase() === 'restart') {
                const startWords = ['apple', 'beach', 'castle', 'dolphin', 'elephant', 'forest', 'galaxy', 'house'];
                
                game = {
                    lastWord: startWords[Math.floor(Math.random() * startWords.length)],
                    words: [],
                    score: 0
                };
                
                global.wordChainGames.set(gameId, game);
                
                await safeSendMessage(sock, sender, {
                    text: `🎮 Word Chain Game\n\nI'll start with: *${game.lastWord}*\n\nRespond with a word that starts with the last letter of my word using *!wordchain [word]*`
                });
                return;
            }
            
            // Process player word
            const word = args[0]?.toLowerCase();
            
            if (!word) {
                await safeSendText(sock, sender, '❓ Please provide a word!' );
                return;
            }
            
            // Word must start with the last letter of the previous word
            const lastLetter = game.lastWord[game.lastWord.length - 1];
            if (word[0] !== lastLetter) {
                await safeSendMessage(sock, sender, { 
                    text: `❌ Your word must start with the letter "${lastLetter.toUpperCase()}"!` 
                });
                return;
            }
            
            // Word must not have been used before
            if (game.words.includes(word) || game.lastWord === word) {
                await safeSendText(sock, sender, '❌ That word has already been used!' );
                return;
            }
            
            // Add player's word to the chain
            game.words.push(word);
            game.score++;
            
            // Bot's turn - find a word that starts with the last letter of player's word
            const lastPlayerLetter = word[word.length - 1];
            
            // Simple dictionary (in a real bot, this would be more extensive)
            const dictionary = {
                'a': ['apple', 'animal', 'anchor', 'astronaut', 'arrow', 'airplane'],
                'b': ['banana', 'book', 'bread', 'butterfly', 'beach', 'balloon'],
                'c': ['cat', 'car', 'cow', 'chocolate', 'castle', 'camera'],
                'd': ['dog', 'door', 'desk', 'diamond', 'dolphin', 'duck'],
                'e': ['elephant', 'egg', 'eagle', 'earth', 'emerald', 'envelope'],
                'f': ['fish', 'flower', 'fire', 'football', 'forest', 'feather'],
                'g': ['goat', 'game', 'glass', 'garden', 'galaxy', 'gold'],
                'h': ['house', 'hat', 'horse', 'heart', 'helicopter', 'honey'],
                'i': ['ice', 'island', 'insect', 'igloo', 'idea', 'iron'],
                'j': ['jacket', 'jar', 'jelly', 'jewelry', 'jungle', 'juice'],
                'k': ['kite', 'key', 'king', 'kangaroo', 'kitchen', 'knife'],
                'l': ['lamp', 'lion', 'leaf', 'lemon', 'ladder', 'lake'],
                'm': ['monkey', 'moon', 'music', 'mountain', 'mouse', 'map'],
                'n': ['nose', 'nail', 'night', 'nest', 'newspaper', 'neck'],
                'o': ['orange', 'ocean', 'oil', 'oven', 'ostrich', 'office'],
                'p': ['pen', 'paper', 'pizza', 'plant', 'penguin', 'present'],
                'q': ['queen', 'question', 'quilt', 'quartz', 'quarter', 'quiet'],
                'r': ['rabbit', 'rain', 'rock', 'rocket', 'rope', 'river'],
                's': ['sun', 'star', 'sand', 'shoe', 'snake', 'spoon'],
                't': ['table', 'tree', 'train', 'tiger', 'tooth', 'telephone'],
                'u': ['umbrella', 'unicorn', 'universe', 'uniform', 'uncle', 'under'],
                'v': ['violin', 'vase', 'volcano', 'video', 'vacation', 'voice'],
                'w': ['water', 'window', 'wolf', 'whale', 'wizard', 'wallet'],
                'x': ['xylophone', 'x-ray', 'xenon', 'xerox', 'xmas', 'xenophobia'],
                'y': ['yellow', 'year', 'yoyo', 'yacht', 'yogurt', 'yard'],
                'z': ['zebra', 'zero', 'zoo', 'zipper', 'zombie', 'zone']
            };
            
            let possibleWords = dictionary[lastPlayerLetter] || [];
            
            // Filter out words that have already been used
            possibleWords = possibleWords.filter(w => !game.words.includes(w) && w !== game.lastWord);
            
            // If no words available, player wins
            if (possibleWords.length === 0) {
                await safeSendMessage(sock, sender, {
                    text: `🎉 You win! I can't think of a word that starts with "${lastPlayerLetter.toUpperCase()}".\nYour final score: ${game.score}\n\nPlay again with *!wordchain restart*`
                });
                global.wordChainGames.delete(gameId);
                return;
            }
            
            // Bot chooses a word
            const botWord = possibleWords[Math.floor(Math.random() * possibleWords.length)];
            game.words.push(botWord);
            game.lastWord = botWord;
            
            await safeSendMessage(sock, sender, {
                text: `✅ "${word}" is valid!\nMy word: *${botWord}*\nYour score: ${game.score}\n\nRespond with a word that starts with "${botWord[botWord.length - 1].toUpperCase()}" using *!wordchain [word]*`
            });
            
            global.wordChainGames.set(gameId, game);
        } catch (err) {
            logger.error('Word Chain error:', err);
            await safeSendText(sock, sender, '❌ An error occurred during the game.' );
            global.wordChainGames.delete(sender);
        }
    },
    
    // 38. Personality Quiz
    async personalityquiz(sock, sender, args) {
        try {
            if (!global.personalityQuizzes) global.personalityQuizzes = new Map();
            
            const quizId = sender;
            let quiz = global.personalityQuizzes.get(quizId);
            
            if (!quiz) {
                // Start a new quiz
                quiz = {
                    questions: [
                        "Do you prefer spending time with many friends or a few close ones? (A: Many, B: Few)",
                        "Do you make decisions based on logic or feelings? (A: Logic, B: Feelings)",
                        "Are you more organized or spontaneous? (A: Organized, B: Spontaneous)",
                        "Do you prefer outdoor adventures or cozy indoor activities? (A: Outdoor, B: Indoor)",
                        "Are you an early bird or a night owl? (A: Early bird, B: Night owl)"
                    ],
                    personalities: {
                        'AAAAA': 'The Logical Leader: You\'re analytical, organized, and thrive in structured environments. You make decisions based on facts and take charge naturally.',
                        'AAAAB': 'The Strategic Thinker: You combine logical thinking with a preference for working late into the night on your plans and strategies.',
                        'BBBBBB': 'The Empathetic Dreamer: You\'re intuitive, creative, and deeply connected to your emotions and the feelings of others.',
                        'BABBA': 'The Social Butterfly: You love being around people and spontaneous adventures, while making decisions with your heart.',
                        'ABBBA': 'The Practical Idealist: You value close relationships but approach problems logically, with a preference for spontaneity and night-time creativity.'
                    },
                    currentQuestion: 0,
                    answers: []
                };
                
                global.personalityQuizzes.set(quizId, quiz);
                
                await safeSendMessage(sock, sender, {
                    text: `🧠 Personality Quiz\n\nQuestion 1: ${quiz.questions[0]}\n\nReply with *!personalityquiz A* or *!personalityquiz B*`
                });
                return;
            }
            
            // Process answer
            const answer = args[0]?.toUpperCase();
            
            if (answer !== 'A' && answer !== 'B') {
                await safeSendText(sock, sender, '❓ Please answer with A or B!' );
                return;
            }
            
            // Store answer
            quiz.answers.push(answer);
            quiz.currentQuestion++;
            
            // Check if quiz is complete
            if (quiz.currentQuestion >= quiz.questions.length) {
                // Determine personality type
                const personalityCode = quiz.answers.join('');
                
                // Find exact match or default to closest
                let personality = quiz.personalities[personalityCode] || 'The Balanced Individual: You have a mix of traits that make you adaptable to different situations and environments.';
                
                await safeSendMessage(sock, sender, {
                    text: `🧠 Personality Quiz Results\n\n${personality}\n\nTake the quiz again with *!personalityquiz*`
                });
                
                global.personalityQuizzes.delete(quizId);
                return;
            }
            
            // Ask next question
            await safeSendMessage(sock, sender, {
                text: `Question ${quiz.currentQuestion + 1}: ${quiz.questions[quiz.currentQuestion]}\n\nReply with *!personalityquiz A* or *!personalityquiz B*`
            });
            
            global.personalityQuizzes.set(quizId, quiz);
        } catch (err) {
            logger.error('Personality Quiz error:', err);
            await safeSendText(sock, sender, '❌ An error occurred during the quiz.' );
            global.personalityQuizzes.delete(sender);
        }
    },
    
    // 39. Math Challenge
    async mathchallenge(sock, sender, args) {
        try {
            if (!(await areGamesEnabled(sock, sender))) return;
            
            // Generate a random math problem
            const operations = ['+', '-', '*'];
            const operation = operations[Math.floor(Math.random() * operations.length)];
            
            let num1, num2, answer;
            
            // Generate appropriate numbers based on operation
            switch(operation) {
                case '+':
                    num1 = Math.floor(Math.random() * 100) + 1;
                    num2 = Math.floor(Math.random() * 100) + 1;
                    answer = num1 + num2;
                    break;
                case '-':
                    num1 = Math.floor(Math.random() * 100) + 1;
                    num2 = Math.floor(Math.random() * num1) + 1; // Ensure positive answer
                    answer = num1 - num2;
                    break;
                case '*':
                    num1 = Math.floor(Math.random() * 12) + 1;
                    num2 = Math.floor(Math.random() * 12) + 1;
                    answer = num1 * num2;
                    break;
            }
            
            // Store the answer for verification
            if (!global.mathChallenges) global.mathChallenges = new Map();
            global.mathChallenges.set(sender, answer);
            
            await safeSendMessage(sock, sender, {
                text: `🧮 Math Challenge\n\nSolve: ${num1} ${operation} ${num2} = ?\n\nReply with *!mathanswer [your answer]*`
            });
        } catch (err) {
            logger.error('Math Challenge error:', err);
            await safeSendText(sock, sender, '❌ An error occurred.' );
        }
    },
    
    // 40. Math Answer
    async mathanswer(sock, sender, args) {
        try {
            if (!(await areGamesEnabled(sock, sender))) return;
            
            if (!global.mathChallenges || !global.mathChallenges.has(sender)) {
                await safeSendText(sock, sender, '❌ No active math challenge found. Start one with *!mathchallenge*'
                );
                return;
            }
            
            const userAnswer = parseInt(args[0]);
            if (isNaN(userAnswer)) {
                await safeSendText(sock, sender, '❌ Please provide a valid number as your answer.' );
                return;
            }
            
            const correctAnswer = global.mathChallenges.get(sender);
            
            if (userAnswer === correctAnswer) {
                await safeSendMessage(sock, sender, {
                    text: `✅ Correct! ${userAnswer} is the right answer.\n\nTry another challenge with *!mathchallenge*`
                });
            } else {
                await safeSendMessage(sock, sender, {
                    text: `❌ Wrong! The correct answer was ${correctAnswer}.\n\nTry another challenge with *!mathchallenge*`
                });
            }
            
            global.mathChallenges.delete(sender);
        } catch (err) {
            logger.error('Math Answer error:', err);
            await safeSendText(sock, sender, '❌ An error occurred.' );
        }
    },

    async _8ball(sock, sender, args) {
        try {
            if (!args.length) {
                await safeSendText(sock, sender, '❓ Please ask a question!' );
                return;
            }
            
            const responses = [
                'It is certain.', 'It is decidedly so.', 'Without a doubt.',
                'Yes, definitely.', 'You may rely on it.', 'As I see it, yes.',
                'Most likely.', 'Outlook good.', 'Signs point to yes.',
                'Reply hazy, try again.', 'Ask again later.', 'Better not tell you now.',
                'Cannot predict now.', 'Concentrate and ask again.',
                'Don\'t count on it.', 'My reply is no.', 'My sources say no.',
                'Outlook not so good.', 'Very doubtful.'
            ];
            
            const randomResponse = responses[Math.floor(Math.random() * responses.length)];
            await safeSendMessage(sock, sender, { text: `🎱 ${randomResponse}` });
        } catch (err) {
            logger.error('8ball error:', err);
            await safeSendText(sock, sender, '❌ An error occurred.' );
        }
    }
};

// Export the commands object directly to ensure it's accessible
const commands = funCommands;

module.exports = {
    commands,
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