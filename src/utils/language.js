const fs = require('fs').promises;
const path = require('path');
const logger = require('./logger');
const config = require('../config/config');

class LanguageManager {
    constructor() {
        this.translations = new Map();
        this.defaultLanguage = 'en';
        this.supportedLanguages = ['en', 'de']; // Explicitly define supported languages
        logger.info(`Language Manager initialized with supported languages: ${this.supportedLanguages.join(', ')}`);
    }

    async loadTranslations() {
        try {
            const translationsDir = path.join(__dirname, '../translations');
            logger.info(`Loading translations from directory: ${translationsDir}`);
            const files = await fs.readdir(translationsDir);

            for (const file of files) {
                if (file.endsWith('.json')) {
                    const language = file.replace('.json', '');
                    const filePath = path.join(translationsDir, file);
                    logger.info(`Loading translations file: ${filePath}`);
                    const content = await fs.readFile(filePath, 'utf8');
                    this.translations.set(language, JSON.parse(content));
                    logger.info(`Successfully loaded translations for ${language}`);
                }
            }

            // Validate all required languages are loaded
            for (const lang of this.supportedLanguages) {
                if (!this.translations.has(lang)) {
                    logger.error(`Required language '${lang}' translations not found`);
                } else {
                    logger.info(`Validated translations for ${lang}`);
                }
            }

            // Log loaded languages
            logger.info(`Available languages: ${Array.from(this.translations.keys()).join(', ')}`);

            // Ensure default language exists
            if (!this.translations.has(this.defaultLanguage)) {
                logger.error(`Default language '${this.defaultLanguage}' translations not found`);
                this.translations.set(this.defaultLanguage, {});
            }
        } catch (err) {
            logger.error('Error loading translations:', err);
            // Initialize with empty translations to prevent crashes
            this.translations.set(this.defaultLanguage, {});
        }
    }

    getText(key, lang = null, ...args) {
        try {
            // Use provided language, fallback to config, then default
            const language = lang || config.bot.language || this.defaultLanguage;

            // Get translations for requested language
            let langData = this.translations.get(language);

            // If translation not found in requested language, try default
            if (!langData && language !== this.defaultLanguage) {
                logger.debug(`Falling back to default language for: ${language}`);
                langData = this.translations.get(this.defaultLanguage);
            }

            // If still no translations found, return key
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

            // If translation not found in requested language, try default
            if (!text && language !== this.defaultLanguage) {
                return this.getText(key, this.defaultLanguage, ...args);
            }

            // Return key if no translation found
            if (!text) {
                logger.debug(`Translation not found for key: ${key} in language: ${language}`);
                return key;
            }

            // Replace placeholders with args
            return text.replace(/%s/g, () => args.shift() || '%s');
        } catch (err) {
            logger.error(`Error getting translation for key ${key}:`, err);
            return key;
        }
    }

    isLanguageSupported(language) {
        const isSupported = this.supportedLanguages.includes(language);
        logger.debug(`Language support check: ${language} -> ${isSupported}`);
        return isSupported;
    }

    getAvailableLanguages() {
        return this.supportedLanguages;
    }
}

// Create a singleton instance
const languageManager = new LanguageManager();

module.exports = { languageManager };