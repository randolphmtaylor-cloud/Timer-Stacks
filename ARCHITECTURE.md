# Timer Stacks — Architecture

## Overview

Timer Stacks is a structured timer application built as a pnpm monorepo with Turborepo. It runs on macOS (Vite + Tauri desktop), iOS (Expo + React Native), and Apple Watch (native SwiftUI). A shared TypeScript engine powers the business logic across all JS platforms. The watchOS app implements the same interpolation algorithm in Swift and receives pre-computed state from the iPhone via WatchConnectivity.

```
Timer Stacks/
├── packages/
│   ├── core/          # Platform-agnostic timer engine, types, validation, seeds
│   ├── storage/       # Abstract storage interfaces + base classes
│   └── config/        # Shared tsconfig base
└── apps/
    ├── desktop/       # Vite + React + Tauri 2 (macOS)
    ├── mobile/        # Expo + React Native + NativeWind (iOS/Android)
    └── watch/         # Native SwiftUI watchOS companion
```

---

## packages/core

Everything in `packages/core` is pure TypeScript with zero platform dependencies.

### Timer engine (`src/engine.ts`)

The engine is **deterministic and drift-free**. It never uses `setTimeout` as a time source. Sessions store wall-clock timestamps:

```typescript
interface Session {
  startedAt:     number | null   // Unix ms when the timer started/resumed
  pausedAt:      number | null   // Unix ms when last paused
  totalPausedMs: number          // Accumulated pause duration
}
```

The pure function `computeSessionState(session, stack, now)` derives everything from those timestamps:

```
wallElapsed   = now − startedAt                  (when running)
              = pausedAt − startedAt             (when paused)
activeElapsed = wallElapsed − totalPausedMs      (true timer value)
```

**Consequences:**
- Never drifts even after hours of backgrounding
- Pause/resume is just recording a timestamp
- Cold-boot recovery is free — reload timestamps, call `computeSessionState`
- Multiple concurrent sessions are independent

### Session state machine

```
idle → running → paused ⇄ running → completed
                                   → cancelled
```

All transitions return new immutable `Session` objects. The store holds the latest state; the engine never mutates.

### Notification message builders (`src/notifications.ts`)

Domain-level copy lives in core so desktop and mobile use identical wording:

```typescript
buildSegmentTransitionMessage(completedLabel, nextLabel): NotificationMessage
buildSessionStartedMessage(stackName, firstSegmentLabel): NotificationMessage
buildStackCompletedMessage(stackName): NotificationMessage
```

### Validation and seeds

- **Zod schemas** (`src/validation.ts`) validate all user input before it reaches the engine
- **Seed stacks** (`src/seeds.ts`) provide template timer routines

---

## packages/storage

Defines abstract contracts and base classes. Concrete implementations live in each app.

### Interfaces

```typescript
IStackStorage           — CRUD for stacks + seedIfEmpty
ISessionStorage         — active session persistence + history
INotificationService    — show(), requestPermission()
```

### Abstract base classes

`BaseStackStorage` and `BaseSessionStorage` implement all logic once. Subclasses supply only primitive I/O:

```typescript
// Stack storage: 2 methods to implement
protected abstract readAll(): Promise<TimerStack[]>;
protected abstract writeAll(stacks: TimerStack[]): Promise<void>;

// Session storage: 3 methods to implement
protected abstract getItem(key: string): Promise<string | null>;
protected abstract setItem(key: string, value: string): Promise<void>;
protected abstract removeItem(key: string): Promise<void>;
```

### Platform implementations

| Platform | Stack storage | Session storage | Notification service |
|----------|--------------|-----------------|---------------------|
| Desktop  | `LocalStackStorage` (localStorage) | `LocalSessionStorage` | `WebNotificationService` |
| Mobile   | `AsyncStackStorage` (AsyncStorage) | `AsyncSessionStorage` | `ExpoNotificationService` |

---

## apps/desktop

**Stack:** Vite + React 18 + TypeScript + Tailwind CSS + Tauri 2

### State management

Zustand stores — `stackStore` and `sessionStore` — delegate to `LocalStackStorage`, `LocalSessionStorage`, and `WebNotificationService`. `SessionManager` from `packages/core` runs all timer logic and fires typed events.

### Views

| Route | Component |
|-------|-----------|
| `/` | `Dashboard` — running session cards, stack grid |
| `/builder` | `StackBuilder` — add/reorder/delete segments |
| `/session/:id` | `ActiveSession` — live countdown, controls |
| `/templates` | `Templates` — seed stack browser |
| `/history` | `History` — past sessions |
| `/settings` | `Settings` — theme, notifications |

---

## apps/mobile

**Stack:** Expo 51 + React Native 0.74 + TypeScript + NativeWind + expo-router

### Active Session layout (fixed three-zone)

```
┌─────────────────────────────┐
│  Header: stack name + pill  │  fixed height
├─────────────────────────────┤
│  Hero: big timer + progress │  flex: 1
│        + upcoming chips     │
├─────────────────────────────┤
│  Controls: primary + row    │  fixed height
└─────────────────────────────┘
```

Progress bars use `flex`-based layout (`flex: progress` / `flex: 1-progress`) rather than `width: percentage` to avoid the React Native type hack.

### Haptics

`expo-haptics` fires on segment transition and stack completion. Calls are always `.catch(() => {})` so they never throw on simulators.

### WatchConnectivity placeholder

`apps/mobile/src/lib/watchConnectivity.ts` exports a clean TypeScript interface (`IWatchConnectivityBridge`) and a safe no-op implementation (`NoOpWatchBridge`). The rest of the app imports `watchBridge` and calls `sendSessionSnapshot` / `onAction` — no changes needed when the real native bridge is ready.

---

## apps/watch

**Stack:** Swift 5.9 + SwiftUI + WatchConnectivity — watchOS 10+

The watch is a **companion controller**, not a standalone app. The iPhone is always the source of truth for session state. The watch displays and controls; it never runs the timer engine independently.

### File map

| File | Purpose |
|------|---------|
| `TimerStacksWatchApp.swift` | Entry point; creates `WatchConnectivityManager` as `@StateObject` |
| `WatchSessionModel.swift` | Swift session snapshot + live interpolation methods |
| `WatchConnectivityManager.swift` | WCSession bridge; publishes `currentSession`, `connectionStatus` |
| `ContentView.swift` | Root router: idle / active / completed |
| `ActiveSessionView.swift` | Glanceable timer UI; `TimelineView` tick; haptics via `onChange` |
| `HapticsManager.swift` | Static Taptic Engine wrappers |
| `PreviewData.swift` | Static fixtures for Xcode Previews |

### Watch session model (pre-computed snapshot)

The iPhone pre-computes and sends a `WatchSessionSnapshot` on every state change. The watch never needs to know about raw timestamps, segment arrays, or the timer engine.

```swift
struct WatchSessionModel: Codable {
  let sessionId: String
  let stackName: String
  let activeSegmentName: String
  let activeSegmentDurationMs: Double    // for progress bar
  let activeSegmentRemainingMs: Double   // snapshot at lastUpdatedAt
  let totalRemainingMs: Double           // snapshot at lastUpdatedAt
  let status: WatchSessionStatus
  let activeSegmentIndex: Int
  let totalSegments: Int
  let lastUpdatedAt: Double              // Unix ms
}
```

### Live interpolation (same algorithm as the TS engine)

The watch interpolates countdown values between iPhone pushes:

```swift
func liveSegmentRemainingMs(now: Double) -> Double {
    guard status == .running else { return max(0, activeSegmentRemainingMs) }
    return max(0, activeSegmentRemainingMs - (now - lastUpdatedAt))
}
```

`TimelineView(.periodic(from: .now, by: 1))` drives the 1-second UI tick — no manual timer management.

### Sync data flow

```
iPhone (Session state changes)
    │
    ├─ isReachable ──▶ WCSession.sendMessage(ts_watch_session: JSON)      realtime
    └─ not reachable ▶ WCSession.updateApplicationContext(ts_watch_session: JSON)  background
                                    │
                    WatchConnectivityManager.didReceiveMessage / didReceiveApplicationContext
                                    │
                    @Published currentSession: WatchSessionModel?
                                    │
                    ContentView → ActiveSessionView → TimelineView
                                    │
                    session.liveSegmentRemainingMs(now: now)   interpolated display
```

### Control command flow (watch → phone)

```
User taps button in ActiveSessionView
    │
    HapticsManager.buttonTap()
    │
    WatchConnectivityManager.sendAction(.pause)
    │
    WCSession.sendMessage(["ts_watch_action": "pause", "ts_session_id": "..."])
    │
    iPhone WCSessionDelegate.didReceiveMessage(...)
    │
    sessionStore.pause(sessionId)        ← existing Zustand action
    │
    watchBridge.sendSessionSnapshot(...) ← iPhone pushes updated snapshot
```

---

## Full data flow (JS platforms)

```
User action
    │
    ▼
Zustand store action
    │
    ├─▶ SessionManager (packages/core)
    │       │
    │       ├─▶ computeSessionState() — pure, deterministic
    │       └─▶ fires typed events (segment_started, stack_completed, …)
    │
    ├─▶ IStackStorage / ISessionStorage  (platform implementation)
    │
    ├─▶ INotificationService  (platform implementation)
    │
    └─▶ watchBridge.sendSessionSnapshot(...)  (no-op until native bridge)
```

---

## Adding a new platform

1. Implement `IStackStorage`, `ISessionStorage`, `INotificationService` for the platform's persistence layer
2. Import `SessionManager` from `packages/core` — the timer engine never changes for new platforms
3. If native (Swift/Kotlin), mirror `WatchSessionModel` and implement the live interpolation algorithm — it is simple and self-contained

---

## Testing

Unit tests live in `packages/core/src/__tests__/`. Run with:

```sh
pnpm test
```

Coverage: 31 tests across TimerEngine (16), validation (8), SessionManager (7).
