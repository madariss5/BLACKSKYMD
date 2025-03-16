# GitHub Tools Guide

This guide explains the various GitHub-related tools available in this project to help you manage and edit repository files.

## Available Tools

### 1. Simple GitHub Editor (`simple-github-editor.js`) - RECOMMENDED

A streamlined, user-friendly GitHub editor designed specifically for reliability and ease of use. This is the recommended tool for most GitHub editing tasks.

**Features:**
- Simplified interface with improved error handling
- Clear, color-coded output
- Browse repository with intuitive navigation
- View file contents with line numbers
- Edit files with straightforward text input
- Create new files quickly
- Detailed error messages and troubleshooting guidance

**Usage:**
```bash
node simple-github-editor.js
```

### 2. GitHub File Editor (`github-file-editor.js`)

An interactive command-line tool that allows you to browse, edit, create, and delete files in the repository directly without using the GitHub web interface.

**Features:**
- Browse repository files and directories
- View file contents
- Edit files using your preferred terminal editor or direct text input
- Create new files
- Delete existing files
- Verify GitHub token permissions

**Usage:**
```bash
node github-file-editor.js
```

### 3. GitHub Browser Debug (`github-browser-debug.js`)

A diagnostic tool to help identify and fix common GitHub browser interface issues.

**Features:**
- Verify GitHub token and permissions
- Check GitHub API status
- Test network connectivity
- Check DNS resolution
- Measure network latency
- Examine system resources
- Generate browser reset instructions

**Usage:**
```bash
node github-browser-debug.js
```

### 4. GitHub Permissions Fix (`github-permissions-fix.js`)

Diagnoses and fixes repository permission issues.

**Features:**
- Check repository permissions
- List collaborators and their access levels
- Check branch protection rules
- Suggest permission fixes
- Add collaborators with specific permissions

**Usage:**
```bash
node github-permissions-fix.js
```

### 5. GitHub Update (`github-update.js`)

Automates pushing changes to GitHub.

**Features:**
- Initialize Git repository if needed
- Configure Git credentials
- Add files to Git
- Commit changes with customizable messages
- Push changes to GitHub

**Usage:**
```bash
node github-update.js
```

### 6. Test GitHub Editing (`test-github-editing.js`)

A simple tool to test direct file editing via the GitHub API.

**Features:**
- Get file content
- Update file content
- Verify GitHub token

**Usage:**
```bash
node test-github-editing.js
```

## Setup Requirements

All tools require a valid GitHub personal access token with appropriate permissions. Set this token as an environment variable:

```
GITHUB_TOKEN=your_token_here
```

For information on creating a token, see the [GitHub documentation on Personal Access Tokens](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token).

## Troubleshooting

If you encounter issues:

1. Verify your GitHub token has the correct permissions (typically `repo` scope)
2. Check your internet connection
3. Ensure the repository exists and you have proper access
4. Run the `github-browser-debug.js` tool for diagnostic information
5. For permission issues, run the `github-permissions-fix.js` tool

## Additional Resources

- [GitHub Editing Guide](GITHUB_EDITING_GUIDE.md) - Comprehensive guide to editing on GitHub
- [GitHub API Documentation](https://docs.github.com/en/rest) - Official GitHub API reference