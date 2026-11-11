# Publishing

This document describes how to publish Terminal Theme Sync on GitHub and
extensions.gnome.org (EGO).

## 1. Before publishing

Run the checks and build the zip:

```bash
make check
make test
make pack
unzip -l dist/terminal-theme-sync@jonathangn.github.io.shell-extension.zip
```

The zip must contain `metadata.json` and `extension.js` at the top level. This
project's zip also contains `prefs.js`, `terminalSync.js`, `schemas/`,
`README.md` and `LICENSE`.

Check that `metadata.json` has:

- `uuid` `terminal-theme-sync@jonathangn.github.io`
- a valid `url`
- the `shell-version` values you actually support (currently 45–50)

EGO requires the UUID to look like an email address in a namespace you own.
Keep it stable after the first submission.

## 2. Create the GitHub repository

The repository is expected at:

<https://github.com/jonathangn/gnome-extras>

Create it on GitHub as an empty public repository (no README, no license, no
`.gitignore`). Then, from this directory:

```bash
git init -b main
git add .
git commit -m "Initial release"
git remote add origin git@github.com:jonathangn/gnome-extras.git
git push -u origin main
```

Use the HTTPS remote instead if you authenticate with a token:

```bash
git remote add origin https://github.com/jonathangn/gnome-extras.git
```

Do not commit `dist/`, `schemas/gschemas.compiled` or `*.zip`; they are listed
in `.gitignore`.

## 3. Create a release

```bash
git tag -a v1.0.0 -m "Terminal Theme Sync 1.0.0"
git push origin v1.0.0
```

On GitHub, create a release from the tag and attach:

```text
dist/terminal-theme-sync@jonathangn.github.io.shell-extension.zip
```

The README links to the releases page, so the zip can be installed with
`gnome-extensions install --force`.

## 4. Submit to extensions.gnome.org

1. Create an account on <https://extensions.gnome.org> and log in.
2. Open <https://extensions.gnome.org/upload/>.
3. Upload `dist/terminal-theme-sync@jonathangn.github.io.shell-extension.zip`.
4. Fill in the listing:
   - **Name**: Terminal Theme Sync
   - **Description**: keep it close to `metadata.json`; explain that GNOME
     Terminal colors follow the system light/dark style.
   - **License**: GPL-2.0-or-later
   - **Shell versions**: the same range as `metadata.json`.
   - **Screenshot**: add at least one screenshot of the preferences or of a
     terminal in light and dark mode. EGO listings normally show screenshots,
     and a missing one makes the extension hard to evaluate.
5. Submit for review.

After submission EGO runs automated checks and then a human review. Common
reasons for rejection to avoid:

- A `url` that does not resolve.
- A UUID or version that does not match the uploaded zip.
- Shell version claims that are not tested.
- Runtime errors in the extension log (check with
  `journalctl -f -o cat /usr/bin/gnome-shell`).
- Left-over objects or signal handlers after `disable()`.

## 5. Publishing updates

1. Bump `version` (integer) and `version-name` (human-readable string) in
   `metadata.json`.
2. Add an entry to `CHANGELOG.md`.
3. Run `make check test pack`.
4. Tag the release (`v1.0.1`, …), attach the new zip to the GitHub release.
5. Upload the new zip on EGO. EGO requires each upload to have a higher
   `version` than the previous one.

## 6. Installing without EGO

Users who do not use EGO can install the release zip directly:

```bash
gnome-extensions install --force \
  terminal-theme-sync@jonathangn.github.io.shell-extension.zip
```

Then log out and back in (Wayland) and enable it:

```bash
gnome-extensions enable terminal-theme-sync@jonathangn.github.io
```
