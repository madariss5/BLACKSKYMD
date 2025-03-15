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

// Cache for URL validations
const URL_VALIDATION_CACHE = new Map();
const VALIDATION_CACHE_DURATION = 60 * 60 * 1000; // 1 hour

async function validateGifUrl(url) {
    // Fast path for common cases
    if (url.endsWith('.gif') || 
        url.includes('tenor.com') || 
        url.includes('giphy.com')) {
        return true;
    }
    
    // Check cache before making HEAD request
    const cacheKey = `url_valid:${url}`;
    const cached = URL_VALIDATION_CACHE.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < VALIDATION_CACHE_DURATION)) {
        return cached.isValid;
    }
    
    // Only make HEAD request if absolutely necessary
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000); // 2 second timeout
        
        const response = await axios.head(url, {
            signal: controller.signal,
            timeout: 2000
        });
        
        clearTimeout(timeoutId);
        
        const isValid = response.headers['content-type']?.includes('gif');
        
        // Cache the result
        URL_VALIDATION_CACHE.set(cacheKey, {
            isValid,
            timestamp: Date.now()
        });
        
        return isValid;
    } catch (err) {
        // Cache negative result too
        URL_VALIDATION_CACHE.set(cacheKey, {
            isValid: false,
            timestamp: Date.now()
        });
        return false;
    }
}

// Cache successful API responses for 15 minutes
const API_CACHE = new Map();
const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes

async function fetchApi(url, fallbacks = [], requireGif = false) {
    const headers = {
        'User-Agent': 'WhatsApp-MD-Bot/1.0',
        'Accept': 'image/gif,image/webp,video/mp4,*/*'
    };
    
    // Generate cache key based on request parameters
    const cacheKey = `${url}|${requireGif}`;
    
    // Check cache first
    const cachedItem = API_CACHE.get(cacheKey);
    if (cachedItem && (Date.now() - cachedItem.timestamp < CACHE_DURATION)) {
        return cachedItem.data;
    }

    async function tryFetch(endpoint) {
        try {
            // Reduce timeout to fail faster on non-responsive APIs
            const response = await axios.get(endpoint, {
                timeout: 3000, // Reduced from 5000ms
                headers
            });

            if (!response.data) return null;

            if (requireGif) {
                const data = response.data;
                const imageUrl = data.url || (data.images && data.images[0]?.url);

                if (!imageUrl) return null;

                // Simple GIF validation without making another request when possible
                const isGif = imageUrl.endsWith('.gif') || 
                              imageUrl.includes('tenor.com') || 
                              imageUrl.includes('giphy.com');
                              
                if (isGif) {
                    return { url: imageUrl };
                }
                
                // Only do a HEAD request if we can't determine from URL
                if (!isGif && !imageUrl.includes('.')) {
                    const isValidGif = await validateGifUrl(imageUrl);
                    if (!isValidGif) return null;
                    return { url: imageUrl };
                }
                
                return null;
            }

            return response.data;
        } catch (err) {
            // Minimal logging in the hot path
            return null;
        }
    }

    // Try primary URL first
    const primaryResult = await tryFetch(url);
    if (primaryResult) {
        // Cache successful result
        API_CACHE.set(cacheKey, {
            data: primaryResult,
            timestamp: Date.now()
        });
        return primaryResult;
    }

    // Try all fallbacks in parallel instead of sequentially
    if (fallbacks && fallbacks.length > 0) {
        try {
            const results = await Promise.allSettled(
                fallbacks.map(fallbackUrl => tryFetch(fallbackUrl))
            );
            
            for (const result of results) {
                if (result.status === 'fulfilled' && result.value) {
                    // Cache successful fallback result
                    API_CACHE.set(cacheKey, {
                        data: result.value,
                        timestamp: Date.now()
                    });
                    return result.value;
                }
            }
        } catch (err) {
            // Fail silently and continue to direct GIFs
        }
    }

    // If all attempts failed, try direct Tenor GIF if available
    if (requireGif) {
        const category = url.split('/').pop();
        if (DIRECT_GIFS[category]) {
            const directResult = { url: DIRECT_GIFS[category] };
            // Cache the direct GIF result
            API_CACHE.set(cacheKey, {
                data: directResult,
                timestamp: Date.now()
            });
            return directResult;
        }
    }

    return null;
}

// Cache for direct Tenor GIF validation results
const GIF_VALIDATION_CACHE = new Map();
const GIF_CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

async function fetchNsfwImage(category, requireGif = false) {
    try {
        const categoryLower = category.toLowerCase();
        
        // For GIF commands, use direct Tenor URLs first (with caching)
        if (requireGif && DIRECT_GIFS[categoryLower]) {
            const gifUrl = DIRECT_GIFS[categoryLower];
            
            // Check validation cache first
            const cacheKey = `gif_valid:${gifUrl}`;
            const cached = GIF_VALIDATION_CACHE.get(cacheKey);
            
            if (cached) {
                if (cached.isValid) {
                    return gifUrl;
                }
            } else {
                // Only validate if not in cache
                const isValid = await validateGifUrl(gifUrl);
                
                // Cache the validation result
                GIF_VALIDATION_CACHE.set(cacheKey, {
                    isValid,
                    timestamp: Date.now()
                });
                
                if (isValid) {
                    return gifUrl;
                }
            }
        }

        // Get category mapping with fast lookup
        const mapping = CATEGORY_MAPPING[categoryLower];
        if (!mapping) {
            return null;
        }

        // Try fetching from APIs (fetchApi already has caching)
        const response = await fetchApi(
            mapping.primary,
            mapping.fallbacks,
            requireGif || mapping.gif
        );

        if (response) {
            // Fast path extraction with null checking
            const url = response.url || 
                       (response.images && response.images[0] && response.images[0].url);
            
            if (url) return url;
        }

        // Reduce logging frequency for failed fetches
        return null;
    } catch (err) {
        // Only log critical errors
        return null;
    }
}

module.exports = {
    fetchNsfwImage,
    API_ENDPOINTS,
    SUPPORTED_CATEGORIES: Object.keys(CATEGORY_MAPPING)
};