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
