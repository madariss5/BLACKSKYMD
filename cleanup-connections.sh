#!/bin/bash

# BLACKSKY-MD WhatsApp Connection Cleanup Script
# This script helps fix connection issues by cleaning up auth files

# Function to display a colored message
function print_message() {
  local color=$1
  local message=$2
  
  case $color in
    "red")    echo -e "\e[31m$message\e[0m" ;;
    "green")  echo -e "\e[32m$message\e[0m" ;;
    "yellow") echo -e "\e[33m$message\e[0m" ;;
    "blue")   echo -e "\e[34m$message\e[0m" ;;
    "purple") echo -e "\e[35m$message\e[0m" ;;
    "cyan")   echo -e "\e[36m$message\e[0m" ;;
    *)        echo "$message" ;;
  esac
}

# Display header
function show_header() {
  clear
  print_message "cyan" "╔═══════════════════════════════════════════════════╗"
  print_message "cyan" "║                                                   ║"
  print_message "cyan" "║    BLACKSKY-MD CONNECTION CLEANUP UTILITY         ║"
  print_message "cyan" "║                                                   ║"
  print_message "cyan" "║  Use this tool to fix connection issues           ║"
  print_message "cyan" "║  by cleaning up authentication files              ║"
  print_message "cyan" "║                                                   ║"
  print_message "cyan" "╚═══════════════════════════════════════════════════╝"
  echo
}

# Standard cleanup - removes current auth files but keeps backups
function standard_cleanup() {
  print_message "yellow" "Performing standard cleanup..."
  
  # Create backup directory if it doesn't exist
  mkdir -p auth_info_backup
  
  # Back up current auth files if they exist and are not empty
  if [ -d auth_info_baileys ] && [ "$(ls -A auth_info_baileys 2>/dev/null)" ]; then
    print_message "blue" "Creating backup of current auth files..."
    cp -r auth_info_baileys/* auth_info_backup/ 2>/dev/null
  fi
  
  # Remove current auth directories
  print_message "yellow" "Removing connection files for a fresh start..."
  
  # Primary auth directories
  rm -rf auth_info_baileys
  rm -rf auth_info_baileys_fresh
  rm -rf auth_info_baileys_qr
  rm -rf auth_info
  rm -rf session.json
  
  # Browser-specific directories
  rm -rf auth_info_manager_chrome
  rm -rf auth_info_manager_edge
  rm -rf auth_info_manager_firefox
  rm -rf auth_info_manager_opera
  rm -rf auth_info_manager_safari
  
  print_message "green" "Standard cleanup complete. Your backup files are preserved."
  print_message "green" "You can now restart the connection with a fresh session."
}

# Full reset - removes all auth files including backups
function full_reset() {
  print_message "red" "Performing FULL RESET - this will remove ALL auth files including backups!"
  print_message "yellow" "You will need to scan the QR code again to connect."
  echo
  read -p "Are you sure you want to continue? (y/n): " confirm
  
  if [[ $confirm == "y" || $confirm == "Y" ]]; then
    print_message "yellow" "Removing ALL connection files and backups..."
    
    # Remove all auth directories
    rm -rf auth_info*
    rm -rf session.json
    
    print_message "green" "Full reset complete. All connection files have been removed."
    print_message "green" "You will need to scan a new QR code to connect."
  else
    print_message "blue" "Full reset cancelled."
  fi
}

# Show cleanup options
function show_options() {
  show_header
  
  print_message "blue" "Select a cleanup option:"
  echo
  print_message "yellow" "1) Standard Cleanup"
  print_message "yellow" "   - Removes current session data"
  print_message "yellow" "   - Preserves backup files"
  print_message "yellow" "   - Recommended for most connection issues"
  echo
  print_message "red" "2) Full Reset"
  print_message "red" "   - Removes ALL session data including backups"
  print_message "red" "   - Use only if standard cleanup doesn't work"
  echo
  print_message "yellow" "3) Exit"
  echo
  read -p "Enter your choice (1-3): " choice
  
  case $choice in
    1) standard_cleanup ;;
    2) full_reset ;;
    3) print_message "blue" "Exiting cleanup utility." ;;
    *) print_message "red" "Invalid option. Please try again."; show_options ;;
  esac
}

# Main function
function main() {
  show_options
  
  echo
  print_message "green" "Cleanup process complete."
  print_message "cyan" "To start the WhatsApp connection, run: ./start-whatsapp.sh"
  echo
}

# Start the script
main