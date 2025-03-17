#!/bin/bash

# Start WhatsApp bot
echo "Starting WhatsApp bot..."

# Check if node is installed
if ! command -v node &> /dev/null; then
    echo "Error: Node.js is not installed"
    exit 1
fi

# Ensure data directories exist
mkdir -p data/translations logs data/reaction_gifs

# Start the bot
node src/index.js