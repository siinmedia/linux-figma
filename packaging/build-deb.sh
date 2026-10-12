#!/usr/bin/env bash
#
# build-deb.sh — build the figma-font-bridge .deb package
#
# Bundles node_modules so the resulting package is self-contained (no npm
# install needed at setup time). Run from anywhere.
#
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION="$(grep -oP '^Version:\s*\K.*' "$REPO_DIR/packaging/control")"
PKG="figma-font-bridge"
BUILD_DIR="$(mktemp -d)"
OUT="$REPO_DIR/${PKG}_${VERSION}_all.deb"

echo "==> Building $PKG $VERSION"

# 1. Lay out package tree
APP_DIR="$BUILD_DIR/usr/share/figma-font-bridge"
mkdir -p "$APP_DIR"
cp -r "$REPO_DIR/companion" "$APP_DIR/"
rm -rf "$APP_DIR/companion/public"

# 2. Bundle production dependencies (self-contained package)
if command -v npm >/dev/null 2>&1; then
    (cd "$APP_DIR/companion" && npm install --omit=dev --silent)
else
    echo "!! npm not found — package will require 'npm install' at setup" >&2
fi

# 3. Control files
mkdir -p "$BUILD_DIR/DEBIAN"
cp "$REPO_DIR/packaging/control" "$BUILD_DIR/DEBIAN/control"
cp "$REPO_DIR/packaging/postinst" "$BUILD_DIR/DEBIAN/postinst"
cp "$REPO_DIR/packaging/prerm" "$BUILD_DIR/DEBIAN/prerm"
chmod 755 "$BUILD_DIR/DEBIAN/postinst" "$BUILD_DIR/DEBIAN/prerm"

# 4. Build
dpkg-deb --root-owner-group --build "$BUILD_DIR" "$OUT"
rm -rf "$BUILD_DIR"

echo "==> Done: $OUT"
