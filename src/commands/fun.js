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

// Game state initialization
function initializeGameState() {
    global.games = global.games || new Map();
    global.hangmanGames = global.hangmanGames || new Map();
    global.wordleGames = global.wordleGames || new Map();
    global.chessGames = global.chessGames || new Map();
    global.quizGames = global.quizGames || new Map();
    global.triviaGames = global.triviaGames || new Map();
    global.akinator = global.akinator || new Map();
    global.truthOrDare = global.truthOrDare || { truth: new Set(), dare: new Set() };
    global.uno = global.uno || new Map();
    global.riddles = global.riddles || new Map();
    global.wordScramble = global.wordScramble || new Map();
    
    // Initialize state for new games
    global.codeGames = global.codeGames || new Map();
    global.numberGames = global.numberGames || new Map();
    global.hangmanVsGames = global.hangmanVsGames || new Map();
    global.connectFourGames = global.connectFourGames || new Map();
    global.wordChainGames = global.wordChainGames || new Map();
    global.personalityQuizzes = global.personalityQuizzes || new Map();
    global.movieHangmanGames = global.movieHangmanGames || new Map();
    global.movieQuizzes = global.movieQuizzes || new Map();
    global.numberSequenceGames = global.numberSequenceGames || new Map();
    global.dicePokerGames = global.dicePokerGames || new Map();
    global.rpsTournaments = global.rpsTournaments || new Map();
}

// Board rendering functions
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
        [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
        [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
        [0, 4, 8], [2, 4, 6]             // Diagonals
    ];

    for (const pattern of winPatterns) {
        const [a, b, c] = pattern;
        // Check if we can win in this pattern
        if (board[a] === player && board[b] === player && board[c] === ' ') return c;
        if (board[a] === player && board[b] === ' ' && board[c] === player) return b;
        if (board[a] === ' ' && board[b] === player && board[c] === player) return a;
    }
    return -1;
}

function getHangmanDisplay(game) {
    const hangmanStages = [
        '\n      +---+\n      |   |\n          |\n          |\n          |\n          |\n    =========',
        '\n      +---+\n      |   |\n      O   |\n          |\n          |\n          |\n    =========',
        '\n      +---+\n      |   |\n      O   |\n      |   |\n          |\n          |\n    =========',
        '\n      +---+\n      |   |\n      O   |\n     /|   |\n          |\n          |\n    =========',
        '\n      +---+\n      |   |\n      O   |\n     /|\\  |\n          |\n          |\n    =========',
        '\n      +---+\n      |   |\n      O   |\n     /|\\  |\n     /    |\n          |\n    =========',
        '\n      +---+\n      |   |\n      O   |\n     /|\\  |\n     / \\  |\n          |\n    ========='
    ];

    const displayWord = game.word.split('').map(letter => 
        game.guessedLetters.includes(letter) ? letter : '_'
    ).join(' ');

    const wrongGuesses = game.guessedLetters.filter(letter => !game.word.includes(letter));
    const hangmanIndex = Math.min(wrongGuesses.length, hangmanStages.length - 1);

    return `${hangmanStages[hangmanIndex]}\n\nWord: ${displayWord}\nGuessed: ${game.guessedLetters.join(', ') || 'None'}\nWrong guesses: ${wrongGuesses.length}/${game.maxWrongGuesses}`;
}

function handleWordleGuess(word, guess) {
    const feedback = [];
    const wordLetters = word.split('');
    const guessLetters = guess.split('');
    
    // First pass: Mark exact matches
    for (let i = 0; i < 5; i++) {
        if (guessLetters[i] === wordLetters[i]) {
            feedback[i] = '🟩'; // Green
            wordLetters[i] = null; // Mark as used
        }
    }
    
    // Second pass: Mark partial matches
    for (let i = 0; i < 5; i++) {
        if (feedback[i]) continue; // Skip if already matched
        
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
            await sock.sendMessage(sender, { text: `😂 Joke time:\n\n${randomJoke}` });
        } catch (err) {
            logger.error('Joke error:', err);
            await sock.sendMessage(sender, { text: '❌ An error occurred while fetching the joke.' });
        }
    },

    async meme(sock, sender) {
        try {
            // TODO: Implement meme fetching from API
            await sock.sendMessage(sender, { text: '🎭 Meme functionality coming soon!' });
        } catch (err) {
            logger.error('Meme error:', err);
            await sock.sendMessage(sender, { text: '❌ An error occurred while fetching the meme.' });
        }
    },

    // Games
    async tictactoe(sock, sender, args) {
        try {
            if (!(await areGamesEnabled(sock, sender))) return;
            
            if (!global.games) global.games = new Map();
            const gameId = sender;
            let game = global.games.get(gameId);
            
            // Create new game if no active game
            if (!game) {
                game = {
                    board: [' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' '],
                    currentPlayer: 'X',
                    moves: 0
                };
                global.games.set(gameId, game);
                
                await sock.sendMessage(sender, {
                    text: `🎮 Let's play Tic-Tac-Toe!\nYou are X, I am O.\n\n${renderBoard(game.board)}\n\nSelect your move (1-9):`
                });
                return;
            }
            
            // Process player move
            const move = parseInt(args[0]);
            if (isNaN(move) || move < 1 || move > 9) {
                await sock.sendMessage(sender, { text: '❌ Please choose a number between 1 and 9.' });
                return;
            }
            
            const index = move - 1;
            if (game.board[index] !== ' ') {
                await sock.sendMessage(sender, { text: '❌ That position is already taken! Choose another.' });
                return;
            }
            
            // Apply player move
            game.board[index] = 'X';
            game.moves++;
            
            // Check for win or draw
            let winner = checkWinner(game.board);
            if (winner || game.moves === 9) {
                let result = '';
                if (winner === 'X') {
                    result = '🎉 You win! Congratulations!';
                } else if (winner === 'O') {
                    result = '😢 I win! Better luck next time.';
                } else {
                    result = '🤝 It\'s a draw!';
                }
                
                await sock.sendMessage(sender, {
                    text: `${renderBoard(game.board)}\n\n${result}\n\nType *!tictactoe* to play again.`
                });
                global.games.delete(gameId);
                return;
            }
            
            // Bot's turn
            const botMove = getBotMove(game.board);
            if (botMove !== -1) {
                game.board[botMove] = 'O';
                game.moves++;
                
                // Check for win or draw after bot move
                winner = checkWinner(game.board);
                if (winner || game.moves === 9) {
                    let result = '';
                    if (winner === 'X') {
                        result = '🎉 You win! Congratulations!';
                    } else if (winner === 'O') {
                        result = '😢 I win! Better luck next time.';
                    } else {
                        result = '🤝 It\'s a draw!';
                    }
                    
                    await sock.sendMessage(sender, {
                        text: `${renderBoard(game.board)}\n\n${result}\n\nType *!tictactoe* to play again.`
                    });
                    global.games.delete(gameId);
                    return;
                }
            }
            
            global.games.set(gameId, game);
            await sock.sendMessage(sender, {
                text: `${renderBoard(game.board)}\n\nYour move (1-9):`
            });
        } catch (err) {
            logger.error('Tic-tac-toe error:', err);
            await sock.sendMessage(sender, { text: '❌ An error occurred during the game.' });
            global.games.delete(sender);
        }
    },

    async hangman(sock, sender, args) {
        try {
            if (!(await areGamesEnabled(sock, sender))) return;
            
            if (!global.hangmanGames) global.hangmanGames = new Map();
            
            const gameId = sender;
            let game = global.hangmanGames.get(gameId);
            
            if (!game) {
                // Start a new game
                const words = [
                    'APPLE', 'BANANA', 'COMPUTER', 'DIAMOND', 'ELEPHANT', 
                    'FOOTBALL', 'GUITAR', 'HAMBURGER', 'ISLAND', 'JACKET'
                ];
                const randomWord = words[Math.floor(Math.random() * words.length)];
                
                game = {
                    word: randomWord,
                    guessedLetters: [],
                    maxWrongGuesses: 6
                };
                
                global.hangmanGames.set(gameId, game);
                
                const hangmanDisplay = getHangmanDisplay(game);
                await sock.sendMessage(sender, {
                    text: `🎮 Hangman Game\n${hangmanDisplay}\n\nGuess a letter using *!hangman [letter]*`
                });
                return;
            }
            
            // Process a guess
            const guess = args[0]?.toUpperCase();
            if (!guess || guess.length !== 1 || !guess.match(/[A-Z]/)) {
                await sock.sendMessage(sender, { text: '❌ Please guess a single letter (A-Z).' });
                return;
            }
            
            if (game.guessedLetters.includes(guess)) {
                await sock.sendMessage(sender, { text: '❌ You already guessed that letter!' });
                return;
            }
            
            game.guessedLetters.push(guess);
            global.hangmanGames.set(gameId, game);
            
            const wrongGuesses = game.guessedLetters.filter(letter => !game.word.includes(letter));
            const isWon = game.word.split('').every(letter => game.guessedLetters.includes(letter));
            const isLost = wrongGuesses.length >= game.maxWrongGuesses;
            
            const hangmanDisplay = getHangmanDisplay(game);
            
            if (isWon) {
                await sock.sendMessage(sender, {
                    text: `${hangmanDisplay}\n\n🎉 You win! The word was: ${game.word}\n\nType *!hangman* to play again.`
                });
                global.hangmanGames.delete(gameId);
            } else if (isLost) {
                await sock.sendMessage(sender, {
                    text: `${hangmanDisplay}\n\n💀 Game Over! The word was: ${game.word}\n\nType *!hangman* to play again.`
                });
                global.hangmanGames.delete(gameId);
            } else {
                await sock.sendMessage(sender, {
                    text: `${hangmanDisplay}\n\nGuess another letter using *!hangman [letter]*`
                });
            }
        } catch (err) {
            logger.error('Hangman error:', err);
            await sock.sendMessage(sender, { text: '❌ An error occurred during the game.' });
            global.hangmanGames.delete(sender);
        }
    },

    async wordle(sock, sender, args) {
        try {
            if (!(await areGamesEnabled(sock, sender))) return;
            
            if (!global.wordleGames) global.wordleGames = new Map();
            
            const gameId = sender;
            let game = global.wordleGames.get(gameId);
            
            if (!game) {
                // Start a new game
                const words = ['APPLE', 'BANANA', 'CHART', 'DANCE', 'EAGLE', 'FLAME', 'GLOBE', 'HOUSE', 'IMAGE', 'JUICE'];
                const randomWord = words[Math.floor(Math.random() * words.length)];
                
                game = {
                    word: randomWord,
                    guesses: [],
                    maxAttempts: 6
                };
                
                global.wordleGames.set(gameId, game);
                
                await sock.sendMessage(sender, {
                    text: `🎮 Wordle Game\n\nI'm thinking of a 5-letter word. You have 6 tries to guess it!\n\n🟩 - Correct letter, correct position\n🟨 - Correct letter, wrong position\n⬜ - Letter not in the word\n\nMake your first guess with *!wordle [word]*`
                });
                return;
            }
            
            // Process a guess
            const guess = args[0]?.toUpperCase();
            if (!guess || guess.length !== 5 || !guess.match(/^[A-Z]{5}$/)) {
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
        } catch (err) {
            logger.error('Wordle error:', err);
            await sock.sendMessage(sender, { text: '❌ An error occurred during the game.' });
            global.wordleGames.delete(gameId);
        }
    },

    async rps(sock, sender, args) {
        try {
            if (!(await areGamesEnabled(sock, sender))) return;
            
            const choices = ['rock', 'paper', 'scissors'];
            const userChoice = args.join(' ').toLowerCase();
            
            if (!choices.includes(userChoice)) {
                await sock.sendMessage(sender, { 
                    text: '❌ Please choose either *rock*, *paper*, or *scissors*.' 
                });
                return;
            }
            
            const botChoice = choices[Math.floor(Math.random() * choices.length)];
            let result = '';
            
            if (userChoice === botChoice) {
                result = "It's a tie!";
            } else if (
                (userChoice === 'rock' && botChoice === 'scissors') ||
                (userChoice === 'paper' && botChoice === 'rock') ||
                (userChoice === 'scissors' && botChoice === 'paper')
            ) {
                result = 'You win!';
            } else {
                result = 'I win!';
            }
            
            await sock.sendMessage(sender, { 
                text: `You chose *${userChoice}*\nI chose *${botChoice}*\n\n*${result}*` 
            });
        } catch (err) {
            logger.error('RPS error:', err);
            await sock.sendMessage(sender, { text: '❌ An error occurred during the game.' });
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

    async roll(sock, sender, args) {
        try {
            let sides = 6;
            if (args[0] && !isNaN(args[0])) {
                sides = parseInt(args[0]);
                if (sides < 2 || sides > 100) {
                    await sock.sendMessage(sender, { text: '❌ Please enter a number between 2 and 100.' });
                    return;
                }
            }
            
            const result = Math.floor(Math.random() * sides) + 1;
            await sock.sendMessage(sender, { text: `🎲 You rolled: ${result} (d${sides})` });
        } catch (err) {
            logger.error('Roll error:', err);
            await sock.sendMessage(sender, { text: '❌ An error occurred.' });
        }
    },

    async flip(sock, sender) {
        try {
            const result = Math.random() < 0.5 ? 'Heads' : 'Tails';
            await sock.sendMessage(sender, { text: `🪙 Coin flip: ${result}` });
        } catch (err) {
            logger.error('Flip error:', err);
            await sock.sendMessage(sender, { text: '❌ An error occurred.' });
        }
    },

    async choose(sock, sender, args) {
        try {
            const choices = args.join(' ').split(',').map(choice => choice.trim()).filter(Boolean);
            
            if (choices.length < 2) {
                await sock.sendMessage(sender, { 
                    text: '❌ Please provide at least 2 options separated by commas.' 
                });
                return;
            }
            
            const randomChoice = choices[Math.floor(Math.random() * choices.length)];
            await sock.sendMessage(sender, { text: `🎯 I choose: ${randomChoice}` });
        } catch (err) {
            logger.error('Choose error:', err);
            await sock.sendMessage(sender, { text: '❌ An error occurred.' });
        }
    },
    
    // 1. Truth or Dare
    async truthordare(sock, sender, args) {
        try {
            if (!(await areGamesEnabled(sock, sender))) return;
            
            const type = args[0]?.toLowerCase();
            if (!type || (type !== 'truth' && type !== 'dare')) {
                await sock.sendMessage(sender, { 
                    text: '🎮 Truth or Dare\n\nChoose either *!truthordare truth* or *!truthordare dare*' 
                });
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
            
            await sock.sendMessage(sender, { 
                text: `🎮 ${type.toUpperCase()}:\n\n${randomOption}` 
            });
        } catch (err) {
            logger.error('Truth or Dare error:', err);
            await sock.sendMessage(sender, { text: '❌ An error occurred during the game.' });
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
            
            await sock.sendMessage(sender, { 
                text: `🤔 Would You Rather:\n\n${randomQuestion}` 
            });
        } catch (err) {
            logger.error('Would You Rather error:', err);
            await sock.sendMessage(sender, { text: '❌ An error occurred.' });
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
            
            await sock.sendMessage(sender, { 
                text: `🎮 Never Have I Ever:\n\n${randomStatement}\n\nRespond with 🍺 if you have, or 🙅‍♂️ if you haven't!` 
            });
        } catch (err) {
            logger.error('Never Have I Ever error:', err);
            await sock.sendMessage(sender, { text: '❌ An error occurred.' });
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
            
            await sock.sendMessage(sender, { 
                text: `📚 Random Fact:\n\n${randomFact}` 
            });
        } catch (err) {
            logger.error('Fact error:', err);
            await sock.sendMessage(sender, { text: '❌ An error occurred while fetching a fact.' });
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
            
            await sock.sendMessage(sender, { 
                text: `🥠 Your Fortune:\n\n${randomFortune}` 
            });
        } catch (err) {
            logger.error('Fortune error:', err);
            await sock.sendMessage(sender, { text: '❌ An error occurred while fetching your fortune.' });
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
            
            await sock.sendMessage(sender, { 
                text: `🧩 Riddle:\n\n${randomRiddle.question}\n\nGuess the answer using *!riddleguess [your answer]*` 
            });
        } catch (err) {
            logger.error('Riddle error:', err);
            await sock.sendMessage(sender, { text: '❌ An error occurred.' });
        }
    },
    
    // 7. Riddleguess - companion command for Riddle
    async riddleguess(sock, sender, args) {
        try {
            if (!(await areGamesEnabled(sock, sender))) return;
            
            if (!global.riddles || !global.riddles.has(sender)) {
                await sock.sendMessage(sender, { 
                    text: '❌ No active riddle found. Start a new riddle with *!riddle*' 
                });
                return;
            }
            
            if (!args.length) {
                await sock.sendMessage(sender, { 
                    text: '❓ Please provide your guess!' 
                });
                return;
            }
            
            const riddle = global.riddles.get(sender);
            const guess = args.join(' ').toLowerCase().trim();
            
            if (guess === riddle.answer.toLowerCase()) {
                await sock.sendMessage(sender, { 
                    text: '🎉 Correct! You solved the riddle!\n\nAsk for another with *!riddle*' 
                });
                global.riddles.delete(sender);
            } else {
                await sock.sendMessage(sender, { 
                    text: '❌ Incorrect! Try again or use *!riddlehint* for a hint.' 
                });
            }
        } catch (err) {
            logger.error('Riddle guess error:', err);
            await sock.sendMessage(sender, { text: '❌ An error occurred.' });
        }
    },
    
    // 8. Riddlehint - hint for active riddle
    async riddlehint(sock, sender) {
        try {
            if (!(await areGamesEnabled(sock, sender))) return;
            
            if (!global.riddles || !global.riddles.has(sender)) {
                await sock.sendMessage(sender, { 
                    text: '❌ No active riddle found. Start a new riddle with *!riddle*' 
                });
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
            
            await sock.sendMessage(sender, { 
                text: `🔍 Hint: ${hint}` 
            });
        } catch (err) {
            logger.error('Riddle hint error:', err);
            await sock.sendMessage(sender, { text: '❌ An error occurred.' });
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
            
            await sock.sendMessage(sender, { 
                text: `🔤 Unscramble this word: *${scrambled}*\n\nGuess using *!unscramble [your guess]*` 
            });
        } catch (err) {
            logger.error('Word scramble error:', err);
            await sock.sendMessage(sender, { text: '❌ An error occurred.' });
        }
    },
    
    // 10. Unscramble - companion command for Word Scramble
    async unscramble(sock, sender, args) {
        try {
            if (!(await areGamesEnabled(sock, sender))) return;
            
            if (!global.wordScramble || !global.wordScramble.has(sender)) {
                await sock.sendMessage(sender, { 
                    text: '❌ No active word scramble found. Start a new game with *!scramble*' 
                });
                return;
            }
            
            if (!args.length) {
                await sock.sendMessage(sender, { 
                    text: '❓ Please provide your guess!' 
                });
                return;
            }
            
            const word = global.wordScramble.get(sender);
            const guess = args[0].toLowerCase().trim();
            
            if (guess === word) {
                await sock.sendMessage(sender, { 
                    text: '🎉 Correct! You unscrambled the word!\n\nPlay again with *!scramble*' 
                });
                global.wordScramble.delete(sender);
            } else {
                await sock.sendMessage(sender, { 
                    text: '❌ Incorrect! Try again or use *!scramblehint* for a hint.' 
                });
            }
        } catch (err) {
            logger.error('Unscramble error:', err);
            await sock.sendMessage(sender, { text: '❌ An error occurred.' });
        }
    },
    
    // 11. Scramblehint - hint for active word scramble
    async scramblehint(sock, sender) {
        try {
            if (!(await areGamesEnabled(sock, sender))) return;
            
            if (!global.wordScramble || !global.wordScramble.has(sender)) {
                await sock.sendMessage(sender, { 
                    text: '❌ No active word scramble found. Start a new game with *!scramble*' 
                });
                return;
            }
            
            const word = global.wordScramble.get(sender);
            
            // Reveal the first and last letter
            const hint = word[0] + '...' + word[word.length - 1];
            
            await sock.sendMessage(sender, { 
                text: `🔍 Hint: The word starts with "${word[0]}" and ends with "${word[word.length - 1]}"` 
            });
        } catch (err) {
            logger.error('Scramble hint error:', err);
            await sock.sendMessage(sender, { text: '❌ An error occurred.' });
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
                
                await sock.sendMessage(sender, {
                    text: `🔮 *Akinator Game*\n\nThink of a character, and I'll try to guess who it is!\n\nQuestion 1: ${game.questions[0]}\n\nReply with *!akinator yes* or *!akinator no*`
                });
                return;
            }
            
            const answer = args[0]?.toLowerCase();
            
            if (answer !== 'yes' && answer !== 'no') {
                await sock.sendMessage(sender, { 
                    text: '❓ Please answer with *!akinator yes* or *!akinator no*.' 
                });
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
                
                await sock.sendMessage(sender, {
                    text: `🔮 Based on your answers, I think...\n\n${guess}\n\nWas I right? Play again with *!akinator restart*!`
                });
                
                // End the game
                global.akinator.delete(gameId);
            } else {
                // Ask the next question
                await sock.sendMessage(sender, {
                    text: `Question ${game.step + 1}: ${game.questions[game.step]}\n\nReply with *!akinator yes* or *!akinator no*`
                });
                
                // Update game state
                global.akinator.set(gameId, game);
            }
        } catch (err) {
            logger.error('Akinator error:', err);
            await sock.sendMessage(sender, { text: '❌ An error occurred during the game.' });
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
                
                await sock.sendMessage(sender, {
                    text: `🔢 Number Guessing Game\n\nI'm thinking of a number between 1 and ${max}.\nYou have ${game.maxAttempts} attempts to guess it!\n\nMake a guess using *!numbergame [number]*`
                });
                return;
            }
            
            // Process a guess
            const guess = parseInt(args[0]);
            if (isNaN(guess)) {
                await sock.sendMessage(sender, { text: '❌ Please enter a valid number.' });
                return;
            }
            
            game.attempts++;
            
            if (guess === game.number) {
                await sock.sendMessage(sender, {
                    text: `🎉 Correct! The number was ${game.number}.\nYou guessed it in ${game.attempts} attempts!\n\nPlay again with *!numbergame*`
                });
                global.numberGames.delete(gameId);
            } else if (game.attempts >= game.maxAttempts) {
                await sock.sendMessage(sender, {
                    text: `😢 Game Over! You've used all ${game.maxAttempts} attempts.\nThe number was ${game.number}.\n\nTry again with *!numbergame*`
                });
                global.numberGames.delete(gameId);
            } else {
                const hint = guess < game.number ? 'higher' : 'lower';
                await sock.sendMessage(sender, {
                    text: `❌ Wrong! The number is ${hint} than ${guess}.\nAttempts: ${game.attempts}/${game.maxAttempts}`
                });
                global.numberGames.set(gameId, game);
            }
        } catch (err) {
            logger.error('Number game error:', err);
            await sock.sendMessage(sender, { text: '❌ An error occurred during the game.' });
            global.numberGames.delete(sender);
        }
    },
    
    // 14. Coin flip with emoji
    async coinflip(sock, sender) {
        try {
            const result = Math.random() < 0.5 ? 'heads' : 'tails';
            const emoji = result === 'heads' ? '🪙' : '💰';
            
            await sock.sendMessage(sender, { 
                text: `${emoji} Coin flip result: *${result.toUpperCase()}*!` 
            });
        } catch (err) {
            logger.error('Coin flip error:', err);
            await sock.sendMessage(sender, { text: '❌ An error occurred.' });
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
            
            await sock.sendMessage(sender, {
                text: `🎲 Dice roll: ${diceDisplay}\nValues: ${results.join(', ')}\nTotal: ${total}`
            });
        } catch (err) {
            logger.error('Dice roll error:', err);
            const result = Math.floor(Math.random() * 6) + 1;
            await sock.sendMessage(sender, { text: `❌ An error occurred. Dice roll: ${result}` });
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
                
                await sock.sendMessage(sender, {
                    text: `🔐 Crack the Code\n\nI've created a 4-digit code with numbers from 1-6.\nYou have ${game.maxAttempts} attempts to guess it!\n\nMake a guess using *!crackthecode 1234* (four digits from 1-6)\n\n🟢 = correct number in correct position\n🟡 = correct number in wrong position\n⚪ = number not in the code`
                });
                return;
            }
            
            // Process a guess
            const guess = args[0];
            
            if (!guess || !/^[1-6]{4}$/.test(guess)) {
                await sock.sendMessage(sender, { 
                    text: '❌ Please enter a valid 4-digit code using only numbers 1-6.' 
                });
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
                await sock.sendMessage(sender, {
                    text: `🎉 You cracked the code! It was ${game.code.join('')}.\nYou guessed it in ${game.attempts} attempts!\n\nPlay again with *!crackthecode restart*`
                });
                global.codeGames.delete(gameId);
                return;
            }
            
            // Check if game over
            if (game.attempts >= game.maxAttempts) {
                await sock.sendMessage(sender, {
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
            
            await sock.sendMessage(sender, { text: message });
            global.codeGames.set(gameId, game);
        } catch (err) {
            logger.error('Crack the code error:', err);
            await sock.sendMessage(sender, { text: '❌ An error occurred during the game.' });
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
                
                await sock.sendMessage(sender, { text: message });
                return;
            }
            
            const playerChoice = args[0].toLowerCase();
            
            if (!choices.includes(playerChoice)) {
                await sock.sendMessage(sender, { 
                    text: '❌ Invalid choice! Please choose rock, paper, scissors, lizard, or spock.' 
                });
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
            
            await sock.sendMessage(sender, { text: message });
        } catch (err) {
            logger.error('RPSLS error:', err);
            await sock.sendMessage(sender, { text: '❌ An error occurred during the game.' });
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
            
            await sock.sendMessage(sender, { 
                text: `🤔 This or That:\n\n${randomPair}\n\nWhat's your choice?` 
            });
        } catch (err) {
            logger.error('This or That error:', err);
            await sock.sendMessage(sender, { text: '❌ An error occurred.' });
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
            
            await sock.sendMessage(sender, { 
                text: `🎲 Dare:\n\n${randomDare}` 
            });
        } catch (err) {
            logger.error('Dare error:', err);
            await sock.sendMessage(sender, { text: '❌ An error occurred.' });
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
            
            await sock.sendMessage(sender, { 
                text: `🎲 Truth:\n\n${randomTruth}` 
            });
        } catch (err) {
            logger.error('Truth error:', err);
            await sock.sendMessage(sender, { text: '❌ An error occurred.' });
        }
    },

    async _8ball(sock, sender, args) {
        try {
            if (!args.length) {
                await sock.sendMessage(sender, { text: '❓ Please ask a question!' });
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
            await sock.sendMessage(sender, { text: `🎱 ${randomResponse}` });
        } catch (err) {
            logger.error('8ball error:', err);
            await sock.sendMessage(sender, { text: '❌ An error occurred.' });
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