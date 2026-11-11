#!/usr/bin/env bash
# Uninstall Terminal Theme Sync for the current user.
# Disabling the extension restores the original terminal colors first.

set -euo pipefail

UUID="terminal-theme-sync@jonathangn.github.io"
EXT_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/gnome-shell/extensions/$UUID"

if command -v gnome-extensions >/dev/null; then
  gnome-extensions disable "$UUID" 2>/dev/null || true
fi

rm -rf "$EXT_DIR"
echo "Removed $EXT_DIR"
echo "Log out and back in to remove the extension from GNOME Shell."
