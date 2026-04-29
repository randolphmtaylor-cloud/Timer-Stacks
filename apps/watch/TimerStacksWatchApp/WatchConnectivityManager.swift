// ---------------------------------------------------------------------------
// WatchConnectivityManager.swift
//
// WatchConnectivity bridge between the iPhone app and the watch.
//
// RESPONSIBILITIES
// ────────────────
// • Receive WatchSessionModel snapshots from the iPhone (both delivery paths)
// • Publish currentSession so SwiftUI views stay reactive
// • Send WatchAction commands back to the iPhone
// • Expose connectionStatus for idle-state UI
//
// DELIVERY PATHS (iPhone → Watch)
// ─────────────────────────────────
// 1. sendMessage        — real-time; requires iPhone to be reachable
// 2. updateApplicationContext — background; replaces previous context; delivered
//                          on next wake (last-value-wins)
//
// Both paths are handled identically in receiveSessionUpdate.
//
// DELIVERY PATHS (Watch → iPhone)
// ─────────────────────────────────
// 1. sendMessage        — used when iPhone is reachable (preferred)
// 2. transferUserInfo   — queued delivery fallback when not reachable
//
// IMPORTANT: after the iPhone applies a WatchAction, it MUST push a fresh
// snapshot to the watch so the display reflects the new state. The watch
// has no way to derive the post-action state on its own.
//
// iPhone-side counterpart:
//   apps/mobile/src/lib/watchConnectivity.ts  (IWatchConnectivityBridge)
// ---------------------------------------------------------------------------

import Foundation
import WatchConnectivity

@MainActor
final class WatchConnectivityManager: NSObject, ObservableObject {

    // MARK: - Public state

    /// The most recently received session snapshot.
    /// Nil when no session is active or before the first update from the iPhone.
    @Published private(set) var currentSession: WatchSessionModel?

    /// Reflects WCSession activation + reachability state.
    @Published private(set) var connectionStatus: ConnectionStatus = .notActivated

    // MARK: - Connection status

    enum ConnectionStatus: Equatable {
        case notActivated   // WCSession not yet activated
        case activated      // Activated, phone not currently reachable
        case reachable      // Phone reachable for real-time sendMessage
        case notReachable   // Was reachable; phone backgrounded or out of range
    }

    // MARK: - Init

    override init() {
        super.init()
        guard WCSession.isSupported() else { return }
        WCSession.default.delegate = self
        WCSession.default.activate()
    }

    // MARK: - Send action to iPhone

    /// Sends a control command to the paired iPhone app.
    ///
    /// Preferred path: `sendMessage` when iPhone is reachable (instant).
    /// Fallback path:  `transferUserInfo` when iPhone is not reachable (queued).
    ///
    /// NOTE: Timing-sensitive actions (pause, resume) delivered via
    /// transferUserInfo may arrive seconds or minutes late. The iPhone MUST
    /// send a fresh snapshot immediately after applying any action so the
    /// watch display stays consistent with the true session state.
    func sendAction(_ action: WatchAction) {
        guard let sessionId = currentSession?.sessionId else {
            print("[WatchConnectivity] sendAction(\(action.rawValue)): no current session, ignored")
            return
        }

        let payload: [String: Any] = [
            WatchMessageKey.action: action.rawValue,
            WatchMessageKey.sessionId: sessionId,
        ]

        if WCSession.default.isReachable {
            // Real-time path — phone is in foreground and reachable.
            WCSession.default.sendMessage(payload, replyHandler: nil) { error in
                print("[WatchConnectivity] sendAction(\(action.rawValue)) error: \(error.localizedDescription)")
            }
        } else {
            // Queued fallback — delivered when the phone next becomes reachable.
            // transferUserInfo guarantees eventual delivery (unlike sendMessage
            // which simply errors when not reachable).
            WCSession.default.transferUserInfo(payload)
            print("[WatchConnectivity] sendAction(\(action.rawValue)) queued via transferUserInfo (phone not reachable)")
        }
    }

    // MARK: - Receive session update

    /// Applies an incoming snapshot.
    ///
    /// Rejects snapshots whose `lastUpdatedAt` is older than the current one.
    /// This guards against out-of-order delivery — `transferUserInfo` messages
    /// can arrive in a different order than they were sent.
    func receiveSessionUpdate(_ incoming: WatchSessionModel) {
        if let existing = currentSession {
            guard incoming.lastUpdatedAt >= existing.lastUpdatedAt else {
                print("[WatchConnectivity] Dropping stale snapshot for \(incoming.sessionId) "
                    + "(incoming: \(incoming.lastUpdatedAt), current: \(existing.lastUpdatedAt))")
                return
            }
        }
        currentSession = incoming
    }

    // MARK: - Decode helper

    /// nonisolated so it can be called from WCSessionDelegate callbacks,
    /// which are dispatched on an arbitrary background thread.
    /// Only accesses its parameter — no main-actor state.
    nonisolated private func decodeSession(from dict: [String: Any]) -> WatchSessionModel? {
        guard let raw = dict[WatchMessageKey.session] as? String,
              let data = raw.data(using: .utf8) else { return nil }
        return try? JSONDecoder().decode(WatchSessionModel.self, from: data)
    }
}

// MARK: - WCSessionDelegate

extension WatchConnectivityManager: WCSessionDelegate {

    nonisolated func session(
        _ session: WCSession,
        activationDidCompleteWith activationState: WCSessionActivationState,
        error: Error?
    ) {
        Task { @MainActor in
            self.connectionStatus = activationState == .activated
                ? (session.isReachable ? .reachable : .activated)
                : .notActivated
        }
    }

    nonisolated func sessionReachabilityDidChange(_ session: WCSession) {
        Task { @MainActor in
            self.connectionStatus = session.isReachable ? .reachable : .notReachable
        }
    }

    /// Real-time delivery — phone is foregrounded and reachable.
    nonisolated func session(
        _ session: WCSession,
        didReceiveMessage message: [String: Any]
    ) {
        guard let model = decodeSession(from: message) else { return }
        Task { @MainActor in self.receiveSessionUpdate(model) }
    }

    /// Background delivery — used when the phone is not immediately reachable,
    /// or when the watch wakes and receives queued updateApplicationContext updates.
    nonisolated func session(
        _ session: WCSession,
        didReceiveApplicationContext applicationContext: [String: Any]
    ) {
        guard let model = decodeSession(from: applicationContext) else { return }
        Task { @MainActor in self.receiveSessionUpdate(model) }
    }

    /// Queued userInfo delivery — sent by the iPhone via transferUserInfo when
    /// the watch was not reachable. May arrive out of order.
    /// receiveSessionUpdate handles the staleness check.
    nonisolated func session(
        _ session: WCSession,
        didReceiveUserInfo userInfo: [String: Any]
    ) {
        guard let model = decodeSession(from: userInfo) else { return }
        Task { @MainActor in self.receiveSessionUpdate(model) }
    }
}
