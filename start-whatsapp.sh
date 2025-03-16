#!/bin/bash

# BLACKSKY-MD WhatsApp Bot Starter Script
# This script provides a menu to select different connection methods

clear
echo "╔════════════════════════════════════════════════════╗"
echo "║                                                    ║"
echo "║            BLACKSKY-MD WHATSAPP BOT                ║"
echo "║                                                    ║"
echo "║  Choose a connection method:                       ║"
echo "║                                                    ║"
echo "║  1. Advanced Connection Manager (Recommended)      ║"
echo "║     * Tests multiple browser profiles              ║"
echo "║     * Most reliable for cloud environments         ║"
echo "║                                                    ║"
echo "║  2. Terminal QR Code                               ║"
echo "║     * Simple terminal QR code display              ║"
echo "║     * Good for headless environments               ║"
echo "║                                                    ║"
echo "║  3. Firefox Connection                             ║"
echo "║     * Uses Firefox browser fingerprinting          ║"
echo "║                                                    ║"
echo "║  4. Safari Connection                              ║"
echo "║     * Uses Safari browser fingerprinting           ║"
echo "║                                                    ║"
echo "║  0. Exit                                           ║"
echo "║                                                    ║"
echo "╚════════════════════════════════════════════════════╝"
echo

read -p "Enter your choice [0-4]: " choice

case $choice in
    1)
        echo "Starting Advanced Connection Manager..."
        node connection-manager.js
        ;;
    2)
        echo "Starting Terminal QR Code connection..."
        node terminal-qr-connect.js
        ;;
    3)
        echo "Starting Firefox Connection..."
        node firefox-connect.js
        ;;
    4)
        echo "Starting Safari Connection..."
        node safari-connect.js
        ;;
    0)
        echo "Exiting..."
        exit 0
        ;;
    *)
        echo "Invalid choice. Please run the script again."
        exit 1
        ;;
esac