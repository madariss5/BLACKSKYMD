const fs = require('fs').promises;
const path = require('path');
const logger = require('./logger');
const config = require('../config/config');

class LanguageManager {
    constructor(options = {}) {
        this.translations = new Map();
        this.defaultLanguage = options.defaultLanguage || 'en';
        this.supportedLanguages = options.supportedLanguages || ['en', 'de']; // Explicitly define supported languages
        this.autoloadTranslations = options.autoloadTranslations !== false; // Default to true
        this.verbose = options.verbose !== false; // Default to true for enhanced logging
        this.translationMissingLog = new Set(); // Track missing translations to avoid spam
        this.maxLoggedMissing = options.maxLoggedMissing || 100; // Maximum number of missing translations to log
        
        if (this.verbose) {
            console.log(`Language Manager initialized with:
- Default language: ${this.defaultLanguage}
- Supported languages: ${this.supportedLanguages.join(', ')}
- Auto-loading enabled: ${this.autoloadTranslations}
- Verbose logging: ${this.verbose}`);
        }
    }

    async loadTranslations() {
        try {
            // Try multiple possible locations for translations directory
            const possibleDirs = [
                path.join(__dirname, '../translations'),
                path.join(process.cwd(), 'src/translations'),
                path.join(process.cwd(), 'translations')
            ];
            
            let translationsDir = null;
            
            // Find the first directory that exists
            for (const dir of possibleDirs) {
                try {
                    await fs.access(dir);
                    console.log(`✅ Found translations directory: ${dir}`);
                    translationsDir = dir;
                    break;
                } catch (err) {
                    console.log(`Directory not found: ${dir}`);
                }
            }
            
            // If no directory found, create one
            if (!translationsDir) {
                translationsDir = possibleDirs[0];
                console.error(`❌ No translations directory found, creating: ${translationsDir}`);
                await fs.mkdir(translationsDir, { recursive: true });
                
                // Initialize with empty translations to prevent crashes
                this.translations.set(this.defaultLanguage, {});
                return;
            }
            
            const files = await fs.readdir(translationsDir);
            console.log(`Found translation files: ${files.join(', ')}`);

            // Process each translation file
            for (const file of files) {
                if (file.endsWith('.json')) {
                    const language = file.replace('.json', '');
                    const filePath = path.join(translationsDir, file);
                    console.log(`Processing translation file: ${filePath} (${language})`);
                    
                    try {
                        // Read and parse the file
                        const content = await fs.readFile(filePath, 'utf8');
                        
                        // Check if content is empty
                        if (!content.trim()) {
                            console.error(`Translation file ${filePath} is empty!`);
                            continue;
                        }
                        
                        try {
                            const parsedContent = JSON.parse(content);
                            this.translations.set(language, parsedContent);
                            
                            // Verify content has expected structure
                            if (!parsedContent.system) {
                                console.warn(`Translation file ${filePath} missing 'system' section`);
                            } else if (!parsedContent.system.language_changed) {
                                console.warn(`Translation file ${filePath} missing 'system.language_changed' key`);
                            } else {
                                console.log(`Translation key check - ${language}.system.language_changed: "${parsedContent.system.language_changed}"`);
                            }
                            
                            console.log(`Successfully loaded translations for ${language} with ${Object.keys(parsedContent).length} top-level keys`);
                        } catch (parseErr) {
                            console.error(`JSON parsing error in ${filePath}:`, parseErr);
                            console.log(`First 100 characters of file content: ${content.substring(0, 100)}...`);
                        }
                    } catch (readErr) {
                        console.error(`Error reading translation file ${filePath}:`, readErr);
                    }
                }
            }

            // Validate all required languages are loaded
            for (const lang of this.supportedLanguages) {
                if (!this.translations.has(lang)) {
                    console.error(`Required language '${lang}' translations not found`);
                } else {
                    // Log some keys to verify content
                    const langData = this.translations.get(lang);
                    console.log(`Validated translations for ${lang} with keys: ${Object.keys(langData).join(', ')}`);
                    
                    // Verify specific key exists
                    if (langData.system && langData.system.language_changed) {
                        console.log(`Verified ${lang}.system.language_changed is present`);
                    } else {
                        console.warn(`Missing key system.language_changed for language ${lang}`);
                    }
                }
            }

            // Log loaded languages
            console.log(`Available languages: ${Array.from(this.translations.keys()).join(', ')}`);

            // Ensure default language exists
            if (!this.translations.has(this.defaultLanguage)) {
                console.error(`Default language '${this.defaultLanguage}' translations not found`);
                this.translations.set(this.defaultLanguage, {});
            }
        } catch (err) {
            console.error('Error loading translations:', err);
            // Initialize with empty translations to prevent crashes
            this.translations.set(this.defaultLanguage, {});
        }
    }

    getText(key, lang = null, ...args) {
        try {
            // Use provided language, fallback to config, then default
            const language = lang || config.bot.language || this.defaultLanguage;
            
            // Ensure we have translations loaded
            if (this.translations.size === 0) {
                logger.warn(`No translations loaded yet, returning key: ${key}`);
                return key;
            }
            
            // Only enable verbose logging during development/debugging
            if (this.verbose && process.env.DEBUG_TRANSLATIONS === 'true') {
                logger.debug(`Requested key: ${key}, language: ${language}`);
                logger.debug(`Available languages: ${Array.from(this.translations.keys()).join(', ')}`);
            }

            // Get translations for requested language
            let langData = this.translations.get(language);

            // If translation not found in requested language, try default
            if (!langData && language !== this.defaultLanguage) {
                if (this.verbose && process.env.DEBUG_TRANSLATIONS === 'true') {
                    logger.debug(`Falling back to default language: ${this.defaultLanguage}`);
                }
                langData = this.translations.get(this.defaultLanguage);
            }

            // If still no translations found, return key
            if (!langData) {
                this.logMissingOnce(`No translations found for language: ${language}`);
                return key;
            }

            // Split the key by dots to traverse nested objects
            const keys = key.split('.');
            let text = langData;

            for (const k of keys) {
                if (!text || typeof text !== 'object') {
                    break;
                }
                text = text[k];
            }

            // If translation not found in requested language, try default
            if (!text && language !== this.defaultLanguage) {
                this.logMissingOnce(`Translation not found for ${key} in ${language}, trying default language`);
                return this.getText(key, this.defaultLanguage, ...args);
            }

            // Return key if no translation found
            if (!text) {
                this.logMissingOnce(`Translation not found for key: ${key} in language: ${language}`);
                return key;
            }

            // Replace placeholders with args
            return text.replace(/%s/g, () => args.shift() || '%s');
        } catch (err) {
            logger.error(`Error getting translation for key ${key}:`, err);
            return key;
        }
    }

    /**
     * Log a missing translation message only once to prevent spam
     * @param {string} message - The message to log
     */
    logMissingOnce(message) {
        if (this.translationMissingLog.size < this.maxLoggedMissing && !this.translationMissingLog.has(message)) {
            logger.warn(message);
            this.translationMissingLog.add(message);
            
            // If we've reached the limit, log a warning
            if (this.translationMissingLog.size === this.maxLoggedMissing) {
                logger.warn(`Reached maximum number of logged missing translations (${this.maxLoggedMissing}). Further missing translations will be suppressed.`);
            }
        }
    }
    
    /**
     * Get a list of missing translations for a specific language
     * @param {string} compareLanguage - The language to compare against default language
     * @returns {Array} - List of missing translation keys
     */
    getMissingTranslations(compareLanguage) {
        const defaultLang = this.translations.get(this.defaultLanguage);
        const compareLang = this.translations.get(compareLanguage);
        
        if (!defaultLang) {
            console.error(`Default language ${this.defaultLanguage} not found`);
            return [];
        }
        
        if (!compareLang) {
            console.error(`Compare language ${compareLanguage} not found`);
            return [];
        }
        
        const missingKeys = [];
        
        // Helper function to recursively find missing keys
        const findMissingKeys = (defaultObj, compareObj, currentPath = '') => {
            for (const key in defaultObj) {
                const newPath = currentPath ? `${currentPath}.${key}` : key;
                
                if (typeof defaultObj[key] === 'object' && defaultObj[key] !== null) {
                    // If it's an object, recurse deeper
                    if (!compareObj[key] || typeof compareObj[key] !== 'object') {
                        missingKeys.push(newPath);
                    } else {
                        findMissingKeys(defaultObj[key], compareObj[key], newPath);
                    }
                } else {
                    // It's a leaf node (string, number, etc.)
                    if (compareObj[key] === undefined) {
                        missingKeys.push(newPath);
                    }
                }
            }
        };
        
        findMissingKeys(defaultLang, compareLang);
        return missingKeys;
    }

    /**
     * Analyze the completeness of translations for all languages
     * @returns {Object} - Statistics about translation completeness
     */
    getTranslationStats() {
        const stats = {};
        const defaultLang = this.defaultLanguage;
        const defaultTranslations = this.translations.get(defaultLang);
        
        if (!defaultTranslations) {
            return { error: 'Default language translations not found' };
        }
        
        // Count total keys in default language
        let totalKeys = 0;
        const countKeys = (obj) => {
            for (const key in obj) {
                if (typeof obj[key] === 'object' && obj[key] !== null) {
                    countKeys(obj[key]);
                } else {
                    totalKeys++;
                }
            }
        };
        
        countKeys(defaultTranslations);
        stats.totalKeys = totalKeys;
        stats.languages = {};
        
        // Calculate stats for each language
        for (const [lang, translations] of this.translations.entries()) {
            if (lang === defaultLang) {
                stats.languages[lang] = {
                    keys: totalKeys,
                    missing: 0,
                    percentage: 100
                };
                continue;
            }
            
            const missingKeys = this.getMissingTranslations(lang);
            const percentage = Math.round(((totalKeys - missingKeys.length) / totalKeys) * 100);
            
            stats.languages[lang] = {
                keys: totalKeys - missingKeys.length,
                missing: missingKeys.length,
                percentage
            };
        }
        
        return stats;
    }

    isLanguageSupported(language) {
        const isSupported = this.supportedLanguages.includes(language);
        if (this.verbose) {
            logger.debug(`Language support check: ${language} -> ${isSupported}`);
        }
        return isSupported;
    }

    getAvailableLanguages() {
        return this.supportedLanguages;
    }
}

// Create a singleton instance
const languageManager = new LanguageManager();

// Initialize translations
(async () => {
    try {
        console.log('Initializing language manager...');
        await languageManager.loadTranslations();
        console.log('Language manager initialization complete');
    } catch (err) {
        console.error('Failed to initialize language manager:', err);
    }
})();

module.exports = { languageManager };