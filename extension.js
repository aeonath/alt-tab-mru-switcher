import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import St from 'gi://St';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

export default class AltTabMRUExtension extends Extension {
    _mruList = [];
    _signals = [];
    _settings = null;
    _cycling = false;
    _cycleIndex = 0;
    _cycleWindows = null;
    _modifierMask = 0;
    _modifierCheckId = 0;
    _originalStartSwitcher = null;
    _overlay = null;
    _iconBoxes = [];

    enable() {
        this._settings = this.getSettings();
        this._mruList = [];
        this._signals = [];
        this._cycling = false;
        this._cycleIndex = 0;

        this._initMRUList();

        this._connectSignal(global.display, 'notify::focus-window', () => {
            this._onFocusChanged();
        });

        this._connectSignal(global.display, 'window-created', (_display, window) => {
            this._onWindowCreated(window);
        });

        this._connectSignal(global.workspace_manager, 'active-workspace-changed', () => {
            this._cleanupMRUList();
        });

        this._originalStartSwitcher = Main.wm._startSwitcher.bind(Main.wm);

        const handler = (...args) => this._handleSwitcher(...args);
        for (const kb of [
            'switch-applications', 'switch-applications-backward',
            'switch-windows', 'switch-windows-backward',
        ]) {
            Main.wm.setCustomKeybindingHandler(kb,
                Shell.ActionMode.NORMAL, handler);
        }
    }

    disable() {
        if (this._originalStartSwitcher) {
            const original = Main.wm._startSwitcher.bind(Main.wm);
            for (const kb of [
                'switch-applications', 'switch-applications-backward',
                'switch-windows', 'switch-windows-backward',
            ]) {
                Main.wm.setCustomKeybindingHandler(kb,
                    Shell.ActionMode.NORMAL, original);
            }
            this._originalStartSwitcher = null;
        }

        this._cleanupCycle();

        for (const {obj, id} of this._signals) {
            try {
                obj.disconnect(id);
            } catch {
                // Window may already be destroyed
            }
        }
        this._signals = [];

        this._mruList = [];
        this._settings = null;
    }

    _connectSignal(obj, signal, callback) {
        const id = obj.connect(signal, callback);
        this._signals.push({obj, id});
    }

    _handleSwitcher(display, window, event, binding) {
        const bindingName = binding.get_name();
        const backward = bindingName === 'switch-applications-backward' ||
                         bindingName === 'switch-windows-backward';

        if (this._cycling) {
            this._cycleStep(backward);
            return;
        }

        if (bindingName === 'switch-applications' ||
            bindingName === 'switch-applications-backward' ||
            bindingName === 'switch-windows' ||
            bindingName === 'switch-windows-backward') {
            this._startCycle(backward, binding.get_mask());
        } else {
            this._originalStartSwitcher(display, window, event, binding);
        }
    }

    _initMRUList() {
        const workspace = global.workspace_manager.get_active_workspace();
        const windows = global.display.get_tab_list(
            Meta.TabList.NORMAL, workspace);

        this._mruList = windows.filter(w => this._isValidWindow(w));

        const nWorkspaces = global.workspace_manager.get_n_workspaces();
        for (let i = 0; i < nWorkspaces; i++) {
            const ws = global.workspace_manager.get_workspace_by_index(i);
            if (ws === workspace)
                continue;
            const wsWindows = global.display.get_tab_list(
                Meta.TabList.NORMAL, ws);
            for (const w of wsWindows) {
                if (this._isValidWindow(w) && !this._mruList.includes(w))
                    this._mruList.push(w);
            }
        }

        for (const w of this._mruList)
            this._trackWindowDestroy(w);
    }

    _isValidWindow(window) {
        if (!window)
            return false;
        try {
            if (window.is_skip_taskbar?.())
                return false;
            const type = window.get_window_type();
            return type === Meta.WindowType.NORMAL ||
                   type === Meta.WindowType.DIALOG;
        } catch {
            return false;
        }
    }

    _trackWindowDestroy(window) {
        if (window._altTabMRUTracked)
            return;
        window._altTabMRUTracked = true;

        const id = window.connect('unmanaged', () => {
            this._onWindowDestroyed(window);
            window.disconnect(id);
            window._altTabMRUTracked = false;
        });
        this._signals.push({obj: window, id});
    }

    _promoteWindow(window) {
        const idx = this._mruList.indexOf(window);
        if (idx > 0) {
            this._mruList.splice(idx, 1);
            this._mruList.unshift(window);
        } else if (idx === -1 && this._isValidWindow(window)) {
            this._mruList.unshift(window);
            this._trackWindowDestroy(window);
        }
    }

    _cleanupMRUList() {
        this._mruList = this._mruList.filter(w => {
            try {
                return this._isValidWindow(w) && !w.is_unmanaging?.();
            } catch {
                return false;
            }
        });
    }

    _onFocusChanged() {
        if (this._cycling)
            return;

        const focused = global.display.get_focus_window();
        if (focused && this._isValidWindow(focused))
            this._promoteWindow(focused);
    }

    _onWindowCreated(window) {
        GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
            if (this._isValidWindow(window)) {
                this._promoteWindow(window);
                this._trackWindowDestroy(window);
            }
            return GLib.SOURCE_REMOVE;
        });
    }

    _onWindowDestroyed(window) {
        const idx = this._mruList.indexOf(window);
        if (idx !== -1)
            this._mruList.splice(idx, 1);
    }

    _getFilteredMRUList() {
        this._cleanupMRUList();

        if (this._settings.get_boolean('current-workspace-only')) {
            const activeWs = global.workspace_manager.get_active_workspace();
            return this._mruList.filter(w => {
                try {
                    return w.get_workspace() === activeWs;
                } catch {
                    return false;
                }
            });
        }

        return [...this._mruList];
    }

    _startCycle(backward, modifierMask) {
        const windows = this._getFilteredMRUList();
        if (windows.length < 2)
            return;

        this._cycling = true;
        this._cycleIndex = 0;
        this._cycleWindows = windows;
        this._modifierMask = modifierMask;

        this._showOverlay(windows);
        this._startModifierWatch();
        this._cycleStep(backward);
    }

    _cycleStep(backward) {
        const windows = this._cycleWindows;
        if (!windows || windows.length < 2)
            return;

        if (backward) {
            this._cycleIndex--;
            if (this._cycleIndex < 0)
                this._cycleIndex = windows.length - 1;
        } else {
            this._cycleIndex++;
            if (this._cycleIndex >= windows.length)
                this._cycleIndex = 0;
        }

        this._highlightIndex(this._cycleIndex);

        const target = windows[this._cycleIndex];
        if (target)
            this._activateWindow(target);
    }

    _activateWindow(window) {
        const workspace = window.get_workspace();
        const activeWs = global.workspace_manager.get_active_workspace();

        if (workspace !== activeWs)
            workspace.activate(global.get_current_time());

        window.activate(global.get_current_time());
    }

    _startModifierWatch() {
        if (this._modifierCheckId)
            return;

        this._modifierCheckId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 50, () => {
            const [, , mods] = global.get_pointer();
            if ((mods & this._modifierMask) === 0) {
                this._modifierCheckId = 0;
                this._finalizeCycle();
                return GLib.SOURCE_REMOVE;
            }
            return GLib.SOURCE_CONTINUE;
        });
    }

    _stopModifierWatch() {
        if (this._modifierCheckId) {
            GLib.source_remove(this._modifierCheckId);
            this._modifierCheckId = 0;
        }
    }

    _finalizeCycle() {
        const selected = this._cycleWindows?.[this._cycleIndex];
        this._cleanupCycle();

        if (selected && this._isValidWindow(selected)) {
            this._activateWindow(selected);
            this._promoteWindow(selected);
        }
    }

    _cleanupCycle() {
        this._stopModifierWatch();
        this._destroyOverlay();
        this._cycling = false;
        this._cycleIndex = 0;
        this._cycleWindows = null;
        this._modifierMask = 0;
    }

    // --- Overlay (purely visual, no input handling) ---

    _showOverlay(windows) {
        this._destroyOverlay();

        this._overlay = new St.BoxLayout({
            style: 'background-color: rgba(30, 30, 30, 0.92);'
                 + 'border-radius: 12px;'
                 + 'padding: 16px;'
                 + 'spacing: 12px;',
            vertical: false,
            reactive: false,
        });

        this._iconBoxes = [];

        const tracker = Shell.WindowTracker.get_default();
        for (const win of windows) {
            const app = tracker.get_window_app(win);

            const iconBin = new St.Bin({
                style: 'padding: 6px; border-radius: 8px;',
                x_align: Clutter.ActorAlign.CENTER,
                y_align: Clutter.ActorAlign.CENTER,
            });

            const icon = app
                ? app.create_icon_texture(48)
                : new St.Icon({icon_name: 'application-x-executable', icon_size: 48});
            iconBin.set_child(icon);

            this._overlay.add_child(iconBin);
            this._iconBoxes.push(iconBin);
        }

        Main.uiGroup.add_child(this._overlay);

        // Center after layout so dimensions are known
        this._overlay.connect('notify::width', () => {
            const m = Main.layoutManager.primaryMonitor;
            this._overlay.set_position(
                Math.floor(m.x + (m.width - this._overlay.width) / 2),
                Math.floor(m.y + (m.height - this._overlay.height) / 2),
            );
        });
    }

    _highlightIndex(index) {
        for (let i = 0; i < this._iconBoxes.length; i++) {
            this._iconBoxes[i].style = i === index
                ? 'padding: 6px; border-radius: 8px; background-color: rgba(255,255,255,0.2);'
                : 'padding: 6px; border-radius: 8px;';
        }
    }

    _destroyOverlay() {
        if (this._overlay) {
            Main.uiGroup.remove_child(this._overlay);
            this._overlay.destroy();
            this._overlay = null;
            this._iconBoxes = [];
        }
    }
}
