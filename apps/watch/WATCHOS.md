# Timer Stacks — watchOS

This document covers everything about the Apple Watch companion app: structure, sync architecture, what's built, and what still needs native Xcode setup.

---

## Current status

| Feature | Status |
|---------|--------|
| Session model (Swift mirror of TS types) | ✅ Complete |
| WatchConnectivityManager (WCSession bridge) | ✅ Complete |
| HapticsManager | ✅ Complete |
| ContentView routing (idle / active / complete) | ✅ Complete |
| ActiveSessionView (glanceable timer UI) | ✅ Complete |
| Pause / resume / skip / stop controls | ✅ Complete |
| Haptic on segment end | ✅ Complete |
| Haptic on stack completion | ✅ Complete |
| PreviewData for Xcode Previews | ✅ Complete |
| iPhone-side TS bridge interface | ✅ Complete (placeholder) |
| Unit tests for buildWatchSnapshot / toWatchStatus | ✅ 23 tests passing |
| Native WatchKit module in Expo iOS app | 🔲 Requires native dev setup |
| Xcode project / target configuration | 🔲 Requires Apple Developer account |
| Real WCSession phone ↔ watch delivery | 🔲 Requires physical devices or paired simulators |
| watchOS Complications | 🔲 Future |
| Always-On Display | 🔲 Future |

---

## File structure

```
apps/watch/
├── TimerStacksWatchApp/
│   ├── TimerStacksWatchApp.swift    # App entry point — injects WatchConnectivityManager
│   ├── ContentView.swift            # Root router: idle / active / completed views
│   ├── ActiveSessionView.swift      # Main timer UI (glanceable, large controls)
│   ├── WatchSessionModel.swift      # Swift session model + live interpolation
│   ├── WatchConnectivityManager.swift  # WCSession bridge, published state, sendAction()
│   ├── HapticsManager.swift         # Centralised Taptic Engine calls
│   └── PreviewData.swift            # Static fixtures for Xcode Previews
└── WATCHOS.md                       # This file
```

### What each file does

**`WatchSessionModel.swift`** — The watch-side data model. Contains `WatchSessionModel` (a pre-computed snapshot sent by the iPhone), `WatchSessionStatus`, `WatchAction`, `WatchMessageKey`, and live interpolation methods (`liveSegmentRemainingMs`, `liveTotalRemainingMs`, `liveSegmentProgress`).

**`WatchConnectivityManager.swift`** — The sync bridge. Activates `WCSession`, receives session snapshots from the iPhone (both real-time and background delivery), and sends `WatchAction` commands back. Publishes `currentSession` and `connectionStatus` as `@Published` properties.

**`HapticsManager.swift`** — Static methods wrapping `WKInterfaceDevice.current().play(_:)`. Centralising haptics here means views never call the Taptic Engine directly and the feedback patterns are consistent.

**`ContentView.swift`** — Root routing view. Switches between `IdleView`, `ActiveSessionView`, and `CompletionView` based on `manager.currentSession?.status`. No logic lives here.

**`ActiveSessionView.swift`** — The primary UI. Uses `TimelineView(.periodic(from:by:1))` for drift-free 1-second ticks. Fires haptics via `onChange` observers on segment index and status changes. Layout: header → segment name → large countdown → progress bar → total remaining → controls.

**`HapticsManager.swift`** — `segmentComplete()`, `stackComplete()`, `buttonTap()`, `destructiveAction()`.

**`PreviewData.swift`** — Static `WatchSessionModel` fixtures (running, paused, nearly done, completed) plus a pre-seeded `WatchConnectivityManager` for use in `#Preview` blocks.

---

## Snapshot sync model

### Why pre-computed snapshots?

Two approaches exist for keeping the watch countdown accurate:

**Option A — Raw timestamps.** Send `startedAt`, `pausedAt`, `totalPausedMs` and let the watch run the same wall-clock algorithm as the TypeScript engine. Accurate, but the watch needs the full stack/segment data, and any change to the engine's internal model breaks the Swift code.

**Option B — Pre-computed snapshots (chosen).** The iPhone runs the authoritative timer. On every *state change* it pre-computes the current remaining times and packages them with a `lastUpdatedAt` timestamp. The watch interpolates between pushes:

```
liveRemaining = snapshotRemaining − (now − lastUpdatedAt)   // running
liveRemaining = snapshotRemaining                           // paused
liveRemaining = 0                                           // completed / idle
```

The watch only needs display values for the *active* segment — no stack arrays, no engine internals. The Swift model is stable even if the TypeScript engine's internals change.

**Trade-off:** The watch cannot independently advance `activeSegmentIndex` when a segment hits zero. The iPhone must push a fresh snapshot whenever `activeSegmentIndex` changes. This is acceptable because the iPhone is always the authoritative timer.

### When the iPhone pushes

The iPhone calls `watchBridge.sendSessionSnapshot()` on every state *change*:
- Session started
- Paused / resumed
- Segment skipped
- Session stopped / completed
- **Immediately after applying a `WatchAction`** received from the watch

The iPhone does **not** push every second. The watch's `TimelineView(.periodic(from:by:1))` interpolates locally between pushes.

### Snapshot correctness rules

These rules are enforced in `buildWatchSnapshot()`:

| Session status | `activeSegmentRemainingMs` | `totalRemainingMs` | Watch status |
|----------------|---------------------------|-------------------|--------------|
| `running` | `max(0, derived)` — clamped, never negative | `max(0, derived)` | `running` |
| `paused` | `max(0, derived)` — timer is frozen | `max(0, derived)` | `paused` |
| `completed` | always `0` | always `0` | `completed` |
| `cancelled` | always `0` | always `0` | `completed` (no watch equivalent) |
| `idle` | always `0` | always `0` | `idle` |

### Full round-trip: Watch action → fresh snapshot

```
User taps Pause on the watch
    │
    HapticsManager.buttonTap()
    │
    WatchConnectivityManager.sendAction(.pause)
    │
    ├── isReachable → WCSession.sendMessage(...)         realtime
    └── not reachable → WCSession.transferUserInfo(...)  queued fallback
                    │
    iPhone WCSessionDelegate.didReceiveMessage / didReceiveUserInfo
                    │
    sessionStore.pause(sessionId)         ← applies the action
                    │
    buildWatchSnapshot(session, stack, state)
                    │
    watchBridge.sendSessionSnapshot(snapshot)  ← MUST be called here
                    │
    Watch receives fresh snapshot
                    │
    WatchConnectivityManager.receiveSessionUpdate(model)
      (stale-snapshot check: rejects if lastUpdatedAt < current)
                    │
    @Published currentSession updates → SwiftUI re-renders
```

### Stale snapshot protection

`receiveSessionUpdate` rejects any incoming snapshot whose `lastUpdatedAt` is older than the currently displayed snapshot. This protects against out-of-order delivery — `transferUserInfo` messages are queued and may arrive in a different order than they were sent.

### Sync architecture

#### iPhone → Watch (session state)

```
iPhone session changes (start / pause / resume / skip / complete)
    │
    ├── isReachable → WCSession.sendMessage(...)              foreground, instant
    └── not reachable → WCSession.updateApplicationContext(...)  background queue
                                │
                    WCSessionDelegate.didReceiveMessage
                    WCSessionDelegate.didReceiveApplicationContext
                    WCSessionDelegate.didReceiveUserInfo        ← transferUserInfo
                                │
                    receiveSessionUpdate(model)
                      → stale check → currentSession (Published)
                                │
                    ActiveSessionView.TimelineView (1s tick)
                                │
                    session.liveSegmentRemainingMs(now: now)
```

#### Watch → iPhone (control actions)

```
User taps button in ActiveSessionView
    │
    HapticsManager.buttonTap()
    │
    WatchConnectivityManager.sendAction(.pause)
    │
    ├── isReachable → WCSession.sendMessage(...)     realtime
    └── not reachable → WCSession.transferUserInfo(..)  queued
                    │
    iPhone WCSessionDelegate.didReceiveMessage / didReceiveUserInfo
                    │
    sessionStore.pause(sessionId)        ← existing Zustand action
                    │
    watchBridge.sendSessionSnapshot(...) ← fresh snapshot pushed back
```

### Message protocol

All messages use these keys (defined in `WatchMessageKey.swift` and `apps/mobile/src/lib/watchConnectivity.ts`):

| Key | Direction | Value |
|-----|-----------|-------|
| `ts_watch_session` | iPhone → Watch | JSON-encoded `WatchSessionSnapshot` |
| `ts_watch_action` | Watch → iPhone | `WatchAction.rawValue` string |
| `ts_session_id` | Watch → iPhone | `String` |

---

## iPhone-side integration (TypeScript placeholder)

`apps/mobile/src/lib/watchConnectivity.ts` contains:

- **`IWatchConnectivityBridge`** — the complete interface the rest of the app uses
- **`WatchSessionSnapshot`** — mirrors `WatchSessionModel.swift`
- **`WatchAction`** — mirrors `WatchAction.swift`
- **`NoOpWatchBridge`** — safe no-op implementation active until native bridge exists
- **`buildWatchSnapshot(session, stack, derived)`** — builds a snapshot from live state
- **`watchBridge`** — the singleton, currently `NoOpWatchBridge`

To wire it up in the session store:

```typescript
import { watchBridge, buildWatchSnapshot } from '../lib/watchConnectivity.js';

// In sessionStore, after any state change:
const state = computeSessionState(session, stack, Date.now());
watchBridge.sendSessionSnapshot(buildWatchSnapshot(session, stack, state));

// In store init, listen for watch commands:
watchBridge.onAction((action, sessionId) => {
  switch (action) {
    case 'pause':       pause(sessionId);              break;
    case 'resume':      resume(sessionId);             break;
    case 'skipSegment': skip(sessionId);               break;
    case 'stopSession': cancel(sessionId, getStack()); break;
  }
});
```

---

## What requires native / Xcode setup

### 1. Xcode project and Watch target

The Swift files in `apps/watch/TimerStacksWatchApp/` need to be wrapped in a proper Xcode project:

1. Open Xcode → File → New → Project → watchOS App
2. Name it `TimerStacksWatchApp`
3. Add all `.swift` files from this directory to the target
4. Set minimum deployment: **watchOS 10**
5. Set Swift version: **5.9**

Required capabilities:
- **WatchConnectivity** (automatic, no entitlement needed)
- **Haptic Engine** (automatic)

### 2. Apple Developer account

You need a Developer account (free or paid) to:
- Code-sign the watch app
- Install on a physical watch
- Pair with a physical iPhone

Free accounts work for simulator testing. Paid accounts are required for device distribution.

### 3. Native WatchKit module in the Expo app

The iPhone side (`watchBridge`) is currently a no-op. To make sync work:

1. In `apps/mobile/ios/`, create a native Swift module that:
   - Activates `WCSession.default`
   - Implements `WCSessionDelegate`
   - Exposes `sendSessionSnapshot` and `onAction` to React Native via `RCTBridgeModule` or a TurboModule
2. Implement `IWatchConnectivityBridge` in TypeScript using that native module
3. Replace `NoOpWatchBridge` with your implementation in `watchConnectivity.ts`

### 4. Paired simulator testing

WatchConnectivity does **not** work in unpaired simulators. To test in the simulator:
1. In Xcode, use Window → Devices and Simulators to pair an iPhone simulator with a watchOS simulator
2. Install both the iPhone app and the watch app on the paired pair
3. WCSession `isReachable` will be true only when both simulators are running

### 5. Physical device testing

1. Install the iPhone app on a real iPhone
2. Install the watch app on a paired Apple Watch (same Developer account)
3. The WatchConnectivity framework handles all Bluetooth transport automatically

---

## How to open in Xcode

```bash
# 1. Create a new watchOS project in Xcode
open -a Xcode

# File → New → Project → watchOS → App
# Product Name: TimerStacksWatchApp
# Bundle ID: com.yourteam.timerstacks.watchapp
# Minimum Deployment: watchOS 10

# 2. Copy Swift files
# Drag all .swift files from apps/watch/TimerStacksWatchApp/ into the Xcode project

# 3. Build
# Select a watchOS simulator scheme and hit ⌘R
```

---

## Limitations

- **No background refresh**: The watch only updates when a `sendMessage` or `updateApplicationContext` arrives from the iPhone. The watch interpolates countdown values between updates but cannot independently advance `activeSegmentIndex` when a segment ends — the iPhone must push an update.

- **`updateApplicationContext` last-value-wins**: Background delivery replaces the previous context. If the iPhone pushes multiple rapid updates while the watch is sleeping, only the last one arrives. This is fine for our use case — we only care about current state.

- **WatchConnectivity simulator parity**: Some WCSession behaviours differ between the simulator pair and real devices. Always test on hardware before shipping.

- **No complications or Always-On Display**: The current implementation covers the active-app experience only.

- **No independent watchOS app**: The watch requires the paired iPhone app to run. If the iPhone app is killed, the watch shows the last received state until the next sync.
