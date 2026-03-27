#!/bin/bash
set -e

UUID="alt-tab-mru-switcher@miranova.studio"
DEST="$HOME/.local/share/gnome-shell/extensions/$UUID"

echo "Installing $UUID..."

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR/$UUID"

mkdir -p "$DEST/schemas"

cp metadata.json "$DEST/"
cp extension.js "$DEST/"
cp prefs.js "$DEST/"
cp schemas/*.xml "$DEST/schemas/"

glib-compile-schemas "$DEST/schemas/"

echo "Installed to $DEST"
echo ""
echo "To activate:"
echo "  1. Restart GNOME Shell: Alt+F2 → 'r' (X11) or log out/in (Wayland)"
echo "  2. Enable: gnome-extensions enable $UUID"
