// ---------------------------------------------------------------------------
// Build a structured StackSessionExport from a completed session record +
// the originating stack snapshot.
//
// The export object is self-contained and can be consumed directly by a
// future Progress App integration without re-running session logic.
// ---------------------------------------------------------------------------

import type { SessionRecord } from '../types/session.js';
import type { TimerStack } from '../types/stack.js';
import type { SegmentExport, StackSessionExport } from '../types/export.js';
import { formatMs } from './time.js';

export function buildSessionExport(
  record: SessionRecord,
  stack: TimerStack,
): StackSessionExport {
  const now = Date.now();
  const totalActualMs = record.totalElapsedMs;

  // Walk segments to classify each one.
  // We accumulate planned durations to figure out how much actual time was
  // spent per completed segment. Segments beyond segmentsCompleted are either
  // active (the last one the session was on) or not reached.
  let accumulatedActualMs = totalActualMs;

  const segments: SegmentExport[] = stack.segments.map((seg, i) => {
    const isCompleted = i < record.segmentsCompleted;
    const isActive = i === record.segmentsCompleted && record.status === 'cancelled';
    const isNotReached = i > record.segmentsCompleted;

    let actualDurationMs: number | null = null;
    let segmentStatus: SegmentExport['segmentStatus'];

    if (isCompleted) {
      // For fully completed segments we use the planned duration as a
      // reasonable proxy — actual per-segment timing isn't stored in
      // SessionRecord. Future versions could track this via segmentTransitions.
      actualDurationMs = seg.durationMs;
      segmentStatus = 'completed';
      accumulatedActualMs -= seg.durationMs;
    } else if (isActive && record.status === 'cancelled') {
      // The session was cancelled mid-segment; actual time is whatever was left.
      actualDurationMs = Math.max(0, accumulatedActualMs);
      segmentStatus = 'cancelled';
    } else if (isNotReached) {
      segmentStatus = record.status === 'completed' ? 'skipped' : 'not_reached';
    } else {
      // Completed session — last segment finished normally
      segmentStatus = 'completed';
      actualDurationMs = seg.durationMs;
    }

    return {
      segmentId: seg.segmentId,
      label: seg.label,
      plannedDurationMs: seg.durationMs,
      plannedDurationFormatted: formatMs(seg.durationMs),
      actualDurationMs,
      actualDurationFormatted: actualDurationMs !== null ? formatMs(actualDurationMs) : null,
      segmentStatus,
      ...(seg.color ? { color: seg.color } : {}),
    };
  });

  return {
    exportVersion: 1,
    exportedAt: new Date(now).toISOString(),

    stackId: stack.stackId,
    stackName: record.stackName,
    ...(stack.icon ? { stackIcon: stack.icon } : {}),
    ...(stack.description ? { stackDescription: stack.description } : {}),

    sessionId: record.sessionId,
    sessionStatus: record.status,

    startedAt: new Date(record.startedAt).toISOString(),
    endedAt: new Date(record.endedAt).toISOString(),
    totalPlannedDurationMs: stack.totalDurationMs,
    totalPlannedDurationFormatted: formatMs(stack.totalDurationMs),
    totalActualDurationMs: totalActualMs,
    totalActualDurationFormatted: formatMs(totalActualMs),

    totalSegments: record.totalSegments,
    segmentsCompleted: record.segmentsCompleted,
    segments,

  };
}
