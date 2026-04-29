import { z } from 'zod';

// ---------------------------------------------------------------------------
// Segment schema
// ---------------------------------------------------------------------------

export const SegmentSchema = z.object({
  segmentId: z.string().min(1),
  label: z.string().min(1, 'Segment label is required').max(80),
  durationMs: z.number().int().positive('Duration must be positive'),
  color: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Stack schema
// ---------------------------------------------------------------------------

export const TimerStackSchema = z
  .object({
    stackId: z.string().min(1),
    name: z.string().min(1, 'Stack name is required').max(120),
    totalDurationMs: z.number().int().positive('Total duration must be positive'),
    segments: z.array(SegmentSchema).min(1, 'At least one segment is required'),
    isTemplate: z.boolean(),
    createdAt: z.number(),
    updatedAt: z.number(),
    description: z.string().max(300).optional(),
    icon: z.string().optional(),
  })
  .refine(
    (data) => {
      const sum = data.segments.reduce((acc, s) => acc + s.durationMs, 0);
      return sum === data.totalDurationMs;
    },
    {
      message: 'Sum of segment durations must equal the total stack duration',
      path: ['segments'],
    },
  );

// ---------------------------------------------------------------------------
// Create / update input schemas (no ids/timestamps — those are generated)
// ---------------------------------------------------------------------------

export const CreateSegmentInputSchema = z.object({
  label: z.string().min(1).max(80),
  durationMs: z.number().int().positive(),
  color: z.string().optional(),
});

export const CreateStackInputSchema = z
  .object({
    name: z.string().min(1).max(120),
    totalDurationMs: z.number().int().positive().optional(),
    segments: z.array(CreateSegmentInputSchema).min(1),
    isTemplate: z.boolean().optional().default(false),
    description: z.string().max(300).optional(),
    icon: z.string().optional(),
  })
  .transform((data) => ({
    ...data,
    totalDurationMs:
      data.totalDurationMs ?? data.segments.reduce((acc, s) => acc + s.durationMs, 0),
  }))
  .refine(
    (data) => {
      const sum = data.segments.reduce((acc, s) => acc + s.durationMs, 0);
      return sum === data.totalDurationMs;
    },
    {
      message: 'Sum of segment durations must equal the total stack duration',
      path: ['segments'],
    },
  );

// ---------------------------------------------------------------------------
// Duration validation helpers
// ---------------------------------------------------------------------------

export function validateSegmentSum(
  segments: Array<{ durationMs: number }>,
  totalDurationMs: number,
): { valid: boolean; diff: number } {
  const sum = segments.reduce((acc, s) => acc + s.durationMs, 0);
  return { valid: sum === totalDurationMs, diff: totalDurationMs - sum };
}

export type TimerStackInput = z.infer<typeof CreateStackInputSchema>;
