// ---------------------------------------------------------------------------
// ActiveSessionView.swift — Primary timer UI for the Apple Watch.
//
// Design principles:
//   • Glanceable at a glance — readable during a workout without stopping.
//   • TimelineView(.periodic) drives the 1-second tick; no manual timers.
//   • Haptics fire through .onChange observers — NOT on every tick.
//   • One large primary control (pause/resume) + two smaller (skip, stop).
//   • All layout fits without scrolling on watchOS 10 / 41mm and larger.
//
// Haptic deduplication strategy:
//   • Segment haptic: fires when session.activeSegmentIndex changes AND
//     the new value differs from lastSegmentIndex (double-guard).
//   • Completion haptic: fires only once per session via didFireCompletion.
//   • Both state vars reset when session.sessionId changes, so back-to-back
//     sessions each get their own independent haptic lifecycle.
//
// Data flow:
//   WatchConnectivityManager.currentSession ──▶ ActiveSessionView
//                                      ◀── sendAction(_:)
// ---------------------------------------------------------------------------

import SwiftUI
import WatchKit

struct ActiveSessionView: View {
    let session: WatchSessionModel
    @EnvironmentObject var manager: WatchConnectivityManager

    // MARK: - Haptic state

    // Initialized from session to avoid a spurious haptic on first render.
    @State private var lastSegmentIndex: Int
    // Prevents the completion haptic from re-firing if the view rebuilds
    // while status is still .completed.
    @State private var didFireCompletion = false
    // Tracks the session whose haptic lifecycle is currently active.
    // When this changes, both of the above are reset.
    @State private var trackedSessionId: String

    init(session: WatchSessionModel) {
        self.session = session
        _lastSegmentIndex = State(initialValue: session.activeSegmentIndex)
        _didFireCompletion = State(initialValue: false)
        _trackedSessionId  = State(initialValue: session.sessionId)
    }

    // MARK: - Body

    var body: some View {
        TimelineView(.periodic(from: .now, by: 1)) { context in
            let now = context.date.msecSince1970
            layout(now: now)
        }
        // ── Reset haptic state when a different session becomes active ──────
        // Without this, if session A completes and session B starts while the
        // same ActiveSessionView instance is still in the view tree, session B's
        // completion haptic would never fire (didFireCompletion is still true).
        .onChange(of: session.sessionId) { _, newSessionId in
            trackedSessionId  = newSessionId
            lastSegmentIndex  = session.activeSegmentIndex
            didFireCompletion = false
        }
        // ── Haptic: segment advanced ─────────────────────────────────────────
        // .onChange fires only when activeSegmentIndex actually changes value,
        // not on every TimelineView tick — so this is not a polling loop.
        // The guard against lastSegmentIndex is a belt-and-suspenders check
        // for the rare case of a duplicate onChange delivery.
        .onChange(of: session.activeSegmentIndex) { _, newIndex in
            guard newIndex != lastSegmentIndex else { return }
            lastSegmentIndex = newIndex
            HapticsManager.segmentComplete()
        }
        // ── Haptic: stack completed ──────────────────────────────────────────
        // didFireCompletion ensures this fires exactly once per session,
        // even if the view re-renders multiple times with status == .completed.
        .onChange(of: session.status) { _, newStatus in
            if newStatus == .completed, !didFireCompletion {
                didFireCompletion = true
                HapticsManager.stackComplete()
            }
        }
    }

    // MARK: - Layout

    @ViewBuilder
    private func layout(now: Double) -> some View {
        let segRemaining  = session.liveSegmentRemainingMs(now: now)
        let totalRemaining = session.liveTotalRemainingMs(now: now)
        let segProgress   = session.liveSegmentProgress(now: now)
        let isPaused      = session.status == .paused

        VStack(spacing: 0) {

            // ── Header: stack name + segment counter ─────────────────────────
            VStack(spacing: 1) {
                Text(session.stackName)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)

                Text("\(session.activeSegmentIndex + 1) of \(session.totalSegments)")
                    .font(.system(size: 10))
                    .foregroundStyle(.tertiary)
            }
            .padding(.top, 3)

            Spacer(minLength: 3)

            // ── Segment name ─────────────────────────────────────────────────
            Text(session.activeSegmentName)
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(.primary)
                .lineLimit(1)
                .minimumScaleFactor(0.7)

            // ── Big countdown ────────────────────────────────────────────────
            Text(formatMs(segRemaining))
                .font(.system(size: 40, weight: .bold, design: .monospaced))
                .foregroundStyle(isPaused ? .secondary : .primary)
                .contentTransition(.numericText(countsDown: true))
                .animation(.linear(duration: 0.15), value: segRemaining)
                .padding(.top, 1)

            // ── Segment progress bar ─────────────────────────────────────────
            SessionProgressBar(progress: segProgress)
                .frame(height: 4)
                .padding(.horizontal, 10)
                .padding(.vertical, 5)

            // ── Total remaining ──────────────────────────────────────────────
            Text(formatMs(totalRemaining) + " remaining")
                .font(.system(size: 10))
                .foregroundStyle(.tertiary)

            Spacer(minLength: 5)

            // ── Controls ─────────────────────────────────────────────────────
            ControlsRow(isPaused: isPaused)
                .padding(.bottom, 3)
        }
        .padding(.horizontal, 4)
    }
}

// MARK: - Controls row

private struct ControlsRow: View {
    let isPaused: Bool
    @EnvironmentObject var manager: WatchConnectivityManager

    var body: some View {
        HStack(spacing: 8) {

            // Skip — smaller, left
            WatchControlButton(icon: "forward.fill", tint: .secondary, size: .small) {
                HapticsManager.buttonTap()
                manager.sendAction(.skipSegment)
            }

            // Pause / Resume — large, centre
            WatchControlButton(
                icon: isPaused ? "play.fill" : "pause.fill",
                tint: isPaused ? .green : .yellow,
                size: .large
            ) {
                HapticsManager.buttonTap()
                manager.sendAction(isPaused ? .resume : .pause)
            }

            // Stop — smaller, right
            WatchControlButton(icon: "stop.fill", tint: .red, size: .small) {
                HapticsManager.destructiveAction()
                manager.sendAction(.stopSession)
            }
        }
    }
}

// MARK: - Button

private enum ButtonSize { case small, large }

private struct WatchControlButton: View {
    let icon: String
    let tint: Color
    let size: ButtonSize
    let action: () -> Void

    private var diameter: CGFloat { size == .large ? 44 : 34 }
    private var iconSize:  CGFloat { size == .large ? 17 : 13 }

    var body: some View {
        Button(action: action) {
            Image(systemName: icon)
                .font(.system(size: iconSize, weight: .semibold))
                .foregroundStyle(tint)
                .frame(width: diameter, height: diameter)
                .background(.ultraThinMaterial, in: Circle())
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Progress bar

private struct SessionProgressBar: View {
    let progress: Double // 0…1

    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .leading) {
                Capsule()
                    .fill(.secondary.opacity(0.2))
                Capsule()
                    .fill(.primary.opacity(0.8))
                    .frame(width: geo.size.width * progress)
                    .animation(.linear(duration: 0.5), value: progress)
            }
        }
    }
}

// MARK: - Time formatter

private func formatMs(_ ms: Double) -> String {
    let total = max(0, Int(ms / 1_000))
    let h = total / 3_600
    let m = (total % 3_600) / 60
    let s = total % 60
    return h > 0
        ? String(format: "%d:%02d:%02d", h, m, s)
        : String(format: "%d:%02d", m, s)
}

// MARK: - Previews

#Preview("Running") {
    ActiveSessionView(session: PreviewData.runningSession)
        .environmentObject(PreviewData.connectivityManager)
}

#Preview("Paused") {
    ActiveSessionView(session: PreviewData.pausedSession)
        .environmentObject(PreviewData.connectivityManager)
}

#Preview("Nearly done") {
    ActiveSessionView(session: PreviewData.nearlyDoneSession)
        .environmentObject(PreviewData.connectivityManager)
}
