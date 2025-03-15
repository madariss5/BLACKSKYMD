#!/bin/bash

# Colors for better output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}=====================================${NC}"
echo -e "${GREEN}BLACKSKY-MD GitHub Update Script${NC}"
echo -e "${BLUE}=====================================${NC}"

# Check if git is installed
if ! command -v git &> /dev/null; then
    echo -e "${RED}Error: Git is not installed${NC}"
    exit 1
fi

# Add all important files
echo -e "${YELLOW}Adding files to git...${NC}"

# Main files
git add connected-bot.js qr-web-display.js improved-qr.js bot-handler.js
git add Procfile app.json HEROKU-DEPLOY.md
git add src/translations/en.json src/translations/de.json
git add README.md CHANGELOG.md .gitignore .env.example

# Config files
git add src/config/config.js src/config/commands/*.json

# Utilities
git add src/utils/*.js

# Handlers
git add src/handlers/*.js

# Commands
git add src/commands/*.js src/commands/educational/*.js

echo -e "${GREEN}Files added successfully${NC}"

# Get commit message from user
echo -e "${YELLOW}Enter a commit message (or press enter for default message):${NC}"
read -r commit_message

if [[ -z "$commit_message" ]]; then
    commit_message="Update WhatsApp Bot with improved configuration and deployment settings"
fi

# Commit changes
echo -e "${YELLOW}Committing changes with message:${NC} $commit_message"
git commit -m "$commit_message"

# Push to GitHub
echo -e "${YELLOW}Do you want to push to GitHub now? (y/n)${NC}"
read -r push_choice

if [[ "$push_choice" == "y" || "$push_choice" == "Y" ]]; then
    echo -e "${YELLOW}Pushing to GitHub...${NC}"
    git push origin main
    echo -e "${GREEN}Successfully pushed to GitHub!${NC}"
else
    echo -e "${BLUE}Changes committed but not pushed. Run 'git push origin main' to push later.${NC}"
fi

echo -e "${BLUE}=====================================${NC}"
echo -e "${GREEN}Update process completed!${NC}"
echo -e "${BLUE}=====================================${NC}"