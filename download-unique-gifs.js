/**
 * Download unique GIFs for the duplicate reaction commands
 */
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Directory where GIFs are stored
const REACTIONS_DIR = path.join(process.cwd(), 'data', 'reaction_gifs');

// GIFs that need to be replaced with unique versions
const GIFS_TO_REPLACE = {
  'happy.gif': 'anime happy reaction',
  'pat.gif': 'anime pat head reaction',
  'punch.gif': 'anime punch reaction',
  'yeet.gif': 'anime throw person reaction'
};

// Tenor API key (using a public key for this example)
const TENOR_API_KEY = 'AIzaSyB8CRs5A-91JqM1Mf4-XWKY6ntJaUDGA04';

/**
 * Downloads a GIF from a URL and saves it to the specified path
 */
async function downloadGif(url, filePath) {
  try {
    console.log(`Downloading ${url} to ${filePath}...`);
    
    const response = await axios({
      method: 'GET',
      url: url,
      responseType: 'stream'
    });

    return new Promise((resolve, reject) => {
      const writer = fs.createWriteStream(filePath);
      response.data.pipe(writer);
      
      writer.on('finish', () => {
        console.log(`✅ Successfully downloaded ${path.basename(filePath)}`);
        resolve(filePath);
      });
      
      writer.on('error', (err) => {
        console.error(`❌ Error writing file ${filePath}:`, err.message);
        reject(err);
      });
    });
  } catch (error) {
    console.error(`❌ Error downloading from ${url}:`, error.message);
    throw error;
  }
}

/**
 * Search for a GIF using Tenor API
 */
async function searchGif(query) {
  try {
    console.log(`Searching for "${query}"...`);
    
    const response = await axios.get('https://tenor.googleapis.com/v2/search', {
      params: {
        q: query,
        key: TENOR_API_KEY,
        limit: 10,
        media_filter: 'gif',
        contentfilter: 'medium'
      }
    });
    
    if (response.data && response.data.results && response.data.results.length > 0) {
      // Get a random result from top 10
      const randomIndex = Math.floor(Math.random() * Math.min(response.data.results.length, 5));
      const result = response.data.results[randomIndex];
      
      // Find a suitable sized GIF (not too large)
      let gifUrl = null;
      if (result.media_formats && result.media_formats.gif) {
        gifUrl = result.media_formats.gif.url;
      } else if (result.media_formats && result.media_formats.tinygif) {
        gifUrl = result.media_formats.tinygif.url;
      }
      
      if (gifUrl) {
        console.log(`✅ Found GIF for "${query}"`);
        return gifUrl;
      }
    }
    
    throw new Error(`No results found for "${query}"`);
  } catch (error) {
    console.error(`❌ Error searching for "${query}":`, error.message);
    throw error;
  }
}

/**
 * Backup the original GIF
 */
function backupGif(filePath) {
  const backupPath = `${filePath}.backup`;
  try {
    if (!fs.existsSync(backupPath)) {
      fs.copyFileSync(filePath, backupPath);
      console.log(`✅ Backed up ${path.basename(filePath)} to ${path.basename(backupPath)}`);
    } else {
      console.log(`ℹ️ Backup already exists for ${path.basename(filePath)}`);
    }
  } catch (error) {
    console.error(`❌ Error backing up ${filePath}:`, error.message);
  }
}

/**
 * Restore a GIF from backup if something goes wrong
 */
function restoreGif(filePath) {
  const backupPath = `${filePath}.backup`;
  try {
    if (fs.existsSync(backupPath)) {
      fs.copyFileSync(backupPath, filePath);
      console.log(`✅ Restored ${path.basename(filePath)} from backup`);
    } else {
      console.error(`❌ No backup found for ${path.basename(filePath)}`);
    }
  } catch (error) {
    console.error(`❌ Error restoring ${filePath}:`, error.message);
  }
}

/**
 * Main function to replace duplicate GIFs
 */
async function replaceGifs() {
  // Check if the directory exists
  if (!fs.existsSync(REACTIONS_DIR)) {
    console.error(`❌ Reactions directory not found: ${REACTIONS_DIR}`);
    return;
  }
  
  console.log(`🔄 Starting GIF replacement for ${Object.keys(GIFS_TO_REPLACE).length} files...`);
  
  // Create a detail_info directory for attribution
  const detailDir = path.join(REACTIONS_DIR, 'detail_info');
  if (!fs.existsSync(detailDir)) {
    fs.mkdirSync(detailDir, { recursive: true });
  }
  
  // Process each GIF
  for (const [filename, searchQuery] of Object.entries(GIFS_TO_REPLACE)) {
    const filePath = path.join(REACTIONS_DIR, filename);
    
    if (!fs.existsSync(filePath)) {
      console.error(`❌ Original file not found: ${filePath}`);
      continue;
    }
    
    try {
      // Backup original file
      backupGif(filePath);
      
      // Search for a new GIF
      const gifUrl = await searchGif(searchQuery);
      
      // Download and save the new GIF
      await downloadGif(gifUrl, filePath);
      
      // Save attribution info
      const infoPath = path.join(detailDir, `${path.basename(filename, '.gif')}.txt`);
      fs.writeFileSync(infoPath, `Source: Tenor API\nSearch query: ${searchQuery}\nDownloaded: ${new Date().toISOString()}\nURL: ${gifUrl}`);
      
      console.log(`✅ Successfully replaced ${filename} with a unique animation`);
    } catch (error) {
      console.error(`❌ Failed to replace ${filename}:`, error.message);
      restoreGif(filePath);
    }
  }
  
  console.log('🎉 GIF replacement process completed!');
}

// Run the replacement process
replaceGifs().catch(err => {
  console.error('❌ Error in GIF replacement process:', err);
});