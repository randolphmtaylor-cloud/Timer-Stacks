// ---------------------------------------------------------------------------
// watchConnectivity.test.ts
//
// Tests for buildWatchSnapshot() and toWatchStatus() in watchConnectivity.ts.
//
// These functions are pure — no native modules, no React Native, no Expo —
// so they run cleanly under vitest/node.
// ---------------------------------------------------------------------------

import { describe, it, expect, beforeEach } from 'vitest';
import { buildWatchSnapshot, toWatchStatus } from '../lib/watchConnectivity.js';
import type { Session, TimerStack } from '@timer-stacks/core';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    sessionId: 'sess-001',
    stackId: 'stack-001',
    stackName: 'Test Stack',
    status: 'running',
    startedAt: Date.now() - 10_000,
    pausedAt: null,
    totalPausedMs: 0,
    activeSegmentIndex: 0,
    completedSegmentsElapsedMs: 0,
    segmentTransitions: [],
    completedAt: null,
    ...overrides,
  };
}

function makeStack(overrides: Partial<TimerStack> = {}): TimerStack {
  return {
    stackId: 'stack-001',
    name: 'Test Stack',
    totalDurationMs: 600_000, // 10 min
    segments: [
      { segmentId: 'seg-1', label: 'Warm-up', durationMs: 300_000 },
      { segmentId: 'seg-2', label: 'Work',    durationMs: 300_000 },
    ],
    isTemplate: false,
    createdAt: Date.now() - 86_400_000,
    updatedAt: Date.now() - 86_400_000,
    ...overrides,
  };
}

const baseDerived = {
  activeSegmentIndex: 0,
  segmentRemainingMs: 250_000,
  totalRemainingMs:   550_000,
};

// ---------------------------------------------------------------------------
// toWatchStatus
// ---------------------------------------------------------------------------

describe('toWatchStatus', () => {
  it('maps running → running', () => {
    expect(toWatchStatus('running')).toBe('running');
  });

  it('maps paused → paused', () => {
    expect(toWatchStatus('paused')).toBe('paused');
  });

  it('maps completed → completed', () => {
    expect(toWatchStatus('completed')).toBe('completed');
  });

  it('maps idle → idle', () => {
    expect(toWatchStatus('idle')).toBe('idle');
  });

  it('maps cancelled → completed (watch has no cancelled state)', () => {
    expect(toWatchStatus('cancelled')).toBe('completed');
  });
});

// ---------------------------------------------------------------------------
// buildWatchSnapshot — core fields
// ---------------------------------------------------------------------------

describe('buildWatchSnapshot — core fields', () => {
  it('carries sessionId, stackName, totalSegments through unchanged', () => {
    const snap = buildWatchSnapshot(makeSession(), makeStack(), baseDerived);
    expect(snap.sessionId).toBe('sess-001');
    expect(snap.stackName).toBe('Test Stack');
    expect(snap.totalSegments).toBe(2);
  });

  it('reads segment label and duration from stack at activeSegmentIndex', () => {
    const snap = buildWatchSnapshot(makeSession(), makeStack(), baseDerived);
    expect(snap.activeSegmentName).toBe('Warm-up');
    expect(snap.activeSegmentDurationMs).toBe(300_000);
  });

  it('reads the correct segment when activeSegmentIndex is 1', () => {
    const snap = buildWatchSnapshot(
      makeSession({ activeSegmentIndex: 1 }),
      makeStack(),
      { ...baseDerived, activeSegmentIndex: 1 },
    );
    expect(snap.activeSegmentName).toBe('Work');
    expect(snap.activeSegmentDurationMs).toBe(300_000);
    expect(snap.activeSegmentIndex).toBe(1);
  });

  it('stamps lastUpdatedAt within the current second', () => {
    const before = Date.now();
    const snap = buildWatchSnapshot(makeSession(), makeStack(), baseDerived);
    const after = Date.now();
    expect(snap.lastUpdatedAt).toBeGreaterThanOrEqual(before);
    expect(snap.lastUpdatedAt).toBeLessThanOrEqual(after);
  });
});

// ---------------------------------------------------------------------------
// buildWatchSnapshot — running session
// ---------------------------------------------------------------------------

describe('buildWatchSnapshot — running session', () => {
  it('passes positive remaining times through unchanged', () => {
    const snap = buildWatchSnapshot(makeSession(), makeStack(), baseDerived);
    expect(snap.status).toBe('running');
    expect(snap.activeSegmentRemainingMs).toBe(250_000);
    expect(snap.totalRemainingMs).toBe(550_000);
  });

  it('clamps negative segmentRemainingMs to 0', () => {
    const snap = buildWatchSnapshot(
      makeSession(),
      makeStack(),
      { ...baseDerived, segmentRemainingMs: -500 },
    );
    expect(snap.activeSegmentRemainingMs).toBe(0);
  });

  it('clamps negative totalRemainingMs to 0', () => {
    const snap = buildWatchSnapshot(
      makeSession(),
      makeStack(),
      { ...baseDerived, totalRemainingMs: -1 },
    );
    expect(snap.totalRemainingMs).toBe(0);
  });

  it('both remaining times can be clamped independently', () => {
    const snap = buildWatchSnapshot(
      makeSession(),
      makeStack(),
      { activeSegmentIndex: 0, segmentRemainingMs: -100, totalRemainingMs: -200 },
    );
    expect(snap.activeSegmentRemainingMs).toBe(0);
    expect(snap.totalRemainingMs).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// buildWatchSnapshot — paused session
// ---------------------------------------------------------------------------

describe('buildWatchSnapshot — paused session', () => {
  it('passes remaining times through for paused sessions', () => {
    const snap = buildWatchSnapshot(
      makeSession({ status: 'paused', pausedAt: Date.now() }),
      makeStack(),
      { ...baseDerived, segmentRemainingMs: 120_000, totalRemainingMs: 420_000 },
    );
    expect(snap.status).toBe('paused');
    expect(snap.activeSegmentRemainingMs).toBe(120_000);
    expect(snap.totalRemainingMs).toBe(420_000);
  });

  it('still clamps negative remaining for paused sessions', () => {
    const snap = buildWatchSnapshot(
      makeSession({ status: 'paused' }),
      makeStack(),
      { ...baseDerived, segmentRemainingMs: -50, totalRemainingMs: 100_000 },
    );
    expect(snap.activeSegmentRemainingMs).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// buildWatchSnapshot — terminal states (completed / cancelled / idle)
// ---------------------------------------------------------------------------

describe('buildWatchSnapshot — completed session', () => {
  it('forces activeSegmentRemainingMs to 0 regardless of derived input', () => {
    const snap = buildWatchSnapshot(
      makeSession({ status: 'completed', completedAt: Date.now() }),
      makeStack(),
      { ...baseDerived, segmentRemainingMs: 99_999, totalRemainingMs: 99_999 },
    );
    expect(snap.status).toBe('completed');
    expect(snap.activeSegmentRemainingMs).toBe(0);
    expect(snap.totalRemainingMs).toBe(0);
  });

  it('forces zeros even when derived values are already zero', () => {
    const snap = buildWatchSnapshot(
      makeSession({ status: 'completed' }),
      makeStack(),
      { ...baseDerived, segmentRemainingMs: 0, totalRemainingMs: 0 },
    );
    expect(snap.activeSegmentRemainingMs).toBe(0);
    expect(snap.totalRemainingMs).toBe(0);
  });
});

describe('buildWatchSnapshot — cancelled session', () => {
  it('maps cancelled → completed watch status', () => {
    const snap = buildWatchSnapshot(
      makeSession({ status: 'cancelled' }),
      makeStack(),
      baseDerived,
    );
    expect(snap.status).toBe('completed');
  });

  it('forces remaining times to 0 for cancelled sessions', () => {
    const snap = buildWatchSnapshot(
      makeSession({ status: 'cancelled' }),
      makeStack(),
      { ...baseDerived, segmentRemainingMs: 150_000, totalRemainingMs: 400_000 },
    );
    expect(snap.activeSegmentRemainingMs).toBe(0);
    expect(snap.totalRemainingMs).toBe(0);
  });
});

describe('buildWatchSnapshot — idle session', () => {
  it('forces remaining times to 0 for idle sessions', () => {
    const snap = buildWatchSnapshot(
      makeSession({ status: 'idle', startedAt: null }),
      makeStack(),
      { ...baseDerived, segmentRemainingMs: 300_000, totalRemainingMs: 600_000 },
    );
    expect(snap.status).toBe('idle');
    expect(snap.activeSegmentRemainingMs).toBe(0);
    expect(snap.totalRemainingMs).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// buildWatchSnapshot — out-of-bounds segment index
// ---------------------------------------------------------------------------

describe('buildWatchSnapshot — out-of-bounds segment index', () => {
  it('returns empty string for segment name when index is out of bounds', () => {
    const snap = buildWatchSnapshot(
      makeSession({ activeSegmentIndex: 99 }),
      makeStack(),
      { activeSegmentIndex: 99, segmentRemainingMs: 0, totalRemainingMs: 0 },
    );
    expect(snap.activeSegmentName).toBe('');
  });

  it('returns 0 for segment duration when index is out of bounds', () => {
    const snap = buildWatchSnapshot(
      makeSession({ activeSegmentIndex: 99 }),
      makeStack(),
      { activeSegmentIndex: 99, segmentRemainingMs: 0, totalRemainingMs: 0 },
    );
    expect(snap.activeSegmentDurationMs).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// buildWatchSnapshot — empty stack
// ---------------------------------------------------------------------------

describe('buildWatchSnapshot — empty stack', () => {
  it('handles a stack with no segments gracefully', () => {
    const emptyStack = makeStack({ segments: [], totalDurationMs: 0 });
    const snap = buildWatchSnapshot(makeSession(), emptyStack, {
      activeSegmentIndex: 0,
      segmentRemainingMs: 0,
      totalRemainingMs: 0,
    });
    expect(snap.totalSegments).toBe(0);
    expect(snap.activeSegmentName).toBe('');
    expect(snap.activeSegmentDurationMs).toBe(0);
  });
});
