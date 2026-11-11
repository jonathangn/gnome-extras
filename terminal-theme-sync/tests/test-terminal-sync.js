// SPDX-License-Identifier: GPL-2.0-or-later
//
// Run with: gjs -m tests/test-terminal-sync.js
//
// The test uses throw-away GNOME Terminal profile paths that are not listed
// in ProfilesList, so the real terminal configuration is never touched.

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

import {
    TerminalThemeSync,
    SETTINGS_SCHEMA_ID,
    LIGHT_PALETTE,
} from '../terminalSync.js';

const PROFILE_SCHEMA_ID = 'org.gnome.Terminal.Legacy.Profile';
const SETTINGS_PATH = '/org/gnome/shell/extensions/terminal-theme-sync/';
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

function resetDconf(path) {
    try {
        run(['dconf', 'reset', '-f', path]);
    } catch {
        // Path may not exist yet.
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

function originalColors(settings, uuid) {
    const state = JSON.parse(settings.get_string('original-colors'));
    return state[uuid];
}

function main() {
    resetDconf(SETTINGS_PATH);
    resetDconf(`${PROFILE_PATH_PREFIX}${TEST_UUID_1}/`);
    resetDconf(`${PROFILE_PATH_PREFIX}${TEST_UUID_2}/`);

    run(['glib-compile-schemas', '--strict',
        GLib.build_filenamev([projectDir, 'schemas'])]);

    const settings = loadSettings();

    check(settings.get_default_value('light-background').unpack(),
        'rgb(255,255,255)', 'default light background matches GNOME light');
    check(settings.get_default_value('light-foreground').unpack(),
        'rgb(30,30,30)', 'default light text matches GNOME light');
    check(settings.get_default_value('dark-background').unpack(),
        'rgb(30,30,30)', 'default dark background matches GNOME dark');
    check(settings.get_default_value('dark-foreground').unpack(),
        'rgb(207,207,207)', 'default dark text matches GNOME dark');

    const metadata = JSON.parse(new TextDecoder().decode(
        GLib.file_get_contents(GLib.build_filenamev(
            [projectDir, 'metadata.json']))[1]));
    check(metadata.uuid, 'terminal-theme-sync@jonathangn.github.io',
        'metadata UUID uses the published namespace');
    check(metadata.url, 'https://github.com/jonathangn/gnome-extras',
        'metadata contains the project URL');
    check(metadata.shell_version ?? metadata['shell-version'],
        ['45', '46', '47', '48', '49', '50'],
        'metadata declares the supported shell versions');

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
    check(one.profile.get_string('foreground-color'), 'rgb(30,30,30)',
        'defaults apply the GNOME light text color');

    fakeInterface.value = 'prefer-dark';
    fakeInterface.emit();
    check(one.profile.get_string('background-color'), 'rgb(30,30,30)',
        'defaults apply the GNOME dark background');
    check(one.profile.get_string('foreground-color'), 'rgb(207,207,207)',
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

    resetDconf(SETTINGS_PATH);
    resetDconf(`${PROFILE_PATH_PREFIX}${TEST_UUID_1}/`);
    resetDconf(`${PROFILE_PATH_PREFIX}${TEST_UUID_2}/`);

    if (failures > 0)
        throw new Error(`${failures} check(s) failed`);

    print('\nAll checks passed.');
}

main();
