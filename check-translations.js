/**
 * Translation Completeness Checker
 * This script checks if all command strings in the English language file
 * are properly translated in the German language file.
 */

const fs = require('fs').promises;
const path = require('path');
const { languageManager } = require('./src/utils/language');

async function loadTranslationFile(language) {
    try {
        const filePath = path.join(process.cwd(), 'src', 'translations', `${language}.json`);
        const content = await fs.readFile(filePath, 'utf8');
        return JSON.parse(content);
    } catch (err) {
        console.error(`Error loading ${language}.json:`, err.message);
        return null;
    }
}

function findMissingTranslations(defaultTranslations, targetTranslations, prefix = '') {
    const missingKeys = [];
    
    for (const key in defaultTranslations) {
        const currentPath = prefix ? `${prefix}.${key}` : key;
        
        // If property is an object (not array, not null) - recurse deeper
        if (
            typeof defaultTranslations[key] === 'object' && 
            defaultTranslations[key] !== null &&
            !Array.isArray(defaultTranslations[key])
        ) {
            // Check if key exists in target translations
            if (!targetTranslations || !targetTranslations[key] || typeof targetTranslations[key] !== 'object') {
                missingKeys.push({
                    path: currentPath,
                    type: 'missing_object',
                    english: JSON.stringify(defaultTranslations[key]).substring(0, 50) + '...'
                });
            } else {
                // Recursively check nested objects
                const nestedMissing = findMissingTranslations(
                    defaultTranslations[key], 
                    targetTranslations[key], 
                    currentPath
                );
                missingKeys.push(...nestedMissing);
            }
        } else {
            // It's a leaf node (string, number, etc.)
            if (!targetTranslations || targetTranslations[key] === undefined) {
                missingKeys.push({
                    path: currentPath,
                    type: 'missing_string',
                    english: String(defaultTranslations[key]).substring(0, 100)
                });
            } else if (targetTranslations[key] === defaultTranslations[key] && 
                      typeof defaultTranslations[key] === 'string' &&
                      defaultTranslations[key].length > 3 &&
                      !/^[0-9.,%\s]+$/.test(defaultTranslations[key]) && // Skip numbers and symbols
                      !/%[sdf]/.test(defaultTranslations[key])) { // Skip format strings
                // Key exists but has the same value as English (possibly untranslated)
                missingKeys.push({
                    path: currentPath,
                    type: 'identical_value',
                    english: String(defaultTranslations[key]).substring(0, 100),
                    german: String(targetTranslations[key]).substring(0, 100)
                });
            }
        }
    }
    
    return missingKeys;
}

function generateSuggestedTranslation(englishText) {
    // This isn't a real translator, just a simple word replacement for common terms
    // In a production app, you'd use a proper translation API
    const simpleMappings = {
        "the": "die",
        "a": "ein",
        "is": "ist",
        "are": "sind",
        "with": "mit",
        "for": "für",
        "command": "Befehl",
        "commands": "Befehle",
        "user": "Benutzer",
        "group": "Gruppe",
        "error": "Fehler",
        "success": "Erfolg",
        "not": "nicht",
        "found": "gefunden",
        "please": "bitte",
        "try": "versuche",
        "again": "erneut",
        "help": "Hilfe",
        "info": "Info",
        "status": "Status",
        "settings": "Einstellungen",
        "enabled": "aktiviert",
        "disabled": "deaktiviert",
        "on": "an",
        "off": "aus",
        "yes": "ja",
        "no": "nein",
        "send": "senden",
        "receive": "erhalten",
        "message": "Nachricht",
        "profile": "Profil",
        "image": "Bild",
        "video": "Video",
        "sticker": "Sticker",
        "audio": "Audio",
        "file": "Datei",
        "link": "Link",
        "list": "Liste",
        "menu": "Menü",
        "option": "Option",
        "level": "Level",
        "experience": "Erfahrung",
        "point": "Punkt",
        "points": "Punkte"
    };
    
    // Very simple word replacement (not grammatically correct)
    let suggested = englishText;
    Object.entries(simpleMappings).forEach(([en, de]) => {
        // Replace whole words only with word boundaries
        const regex = new RegExp(`\\b${en}\\b`, 'gi');
        suggested = suggested.replace(regex, de);
    });
    
    return suggested;
}

function generateTranslationReport(missingTranslations) {
    if (missingTranslations.length === 0) {
        return "✅ All translations are complete. No missing keys found.";
    }
    
    // Group by category (first part of the path)
    const byCategory = {};
    missingTranslations.forEach(item => {
        const category = item.path.split('.')[0];
        if (!byCategory[category]) {
            byCategory[category] = [];
        }
        byCategory[category].push(item);
    });
    
    let report = `# Translation Completeness Report\n\n`;
    report += `**Total missing translations: ${missingTranslations.length}**\n\n`;
    
    // Add each category
    Object.entries(byCategory).forEach(([category, items]) => {
        report += `## ${category} (${items.length} missing)\n\n`;
        
        // Table header
        report += "| Path | English Text | Suggestion |\n";
        report += "|------|-------------|------------|\n";
        
        // Table rows
        items.forEach(item => {
            const path = item.path;
            const english = item.english.replace(/\n/g, ' ').replace(/\|/g, '\\|');
            const suggestion = generateSuggestedTranslation(english);
            
            report += `| \`${path}\` | ${english} | ${suggestion} |\n`;
        });
        
        report += "\n";
    });
    
    report += "## How to Add Missing Translations\n\n";
    report += "1. Open `/src/translations/de.json`\n";
    report += "2. Locate the appropriate section based on the path\n";
    report += "3. Add the missing translation\n";
    report += "4. Make sure to maintain proper JSON format\n\n";
    
    report += "Example for `category.command_name`:\n";
    report += "```json\n{\n  \"category\": {\n    \"command_name\": \"German translation here\"\n  }\n}\n```\n";
    
    return report;
}

async function analyzeCategoriesWithCommands() {
    // Load command configurations to see which commands exist
    const commandConfigDir = path.join(process.cwd(), 'src', 'config', 'commands');
    const commandConfigs = {};
    
    try {
        const files = await fs.readdir(commandConfigDir);
        for (const file of files) {
            if (file.endsWith('.json')) {
                const category = file.replace('.json', '');
                const filePath = path.join(commandConfigDir, file);
                const content = await fs.readFile(filePath, 'utf8');
                commandConfigs[category] = JSON.parse(content);
            }
        }
    } catch (err) {
        console.error("Error loading command configs:", err);
    }
    
    return commandConfigs;
}

async function main() {
    try {
        // Ensure language manager initializes
        if (typeof languageManager.getText !== 'function') {
            console.log("Initializing language manager...");
            await languageManager.loadTranslations();
        }
        
        // Load translation files
        console.log("Loading translation files...");
        const enTranslations = await loadTranslationFile('en');
        const deTranslations = await loadTranslationFile('de');
        
        if (!enTranslations || !deTranslations) {
            console.error("Failed to load translation files. Check if they exist in src/translations/");
            return;
        }
        
        // Find missing translations
        console.log("Analyzing translation completeness...");
        const missingTranslations = findMissingTranslations(enTranslations, deTranslations);
        
        // Get command categories and commands
        console.log("Analyzing command categories...");
        const commandConfigs = await analyzeCategoriesWithCommands();
        
        console.log("Generating translation report...");
        const report = generateTranslationReport(missingTranslations);
        
        // Write report to file
        const reportPath = path.join(process.cwd(), 'translation-report.md');
        await fs.writeFile(reportPath, report);
        
        console.log(`\nTranslation completeness: ${((1 - missingTranslations.length / Object.keys(enTranslations).length) * 100).toFixed(2)}%`);
        console.log(`Report written to: ${reportPath}`);
        console.log(`\nMissing translations by category:`);
        
        // Group by top-level category
        const categoryCounts = {};
        missingTranslations.forEach(item => {
            const category = item.path.split('.')[0];
            categoryCounts[category] = (categoryCounts[category] || 0) + 1;
        });
        
        // Print table of missing translations by category
        console.log("| Category | Missing Translations |");
        console.log("|----------|---------------------|");
        Object.entries(categoryCounts)
            .sort((a, b) => b[1] - a[1])  // Sort by count, descending
            .forEach(([category, count]) => {
                console.log(`| ${category} | ${count} |`);
            });
            
        // Check command translations specifically
        console.log("\nChecking command-specific translations:");
        let commandsMissingTranslations = 0;
        
        for (const category in commandConfigs) {
            const commands = commandConfigs[category];
            for (const commandName in commands) {
                // Try to get command translation in German
                const translationKey = `${category}.${commandName}`;
                const hasTranslation = deTranslations[category] && 
                                      (deTranslations[category][commandName] !== undefined ||
                                       typeof deTranslations[category][commandName] === 'object');
                
                if (!hasTranslation) {
                    console.log(`Missing command translation: ${translationKey}`);
                    commandsMissingTranslations++;
                }
            }
        }
        
        console.log(`\nCommands missing translations: ${commandsMissingTranslations}`);
        console.log("Complete! Check translation-report.md for details.");
        
    } catch (err) {
        console.error("Error in translation analysis:", err);
    }
}

main();