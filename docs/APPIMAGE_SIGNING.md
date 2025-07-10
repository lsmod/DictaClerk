# AppImage Signing Documentation

This document provides comprehensive instructions for setting up, managing, and using GPG signing for DictaClerk AppImage releases.

## Overview

DictaClerk AppImages are digitally signed using GPG (GNU Privacy Guard) to ensure:

- **Authenticity**: Verify the AppImage comes from the official DictaClerk project
- **Integrity**: Ensure the file hasn't been tampered with or corrupted
- **Security**: Protect users from malicious software masquerading as DictaClerk

## Table of Contents

1. [For Repository Maintainers](#for-repository-maintainers)
2. [For End Users](#for-end-users)
3. [Technical Details](#technical-details)
4. [Troubleshooting](#troubleshooting)
5. [Security Best Practices](#security-best-practices)

## For Repository Maintainers

### Initial GPG Key Setup

#### 1. Generate GPG Key

```bash
# Generate a new GPG key pair
gpg2 --full-gen-key

# Follow the prompts:
# - Key type: (1) RSA and RSA (default)
# - Key size: 4096
# - Expiration: 5y (5 years recommended)
# - Real name: DictaClerk Project
# - Email: maintainer@dictaclerk.com (or your project email)
# - Comment: DictaClerk AppImage Signing Key
```

#### 2. Export Keys for CI/CD

```bash
# List your keys to find the key ID
gpg --list-secret-keys --keyid-format LONG

# Example output:
# sec   rsa4096/ABC123DEF456 2024-01-01 [SC] [expires: 2029-01-01]
# uid   [ultimate] DictaClerk Project <maintainer@dictaclerk.com>
# ssb   rsa4096/GHI789JKL012 2024-01-01 [E] [expires: 2029-01-01]

# Use the key ID from the sec line (ABC123DEF456 in this example)
export GPG_KEY_ID="ABC123DEF456"

# Export private key (base64 encoded for GitHub Secrets)
gpg --armor --export-secret-keys $GPG_KEY_ID | base64 -w 0

# Export public key for distribution
gpg --armor --export $GPG_KEY_ID > dictaclerk-signing-key.asc
```

#### 3. Add to GitHub Secrets:

- Go to repository Settings → Secrets and variables → Actions
- Add `GPG_PRIVATE_KEY` with the base64 output
- Add `GPG_PRIVATE_KEY_PASSWORD` with your key password (leave empty if your key has no password)
- Add `GPG_KEY_ID` with your key ID

#### 4. Publish Public Key

```bash
# Upload to public keyservers
gpg --send-keys $GPG_KEY_ID

# Upload to multiple keyservers for redundancy
gpg --keyserver keyserver.ubuntu.com --send-keys $GPG_KEY_ID
gpg --keyserver keys.openpgp.org --send-keys $GPG_KEY_ID
gpg --keyserver pgp.mit.edu --send-keys $GPG_KEY_ID
```

### Key Management

#### Key Rotation

It's recommended to rotate GPG keys every 5 years:

1. Generate a new key following the steps above
2. Update GitHub Secrets with the new key
3. Create a signed release announcing the key change
4. Keep the old key available for verifying historical releases

#### Key Backup

```bash
# Create encrypted backup of your private key
gpg --armor --export-secret-keys $GPG_KEY_ID > dictaclerk-private-key-backup.asc

# Encrypt the backup with a strong password
gpg --symmetric --cipher-algo AES256 dictaclerk-private-key-backup.asc

# Store the .gpg file in a secure location (not in version control!)
rm dictaclerk-private-key-backup.asc
```

#### Key Revocation

If your key is compromised:

1. Generate a revocation certificate:

```bash
gpg --gen-revoke $GPG_KEY_ID > dictaclerk-revocation-cert.asc
```

2. Import and upload the revocation:

```bash
gpg --import dictaclerk-revocation-cert.asc
gpg --send-keys $GPG_KEY_ID
```

3. Update GitHub Secrets with a new key immediately

## For End Users

### Downloading and Verifying AppImages

#### 1. Download Files

From the [releases page](https://github.com/lsmod/DictaClerk/releases), download:

- `dictaclerk.appimage` - The main application
- `dictaclerk.appimage.asc` - GPG signature
- `dictaclerk.appimage.sha256` - Checksums
- `dictaclerk-signing-key.asc` - Public key (first time only)

#### 2. Import Public Key (First Time Only)

```bash
# Import the public key
curl -L https://github.com/lsmod/DictaClerk/releases/latest/download/dictaclerk-signing-key.asc | gpg --import

# Or download and import manually
wget https://github.com/lsmod/DictaClerk/releases/latest/download/dictaclerk-signing-key.asc
gpg --import dictaclerk-signing-key.asc
```

#### 3. Verify GPG Signature

```bash
# Verify the AppImage signature
gpg --verify dictaclerk.appimage.asc dictaclerk.appimage
```

**Expected output:**

```
gpg: Signature made [date] using RSA key [KEY_ID]
gpg: Good signature from "DictaClerk Project <maintainer@dictaclerk.com>"
```

**Warning signs:**

- `BAD signature` - File has been tampered with
- `Can't check signature: No public key` - You need to import the public key
- Different key ID - Potential security issue

#### 4. Verify Checksums

```bash
# Verify file integrity
sha256sum -c dictaclerk.appimage.sha256
```

**Expected output:**

```
dictaclerk.appimage: OK
dictaclerk.appimage.asc: OK
```

#### 5. Run AppImage

```bash
# Make executable and run
chmod +x dictaclerk.appimage
./dictaclerk.appimage
```

### Alternative Verification Methods

#### Using AppImageTool (if available)

```bash
# Some AppImages support embedded signature verification
./dictaclerk.appimage --appimage-signature
```

#### Manual Checksum Verification

```bash
# Calculate checksum manually
sha256sum dictaclerk.appimage

# Compare with the value in dictaclerk.appimage.sha256
cat dictaclerk.appimage.sha256
```

## Technical Details

### Signing Process

1. **Build**: Tauri builds the AppImage during CI/CD
2. **Import**: GPG private key is imported from GitHub Secrets
3. **Sign**: GPG creates a detached signature (`.asc` file)
4. **Verify**: Signature is immediately verified in CI
5. **Package**: AppImage, signature, and checksums are bundled for release

### File Structure

```
Release Assets:
├── dictaclerk.appimage          # Main executable
├── dictaclerk.appimage.asc      # GPG detached signature
├── dictaclerk.appimage.sha256   # SHA256 checksums
└── dictaclerk-signing-key.asc   # Public key for verification
```

### GPG Signature Format

- **Type**: Detached signature (separate `.asc` file)
- **Algorithm**: RSA 4096-bit
- **Format**: ASCII armored
- **Compatibility**: Standard OpenPGP format

## Troubleshooting

### Common Issues

#### "No public key" Error

**Problem**: `gpg: Can't check signature: No public key`

**Solution**:

```bash
# Import the public key
curl -L https://github.com/lsmod/DictaClerk/releases/latest/download/dictaclerk-signing-key.asc | gpg --import
```

#### "BAD signature" Error

**Problem**: `gpg: BAD signature from "DictaClerk Project"`

**Causes**:

- File corruption during download
- File has been tampered with
- Wrong signature file

**Solutions**:

1. Re-download all files
2. Verify you're using the correct signature file
3. Check checksums first

#### Checksum Mismatch

**Problem**: `sha256sum: dictaclerk.appimage: FAILED`

**Solutions**:

1. Re-download the AppImage
2. Check network connection stability
3. Try downloading from a different network

#### Key Import Fails

**Problem**: Cannot import GPG key

**Solutions**:

```bash
# Try different keyservers
gpg --keyserver keyserver.ubuntu.com --recv-keys [KEY_ID]
gpg --keyserver keys.openpgp.org --recv-keys [KEY_ID]

# Or import from file
wget https://github.com/lsmod/DictaClerk/releases/latest/download/dictaclerk-signing-key.asc
gpg --import dictaclerk-signing-key.asc
```

### CI/CD Troubleshooting

#### GPG Import Fails in CI

**Check**:

- GitHub Secrets are correctly set
- Private key is properly base64 encoded
- Key hasn't expired

**Debug**:

```bash
# Test key import locally
echo "$GPG_PRIVATE_KEY" | base64 -d | gpg --import
```

#### AppImage Not Found

**Check**:

- Tauri build completed successfully
- AppImage target is enabled in `tauri.conf.json`
- Build artifacts are in expected location

## Security Best Practices

### For Maintainers

1. **Key Security**:

   - Use strong passphrases (20+ characters)
   - Store private keys in encrypted locations
   - Never commit private keys to version control
   - Consider hardware security keys for production

2. **Key Management**:

   - Set expiration dates (5 years maximum)
   - Rotate keys regularly
   - Maintain revocation certificates
   - Use separate keys for different projects

3. **CI/CD Security**:
   - Regularly audit GitHub Secrets access
   - Use minimal required permissions
   - Monitor for unauthorized key usage
   - Enable audit logging

### For Users

1. **Always Verify**:

   - Check GPG signatures before running
   - Verify checksums for integrity
   - Only download from official sources

2. **Key Management**:

   - Keep GPG software updated
   - Verify public key fingerprints
   - Be cautious of key changes

3. **Operational Security**:
   - Download over HTTPS only
   - Use trusted networks
   - Keep security software updated

## Support

For questions about AppImage signing:

1. Check this documentation first
2. Search existing [GitHub Issues](https://github.com/lsmod/DictaClerk/issues)
3. Create a new issue with the `security` label
4. Include relevant error messages and steps to reproduce

---

**Last Updated**: Generated automatically with each release
**Key Fingerprint**: Available in releases and on keyservers
**Contact**: maintainer@dictaclerk.com
