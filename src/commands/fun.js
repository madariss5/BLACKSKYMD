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
        // Implement meme generation/fetching here
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
        // Implement tic-tac-toe game logic here
        await sock.sendMessage(sender, { text: 'Tic-tac-toe game command executed' });
    },

    async hangman(sock, sender, args) {
        if (!args[0]) {
            await sock.sendMessage(sender, { 
                text: 'Usage: !hangman <start|guess> [letter]' 
            });
            return;
        }
        // Implement hangman game logic here
        await sock.sendMessage(sender, { text: 'Hangman game command executed' });
    },

    async quiz(sock, sender) {
        // Implement quiz game logic here
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
        // Implement ASCII art conversion here
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
        // Implement horoscope logic here
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
    }
};

module.exports = funCommands;