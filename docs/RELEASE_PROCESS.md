# DictaClerk Release Process

This document outlines the automated release process for DictaClerk, including signed AppImage generation.

## Overview

DictaClerk uses an automated release pipeline that:

- Triggers on version tags (`v*.*.*`)
- Builds and signs AppImages with GPG
- Creates GitHub Releases with downloadable assets
- Includes verification files (checksums and signatures)

## Release Workflow

### 1. Prepare for Release

1. **Update Version**: Ensure `src-tauri/tauri.conf.json` has the correct version
2. **Test Build**: Verify the application builds correctly locally
3. **Update Changelog**: Document changes in `CHANGELOG.md`
4. **Commit Changes**: Push all changes to the main branch

### 2. Create Release Tag

```bash
# Create and push a version tag
git tag v1.2.3
git push origin v1.2.3
```

**Tag Format**: Must follow semantic versioning: `v{major}.{minor}.{patch}`

Examples:

- `v1.0.0` - Major release
- `v1.1.0` - Minor release
- `v1.1.1` - Patch release

### 3. Automated Release Process

Once the tag is pushed, the GitHub Actions workflow (`.github/workflows/release.yml`) automatically:

1. **Builds** the AppImage using Tauri
2. **Renames** the AppImage to `dictaclerk.appimage`
3. **Signs** the AppImage with GPG
4. **Generates** checksums (SHA256)
5. **Creates** GitHub Release with all assets
6. **Verifies** signatures and checksums

### 4. Release Assets

Each release includes:

| File                         | Description                 |
| ---------------------------- | --------------------------- |
| `dictaclerk.appimage`        | Main executable AppImage    |
| `dictaclerk.appimage.asc`    | GPG detached signature      |
| `dictaclerk.appimage.sha256` | SHA256 checksums            |
| `dictaclerk-signing-key.asc` | Public key for verification |

## Release Validation

### Automatic Checks

The release workflow includes built-in verification:

- GPG signature validation
- Checksum verification
- AppImage executable test

### Manual Verification

After release, manually verify:

1. **Download Test**:

```bash
wget https://github.com/lsmod/DictaClerk/releases/latest/download/dictaclerk.appimage
```

2. **Signature Verification**:

```bash
wget https://github.com/lsmod/DictaClerk/releases/latest/download/dictaclerk.appimage.asc
wget https://github.com/lsmod/DictaClerk/releases/latest/download/dictaclerk-signing-key.asc
gpg --import dictaclerk-signing-key.asc
gpg --verify dictaclerk.appimage.asc dictaclerk.appimage
```

3. **Checksum Verification**:

```bash
wget https://github.com/lsmod/DictaClerk/releases/latest/download/dictaclerk.appimage.sha256
sha256sum -c dictaclerk.appimage.sha256
```

4. **Functional Test**:

```bash
chmod +x dictaclerk.appimage
./dictaclerk.appimage
```

## Troubleshooting

### Release Workflow Fails

Common issues and solutions:

1. **GPG Signing Fails**:

   - Check GitHub Secrets are correctly configured
   - Verify GPG key hasn't expired
   - See `docs/APPIMAGE_SIGNING.md` for detailed setup

2. **Build Fails**:

   - Check Tauri configuration
   - Verify all dependencies are available
   - Review build logs in GitHub Actions

3. **Upload Fails**:
   - Check repository permissions
   - Verify `GITHUB_TOKEN` has required scopes
   - Ensure release workflow has `contents: write` permission

### Tag Issues

1. **Wrong Tag Format**:

```bash
# Delete incorrect tag locally and remotely
git tag -d v1.2.3
git push origin :refs/tags/v1.2.3

# Create correct tag
git tag v1.2.3
git push origin v1.2.3
```

2. **Missing Commits**:

```bash
# If you tagged too early, delete and recreate
git tag -d v1.2.3
git push origin :refs/tags/v1.2.3

# Make additional commits, then retag
git tag v1.2.3
git push origin v1.2.3
```

## Emergency Procedures

### Recall a Release

If a release has critical issues:

1. **Mark as Pre-release**:

   - Go to GitHub Releases
   - Edit the release
   - Check "This is a pre-release"

2. **Create Hotfix**:

```bash
# Create hotfix branch
git checkout -b hotfix/v1.2.4

# Fix the issue and commit
git commit -m "Fix critical issue"

# Tag and release hotfix
git tag v1.2.4
git push origin v1.2.4
```

### GPG Key Compromise

If the signing key is compromised:

1. **Revoke the key** (see `docs/APPIMAGE_SIGNING.md`)
2. **Generate new key** using `scripts/setup-gpg-signing.sh`
3. **Update GitHub Secrets** with new key
4. **Create announcement release** explaining the key change

## Security Considerations

- **Never commit** GPG private keys to the repository
- **Regularly rotate** GPG keys (recommended: every 5 years)
- **Monitor** for unauthorized releases
- **Verify** all releases before announcing
- **Keep backups** of GPG keys in secure locations

## Release Checklist

Before creating a release tag:

- [ ] Version updated in `tauri.conf.json`
- [ ] Changelog updated
- [ ] All tests passing
- [ ] Local build successful
- [ ] Changes committed and pushed
- [ ] GPG key configured and not expired
- [ ] GitHub Secrets up to date

After release:

- [ ] Download and verify release assets
- [ ] Test AppImage functionality
- [ ] Announce release (if applicable)
- [ ] Update documentation if needed

## Related Documentation

- [AppImage Signing Documentation](./APPIMAGE_SIGNING.md) - GPG setup and management
- [CI/CD Pipeline](../.github/workflows/) - Workflow configurations
- [Tauri Configuration](../src-tauri/tauri.conf.json) - Build settings

---

For questions about the release process, see the [GitHub Issues](https://github.com/lsmod/DictaClerk/issues) or create a new issue with the `release` label.
