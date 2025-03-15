/**
 * Update NSFW Module Logging Statements
 * This script updates all sender logging in nsfw.js to use formatJidForLogging
 */
const fs = require('fs');
const path = require('path');
const util = require('util');

const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);

async function updateNsfwLogging() {
    try {
        const filePath = path.join(process.cwd(), 'src', 'commands', 'nsfw.js');
        
        // Read the file
        let content = await readFile(filePath, 'utf8');
        
        // Pattern to find logs with sender variable
        const logPattern = /logger\.info\(`(.*?)(\${sender})(.*?)`\);/g;
        
        // Replace with formatted log statements
        content = content.replace(logPattern, 'logger.info(`$1${formatJidForLogging(sender)}$3`);');
        
        // Save the changes
        await writeFile(filePath, content);
        
        console.log('Successfully updated all logging statements in nsfw.js');
        
        // Count how many replacements were made
        const originalMatches = content.match(logPattern);
        console.log(`Updated ${originalMatches ? originalMatches.length : 0} logging statements.`);
        
    } catch (err) {
        console.error('Error updating NSFW logging:', err);
    }
}

updateNsfwLogging();
