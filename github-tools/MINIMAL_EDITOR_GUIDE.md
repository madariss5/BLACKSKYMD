# Minimal GitHub Editor Guide

This guide explains how to use the minimal GitHub editor tool, which provides a simple way to edit files directly in your GitHub repository from the command line.

## Prerequisites

- You need to have the `GITHUB_TOKEN` environment variable set with a valid Personal Access Token
- Your token needs at least `repo` scope permissions

## Getting Started

1. Navigate to the directory where `minimal-github-editor.js` is located
2. Run the editor with Node.js:

```bash
node minimal-github-editor.js
```

## Features

### Main Menu

The editor presents a simple menu with the following options:

1. **Browse repository** - Navigate through directories and files
2. **Edit a file** - Edit a specific file by providing its path
3. **Create a new file** - Create a new file in the repository
4. **Verify GitHub token** - Check that your token is valid
0. **Exit** - Exit the editor

### Browsing the Repository

- Navigate through directories by selecting them by number
- View files by selecting them by number
- Use `b` to go back to the parent directory
- Use `h` to go to the home (root) directory
- Use `q` to return to the main menu

### Editing Files

When editing a file:
1. The current content is displayed
2. You can enter the new content line by line
3. Type `--SAVE--` on a line by itself when you're done
4. Enter a commit message to save your changes

### Creating New Files

When creating a file:
1. Enter the file path including any directories
2. Enter the content line by line
3. Type `--SAVE--` on a line by itself when you're done
4. Enter a commit message to save your new file

## Troubleshooting

If you encounter issues:

1. Verify your GitHub token is valid (Option 4 in the main menu)
2. Check your network connection
3. Ensure the repository exists and you have the correct permissions
4. Look for error messages that provide details about what went wrong