// SPDX-License-Identifier: GPL-2.0-or-later
//
// Run with: gjs -m tests/test-terminal-sync.js
//
// The test uses the GSettings memory backend, so it never reads or writes the
// real terminal configuration or the installed extension's settings.

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

GLib.setenv('GSETTINGS_BACKEND', 'memory', true);

import {
    TerminalThemeSync,
    SETTINGS_SCHEMA_ID,
    LIGHT_PALETTE,
    isValidTerminalColor,
    disableSyncAndRestore,
} from '../terminalSync.js';

const PROFILE_SCHEMA_ID = 'org.gnome.Terminal.Legacy.Profile';
const PROFILE_PATH_PREFIX = '/org/gnome/terminal/legacy/profiles:/:';
const TEST_UUID_1 = 'terminal-theme-sync-test-1';
const TEST_UUID_2 = 'terminal-theme-sync-test-2';

const LIGHT_BG = 'rgb(250,250,250)';
const LIGHT_FG = 'rgb(10,10,10)';
const DARK_BG = 'rgb(20,20,20)';
const DARK_FG = 'rgb(230,230,230)';

const scriptPath = GLib.filename_from_uri(import.meta.url)[0];
const projectDir = GLib.path_get_dirname(GLib.path_get_dirname(scriptPath));

let failures = 0;

function check(actual, expected, message) {
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    if (ok) {
        print(`ok - ${message}`);
    } else {
        failures++;
        printerr(`not ok - ${message}`);
        printerr(`         expected: ${JSON.stringify(expected)}`);
        printerr(`         actual:   ${JSON.stringify(actual)}`);
    }
}

function run(command) {
    const [ok, , stderr] = GLib.spawn_sync(
        null, command, null, GLib.SpawnFlags.SEARCH_PATH, null);

    if (!ok) {
        const error = new TextDecoder().decode(stderr);
        throw new Error(`Command failed (${command.join(' ')}): ${error}`);
    }
}

function loadSettings() {
    const defaultSource = Gio.SettingsSchemaSource.get_default();
    const source = Gio.SettingsSchemaSource.new_from_directory(
        GLib.build_filenamev([projectDir, 'schemas']), defaultSource, false);
    const schema = source.lookup(SETTINGS_SCHEMA_ID, false);

    if (!schema)
        throw new Error(`Schema ${SETTINGS_SCHEMA_ID} not found`);

    return new Gio.Settings({settings_schema: schema});
}

class FakeSettings {
    constructor(value, list = null) {
        this.value = value;
        this.list = list;
        this.handlers = new Map();
        this.nextId = 1;
    }

    get_string() {
        return this.value;
    }

    get_strv() {
        return this.list ?? [this.value];
    }

    connect(signal, callback) {
        const id = this.nextId++;
        this.handlers.set(id, callback);
        return id;
    }

    disconnect(id) {
        this.handlers.delete(id);
    }

    emit() {
        for (const callback of [...this.handlers.values()])
            callback();
    }
}

function makeProfile(uuid, background, foreground, useThemeColors) {
    const profile = new Gio.Settings({
        schema_id: PROFILE_SCHEMA_ID,
        path: `${PROFILE_PATH_PREFIX}${uuid}/`,
    });

    const palette = Array.from({length: 16}, (_, i) => `rgb(${i},${i},${i})`);

    profile.set_string('visible-name', 'Theme Sync Test');
    profile.set_boolean('use-theme-colors', useThemeColors);
    profile.set_string('background-color', background);
    profile.set_string('foreground-color', foreground);
    profile.set_strv('palette', palette);

    return {profile, palette};
}

function makeReadOnlyProfile() {
    const palette = Array.from({length: 16}, (_, i) => `rgb(${i},${i},${i})`);
    const values = {
        'use-theme-colors': new GLib.Variant('b', false),
        'background-color': new GLib.Variant('s', 'rgb(1,2,3)'),
        'foreground-color': new GLib.Variant('s', 'rgb(4,5,6)'),
        'palette': new GLib.Variant('as', palette),
    };

    return {
        get_value(key) {
            return values[key];
        },
        set_value(key, variant) {
            if (key === 'foreground-color')
                return false;

            values[key] = variant;
            return true;
        },
    };
}

function makeFlakyProfile() {
    const palette = Array.from({length: 16}, (_, i) => `rgb(${i},${i},${i})`);
    const values = {
        'use-theme-colors': new GLib.Variant('b', false),
        'background-color': new GLib.Variant('s', 'rgb(1,2,3)'),
        'foreground-color': new GLib.Variant('s', 'rgb(4,5,6)'),
        'palette': new GLib.Variant('as', palette),
    };

    return {
        failBackgroundRestore: false,
        get_value(key) {
            return values[key];
        },
        set_value(key, variant) {
            if (this.failBackgroundRestore && key === 'background-color')
                return false;

            values[key] = variant;
            return true;
        },
    };
}

function originalColors(settings, uuid) {
    const state = JSON.parse(settings.get_string('original-colors'));
    return state[uuid];
}

function main() {
    run(['glib-compile-schemas', '--strict',
        GLib.build_filenamev([projectDir, 'schemas'])]);

    const settings = loadSettings();

    check(settings.get_default_value('light-background').unpack(),
        'rgb(255,255,255)', 'default light background matches GNOME light');
    check(settings.get_default_value('light-foreground').unpack(),
        'rgb(23,20,33)', 'default light text matches GNOME light');
    check(settings.get_default_value('dark-background').unpack(),
        'rgb(23,20,33)', 'default dark background matches GNOME dark');
    check(settings.get_default_value('dark-foreground').unpack(),
        'rgb(208,207,204)', 'default dark text matches GNOME dark');

    const metadata = JSON.parse(new TextDecoder().decode(
        GLib.file_get_contents(GLib.build_filenamev(
            [projectDir, 'metadata.json']))[1]));
    check(metadata.uuid, 'terminal-theme-sync@jonathangn.github.io',
        'metadata UUID uses the published namespace');
    check(metadata.url,
        'https://github.com/jonathangn/gnome-extras/tree/main/terminal-theme-sync',
        'metadata URL points directly at the extension');
    check(metadata.shell_version ?? metadata['shell-version'],
        ['45', '46', '47', '48', '49', '50'],
        'metadata declares the supported shell versions');

    check(isValidTerminalColor('rgb(1,2,3)'), true,
        'rgb colors are accepted');
    check(isValidTerminalColor('#1e1e1e'), true,
        'hex colors are accepted');
    check(isValidTerminalColor('rgb(256,0,0)'), false,
        'out-of-range rgb components are rejected');
    check(isValidTerminalColor('not-a-color'), false,
        'arbitrary strings are rejected');

    settings.set_boolean('sync-enabled', true);
    settings.set_boolean('apply-to-all-profiles', false);
    settings.set_boolean('sync-palette', false);
    settings.set_string('light-background', LIGHT_BG);
    settings.set_string('light-foreground', LIGHT_FG);
    settings.set_string('dark-background', DARK_BG);
    settings.set_string('dark-foreground', DARK_FG);

    const one = makeProfile(TEST_UUID_1, 'rgb(1,2,3)', 'rgb(4,5,6)', true);
    const two = makeProfile(TEST_UUID_2, 'rgb(7,8,9)', 'rgb(11,12,13)', false);

    const fakeInterface = new FakeSettings('prefer-dark');
    const fakeProfiles = new FakeSettings(TEST_UUID_1);

    const sync = new TerminalThemeSync(settings, {
        interfaceSettings: fakeInterface,
        profilesList: fakeProfiles,
    });

    sync.start();

    check(one.profile.get_string('background-color'), DARK_BG,
        'dark scheme applies the dark background');
    check(one.profile.get_string('foreground-color'), DARK_FG,
        'dark scheme applies the dark text color');
    check(one.profile.get_boolean('use-theme-colors'), false,
        'theme colors are disabled so explicit colors are used');
    check(originalColors(settings, TEST_UUID_1)['background-color'], 'rgb(1,2,3)',
        'original background is remembered');

    fakeInterface.value = 'prefer-light';
    fakeInterface.emit();

    check(one.profile.get_string('background-color'), LIGHT_BG,
        'color-scheme change switches to the light background');
    check(one.profile.get_string('foreground-color'), LIGHT_FG,
        'color-scheme change switches to the light text color');

    settings.set_boolean('sync-palette', true);
    sync.apply();
    check(one.profile.get_strv('palette'), LIGHT_PALETTE,
        'palette sync writes the light palette');

    settings.set_boolean('sync-palette', false);
    sync.apply();
    check(one.profile.get_strv('palette'), one.palette,
        'turning palette sync off restores the original palette');

    settings.set_boolean('sync-enabled', false);
    sync.apply();
    check(one.profile.get_string('background-color'), 'rgb(1,2,3)',
        'pausing sync restores the original background');
    check(one.profile.get_string('foreground-color'), 'rgb(4,5,6)',
        'pausing sync restores the original text color');
    check(one.profile.get_boolean('use-theme-colors'), true,
        'pausing sync restores the original theme-colors setting');
    check(settings.get_string('original-colors'), '{}',
        'pausing sync clears the saved state');

    settings.set_boolean('sync-enabled', true);
    sync.apply();
    check(one.profile.get_string('background-color'), LIGHT_BG,
        'resuming sync applies the current (light) scheme');

    fakeProfiles.list = [TEST_UUID_1, TEST_UUID_2];
    settings.set_boolean('apply-to-all-profiles', true);
    sync.apply();
    check(two.profile.get_string('background-color'), LIGHT_BG,
        'apply-to-all syncs the second profile');
    check(originalColors(settings, TEST_UUID_2)['background-color'], 'rgb(7,8,9)',
        'second profile original colors are remembered');

    settings.set_boolean('apply-to-all-profiles', false);
    sync.apply();
    check(two.profile.get_string('background-color'), 'rgb(7,8,9)',
        'unmanaging a profile restores its colors');
    check(two.profile.get_boolean('use-theme-colors'), false,
        'unmanaging a profile restores its theme-colors setting');
    check(one.profile.get_string('background-color'), LIGHT_BG,
        'the default profile stays in sync');

    for (const key of ['light-background', 'light-foreground',
        'dark-background', 'dark-foreground'])
        settings.reset(key);

    sync.apply();
    check(one.profile.get_string('background-color'), 'rgb(255,255,255)',
        'defaults apply the GNOME light background');
    check(one.profile.get_string('foreground-color'), 'rgb(23,20,33)',
        'defaults apply the GNOME light text color');

    settings.set_string('light-foreground', 'not-a-color');
    sync.apply();
    check(one.profile.get_string('foreground-color'), 'rgb(23,20,33)',
        'invalid configured color falls back to the schema default');
    settings.reset('light-foreground');

    fakeInterface.value = 'prefer-dark';
    fakeInterface.emit();
    check(one.profile.get_string('background-color'), 'rgb(23,20,33)',
        'defaults apply the GNOME dark background');
    check(one.profile.get_string('foreground-color'), 'rgb(208,207,204)',
        'defaults apply the GNOME dark text color');

    sync.stop();
    check(one.profile.get_string('background-color'), 'rgb(1,2,3)',
        'stopping the extension restores the original background');
    check(one.profile.get_string('foreground-color'), 'rgb(4,5,6)',
        'stopping the extension restores the original text color');
    check(one.profile.get_boolean('use-theme-colors'), true,
        'stopping the extension restores theme colors');
    check(one.profile.get_strv('palette'), one.palette,
        'stopping the extension restores the palette');
    check(settings.get_string('original-colors'), '{}',
        'stopping the extension clears saved originals');
    check(settings.get_string('last-applied'), '{}',
        'stopping the extension clears last-applied state');

    // A non-writable key must not be recorded as applied.
    const readOnly = makeReadOnlyProfile();
    const readOnlySync = new TerminalThemeSync(settings, {
        interfaceSettings: fakeInterface,
        profilesList: fakeProfiles,
    });
    readOnlySync._profiles.set(TEST_UUID_1, readOnly);
    readOnlySync.start();

    const appliedState =
        JSON.parse(settings.get_string('last-applied'))[TEST_UUID_1] ?? {};
    check(appliedState['background-color'], 'rgb(23,20,33)',
        'successful writes are recorded as applied');
    check('foreground-color' in appliedState, false,
        'failed writes are not recorded as applied');

    readOnlySync.stop();

    // A failed restore keeps the state so it can be retried.
    const flaky = makeFlakyProfile();
    const flakySync = new TerminalThemeSync(settings, {
        interfaceSettings: fakeInterface,
        profilesList: fakeProfiles,
    });
    flakySync._profiles.set(TEST_UUID_1, flaky);
    flakySync.start();

    flaky.failBackgroundRestore = true;
    flakySync.restore();
    check(originalColors(settings, TEST_UUID_1) !== undefined, true,
        'a failed restore keeps the original snapshot');

    flaky.failBackgroundRestore = false;
    flakySync.restore();
    check(settings.get_string('original-colors'), '{}',
        'a later successful restore clears the state');
    flakySync.stop();

    // The preferences Restore action: disable syncing, restore, and make sure
    // a later theme change cannot re-snapshot the synced colors as originals.
    fakeInterface.value = 'prefer-dark';
    settings.set_boolean('sync-enabled', true);
    const prefsSync = new TerminalThemeSync(settings, {
        interfaceSettings: fakeInterface,
        profilesList: fakeProfiles,
    });
    prefsSync.start();
    check(one.profile.get_string('background-color'), 'rgb(23,20,33)',
        'restore test setup applies the dark background');

    // Count apply() calls so the test proves the live instance handles the
    // theme change after Restore, rather than just relying on the profile.
    let liveApplyCalls = 0;
    const liveApply = prefsSync.apply.bind(prefsSync);
    prefsSync.apply = () => {
        liveApplyCalls++;
        return liveApply();
    };

    disableSyncAndRestore(settings, {
        interfaceSettings: fakeInterface,
        profilesList: fakeProfiles,
    });
    check(settings.get_boolean('sync-enabled'), false,
        'restore turns syncing off');
    check(one.profile.get_string('background-color'), 'rgb(1,2,3)',
        'restore puts back the original background');
    check(settings.get_string('original-colors'), '{}',
        'restore clears the saved originals');

    liveApplyCalls = 0;
    fakeInterface.value = 'prefer-light';
    fakeInterface.emit();
    check(liveApplyCalls, 1,
        'live instance handles the theme change after Restore');
    check(one.profile.get_string('background-color'), 'rgb(1,2,3)',
        'live instance does not re-apply colors after Restore');
    check(settings.get_string('original-colors'), '{}',
        'live instance does not re-snapshot after Restore');
    check(settings.get_string('last-applied'), '{}',
        'live instance does not record applied colors after Restore');

    settings.set_boolean('sync-enabled', true);
    prefsSync.apply();
    check(one.profile.get_string('background-color'), 'rgb(255,255,255)',
        're-enabling applies the current light scheme');
    check(originalColors(settings, TEST_UUID_1)['background-color'], 'rgb(1,2,3)',
        're-enabling snapshots the real original, not the synced colors');

    prefsSync.stop();

    // Direct test of disableSyncAndRestore's manual path, used when the
    // extension is installed but not running.
    settings.set_boolean('sync-enabled', true);
    one.profile.set_boolean('use-theme-colors', false);
    one.profile.set_string('background-color', 'rgb(20,20,20)');
    one.profile.set_string('foreground-color', 'rgb(230,230,230)');
    settings.set_string('original-colors', JSON.stringify({
        [TEST_UUID_1]: {
            'use-theme-colors': true,
            'background-color': 'rgb(1,2,3)',
            'foreground-color': 'rgb(4,5,6)',
            'palette': one.palette,
        },
    }));
    settings.set_string('last-applied', JSON.stringify({
        [TEST_UUID_1]: {
            'use-theme-colors': false,
            'background-color': 'rgb(20,20,20)',
            'foreground-color': 'rgb(230,230,230)',
        },
    }));

    disableSyncAndRestore(settings, {
        interfaceSettings: fakeInterface,
        profilesList: fakeProfiles,
    });

    check(settings.get_boolean('sync-enabled'), false,
        'disableSyncAndRestore turns syncing off without a live instance');
    check(one.profile.get_string('background-color'), 'rgb(1,2,3)',
        'disableSyncAndRestore restores originals without a live instance');
    check(one.profile.get_string('foreground-color'), 'rgb(4,5,6)',
        'disableSyncAndRestore restores text without a live instance');
    check(one.profile.get_boolean('use-theme-colors'), true,
        'disableSyncAndRestore restores theme-colors without a live instance');
    check(settings.get_string('original-colors'), '{}',
        'disableSyncAndRestore clears state without a live instance');

    if (failures > 0)
        throw new Error(`${failures} check(s) failed`);

    print('\nAll checks passed.');
}

main();
