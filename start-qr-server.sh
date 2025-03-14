#!/bin/bash
# Run the QR server in the background
node run-qr-server.js &

# Wait for the server to start
sleep 2

# Inform the user
echo "QR code server should be running at http://localhost:5006"
echo "Please open the URL in your browser to scan the QR code"

# Keep the script running but allow for interruption
echo "Press Ctrl+C to stop the server when finished"
wait