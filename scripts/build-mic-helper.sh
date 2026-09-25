#!/usr/bin/env bash
# Builds resources/mic-users, the universal macOS helper that reports which apps hold
# the microphone (source: scripts/mic-users.swift). Needs Xcode's command line tools.
set -euo pipefail
cd "$(dirname "$0")/.."
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
for arch in arm64 x86_64; do
  swiftc -O -swift-version 5 -target "$arch-apple-macos13" scripts/mic-users.swift -o "$TMP/$arch"
done
lipo -create "$TMP/arm64" "$TMP/x86_64" -output resources/mic-users
