// ---------------------------------------------------------------------------
// Stack & Segment domain types
// ---------------------------------------------------------------------------

export interface Segment {
  segmentId: string;
  label: string;
  /** Duration in milliseconds */
  durationMs: number;
  /** Optional color accent for UI */
  color?: string;
}

export interface TimerStack {
  stackId: string;
  name: string;
  /** Total target duration in ms — must equal sum of segment durations */
  totalDurationMs: number;
  segments: Segment[];
  isTemplate: boolean;
  createdAt: number;
  updatedAt: number;
  /** Optional description shown in templates library */
  description?: string;
  /** Emoji icon */
  icon?: string;
}

// Lightweight creation payload (no ids / timestamps — those are generated)
export interface CreateStackInput {
  name: string;
  totalDurationMs?: number;
  segments: Array<{ label: string; durationMs: number; color?: string }>;
  isTemplate?: boolean;
  description?: string;
  icon?: string;
}

export interface UpdateStackInput {
  stackId: string;
  name?: string;
  totalDurationMs?: number;
  segments?: Array<{ segmentId?: string; label: string; durationMs: number; color?: string }>;
  isTemplate?: boolean;
  description?: string;
  icon?: string;
}
