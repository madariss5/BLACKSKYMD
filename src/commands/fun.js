const logger = require('../utils/logger');

const funCommands = {
    // Text Fun
    async quote(sock, sender) {
        const quotes = [
            "Be yourself; everyone else is already taken. - Oscar Wilde",
            "Two things are infinite: the universe and human stupidity; and I'm not sure about the universe. - Albert Einstein",
            "Be the change that you wish to see in the world. - Mahatma Gandhi"
        ];
        const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
        await sock.sendMessage(sender, { text: randomQuote });
    },

    async joke(sock, sender) {
        const jokes = [
            "Why don't scientists trust atoms? Because they make up everything!",
            "What do you call a bear with no teeth? A gummy bear!",
            "Why did the scarecrow win an award? Because he was outstanding in his field!"
        ];
        const randomJoke = jokes[Math.floor(Math.random() * jokes.length)];
        await sock.sendMessage(sender, { text: randomJoke });
    },

    async meme(sock, sender) {
        // TODO: Implement meme generation/fetching here
        await sock.sendMessage(sender, { text: "Here's your meme! (Feature coming soon)" });
    },

    // Games
    async tictactoe(sock, sender, args) {
        if (!args[0]) {
            await sock.sendMessage(sender, { 
                text: 'Usage: !tictactoe <start|move> [position]' 
            });
            return;
        }
        // TODO: Implement tic-tac-toe game logic here
        await sock.sendMessage(sender, { text: 'Tic-tac-toe game command executed' });
    },

    async hangman(sock, sender, args) {
        if (!args[0]) {
            await sock.sendMessage(sender, { 
                text: 'Usage: !hangman <start|guess> [letter]' 
            });
            return;
        }
        // TODO: Implement hangman game logic here
        await sock.sendMessage(sender, { text: 'Hangman game command executed' });
    },

    async quiz(sock, sender) {
        // TODO: Implement quiz game logic here
        await sock.sendMessage(sender, { text: 'Quiz game starting soon!' });
    },

    // Fun Text Transformations
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
        const facts = [
            "Honey never spoils. Archaeologists have found pots of honey in ancient Egyptian tombs that are over 3,000 years old and still perfectly good to eat.",
            "A day on Venus is longer than its year. Venus takes 243 Earth days to rotate on its axis but only 225 Earth days to orbit the Sun.",
            "The average person spends 6 months of their lifetime waiting for red lights to turn green."
        ];
        const randomFact = facts[Math.floor(Math.random() * facts.length)];
        await sock.sendMessage(sender, { text: `📚 Did you know?\n${randomFact}` });
    },

    async riddle(sock, sender) {
        const riddles = [
            "What has keys, but no locks; space, but no room; and you can enter, but not go in? A keyboard!",
            "What gets wetter and wetter the more it dries? A towel!",
            "What has a head and a tail that will never meet? A coin!"
        ];
        const randomRiddle = riddles[Math.floor(Math.random() * riddles.length)];
        await sock.sendMessage(sender, { text: `🤔 Riddle:\n${randomRiddle}` });
    },

    // Horoscope and Fortune
    async horoscope(sock, sender, args) {
        if (!args[0]) {
            await sock.sendMessage(sender, { 
                text: 'Please specify your zodiac sign' 
            });
            return;
        }
        // TODO: Implement horoscope logic here
        await sock.sendMessage(sender, { text: 'Horoscope feature coming soon!' });
    },

    async fortune(sock, sender) {
        const fortunes = [
            "A beautiful, smart, and loving person will be coming into your life.",
            "A dubious friend may be an enemy in camouflage.",
            "A faithful friend is a strong defense."
        ];
        const randomFortune = fortunes[Math.floor(Math.random() * fortunes.length)];
        await sock.sendMessage(sender, { text: `🔮 Your fortune:\n${randomFortune}` });
    },

    // Game Commands
    async slot(sock, sender, args) {
        const bet = parseInt(args[0]) || 10;
        const symbols = ['🍎', '🍊', '🍇', '🍒', '💎', '7️⃣'];
        const result = Array(3).fill().map(() => symbols[Math.floor(Math.random() * symbols.length)]);

        const resultText = `
🎰 Slot Machine
${result.join(' | ')}
${result[0] === result[1] && result[1] === result[2] ? 'You won!' : 'Try again!'}
        `.trim();

        await sock.sendMessage(sender, { text: resultText });
    },

    async rps(sock, sender, args) {
        const choices = ['rock', 'paper', 'scissors'];
        const userChoice = args[0]?.toLowerCase();
        if (!choices.includes(userChoice)) {
            await sock.sendMessage(sender, { text: 'Please choose rock, paper, or scissors' });
            return;
        }

        const botChoice = choices[Math.floor(Math.random() * choices.length)];
        let result = 'It\'s a tie!';

        if (
            (userChoice === 'rock' && botChoice === 'scissors') ||
            (userChoice === 'paper' && botChoice === 'rock') ||
            (userChoice === 'scissors' && botChoice === 'paper')
        ) {
            result = 'You win!';
        } else if (userChoice !== botChoice) {
            result = 'Bot wins!';
        }

        await sock.sendMessage(sender, { 
            text: `You: ${userChoice}\nBot: ${botChoice}\n${result}` 
        });
    },

    async chess(sock, sender, args) {
        if (!args[0]) {
            await sock.sendMessage(sender, { 
                text: 'Usage: !chess [start|move] [position]' 
            });
            return;
        }
        // TODO: Implement chess game logic
        await sock.sendMessage(sender, { text: 'Chess game feature coming soon!' });
    },

    async wordle(sock, sender, args) {
        const guess = args[0]?.toLowerCase();
        if (!guess || guess.length !== 5) {
            await sock.sendMessage(sender, { text: 'Please provide a 5-letter word guess' });
            return;
        }
        // TODO: Implement Wordle game logic
        await sock.sendMessage(sender, { text: 'Wordle game feature coming soon!' });
    },

    async trivia(sock, sender, args) {
        const category = args[0];
        // TODO: Implement trivia game with categories
        await sock.sendMessage(sender, { text: 'Trivia game feature coming soon!' });
    },

    // Social Commands
    async truth(sock, sender) {
        const questions = [
            "What's your biggest fear?",
            "What's the most embarrassing thing you've done?",
            "What's your biggest secret?"
        ];
        const question = questions[Math.floor(Math.random() * questions.length)];
        await sock.sendMessage(sender, { text: `Truth: ${question}` });
    },

    async dare(sock, sender) {
        const dares = [
            "Send your latest selfie",
            "Text your crush",
            "Do 10 push-ups"
        ];
        const dare = dares[Math.floor(Math.random() * dares.length)];
        await sock.sendMessage(sender, { text: `Dare: ${dare}` });
    },

    async ship(sock, sender, args) {
        if (args.length < 2) {
            await sock.sendMessage(sender, { text: 'Please mention two users to ship' });
            return;
        }
        const percentage = Math.floor(Math.random() * 101);
        await sock.sendMessage(sender, {
            text: `💕 Ship Calculator 💕\n${args[0]} + ${args[1]} = ${percentage}% compatible!`
        });
    },

    // Virtual Pet System
    async pet(sock, sender, args) {
        const action = args[0];
        if (!action) {
            await sock.sendMessage(sender, { 
                text: 'Usage: !pet [feed|play|sleep|status]' 
            });
            return;
        }
        // TODO: Implement virtual pet system
        await sock.sendMessage(sender, { text: 'Virtual pet feature coming soon!' });
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

    async inventory(sock, sender) {
        // TODO: Implement inventory system
        await sock.sendMessage(sender, { text: 'Inventory system coming soon!' });
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
    }
};

module.exports = funCommands;