import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class AltTabMRUPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();

        const page = new Adw.PreferencesPage({
            title: 'General',
            icon_name: 'preferences-system-symbolic',
        });
        window.add(page);

        const group = new Adw.PreferencesGroup({
            title: 'Workspace Behavior',
            description: 'Configure which windows appear in the switcher',
        });
        page.add(group);

        // Current workspace only toggle
        const row = new Adw.SwitchRow({
            title: 'Current Workspace Only',
            subtitle: 'Only show windows from the active workspace',
        });
        settings.bind(
            'current-workspace-only',
            row,
            'active',
            Gio.SettingsBindFlags.DEFAULT
        );
        group.add(row);
    }
}
