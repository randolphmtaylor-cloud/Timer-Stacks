// ---------------------------------------------------------------------------
// Session domain types — the runtime state for a running TimerStack
// ---------------------------------------------------------------------------

export type SessionStatus = 'idle' | 'running' | 'paused' | 'completed' | 'cancelled';

export interface SegmentTransition {
  fromIndex: number;
  toIndex: number;
  transitionedAt: number;
}

export interface Session {
  sessionId: string;
  stackId: string;
  /** Snapshot of stack name at session start (stack may be edited later) */
  stackName: string;

  status: SessionStatus;

  /** Wall-clock ms when session was first started */
  startedAt: number | null;
  /** Wall-clock ms when session was most recently paused */
  pausedAt: number | null;
  /** Accumulated paused time in ms across all pause intervals */
  totalPausedMs: number;

  /** Index into segments array for the currently active segment */
  activeSegmentIndex: number;
  /** Accumulated ms already elapsed in segments that have fully completed */
  completedSegmentsElapsedMs: number;

  segmentTransitions: SegmentTransition[];

  completedAt: number | null;

  /** History metadata */
  interruptedAt?: number;
  notesOnCompletion?: string;
}

// Derived display state — computed from Session + now
export interface SessionState {
  session: Session;

  /** Total ms elapsed (excluding paused time) */
  totalElapsedMs: number;
  /** Ms remaining on the full stack */
  stackRemainingMs: number;
  /** Ms elapsed in the current segment */
  segmentElapsedMs: number;
  /** Ms remaining in the current segment */
  segmentRemainingMs: number;

  /** 0–1 progress fraction for current segment */
  segmentProgress: number;
  /** 0–1 progress fraction for full stack */
  stackProgress: number;
}

// History record (persisted after session ends)
export interface SessionRecord {
  recordId: string;
  sessionId: string;
  stackId: string;
  stackName: string;
  status: 'completed' | 'cancelled';
  startedAt: number;
  endedAt: number;
  totalElapsedMs: number;
  segmentsCompleted: number;
  totalSegments: number;
}
