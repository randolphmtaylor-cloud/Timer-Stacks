// ---------------------------------------------------------------------------
// WatchConnectivityBridge.swift
//
// Native Swift implementation of the WatchConnectivity iPhone side.
//
// RESPONSIBILITIES
// ─────────────────
// • Activate WCSession.default on app launch.
// • Send pre-computed WatchSessionSnapshot JSON to the paired Apple Watch.
// • Receive WatchAction strings from the watch and forward them to JS.
//
// DELIVERY MODEL (iPhone → Watch)
// ─────────────────────────────────
// • isReachable  → sendMessage (real-time, watch in foreground)
// • not reachable → updateApplicationContext (last-value-wins, background)
//
// DELIVERY MODEL (Watch → iPhone)
// ─────────────────────────────────
// • didReceiveMessage    — watch sent an action while phone was reachable
// • didReceiveUserInfo   — watch used transferUserInfo as queued fallback
//
// This file exposes a React Native module via RCT_EXTERN_MODULE so the
// TypeScript bridge in watchConnectivity.ts can call it directly.
//
// Counterpart files:
//   apps/watch/TimerStacksWatchApp/WatchConnectivityManager.swift
//   apps/mobile/src/lib/watchConnectivity.ts
// ---------------------------------------------------------------------------

import Foundation
import WatchConnectivity

// WatchMessageKey constants — MUST match WatchMessageKey.swift on the watch
private enum WatchMessageKey {
  static let session   = "ts_watch_session"  // JSON-encoded snapshot (iPhone → Watch)
  static let action    = "ts_watch_action"   // WatchAction string   (Watch → iPhone)
  static let sessionId = "ts_session_id"     // Session ID string    (Watch → iPhone)
}

@objc(WatchConnectivityBridge)
final class WatchConnectivityBridge: RCTEventEmitter, WCSessionDelegate {

  // MARK: - RCTEventEmitter

  override static func requiresMainQueueSetup() -> Bool { true }

  override func supportedEvents() -> [String]! {
    ["watchAction"]
  }

  // MARK: - Init

  override init() {
    super.init()
    guard WCSession.isSupported() else { return }
    WCSession.default.delegate = self
    WCSession.default.activate()
  }

  // MARK: - JS-callable methods

  /// Send a pre-computed session snapshot to the paired watch.
  /// `snapshotJSON` — the JSON string produced by buildWatchSnapshot() in TS.
  @objc func sendSessionSnapshot(_ snapshotJSON: String,
                                 resolver resolve: @escaping RCTPromiseResolveBlock,
                                 rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard WCSession.default.activationState == .activated else {
      reject("NOT_ACTIVATED", "WCSession is not activated", nil)
      return
    }

    let payload: [String: Any] = [WatchMessageKey.session: snapshotJSON]

    if WCSession.default.isReachable {
      WCSession.default.sendMessage(payload, replyHandler: nil) { error in
        // sendMessage failed (watch backgrounded between check and send).
        // Fall back to application context so the watch gets it on next wake.
        self.updateContext(payload)
      }
    } else {
      updateContext(payload)
    }
    resolve(nil)
  }

  /// Returns whether the watch is currently reachable for real-time messaging.
  @objc func isReachable(_ resolve: RCTPromiseResolveBlock,
                         rejecter reject: RCTPromiseRejectBlock) {
    let reachable = WCSession.isSupported()
      && WCSession.default.activationState == .activated
      && WCSession.default.isReachable
    resolve(reachable)
  }

  // MARK: - Context helper

  private func updateContext(_ payload: [String: Any]) {
    do {
      try WCSession.default.updateApplicationContext(payload)
    } catch {
      print("[WatchConnectivityBridge] updateApplicationContext failed: \(error.localizedDescription)")
    }
  }

  // MARK: - WCSessionDelegate — activation

  func session(_ session: WCSession,
               activationDidCompleteWith activationState: WCSessionActivationState,
               error: Error?) {
    if let error = error {
      print("[WatchConnectivityBridge] Activation failed: \(error.localizedDescription)")
    }
  }

  func sessionDidBecomeInactive(_ session: WCSession) {}
  func sessionDidDeactivate(_ session: WCSession) {
    // Re-activate after the old watch was swapped out (e.g. watch upgrade).
    WCSession.default.activate()
  }

  // MARK: - WCSessionDelegate — receiving actions from the watch

  func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
    forwardAction(from: message)
  }

  func session(_ session: WCSession,
               didReceiveMessage message: [String: Any],
               replyHandler: @escaping ([String: Any]) -> Void) {
    forwardAction(from: message)
    replyHandler([:])
  }

  func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any]) {
    forwardAction(from: userInfo)
  }

  // MARK: - Action forwarding

  private func forwardAction(from dict: [String: Any]) {
    guard
      let action    = dict[WatchMessageKey.action]    as? String,
      let sessionId = dict[WatchMessageKey.sessionId] as? String
    else { return }

    sendEvent(withName: "watchAction", body: [
      "action": action,
      "sessionId": sessionId,
    ])
  }
}
