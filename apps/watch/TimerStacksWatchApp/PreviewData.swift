// ---------------------------------------------------------------------------
// PreviewData.swift
//
// Static preview fixtures for SwiftUI Previews and snapshot tests.
// These are the only place hardcoded session data should appear.
//
// Usage in previews:
//   ActiveSessionView(session: PreviewData.runningSession)
//     .environmentObject(PreviewData.connectivityManager)
// ---------------------------------------------------------------------------

import Foundation

enum PreviewData {

    // MARK: - Session snapshots

    /// A running session mid-way through the second segment.
    static let runningSession = WatchSessionModel(
        sessionId: "preview-running",
        stackName: "Morning Practice",
        activeSegmentName: "Focused Work",
        activeSegmentDurationMs: 25 * 60 * 1_000,   // 25 min
        activeSegmentRemainingMs: 18 * 60 * 1_000,  // 18 min left
        totalRemainingMs: 43 * 60 * 1_000,           // 43 min total left
        status: .running,
        activeSegmentIndex: 1,
        totalSegments: 4,
        lastUpdatedAt: Date().msecSince1970
    )

    /// A paused session.
    static let pausedSession = WatchSessionModel(
        sessionId: "preview-paused",
        stackName: "Morning Practice",
        activeSegmentName: "Focused Work",
        activeSegmentDurationMs: 25 * 60 * 1_000,
        activeSegmentRemainingMs: 12 * 60 * 1_000 + 30 * 1_000,
        totalRemainingMs: 37 * 60 * 1_000 + 30 * 1_000,
        status: .paused,
        activeSegmentIndex: 1,
        totalSegments: 4,
        lastUpdatedAt: Date().msecSince1970
    )

    /// The final segment with under a minute remaining.
    static let nearlyDoneSession = WatchSessionModel(
        sessionId: "preview-nearly-done",
        stackName: "HIIT Circuit",
        activeSegmentName: "Cool-down",
        activeSegmentDurationMs: 5 * 60 * 1_000,
        activeSegmentRemainingMs: 45 * 1_000,
        totalRemainingMs: 45 * 1_000,
        status: .running,
        activeSegmentIndex: 4,
        totalSegments: 5,
        lastUpdatedAt: Date().msecSince1970
    )

    /// A completed session — used to preview the completion state.
    static let completedSession = WatchSessionModel(
        sessionId: "preview-completed",
        stackName: "Morning Practice",
        activeSegmentName: "Cool-down",
        activeSegmentDurationMs: 5 * 60 * 1_000,
        activeSegmentRemainingMs: 0,
        totalRemainingMs: 0,
        status: .completed,
        activeSegmentIndex: 3,
        totalSegments: 4,
        lastUpdatedAt: Date().msecSince1970
    )

    // MARK: - Manager pre-loaded with preview data

    /// A WatchConnectivityManager seeded with preview data for use in previews.
    /// Does not activate WCSession — safe to use in Xcode Previews.
    @MainActor
    static var connectivityManager: WatchConnectivityManager {
        let manager = WatchConnectivityManager()
        manager.receiveSessionUpdate(runningSession)
        return manager
    }
}
