/**
 * Helper Utilities
 * A collection of common helper functions used across the application
 */

/**
 * Parse a duration string into seconds
 * @param {string} str Duration string (e.g., "1h", "30m", "1d")
 * @returns {number|null} Duration in seconds, or null if invalid
 */
function parseDuration(str) {
    if (!str || typeof str !== 'string') return null;
    
    // Standardized format: match digits followed by unit (s, m, h, d, w)
    const match = str.trim().match(/^(\d+)([smhdw])$/i);
    if (!match) return null;
    
    const amount = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();
    
    // Convert to seconds
    switch (unit) {
        case 's': return amount;
        case 'm': return amount * 60;
        case 'h': return amount * 60 * 60;
        case 'd': return amount * 24 * 60 * 60;
        case 'w': return amount * 7 * 24 * 60 * 60;
        default: return null;
    }
}

/**
 * Format seconds into a human-readable duration string
 * @param {number} seconds Time in seconds
 * @returns {string} Formatted duration (e.g., "1h 30m")
 */
function formatDuration(seconds) {
    if (typeof seconds !== 'number' || seconds < 0) {
        return '0s';
    }
    
    const units = [
        { label: 'd', value: 24 * 60 * 60 },
        { label: 'h', value: 60 * 60 },
        { label: 'm', value: 60 },
        { label: 's', value: 1 }
    ];
    
    let remainingSeconds = seconds;
    const parts = [];
    
    for (const unit of units) {
        const count = Math.floor(remainingSeconds / unit.value);
        if (count > 0) {
            parts.push(`${count}${unit.label}`);
            remainingSeconds %= unit.value;
        }
    }
    
    return parts.length > 0 ? parts.join(' ') : '0s';
}

/**
 * Format a number with commas as thousands separators
 * @param {number} num Number to format
 * @returns {string} Formatted number
 */
function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/**
 * Generate a random integer between min and max (inclusive)
 * @param {number} min Minimum value
 * @param {number} max Maximum value
 * @returns {number} Random integer
 */
function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Shuffle an array in place using Fisher-Yates algorithm
 * @param {Array} array Array to shuffle
 * @returns {Array} The shuffled array
 */
function shuffleArray(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

/**
 * Wait for specified milliseconds
 * @param {number} ms Milliseconds to wait
 * @returns {Promise<void>} Promise that resolves after the delay
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if a string contains a URL
 * @param {string} text Text to check
 * @returns {boolean} Whether the text contains a URL
 */
function containsUrl(text) {
    const urlRegex = /(https?:\/\/[^\s]+)/gi;
    return urlRegex.test(text);
}

/**
 * Truncate a string with ellipsis if it exceeds maxLength
 * @param {string} str String to truncate
 * @param {number} maxLength Maximum length
 * @returns {string} Truncated string
 */
function truncateString(str, maxLength) {
    if (!str || str.length <= maxLength) return str;
    return str.substring(0, maxLength - 3) + '...';
}

/**
 * Escape special characters in a string for use in regex
 * @param {string} string String to escape
 * @returns {string} Escaped string
 */
function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Convert first character of a string to uppercase
 * @param {string} string String to capitalize
 * @returns {string} Capitalized string
 */
function capitalize(string) {
    if (!string) return '';
    return string.charAt(0).toUpperCase() + string.slice(1);
}

/**
 * Deep clone an object
 * @param {Object} obj Object to clone
 * @returns {Object} Cloned object
 */
function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

/**
 * Check if value is a number or numeric string
 * @param {*} value Value to check
 * @returns {boolean} Whether value is numeric
 */
function isNumeric(value) {
    return !isNaN(parseFloat(value)) && isFinite(value);
}

/**
 * Get a random element from an array
 * @param {Array} array Array to pick from
 * @returns {*} Random element
 */
function getRandomElement(array) {
    return array[Math.floor(Math.random() * array.length)];
}

/**
 * Format a phone number to international format
 * @param {string} phoneNumber Phone number to format
 * @returns {string} Formatted phone number
 */
function formatPhoneNumber(phoneNumber) {
    // Strip any non-numeric characters
    let cleaned = phoneNumber.replace(/\D/g, '');
    
    // If it's a JID, extract just the number part
    if (phoneNumber.includes('@')) {
        cleaned = phoneNumber.split('@')[0];
    }
    
    // Format different phone number lengths appropriately
    if (cleaned.length > 10) {
        // International format with country code
        const countryCode = cleaned.slice(0, cleaned.length - 10);
        const areaCode = cleaned.slice(cleaned.length - 10, cleaned.length - 7);
        const firstPart = cleaned.slice(cleaned.length - 7, cleaned.length - 4);
        const lastPart = cleaned.slice(cleaned.length - 4);
        
        return `+${countryCode} ${areaCode}-${firstPart}-${lastPart}`;
    } else if (cleaned.length === 10) {
        // US format: (123) 456-7890
        const areaCode = cleaned.slice(0, 3);
        const firstPart = cleaned.slice(3, 6);
        const lastPart = cleaned.slice(6);
        
        return `(${areaCode}) ${firstPart}-${lastPart}`;
    } else {
        // Unknown format, add dashes for readability
        if (cleaned.length > 5) {
            const firstPart = cleaned.slice(0, cleaned.length - 4);
            const lastPart = cleaned.slice(cleaned.length - 4);
            return `${firstPart}-${lastPart}`;
        }
        
        return cleaned;
    }
}

module.exports = {
    parseDuration,
    formatDuration,
    formatNumber,
    randomInt,
    shuffleArray,
    sleep,
    containsUrl,
    truncateString,
    escapeRegExp,
    capitalize,
    deepClone,
    isNumeric,
    getRandomElement,
    formatPhoneNumber
};