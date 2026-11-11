#!/usr/bin/env bash
# Install Terminal Theme Sync for the current user.

set -euo pipefail

UUID="terminal-theme-sync@jonathangn.github.io"
OLD_UUID="terminal-theme-sync@jonathan"
SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXT_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/gnome-shell/extensions/$UUID"
OLD_EXT_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/gnome-shell/extensions/$OLD_UUID"

if ! command -v glib-compile-schemas >/dev/null; then
  echo "glib-compile-schemas is required (install libglib2.0-bin)." >&2
  exit 1
fi

if ! command -v gnome-extensions >/dev/null; then
  echo "gnome-extensions is required (install gnome-shell)." >&2
  exit 1
fi

echo "Compiling settings schema..."
glib-compile-schemas --strict "$SRC_DIR/schemas"

if [ -d "$OLD_EXT_DIR" ]; then
  echo "Removing previous installation with the old UUID..."
  gnome-extensions disable "$OLD_UUID" 2>/dev/null || true
  rm -rf "$OLD_EXT_DIR"
fi

echo "Installing to $EXT_DIR"
rm -rf "$EXT_DIR"
mkdir -p "$EXT_DIR"
cp "$SRC_DIR/metadata.json" \
   "$SRC_DIR/extension.js" \
   "$SRC_DIR/prefs.js" \
   "$SRC_DIR/terminalSync.js" \
   "$EXT_DIR/"
cp -r "$SRC_DIR/schemas" "$EXT_DIR/schemas"
cp "$SRC_DIR/README.md" "$EXT_DIR/README.md" 2>/dev/null || true
cp "$SRC_DIR/LICENSE" "$EXT_DIR/LICENSE" 2>/dev/null || true

echo
echo "Installed."

if gnome-extensions list | grep -qx "$UUID"; then
  gnome-extensions enable "$UUID" && echo "Extension enabled."
else
  cat <<EOF
GNOME Shell has not picked up the new extension yet.
Log out and back in (Wayland), or press Alt+F2 and type 'r' (X11),
then enable it with:

    gnome-extensions enable $UUID

Open the preferences with:

    gnome-extensions prefs $UUID
EOF
fi
