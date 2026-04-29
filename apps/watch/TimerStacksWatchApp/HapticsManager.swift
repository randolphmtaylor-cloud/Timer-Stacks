// ---------------------------------------------------------------------------
// HapticsManager.swift
//
// Centralised haptic feedback for the watch app.
// All calls go through WKInterfaceDevice.current().play(_:) which maps to
// the Apple Watch Taptic Engine.
//
// Usage:
//   HapticsManager.segmentComplete()   // call when a segment ends
//   HapticsManager.stackComplete()     // call when the full stack finishes
//   HapticsManager.buttonTap()         // call on any control button press
// ---------------------------------------------------------------------------

import WatchKit

enum HapticsManager {

    // MARK: - Event haptics

    /// Fired when the active segment ends and the next begins.
    /// Uses a crisp "click" — noticeable but not disruptive mid-workout.
    static func segmentComplete() {
        WKInterfaceDevice.current().play(.click)
    }

    /// Fired when the last segment in the stack completes.
    /// Uses "success" — a longer, celebratory pattern.
    static func stackComplete() {
        WKInterfaceDevice.current().play(.success)
    }

    // MARK: - UI haptics

    /// Fired on any control button tap (pause, resume, skip, stop).
    /// Subtle confirmation without overshadowing event haptics.
    static func buttonTap() {
        WKInterfaceDevice.current().play(.click)
    }

    /// Fired when the user taps Stop — slightly stronger to signal a destructive action.
    static func destructiveAction() {
        WKInterfaceDevice.current().play(.failure)
    }
}
