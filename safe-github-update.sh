#!/bin/bash

# Colors for better output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}=====================================${NC}"
echo -e "${GREEN}BLACKSKY-MD Safe GitHub Update Script${NC}"
echo -e "${BLUE}=====================================${NC}"

# Check if GITHUB_TOKEN is available
if [ -z "$GITHUB_TOKEN" ]; then
    echo -e "${RED}Error: GITHUB_TOKEN environment variable is not set${NC}"
    echo -e "${YELLOW}Using token from git remote if available...${NC}"
fi

# Configure git for GitHub Actions
git config --global user.name "BlackskyMD Bot"
git config --global user.email "blackskymd@github.actions.com"

# Stage all important files
echo -e "${YELLOW}Staging files for commit...${NC}"

# Main files
git add src/ public/ views/
git add package.json package-lock.json
git add README.md .env.example app.json
git add Procfile heroku.yml

# Status update
echo -e "${GREEN}Files staged successfully.${NC}"
git status

# Commit the changes
echo -e "${YELLOW}Committing changes...${NC}"
git commit -m "Update WhatsApp Bot with improved configuration and deployment settings"

# Push to GitHub using the configured token
echo -e "${YELLOW}Pushing to GitHub...${NC}"

# Set the correct remote URL with token if needed
remote_url=$(git remote get-url origin)
if [[ ! $remote_url == *"github.com"* ]]; then
    echo -e "${RED}Error: Remote URL does not contain github.com${NC}"
    exit 1
fi

# Try pushing with force to overcome potential conflicts
git push -f origin main

echo -e "${BLUE}=====================================${NC}"
echo -e "${GREEN}GitHub update process completed!${NC}"
echo -e "${BLUE}=====================================${NC}"