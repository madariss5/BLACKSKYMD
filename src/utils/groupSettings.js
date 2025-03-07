const path = require('path');
const fs = require('fs').promises;
const logger = require('./logger');

/**
 * Get settings for a specific group
 * @param {string} jid Group JID
 * @returns {Promise<Object>} Group settings
 */
async function getGroupSettings(jid) {
    const filePath = path.join(__dirname, '../../data/groups', `${jid}.json`);
    try {
        const data = await fs.readFile(filePath, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        if (err.code === 'ENOENT') {
            // Return default settings if file doesn't exist
            return {
                warnings: {},
                antispam: false,
                antilink: false,
                antitoxic: false,
                antiraid: false,
                raidThreshold: 5,
                polls: {},
                scheduled: []
            };
        }
        logger.error(`Failed to read group settings for ${jid}:`, err);
        throw err;
    }
}

/**
 * Save settings for a specific group
 * @param {string} jid Group JID
 * @param {Object} settings Group settings
 */
async function saveGroupSettings(jid, settings) {
    const filePath = path.join(__dirname, '../../data/groups', `${jid}.json`);
    try {
        await fs.writeFile(filePath, JSON.stringify(settings, null, 2));
    } catch (err) {
        logger.error(`Failed to save group settings for ${jid}:`, err);
        throw err;
    }
}

/**
 * Validate group settings object
 * @param {Object} settings Group settings
 * @returns {boolean} Whether settings are valid
 */
function validateGroupSettings(settings) {
    // Check if required properties exist and have correct types
    if (!settings || typeof settings !== 'object') return false;
    
    const requiredProps = {
        warnings: 'object',
        antispam: 'boolean',
        antilink: 'boolean',
        antitoxic: 'boolean',
        antiraid: 'boolean',
        raidThreshold: 'number',
        polls: 'object',
        scheduled: 'object'
    };

    return Object.entries(requiredProps).every(([prop, type]) => 
        settings.hasOwnProperty(prop) && typeof settings[prop] === type
    );
}

module.exports = {
    getGroupSettings,
    saveGroupSettings,
    validateGroupSettings
};
