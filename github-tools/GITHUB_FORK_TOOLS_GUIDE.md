# GitHub Fork Tools Guide

This guide explains how to use the GitHub tools included in the BLACKSKY-MD repository to manage forks and repository content.

## Overview

The `github-tools` directory contains several utilities to help you work with GitHub repositories:

1. **Minimal GitHub Editor**: A simple but powerful tool for editing files in your GitHub repository
2. **Fork Helper Utility**: Tools for managing and tracking forks of your repository
3. **Upload Fork Guides**: Automatically upload forking documentation to your repository
4. **GitHub Tools Launcher**: A unified interface to access all GitHub tools

## Prerequisites

1. A GitHub account
2. A personal access token with appropriate permissions (repo scope)
3. Node.js installed on your machine (included in Replit)

## Setting Up

1. Clone the repository:
   ```bash
   git clone https://github.com/madariss5/BLACKSKY.git
   cd BLACKSKY
   ```

2. Set your GitHub token:
   ```bash
   export GITHUB_TOKEN=your_github_token_here
   ```

   Or on Replit, set it in the Secrets tab.

## Using the GitHub Tools Launcher

The launcher provides a unified interface to access all GitHub tools:

```bash
cd github-tools
chmod +x launch-github-tools.sh
./launch-github-tools.sh
```

This will show a menu with all available tools.

## Fork Helper Utility

The Fork Helper Utility helps you manage and track forks of your repository.

### Features

- List all forks of your repository
- Check fork settings
- Enable forking for your repository
- Check pull requests from forks
- Check if your repository is a fork
- View the fork network

### Usage

```bash
cd github-tools
chmod +x start-fork-helper.sh
./start-fork-helper.sh
```

## Upload Fork Guides

This utility automatically uploads the forking documentation to your GitHub repository.

### What It Does

- Uploads `FORK_GUIDE.md` to help users fork your repository
- Uploads `ENABLING_FORKS.md` to help repository owners enable forks

### Usage

```bash
cd github-tools
chmod +x start-upload-guides.sh
./start-upload-guides.sh
```

## Minimal GitHub Editor

The Minimal GitHub Editor allows you to edit files in your GitHub repository directly from the command line.

### Features

- Browse repository contents
- Edit existing files
- Create new files
- Verify GitHub token

### Usage

```bash
cd github-tools
node minimal-github-editor.js
```

## Advanced: Creating a Fork

If you want to create your own fork of the BLACKSKY-MD repository:

1. Go to the GitHub repository: [https://github.com/madariss5/BLACKSKY](https://github.com/madariss5/BLACKSKY)
2. Click the "Fork" button in the top-right corner
3. GitHub will create a copy of the repository under your account
4. Clone your fork:
   ```bash
   git clone https://github.com/YOUR-USERNAME/BLACKSKY.git
   cd BLACKSKY
   ```
5. Make changes to customize your fork
6. Push changes back to your fork:
   ```bash
   git add .
   git commit -m "Made customizations"
   git push origin main
   ```

## Advanced: Keeping Your Fork Updated

To keep your fork updated with the original repository:

1. Add the original repository as a remote:
   ```bash
   git remote add upstream https://github.com/madariss5/BLACKSKY.git
   ```

2. Fetch changes from the original repository:
   ```bash
   git fetch upstream
   ```

3. Merge changes from the original repository into your fork:
   ```bash
   git checkout main
   git merge upstream/main
   ```

## Troubleshooting

### GitHub Token Issues

If you encounter issues with your GitHub token:

1. Make sure the token has the correct permissions (repo scope)
2. Check that the token is correctly set in your environment
3. Verify the token using the "Verify GitHub token" option in the tools

### Permission Denied

If you get "Permission denied" errors:

1. Check that you have the necessary permissions on the repository
2. Ensure your token has the correct scopes
3. Check if the repository allows forking (if you're trying to fork)

### Network Issues

If you experience network problems:

1. Check your internet connection
2. Try again later as GitHub API has rate limits
3. Ensure your network allows connections to GitHub

## Conclusion

The GitHub tools provided in the BLACKSKY-MD repository make it easy to manage your repository, track forks, and maintain documentation. Use these tools to streamline your GitHub workflow and help others contribute to your project.