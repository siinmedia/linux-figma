# Release v4.0.0 — Production Ready

This document describes how to publish the final release to GitHub.

## What's in this release

- **Source code**: Self-contained implementation (no external dependencies at setup)
- **.deb package**: Fully bundled (`node_modules` included), no `npm install` needed
- **Improvements over v3.x**:
  - Config file support (`~/.config/figma-linux/settings.json`)
  - CLI flags: `-v`, `--version`, `-h`, `--help`, `--port PORT`
  - Graceful shutdown (SIGTERM/SIGINT) for systemd compatibility
  - Better CORS handling (matches Figma origin dynamically)
  - Cleaner logs (only Figma traffic logged, not noise)
  - Version bump to 4.0.0

## Files to upload

1. **GitHub Releases** page: https://github.com/siinmedia/linux-figma/releases/new
   - Tag version: `v4.0.0`
   - Title: `Figma Font Bridge v4.0.0 — Production Ready`
   - Description: Paste from `RELEASE.md` below
   - Attach file: `figma-font-bridge_4.0.0_all.deb` (already built, see path below)

2. **Binaries** tab: Upload `figma-font-bridge_4.0.0_all.deb` as an asset

## Release Notes (copy-paste ready)

```markdown
## v4.0.0 — Production Ready (2025-10-12)

### New features
- **Config file support**: Edit `~/.config/figma-linux/settings.json` to customize host/port/fontDirs
- **CLI flags**: `node index.js -v|--version|-h|--help|--port PORT`
- **Graceful shutdown**: systemd compatible (SIGTERM/SIGINT)
- **Better logging**: Only Figma requests logged, no noisy errors
- **Dynamic CORS**: Matches request origin or defaults to `https://www.figma.com`

### Changes
- Improved font metadata parsing with better style detection
- Health endpoint shows total faces and dirs
- Multiple port binding with primary port override

### How to upgrade
```bash
sudo dpkg -r figma-font-bridge && sudo dpkg -i figma-font-bridge_4.0.0_all.deb
systemctl --user restart figma-font-bridge
```

### Credits
Protocol knowledge credited to [Figma-Linux/figma-linux-font-helper](https://github.com/Figma-Linux/figma-linux-font-helper) by Roman Chugunov.

See full changelog at https://github.com/siinmedia/linux-figma/blob/main/CREDITS.md
```

## Where is the .deb file?

Built from this repo: `/home/siinmedia/figma-font-bridge/figma-font-bridge_4.0.0_all.deb`

To rebuild locally:
```bash
cd /path/to/linux-figma
./packaging/build-deb.sh
ls -lh figma-font-bridge_4.0.0_all.deb
```

## Verification steps (after upload)

1. Download `.deb` from GitHub Releases
2. Install on clean Ubuntu/Debian: `sudo dpkg -i figma-font-bridge_4.0.0_all.deb`
3. Check service: `systemctl --user status figma-font-bridge`
4. Test endpoints: `curl http://127.0.0.1:44950/figma/version` → should return `{"version":4}`
5. Open figma.com → reload → local fonts appear ✓

---

**License**: MIT
**Maintainer**: @siinmedia
**Repo**: https://github.com/siinmedia/linux-figma
