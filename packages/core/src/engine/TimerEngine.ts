// ---------------------------------------------------------------------------
// TimerEngine — pure, deterministic, side-effect-free state machine
//
// All time is tracked via wall-clock timestamps so the engine remains
// accurate across backgrounding, sleep/wake, and concurrent sessions.
// No setInterval/setTimeout are used here — callers tick the engine.
// ---------------------------------------------------------------------------

import type { TimerStack } from '../types/stack.js';
import type { Session, SessionState, SessionStatus } from '../types/session.js';
import type { TimerEvent } from '../types/events.js';

// ---------------------------------------------------------------------------
// Pure time helpers
// ---------------------------------------------------------------------------

/**
 * Compute total elapsed ms for a session, given the current wall-clock time.
 * Excludes all paused intervals.
 */
function computeTotalElapsed(session: Session, now: number): number {
  if (session.startedAt === null) return 0;

  const wallElapsed =
    session.status === 'paused' || session.status === 'completed'
      ? (session.pausedAt ?? now) - session.startedAt
      : now - session.startedAt;

  return Math.max(0, wallElapsed - session.totalPausedMs);
}

/**
 * Walk through segments to find which segment is active given totalElapsed.
 * Returns the segment index and how many ms into that segment we are.
 */
function resolveActiveSegment(
  segments: TimerStack['segments'],
  totalElapsedMs: number,
): { index: number; elapsedInSegmentMs: number } {
  let accumulated = 0;
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (!seg) break;
    const end = accumulated + seg.durationMs;
    if (totalElapsedMs < end || i === segments.length - 1) {
      return { index: i, elapsedInSegmentMs: Math.max(0, totalElapsedMs - accumulated) };
    }
    accumulated = end;
  }
  return { index: segments.length - 1, elapsedInSegmentMs: 0 };
}

// ---------------------------------------------------------------------------
// Core computation — derive SessionState from a Session snapshot + now
// ---------------------------------------------------------------------------

export function computeSessionState(session: Session, stack: TimerStack, now: number): SessionState {
  const totalElapsedMs = computeTotalElapsed(session, now);

  const { index, elapsedInSegmentMs } = resolveActiveSegment(stack.segments, totalElapsedMs);

  const activeSegment = stack.segments[index];
  const segDuration = activeSegment?.durationMs ?? 0;
  const segmentElapsedMs = Math.min(elapsedInSegmentMs, segDuration);
  const segmentRemainingMs = Math.max(0, segDuration - segmentElapsedMs);

  const stackRemainingMs = Math.max(0, stack.totalDurationMs - totalElapsedMs);

  const segmentProgress = segDuration > 0 ? Math.min(1, segmentElapsedMs / segDuration) : 0;
  const stackProgress =
    stack.totalDurationMs > 0 ? Math.min(1, totalElapsedMs / stack.totalDurationMs) : 0;

  return {
    session,
    totalElapsedMs,
    stackRemainingMs,
    segmentElapsedMs,
    segmentRemainingMs,
    segmentProgress,
    stackProgress,
  };
}

// ---------------------------------------------------------------------------
// State transitions — all return new Session objects (immutable pattern)
// ---------------------------------------------------------------------------

export function startSession(session: Session, now: number): Session {
  if (session.status !== 'idle') return session;
  return {
    ...session,
    status: 'running',
    startedAt: now,
    pausedAt: null,
    totalPausedMs: 0,
    activeSegmentIndex: 0,
    completedSegmentsElapsedMs: 0,
    segmentTransitions: [],
    completedAt: null,
  };
}

export function pauseSession(session: Session, now: number): Session {
  if (session.status !== 'running') return session;
  return {
    ...session,
    status: 'paused',
    pausedAt: now,
  };
}

export function resumeSession(session: Session, now: number): Session {
  if (session.status !== 'paused') return session;
  const additionalPausedMs =
    session.pausedAt !== null ? now - session.pausedAt : 0;
  return {
    ...session,
    status: 'running',
    pausedAt: null,
    totalPausedMs: session.totalPausedMs + additionalPausedMs,
  };
}

export function resetSession(session: Session): Session {
  return {
    ...session,
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

export function skipSegment(
  session: Session,
  stack: TimerStack,
  now: number,
): { session: Session; events: TimerEvent[] } {
  if (session.status !== 'running' && session.status !== 'paused') {
    return { session, events: [] };
  }

  const events: TimerEvent[] = [];
  const currentIndex = session.activeSegmentIndex;
  const nextIndex = currentIndex + 1;

  events.push({
    type: 'stack_skipped',
    session,
    skippedSegmentIndex: currentIndex,
    nextSegmentIndex: nextIndex < stack.segments.length ? nextIndex : null,
  });

  if (nextIndex >= stack.segments.length) {
    // Skipping the last segment completes the stack
    const completedSession: Session = {
      ...session,
      status: 'completed',
      completedAt: now,
      activeSegmentIndex: currentIndex,
    };
    events.push({ type: 'stack_completed', session: completedSession, stackName: stack.name });
    return { session: completedSession, events };
  }

  // Jump time forward so totalElapsed lands exactly at the start of nextIndex
  const msToSkip = accumulatedMsUpToSegment(stack, nextIndex);
  const totalElapsed = computeTotalElapsed(session, now);
  const gap = msToSkip - totalElapsed;
  const timeJump = Math.max(0, gap);

  // We simulate the skip by moving the startedAt back (or reducing totalPaused)
  // Easiest: reduce totalPausedMs by the gap (or increase virtual elapsed)
  const updatedSession: Session = {
    ...session,
    status: 'running',
    pausedAt: null,
    totalPausedMs: session.totalPausedMs - timeJump,
    activeSegmentIndex: nextIndex,
    segmentTransitions: [
      ...session.segmentTransitions,
      { fromIndex: currentIndex, toIndex: nextIndex, transitionedAt: now },
    ],
  };

  const nextSeg = stack.segments[nextIndex];
  if (nextSeg) {
    events.push({ type: 'segment_started', session: updatedSession, segmentIndex: nextIndex, segmentLabel: nextSeg.label });
  }

  return { session: updatedSession, events };
}

export function resetSegment(
  session: Session,
  stack: TimerStack,
  now: number,
): { session: Session; events: TimerEvent[] } {
  if (session.status !== 'running' && session.status !== 'paused') {
    return { session, events: [] };
  }

  const targetElapsed = accumulatedMsUpToSegment(stack, session.activeSegmentIndex);
  const updatedSession = jumpSessionToElapsed(session, targetElapsed, now, session.activeSegmentIndex);

  const activeSegment = stack.segments[session.activeSegmentIndex];
  return {
    session: updatedSession,
    events: activeSegment
      ? [{
          type: 'segment_started',
          session: updatedSession,
          segmentIndex: session.activeSegmentIndex,
          segmentLabel: activeSegment.label,
        }]
      : [],
  };
}

export function previousSegment(
  session: Session,
  stack: TimerStack,
  now: number,
): { session: Session; events: TimerEvent[] } {
  if (session.status !== 'running' && session.status !== 'paused') {
    return { session, events: [] };
  }

  const currentIndex = session.activeSegmentIndex;
  const previousIndex = Math.max(0, currentIndex - 1);
  const targetElapsed = accumulatedMsUpToSegment(stack, previousIndex);
  const updatedSession = jumpSessionToElapsed(session, targetElapsed, now, previousIndex);
  const transitionedSession: Session = {
    ...updatedSession,
    segmentTransitions:
      previousIndex === currentIndex
        ? updatedSession.segmentTransitions
        : [
            ...updatedSession.segmentTransitions,
            { fromIndex: currentIndex, toIndex: previousIndex, transitionedAt: now },
          ],
  };

  const targetSegment = stack.segments[previousIndex];
  return {
    session: transitionedSession,
    events: targetSegment
      ? [{
          type: 'segment_started',
          session: transitionedSession,
          segmentIndex: previousIndex,
          segmentLabel: targetSegment.label,
        }]
      : [],
  };
}

// ---------------------------------------------------------------------------
// Tick — call this on an interval (~100ms) to advance session state.
// Returns updated session + any events that fired this tick.
// ---------------------------------------------------------------------------

export function tickSession(
  session: Session,
  stack: TimerStack,
  now: number,
): { session: Session; events: TimerEvent[] } {
  if (session.status !== 'running') return { session, events: [] };

  const events: TimerEvent[] = [];
  let current = session;

  const totalElapsed = computeTotalElapsed(current, now);

  // Check if the full stack is done
  if (totalElapsed >= stack.totalDurationMs) {
    for (let i = current.activeSegmentIndex; i < stack.segments.length; i++) {
      const completedSeg = stack.segments[i];
      if (completedSeg) {
        events.push({
          type: 'segment_completed',
          session: current,
          segmentIndex: i,
          segmentLabel: completedSeg.label,
        });
      }
    }

    const completedSession: Session = {
      ...current,
      status: 'completed',
      completedAt: now,
      activeSegmentIndex: stack.segments.length - 1,
    };
    events.push({ type: 'stack_completed', session: completedSession, stackName: stack.name });
    return { session: completedSession, events };
  }

  // Check for segment transitions
  const { index } = resolveActiveSegment(stack.segments, totalElapsed);

  if (index !== current.activeSegmentIndex) {
    // One or more segments have elapsed since last tick
    for (let i = current.activeSegmentIndex; i < index; i++) {
      const completedSeg = stack.segments[i];
      if (completedSeg) {
        events.push({
          type: 'segment_completed',
          session: current,
          segmentIndex: i,
          segmentLabel: completedSeg.label,
        });
      }
      const nextSeg = stack.segments[i + 1];
      if (nextSeg) {
        events.push({
          type: 'segment_started',
          session: current,
          segmentIndex: i + 1,
          segmentLabel: nextSeg.label,
        });
      }
    }

    current = {
      ...current,
      activeSegmentIndex: index,
      segmentTransitions: [
        ...current.segmentTransitions,
        { fromIndex: current.activeSegmentIndex, toIndex: index, transitionedAt: now },
      ],
    };
  }

  return { session: current, events };
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function accumulatedMsUpToSegment(stack: TimerStack, segmentIndex: number): number {
  let total = 0;
  for (let i = 0; i < segmentIndex && i < stack.segments.length; i++) {
    total += stack.segments[i]?.durationMs ?? 0;
  }
  return total;
}

function jumpSessionToElapsed(
  session: Session,
  targetElapsedMs: number,
  now: number,
  activeSegmentIndex: number,
): Session {
  if (session.startedAt === null) return session;

  return {
    ...session,
    pausedAt: session.status === 'paused' ? now : null,
    totalPausedMs: now - session.startedAt - targetElapsedMs,
    activeSegmentIndex,
    completedSegmentsElapsedMs: targetElapsedMs,
    completedAt: null,
  };
}
