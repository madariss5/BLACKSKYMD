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
            // Check if the first argument is a JID (user identifier)
            let userJid = null;
            let userLang = null;
            
            // If lang looks like a JID, try to get user's preferred language
            if (typeof lang === 'string' && lang.includes('@')) {
                userJid = lang;
                
                // Try to get user's preferred language from user database
                try {
                    const { getUserProfile } = require('./userDatabase');
                    const profile = getUserProfile(userJid);
                    if (profile && profile.language) {
                        userLang = profile.language;
                        logger.debug(`Using user's preferred language: ${userLang} for ${userJid}`);
                    }
                } catch (e) {
                    logger.debug(`Could not get user language profile: ${e.message}`);
                }
                
                // Reset lang to null to continue with normal fallbacks
                lang = userLang;
            }
            
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
        return this.translations.has(language);
    }

    getAvailableLanguages() {
        return Array.from(this.translations.keys());
    }
}

// Create a singleton instance
const languageManager = new LanguageManager();

module.exports = { languageManager };