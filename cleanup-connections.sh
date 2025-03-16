#!/bin/bash
# Cleanup script to remove unnecessary connection files and auth folders
# This script keeps only what's needed for the main WhatsApp Bot

echo "Starting cleanup process..."

# Create backup directory
BACKUP_DIR="./connection_backup_$(date +%s)"
mkdir -p "$BACKUP_DIR"
echo "Created backup directory: $BACKUP_DIR"

# Backup connection files before deletion
echo "Backing up connection files..."
for file in safari-connect.js safari-connect-improved.js persistent-connection.js persistent-connection-improved.js src/qr-generator.js; do
  if [ -f "$file" ]; then
    cp "$file" "$BACKUP_DIR/"
    echo "Backed up $file"
  fi
done

# Backup a reference file with all auth directories
ls -la | grep auth_info > "$BACKUP_DIR/auth_directories.txt"

# Backup at least one auth directory in case we need credentials later
if [ -d "auth_info_baileys" ]; then
  echo "Creating backup of main auth_info_baileys folder..."
  cp -r auth_info_baileys "$BACKUP_DIR/"
fi

# Remove connection script files (we'll keep the WhatsApp bot files)
echo "Removing connection script files..."
for file in safari-connect.js safari-connect.js.bak safari-connect-improved.js persistent-connection.js persistent-connection.js.bak persistent-connection-improved.js; do
  if [ -f "$file" ]; then
    rm "$file"
    echo "Removed $file"
  fi
done

# Remove auth folders but keep one main folder
echo "Removing auth backup folders..."
for dir in auth_info_safari auth_info_safari_backup_* auth_info_persistent auth_info_pairing auth_info_qr auth_info_terminal auth_info_web auth_info_simple auth_info_flash auth_info_enhanced auth_info_direct auth_backup auth_info_baileys_qr; do
  if [ -d "$dir" ]; then
    rm -rf "$dir"
    echo "Removed $dir"
  fi
done

# Keep auth_info_baileys if it exists or create it
if [ ! -d "auth_info_baileys" ]; then
  mkdir -p auth_info_baileys
  echo "Created fresh auth_info_baileys directory"
fi

# Keep auth_info_heroku if it exists
if [ ! -d "auth_info_heroku" ]; then
  mkdir -p auth_info_heroku
  echo "Created fresh auth_info_heroku directory"
fi

# Stop and remove workflows for connection scripts
echo "Stopping connection workflows..."
# (This part is handled by Replit UI - we'll document it for the user)

echo "Cleanup complete! You can now focus on the main WhatsApp bot."
echo "Backup of removed files is available at: $BACKUP_DIR"