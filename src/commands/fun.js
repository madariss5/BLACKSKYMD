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
        await sock.sendMessage(sender, { text: 'Tic-tac-toe game starting...' });
    },

    async hangman(sock, sender, args) {
        if (!args[0]) {
            await sock.sendMessage(sender, { 
                text: 'Usage: !hangman <start|guess> [letter]' 
            });
            return;
        }
        // TODO: Implement hangman game logic here
        await sock.sendMessage(sender, { text: 'Hangman game starting...' });
    },

    async quiz(sock, sender) {
        // TODO: Implement quiz game logic here
        await sock.sendMessage(sender, { text: '❓ Quiz starting...' });
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
        const signs = ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 
                      'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'];
        if (!args[0] || !signs.includes(args[0].toLowerCase())) {
            await sock.sendMessage(sender, { 
                text: `⭐ Available signs: ${signs.join(', ')}` 
            });
            return;
        }
        // TODO: Implement horoscope logic here
        await sock.sendMessage(sender, { text: 'Reading your horoscope...' });
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
        if (!args[0]) {
            await sock.sendMessage(sender, { text: '❓ Please provide your 5-letter guess' });
            return;
        }
        // TODO: Implement Wordle game logic
        await sock.sendMessage(sender, { text: 'Wordle game starting...' });
    },

    async trivia(sock, sender, args) {
        const categories = ['general', 'science', 'history', 'movies', 'games'];
        if (!args[0] || !categories.includes(args[0].toLowerCase())) {
            await sock.sendMessage(sender, { 
                text: `📚 Available categories: ${categories.join(', ')}` 
            });
            return;
        }
        // TODO: Implement trivia game with categories
        await sock.sendMessage(sender, { text: 'Starting trivia game...' });
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

    async inventory(sock, sender) {
        // TODO: Implement inventory system
        await sock.sendMessage(sender, { text: '🎒 Your inventory is empty' });
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
        const cards = ['A♠️', 'K♠️', 'Q♠️', 'J♠️', '10♠️'];
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

    // RPG Game System
    async rpgstart(sock, sender) {
        // TODO: Implement RPG game initialization
        await sock.sendMessage(sender, { text: 'RPG game system coming soon!' });
    },

    async rpgadventure(sock, sender) {
        const adventures = [
            "You found a mysterious cave!",
            "A dragon appears in your path!",
            "You discovered an ancient treasure!"
        ];
        const adventure = adventures[Math.floor(Math.random() * adventures.length)];
        await sock.sendMessage(sender, { text: adventure });
    },

    async rpgbattle(sock, sender) {
        // TODO: Implement RPG battle system
        await sock.sendMessage(sender, { text: 'RPG battle system coming soon!' });
    },

    // Mini Games
    async typingrace(sock, sender) {
        const words = [
            "The quick brown fox jumps over the lazy dog",
            "Pack my box with five dozen liquor jugs",
            "How vexingly quick daft zebras jump"
        ];
        const challenge = words[Math.floor(Math.random() * words.length)];
        await sock.sendMessage(sender, { 
            text: `⌨️ Typing Race:\nType this as fast as you can:\n${challenge}` 
        });
    },

    async mathquiz(sock, sender) {
        const operators = ['+', '-', '*'];
        const operator = operators[Math.floor(Math.random() * operators.length)];
        const num1 = Math.floor(Math.random() * 10) + 1;
        const num2 = Math.floor(Math.random() * 10) + 1;

        await sock.sendMessage(sender, { 
            text: `🔢 Math Quiz:\nWhat is ${num1} ${operator} ${num2}?` 
        });
    },

    async triviachallenge(sock, sender) {
        const questions = [
            {q: "What is the capital of France?", a: "Paris"},
            {q: "Which planet is known as the Red Planet?", a: "Mars"},
            {q: "What is the largest mammal?", a: "Blue Whale"}
        ];
        const question = questions[Math.floor(Math.random() * questions.length)];
        await sock.sendMessage(sender, { 
            text: `🎯 Trivia Challenge:\n${question.q}` 
        });
    },

    // Card Games
    async poker(sock, sender) {
        // TODO: Implement poker game
        await sock.sendMessage(sender, { text: 'Poker game coming soon!' });
    },

    async blackjack(sock, sender) {
        // TODO: Implement blackjack game
        await sock.sendMessage(sender, { text: 'Blackjack game coming soon!' });
    },

    // Social Games
    async confess(sock, sender, args) {
        if (!args.length) {
            return await sock.sendMessage(sender, { 
                text: '⚠️ Please provide your confession!' 
            });
        }

        const confession = args.join(' ');
        await sock.sendMessage(sender, { 
            text: `Anonymous Confession:\n${confession}` 
        });
    },

    async matchmaking(sock, sender, args) {
        if (args.length < 2) {
            return await sock.sendMessage(sender, { 
                text: 'Please mention two users for matchmaking!' 
            });
        }

        const compatibility = Math.floor(Math.random() * 101);
        await sock.sendMessage(sender, { 
            text: `💘 Matchmaking Results:\n${args[0]} + ${args[1]} = ${compatibility}% compatible!` 
        });
    },

    async madlibs(sock, sender, args) {
        const stories = [
            {
                template: "Once upon a time, there was a {adj1} {noun1} who loved to {verb1}. One day, they found a {adj2} {noun2} and decided to {verb2} with it. The end was very {adj3}!",
                words: ['adj1', 'noun1', 'verb1', 'adj2', 'noun2', 'verb2', 'adj3']
            },
            {
                template: "In a {adj1} kingdom, a {noun1} decided to {verb1} across the {adj2} {noun2}. Along the way, they met a {adj3} {noun3} who taught them to {verb2}.",
                words: ['adj1', 'noun1', 'verb1', 'adj2', 'noun2', 'adj3', 'noun3', 'verb2']
            }
        ];

        if (!args.length) {
            const story = stories[Math.floor(Math.random() * stories.length)];
            await sock.sendMessage(sender, {
                text: `🎲 Madlibs Game!\nProvide words for: ${story.words.join(', ')}`
            });
            return;
        }

        const story = stories[Math.floor(Math.random() * stories.length)];
        const words = args.slice(0, story.words.length);

        if (words.length < story.words.length) {
            await sock.sendMessage(sender, {
                text: `Need more words! Still need: ${story.words.slice(words.length).join(', ')}`
            });
            return;
        }

        let filledStory = story.template;
        story.words.forEach((word, i) => {
            filledStory = filledStory.replace(`{${word}}`, words[i]);
        });

        await sock.sendMessage(sender, { text: `📖 Your Story:\n${filledStory}` });
    },

    async charades(sock, sender, args) {
        const categories = ['animals', 'movies', 'food', 'sports'];
        const words = {
            animals: ['elephant', 'penguin', 'giraffe', 'kangaroo', 'dolphin'],
            movies: ['avatar', 'titanic', 'frozen', 'jaws', 'inception'],
            food: ['pizza', 'sushi', 'burger', 'taco', 'pasta'],
            sports: ['soccer', 'basketball', 'tennis', 'swimming', 'volleyball']
        };

        const [action, category] = args;
        if (!action || !['start', 'guess'].includes(action.toLowerCase())) {
            await sock.sendMessage(sender, {
                text: `🎭 Charades Game!\nCommands:\n!charades start [${categories.join('|')}]\n!charades guess [word]`
            });
            return;
        }

        if (action.toLowerCase() === 'start') {
            if (!category || !categories.includes(category.toLowerCase())) {
                await sock.sendMessage(sender, {
                    text: `Please choose a category: ${categories.join(', ')}`
                });
                return;
            }
            const word = words[category][Math.floor(Math.random() * words[category].length)];
            // TODO: Store active game word in database
            await sock.sendMessage(sender, {
                text: `🎭 New game started! Category: ${category}\nGuess the word using !charades guess [word]`
            });
            return;
        }

        if (action.toLowerCase() === 'guess') {
            const guess = args[1]?.toLowerCase();
            if (!guess) {
                await sock.sendMessage(sender, { text: 'Please provide your guess!' });
                return;
            }
            // TODO: Implement guess checking against stored word
            await sock.sendMessage(sender, {
                text: `You guessed: ${guess}\nGuess checking coming soon!`
            });
        }
    },

    async scavenger(sock, sender, args) {
        const [action] = args;
        if (!action || !['start', 'found'].includes(action.toLowerCase())) {
            await sock.sendMessage(sender, {
                text: '🔍 Scavenger Hunt\nCommands:\n!scavenger start\n!scavenger found [item]'
            });
            return;
        }

        if (action.toLowerCase() === 'start') {
            const items = [
                'Something blue',
                'A round object',
                'Something soft',
                'Something that makes noise',
                'Something shiny'
            ];
            // TODO: Store hunt items in database
            await sock.sendMessage(sender, {
                text: `🔍 Scavenger Hunt Started!\nFind these items:\n${items.map((item, i) => `${i + 1}. ${item}`).join('\n')}\n\nMark items as found with !scavenger found [item number]`
            });
            return;
        }

        if (action.toLowerCase() === 'found') {
            const itemNumber = parseInt(args[1]);
            if (!itemNumber || itemNumber < 1 || itemNumber > 5) {
                await sock.sendMessage(sender, {
                    text: 'Please specify a valid item number (1-5)'
                });
                return;
            }
            // TODO: Implement found item checking
            await sock.sendMessage(sender, {
                text: `Marked item ${itemNumber} as found! Keep hunting!`
            });
        }
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
    }

};

module.exports = funCommands;