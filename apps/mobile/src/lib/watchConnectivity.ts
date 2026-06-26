// ---------------------------------------------------------------------------
// watchConnectivity.ts — iPhone-side WatchConnectivity bridge (placeholder).
//
// PURPOSE
// -------
// This module defines the complete TypeScript interface for the iPhone ↔ Watch
// sync layer. The real implementation requires a native Swift module inside the
// Expo iOS build. Until that exists, `NoOpWatchBridge` is exported as the
// active bridge — all methods are safe no-ops that compile and run correctly.
//
// SNAPSHOT SYNC MODEL
// -------------------
// The watch does NOT receive raw engine timestamps. Instead, the iPhone sends
// pre-computed snapshots at the moment of each state change:
//
//   iPhone state changes (start / pause / resume / skip / stop / complete)
//       │
//       └─► buildWatchSnapshot() captures remaining-ms values + lastUpdatedAt
//           │
//           └─► watchBridge.sendSessionSnapshot(snapshot)  ← call this
//
// The watch interpolates live countdown values between updates:
//   liveRemaining = snapshot.activeSegmentRemainingMs - (now - snapshot.lastUpdatedAt)
//
// The iPhone does NOT push every second — only on state changes. The watch
// keeps the display accurate locally between those pushes.
//
// After the iPhone applies a WatchAction (pause / resume / skip / stop), it
// MUST call sendSessionSnapshot() again immediately so the watch display
// reflects the new state without waiting for another state change.
//
// HOW TO USE NOW
// --------------
// After any session state change in the session store:
//   import { watchBridge, buildWatchSnapshot } from './watchConnectivity.js';
//   const state = computeSessionState(session, stack, Date.now());
//   watchBridge.sendSessionSnapshot(buildWatchSnapshot(session, stack, state));
//
// In store initialisation, subscribe to watch commands:
//   watchBridge.onAction((action, sessionId) => {
//     switch (action) {
//       case 'pause':       pause(sessionId);              break;
//       case 'resume':      resume(sessionId);             break;
//       case 'skipSegment': skip(sessionId);               break;
//       case 'stopSession': cancel(sessionId, getStack()); break;
//     }
//     // After applying the action, push a fresh snapshot:
//     const updated = getSession(sessionId);
//     const stk     = getStack(updated.stackId);
//     const st      = computeSessionState(updated, stk, Date.now());
//     watchBridge.sendSessionSnapshot(buildWatchSnapshot(updated, stk, st));
//   });
//
// HOW TO REPLACE WITH THE REAL NATIVE IMPLEMENTATION
// ----------------------------------------------------
// 1. Build a native Swift WatchKit module in apps/mobile/ios/.
// 2. Expose it as a React Native NativeModule or TurboModule.
// 3. Implement `IWatchConnectivityBridge` against that native module.
// 4. Swap `NoOpWatchBridge` for your implementation in the export at the bottom.
// 5. No other file in the codebase needs to change.
//
// WCSession message keys (keep in sync with WatchMessageKey.swift):
//   ts_watch_session  — JSON-encoded WatchSessionSnapshot (iPhone → Watch)
//   ts_watch_action   — WatchAction string (Watch → iPhone)
//   ts_session_id     — session ID string (Watch → iPhone)
// ---------------------------------------------------------------------------

import { NativeModules, NativeEventEmitter, Platform } from 'react-native';
import type { Session, SessionStatus, TimerStack } from '@timer-stacks/core';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Pre-computed session snapshot pushed to the Apple Watch.
 *
 * The watch interpolates live countdown values from `lastUpdatedAt` so the
 * iPhone only needs to push on state *changes*, not on every tick.
 *
 * Mirror of WatchSessionModel.swift in apps/watch/TimerStacksWatchApp/.
 * Field names and types MUST stay in sync with the Swift struct.
 */
export interface WatchSessionSnapshot {
  /** Matches Session.sessionId in the store. */
  sessionId: string;
  /** Display name of the stack. */
  stackName: string;
  /** Label of the currently active segment. */
  activeSegmentName: string;
  /** Total duration of the active segment in ms — used for the progress bar. */
  activeSegmentDurationMs: number;
  /**
   * Remaining time for the active segment at `lastUpdatedAt`.
   * Always ≥ 0. Always 0 for completed / idle / cancelled sessions.
   */
  activeSegmentRemainingMs: number;
  /**
   * Remaining time for the full stack at `lastUpdatedAt`.
   * Always ≥ 0. Always 0 for completed / idle / cancelled sessions.
   */
  totalRemainingMs: number;
  /**
   * Watch-side status. Note: `'cancelled'` is not a valid watch status —
   * cancelled sessions are sent as `'completed'` (see toWatchStatus).
   */
  status: 'running' | 'paused' | 'completed' | 'idle';
  /** 0-based index of the currently active segment. */
  activeSegmentIndex: number;
  /** Total number of segments in the stack. */
  totalSegments: number;
  /**
   * Unix ms when this snapshot was created on the iPhone.
   * The watch computes liveRemaining = remaining − (now − lastUpdatedAt).
   */
  lastUpdatedAt: number;
}

/** Control actions the watch can send back to the iPhone. */
export type WatchAction = 'pause' | 'resume' | 'skipSegment' | 'stopSession';

/** Unsubscribe function returned by `onAction`. */
export type UnsubscribeFn = () => void;

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface IWatchConnectivityBridge {
  /**
   * Push the current session state to the Apple Watch.
   * Call on every session state change: start, pause, resume, skip, stop,
   * complete — and immediately after applying a WatchAction.
   * Do NOT call every second; the watch interpolates between pushes.
   */
  sendSessionSnapshot(snapshot: WatchSessionSnapshot): void;

  /**
   * Register a handler for control commands arriving from the watch.
   * Returns an unsubscribe function — call it on store/component teardown.
   */
  onAction(handler: (action: WatchAction, sessionId: string) => void): UnsubscribeFn;

  /** True when the paired watch is reachable for real-time sendMessage. */
  isReachable(): boolean;
}

// ---------------------------------------------------------------------------
// No-op placeholder
// ---------------------------------------------------------------------------

/**
 * Safe no-op bridge used on Android, in tests, or before the native module loads.
 */
export class NoOpWatchBridge implements IWatchConnectivityBridge {
  sendSessionSnapshot(_snapshot: WatchSessionSnapshot): void {}

  onAction(_handler: (action: WatchAction, sessionId: string) => void): UnsubscribeFn {
    return () => {};
  }

  isReachable(): boolean {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Native bridge (iOS only)
// ---------------------------------------------------------------------------

/**
 * Real implementation backed by WatchConnectivityBridge.swift via RCT_EXTERN_MODULE.
 * Only instantiated when the native module is present (iOS + real device or simulator).
 */
class NativeWatchBridge implements IWatchConnectivityBridge {
  private readonly native = NativeModules.WatchConnectivityBridge;
  private readonly emitter = new NativeEventEmitter(NativeModules.WatchConnectivityBridge);

  sendSessionSnapshot(snapshot: WatchSessionSnapshot): void {
    try {
      const json = JSON.stringify(snapshot);
      this.native.sendSessionSnapshot(json).catch((err: unknown) => {
        console.warn('[WatchBridge] sendSessionSnapshot failed:', err);
      });
    } catch (err) {
      console.warn('[WatchBridge] sendSessionSnapshot serialization failed:', err);
    }
  }

  onAction(handler: (action: WatchAction, sessionId: string) => void): UnsubscribeFn {
    const subscription = this.emitter.addListener(
      'watchAction',
      (event: { action: string; sessionId: string }) => {
        handler(event.action as WatchAction, event.sessionId);
      },
    );
    return () => subscription.remove();
  }

  isReachable(): boolean {
    // Synchronous check not exposed; use the async native method if needed.
    // For now, assume reachable if the module is present — the Swift side
    // handles actual reachability and falls back to updateApplicationContext.
    return true;
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

function createBridge(): IWatchConnectivityBridge {
  if (Platform.OS === 'ios' && NativeModules.WatchConnectivityBridge) {
    return new NativeWatchBridge();
  }
  return new NoOpWatchBridge();
}

/**
 * The bridge singleton used by the rest of the app.
 * Automatically uses the real native module on iOS and a no-op on other platforms.
 */
export const watchBridge: IWatchConnectivityBridge = createBridge();

// ---------------------------------------------------------------------------
// Status mapping
// ---------------------------------------------------------------------------

/**
 * Maps the full iOS session status to the four statuses the watch understands.
 *
 * `'cancelled'` has no watch equivalent — we send `'completed'` so the watch
 * shows the done state rather than an unknown enum value.
 */
export function toWatchStatus(status: SessionStatus): WatchSessionSnapshot['status'] {
  switch (status) {
    case 'running':   return 'running';
    case 'paused':    return 'paused';
    case 'completed': return 'completed';
    case 'cancelled': return 'completed'; // watch treats cancelled as done
    case 'idle':      return 'idle';
  }
}

// ---------------------------------------------------------------------------
// Snapshot builder
// ---------------------------------------------------------------------------

/**
 * Builds a WatchSessionSnapshot from live session state.
 *
 * CORRECTNESS GUARANTEES
 * ───────────────────────
 * • Remaining times are clamped to [0, ∞) — never negative.
 * • Completed, cancelled, and idle sessions always get 0 remaining times
 *   regardless of what `derived` contains, because the watch must show 0.
 * • `'cancelled'` maps to the watch status `'completed'` (see toWatchStatus).
 * • `lastUpdatedAt` is stamped at call time so the watch's interpolation
 *   starts from the correct wall-clock reference.
 *
 * USAGE
 * ─────
 * Call after every session state change, passing values from computeSessionState:
 *
 *   const state    = computeSessionState(session, stack, Date.now());
 *   const snapshot = buildWatchSnapshot(session, stack, state);
 *   watchBridge.sendSessionSnapshot(snapshot);
 */
export function buildWatchSnapshot(
  session: Session,
  stack: TimerStack,
  derived: {
    activeSegmentIndex: number;
    segmentRemainingMs: number;
    totalRemainingMs: number;
  },
): WatchSessionSnapshot {
  const watchStatus = toWatchStatus(session.status);

  // Terminal states must always show zero — the session is over.
  // This also guards against the caller accidentally passing stale positive
  // values for a session that has just completed.
  const isTerminal = watchStatus === 'completed' || watchStatus === 'idle';

  const seg = stack.segments[derived.activeSegmentIndex];

  return {
    sessionId:                session.sessionId,
    stackName:                stack.name,
    activeSegmentName:        seg?.label ?? '',
    activeSegmentDurationMs:  seg?.durationMs ?? 0,
    activeSegmentRemainingMs: isTerminal ? 0 : Math.max(0, derived.segmentRemainingMs),
    totalRemainingMs:         isTerminal ? 0 : Math.max(0, derived.totalRemainingMs),
    status:                   watchStatus,
    activeSegmentIndex:       derived.activeSegmentIndex,
    totalSegments:            stack.segments.length,
    lastUpdatedAt:            Date.now(),
  };
}
