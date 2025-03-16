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

echo "Removing unnecessary files..."

# Remove old Heroku files
rm -f HEROKU-ADVANCED.md
rm -f HEROKU-APTFILE-GUIDE.md
rm -f HEROKU-DEPLOY.md
rm -f HEROKU-DEPLOYMENT.md
rm -f HEROKU-DOCKER-GUIDE.md
rm -f HEROKU-SAFARI.md
rm -f Aptfile
rm -f DEPLOYMENT_GUIDE.md
rm -f DEPLOYMENT_OPTIONS.md
rm -f DEPLOYMENT_SUMMARY.md

# Remove old deployment configs
rm -f heroku-deploy.yml
rm -f heroku-config.json
rm -f heroku-postbuild.js

echo "Cleanup completed successfully!"