#!/usr/bin/env bash
# Build an installable extension zip in dist/.

set -euo pipefail

SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT_DIR="${1:-$SRC_DIR/dist}"

mkdir -p "$OUT_DIR"
glib-compile-schemas --strict "$SRC_DIR/schemas"

gnome-extensions pack --force \
  --out-dir "$OUT_DIR" \
  --extra-source=terminalSync.js \
  --extra-source=README.md \
  --extra-source=LICENSE \
  "$SRC_DIR"

echo "Created $OUT_DIR/terminal-theme-sync@jonathangn.github.io.shell-extension.zip"
