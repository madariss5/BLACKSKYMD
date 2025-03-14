/**
 * Utility to fetch NSFW images with proper error handling
 */

const axios = require('axios');
const logger = require('./logger');

// API endpoints for fetching NSFW content
const API_ENDPOINTS = {
    WAIFU: 'https://api.waifu.pics',
    NEKOS: 'https://api.nekos.fun/api',
    HMTAI: 'https://api.hmtai.me',
    TENOR: 'https://tenor.googleapis.com/v2'
};

// Verified working Tenor GIF URLs
const DIRECT_GIFS = {
    'gifboobs': 'https://media.tenor.com/NwS54VoQH9YAAAAC/anime-boobs.gif',
    'gifass': 'https://media.tenor.com/N41zKEDABuUAAAAC/anime-butt.gif',
    'gifhentai': 'https://media.tenor.com/YFzXN8r2h_sAAAAC/anime-lewd.gif',
    'gifblowjob': 'https://media.tenor.com/4XGh4v8UYaEAAAAC/anime-oral.gif'
};

// Map of NSFW category names to endpoints
const CATEGORY_MAPPING = {
    'waifu': {
        primary: 'https://waifu.pics/api/nsfw/waifu',
        fallbacks: [
            'https://api.waifu.im/search/?included_tags=waifu&is_nsfw=true',
            'https://api.nekos.fun/api/waifu'
        ]
    },
    'neko': {
        primary: 'https://waifu.pics/api/nsfw/neko',
        fallbacks: [
            'https://api.waifu.im/search/?included_tags=neko&is_nsfw=true',
            'https://api.nekos.fun/api/neko'
        ]
    },
    'boobs': {
        primary: 'https://api.nekos.fun/api/boobs',
        fallbacks: [
            'https://api.waifu.im/search/?included_tags=paizuri&is_nsfw=true'
        ],
        gif: true
    },
    'ass': {
        primary: 'https://api.nekos.fun/api/ass',
        fallbacks: [
            'https://api.waifu.im/search/?included_tags=hentai&is_nsfw=true'
        ],
        gif: true
    },
    'hentai': {
        primary: 'https://api.nekos.fun/api/hentai',
        fallbacks: [
            'https://api.waifu.im/search/?included_tags=hentai&is_nsfw=true'
        ],
        gif: true
    }
};

async function validateGifUrl(url) {
    try {
        const response = await axios.head(url);
        return response.headers['content-type']?.includes('gif') || 
               url.endsWith('.gif') ||
               url.includes('tenor.com') ||
               url.includes('giphy.com');
    } catch (err) {
        logger.error('Error validating GIF URL:', err);
        return false;
    }
}

async function fetchApi(url, fallbacks = [], requireGif = false) {
    const headers = {
        'User-Agent': 'WhatsApp-MD-Bot/1.0',
        'Accept': 'image/gif,image/webp,video/mp4,*/*'
    };

    async function tryFetch(endpoint) {
        try {
            const response = await axios.get(endpoint, {
                timeout: 5000,
                headers
            });

            if (requireGif) {
                const data = response.data;
                const imageUrl = data.url || (data.images && data.images[0]?.url);

                if (!imageUrl) {
                    logger.warn('No image URL found in response');
                    return null;
                }

                const isGif = await validateGifUrl(imageUrl);
                if (!isGif) {
                    logger.warn('URL is not a GIF:', imageUrl);
                    return null;
                }

                return { url: imageUrl };
            }

            return response.data;
        } catch (err) {
            logger.warn(`API fetch error (${endpoint}):`, err.message);
            return null;
        }
    }

    // Try primary URL first
    const primaryResult = await tryFetch(url);
    if (primaryResult) return primaryResult;

    // Try fallbacks
    for (const fallbackUrl of fallbacks) {
        const fallbackResult = await tryFetch(fallbackUrl);
        if (fallbackResult) return fallbackResult;
    }

    // If all attempts failed, try direct Tenor GIF if available
    if (requireGif) {
        const category = url.split('/').pop();
        if (DIRECT_GIFS[category]) {
            return { url: DIRECT_GIFS[category] };
        }
    }

    return null;
}

async function fetchNsfwImage(category, requireGif = false) {
    try {
        // For GIF commands, use direct Tenor URLs first
        if (requireGif && DIRECT_GIFS[category]) {
            const isValid = await validateGifUrl(DIRECT_GIFS[category]);
            if (isValid) {
                return DIRECT_GIFS[category];
            }
            logger.warn(`Direct GIF URL invalid for category: ${category}`);
        }

        // Get category mapping
        const mapping = CATEGORY_MAPPING[category.toLowerCase()];
        if (!mapping) {
            logger.warn(`No mapping found for category: ${category}`);
            return null;
        }

        // Try fetching from APIs
        const response = await fetchApi(
            mapping.primary,
            mapping.fallbacks,
            requireGif || mapping.gif
        );

        if (response) {
            if (response.url) {
                return response.url;
            } else if (response.images && response.images.length > 0) {
                return response.images[0].url;
            }
        }

        logger.error(`Failed to fetch NSFW ${requireGif ? 'GIF' : 'image'} for category: ${category}`);
        return null;
    } catch (err) {
        logger.error(`Error in fetchNsfwImage for ${category}:`, err);
        return null;
    }
}

module.exports = {
    fetchNsfwImage,
    API_ENDPOINTS,
    SUPPORTED_CATEGORIES: Object.keys(CATEGORY_MAPPING)
};