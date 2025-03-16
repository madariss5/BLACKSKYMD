#!/bin/bash
# BLACKSKY-MD WhatsApp Bot Log Management Tool for Termux
# This script helps manage logs to prevent storage issues on Termux

# Display banner
echo "==============================================="
echo "  BLACKSKY-MD WhatsApp Bot - Log Manager"
echo "==============================================="

# Create logs directory if it doesn't exist
mkdir -p logs

# Function to format file size in human-readable format
format_size() {
    local size=$1
    local units=("B" "KB" "MB" "GB")
    local unit_index=0
    
    while (( size > 1024 && unit_index < 3 )); do
        size=$(( size / 1024 ))
        (( unit_index++ ))
    done
    
    echo "$size ${units[$unit_index]}"
}

# Analyze current log usage
echo "Analyzing log usage..."
TOTAL_SIZE=0
LARGE_FILES=()

# Find all log files and record their sizes
echo "Log files:"
echo "-------------------------------------------------"
echo "SIZE        | DATE              | FILENAME"
echo "-------------------------------------------------"

while IFS= read -r file; do
    if [[ -f "$file" ]]; then
        SIZE=$(stat -c %s "$file")
        TOTAL_SIZE=$((TOTAL_SIZE + SIZE))
        DATE=$(stat -c %y "$file" | cut -d'.' -f1)
        FORMATTED_SIZE=$(format_size "$SIZE")
        printf "%-11s | %-17s | %s\n" "$FORMATTED_SIZE" "$DATE" "$file"
        
        # Track large files (over 1MB)
        if [[ $SIZE -gt 1048576 ]]; then
            LARGE_FILES+=("$file")
        fi
    fi
done < <(find . -name "*.log" | sort)

echo "-------------------------------------------------"
echo "Total log space usage: $(format_size "$TOTAL_SIZE")"
echo

# Create log rotation script if it doesn't exist
if [[ ! -f ~/bin/blacksky-log-rotate ]]; then
    mkdir -p ~/bin
    
    echo "Creating log rotation script..."
    cat > ~/bin/blacksky-log-rotate << 'EOL'
#!/bin/bash
# BLACKSKY-MD WhatsApp Bot Log Rotation Script
cd "$(dirname "$0")/../blacksky-md"

# Maximum size for logs before rotation (1MB)
MAX_SIZE=1048576

# Number of backups to keep for each log file
BACKUP_COUNT=3

# Get current date for backup files
DATE=$(date +%Y%m%d)

# Rotate logs that exceed MAX_SIZE
find . -name "*.log" | while read -r log_file; do
    # Get file size
    SIZE=$(stat -c %s "$log_file")
    
    # Check if file exceeds maximum size
    if [[ $SIZE -gt $MAX_SIZE ]]; then
        echo "Rotating $log_file ($(numfmt --to=iec-i --suffix=B $SIZE))"
        
        # Create backup filename
        BASENAME=$(basename "$log_file")
        DIRNAME=$(dirname "$log_file")
        BACKUP="${DIRNAME}/${BASENAME}.${DATE}"
        
        # If backup exists, append counter
        COUNTER=1
        while [[ -f "${BACKUP}.${COUNTER}" ]]; do
            COUNTER=$((COUNTER + 1))
        done
        BACKUP="${BACKUP}.${COUNTER}"
        
        # Copy log to backup
        cp "$log_file" "$BACKUP"
        
        # Truncate original log
        echo "--- Log rotated on $(date) ---" > "$log_file"
        
        # Remove old backups beyond BACKUP_COUNT
        find "${DIRNAME}" -name "${BASENAME}.*" | sort -r | tail -n +$((BACKUP_COUNT + 1)) | xargs rm -f 2>/dev/null
    fi
done

# Clean up old logs (older than 14 days)
find . -name "*.log.*" -type f -mtime +14 -delete 2>/dev/null

echo "Log rotation completed at $(date)" >> logs/maintenance.log
EOL
    
    chmod +x ~/bin/blacksky-log-rotate
    echo "Log rotation script created at ~/bin/blacksky-log-rotate"
    
    # Add to crontab if not already there
    if ! crontab -l 2>/dev/null | grep -q "blacksky-log-rotate"; then
        (crontab -l 2>/dev/null; echo "0 2 * * * ~/bin/blacksky-log-rotate") | crontab -
        echo "Added daily log rotation job to crontab (runs at 2:00 AM)"
    fi
fi

# Process large files
if [[ ${#LARGE_FILES[@]} -gt 0 ]]; then
    echo "Large log files detected."
    echo "Would you like to rotate these files now? (y/n)"
    read -r ROTATE
    
    if [[ "$ROTATE" == "y" ]]; then
        for file in "${LARGE_FILES[@]}"; do
            echo "Rotating $file..."
            BACKUP="${file}.$(date +%Y%m%d)"
            cp "$file" "$BACKUP"
            echo "--- Log rotated on $(date) ---" > "$file"
            echo "Created backup at $BACKUP"
        done
        echo "All large files rotated."
    fi
fi

# Create on-demand log management tools
mkdir -p ~/bin

# Create log cleaner script
cat > ~/bin/blacksky-clear-logs << 'EOL'
#!/bin/bash
# Clear all logs in the BLACKSKY-MD bot
cd "$(dirname "$0")/../blacksky-md"

echo "Clearing all log files..."
find . -name "*.log" | while read -r log_file; do
    echo "Clearing $log_file"
    echo "--- Logs cleared on $(date) ---" > "$log_file"
done

echo "All logs cleared."
EOL
chmod +x ~/bin/blacksky-clear-logs

# Create log viewer script
cat > ~/bin/blacksky-view-logs << 'EOL'
#!/bin/bash
# View and manage logs in the BLACKSKY-MD bot
cd "$(dirname "$0")/../blacksky-md"

# List available log files
FILES=($(find . -name "*.log" | sort))

if [[ ${#FILES[@]} -eq 0 ]]; then
    echo "No log files found."
    exit 0
fi

# Display menu
echo "Available log files:"
for i in "${!FILES[@]}"; do
    SIZE=$(stat -c %s "${FILES[$i]}")
    HUMAN_SIZE=$(numfmt --to=iec-i --suffix=B $SIZE)
    echo "$((i+1)). ${FILES[$i]} ($HUMAN_SIZE)"
done

echo "v. View a log file"
echo "t. Tail (follow) a log file"
echo "c. Clear a log file"
echo "a. Clear all log files"
echo "q. Quit"

read -rp "Enter choice: " CHOICE

case $CHOICE in
    v)
        read -rp "Enter log number to view: " NUM
        if [[ $NUM -ge 1 && $NUM -le ${#FILES[@]} ]]; then
            less "${FILES[$((NUM-1))]}"
        else
            echo "Invalid selection."
        fi
        ;;
    t)
        read -rp "Enter log number to tail: " NUM
        if [[ $NUM -ge 1 && $NUM -le ${#FILES[@]} ]]; then
            tail -f "${FILES[$((NUM-1))]}"
        else
            echo "Invalid selection."
        fi
        ;;
    c)
        read -rp "Enter log number to clear: " NUM
        if [[ $NUM -ge 1 && $NUM -le ${#FILES[@]} ]]; then
            echo "Clearing ${FILES[$((NUM-1))]}..."
            echo "--- Logs cleared on $(date) ---" > "${FILES[$((NUM-1))]}"
            echo "Log cleared."
        else
            echo "Invalid selection."
        fi
        ;;
    a)
        read -rp "Are you sure you want to clear ALL logs? (y/n): " CONFIRM
        if [[ "$CONFIRM" == "y" ]]; then
            ~/bin/blacksky-clear-logs
        else
            echo "Operation cancelled."
        fi
        ;;
    q)
        exit 0
        ;;
    *)
        echo "Invalid choice."
        ;;
esac
EOL
chmod +x ~/bin/blacksky-view-logs

echo "==============================================="
echo "Log management tools installed:"
echo "  ~/bin/blacksky-log-rotate  - Rotate large logs"
echo "  ~/bin/blacksky-clear-logs  - Clear all logs"
echo "  ~/bin/blacksky-view-logs   - View and manage logs"
echo ""
echo "Logs will be automatically rotated daily at 2:00 AM."
echo "==============================================="