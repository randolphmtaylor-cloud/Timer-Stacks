import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { TimerStack } from '../src/types/stack.js';
import { SessionManager, createSession } from '../src/engine/SessionManager.js';

function makeStack(segmentMinutes: number[]): TimerStack {
  const segments = segmentMinutes.map((m, i) => ({
    segmentId: `seg-${i}`,
    label: `Segment ${i + 1}`,
    durationMs: m * 60_000,
  }));
  return {
    stackId: 'stack-test',
    name: 'Test',
    totalDurationMs: segments.reduce((a, s) => a + s.durationMs, 0),
    segments,
    isTemplate: false,
    createdAt: 0,
    updatedAt: 0,
  };
}

describe('SessionManager', () => {
  let manager: SessionManager;

  beforeEach(() => {
    vi.useFakeTimers();
    manager = new SessionManager();
  });

  afterEach(() => {
    manager.destroy();
    vi.useRealTimers();
  });

  it('starts a session and reports running status', () => {
    const stack = makeStack([5, 5]);
    const session = manager.start(stack);
    expect(session.status).toBe('running');
    expect(manager.getAllSessions()).toHaveLength(1);
  });

  it('pauses and resumes correctly', () => {
    const stack = makeStack([5]);
    const session = manager.start(stack);

    const paused = manager.pause(session.sessionId);
    expect(paused?.status).toBe('paused');

    const resumed = manager.resume(session.sessionId);
    expect(resumed?.status).toBe('running');
  });

  it('accumulates paused time across intervals', () => {
    const stack = makeStack([10]);
    const session = manager.start(stack);

    // Pause for 5 seconds
    vi.advanceTimersByTime(10_000); // 10s elapsed before pause
    manager.pause(session.sessionId);
    vi.advanceTimersByTime(5_000); // 5s paused
    manager.resume(session.sessionId);

    const state = manager.getSessionState(session.sessionId);
    // Elapsed should be ~10s (the running time), paused time excluded
    expect(state?.totalElapsedMs).toBeGreaterThanOrEqual(9_000);
    expect(state?.totalElapsedMs).toBeLessThan(15_000);
  });

  it('resets a session back to idle', () => {
    const stack = makeStack([5]);
    const session = manager.start(stack);
    manager.reset(session.sessionId);

    const after = manager.getSession(session.sessionId);
    expect(after?.status).toBe('idle');
    expect(after?.startedAt).toBe(null);
  });

  it('fires events to subscribers', async () => {
    const stack = makeStack([0.001]); // ~60ms segment so it completes fast
    const events: string[] = [];
    manager.subscribe((evts) => {
      for (const e of evts) events.push(e.type);
    });

    manager.start(stack);
    vi.advanceTimersByTime(500); // well past the segment end

    expect(events).toContain('stack_completed');
  });

  it('manages multiple concurrent sessions independently', () => {
    const stack1 = makeStack([5]);
    const stack2 = { ...makeStack([10]), stackId: 'stack-2', name: 'Stack 2' };

    const s1 = manager.start(stack1);
    const s2 = manager.start(stack2);

    expect(manager.getAllSessions()).toHaveLength(2);

    manager.pause(s1.sessionId);
    const state1 = manager.getSessionState(s1.sessionId);
    const state2 = manager.getSessionState(s2.sessionId);

    expect(state1?.session.status).toBe('paused');
    expect(state2?.session.status).toBe('running');
  });

  it('hydrates sessions from persisted state', () => {
    const stack = makeStack([5]);
    const session = createSession(stack);
    // Simulate a session that started 2 minutes ago
    const hydrated = {
      ...session,
      status: 'running' as const,
      startedAt: Date.now() - 2 * 60_000,
      totalPausedMs: 0,
      activeSegmentIndex: 0,
    };

    const fresh = new SessionManager();
    fresh.hydrate([hydrated], [stack]);

    const state = fresh.getSessionState(session.sessionId);
    expect(state?.totalElapsedMs).toBeGreaterThanOrEqual(2 * 60_000 - 500);
    fresh.destroy();
  });
});
