const logger = require('../utils/logger');

const ownerCommands = require('./owner');
const groupCommands = require('./group');
const userCommands = require('./user');
const basicCommands = require('./basic');
const funCommands = require('./fun');
const mediaCommands = require('./media');
const educationalCommands = require('./educational');
const nsfwCommands = require('./nsfw');
const reactionCommands = require('./reactions');
const utilityCommands = require('./utility');

// Combine all commands
const commands = {
    // Basic commands
    ...basicCommands,

    // Owner commands
    ...ownerCommands,

    // Group commands
    ...groupCommands,

    // User commands
    ...userCommands,

    // Fun commands
    ...funCommands,
    // Media commands
    ...mediaCommands,
    // Educational commands
    ...educationalCommands,
    // NSFW commands
    ...nsfwCommands,
    // Reaction commands
    ...reactionCommands,
    // Utility commands
    ...utilityCommands
};

module.exports = commands;