// ---------------------------------------------------------------------------
// Session export types — structured for current JSON export and future
// Progress App "Done Work" integration
// ---------------------------------------------------------------------------

export interface SegmentExport {
  segmentId: string;
  label: string;
  /** Planned duration in ms */
  plannedDurationMs: number;
  /** Planned duration formatted as HH:MM:SS */
  plannedDurationFormatted: string;
  /** Actual time spent in this segment in ms (null if not reached) */
  actualDurationMs: number | null;
  /** Actual duration formatted, or null if not reached */
  actualDurationFormatted: string | null;
  /** Whether this segment was completed, skipped, or not reached */
  segmentStatus: 'completed' | 'skipped' | 'active' | 'not_reached' | 'cancelled';
  color?: string;
}

export interface StackSessionExport {
  // --- Identity ---
  exportVersion: 1;
  exportedAt: string;           // ISO 8601 timestamp

  // --- Stack ---
  stackId: string;
  stackName: string;
  stackIcon?: string;
  stackDescription?: string;

  // --- Session ---
  sessionId: string;
  sessionStatus: 'completed' | 'cancelled';

  // --- Timing ---
  startedAt: string;            // ISO 8601
  endedAt: string;              // ISO 8601
  totalPlannedDurationMs: number;
  totalPlannedDurationFormatted: string;
  totalActualDurationMs: number;
  totalActualDurationFormatted: string;

  // --- Segments ---
  totalSegments: number;
  segmentsCompleted: number;
  segments: SegmentExport[];

  // --- Metadata ---
  notes?: string;
}
