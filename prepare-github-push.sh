#!/bin/bash
# Script to prepare files for GitHub push

echo "===== Preparing files for GitHub push ====="

# Check if git is installed
if ! command -v git &> /dev/null; then
    echo "Git is not installed. Please install git first."
    exit 1
fi

# Check if we're in a git repository
if [ ! -d .git ]; then
    echo "Initializing git repository..."
    git init
fi

# Create .gitignore if it doesn't exist
if [ ! -f .gitignore ]; then
    echo "Creating .gitignore file..."
    cat > .gitignore << EOF
# Node modules
node_modules/

# WhatsApp auth files
auth_info*/
*.json.bak

# Environment variables
.env

# Logs
*.log
npm-debug.log*

# Temporary files
tmp/
temp/
*.tmp

# Operating System Files
.DS_Store
Thumbs.db

# IDE specific files
.idea/
.vscode/
*.swp
*.swo
EOF
fi

# Add all files
echo "Adding files to git..."
git add .

# Status check
echo "Current git status:"
git status

echo ""
echo "===== GitHub Push Preparation Complete ====="
echo ""
echo "Next steps:"
echo "1. Review the changes with 'git status'"
echo "2. Commit the changes with: git commit -m \"Add multiple Heroku deployment options\""
echo "3. Add your GitHub repository as a remote: git remote add origin https://github.com/yourusername/your-repo-name.git"
echo "4. Push to GitHub: git push -u origin main"
echo ""
echo "Note: If you want to update an existing repository, make sure to pull first: git pull origin main"