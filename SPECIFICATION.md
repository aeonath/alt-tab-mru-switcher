# GNOME Alt-Tab Replacement Extension — Specification

## Overview

Create a GNOME Shell extension that replaces the default Alt+Tab behavior with a **Windows-style window switcher**.

The extension must prioritize:
- speed
- predictability
- true MRU (Most Recently Used) behavior
- zero application grouping

---

## Goals

- Replace GNOME’s default Alt+Tab completely
- Switch between **individual windows**, not applications
- Provide **true back-and-forth switching**
- Eliminate grouping, animation lag, and hidden behavior

---

## Core Behavior

### 1. Window-Based Switching

- Alt+Tab cycles through **Meta.Window instances**
- Each window is treated independently
- No grouping by application under any condition

---

### 2. MRU (Most Recently Used) Ordering

Maintain a global MRU list of windows.

#### Requirements:
- Most recently focused window is first
- MRU updates on:
  - focus change
  - window creation
  - window destruction
  - workspace change

#### Behavior:
- Press Alt+Tab → switch to last focused window
- Press Alt+Tab again → switch back (true toggle)
- Holding Alt and pressing Tab repeatedly cycles in MRU order

---

### 3. Linear Cycling

- Sequential cycling through MRU list
- No skipping, no grouping
- Wrap-around at end of list

---

### 4. Immediate Switching

- Switching occurs immediately on key press
- No delay or confirmation step required

---

## Keybindings

### Required Overrides

- Alt+Tab → forward cycle
- Alt+Shift+Tab → reverse cycle

### Behavior

- Detect Alt key press state
- Track repeated Tab presses
- On Alt release:
  - finalize selection (no-op if already switched)

---

## Workspace Behavior

### Default

- Include windows from **all workspaces**

### Optional (configurable)

- Restrict to current workspace only

### Requirements

- MRU list must remain valid across workspaces
- Switching must not break when moving between workspaces

---

## UI Requirements

### Minimal Overlay (Optional)

- Lightweight popup showing:
  - window title
  - application icon (optional)
- No heavy animations
- Must not block rapid switching

### Performance

- Switching must feel instant
- Avoid Coverflow-style or animated transitions

---

## Technical Implementation

### Architecture

- DO NOT modify GNOME’s default switcher directly
- DO NOT depend on AppSwitcherPopup

### Approach

- Intercept keybindings at extension level
- Implement custom switcher logic

---

### Window Access

Use GNOME Shell APIs:

- `global.display.get_tab_list()` or equivalent
- Track focus using:
  - `global.display.connect('notify::focus-window', ...)`

---

### MRU Tracking

Maintain internal list:

- Array of Meta.Window objects
- Update on focus events
- Remove invalid/destroyed windows

---

### Activation

To focus window:

```js
window.activate(global.get_current_time());
