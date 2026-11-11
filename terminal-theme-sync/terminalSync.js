// SPDX-License-Identifier: GPL-2.0-or-later
//
// Keeps GNOME Terminal's legacy color profiles in sync with the system
// light/dark color scheme.
//
// This module only depends on Gio/GLib, so it can be used both from the
// extension process and from a standalone test script.

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

export const SETTINGS_SCHEMA_ID = 'org.gnome.shell.extensions.terminal-theme-sync';

const PROFILE_SCHEMA_ID = 'org.gnome.Terminal.Legacy.Profile';
const PROFILES_LIST_SCHEMA_ID = 'org.gnome.Terminal.ProfilesList';
const INTERFACE_SCHEMA_ID = 'org.gnome.desktop.interface';

const PROFILE_PATH_PREFIX = '/org/gnome/terminal/legacy/profiles:/:';

// Profile keys we manage, with their GVariant type.
const MANAGED_KEYS = {
    'use-theme-colors': 'b',
    'background-color': 's',
    'foreground-color': 's',
    'palette': 'as',
};

// Same palette as Ubuntu's default dark terminal profile.
export const DARK_PALETTE = [
    'rgb(46,52,54)', 'rgb(204,0,0)', 'rgb(78,154,6)', 'rgb(196,160,0)',
    'rgb(52,101,164)', 'rgb(117,80,123)', 'rgb(6,152,154)', 'rgb(211,215,207)',
    'rgb(85,87,83)', 'rgb(239,41,41)', 'rgb(138,226,52)', 'rgb(252,233,79)',
    'rgb(114,159,207)', 'rgb(173,127,168)', 'rgb(52,226,226)', 'rgb(238,238,236)',
];

// The same hues, adjusted so light text remains readable on a light
// background (the "white" entries become dark).
export const LIGHT_PALETTE = [
    'rgb(46,52,54)', 'rgb(204,0,0)', 'rgb(78,154,6)', 'rgb(160,120,0)',
    'rgb(52,101,164)', 'rgb(117,80,123)', 'rgb(6,152,154)', 'rgb(85,87,83)',
    'rgb(136,138,133)', 'rgb(204,0,0)', 'rgb(78,154,6)', 'rgb(160,120,0)',
    'rgb(52,101,164)', 'rgb(117,80,123)', 'rgb(6,152,154)', 'rgb(46,52,54)',
];

const WATCHED_SETTINGS = [
    'sync-enabled',
    'apply-to-all-profiles',
    'sync-palette',
    'light-background',
    'light-foreground',
    'dark-background',
    'dark-foreground',
];

function schemaExists(schemaId) {
    return Gio.SettingsSchemaSource.get_default().lookup(schemaId, true) !== null;
}

function variantToJson(variant) {
    switch (variant.get_type_string()) {
    case 'b':
        return variant.get_boolean();
    case 's':
        // Variant.get_string() returns [value, length] with newer GJS/GLib
        // introspection data, so use unpack() which is stable.
        return variant.unpack();
    case 'as':
        return variant.get_strv();
    default:
        throw new Error(`Unsupported profile key type: ${variant.get_type_string()}`);
    }
}

function jsonToVariant(key, value) {
    const type = MANAGED_KEYS[key];
    if (!type)
        throw new Error(`Unsupported profile key: ${key}`);

    return new GLib.Variant(type, value);
}

function variantsEqual(a, b) {
    return a.get_type_string() === b.get_type_string() &&
        a.print(true) === b.print(true);
}

export class TerminalThemeSync {
    /**
     * @param {Gio.Settings} settings extension settings
     * @param {object} [options] test seams
     * @param {Gio.Settings|object} [options.interfaceSettings]
     * @param {Gio.Settings|object} [options.profilesList]
     */
    constructor(settings, options = {}) {
        this._settings = settings;

        this._interface = options.interfaceSettings ??
            (schemaExists(INTERFACE_SCHEMA_ID)
                ? new Gio.Settings({schema_id: INTERFACE_SCHEMA_ID})
                : null);

        this._profilesList = options.profilesList ??
            (schemaExists(PROFILES_LIST_SCHEMA_ID)
                ? new Gio.Settings({schema_id: PROFILES_LIST_SCHEMA_ID})
                : null);

        this._connections = [];
        this._profiles = new Map();
        this._started = false;
    }

    start() {
        if (this._started)
            return;

        this._started = true;

        if (this._interface)
            this._connect(this._interface, 'changed::color-scheme', () => this.apply());

        if (this._profilesList)
            this._connect(this._profilesList, 'changed', () => this.apply());

        for (const key of WATCHED_SETTINGS)
            this._connect(this._settings, `changed::${key}`, () => this.apply());

        this.apply();
    }

    stop() {
        for (const [object, handlerId] of this._connections) {
            try {
                object.disconnect(handlerId);
            } catch {
                // The object may already be gone; nothing to clean up.
            }
        }

        this._connections = [];
        this._profiles.clear();
        this._started = false;

        this.restore();
    }

    /** Put back every color this extension changed. */
    restore() {
        const originals = this._readJson('original-colors');
        const applied = this._readJson('last-applied');

        for (const uuid of Object.keys(originals))
            this._restoreProfile(uuid, originals, applied);

        this._writeJson('original-colors', {});
        this._writeJson('last-applied', {});
    }

    /** Recompute and write the terminal colors for the current scheme. */
    apply() {
        if (!this._profilesList)
            return;

        if (!this._settings.get_boolean('sync-enabled')) {
            this.restore();
            return;
        }

        const managed = new Set(this._profilesToManage());
        const originals = this._readJson('original-colors');
        const applied = this._readJson('last-applied');

        // Profiles that are no longer managed (or no longer exist) get their
        // original colors back instead of being left in the applied state.
        for (const uuid of Object.keys(applied)) {
            if (managed.has(uuid))
                continue;

            this._restoreProfile(uuid, originals, applied);
            delete originals[uuid];
            delete applied[uuid];
        }

        for (const uuid of Object.keys(originals)) {
            if (!managed.has(uuid) && !applied[uuid])
                delete originals[uuid];
        }

        const dark = this._isDark();
        const background = this._settings.get_string(dark ? 'dark-background' : 'light-background');
        const foreground = this._settings.get_string(dark ? 'dark-foreground' : 'light-foreground');
        const syncPalette = this._settings.get_boolean('sync-palette');
        const palette = dark ? DARK_PALETTE : LIGHT_PALETTE;

        for (const uuid of managed) {
            const profile = this._getProfile(uuid);
            if (!profile)
                continue;

            if (!originals[uuid])
                originals[uuid] = this._snapshot(profile);

            applied[uuid] ??= {};

            // If palette syncing was just turned off, give the user's palette
            // back rather than leaving the one we wrote.
            if (!syncPalette && applied[uuid].palette !== undefined) {
                const ownPalette = this._jsonToVariant('palette', applied[uuid].palette);
                if (variantsEqual(profile.get_value('palette'), ownPalette) &&
                    originals[uuid].palette !== undefined) {
                    profile.set_value('palette',
                        this._jsonToVariant('palette', originals[uuid].palette));
                }
                delete applied[uuid].palette;
            }

            const values = {
                'use-theme-colors': false,
                'background-color': background,
                'foreground-color': foreground,
            };

            if (syncPalette)
                values.palette = palette;

            for (const [key, value] of Object.entries(values)) {
                const variant = this._jsonToVariant(key, value);
                if (!variantsEqual(profile.get_value(key), variant))
                    profile.set_value(key, variant);

                applied[uuid][key] = value;
            }
        }

        this._writeJson('original-colors', originals);
        this._writeJson('last-applied', applied);
    }

    _profilesToManage() {
        const profiles = this._profilesList.get_strv('list');

        if (this._settings.get_boolean('apply-to-all-profiles'))
            return profiles;

        const defaultProfile = this._profilesList.get_string('default');
        if (defaultProfile)
            return [defaultProfile];

        return profiles.slice(0, 1);
    }

    _isDark() {
        if (!this._interface)
            return false;

        return this._interface.get_string('color-scheme') === 'prefer-dark';
    }

    _getProfile(uuid) {
        let profile = this._profiles.get(uuid);
        if (profile)
            return profile;

        if (!schemaExists(PROFILE_SCHEMA_ID))
            return null;

        profile = new Gio.Settings({
            schema_id: PROFILE_SCHEMA_ID,
            path: `${PROFILE_PATH_PREFIX}${uuid}/`,
        });

        this._profiles.set(uuid, profile);
        return profile;
    }

    _profileExists(uuid) {
        if (!this._profilesList)
            return false;

        const profiles = this._profilesList.get_strv('list');
        if (profiles.includes(uuid))
            return true;

        return this._profilesList.get_string('default') === uuid;
    }

    _snapshot(profile) {
        const snapshot = {};
        for (const key of Object.keys(MANAGED_KEYS))
            snapshot[key] = variantToJson(profile.get_value(key));

        return snapshot;
    }

    _restoreProfile(uuid, originals, applied) {
        const original = originals[uuid];
        if (!original)
            return;

        // A deleted profile should not be recreated in dconf.
        if (!this._profileExists(uuid))
            return;

        const profile = this._getProfile(uuid);
        if (!profile)
            return;

        const appliedValues = applied[uuid] ?? {};

        for (const [key, originalValue] of Object.entries(original)) {
            // Only restore keys this extension actually wrote.
            if (appliedValues[key] === undefined)
                continue;

            // If the current value differs from what we wrote, the user (or
            // another tool) changed it afterwards; leave that change alone.
            const current = profile.get_value(key);
            if (!variantsEqual(current, this._jsonToVariant(key, appliedValues[key])))
                continue;

            profile.set_value(key, this._jsonToVariant(key, originalValue));
        }
    }

    _connect(object, signal, callback) {
        if (!object || typeof object.connect !== 'function')
            return;

        const handlerId = object.connect(signal, callback);
        this._connections.push([object, handlerId]);
    }

    _readJson(key) {
        try {
            const value = JSON.parse(this._settings.get_string(key));
            return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
        } catch {
            return {};
        }
    }

    _writeJson(key, value) {
        this._settings.set_string(key, JSON.stringify(value));
    }

    _jsonToVariant(key, value) {
        return jsonToVariant(key, value);
    }
}
