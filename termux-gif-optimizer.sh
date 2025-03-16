#!/bin/bash
# BLACKSKY-MD WhatsApp Bot GIF Optimizer for Termux
# This script ensures that reaction GIFs work properly in Termux

# Display banner
echo "==============================================="
echo "  BLACKSKY-MD WhatsApp Bot - GIF Optimizer"
echo "==============================================="

# Check for required tools
check_package() {
    if ! command -v "$1" &> /dev/null; then
        echo "Package $1 is not installed. Installing..."
        pkg install -y "$1"
    else
        echo "Package $1 is already installed."
    fi
}

# Install required packages
check_package "ffmpeg"
check_package "imagemagick"

# Create necessary directories
mkdir -p data/reaction_gifs
mkdir -p temp_gifs

# Identify GIF sources
REACTION_DIR="data/reaction_gifs"
ATTACHED_DIR="attached_assets"
DIRECT_GIFS="direct_gifs"
TEMP_DIR="temp_gifs"

# Create the standard reaction list if it doesn't exist
if [ ! -f "${REACTION_DIR}/reaction_list.txt" ]; then
    cat > "${REACTION_DIR}/reaction_list.txt" << 'EOL'
hug
pat
kiss
cuddle
smile
happy
wave
dance
cry
blush
laugh
wink
poke
slap
bonk
bite
punch
highfive
yeet
kill
EOL
    echo "Created standard reaction list."
fi

# Function to check and optimize a GIF
optimize_gif() {
    local input_file="$1"
    local output_file="$2"
    
    # Check if the file exists
    if [ ! -f "$input_file" ]; then
        echo "⚠️ Input file not found: $input_file"
        return 1
    fi
    
    # Create a trimmed version (max 3 seconds)
    echo "✂️ Trimming GIF to 3 seconds..."
    ffmpeg -i "$input_file" -t 3 -y "${TEMP_DIR}/temp_trimmed.gif" 2>/dev/null
    
    # Resize if needed (max 256x256)
    echo "📏 Resizing GIF..."
    ffmpeg -i "${TEMP_DIR}/temp_trimmed.gif" -vf "scale='min(256,iw)':'min(256,ih)':force_original_aspect_ratio=decrease" -y "${TEMP_DIR}/temp_resized.gif" 2>/dev/null
    
    # Optimize for WhatsApp compatibility
    echo "🔧 Optimizing GIF..."
    convert "${TEMP_DIR}/temp_resized.gif" -coalesce -layers OptimizeTransparency -colors 128 -loop 0 "$output_file" 2>/dev/null
    
    # Check output size
    local size=$(stat -c %s "$output_file")
    local size_kb=$((size / 1024))
    
    echo "✅ Optimized GIF: $output_file ($size_kb KB)"
    return 0
}

# Process all reaction GIFs
process_reactions() {
    echo "Processing reaction GIFs..."
    local reaction_list=()
    
    # Read reaction list
    if [ -f "${REACTION_DIR}/reaction_list.txt" ]; then
        while read -r reaction; do
            reaction_list+=("$reaction")
        done < "${REACTION_DIR}/reaction_list.txt"
    else
        echo "⚠️ Reaction list not found. Using default reactions."
        reaction_list=("hug" "pat" "kiss" "cuddle" "smile" "happy" "wave" "dance" "cry" "blush" "laugh" "wink" "poke" "slap" "bonk" "bite" "punch" "highfive" "yeet" "kill")
    fi
    
    echo "Found ${#reaction_list[@]} reactions to process."
    
    # Process each reaction
    local success_count=0
    local failure_count=0
    
    for reaction in "${reaction_list[@]}"; do
        echo "Processing: $reaction"
        local reaction_file="${REACTION_DIR}/${reaction}.gif"
        
        # Check if reaction GIF already exists
        if [ -f "$reaction_file" ]; then
            echo "✅ Reaction GIF already exists: $reaction"
            ((success_count++))
            continue
        fi
        
        # Look for the GIF in various source directories
        local found=false
        local source_file=""
        
        # Check in attached_assets
        if [ -d "$ATTACHED_DIR" ]; then
            for file in "$ATTACHED_DIR"/*; do
                filename=$(basename "$file")
                # Match exact name or name containing the reaction
                if [[ "$filename" == "${reaction}.gif" || "$filename" =~ ${reaction} ]]; then
                    source_file="$file"
                    found=true
                    break
                fi
            done
        fi
        
        # Check in direct_gifs if not found
        if [ "$found" = false ] && [ -d "$DIRECT_GIFS" ]; then
            for file in "$DIRECT_GIFS"/*; do
                filename=$(basename "$file")
                if [[ "$filename" == "${reaction}.gif" || "$filename" =~ ${reaction} ]]; then
                    source_file="$file"
                    found=true
                    break
                fi
            done
        fi
        
        # Check in standard animations folders
        if [ "$found" = false ]; then
            standard_folders=("animated_gifs" "fast_furious_gifs" "walking_dead_gifs")
            for folder in "${standard_folders[@]}"; do
                if [ -d "$folder" ]; then
                    for file in "$folder"/*; do
                        filename=$(basename "$file")
                        if [[ "$filename" == "${reaction}.gif" || "$filename" =~ ${reaction} ]]; then
                            source_file="$file"
                            found=true
                            break
                        fi
                    done
                fi
                [ "$found" = true ] && break
            done
        fi
        
        if [ "$found" = true ]; then
            echo "🔍 Found source file: $source_file"
            if optimize_gif "$source_file" "$reaction_file"; then
                ((success_count++))
            else
                ((failure_count++))
            fi
        else
            echo "❌ No source file found for reaction: $reaction"
            ((failure_count++))
        fi
    done
    
    echo "Processing complete. Success: $success_count, Failed: $failure_count"
}

# Create a Node.js script to test the GIFs
create_gif_test_script() {
    cat > test-reaction-gifs.js << 'EOL'
/**
 * WhatsApp Reaction GIF Tester
 * This script tests whether reaction GIFs can be sent properly in WhatsApp
 */

const fs = require('fs');
const path = require('path');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');

const REACTION_DIR = path.join(__dirname, 'data', 'reaction_gifs');

// Create a list of reaction GIFs
const getReactionGifs = () => {
    try {
        if (!fs.existsSync(REACTION_DIR)) {
            console.log('Reaction directory not found:', REACTION_DIR);
            return [];
        }
        
        return fs.readdirSync(REACTION_DIR)
            .filter(file => file.endsWith('.gif'))
            .map(file => path.join(REACTION_DIR, file));
    } catch (err) {
        console.error('Error getting reaction GIFs:', err);
        return [];
    }
};

// Start WhatsApp connection
async function startWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_test');
    
    // Socket with event listeners
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        browser: ['Reaction Tester', 'Chrome', '1.0.0'],
    });
    
    // Handle connection events
    sock.ev.on('connection.update', update => {
        const { connection, lastDisconnect, qr } = update;
        
        if (connection === 'close') {
            const reason = lastDisconnect?.error?.output?.statusCode;
            console.log('Connection closed due to:', reason || 'unknown reason');
            
            if (reason !== DisconnectReason.loggedOut) {
                startWhatsApp();
            }
        } else if (connection === 'open') {
            console.log('Connected successfully!');
            testReactionGifs(sock);
        }
    });
    
    // Save credentials
    sock.ev.on('creds.update', saveCreds);
}

// Test reaction GIFs by sending to yourself
async function testReactionGifs(sock) {
    try {
        // Get list of GIFs
        const gifs = getReactionGifs();
        console.log(`Found ${gifs.length} reaction GIFs to test.`);
        
        if (gifs.length === 0) {
            console.log('No GIFs found to test.');
            process.exit(0);
        }
        
        // Get own number
        const { user } = sock.user;
        const recipient = user.id;
        
        // Ask user if they want to proceed
        console.log(`Will send ${gifs.length} test GIFs to your own number: ${recipient.split('@')[0]}`);
        console.log('Press Ctrl+C to abort, or wait 5 seconds to continue...');
        
        // Wait 5 seconds before starting
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Send test message
        await sock.sendMessage(recipient, { text: '🧪 Starting reaction GIF test...' });
        
        // Send each GIF
        console.log('Sending test GIFs...');
        let successCount = 0;
        let failureCount = 0;
        
        for (const gif of gifs) {
            try {
                const gifName = path.basename(gif, '.gif');
                console.log(`Testing: ${gifName}`);
                
                // Send as sticker for better compatibility
                const sticker = {
                    sticker: fs.readFileSync(gif),
                    mimetype: 'image/gif',
                    gifPlayback: true,
                    caption: `Test: ${gifName}`,
                    ptt: false
                };
                
                await sock.sendMessage(recipient, sticker);
                console.log(`✅ Successfully sent: ${gifName}`);
                successCount++;
                
                // Small delay between sends
                await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (err) {
                console.error(`❌ Failed to send ${path.basename(gif)}:`, err.message);
                failureCount++;
            }
        }
        
        // Send summary
        await sock.sendMessage(recipient, { 
            text: `🧪 Test completed!\n✅ Success: ${successCount}\n❌ Failed: ${failureCount}` 
        });
        
        console.log('Test completed.');
        console.log(`Results: ${successCount} successful, ${failureCount} failed`);
        
        // Give time for last message to send
        setTimeout(() => process.exit(0), 3000);
    } catch (err) {
        console.error('Error in test:', err);
        process.exit(1);
    }
}

// Start the test
startWhatsApp();
EOL

    echo "Created GIF test script: test-reaction-gifs.js"
}

# Main script execution
echo "Starting GIF optimization..."

# Process all reaction GIFs
process_reactions

# Create test script
create_gif_test_script

# Make scripts executable
chmod +x test-reaction-gifs.js

echo "==============================================="
echo "GIF optimization complete!"
echo "All reaction GIFs have been optimized for WhatsApp compatibility."
echo ""
echo "To test GIFs:"
echo "  node test-reaction-gifs.js"
echo ""
echo "This will send test GIFs to your own number to verify they work properly."
echo "==============================================="