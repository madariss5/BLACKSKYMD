/**
 * User Level Fix Script
 * This script recalculates and updates all user levels based on their XP
 */
const fs = require('fs').promises;
const path = require('path');

// Constants from the levelingSystem.js
const BASE_XP = 100;
const XP_MULTIPLIER = 1.5;

/**
 * Calculate user's level based on XP (copied from levelingSystem.js)
 * @param {number} xp Total XP
 * @returns {number} Current level
 */
function calculateLevel(xp) {
    // Simple level tiers with fixed XP thresholds
    // This is more intuitive than logarithmic scaling for users
    if (xp < BASE_XP) return 1;
    
    // Simplified XP scale
    // Level 1: 0-99 XP
    // Level 2: 100-249 XP
    // Level 3: 250-499 XP
    // Level 4: 500-999 XP
    // Level 5: 1000-1999 XP
    // etc.
    
    if (xp >= 10000) return 10;
    if (xp >= 5000) return 9;
    if (xp >= 2500) return 8;
    if (xp >= 2000) return 7;
    if (xp >= 1500) return 6;
    if (xp >= 1000) return 5;
    if (xp >= 500) return 4;
    if (xp >= 250) return 3;
    if (xp >= 100) return 2;
    
    return 1;
}

/**
 * Fix user levels in the database
 */
async function fixUserLevels() {
    try {
        console.log('Starting user level fix...');
        
        // Load user data
        const userDataPath = path.join(process.cwd(), 'data', 'user_data.json');
        console.log(`Reading user data from: ${userDataPath}`);
        
        const rawData = await fs.readFile(userDataPath, 'utf8');
        const userData = JSON.parse(rawData);
        
        if (!userData.profiles) {
            console.error('No user profiles found in data file!');
            return;
        }
        
        let updatedCount = 0;
        let unchangedCount = 0;
        const details = [];
        
        // Process each profile
        for (const [jid, profile] of Object.entries(userData.profiles)) {
            if (!profile || typeof profile.xp !== 'number') {
                console.warn(`Skipping invalid profile for ${jid}`);
                continue;
            }
            
            const oldLevel = profile.level;
            const correctLevel = calculateLevel(profile.xp);
            
            if (oldLevel !== correctLevel) {
                // Level needs updating
                profile.level = correctLevel;
                updatedCount++;
                
                details.push({
                    jid,
                    xp: profile.xp,
                    oldLevel,
                    newLevel: correctLevel
                });
                
                console.log(`Updated ${jid}: Level ${oldLevel} -> ${correctLevel} (XP: ${profile.xp})`);
            } else {
                unchangedCount++;
            }
        }
        
        // Save updated data
        if (updatedCount > 0) {
            await fs.writeFile(userDataPath, JSON.stringify(userData, null, 2));
            console.log(`Updated data saved to ${userDataPath}`);
        }
        
        // Print summary
        console.log('\n==== LEVEL FIX SUMMARY ====');
        console.log(`Total profiles processed: ${updatedCount + unchangedCount}`);
        console.log(`Profiles updated: ${updatedCount}`);
        console.log(`Profiles unchanged: ${unchangedCount}`);
        
        if (details.length > 0) {
            console.log('\nUpdated profiles:');
            details.forEach(d => {
                console.log(`- ${d.jid}: Level ${d.oldLevel} -> ${d.newLevel} (XP: ${d.xp})`);
            });
        }
        
        console.log('\nLevel fix completed successfully!');
    } catch (error) {
        console.error('Error fixing user levels:', error);
    }
}

// Execute the function
fixUserLevels();