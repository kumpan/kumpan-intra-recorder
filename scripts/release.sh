#!/usr/bin/env bash
# Tag the current commit and publish a GitHub Release with the macOS .dmg(s).
# The Windows .exe is built and attached by .github/workflows/windows-release.yml.
# Usage:
#   pnpm release v0.2.0
#   pnpm release v0.2.0 "Inline release notes"
#   RELEASE_NOTES_FILE=/path/to/notes.md pnpm release v0.2.0
#
# Prefer RELEASE_NOTES_FILE for multi-line markdown — inline notes passed as the
# second argument are subject to shell escaping pitfalls (backticks get evaluated,
# heredocs that span lines may be mangled by upstream tools that flatten the
# command). A file is parsed verbatim by `gh release create --notes-file`.
set -euo pipefail

VERSION="${1:-}"
NOTES="${2:-}"
NOTES_FILE="${RELEASE_NOTES_FILE:-}"

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

# Clean dist/ so leftover .dmg/.exe from a previous version don't get attached.
rm -rf dist

# Build artifacts.
echo "building macOS .dmg(s)…"
pnpm dist:mac

# Windows is NOT built here. electron-builder's bundled makensis is Intel-only, so
# cross-compiling the .exe on an Apple Silicon Mac needs Rosetta — which Apple removes
# in macOS 28. The windows-release.yml workflow builds it on a real Windows runner when
# this script publishes the release, and attaches it a few minutes later.

# Collect built artifacts for THIS version (filename includes NPM_VERSION).
ARTIFACTS=()
shopt -s nullglob
for f in dist/*"${NPM_VERSION}"*.dmg; do
  ARTIFACTS+=("$f")
done
shopt -u nullglob

if [[ ${#ARTIFACTS[@]} -eq 0 ]]; then
  echo "no .dmg matching version $NPM_VERSION found under dist/" >&2
  exit 1
fi

# Create the GitHub Release and upload artifacts.
# Prefer --notes-file when we have one — safer than inline notes which the
# caller may have built with backticks or other shell-active characters.
if [[ -n "$NOTES_FILE" && -f "$NOTES_FILE" ]]; then
  gh release create "$VERSION" "${ARTIFACTS[@]}" --title "$VERSION" --notes-file "$NOTES_FILE"
elif [[ -n "$NOTES" ]]; then
  gh release create "$VERSION" "${ARTIFACTS[@]}" --title "$VERSION" --notes "$NOTES"
else
  gh release create "$VERSION" "${ARTIFACTS[@]}" --title "$VERSION" --generate-notes
fi

echo
echo "released $VERSION (macOS). Windows .exe is building on CI and will attach itself:"
echo "  gh run watch \$(gh run list --workflow windows-release.yml --limit 1 --json databaseId --jq '.[0].databaseId')"
gh release view "$VERSION" --web 2>/dev/null || true
