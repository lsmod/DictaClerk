#!/bin/bash

# DictaClerk GPG Signing Setup Script
# This script helps maintainers set up GPG keys for AppImage signing

set -e

echo "🔐 DictaClerk AppImage GPG Signing Setup"
echo "========================================"
echo

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if GPG is installed
if ! command -v gpg2 &> /dev/null && ! command -v gpg &> /dev/null; then
    echo -e "${RED}Error: GPG is not installed. Please install GPG first.${NC}"
    echo "Ubuntu/Debian: sudo apt-get install gnupg2"
    echo "macOS: brew install gnupg"
    exit 1
fi

GPG_CMD="gpg2"
if ! command -v gpg2 &> /dev/null; then
    GPG_CMD="gpg"
fi

echo -e "${BLUE}Using GPG command: $GPG_CMD${NC}"
echo

# Function to generate a new GPG key
generate_gpg_key() {
    echo -e "${YELLOW}Generating new GPG key for DictaClerk AppImage signing...${NC}"
    echo

    echo "Please provide the following information:"
    read -p "Real name (e.g., 'DictaClerk Project'): " REAL_NAME
    read -p "Email address (e.g., 'maintainer@dictaclerk.com'): " EMAIL
    read -p "Comment (e.g., 'DictaClerk AppImage Signing Key'): " COMMENT

    echo
    echo -e "${YELLOW}Generating key with RSA 4096-bit, expires in 5 years...${NC}"

    cat > /tmp/gpg_key_config << EOF
%echo Generating GPG key for DictaClerk AppImage signing
Key-Type: RSA
Key-Length: 4096
Subkey-Type: RSA
Subkey-Length: 4096
Name-Real: $REAL_NAME
Name-Comment: $COMMENT
Name-Email: $EMAIL
Expire-Date: 5y
Passphrase:
%commit
%echo GPG key generation complete
EOF

    echo -e "${YELLOW}Starting key generation (this may take a while)...${NC}"
    $GPG_CMD --batch --generate-key /tmp/gpg_key_config
    rm /tmp/gpg_key_config

    echo -e "${GREEN}✅ GPG key generated successfully!${NC}"
    echo
}

# Function to list existing keys and let user choose
select_existing_key() {
    echo -e "${YELLOW}Existing GPG secret keys:${NC}"
    echo

    $GPG_CMD --list-secret-keys --keyid-format LONG
    echo

    read -p "Enter the key ID you want to use (from the sec line, e.g., ABC123DEF456): " KEY_ID

    if ! $GPG_CMD --list-secret-keys "$KEY_ID" &> /dev/null; then
        echo -e "${RED}Error: Key ID '$KEY_ID' not found.${NC}"
        exit 1
    fi

    echo -e "${GREEN}✅ Using existing key: $KEY_ID${NC}"
}

# Function to export keys for CI/CD
export_keys_for_ci() {
    echo
    echo -e "${YELLOW}Exporting keys for GitHub CI/CD setup...${NC}"
    echo

    # Export private key (base64 encoded)
    echo -e "${BLUE}Exporting private key (base64 encoded for GitHub Secrets)...${NC}"
    PRIVATE_KEY_B64=$($GPG_CMD --armor --export-secret-keys "$KEY_ID" | base64 -w 0)

    # Export public key
    echo -e "${BLUE}Exporting public key...${NC}"
    $GPG_CMD --armor --export "$KEY_ID" > dictaclerk-signing-key.asc

    # Get key fingerprint
    FINGERPRINT=$($GPG_CMD --fingerprint "$KEY_ID" | grep -v "Key fingerprint" | grep "fingerprint" | awk -F'=' '{print $2}' | tr -d ' ')

    echo
    echo -e "${GREEN}✅ Keys exported successfully!${NC}"
    echo
    echo -e "${YELLOW}GitHub Secrets Configuration:${NC}"
    echo "==========================================="
    echo
    echo "Go to your repository Settings → Secrets and variables → Actions"
    echo "and add the following secrets:"
    echo
    echo -e "${BLUE}Secret Name:${NC} GPG_PRIVATE_KEY"
    echo -e "${BLUE}Secret Value:${NC}"
    echo "$PRIVATE_KEY_B64"
    echo
    echo -e "${BLUE}Secret Name:${NC} GPG_PRIVATE_KEY_PASSWORD"
    echo -e "${BLUE}Secret Value:${NC} [Enter your GPG key passphrase, or leave empty if no password]"
    echo
    echo -e "${BLUE}Secret Name:${NC} GPG_KEY_ID"
    echo -e "${BLUE}Secret Value:${NC} $KEY_ID"
    echo
    echo -e "${YELLOW}Public Key Distribution:${NC}"
    echo "========================"
    echo
    echo "The public key has been saved to: dictaclerk-signing-key.asc"
    echo "This file should be distributed with releases for user verification."
    echo
    echo "Key fingerprint: $FINGERPRINT"
    echo
    echo -e "${BLUE}Upload to keyservers:${NC}"
    echo "$GPG_CMD --send-keys $KEY_ID"
    echo "$GPG_CMD --keyserver keyserver.ubuntu.com --send-keys $KEY_ID"
    echo "$GPG_CMD --keyserver keys.openpgp.org --send-keys $KEY_ID"
    echo
}

# Function to test signing
test_signing() {
    echo -e "${YELLOW}Testing GPG signing...${NC}"
    echo

    # Create a test file
    echo "This is a test file for GPG signing verification." > test_file.txt

    # Sign the test file
    echo -e "${BLUE}Signing test file...${NC}"

    # Try signing (will prompt for password if needed)
    if $GPG_CMD --armor --detach-sign test_file.txt; then
        echo -e "${GREEN}✅ Test file signed successfully!${NC}"

        # Check if the key has a password
        if $GPG_CMD --list-secret-keys "$KEY_ID" | grep -q "trust"; then
            echo -e "${BLUE}Note: Your key appears to be passwordless.${NC}"
            echo -e "${YELLOW}You can leave GPG_PRIVATE_KEY_PASSWORD empty in GitHub Secrets.${NC}"
        fi

        # Verify the signature
        echo -e "${BLUE}Verifying signature...${NC}"
        if $GPG_CMD --verify test_file.txt.asc test_file.txt; then
            echo -e "${GREEN}✅ Signature verification successful!${NC}"
        else
            echo -e "${RED}❌ Signature verification failed!${NC}"
        fi

        # Cleanup
        rm test_file.txt test_file.txt.asc
    else
        echo -e "${RED}❌ Test signing failed!${NC}"
        rm test_file.txt
    fi
    echo
}

# Function to create backup
create_backup() {
    echo -e "${YELLOW}Creating encrypted backup of private key...${NC}"
    echo

    # Create backup directory
    BACKUP_DIR="$HOME/.dictaclerk-gpg-backup"
    mkdir -p "$BACKUP_DIR"

    # Export private key to backup
    $GPG_CMD --armor --export-secret-keys "$KEY_ID" > "$BACKUP_DIR/dictaclerk-private-key-backup.asc"

    # Encrypt the backup
    echo -e "${BLUE}Encrypting backup with AES256...${NC}"
    $GPG_CMD --symmetric --cipher-algo AES256 "$BACKUP_DIR/dictaclerk-private-key-backup.asc"

    # Remove unencrypted backup
    rm "$BACKUP_DIR/dictaclerk-private-key-backup.asc"

    echo -e "${GREEN}✅ Encrypted backup created: $BACKUP_DIR/dictaclerk-private-key-backup.asc.gpg${NC}"
    echo -e "${YELLOW}Store this backup in a secure location!${NC}"
    echo
}

# Main script flow
echo "Choose an option:"
echo "1. Generate new GPG key for signing"
echo "2. Use existing GPG key"
echo
read -p "Enter your choice (1 or 2): " CHOICE

case $CHOICE in
    1)
        generate_gpg_key
        # Get the key ID of the newly generated key
        KEY_ID=$($GPG_CMD --list-secret-keys --keyid-format LONG | grep sec | tail -1 | awk '{print $2}' | cut -d/ -f2)
        ;;
    2)
        select_existing_key
        ;;
    *)
        echo -e "${RED}Invalid choice. Exiting.${NC}"
        exit 1
        ;;
esac

if [ -z "$KEY_ID" ]; then
    echo -e "${RED}Error: Could not determine key ID.${NC}"
    exit 1
fi

echo -e "${GREEN}Selected Key ID: $KEY_ID${NC}"
echo

# Export keys for CI/CD
export_keys_for_ci

# Test signing
read -p "Do you want to test GPG signing? (y/n): " TEST_SIGNING
if [[ $TEST_SIGNING =~ ^[Yy]$ ]]; then
    test_signing
fi

# Create backup
read -p "Do you want to create an encrypted backup of the private key? (y/n): " CREATE_BACKUP
if [[ $CREATE_BACKUP =~ ^[Yy]$ ]]; then
    create_backup
fi

echo
echo -e "${GREEN}🎉 GPG signing setup complete!${NC}"
echo
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Add the GitHub Secrets shown above to your repository"
echo "2. Upload the public key to keyservers using the commands shown above"
echo "3. Test the release workflow by creating a version tag"
echo "4. Store the encrypted backup in a secure location"
echo
echo -e "${BLUE}For more information, see: docs/APPIMAGE_SIGNING.md${NC}"
echo

# Save setup info
cat > gpg-setup-info.txt << EOF
DictaClerk GPG Signing Setup Summary
===================================

Date: $(date)
Key ID: $KEY_ID
Public Key File: dictaclerk-signing-key.asc

 GitHub Secrets Required:
 - GPG_PRIVATE_KEY: [base64 encoded private key - shown above]
 - GPG_PRIVATE_KEY_PASSWORD: [your GPG passphrase, or leave empty if no password]
 - GPG_KEY_ID: $KEY_ID

Keyserver Upload Commands:
gpg --send-keys $KEY_ID
gpg --keyserver keyserver.ubuntu.com --send-keys $KEY_ID
gpg --keyserver keys.openpgp.org --send-keys $KEY_ID

Documentation: docs/APPIMAGE_SIGNING.md
EOF

echo -e "${GREEN}Setup information saved to: gpg-setup-info.txt${NC}"
