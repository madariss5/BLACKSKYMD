const fs = require('fs').promises;
const path = require('path');
const logger = require('./logger');
const config = require('../config/config');

class LanguageManager {
    constructor() {
        this.translations = new Map();
        this.defaultLanguage = 'en';
    }

    async loadTranslations() {
        try {
            const translationsDir = path.join(__dirname, '../translations');
            const files = await fs.readdir(translationsDir);
            
            for (const file of files) {
                if (file.endsWith('.json')) {
                    const language = file.replace('.json', '');
                    const content = await fs.readFile(path.join(translationsDir, file), 'utf8');
                    this.translations.set(language, JSON.parse(content));
                    logger.info(`Loaded translations for ${language}`);
                }
            }
        } catch (err) {
            logger.error('Error loading translations:', err);
        }
    }

    getText(key, language = config.bot.language, ...args) {
        try {
            const langData = this.translations.get(language) || this.translations.get(this.defaultLanguage);
            if (!langData) {
                logger.warn(`No translations found for language: ${language}`);
                return key;
            }

            // Split the key by dots to traverse nested objects
            const keys = key.split('.');
            let text = langData;
            for (const k of keys) {
                text = text[k];
                if (!text) break;
            }

            // If translation not found, try default language
            if (!text && language !== this.defaultLanguage) {
                return this.getText(key, this.defaultLanguage, ...args);
            }

            // Return key if no translation found
            if (!text) return key;

            // Replace placeholders with args
            return text.replace(/%s/g, () => args.shift() || '%s');
        } catch (err) {
            logger.error(`Error getting translation for key ${key}:`, err);
            return key;
        }
    }

    getCommandHelp(command, language = config.bot.language) {
        return {
            description: this.getText(`commands.${command}.description`, language),
            usage: this.getText(`commands.${command}.usage`, language)
        };
    }

    isLanguageSupported(language) {
        return this.translations.has(language);
    }

    getAvailableLanguages() {
        return Array.from(this.translations.keys());
    }
}

const languageManager = new LanguageManager();
module.exports = { languageManager };
