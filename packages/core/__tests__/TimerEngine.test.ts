import { describe, it, expect } from 'vitest';
import type { TimerStack } from '../src/types/stack.js';
import type { Session } from '../src/types/session.js';
import {
  computeSessionState,
  startSession,
  pauseSession,
  resumeSession,
  resetSession,
  skipSegment,
  resetSegment,
  previousSegment,
  tickSession,
} from '../src/engine/TimerEngine.js';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

function makeStack(segmentMinutes: number[]): TimerStack {
  const segments = segmentMinutes.map((m, i) => ({
    segmentId: `seg-${i}`,
    label: `Segment ${i + 1}`,
    durationMs: m * 60_000,
  }));
  return {
    stackId: 'stack-1',
    name: 'Test Stack',
    totalDurationMs: segments.reduce((a, s) => a + s.durationMs, 0),
    segments,
    isTemplate: false,
    createdAt: 0,
    updatedAt: 0,
  };
}

function makeIdleSession(): Session {
  return {
    sessionId: 'session-1',
    stackId: 'stack-1',
    stackName: 'Test Stack',
    status: 'idle',
    startedAt: null,
    pausedAt: null,
    totalPausedMs: 0,
    activeSegmentIndex: 0,
    completedSegmentsElapsedMs: 0,
    segmentTransitions: [],
    completedAt: null,
  };
}

const T0 = 1_000_000; // baseline timestamp

// ---------------------------------------------------------------------------
// startSession
// ---------------------------------------------------------------------------

describe('startSession', () => {
  it('transitions idle → running', () => {
    const session = startSession(makeIdleSession(), T0);
    expect(session.status).toBe('running');
    expect(session.startedAt).toBe(T0);
    expect(session.pausedAt).toBe(null);
    expect(session.totalPausedMs).toBe(0);
  });

  it('is a no-op when already running', () => {
    const running = startSession(makeIdleSession(), T0);
    const again = startSession(running, T0 + 1000);
    expect(again.startedAt).toBe(T0); // unchanged
  });
});

// ---------------------------------------------------------------------------
// pauseSession / resumeSession
// ---------------------------------------------------------------------------

describe('pause / resume', () => {
  it('records pausedAt when pausing', () => {
    const session = startSession(makeIdleSession(), T0);
    const paused = pauseSession(session, T0 + 5000);
    expect(paused.status).toBe('paused');
    expect(paused.pausedAt).toBe(T0 + 5000);
  });

  it('accumulates totalPausedMs across multiple pause intervals', () => {
    let session = startSession(makeIdleSession(), T0);
    // Pause 1: 3 seconds
    session = pauseSession(session, T0 + 10_000);
    session = resumeSession(session, T0 + 13_000);
    expect(session.totalPausedMs).toBe(3000);
    // Pause 2: 7 seconds
    session = pauseSession(session, T0 + 20_000);
    session = resumeSession(session, T0 + 27_000);
    expect(session.totalPausedMs).toBe(10_000);
  });

  it('paused session does not advance elapsed', () => {
    const stack = makeStack([10]); // 10-minute stack
    let session = startSession(makeIdleSession(), T0);
    session = pauseSession(session, T0 + 60_000); // paused at 1 min

    // Even 100 seconds later, elapsed is still 60s
    const stateAt100 = computeSessionState(session, stack, T0 + 160_000);
    expect(stateAt100.totalElapsedMs).toBe(60_000);
  });
});

// ---------------------------------------------------------------------------
// resetSession
// ---------------------------------------------------------------------------

describe('resetSession', () => {
  it('resets all fields back to idle', () => {
    let session = startSession(makeIdleSession(), T0);
    session = pauseSession(session, T0 + 5000);
    const reset = resetSession(session);
    expect(reset.status).toBe('idle');
    expect(reset.startedAt).toBe(null);
    expect(reset.totalPausedMs).toBe(0);
    expect(reset.activeSegmentIndex).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// computeSessionState
// ---------------------------------------------------------------------------

describe('computeSessionState', () => {
  it('computes correct segment elapsed at mid-point', () => {
    const stack = makeStack([10, 20]); // 10m + 20m = 30m
    const session = startSession(makeIdleSession(), T0);
    // 5 minutes into first segment
    const state = computeSessionState(session, stack, T0 + 5 * 60_000);
    expect(state.totalElapsedMs).toBe(5 * 60_000);
    expect(state.segmentElapsedMs).toBe(5 * 60_000);
    expect(state.segmentRemainingMs).toBe(5 * 60_000);
    expect(state.segmentProgress).toBeCloseTo(0.5, 5);
    expect(state.stackProgress).toBeCloseTo(5 / 30, 5);
  });

  it('identifies second segment correctly', () => {
    const stack = makeStack([5, 10]); // 5m + 10m
    const session = startSession(makeIdleSession(), T0);
    // 6 minutes in → 1 minute into segment 2
    const state = computeSessionState(session, stack, T0 + 6 * 60_000);
    expect(state.segmentElapsedMs).toBe(1 * 60_000);
    expect(state.segmentRemainingMs).toBe(9 * 60_000);
    expect(state.stackRemainingMs).toBe(9 * 60_000);
  });

  it('clamps progress to 0–1', () => {
    const stack = makeStack([5]);
    const session = startSession(makeIdleSession(), T0);
    // Way past the end
    const state = computeSessionState(session, stack, T0 + 999 * 60_000);
    expect(state.segmentProgress).toBe(1);
    expect(state.stackProgress).toBe(1);
    expect(state.stackRemainingMs).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// tickSession
// ---------------------------------------------------------------------------

describe('tickSession', () => {
  it('emits segment_completed and segment_started on transition', () => {
    const stack = makeStack([5, 5]);
    let session = startSession(makeIdleSession(), T0);
    // Simulate time jumping exactly past the first segment
    const { events } = tickSession(session, stack, T0 + 5 * 60_000 + 100);
    const types = events.map((e) => e.type);
    expect(types).toContain('segment_completed');
    expect(types).toContain('segment_started');
  });

  it('emits stack_completed when all segments elapse', () => {
    const stack = makeStack([5, 5]);
    const session = startSession(makeIdleSession(), T0);
    const { session: ended, events } = tickSession(session, stack, T0 + 10 * 60_000 + 1000);
    expect(ended.status).toBe('completed');
    expect(events.some((e) => e.type === 'stack_completed')).toBe(true);
  });

  it('emits missed segment completions before stack completion after a large time jump', () => {
    const stack = makeStack([5, 5, 5]);
    const session = startSession(makeIdleSession(), T0);
    const { events } = tickSession(session, stack, T0 + 20 * 60_000);

    expect(events.map((e) => e.type)).toEqual([
      'segment_completed',
      'segment_completed',
      'segment_completed',
      'stack_completed',
    ]);
  });

  it('returns no events for idle session', () => {
    const stack = makeStack([5]);
    const session = makeIdleSession();
    const { events } = tickSession(session, stack, T0 + 10_000);
    expect(events).toHaveLength(0);
  });

  it('does not advance paused session', () => {
    const stack = makeStack([5]);
    let session = startSession(makeIdleSession(), T0);
    session = pauseSession(session, T0 + 1000);
    const { session: after, events } = tickSession(session, stack, T0 + 500_000);
    expect(events).toHaveLength(0);
    expect(after.status).toBe('paused');
  });
});

// ---------------------------------------------------------------------------
// skipSegment
// ---------------------------------------------------------------------------

describe('skipSegment', () => {
  it('advances to the next segment', () => {
    const stack = makeStack([5, 10, 5]);
    let session = startSession(makeIdleSession(), T0);
    const { session: skipped, events } = skipSegment(session, stack, T0 + 1000);
    expect(skipped.activeSegmentIndex).toBe(1);
    expect(events.some((e) => e.type === 'stack_skipped')).toBe(true);
  });

  it('completes the stack when skipping the last segment', () => {
    const stack = makeStack([5]);
    let session = startSession(makeIdleSession(), T0);
    const { session: done, events } = skipSegment(session, stack, T0 + 1000);
    expect(done.status).toBe('completed');
    expect(events.some((e) => e.type === 'stack_completed')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// resetSegment / previousSegment
// ---------------------------------------------------------------------------

describe('segment navigation', () => {
  it('resets the active segment while preserving running status', () => {
    const stack = makeStack([5, 10]);
    let session = startSession(makeIdleSession(), T0);
    session = tickSession(session, stack, T0 + 6 * 60_000).session;

    const { session: reset } = resetSegment(session, stack, T0 + 7 * 60_000);
    const state = computeSessionState(reset, stack, T0 + 7 * 60_000);

    expect(reset.status).toBe('running');
    expect(reset.activeSegmentIndex).toBe(1);
    expect(state.totalElapsedMs).toBe(5 * 60_000);
    expect(state.segmentElapsedMs).toBe(0);
    expect(state.segmentRemainingMs).toBe(10 * 60_000);
  });

  it('resets the active segment while preserving paused status', () => {
    const stack = makeStack([5, 10]);
    let session = startSession(makeIdleSession(), T0);
    session = tickSession(session, stack, T0 + 6 * 60_000).session;
    session = pauseSession(session, T0 + 6 * 60_000);

    const { session: reset } = resetSegment(session, stack, T0 + 8 * 60_000);
    const state = computeSessionState(reset, stack, T0 + 30 * 60_000);

    expect(reset.status).toBe('paused');
    expect(reset.activeSegmentIndex).toBe(1);
    expect(state.totalElapsedMs).toBe(5 * 60_000);
    expect(state.segmentElapsedMs).toBe(0);
  });

  it('moves to the previous segment at full duration', () => {
    const stack = makeStack([5, 10, 5]);
    let session = startSession(makeIdleSession(), T0);
    session = tickSession(session, stack, T0 + 7 * 60_000).session;

    const { session: previous } = previousSegment(session, stack, T0 + 8 * 60_000);
    const state = computeSessionState(previous, stack, T0 + 8 * 60_000);

    expect(previous.activeSegmentIndex).toBe(0);
    expect(state.totalElapsedMs).toBe(0);
    expect(state.segmentRemainingMs).toBe(5 * 60_000);
  });

  it('restarts the first segment when previous is requested on the first segment', () => {
    const stack = makeStack([5, 10]);
    const session = startSession(makeIdleSession(), T0);

    const { session: previous } = previousSegment(session, stack, T0 + 60_000);
    const state = computeSessionState(previous, stack, T0 + 60_000);

    expect(previous.activeSegmentIndex).toBe(0);
    expect(state.totalElapsedMs).toBe(0);
    expect(state.segmentRemainingMs).toBe(5 * 60_000);
  });
});

// ---------------------------------------------------------------------------
// Concurrent sessions (wall-clock independence)
// ---------------------------------------------------------------------------

describe('concurrent sessions', () => {
  it('two sessions with different start times remain independent', () => {
    const stack = makeStack([10]);

    const sessionA = startSession({ ...makeIdleSession(), sessionId: 'A' }, T0);
    const sessionB = startSession({ ...makeIdleSession(), sessionId: 'B' }, T0 + 5 * 60_000);

    const now = T0 + 8 * 60_000;
    const stateA = computeSessionState(sessionA, stack, now);
    const stateB = computeSessionState(sessionB, stack, now);

    expect(stateA.totalElapsedMs).toBe(8 * 60_000);
    expect(stateB.totalElapsedMs).toBe(3 * 60_000);
  });
});
