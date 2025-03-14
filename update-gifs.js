/**
 * Update Reaction GIFs Script
 * Downloads new reaction GIFs from Tenor for specified commands
 */
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { promisify } = require('util');
const fsWriteFile = promisify(fs.writeFile);
const fsAccess = promisify(fs.access);
const fsRename = promisify(fs.rename);

// Load environment variables
require('dotenv').config();

// Constants
const REACTIONS_DIR = path.join(process.cwd(), 'data', 'reaction_gifs');
const TENOR_API_KEY = process.env.TENOR_API_KEY;
const DETAIL_INFO_DIR = path.join(REACTIONS_DIR, 'detail_info');

// Commands that need new GIFs
const COMMANDS_TO_UPDATE = [
    { name: 'bonk', query: 'anime bonk' },
    { name: 'pat', query: 'anime pat head' },
    { name: 'poke', query: 'anime poke' },
    { name: 'punch', query: 'anime punch' },
    { name: 'smile', query: 'anime smile' },
    { name: 'wave', query: 'anime wave' },
    { name: 'wink', query: 'anime wink' }
];

/**
 * Check if a file exists
 * @param {string} filePath - Path to check
 * @returns {Promise<boolean>} - Whether file exists
 */
async function fileExists(filePath) {
    try {
        await fsAccess(filePath, fs.constants.F_OK);
        return true;
    } catch (error) {
        return false;
    }
}

/**
 * Backup the original GIF if it exists
 * @param {string} filePath - Path to the GIF
 * @returns {Promise<boolean>} - Whether backup was successful
 */
async function backupGif(filePath) {
    try {
        if (await fileExists(filePath)) {
            const backupPath = `${filePath}.original`;
            // Only backup if backup doesn't already exist
            if (!(await fileExists(backupPath))) {
                await fsRename(filePath, backupPath);
                console.log(`✅ Backed up ${path.basename(filePath)} to ${path.basename(backupPath)}`);
            } else {
                console.log(`ℹ️ Backup already exists for ${path.basename(filePath)}`);
            }
            return true;
        }
        return false;
    } catch (error) {
        console.error(`❌ Error backing up ${filePath}:`, error.message);
        return false;
    }
}

/**
 * Search for a GIF using Tenor API
 * @param {string} query - Search query
 * @returns {Promise<string|null>} - URL of found GIF or null
 */
async function searchGif(query) {
    try {
        console.log(`🔍 Searching for "${query}"...`);
        
        if (!TENOR_API_KEY) {
            throw new Error('TENOR_API_KEY is not set in environment variables');
        }
        
        const response = await axios.get('https://tenor.googleapis.com/v2/search', {
            params: {
                q: query,
                key: TENOR_API_KEY,
                limit: 15,
                media_filter: 'gif',
                contentfilter: 'medium'
            }
        });
        
        if (response.data?.results?.length > 0) {
            // Get a random result from top results (prefer earlier results)
            const randomIndex = Math.floor(Math.random() * Math.min(response.data.results.length, 8));
            const result = response.data.results[randomIndex];
            
            // Find a suitable sized GIF (prefer smaller sizes but not tiny)
            let gifUrl = null;
            let gifSize = 'medium';
            
            if (result.media_formats) {
                // Try to find a good balance between size and quality
                if (result.media_formats.gif) {
                    gifUrl = result.media_formats.gif.url;
                    gifSize = 'full';
                } else if (result.media_formats.mediumgif) {
                    gifUrl = result.media_formats.mediumgif.url;
                    gifSize = 'medium';
                } else if (result.media_formats.tinygif) {
                    gifUrl = result.media_formats.tinygif.url;
                    gifSize = 'tiny';
                }
            }
            
            if (gifUrl) {
                console.log(`✅ Found ${gifSize} GIF for "${query}"`);
                
                // Store metadata for attribution
                const metadata = {
                    title: result.title || 'Unnamed GIF',
                    id: result.id,
                    createdAt: new Date().toISOString(),
                    url: gifUrl,
                    tenorUrl: result.url,
                    searchQuery: query,
                    source: 'Tenor API'
                };
                
                return { url: gifUrl, metadata };
            }
        }
        
        throw new Error(`No results found for "${query}"`);
    } catch (error) {
        console.error(`❌ Error searching for "${query}":`, error.message);
        return null;
    }
}

/**
 * Download a GIF from a URL
 * @param {string} url - URL to download from
 * @param {string} filePath - Path to save the GIF
 * @returns {Promise<boolean>} - Whether download was successful
 */
async function downloadGif(url, filePath) {
    try {
        console.log(`⬇️ Downloading GIF to ${path.basename(filePath)}...`);
        
        const response = await axios({
            method: 'GET',
            url: url,
            responseType: 'arraybuffer'
        });
        
        await fsWriteFile(filePath, Buffer.from(response.data));
        
        // Check file size
        const stats = fs.statSync(filePath);
        const fileSize = (stats.size / 1024).toFixed(2);
        console.log(`✅ Downloaded GIF: ${fileSize} KB`);
        
        return true;
    } catch (error) {
        console.error(`❌ Error downloading GIF:`, error.message);
        return false;
    }
}

/**
 * Save metadata for a GIF
 * @param {string} name - Command name
 * @param {Object} metadata - Metadata to save
 */
async function saveMetadata(name, metadata) {
    try {
        if (!fs.existsSync(DETAIL_INFO_DIR)) {
            fs.mkdirSync(DETAIL_INFO_DIR, { recursive: true });
        }
        
        const metadataPath = path.join(DETAIL_INFO_DIR, `${name}.txt`);
        const metadataContent = `Title: ${metadata.title}
Search Query: ${metadata.searchQuery}
Source: ${metadata.source}
Tenor ID: ${metadata.id}
Downloaded: ${metadata.createdAt}
Tenor URL: ${metadata.tenorUrl}`;

        await fsWriteFile(metadataPath, metadataContent);
        console.log(`✅ Saved metadata for ${name}`);
    } catch (error) {
        console.error(`❌ Error saving metadata:`, error.message);
    }
}

/**
 * Update a GIF for a command
 * @param {Object} command - Command object with name and query
 */
async function updateGif(command) {
    console.log(`\n==== Updating GIF for "${command.name}" ====`);
    
    const gifPath = path.join(REACTIONS_DIR, `${command.name}.gif`);
    
    // Backup existing GIF if any
    await backupGif(gifPath);
    
    // Search for a new GIF
    const result = await searchGif(command.query);
    if (result && result.url) {
        // Download the GIF
        const success = await downloadGif(result.url, gifPath);
        if (success) {
            // Save metadata
            await saveMetadata(command.name, result.metadata);
            console.log(`✅ Successfully updated GIF for "${command.name}"`);
            return true;
        }
    }
    
    console.error(`❌ Failed to update GIF for "${command.name}"`);
    return false;
}

/**
 * Main function
 */
async function main() {
    try {
        console.log('🎬 Starting GIF update process...');
        
        // Ensure reactions directory exists
        if (!fs.existsSync(REACTIONS_DIR)) {
            fs.mkdirSync(REACTIONS_DIR, { recursive: true });
            console.log(`✅ Created reactions directory at ${REACTIONS_DIR}`);
        }
        
        // Update each GIF
        let successCount = 0;
        for (const command of COMMANDS_TO_UPDATE) {
            const success = await updateGif(command);
            if (success) successCount++;
        }
        
        console.log(`\n==== Update Summary ====`);
        console.log(`✅ Successfully updated ${successCount}/${COMMANDS_TO_UPDATE.length} GIFs`);
        console.log(`📂 GIFs are stored in: ${REACTIONS_DIR}`);
        
    } catch (error) {
        console.error('❌ Fatal error:', error.message);
    }
}

// Run the script
main().then(() => console.log('🎉 Done!'));