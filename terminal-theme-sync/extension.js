// SPDX-License-Identifier: GPL-2.0-or-later

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

import {TerminalThemeSync} from './terminalSync.js';

export default class TerminalThemeSyncExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._sync = new TerminalThemeSync(this._settings);
        this._sync.start();
    }

    disable() {
        this._sync?.stop();
        this._sync = null;
        this._settings = null;
    }
}
