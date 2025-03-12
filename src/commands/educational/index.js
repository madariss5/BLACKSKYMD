const logger = require('../../utils/logger');
const fs = require('fs').promises;
const path = require('path');

// Import commands
const educationalCommands = require('./commands');

// Directory initialization with error handling
async function initializeDirectories() {
    const dirs = [
        'data/educational',
        'data/educational/flashcards',
        'data/educational/mindmaps',
        'data/educational/quiz_scores', 
        'data/educational/study_materials',
        'data/educational/language_exercises',
        'data/educational/math_solutions',
        'data/educational/study_plans'
    ];

    try {
        for (const dir of dirs) {
            const fullPath = path.join(__dirname, '../../../', dir);
            await fs.mkdir(fullPath, { recursive: true });
            logger.info(`Educational directory initialized: ${dir}`);
        }
        return true;
    } catch (err) {
        logger.error('Error initializing educational directories:', err);
        throw err;
    }
}

module.exports = {
    commands: educationalCommands,
    category: 'educational',
    async init() {
        try {
            logger.info('Initializing Educational module...');
            await initializeDirectories();
            logger.success('Educational module initialized successfully');
            return true;
        } catch (err) {
            logger.error('Failed to initialize Educational module:', err);
            return false;
        }
    }
};