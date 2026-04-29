// ---------------------------------------------------------------------------
// Timer engine events — emitted during tick() to drive notifications & UI
// ---------------------------------------------------------------------------

import type { Session } from './session.js';

export type TimerEventType =
  | 'segment_completed'
  | 'segment_started'
  | 'stack_completed'
  | 'stack_paused'
  | 'stack_resumed'
  | 'stack_reset'
  | 'stack_skipped';

export interface SegmentCompletedEvent {
  type: 'segment_completed';
  session: Session;
  segmentIndex: number;
  segmentLabel: string;
}

export interface SegmentStartedEvent {
  type: 'segment_started';
  session: Session;
  segmentIndex: number;
  segmentLabel: string;
}

export interface StackCompletedEvent {
  type: 'stack_completed';
  session: Session;
  stackName: string;
}

export interface StackPausedEvent {
  type: 'stack_paused';
  session: Session;
}

export interface StackResumedEvent {
  type: 'stack_resumed';
  session: Session;
}

export interface StackResetEvent {
  type: 'stack_reset';
  session: Session;
}

export interface StackSkippedEvent {
  type: 'stack_skipped';
  session: Session;
  skippedSegmentIndex: number;
  nextSegmentIndex: number | null;
}

export type TimerEvent =
  | SegmentCompletedEvent
  | SegmentStartedEvent
  | StackCompletedEvent
  | StackPausedEvent
  | StackResumedEvent
  | StackResetEvent
  | StackSkippedEvent;
