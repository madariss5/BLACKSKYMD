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