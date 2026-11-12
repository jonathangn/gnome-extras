# gnome-extras

Personal collection of GNOME Shell extensions by
[Jonathan G Nieto](https://github.com/jonathangn).

Each extension lives in its own folder with its own `metadata.json`, build
scripts and tests. Run `make` at the repository root to build and test every
extension, or `make -C <extension-folder> check test pack` for one of them.

## Extensions

### [Terminal Theme Sync](terminal-theme-sync/)

Keeps **GNOME Terminal** colors in sync with the system light/dark color
scheme. The default colors match GNOME Terminal's built-in **GNOME light**
and **GNOME dark** schemes, changes apply to already open terminals, and the
original profile colors are restored when the extension is disabled.

- GNOME Shell 50
- GNOME Terminal 3.44+
- GPL-2.0-or-later

Install from source:

```bash
git clone https://github.com/jonathangn/gnome-extras.git
cd gnome-extras/terminal-theme-sync
./install.sh
```

See the [extension README](terminal-theme-sync/README.md) for usage,
troubleshooting and packaging, and [PUBLISHING.md](terminal-theme-sync/PUBLISHING.md)
for release and extensions.gnome.org instructions.
