#!/usr/bin/env bash
# Tag the current commit and publish a GitHub Release with the macOS .dmg(s) and Windows .exe.
# Usage: pnpm release v0.2.0 "Optional release notes"
set -euo pipefail

VERSION="${1:-}"
NOTES="${2:-}"

if [[ -z "$VERSION" ]]; then
  echo "usage: pnpm release <vX.Y.Z> [\"release notes\"]" >&2
  exit 1
fi

if [[ ! "$VERSION" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "version must look like v0.1.0 (got: $VERSION)" >&2
  exit 1
fi

if ! command -v gh >/dev/null 2>&1; then
  echo "gh CLI not found. Install it: brew install gh" >&2
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "gh CLI not authenticated. Run: gh auth login" >&2
  exit 1
fi

# Stop if there are uncommitted changes — release should reflect a real commit.
if [[ -n "$(git status --porcelain)" ]]; then
  echo "working tree is dirty — commit or stash before releasing." >&2
  exit 1
fi

# Bump package.json version (without the v prefix) and commit if needed.
NPM_VERSION="${VERSION#v}"
CURRENT_VERSION="$(node -p "require('./package.json').version")"
if [[ "$CURRENT_VERSION" != "$NPM_VERSION" ]]; then
  node -e "
    const fs = require('fs');
    const p = JSON.parse(fs.readFileSync('package.json','utf8'));
    p.version = '$NPM_VERSION';
    fs.writeFileSync('package.json', JSON.stringify(p, null, 2) + '\n');
  "
  git add package.json
  git commit -m "Release $VERSION"
fi

# Tag the release commit (idempotent if tag is already at HEAD).
if git rev-parse "$VERSION" >/dev/null 2>&1; then
  EXISTING_TAG_SHA="$(git rev-list -n 1 "$VERSION")"
  HEAD_SHA="$(git rev-parse HEAD)"
  if [[ "$EXISTING_TAG_SHA" != "$HEAD_SHA" ]]; then
    echo "tag $VERSION already exists but points to $EXISTING_TAG_SHA, not HEAD ($HEAD_SHA)." >&2
    echo "delete the tag or pick a different version." >&2
    exit 1
  fi
  echo "tag $VERSION already exists at HEAD — reusing."
else
  git tag -a "$VERSION" -m "Release $VERSION"
fi
git push origin HEAD "$VERSION"

# Build artifacts.
echo "building macOS .dmg(s)…"
pnpm dist:mac

if [[ "${SKIP_WINDOWS:-}" != "1" ]]; then
  if pnpm dist:win >/dev/null 2>&1; then
    echo "built Windows .exe"
  else
    echo "warn: pnpm dist:win failed (skip with SKIP_WINDOWS=1). Continuing with macOS only." >&2
  fi
fi

# Collect built artifacts.
ARTIFACTS=()
shopt -s nullglob
for f in dist/*.dmg dist/*.exe; do
  ARTIFACTS+=("$f")
done
shopt -u nullglob

if [[ ${#ARTIFACTS[@]} -eq 0 ]]; then
  echo "no .dmg or .exe found under dist/" >&2
  exit 1
fi

# Create the GitHub Release and upload artifacts.
if [[ -z "$NOTES" ]]; then
  gh release create "$VERSION" "${ARTIFACTS[@]}" --generate-notes
else
  gh release create "$VERSION" "${ARTIFACTS[@]}" --notes "$NOTES"
fi

echo
echo "released $VERSION:"
gh release view "$VERSION" --web 2>/dev/null || true
