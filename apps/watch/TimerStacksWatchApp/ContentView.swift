// ---------------------------------------------------------------------------
// ContentView.swift — Root view / navigation router.
//
// Decides which top-level view to render based on session state:
//
//   ┌─ ActiveSessionView  when status == .running or .paused
//   │
//   ├─ CompletionView     when status == .completed
//   │
//   └─ IdleView           when no session / status == .idle
//
// All business logic lives in WatchConnectivityManager and WatchSessionModel.
// This file only contains routing and the two simple non-session states.
// ---------------------------------------------------------------------------

import SwiftUI

struct ContentView: View {
    @EnvironmentObject var manager: WatchConnectivityManager

    var body: some View {
        Group {
            if let session = manager.currentSession {
                switch session.status {
                case .running, .paused:
                    ActiveSessionView(session: session)
                case .completed:
                    CompletionView(stackName: session.stackName)
                case .idle:
                    IdleView(connectionStatus: manager.connectionStatus)
                }
            } else {
                IdleView(connectionStatus: manager.connectionStatus)
            }
        }
        .animation(.easeInOut(duration: 0.25), value: manager.currentSession?.status)
    }
}

// MARK: - Idle view

struct IdleView: View {
    let connectionStatus: WatchConnectivityManager.ConnectionStatus

    var body: some View {
        VStack(spacing: 10) {
            Image(systemName: "timer")
                .font(.system(size: 30))
                .foregroundStyle(.secondary)

            Text("Timer Stacks")
                .font(.headline)

            Text(subtitle)
                .font(.caption2)
                .foregroundStyle(.tertiary)
                .multilineTextAlignment(.center)
        }
        .padding()
    }

    private var subtitle: String {
        switch connectionStatus {
        case .reachable:        return "Start a stack on your iPhone"
        case .activated:        return "Open the Timer Stacks iPhone app"
        case .notReachable:     return "iPhone not reachable"
        case .notActivated:     return "Waiting for connection…"
        }
    }
}

// MARK: - Completion view

struct CompletionView: View {
    let stackName: String

    var body: some View {
        VStack(spacing: 8) {
            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 34))
                .foregroundStyle(.green)

            Text("Done!")
                .font(.title3.bold())

            Text(stackName)
                .font(.caption)
                .foregroundStyle(.secondary)
                .lineLimit(2)
                .multilineTextAlignment(.center)
        }
        .padding()
    }
}

// MARK: - Previews

#Preview("Idle — reachable") {
    IdleView(connectionStatus: .reachable)
}

#Preview("Idle — not activated") {
    IdleView(connectionStatus: .notActivated)
}

#Preview("Completion") {
    CompletionView(stackName: "Morning Practice")
}
