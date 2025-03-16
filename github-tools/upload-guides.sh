#!/bin/bash

# Upload fork guides to GitHub
echo "Uploading fork guides to GitHub..."
cd /home/runner/workspace/github-tools
node upload-fork-guides.js