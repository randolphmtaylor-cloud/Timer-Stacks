// ---------------------------------------------------------------------------
// SessionManager — manages multiple concurrent sessions
// Coordinates ticking, event emission, and session lifecycle.
// Designed to be instantiated once per platform app.
// ---------------------------------------------------------------------------

import { v4 as uuidv4 } from 'uuid';
import type { TimerStack } from '../types/stack.js';
import type { Session, SessionRecord } from '../types/session.js';
import type { TimerEvent } from '../types/events.js';
import {
  startSession,
  pauseSession,
  resumeSession,
  resetSession,
  skipSegment,
  resetSegment,
  previousSegment,
  tickSession,
  computeSessionState,
} from './TimerEngine.js';

export type EventListener = (events: TimerEvent[]) => void;

export function createSession(stack: TimerStack): Session {
  return {
    sessionId: uuidv4(),
    stackId: stack.stackId,
    stackName: stack.name,
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

export function sessionToRecord(
  session: Session,
  stack: TimerStack,
  now: number,
): SessionRecord {
  const endedAt = session.completedAt ?? now;
  const startedAt = session.startedAt ?? now;
  const wallElapsed = endedAt - startedAt;
  const totalElapsedMs = Math.max(0, wallElapsed - session.totalPausedMs);

  return {
    recordId: uuidv4(),
    sessionId: session.sessionId,
    stackId: session.stackId,
    stackName: session.stackName,
    status: session.status === 'completed' ? 'completed' : 'cancelled',
    startedAt,
    endedAt,
    totalElapsedMs,
    segmentsCompleted: session.activeSegmentIndex + (session.status === 'completed' ? 1 : 0),
    totalSegments: stack.segments.length,
  };
}

export class SessionManager {
  private sessions = new Map<string, Session>();
  private stacks = new Map<string, TimerStack>();
  private listeners: EventListener[] = [];
  private tickInterval: ReturnType<typeof setInterval> | null = null;
  readonly tickRateMs = 100;

  start(stack: TimerStack, existingSession?: Session): Session {
    const session = existingSession ?? createSession(stack);
    const now = Date.now();
    const started = startSession(session, now);
    this.stacks.set(stack.stackId, stack);
    this.sessions.set(started.sessionId, started);
    this.startTicking();
    return started;
  }

  pause(sessionId: string): Session | null {
    const session = this.sessions.get(sessionId);
    const stack = session ? this.stacks.get(session.stackId) : undefined;
    if (!session || !stack) return null;
    const paused = pauseSession(session, Date.now());
    this.sessions.set(sessionId, paused);
    this.emit([{ type: 'stack_paused', session: paused }]);
    return paused;
  }

  resume(sessionId: string): Session | null {
    const session = this.sessions.get(sessionId);
    const stack = session ? this.stacks.get(session.stackId) : undefined;
    if (!session || !stack) return null;
    const resumed = resumeSession(session, Date.now());
    this.sessions.set(sessionId, resumed);
    this.emit([{ type: 'stack_resumed', session: resumed }]);
    return resumed;
  }

  skip(sessionId: string): Session | null {
    const session = this.sessions.get(sessionId);
    const stack = session ? this.stacks.get(session.stackId) : undefined;
    if (!session || !stack) return null;
    const { session: updated, events } = skipSegment(session, stack, Date.now());
    this.sessions.set(sessionId, updated);
    if (updated.status === 'completed') this.sessions.delete(sessionId);
    this.emit(events);
    return updated;
  }

  resetSegment(sessionId: string): Session | null {
    const session = this.sessions.get(sessionId);
    const stack = session ? this.stacks.get(session.stackId) : undefined;
    if (!session || !stack) return null;
    const { session: updated, events } = resetSegment(session, stack, Date.now());
    this.sessions.set(sessionId, updated);
    this.emit(events);
    return updated;
  }

  previousSegment(sessionId: string): Session | null {
    const session = this.sessions.get(sessionId);
    const stack = session ? this.stacks.get(session.stackId) : undefined;
    if (!session || !stack) return null;
    const { session: updated, events } = previousSegment(session, stack, Date.now());
    this.sessions.set(sessionId, updated);
    this.emit(events);
    return updated;
  }

  reset(sessionId: string): Session | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    const resetted = resetSession(session);
    this.sessions.set(sessionId, resetted);
    this.emit([{ type: 'stack_reset', session: resetted }]);
    this.stopTickingIfIdle();
    return resetted;
  }

  cancel(sessionId: string): void {
    this.sessions.delete(sessionId);
    this.stopTickingIfIdle();
  }

  getSession(sessionId: string): Session | undefined {
    return this.sessions.get(sessionId);
  }

  getSessionState(sessionId: string) {
    const session = this.sessions.get(sessionId);
    const stack = session ? this.stacks.get(session.stackId) : undefined;
    if (!session || !stack) return null;
    return computeSessionState(session, stack, Date.now());
  }

  getAllSessions(): Session[] {
    return [...this.sessions.values()];
  }

  /** Restore sessions (e.g. after app restart). Sessions remain accurate
   *  because they use absolute timestamps — no wall-clock drift. */
  hydrate(sessions: Session[], stacks: TimerStack[]): void {
    for (const s of stacks) this.stacks.set(s.stackId, s);
    for (const s of sessions) {
      if (s.status === 'running' || s.status === 'paused') {
        this.sessions.set(s.sessionId, s);
      }
    }
    if (this.sessions.size > 0) this.startTicking();
  }

  subscribe(listener: EventListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private emit(events: TimerEvent[]): void {
    if (events.length === 0) return;
    for (const listener of this.listeners) listener(events);
  }

  private startTicking(): void {
    if (this.tickInterval !== null) return;
    this.tickInterval = setInterval(() => this.tick(), this.tickRateMs);
  }

  private stopTickingIfIdle(): void {
    const hasActive = [...this.sessions.values()].some(
      (s) => s.status === 'running' || s.status === 'paused',
    );
    if (!hasActive && this.tickInterval !== null) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
  }

  private tick(): void {
    const now = Date.now();
    const allEvents: TimerEvent[] = [];

    for (const [id, session] of this.sessions.entries()) {
      if (session.status !== 'running') continue;
      const stack = this.stacks.get(session.stackId);
      if (!stack) continue;

      const { session: updated, events } = tickSession(session, stack, now);
      this.sessions.set(id, updated);
      allEvents.push(...events);

      if (updated.status === 'completed') {
        this.sessions.delete(id);
      }
    }

    if (allEvents.length > 0) this.emit(allEvents);
    this.stopTickingIfIdle();
  }

  destroy(): void {
    if (this.tickInterval !== null) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
    this.sessions.clear();
    this.listeners = [];
  }
}
