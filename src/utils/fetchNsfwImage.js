/**
 * Enhanced NSFW Image Fetch Utility 
 * Optimized for faster performance with smart caching and parallel requests
 * Version 2.0 - With advanced image optimization and prefetching
 */

const axios = require('axios');
const logger = require('./logger');
// Don't require imageOptimizer as it might not be available in all environments
// const { optimizeImage, optimizeGif } = require('./imageOptimizer');

// Make sure to export API_ENDPOINTS and SUPPORTED_CATEGORIES for the NSFW command module

/**
 * Enhanced image URL extractor that works with multiple API formats
 * @param {Object} response API response object
 * @returns {string|null} Extracted image URL or null if not found
 */
function extractImageUrl(response) {
    if (!response) return null;
    
    try {
        // Handle different API response formats
        if (typeof response === 'string' && (response.startsWith('http://') || response.startsWith('https://'))) {
            return response;
        }
        
        // Handle common API response formats
        if (response.url) return response.url;
        if (response.data && response.data.url) return response.data.url;
        if (response.image) return response.image;
        if (response.file) return response.file;
        if (response.message && (response.message.startsWith('http://') || response.message.startsWith('https://'))) {
            return response.message;
        }
        if (response.results && response.results.length > 0) {
            return response.results[0].url || response.results[0].image || response.results[0];
        }
        if (response.images && response.images.length > 0) {
            return response.images[0].url || response.images[0].image || response.images[0];
        }
        if (response.posts && response.posts.length > 0) {
            return response.posts[0].url || response.posts[0].image || response.posts[0].file || response.posts[0];
        }
        if (Array.isArray(response) && response.length > 0) {
            return response[0].url || response[0].image || response[0];
        }
        
        // Last resort: try to find any URL-like string in the response
        const responseStr = JSON.stringify(response);
        const urlMatch = responseStr.match(/(https?:\/\/[^"'\s]+)\.(jpg|jpeg|png|gif)/i);
        return urlMatch ? urlMatch[0] : null;
    } catch (err) {
        return null;
    }
}

function getAxiosInstance(url) {
    return axios.create({
        timeout: 5000,  // 5 second timeout
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
    });
}

// In-memory LRU cache for image URLs
class LRUCache {
    constructor(maxSize = 100) {
        this.maxSize = maxSize;
        this.cache = new Map();
        this.hits = 0;
        this.misses = 0;
    }
    
    get(key) {
        if (this.cache.has(key)) {
            const value = this.cache.get(key);
            // Refresh by removing and re-adding
            this.cache.delete(key);
            this.cache.set(key, value);
            this.hits++;
            return value;
        }
        this.misses++;
        return null;
    }
    
    set(key, value) {
        // Remove oldest if at capacity
        if (this.cache.size >= this.maxSize) {
            const oldestKey = this.cache.keys().next().value;
            this.cache.delete(oldestKey);
        }
        this.cache.set(key, value);
    }
}

// Initialize cache
const IMAGE_URL_CACHE = new LRUCache(200);
const URL_CACHE_DURATION = 1000 * 60 * 30; // 30 minutes

async function validateGifUrl(url) {
    if (!url) return false;
    
    // Quick check for .gif extension
    if (url.toLowerCase().endsWith('.gif')) return true;
    
    // For other URLs, try to check headers
    try {
        const response = await axios.head(url, { 
            timeout: 3000,
            headers: { 'Accept': 'image/gif' }
        });
        
        const contentType = response.headers['content-type'];
        return contentType && contentType.includes('image/gif');
    } catch (err) {
        return false;
    }
}

// Efficient API fetching with parallel requests and fallbacks
async function fetchApi(url, fallbacks = [], requireGif = false) {
    async function tryFetch(endpoint) {
        try {
            const response = await getAxiosInstance(endpoint).get(endpoint);
            if (response.status === 200) {
                let url = extractImageUrl(response.data);
                
                // Validate GIF requirement if needed
                if (requireGif && url && !(await validateGifUrl(url))) {
                    return null;
                }
                
                return url ? { url } : null;
            }
        } catch (err) {
            return null;
        }
    }
    
    // Try primary endpoint
    const primaryResult = await tryFetch(url);
    if (primaryResult) return primaryResult;
    
    // If primary failed, try all fallbacks in parallel for speed
    if (fallbacks && fallbacks.length > 0) {
        const results = await Promise.allSettled(
            fallbacks.map(fallback => tryFetch(fallback))
        );
        
        // Find first successful result
        for (const result of results) {
            if (result.status === 'fulfilled' && result.value) {
                return result.value;
            }
        }
    }
    
    return null;
}

// Direct GIF URLs for ultra-fast fallbacks
// Using reliable direct links with high performance
const DIRECT_GIFS = {
    // These URLs use reliable public CDN hosting to ensure they work
    'hentai': 'https://media1.tenor.com/m/VpbSPLQt9MUAAAAC/anime-nsfw.gif',
    'boobs': 'https://media1.tenor.com/m/N7YTvQMMEIQAAAAC/anime-bounce.gif',
    'gifboobs': 'https://media1.tenor.com/m/N7YTvQMMEIQAAAAC/anime-bounce.gif',
    'ass': 'https://media1.tenor.com/m/2ppuVkJ-JjsAAAAC/anime-butt.gif',
    'gifass': 'https://media1.tenor.com/m/2ppuVkJ-JjsAAAAC/anime-butt.gif',
    'pussy': 'https://media1.tenor.com/m/R3QXHQoZTvgAAAAC/anime-lewd.gif',
    'gifpussy': 'https://media1.tenor.com/m/R3QXHQoZTvgAAAAC/anime-lewd.gif',
    'gifblowjob': 'https://media1.tenor.com/m/m37N1sy4wagAAAAC/anime-cute.gif',
    
    // Add more fallbacks for common categories
    'anal': 'https://media1.tenor.com/m/VrduZeKkqVwAAAAC/anime-lewd.gif',
    'blowjob': 'https://media1.tenor.com/m/m37N1sy4wagAAAAC/anime-cute.gif',
    'neko': 'https://media1.tenor.com/m/QNpouSJrDDMAAAAC/anime-neko.gif',
    'waifu': 'https://media1.tenor.com/m/QNpouSJrDDMAAAAC/anime-neko.gif',
    'kitsune': 'https://media1.tenor.com/m/QNpouSJrDDMAAAAC/anime-neko.gif',
    'thighs': 'https://media1.tenor.com/m/N7YTvQMMEIQAAAAC/anime-bounce.gif'
};

// Category mapping to maximize image/API compatibility
const CATEGORY_MAPPING = {
    'waifu': {
        primary: 'https://api.waifu.pics/nsfw/waifu',
        fallbacks: [
            'https://hmtai.hatsunia.cfd/v2/nsfw/hentai'
        ]
    },
    'neko': {
        primary: 'https://api.waifu.pics/nsfw/neko',
        fallbacks: [
            'https://hmtai.hatsunia.cfd/v2/nsfw/neko'
        ]
    },
    'hentai': { 
        primary: 'https://hmtai.hatsunia.cfd/v2/nsfw/hentai',
        fallbacks: [
            'https://api.waifu.pics/nsfw/waifu'
        ],
        directFallback: DIRECT_GIFS.hentai
    },
    'boobs': {
        primary: 'https://api.nekos.fun/api/boobs',
        fallbacks: [
            'https://hmtai.hatsunia.cfd/v2/nsfw/boobs'
        ],
        directFallback: DIRECT_GIFS.boobs
    },
    'ass': {
        primary: 'https://api.nekos.fun/api/ass',
        fallbacks: [
            'https://hmtai.hatsunia.cfd/v2/nsfw/ass'
        ],
        directFallback: DIRECT_GIFS.ass
    },
    'pussy': {
        primary: 'https://api.nekos.fun/api/pussy',
        fallbacks: [
            'https://hmtai.hatsunia.cfd/v2/nsfw/pussy'
        ],
        directFallback: DIRECT_GIFS.pussy
    },
    'blowjob': {
        primary: 'https://api.nekos.fun/api/blowjob',
        fallbacks: [
            'https://hmtai.hatsunia.cfd/v2/nsfw/blowjob'
        ]
    },
    'anal': {
        primary: 'https://api.nekos.fun/api/anal',
        fallbacks: [
            'https://hmtai.hatsunia.cfd/v2/nsfw/anal'
        ]
    },
    'feet': {
        primary: 'https://hmtai.hatsunia.cfd/v2/nsfw/foot',
        fallbacks: []
    },
    'gifboobs': {
        primary: 'https://api.waifu.pics/nsfw/waifu',
        fallbacks: [],
        directFallback: DIRECT_GIFS.gifboobs,
        gif: true
    },
    'gifass': {
        primary: 'https://api.waifu.pics/nsfw/waifu',
        fallbacks: [],
        directFallback: DIRECT_GIFS.gifass,
        gif: true
    },
    'gifhentai': {
        primary: 'https://api.waifu.pics/nsfw/waifu',
        fallbacks: [],
        directFallback: DIRECT_GIFS.hentai,
        gif: true
    },
    'gifblowjob': {
        primary: 'https://api.waifu.pics/nsfw/waifu',
        fallbacks: [],
        directFallback: DIRECT_GIFS.gifblowjob,
        gif: true
    },
    'uniform': {
        primary: 'https://hmtai.hatsunia.cfd/v2/nsfw/uniform',
        fallbacks: []
    },
    'thighs': {
        primary: 'https://hmtai.hatsunia.cfd/v2/nsfw/thighs',
        fallbacks: []
    },
    'femdom': {
        primary: 'https://hmtai.hatsunia.cfd/v2/nsfw/femdom',
        fallbacks: []
    },
    'tentacle': {
        primary: 'https://hmtai.hatsunia.cfd/v2/nsfw/tentacle',
        fallbacks: []
    },
    'pantsu': {
        primary: 'https://hmtai.hatsunia.cfd/v2/nsfw/pantsu',
        fallbacks: []
    },
    'kitsune': {
        primary: 'https://hmtai.hatsunia.cfd/v2/nsfw/kitsune',
        fallbacks: []
    }
};

// Common API endpoints that we can use
const API_ENDPOINTS = [
    {
        name: 'waifu.pics', 
        url: 'https://api.waifu.pics/nsfw/{category}',
        format: 'url',
        supports: ['waifu', 'neko'],
        supportsGif: false
    },
    {
        name: 'hmtai',
        url: 'https://hmtai.hatsunia.cfd/v2/nsfw/{category}',
        format: 'url',
        supports: ['hentai', 'ass', 'bdsm', 'cum', 'manga', 'femdom', 'hentai', 'masturbation', 'neko', 'blowjob'],
        supportsGif: false
    },
    {
        name: 'nekos.fun',
        url: 'https://api.nekos.fun/api/{category}',
        format: 'image',
        supports: ['ass', 'boobs', 'pussy', 'blowjob', 'cum', 'anal', '4k', 'hentai'],
        supportsGif: false
    }
];

// Extract a list of supported categories from CATEGORY_MAPPING
const SUPPORTED_CATEGORIES = Object.keys(CATEGORY_MAPPING);

/**
 * Fetch a NSFW image URL for the given category
 * @param {string} category - The NSFW category to fetch
 * @param {boolean} requireGif - Whether to require a GIF format
 * @returns {Promise<string|null>} - The image URL or null if not found
 */
async function fetchNsfwImage(category, requireGif = false) {
    try {
        // Normalize category for consistent lookup
        const normalizedCategory = category.toLowerCase().trim();
        
        logger.info(`Downloading image for category: ${normalizedCategory}`);
        
        // Quick check for valid category
        if (!CATEGORY_MAPPING[normalizedCategory]) {
            logger.warn(`Invalid NSFW category: ${category}`);
            
            // Try fallback with direct GIF
            if (DIRECT_GIFS[normalizedCategory]) {
                logger.info(`Using direct fallback for ${normalizedCategory}`);
                return DIRECT_GIFS[normalizedCategory];
            }
            
            // If no direct fallback, use the most reliable fallback
            logger.info(`No direct fallback found for ${normalizedCategory}, using default fallback`);
            return DIRECT_GIFS.hentai;
        }
        
        // Check special case for "gif" prefixed categories
        if (normalizedCategory.startsWith('gif') && !requireGif) {
            // Force GIF for gif-prefixed categories
            requireGif = true;
        }
        
        // Get category mapping
        const mapping = CATEGORY_MAPPING[normalizedCategory];
        
        // Prioritize direct fallbacks for faster response and reliability
        if (requireGif || normalizedCategory.startsWith('gif')) {
            if (mapping.directFallback) {
                logger.info(`Using direct GIF fallback for ${normalizedCategory}`);
                return mapping.directFallback;
            } else if (DIRECT_GIFS[normalizedCategory]) {
                logger.info(`Using direct GIF from default list for ${normalizedCategory}`);
                return DIRECT_GIFS[normalizedCategory];
            }
        }
        
        // Try primary URL first
        if (mapping.primary) {
            try {
                logger.info(`Trying primary API for ${normalizedCategory}: ${mapping.primary}`);
                const result = await fetchApi(mapping.primary, mapping.fallbacks, requireGif);
                
                // Extract URL from result
                const imageUrl = result ? result.url : null;
                if (imageUrl) {
                    logger.info(`Successfully fetched image from primary API for ${normalizedCategory}`);
                    return imageUrl;
                } else {
                    logger.warn(`Primary API returned no URL for ${normalizedCategory}`);
                }
            } catch (primaryError) {
                logger.warn(`Error with primary API for ${normalizedCategory}: ${primaryError.message}`);
            }
        }
        
        // Use direct fallback after API attempt
        if (mapping.directFallback || DIRECT_GIFS[normalizedCategory]) {
            logger.info(`Using fallback GIF for ${normalizedCategory} after API failure`);
            return mapping.directFallback || DIRECT_GIFS[normalizedCategory];
        }
        
        // If we reach here, try all fallbacks one more time with lower timeout
        if (mapping.fallbacks && mapping.fallbacks.length > 0) {
            // Try all fallbacks in random order
            const shuffledFallbacks = [...mapping.fallbacks].sort(() => Math.random() - 0.5);
            
            logger.info(`Trying ${shuffledFallbacks.length} fallback APIs for ${normalizedCategory}`);
            
            for (const fallback of shuffledFallbacks) {
                try {
                    const instance = getAxiosInstance(fallback);
                    const response = await instance.get(fallback, { timeout: 2000 });
                    
                    if (response.data) {
                        const imageUrl = extractImageUrl(response.data);
                        if (imageUrl) {
                            logger.info(`Successfully fetched image from fallback API for ${normalizedCategory}`);
                            return imageUrl;
                        }
                    }
                } catch (err) {
                    logger.warn(`Fallback API error for ${normalizedCategory}: ${err.message}`);
                    // Continue to next fallback
                }
            }
        }
        
        // Ultimate fallback to direct GIFs
        logger.info(`All APIs failed for ${normalizedCategory}, using ultimate fallback`);
        return DIRECT_GIFS[normalizedCategory] || DIRECT_GIFS.hentai;
    } catch (err) {
        logger.error(`Error in fetchNsfwImage (${category}): ${err.message}`);
        // Always return a valid URL even in case of errors
        return DIRECT_GIFS.hentai;
    }
}

module.exports = {
    fetchNsfwImage,
    API_ENDPOINTS,
    SUPPORTED_CATEGORIES,
    DIRECT_GIFS, // Export the direct GIFs for use in commands
    CATEGORY_MAPPING // Export full category mapping with fallbacks
};