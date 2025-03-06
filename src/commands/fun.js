const logger = require('../utils/logger');

const funCommands = {
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
    }
};

module.exports = funCommands;
