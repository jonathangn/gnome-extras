// SPDX-License-Identifier: GPL-2.0-or-later

import Adw from 'gi://Adw';
import Gdk from 'gi://Gdk';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import {TerminalThemeSync} from './terminalSync.js';

function addColorRow(group, settings, key, title) {
    const row = new Adw.ActionRow({title});

    const button = new Gtk.ColorDialogButton({
        dialog: new Gtk.ColorDialog({
            with_alpha: false,
            modal: true,
        }),
        valign: Gtk.Align.CENTER,
    });

    const updateButton = () => {
        const rgba = new Gdk.RGBA();
        if (rgba.parse(settings.get_string(key)))
            button.set_rgba(rgba);
    };

    updateButton();
    settings.connect(`changed::${key}`, updateButton);

    button.connect('notify::rgba', () => {
        const value = button.get_rgba().to_string();
        if (settings.get_string(key) !== value)
            settings.set_string(key, value);
    });

    row.add_suffix(button);
    row.activatable_widget = button;
    group.add(row);
}

export default class TerminalThemeSyncPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();

        window.set_default_size(560, 720);

        const page = new Adw.PreferencesPage({
            title: 'Terminal',
            icon_name: 'utilities-terminal-symbolic',
        });
        window.add(page);

        const info = new Gtk.Label({
            label: 'Changes are written to GNOME Terminal\'s color profiles and ' +
                'show up in already open terminals as well as new ones. The ' +
                'default colors match GNOME Terminal\'s built-in "GNOME light" ' +
                'and "GNOME dark" schemes, so the Built-in schemes row shows ' +
                'those names. While syncing is on, managed profiles are ' +
                're-applied on every theme change, so manual color edits to ' +
                'them are temporary.',
            wrap: true,
            xalign: 0,
            margin_start: 12,
            margin_end: 12,
            margin_bottom: 6,
        });
        info.add_css_class('dim-label');
        page.add(info);

        const behaviourGroup = new Adw.PreferencesGroup({title: 'Behaviour'});
        page.add(behaviourGroup);

        const syncRow = new Adw.SwitchRow({
            title: 'Sync terminal colors',
            subtitle: 'Follow the system light or dark color scheme.',
        });
        settings.bind('sync-enabled', syncRow, 'active',
            Gio.SettingsBindFlags.DEFAULT);
        behaviourGroup.add(syncRow);

        const allProfilesRow = new Adw.SwitchRow({
            title: 'Apply to all profiles',
            subtitle: 'When off, only the default terminal profile is managed.',
        });
        settings.bind('apply-to-all-profiles', allProfilesRow, 'active',
            Gio.SettingsBindFlags.DEFAULT);
        behaviourGroup.add(allProfilesRow);

        const paletteRow = new Adw.SwitchRow({
            title: 'Also switch the 16-color palette',
            subtitle: 'Off by default, so your custom palette stays untouched. ' +
                'When on, replaces the palette with a readable light/dark one.',
        });
        settings.bind('sync-palette', paletteRow, 'active',
            Gio.SettingsBindFlags.DEFAULT);
        behaviourGroup.add(paletteRow);

        const lightGroup = new Adw.PreferencesGroup({
            title: 'Light theme',
            description: 'Defaults match GNOME Terminal\'s built-in ' +
                '"GNOME light" scheme.',
        });
        page.add(lightGroup);
        addColorRow(lightGroup, settings, 'light-background', 'Background');
        addColorRow(lightGroup, settings, 'light-foreground', 'Text');

        const darkGroup = new Adw.PreferencesGroup({
            title: 'Dark theme',
            description: 'Defaults match GNOME Terminal\'s built-in ' +
                '"GNOME dark" scheme.',
        });
        page.add(darkGroup);
        addColorRow(darkGroup, settings, 'dark-background', 'Background');
        addColorRow(darkGroup, settings, 'dark-foreground', 'Text');

        const maintenanceGroup = new Adw.PreferencesGroup({title: 'Maintenance'});
        page.add(maintenanceGroup);

        const restoreRow = new Adw.ActionRow({
            title: 'Restore original colors',
            subtitle: 'Turns syncing off and puts back the terminal colors used ' +
                'before this extension changed them. Turn syncing back on to ' +
                'resume following the system theme.',
        });
        const restoreButton = new Gtk.Button({
            label: 'Restore',
            valign: Gtk.Align.CENTER,
        });
        restoreButton.connect('clicked', () => {
            // Turning syncing off first lets the live extension restore and
            // clear its state. The explicit restore covers the case where the
            // extension is installed but currently disabled.
            settings.set_boolean('sync-enabled', false);
            new TerminalThemeSync(settings).restore();
        });
        restoreRow.add_suffix(restoreButton);
        restoreRow.activatable_widget = restoreButton;
        maintenanceGroup.add(restoreRow);

        const resetRow = new Adw.ActionRow({
            title: 'Reset colors to defaults',
            subtitle: 'Restore the recommended light and dark colors.',
        });
        const resetButton = new Gtk.Button({
            label: 'Reset',
            valign: Gtk.Align.CENTER,
        });
        resetButton.connect('clicked', () => {
            for (const key of ['light-background', 'light-foreground',
                'dark-background', 'dark-foreground'])
                settings.reset(key);
        });
        resetRow.add_suffix(resetButton);
        resetRow.activatable_widget = resetButton;
        maintenanceGroup.add(resetRow);
    }
}
