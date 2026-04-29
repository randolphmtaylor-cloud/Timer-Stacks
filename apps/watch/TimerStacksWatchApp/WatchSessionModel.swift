// ---------------------------------------------------------------------------
// WatchSessionModel.swift
//
// The watch-side session display model.
//
// DESIGN: WHY PRE-COMPUTED SNAPSHOTS + WATCH-SIDE INTERPOLATION
// -------------------------------------------------------------
// Two approaches exist for keeping the watch countdown accurate:
//
// Option A — Send raw timestamps (startedAt, pausedAt, totalPausedMs).
//   The watch replicates the TS engine's wall-clock algorithm.
//   Pro: perfectly accurate. Con: couples the watch to engine internals;
//   segment arrays and stack data must also be sent.
//
// Option B — Send pre-computed snapshots (chosen here).
//   The iPhone runs the authoritative timer and, on every *state change*
//   (start / pause / resume / skip / stop / complete), sends:
//     • the remaining time at the moment the change happened
//     • the timestamp when that snapshot was taken (lastUpdatedAt)
//   The watch adds local interpolation:
//     liveRemaining = snapshotRemaining − (now − lastUpdatedAt)   [running]
//     liveRemaining = snapshotRemaining                           [paused]
//     liveRemaining = 0                                           [completed / idle]
//
//   Pro: the watch only needs display values for the active segment.
//   No segment arrays. No engine internals. Stable Swift model even if the
//   TS engine changes its internal representation.
//   Con: the watch cannot independently advance activeSegmentIndex when a
//   segment hits zero — the iPhone must push a new snapshot. Acceptable
//   because the iPhone is always the authoritative timer.
//
// Mirror of the TypeScript WatchSessionSnapshot interface in:
//   apps/mobile/src/lib/watchConnectivity.ts
// ---------------------------------------------------------------------------

import Foundation

// MARK: - Session status

enum WatchSessionStatus: String, Codable, Equatable {
    case idle
    case running
    case paused
    case completed
}

// MARK: - Watch action (watch → iPhone)

enum WatchAction: String, Codable, CaseIterable {
    case pause       = "pause"
    case resume      = "resume"
    case skipSegment = "skipSegment"
    case stopSession = "stopSession"
}

// MARK: - Session snapshot

struct WatchSessionModel: Codable, Identifiable, Equatable {
    var id: String { sessionId }

    /// Matches the `sessionId` in the iPhone session store.
    let sessionId: String

    /// Display name of the timer stack.
    let stackName: String

    /// Label of the currently active segment.
    let activeSegmentName: String

    /// Total duration of the active segment in ms — needed for progress calculation.
    let activeSegmentDurationMs: Double

    /// Remaining time for the active segment at `lastUpdatedAt`.
    /// For completed/idle sessions this is 0.
    let activeSegmentRemainingMs: Double

    /// Remaining time for the entire stack at `lastUpdatedAt`.
    /// For completed/idle sessions this is 0.
    let totalRemainingMs: Double

    let status: WatchSessionStatus

    /// 0-based index of the active segment.
    let activeSegmentIndex: Int

    /// Total number of segments in this stack.
    let totalSegments: Int

    /// Unix milliseconds when this snapshot was created on the iPhone.
    /// The watch uses (now − lastUpdatedAt) as the elapsed time to subtract
    /// from the snapshot remaining values, giving accurate countdowns without
    /// the iPhone needing to push an update every second.
    let lastUpdatedAt: Double
}

// MARK: - Live interpolation

extension WatchSessionModel {

    // -------------------------------------------------------------------------
    // liveSegmentRemainingMs
    //
    // Status contract:
    //   .running   → interpolate downward from snapshot using wall-clock elapsed
    //   .paused    → return raw snapshot (timer is frozen; no elapsed time)
    //   .completed → always 0 (segment is finished)
    //   .idle      → always 0 (no session active)
    //
    // All results are clamped to [0, ∞). Negative values arise when the phone
    // delays sending a snapshot past the natural segment end; clamping hides
    // that lag cleanly.
    // -------------------------------------------------------------------------

    /// Wall-clock accurate remaining time for the active segment in milliseconds.
    func liveSegmentRemainingMs(now: Double = Date().msecSince1970) -> Double {
        switch status {
        case .idle, .completed:
            // Terminal states: nothing is running; always show zero.
            return 0
        case .paused:
            // Timer is frozen. Return the snapshot value — no interpolation.
            // Clamped in case the iPhone sent a near-zero value that went
            // slightly negative before pausing.
            return max(0, activeSegmentRemainingMs)
        case .running:
            // Subtract wall-clock elapsed since snapshot was taken.
            // Clamp to 0 so the display never shows negative time, even if
            // the iPhone is slow to deliver the segment-end snapshot.
            return max(0, activeSegmentRemainingMs - (now - lastUpdatedAt))
        }
    }

    // -------------------------------------------------------------------------
    // liveTotalRemainingMs — same contract as liveSegmentRemainingMs.
    // -------------------------------------------------------------------------

    /// Wall-clock accurate remaining time for the full stack in milliseconds.
    func liveTotalRemainingMs(now: Double = Date().msecSince1970) -> Double {
        switch status {
        case .idle, .completed:
            return 0
        case .paused:
            return max(0, totalRemainingMs)
        case .running:
            return max(0, totalRemainingMs - (now - lastUpdatedAt))
        }
    }

    // -------------------------------------------------------------------------
    // liveSegmentProgress
    //
    //   .idle      → 0   (no segment active)
    //   .completed → 1   (segment fully consumed)
    //   .running/.paused → derived from liveSegmentRemainingMs / duration
    //
    // Returns 0 if activeSegmentDurationMs is zero (prevents division by zero).
    // -------------------------------------------------------------------------

    /// Progress within the active segment (0 = just started, 1 = complete).
    func liveSegmentProgress(now: Double = Date().msecSince1970) -> Double {
        switch status {
        case .idle:
            return 0
        case .completed:
            return 1
        case .running, .paused:
            guard activeSegmentDurationMs > 0 else { return 0 }
            let remaining = liveSegmentRemainingMs(now: now)
            return max(0, min(1, 1.0 - remaining / activeSegmentDurationMs))
        }
    }
}

// MARK: - Date helper

extension Date {
    /// Unix time in milliseconds — matches `Date.now()` in JavaScript.
    var msecSince1970: Double { timeIntervalSince1970 * 1_000 }
}

// MARK: - WCSession message keys

/// Keep in sync with `WatchMessageKey` in apps/mobile/src/lib/watchConnectivity.ts
enum WatchMessageKey {
    static let session   = "ts_watch_session"   // JSON-encoded WatchSessionModel
    static let action    = "ts_watch_action"    // WatchAction.rawValue string
    static let sessionId = "ts_session_id"      // String
}
