#!/usr/bin/env bash
# Regenerate all tray-icon PNG variants from resources/trayIconTemplate.svg.
# Uses pnpm dlx sharp-cli — no system dependencies beyond pnpm + Node.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"
RESOURCES="$ROOT/resources"
SVG="$RESOURCES/trayIconTemplate.svg"

if [[ ! -f "$SVG" ]]; then
  echo "missing $SVG" >&2
  exit 1
fi

TMP="$(mktemp -d)"
trap "rm -rf '$TMP'" EXIT

# Render the black master at 1024×1024 with transparent background.
pnpm dlx sharp-cli \
  -i "$SVG" -o "$TMP/master-black.png" \
  resize 1024 1024 --fit contain --background "#00000000" >/dev/null

# Render the white master (Windows dark-theme variant) — swap fill color in the SVG first.
sed 's/fill="black"/fill="white"/g' "$SVG" > "$TMP/whiteSource.svg"
pnpm dlx sharp-cli \
  -i "$TMP/whiteSource.svg" -o "$TMP/master-white.png" \
  resize 1024 1024 --fit contain --background "#00000000" >/dev/null

# Downscale each master to the sizes Electron's tray needs.
emit() {
  local src="$1" size="$2" out="$3"
  pnpm dlx sharp-cli -i "$src" -o "$out" resize "$size" "$size" --fit contain >/dev/null
  echo "  wrote $(basename "$out") (${size}×${size})"
}

emit "$TMP/master-black.png" 22 "$RESOURCES/trayIconTemplate.png"
emit "$TMP/master-black.png" 44 "$RESOURCES/trayIconTemplate@2x.png"
emit "$TMP/master-black.png" 16 "$RESOURCES/trayIcon-black.png"
emit "$TMP/master-black.png" 32 "$RESOURCES/trayIcon-black@2x.png"
emit "$TMP/master-white.png" 16 "$RESOURCES/trayIcon-white.png"
emit "$TMP/master-white.png" 32 "$RESOURCES/trayIcon-white@2x.png"

echo "done."
