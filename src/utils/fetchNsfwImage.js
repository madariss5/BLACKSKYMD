/**
 * Enhanced NSFW Image Fetch Utility 
 * Optimized for faster performance with smart caching and parallel requests
 */

const axios = require('axios');
const logger = require('./logger');

// API endpoints for fetching NSFW content
const API_ENDPOINTS = {
    WAIFU: 'https://api.waifu.pics',
    NEKOS: 'https://api.nekos.fun/api',
    HMTAI: 'https://hmtai.hatsunia.cfd/v2', // Updated endpoint
    TENOR: 'https://tenor.googleapis.com/v2'
};

// Guaranteed working direct GIF URLs as ultimate fallbacks
const DIRECT_GIFS = {
    'gifboobs': 'https://media.tenor.com/NwS54VoQH9YAAAAC/anime-boobs.gif',
    'gifass': 'https://media.tenor.com/N41zKEDABuUAAAAC/anime-butt.gif',
    'gifhentai': 'https://media.tenor.com/YFzXN8r2h_sAAAAC/anime-lewd.gif',
    'gifblowjob': 'https://media.tenor.com/4XGh4v8UYaEAAAAC/anime-oral.gif',
    'boobs': 'https://media.tenor.com/NwS54VoQH9YAAAAC/anime-boobs.gif',
    'ass': 'https://media.tenor.com/N41zKEDABuUAAAAC/anime-butt.gif',
    'hentai': 'https://media.tenor.com/YFzXN8r2h_sAAAAC/anime-lewd.gif',
    'blowjob': 'https://media.tenor.com/4XGh4v8UYaEAAAAC/anime-oral.gif'
};

// Map of NSFW category names to endpoints - expanded with more options
const CATEGORY_MAPPING = {
    'waifu': {
        primary: 'https://api.waifu.pics/nsfw/waifu',
        fallbacks: [
            'https://api.waifu.im/search/?included_tags=waifu&is_nsfw=true',
            'https://api.nekos.fun/api/waifu',
            'https://api.waifu.pics/nsfw/waifu'
        ]
    },
    'neko': {
        primary: 'https://api.waifu.pics/nsfw/neko',
        fallbacks: [
            'https://api.waifu.im/search/?included_tags=neko&is_nsfw=true',
            'https://api.nekos.fun/api/neko',
            'https://api.waifu.pics/nsfw/neko'
        ]
    },
    'boobs': {
        primary: 'https://api.nekos.fun/api/boobs',
        fallbacks: [
            'https://hmtai.hatsunia.cfd/v2/nsfw/boobs',
            'https://api.waifu.im/search/?included_tags=paizuri&is_nsfw=true'
        ],
        directFallback: 'https://media.tenor.com/NwS54VoQH9YAAAAC/anime-boobs.gif',
        gif: true
    },
    'ass': {
        primary: 'https://api.nekos.fun/api/ass',
        fallbacks: [
            'https://hmtai.hatsunia.cfd/v2/nsfw/ass',
            'https://api.waifu.im/search/?included_tags=hentai&is_nsfw=true'
        ],
        directFallback: 'https://media.tenor.com/N41zKEDABuUAAAAC/anime-butt.gif',
        gif: true
    },
    'hentai': {
        primary: 'https://api.nekos.fun/api/hentai',
        fallbacks: [
            'https://hmtai.hatsunia.cfd/v2/nsfw/hentai',
            'https://api.waifu.im/search/?included_tags=hentai&is_nsfw=true'
        ],
        directFallback: 'https://media.tenor.com/YFzXN8r2h_sAAAAC/anime-lewd.gif',
        gif: true
    }
};

// PERFORMANCE OPTIMIZATION: Create permanent axios instances for each domain to reuse connections
const axiosInstances = new Map();

function getAxiosInstance(url) {
    try {
        const domain = new URL(url).hostname;
        
        if (!axiosInstances.has(domain)) {
            axiosInstances.set(domain, axios.create({
                timeout: 2500, // Reduced timeout for faster failure
                headers: {
                    'User-Agent': 'WhatsApp-MD-Bot/1.0',
                    'Accept': 'image/gif,image/webp,video/mp4,*/*'
                },
                // Connection reuse for HTTP keep-alive
                maxContentLength: 10 * 1024 * 1024, // 10MB max content length
                decompress: true, // Auto-decompress responses
            }));
        }
        
        return axiosInstances.get(domain);
    } catch (err) {
        // Fallback to default axios if URL parsing fails
        return axios;
    }
}

// PERFORMANCE OPTIMIZATION: Improved multi-level caching
// Level 1: In-memory LRU cache with faster lookups
class LRUCache {
    constructor(maxSize = 100) {
        this.cache = new Map();
        this.maxSize = maxSize;
    }
    
    get(key) {
        if (!this.cache.has(key)) return null;
        
        // Access refreshes item position in cache
        const item = this.cache.get(key);
        this.cache.delete(key);
        this.cache.set(key, item);
        
        return item;
    }
    
    set(key, value) {
        // Evict oldest item if at capacity
        if (this.cache.size >= this.maxSize) {
            const oldestKey = this.cache.keys().next().value;
            this.cache.delete(oldestKey);
        }
        
        this.cache.set(key, value);
    }
}

// Initialize caches with optimized sizes
const URL_VALIDATION_CACHE = new LRUCache(200); // URL validation cache
const API_CACHE = new LRUCache(100); // API response cache
const GIF_VALIDATION_CACHE = new LRUCache(50); // GIF validation cache
const IMAGE_URL_CACHE = new LRUCache(300); // Final image URL cache

// Cache durations
const VALIDATION_CACHE_DURATION = 2 * 60 * 60 * 1000; // 2 hours
const API_CACHE_DURATION = 30 * 60 * 1000; // 30 minutes
const GIF_CACHE_DURATION = 60 * 60 * 1000; // 1 hour
const URL_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

// PERFORMANCE OPTIMIZATION: Fast URL validation without HEAD requests when possible
async function validateGifUrl(url) {
    // Fast path with pattern matching for common cases
    if (url.endsWith('.gif') || 
        url.includes('tenor.com') || 
        url.includes('giphy.com') ||
        url.includes('media') && url.includes('.gif')) {
        return true;
    }
    
    // Check cache
    const cacheKey = `url_valid:${url}`;
    const cached = URL_VALIDATION_CACHE.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < VALIDATION_CACHE_DURATION)) {
        return cached.isValid;
    }
    
    // Only make HEAD request if absolutely necessary
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1500); // 1.5s timeout
        
        const instance = getAxiosInstance(url);
        const response = await instance.head(url, {
            signal: controller.signal,
            timeout: 1500
        });
        
        clearTimeout(timeoutId);
        
        const isValid = response.headers['content-type']?.includes('gif') ||
                       response.headers['content-type']?.includes('image');
        
        // Cache the result
        URL_VALIDATION_CACHE.set(cacheKey, {
            isValid,
            timestamp: Date.now()
        });
        
        return isValid;
    } catch (err) {
        // Cache negative result to avoid retrying bad URLs
        URL_VALIDATION_CACHE.set(cacheKey, {
            isValid: false,
            timestamp: Date.now()
        });
        return false;
    }
}

// PERFORMANCE OPTIMIZATION: Smart fetch with parallel requests & early response
async function fetchApi(url, fallbacks = [], requireGif = false) {
    // Generate cache key
    const cacheKey = `${url}|${requireGif}`;
    
    // Check cache first (fast path)
    const cachedItem = API_CACHE.get(cacheKey);
    if (cachedItem && (Date.now() - cachedItem.timestamp < API_CACHE_DURATION)) {
        return cachedItem.data;
    }

    // Helper function to fetch from a single endpoint
    async function tryFetch(endpoint) {
        try {
            const instance = getAxiosInstance(endpoint);
            const response = await instance.get(endpoint, {
                timeout: 2500 // 2.5s timeout
            });

            if (!response.data) return null;

            // Handle GIF validation if needed
            if (requireGif) {
                const data = response.data;
                const imageUrl = data.url || 
                               (data.images && data.images[0]?.url) ||
                               (data.data && data.data.url);

                if (!imageUrl) return null;

                // Fast path for obvious GIFs
                if (imageUrl.endsWith('.gif') || 
                    imageUrl.includes('tenor.com') || 
                    imageUrl.includes('giphy.com')) {
                    return { url: imageUrl };
                }
                
                // Only validate ambiguous URLs
                if (!imageUrl.includes('.') || 
                    !imageUrl.match(/\.(jpe?g|png|gif|webp)$/i)) {
                    const isValidGif = await validateGifUrl(imageUrl);
                    if (!isValidGif) return null;
                }
                
                return { url: imageUrl };
            }

            return response.data;
        } catch (err) {
            // Silent fail for individual endpoints
            return null;
        }
    }

    // OPTIMIZATION: Try primary + all fallbacks simultaneously
    const allEndpoints = [url, ...(fallbacks || [])];
    
    // Create a pool of promises and use the first successful result
    const promises = allEndpoints.map(endpoint => 
        tryFetch(endpoint)
            .then(result => result ? { endpoint, result } : null)
            .catch(() => null)
    );
    
    // Use Promise.race to get the first successful result
    try {
        // First try to get any successful response as fast as possible
        const racePromise = Promise.race(
            promises.map(p => 
                p.then(result => result ? result : new Promise(resolve => setTimeout(() => resolve(null), 10000)))
            )
        );
        
        // Set a timeout for the race
        const timeoutPromise = new Promise(resolve => 
            setTimeout(() => resolve(null), 3000) // 3s max wait for any response
        );
        
        // Race between the first success and timeout
        const fastResult = await Promise.race([racePromise, timeoutPromise]);
        
        if (fastResult) {
            // Cache successful result
            API_CACHE.set(cacheKey, {
                data: fastResult.result,
                timestamp: Date.now()
            });
            return fastResult.result;
        }
        
        // If no fast result, wait for all promises to settle and check results
        const results = await Promise.allSettled(promises);
        for (const result of results) {
            if (result.status === 'fulfilled' && result.value) {
                // Cache successful result
                API_CACHE.set(cacheKey, {
                    data: result.value.result,
                    timestamp: Date.now()
                });
                return result.value.result;
            }
        }
    } catch (err) {
        // Silent failure, continue to direct fallbacks
    }

    // If all API attempts failed, use direct Tenor GIF if available
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

// PERFORMANCE OPTIMIZATION: Enhanced NSFW image fetching with parallel requests
async function fetchNsfwImage(category, requireGif = false) {
    try {
        const categoryLower = category.toLowerCase();
        
        // Check image URL cache first (fastest path)
        const urlCacheKey = `img_url:${categoryLower}:${requireGif}`;
        const cachedUrl = IMAGE_URL_CACHE.get(urlCacheKey);
        if (cachedUrl && (Date.now() - cachedUrl.timestamp < URL_CACHE_DURATION)) {
            return cachedUrl.url;
        }
        
        // For certain categories, try direct GIFs immediately (ultra-fast path)
        if ((requireGif || categoryLower.startsWith('gif')) && DIRECT_GIFS[categoryLower]) {
            const gifUrl = DIRECT_GIFS[categoryLower];
            
            // Cache this URL
            IMAGE_URL_CACHE.set(urlCacheKey, {
                url: gifUrl,
                timestamp: Date.now()
            });
            
            return gifUrl;
        }

        // Get category mapping
        const mapping = CATEGORY_MAPPING[categoryLower];
        if (!mapping) {
            // Try generic category fallback for unknown categories
            const genericMapping = {
                primary: `https://api.waifu.pics/nsfw/${categoryLower}`,
                fallbacks: [
                    `https://hmtai.hatsunia.cfd/v2/nsfw/${categoryLower}`,
                    `https://api.nekos.fun/api/${categoryLower}`
                ]
            };
            
            // Try fetching with generic mapping
            const response = await fetchApi(
                genericMapping.primary,
                genericMapping.fallbacks,
                requireGif
            );
            
            if (response) {
                const url = response.url || 
                          (response.images && response.images[0]?.url) ||
                          (response.data && response.data.url);
                
                if (url) {
                    // Cache successful URL
                    IMAGE_URL_CACHE.set(urlCacheKey, {
                        url,
                        timestamp: Date.now()
                    });
                    
                    return url;
                }
            }
            
            return null;
        }

        // Use efficient parallel fetching
        const response = await fetchApi(
            mapping.primary,
            mapping.fallbacks,
            requireGif || mapping.gif
        );

        if (response) {
            const url = response.url || 
                      (response.images && response.images[0]?.url) ||
                      (response.data && response.data.url);
            
            if (url) {
                // Cache successful URL
                IMAGE_URL_CACHE.set(urlCacheKey, {
                    url,
                    timestamp: Date.now()
                });
                
                return url;
            }
        }
        
        // Final fallback: use direct fallbacks if available
        if (mapping.directFallback) {
            // Cache this fallback URL
            IMAGE_URL_CACHE.set(urlCacheKey, {
                url: mapping.directFallback,
                timestamp: Date.now()
            });
            
            return mapping.directFallback;
        }

        return null;
    } catch (err) {
        // Minimize error impact
        return null;
    }
}

module.exports = {
    fetchNsfwImage,
    API_ENDPOINTS,
    SUPPORTED_CATEGORIES: Object.keys(CATEGORY_MAPPING)
};