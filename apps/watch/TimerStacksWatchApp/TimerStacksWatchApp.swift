// ---------------------------------------------------------------------------
// TimerStacksWatchApp.swift — watchOS app entry point.
//
// Creates the single WatchConnectivityManager instance and injects it into
// the environment so every view in the hierarchy can read session state and
// send actions without prop-drilling.
// ---------------------------------------------------------------------------

import SwiftUI

@main
struct TimerStacksWatchApp: App {

    @StateObject private var connectivityManager = WatchConnectivityManager()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(connectivityManager)
        }
    }
}
