#!/bin/bash

# GitHub Tools Launcher
# Wrapper script to launch the GitHub Tools menu

# Navigate to the correct directory
cd "$(dirname "$0")/github-tools"

# Run the menu
echo "Starting GitHub Tools Launcher..."
node launch.js

# Return to the original directory
cd - > /dev/null