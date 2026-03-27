# Alt-Tab MRU Window Switcher

A GNOME Shell extension that replaces the default Alt+Tab with a **Windows-style window switcher** using true MRU (Most Recently Used) ordering.

## Features

- **Window-based switching** — cycles individual windows, not application groups
- **True MRU ordering** — Alt+Tab always switches to the last focused window
- **Back-and-forth toggle** — pressing Alt+Tab twice returns to the previous window
- **Icon-only overlay** — lightweight popup with application icons and highlighted selection
- **Cross-workspace support** — includes windows from all workspaces (configurable)
- **Immediate switching** — no animations or delays

## Requirements

- GNOME Shell 48

## Installation

### From source

```bash
./install.sh
```

This compiles the GSettings schema and copies the extension to `~/.local/share/gnome-shell/extensions/`.

After installing, restart GNOME Shell (log out/in on Wayland) and enable the extension:

```bash
gnome-extensions enable alt-tab-mru-switcher@miranova.studio
```

## Configuration

Open the extension preferences or use `dconf`:

| Setting | Description | Default |
|---------|-------------|---------|
| `current-workspace-only` | Only show windows from the current workspace | `false` |

## Keybindings

| Shortcut | Action |
|----------|--------|
| `Alt+Tab` | Switch to next window in MRU order |
| `Alt+Shift+Tab` | Switch to previous window in MRU order |

## License

MIT
