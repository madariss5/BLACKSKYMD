/**
 * Utility to fetch NSFW images with proper error handling
 * This centralizes the image fetching logic to simplify maintenance
 */

const axios = require('axios');
const logger = require('./logger');

// API endpoints for fetching NSFW content
const API_ENDPOINTS = {
    PRIMARY: 'https://api.waifu.pics',   // Primary API
    FALLBACK1: 'https://waifu.pics/api', // Fallback API 1
    FALLBACK2: 'https://api.waifu.im'    // Fallback API 2
};

// Map of NSFW category names to endpoints in different APIs
const CATEGORY_MAPPING = {
    'waifu': {
        primary: '/nsfw/waifu',
        fallback1: '/nsfw/waifu',
        fallback2: '/search/?included_tags=waifu&is_nsfw=true'
    },
    'neko': {
        primary: '/nsfw/neko',
        fallback1: '/nsfw/neko',
        fallback2: '/search/?included_tags=neko&is_nsfw=true'
    },
    'trap': {
        primary: '/nsfw/trap',
        fallback1: '/nsfw/trap',
        fallback2: '/search/?included_tags=trap&is_nsfw=true'
    },
    'blowjob': {
        primary: '/nsfw/blowjob',
        fallback1: '/nsfw/blowjob',
        fallback2: '/search/?included_tags=oral&is_nsfw=true'
    },
    // Fallback for other categories
    'default': {
        primary: '/nsfw/waifu',
        fallback1: '/nsfw/waifu',
        fallback2: '/search/?is_nsfw=true'
    }
};

/**
 * Fetch from an API with error handling and fallbacks
 * @param {string} url Primary API URL to attempt
 * @param {Array<string>} fallbacks Optional fallback URLs to try if primary fails
 * @returns {Promise<any>} API response object or null if all attempts fail
 */
async function fetchApi(url, fallbacks = []) {
    // Try the primary URL first
    try {
        const response = await axios.get(url, { 
            timeout: 5000,  // 5 second timeout
            headers: { 'User-Agent': 'WhatsApp-MD-Bot/1.0' }
        });
        return response.data;
    } catch (err) {
        logger.warn(`Primary API fetch error (${url}):`, err.message);
        
        // If we have fallbacks, try them in sequence
        if (fallbacks && fallbacks.length > 0) {
            logger.info(`Attempting ${fallbacks.length} fallback APIs`);
            
            for (const fallbackUrl of fallbacks) {
                try {
                    logger.info(`Trying fallback API: ${fallbackUrl}`);
                    const response = await axios.get(fallbackUrl, { 
                        timeout: 5000,
                        headers: { 'User-Agent': 'WhatsApp-MD-Bot/1.0' }
                    });
                    logger.info(`Fallback API success: ${fallbackUrl}`);
                    return response.data;
                } catch (fallbackErr) {
                    logger.warn(`Fallback API fetch error (${fallbackUrl}):`, fallbackErr.message);
                    // Continue to next fallback
                }
            }
        }
        
        // If all attempts failed, return null
        logger.error(`All API fetch attempts failed for ${url}`);
        return null;
    }
}

/**
 * Fetch an NSFW image by category
 * @param {string} category - The NSFW category to fetch (e.g., 'waifu', 'neko')
 * @returns {Promise<string|null>} URL of the image or null if fetching failed
 */
async function fetchNsfwImage(category) {
    try {
        // Get category mapping or use default if category not found
        const mapping = CATEGORY_MAPPING[category.toLowerCase()] || CATEGORY_MAPPING.default;
        
        // Create URLs for primary and fallbacks
        const primaryUrl = `${API_ENDPOINTS.PRIMARY}${mapping.primary}`;
        const fallbacks = [
            `${API_ENDPOINTS.FALLBACK1}${mapping.fallback1}`,
            `${API_ENDPOINTS.FALLBACK2}${mapping.fallback2}`
        ];
        
        // Try fetching from primary and fallbacks
        const response = await fetchApi(primaryUrl, fallbacks);
        
        // Handle different API response formats
        if (response) {
            if (response.url) {
                // Standard API format
                return response.url;
            } else if (response.images && response.images.length > 0) {
                // waifu.im API format
                return response.images[0].url;
            }
        }
        
        logger.error(`Failed to fetch NSFW image for category: ${category}`);
        return null;
    } catch (err) {
        logger.error(`Error in fetchNsfwImage for ${category}:`, err);
        return null;
    }
}

module.exports = {
    fetchNsfwImage,
    SUPPORTED_CATEGORIES: Object.keys(CATEGORY_MAPPING)
};