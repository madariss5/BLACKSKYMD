#!/bin/bash

# Create backup directories
mkdir -p backups/js
mkdir -p backups/md
mkdir -p backups/auth_backups

echo "Creating backups of important files..."

# Backup important files
cp safari-connect.js backups/js/
cp easy-start.js backups/js/
cp heroku-bot.js backups/js/
cp persistent-connection.js backups/js/
cp README.md backups/md/
cp CLOUD_ENVIRONMENT_GUIDE.md backups/md/
cp CONNECTION_README.md backups/md/

# Backup auth folders with credentials
cp -r auth_info_direct backups/auth_backups/
cp -r auth_info_enhanced backups/auth_backups/
cp -r auth_info_flash backups/auth_backups/
cp -r auth_info_heroku backups/auth_backups/

echo "Backups completed successfully"

echo "Removing unnecessary JavaScript files..."
# Core files to keep
KEEP_FILES=(
  "safari-connect.js"
  "easy-start.js"
  "heroku-bot.js"
  "persistent-connection.js"
  "package.json"
  "package-lock.json"
)

# Delete JS files except for the ones we want to keep
for file in *.js; do
  if [[ ! " ${KEEP_FILES[@]} " =~ " ${file} " ]]; then
    echo "Removing $file"
    rm "$file"
  fi
done

echo "Removing test scripts..."
rm -rf test_scripts

echo "Removing unnecessary markdown files..."
# Keep only important documentation
KEEP_MD=(
  "README.md"
  "CLOUD_ENVIRONMENT_GUIDE.md"
  "CONNECTION_README.md"
)

for file in *.md; do
  if [[ ! " ${KEEP_MD[@]} " =~ " ${file} " ]]; then
    echo "Removing $file"
    rm "$file"
  fi
done

echo "Cleaning up Safari auth backup folders..."
# Keep only the most recent 3 Safari auth backups
ls -dt auth_info_safari_backup_* | tail -n +4 | xargs rm -rf

echo "Cleanup completed successfully!"
echo "The essential files have been preserved, and backups are available in the 'backups' directory."