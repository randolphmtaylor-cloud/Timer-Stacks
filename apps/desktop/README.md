# Timer Stacks — Desktop App

Vite + React + TypeScript + Tailwind CSS, packaged with Tauri 2.

## Dev (browser only)
```bash
pnpm dev
# Opens at http://localhost:1420
```

## Dev (native Tauri window)
```bash
pnpm tauri:dev
# Requires Rust + Tauri CLI installed
```

## Build (browser bundle)
```bash
pnpm build
```

## Build (native app)
```bash
pnpm tauri:build
```

## Keyboard shortcuts
| Key | Action |
|-----|--------|
| ⌘N | New stack |
| Esc | Close modals |

## Storage
All data lives in `localStorage` under the `ts:` namespace:
- `ts:stacks` — all timer stacks
- `ts:active-sessions` — running/paused sessions (survives refresh)
- `ts:history` — completed session records
- `ts:settings` — user preferences
