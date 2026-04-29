import { describe, it, expect } from 'vitest';
import { TimerStackSchema, CreateStackInputSchema, validateSegmentSum } from '../src/validation/schemas.js';

describe('TimerStackSchema', () => {
  const validStack = {
    stackId: 'abc',
    name: 'My Stack',
    totalDurationMs: 10 * 60_000,
    segments: [
      { segmentId: 's1', label: 'A', durationMs: 6 * 60_000 },
      { segmentId: 's2', label: 'B', durationMs: 4 * 60_000 },
    ],
    isTemplate: false,
    createdAt: 0,
    updatedAt: 0,
  };

  it('accepts a valid stack', () => {
    expect(TimerStackSchema.safeParse(validStack).success).toBe(true);
  });

  it('rejects segment sum mismatch', () => {
    const bad = { ...validStack, totalDurationMs: 999 };
    expect(TimerStackSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects empty name', () => {
    const bad = { ...validStack, name: '' };
    expect(TimerStackSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects zero-duration segment', () => {
    const bad = {
      ...validStack,
      segments: [{ segmentId: 's1', label: 'A', durationMs: 0 }],
      totalDurationMs: 0,
    };
    expect(TimerStackSchema.safeParse(bad).success).toBe(false);
  });
});

describe('CreateStackInputSchema', () => {
  it('auto-computes totalDurationMs from segments when omitted', () => {
    const input = {
      name: 'Auto Total',
      segments: [
        { label: 'A', durationMs: 5 * 60_000 },
        { label: 'B', durationMs: 7 * 60_000 },
      ],
    };
    const result = CreateStackInputSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.totalDurationMs).toBe(12 * 60_000);
    }
  });

  it('rejects when explicit total does not match segment sum', () => {
    const input = {
      name: 'Mismatch',
      totalDurationMs: 999,
      segments: [{ label: 'A', durationMs: 5 * 60_000 }],
    };
    expect(CreateStackInputSchema.safeParse(input).success).toBe(false);
  });
});

describe('validateSegmentSum', () => {
  it('returns valid when sum matches', () => {
    const { valid, diff } = validateSegmentSum(
      [{ durationMs: 300_000 }, { durationMs: 600_000 }],
      900_000,
    );
    expect(valid).toBe(true);
    expect(diff).toBe(0);
  });

  it('returns diff when sum does not match', () => {
    const { valid, diff } = validateSegmentSum([{ durationMs: 300_000 }], 600_000);
    expect(valid).toBe(false);
    expect(diff).toBe(300_000);
  });
});
