# Terminal Theme Sync

A GNOME Shell extension that makes **GNOME Terminal** follow the system
light/dark theme, the same way GNOME apps do.

When you switch the desktop between light and dark mode, the extension updates
your terminal profile's background and text colors (and optionally its
16-color palette). The change reaches already open terminal windows and new
ones immediately. Your original colors are saved and restored when you pause
or disable the extension.

The default light and dark colors are exactly GNOME Terminal's built-in
**GNOME light** and **GNOME dark** schemes, so GNOME Terminal's *Built-in
schemes* row displays those names while the extension is in charge.

## Features

- Follows `org.gnome.desktop.interface color-scheme` (`prefer-dark` is dark,
  `default`/`prefer-light` are light).
- Updates **all open GNOME Terminal windows** as soon as the theme changes.
- Uses GNOME Terminal's own **GNOME light** / **GNOME dark** color pairs by
  default.
- Configurable light and dark background/text colors.
- Optional 16-color palette switching (off by default, so custom palettes are
  left alone).
- Applies to the default profile only, or to every profile.
- Pause switch and a "Restore original colors" button in the preferences.
- Non-destructive: the values that were in use before the extension touched a
  profile are remembered per profile and restored on disable. If you change a
  color yourself while the extension is active, that change is not overwritten
  when it restores.
- Gracefully does nothing if GNOME Terminal is not installed.

## Default colors

These are the colors written to the terminal profile:

| Scheme | Background | Text | GNOME Terminal scheme |
| --- | --- | --- | --- |
| Light | `#ffffff` | `#1e1e1e` | GNOME light |
| Dark | `#1e1e1e` | `#cfcfcf` | GNOME dark |

GNOME Terminal does not store a scheme name. It recognizes a built-in scheme
by comparing the profile's foreground/background pair, so these exact values
are what make the *Built-in schemes* row say **GNOME light** or **GNOME dark**.
Changing any of the four colors in the preferences makes GNOME Terminal show
**Custom** again.

The 16-color palette is **not** replaced by default. GNOME Terminal compares
the palette separately, so the *Palette* row may still say **Custom** even when
the *Built-in schemes* row says GNOME light/dark. Turn on *Also switch the
16-color palette* if you want the extension to manage the palette too.

## Requirements

- GNOME Shell 45–50 (tested on GNOME Shell 50.1).
- GNOME Terminal 3.44 or newer, with the
  `org.gnome.Terminal.Legacy.Profile` GSettings schema (tested with
  GNOME Terminal 3.58.0 / VTE 0.84.0 on Ubuntu).
- `glib-compile-schemas` and `gnome-extensions` for installation from source
  (packages `libglib2.0-bin` and `gnome-shell` on Ubuntu).

This extension targets GNOME Terminal. Other terminals such as Ptyxis, GNOME
Console, Konsole or kitty are not affected.

## Install

### From extensions.gnome.org

Once published, search for **Terminal Theme Sync** on
<https://extensions.gnome.org> and use the install button. The site installs
the extension and asks you to confirm the installation in the browser.

### From a release zip

Download the latest `terminal-theme-sync@jonathangn.github.io.shell-extension.zip`
from the [releases page](https://github.com/jonathangn/gnome-extras/releases),
then:

```bash
gnome-extensions install --force \
  terminal-theme-sync@jonathangn.github.io.shell-extension.zip
```

### From source

```bash
git clone https://github.com/jonathangn/gnome-extras.git
cd gnome-extras/terminal-theme-sync
./install.sh
```

The script compiles the settings schema, copies the extension to
`~/.local/share/gnome-shell/extensions/terminal-theme-sync@jonathangn.github.io`,
and tries to enable it.

If GNOME Shell has not noticed the new extension yet (common on Wayland after a
fresh install), log out and back in, then run:

```bash
gnome-extensions enable terminal-theme-sync@jonathangn.github.io
```

On X11 you can instead press <kbd>Alt</kbd>+<kbd>F2</kbd>, type `r` and press
<kbd>Enter</kbd>.

After enabling, open the preferences with the Extensions app or:

```bash
gnome-extensions prefs terminal-theme-sync@jonathangn.github.io
```

## Use

Options in the preferences:

| Setting | Description |
| --- | --- |
| **Sync terminal colors** | Master switch. Turning it off restores your original colors. |
| **Apply to all profiles** | Manage every terminal profile instead of only the default one. |
| **Also switch the 16-color palette** | Replace the ANSI palette too. Off by default. |
| **Light/Dark background and text** | Pick the colors used for each scheme. The defaults are the GNOME built-in schemes. |
| **Restore original colors** | Manually put back the pre-extension colors. |
| **Reset colors to defaults** | Restore the GNOME light/dark color pairs. |

Switch the desktop theme from GNOME Settings → Appearance, or with:

```bash
gsettings set org.gnome.desktop.interface color-scheme prefer-dark
gsettings set org.gnome.desktop.interface color-scheme prefer-light
```

### Changing the terminal profile manually

If you edit the **Built-in schemes** row in GNOME Terminal's profile
preferences while the extension is active, GNOME Terminal writes a different
foreground/background pair and the extension no longer recognizes the colors.
The next theme change (or extension restart) writes the configured colors
again. Use the extension preferences if you want to keep custom colors.

GNOME Terminal's own **Theme variant** setting (*Follow system style* /
*Light style* / *Dark style*) only changes the window chrome and preferences
styling. It does not change the terminal background or text colors; that is
what this extension manages.

## How it works

GNOME Terminal stores per-profile settings in the
`org.gnome.Terminal.Legacy.Profile` schema and watches them for changes, which
is why open terminals update live. The extension:

1. Watches `org.gnome.desktop.interface` `color-scheme` and the terminal
   profile list.
2. On change, picks the matching light or dark colors and writes
   `background-color`, `foreground-color` and `use-theme-colors=false` to each
   managed profile (plus `palette` when enabled).
3. Keeps a per-profile JSON snapshot of the values it replaced in its own
   GSettings schema.
4. Restores those values on disable, when a profile stops being managed, or
   when syncing is paused.

The extension does not run any background process or modify system files.

## Development

The extension lives in the `terminal-theme-sync/` directory of the
`gnome-extras` repository. Run these from that directory:

```bash
./install.sh      # install for the current user
./uninstall.sh    # disable and remove
make test         # run the unit tests
make pack         # build dist/*.shell-extension.zip
make check        # validate metadata and compile the schema
```

The test suite uses throw-away terminal profile paths, so it does not touch
your real terminal configuration:

```bash
gjs -m tests/test-terminal-sync.js
```

See [PUBLISHING.md](PUBLISHING.md) for creating the GitHub repository and
submitting the extension to extensions.gnome.org.

## Uninstall

```bash
./uninstall.sh
```

This disables the extension first (which restores your original terminal
colors) and then removes its files. Log out and back in to remove it from the
running GNOME Shell.

If you installed it from extensions.gnome.org, use the site's uninstall button
or:

```bash
gnome-extensions uninstall terminal-theme-sync@jonathangn.github.io
```

## Troubleshooting

- **Nothing happens after installing**: on Wayland a newly installed extension
  is only picked up after a re-login. Check that it is enabled with
  `gnome-extensions list --enabled`.
- **The scheme row says Custom**: the four colors must match the GNOME pairs
  exactly. Press *Reset colors to defaults*, then toggle the system theme once.
  If you need a custom color, Custom is expected.
- **The Palette row says Custom**: palette syncing is off by default; enable
  *Also switch the 16-color palette* if you want the extension to manage it.
- **Colors do not change back**: open the preferences and press *Restore
  original colors*, or disable/enable the extension once.
- **A custom palette disappeared after enabling palette sync**: turn *Also
  switch the 16-color palette* off. The original palette is restored when the
  option is switched off.
- **Inspect the stored state**: run
  `GSETTINGS_SCHEMA_DIR="$HOME/.local/share/gnome-shell/extensions/terminal-theme-sync@jonathangn.github.io/schemas" gsettings get org.gnome.shell.extensions.terminal-theme-sync original-colors`.
  The preferences' *Restore* and *Reset* buttons are usually easier.

## License

GPL-2.0-or-later. See [LICENSE](LICENSE).
