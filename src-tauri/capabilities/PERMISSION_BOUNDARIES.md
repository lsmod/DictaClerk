# Tauri Permission Boundaries Documentation

## Overview

This document defines the permission boundaries for DictaClerk windows to ensure proper state synchronization and resolve permission issues.

## Permission Design

### Main Window (`main`)

- **Purpose**: Primary application window and central event hub
- **Permissions**: Full event listening and emission capabilities
- **Responsibilities**:
  - Listen to all backend state machine events (`app-state-changed`, `processing-progress`, etc.)
  - Manage Redux store updates from backend events
  - Route events to other windows via Redux state changes
  - Handle system tray integration events

### Settings Window (`settings`)

- **Purpose**: Dedicated settings interface
- **Permissions**: NO direct event listening (by design)
- **Responsibilities**:
  - Read state from Redux store (shared from main window)
  - Send commands to backend via Tauri invoke
  - Rely on main window for state synchronization

### Profile Editor Window (`profile_editor`)

- **Purpose**: Profile editing interface
- **Permissions**: NO direct event listening (by design)
- **Responsibilities**:
  - Read state from Redux store (shared from main window)
  - Send commands to backend via Tauri invoke
  - Rely on main window for state synchronization

## Event Flow Architecture

```
Backend State Machine
        ↓ (emits events)
Main Window (listens)
        ↓ (updates Redux)
Redux Store (shared)
        ↓ (consumed by)
Settings/Profile Windows
```

## Error Resolution

The error `"event.listen not allowed on window "settings""` is resolved by:

1. Only main window listens to backend events
2. Settings window consumes state via Redux store
3. All windows can send commands to backend via `invoke()`

## Development Guidelines

1. **DO NOT** add event listeners to settings or profile editor windows
2. **DO** use Redux for cross-window state sharing
3. **DO** centralize all backend event handling in main window
4. **DO** use `invoke()` for sending commands from any window
5. **DO** emit state changes through the state machine, not directly

## Capability Files

- `default.json`: Main window permissions (event listening enabled)
- Future: Could add separate capabilities for settings/profile windows if needed (without event permissions)
