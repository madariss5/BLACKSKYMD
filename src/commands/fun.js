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
    },

    // RPG Commands
    async adventure(sock, sender, args) {
        const locations = ['forest', 'cave', 'mountain', 'desert', 'dungeon'];
        const location = args[0]?.toLowerCase();

        if (!locations.includes(location)) {
            await sock.sendMessage(sender, { 
                text: `Available locations: ${locations.join(', ')}` 
            });
            return;
        }

        const events = [
            'found treasure!',
            'encountered a monster!',
            'discovered a secret path!',
            'found rare items!',
            'met a mysterious stranger!'
        ];

        const event = events[Math.floor(Math.random() * events.length)];
        await sock.sendMessage(sender, {
            text: `🗺️ Adventure in ${location}: You ${event}`
        });
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
        const targetUser = args[0];
        if (!targetUser) {
            await sock.sendMessage(sender, { text: 'Please mention a user to battle' });
            return;
        }

        const outcomes = ['won', 'lost', 'critical hit', 'special move', 'draw'];
        const outcome = outcomes[Math.floor(Math.random() * outcomes.length)];
        await sock.sendMessage(sender, {
            text: `⚔️ Battle: You ${outcome} against ${targetUser}!`
        });
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
    async pet(sock, sender, args) {
        const actions = ['feed', 'play', 'sleep', 'train', 'status'];
        const action = args[0]?.toLowerCase();

        if (!action || !actions.includes(action)) {
            await sock.sendMessage(sender, {
                text: `Available actions: ${actions.join(', ')}`
            });
            return;
        }

        // TODO: Implement virtual pet system
        await sock.sendMessage(sender, {
            text: `🐱 Pet ${action} command executed!`
        });
    },

    async petshop(sock, sender, args) {
        const [action, item] = args;
        if (!action || action.toLowerCase() !== 'buy' || !item) {
            await sock.sendMessage(sender, {
                text: 'Usage: !petshop buy [item]'
            });
            return;
        }

        // TODO: Implement pet shop system
        await sock.sendMessage(sender, {
            text: `🏪 Bought ${item} for your pet!`
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
        const roasts = [
            "I'd like to roast you, but it looks like life already did.",
            "You're the reason why aliens won't visit Earth.",
            "I would give you a nasty look, but you've already got one."
        ];
        const randomRoast = roasts[Math.floor(Math.random() * roasts.length)];
        await sock.sendMessage(sender, { text: randomRoast });
    },

    async compliment(sock, sender) {
        const compliments = [
            "You light up every room you enter!",
            "Your positivity is infectious!",
            "You have a heart of gold!"
        ];
        const randomCompliment = compliments[Math.floor(Math.random() * compliments.length)];
        await sock.sendMessage(sender, { text: randomCompliment });
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

    // Virtual Pet System
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
};

module.exports = funCommands;