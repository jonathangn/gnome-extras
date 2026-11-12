# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-11-11

### Added

- Initial release.
- Keeps GNOME Terminal profile background, text and (optionally) the 16-color
  palette in sync with the system light/dark color scheme.
- Applies changes to already open terminal windows.
- Per-profile snapshot and restore of the original colors on disable, pause,
  unmanage or manual restore.
- Preferences for light/dark colors, profile scope, palette syncing, restore
  and reset.
- Default colors match GNOME Terminal's built-in **GNOME light** and
  **GNOME dark** schemes.
- Support for GNOME Shell 45–50.

### Changed

- Extension UUID is `terminal-theme-sync@jonathangn.github.io`.
- `install.sh` removes an existing `terminal-theme-sync@jonathan` installation
  when upgrading from the pre-release UUID.

### Fixed

- Validate configured colors and fall back to the schema default when a value
  is invalid.
- Do not record profile writes that failed (for example, keys locked by dconf
  policy) as applied.
- Keep restore state when a restore write fails, so it can be retried.
- The preferences' *Restore* button now turns syncing off, preventing the next
  theme change from saving already-synced colors as the originals.
