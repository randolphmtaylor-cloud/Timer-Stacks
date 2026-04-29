# Timer Stacks

A structured timer app built as a production-quality monorepo.
Create timer routines made of sequential segments — for practice sessions, workouts, deep work, or anything that benefits from a structured cadence.

---

## Monorepo Structure

```
timer-stacks/
├── packages/
│   ├── core/          # Timer engine, types, validation, seeds — shared by all platforms
│   ├── storage/       # Storage & notification interfaces (contracts only)
│   └── config/        # Shared tsconfig base
│
└── apps/
    ├── desktop/       # Vite + React + Tauri 2 (macOS / Windows / Linux)
    ├── mobile/        # Expo + React Native (iOS / Android)
    └── watch/         # Native SwiftUI watchOS companion app
```

---

## Prerequisites

| Tool | Minimum version | Required for |
|------|----------------|-------------|
| Node.js | 20+ | All JS apps |
| pnpm | 9+ | All JS apps |
| Rust | stable | Desktop (Tauri) |
| Xcode | 15+ | iOS mobile + watchOS |
| Apple Developer account | free or paid | watchOS device testing |

Install pnpm globally if you don't have it:
```bash
npm install -g pnpm
```

---

## Install Dependencies

From the repo root:
```bash
pnpm install
```

This installs all workspace packages in a single pass.

---

## Running Desktop

```bash
# Dev mode (Vite dev server only — no Tauri shell)
pnpm dev:desktop

# Dev mode with Tauri shell (macOS/Windows/Linux native window)
cd apps/desktop
pnpm tauri:dev
```

The app opens at `http://localhost:1420` in the browser, or in a native Tauri window.

### Building for distribution
```bash
cd apps/desktop
pnpm tauri:build
```
Outputs a signed `.app` (macOS), `.exe` (Windows), or `.AppImage` (Linux) to `apps/desktop/src-tauri/target/release/bundle/`.

---

## Running Mobile

```bash
pnpm dev:mobile
# or from the mobile directory:
cd apps/mobile
pnpm start
```

Then press `i` for iOS Simulator or `a` for Android emulator, or scan the QR code with Expo Go.

### Building for device
```bash
cd apps/mobile
pnpm build:ios    # requires EAS account
pnpm build:android
```

---

## Running Tests

```bash
# All packages
pnpm test

# Just core engine tests
cd packages/core
pnpm test
```

---

## Apple Watch App

The `apps/watch/` package is a native SwiftUI watchOS companion. It acts as a **remote controller** for the iPhone app — it shows the active timer and lets you pause, resume, skip, and stop without touching your phone.

```
apps/watch/
└── TimerStacksWatchApp/
    ├── TimerStacksWatchApp.swift      # App entry point
    ├── ContentView.swift              # Root router (idle / active / completed)
    ├── ActiveSessionView.swift        # Glanceable timer UI + large controls
    ├── WatchSessionModel.swift        # Swift session model + live interpolation
    ├── WatchConnectivityManager.swift # WCSession bridge
    ├── HapticsManager.swift           # Taptic Engine wrapper
    └── PreviewData.swift              # Fixtures for Xcode Previews
```

**Architecture:** The iPhone app is the single source of truth. When session state changes, it sends a pre-computed `WatchSessionSnapshot` via WatchConnectivity. The watch interpolates accurate countdown values locally using `lastUpdatedAt` — no second-by-second pushing needed. Control actions (pause, resume, skip, stop) travel the other direction: Watch → iPhone.

**Opening in Xcode:**
```bash
# Create a new watchOS App target in Xcode (watchOS 10+, Swift 5.9)
# Then drag all .swift files from apps/watch/TimerStacksWatchApp/ into the target
```

**What needs native setup:** The Swift watch app is complete. Wiring it to the iPhone requires a native `WCSession` module inside the Expo iOS build — see [apps/watch/WATCHOS.md](./apps/watch/WATCHOS.md) for full instructions and the placeholder TypeScript bridge at `apps/mobile/src/lib/watchConnectivity.ts`.

---

## How Shared Packages Work

The critical business logic lives in `packages/core` and is imported by both desktop and mobile:

```ts
import {
  SessionManager,         // manages concurrent timer sessions
  computeSessionState,    // pure derived state from timestamps
  TimerStack,             // types
  SEED_TEMPLATES,         // initial template data
  formatMs,               // time formatting
} from '@timer-stacks/core';
```

`packages/storage` defines TypeScript interfaces (`IStackStorage`, `ISessionStorage`, `INotificationService`) that each platform implements:
- **Desktop**: `LocalStackStorage` / `LocalSessionStorage` (localStorage)
- **Mobile**: `AsyncStackStorage` / `AsyncSessionStorage` (AsyncStorage)

This means the timer engine and domain logic are identical across platforms — only the I/O adapters differ.

---

## Timer Accuracy

The engine never uses `setInterval` as a source of truth for elapsed time. Instead:

1. Every `Session` stores absolute wall-clock timestamps (`startedAt`, `pausedAt`).
2. `computeSessionState(session, stack, now)` derives remaining time from `now - startedAt - totalPausedMs`.
3. Pause intervals are accumulated in `totalPausedMs` — no drift.
4. `SessionManager` calls `tick()` every 100ms to detect segment transitions, but the timer display always reads from the timestamp calculation.
5. On app restart, sessions are hydrated from storage and immediately resume with correct time because the calculation is purely timestamp-based.

This means the timers remain accurate across:
- App backgrounding
- Sleep / wake
- Phone calls / interruptions
- Multiple concurrent sessions

---

## How Notifications Work

| Platform | Adapter | Permission |
|----------|---------|------------|
| Desktop | `WebNotificationService` (Web Notifications API) | Prompts on first start |
| Mobile | `ExpoNotificationService` (expo-notifications) | Prompts on first start |

Both implement `INotificationService` from `packages/storage`. If permission is denied, notifications silently no-op — the UI continues working correctly.

Events that trigger notifications:
- `segment_started` — fired when a segment begins
- `stack_completed` — fired when the final segment ends

---

## Extending the App

### Add a new platform (e.g. web)
1. Create `apps/web/`
2. Import `@timer-stacks/core` — same engine, no changes needed
3. Implement `IStackStorage`, `ISessionStorage`, `INotificationService` for the browser

### Add cloud sync
1. Add a `packages/sync/` package with an `ISyncAdapter` interface
2. Implement with your backend (Supabase, Firebase, custom)
3. Wire into the store hydration in each platform app

### Add AI-generated routines
The `CreateStackInput` type is already suitable for AI output:
```ts
const aiStack = await generateStack(prompt); // → CreateStackInput
await stackStore.create(aiStack);
```

### Add analytics
Subscribe to `SessionManager` events:
```ts
sessionManager.subscribe((events) => {
  for (const event of events) {
    analytics.track(event.type, { sessionId: event.session.sessionId });
  }
});
```

### Systems Progress App integration
The `SessionRecord` type is designed to be portable — it contains all fields needed to log a completed session to an external system.

---

## Design Language

- Premium, minimal, Apple-inspired — not a copy of any platform UI
- System fonts (`-apple-system`, `SF Pro`) on desktop; system fonts on mobile
- Accent color: `#6366f1` (indigo)
- Radius: `1rem` / `1.25rem` on cards
- Shadows: soft, layered, not harsh
- Full light + dark mode support
- Smooth transitions (150–250ms ease-out)
