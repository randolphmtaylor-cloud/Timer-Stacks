import { describe, it, expect, beforeEach } from 'vitest';
import type { TimerStack } from '@timer-stacks/core';
import { BaseStackStorage } from '../BaseStackStorage.js';

// In-memory subclass — no platform deps.
class MemoryStackStorage extends BaseStackStorage {
  private data: TimerStack[] = [];
  protected async readAll() { return [...this.data]; }
  protected async writeAll(stacks: TimerStack[]) { this.data = [...stacks]; }
}

let store: MemoryStackStorage;

beforeEach(() => { store = new MemoryStackStorage(); });

async function seed() {
  return store.create({
    name: 'My Stack',
    description: 'Original description',
    icon: '🎯',
    isTemplate: false,
    segments: [
      { label: 'Warm Up', durationMs: 60_000, color: '#6366f1' },
      { label: 'Work',    durationMs: 25 * 60_000, color: '#8b5cf6' },
    ],
  });
}

describe('BaseStackStorage.update', () => {
  it('persists name change', async () => {
    const original = await seed();
    const updated = await store.update({ stackId: original.stackId, name: 'Renamed Stack' });
    expect(updated.name).toBe('Renamed Stack');
    const fromStore = await store.getById(original.stackId);
    expect(fromStore?.name).toBe('Renamed Stack');
  });

  it('persists segment label and duration changes', async () => {
    const original = await seed();
    const updated = await store.update({
      stackId: original.stackId,
      segments: [
        { segmentId: original.segments[0]!.segmentId, label: 'Cool Down', durationMs: 90_000 },
        { segmentId: original.segments[1]!.segmentId, label: 'Deep Work', durationMs: 30 * 60_000 },
      ],
      totalDurationMs: 90_000 + 30 * 60_000,
    });
    expect(updated.segments[0]!.label).toBe('Cool Down');
    expect(updated.segments[0]!.durationMs).toBe(90_000);
    expect(updated.segments[1]!.label).toBe('Deep Work');
    const fromStore = await store.getById(original.stackId);
    expect(fromStore?.segments[1]!.durationMs).toBe(30 * 60_000);
  });

  it('bumps updatedAt on every edit', async () => {
    const original = await seed();
    const before = original.updatedAt;
    // Ensure time has advanced (tests can run fast).
    await new Promise((r) => setTimeout(r, 2));
    const updated = await store.update({ stackId: original.stackId, name: 'New Name' });
    expect(updated.updatedAt).toBeGreaterThan(before);
  });

  it('allows adding a new segment', async () => {
    const original = await seed();
    const updated = await store.update({
      stackId: original.stackId,
      segments: [
        ...original.segments.map((s) => ({ segmentId: s.segmentId, label: s.label, durationMs: s.durationMs })),
        { label: 'Cool Down', durationMs: 5 * 60_000 },
      ],
      totalDurationMs: original.totalDurationMs + 5 * 60_000,
    });
    expect(updated.segments).toHaveLength(3);
    expect(updated.segments[2]!.label).toBe('Cool Down');
  });

  it('allows removing a segment', async () => {
    const original = await seed();
    const updated = await store.update({
      stackId: original.stackId,
      segments: [{ segmentId: original.segments[0]!.segmentId, label: original.segments[0]!.label, durationMs: original.segments[0]!.durationMs }],
      totalDurationMs: original.segments[0]!.durationMs,
    });
    expect(updated.segments).toHaveLength(1);
  });

  it('allows reordering segments', async () => {
    const original = await seed();
    const [a, b] = original.segments as [TimerStack['segments'][0], TimerStack['segments'][0]];
    const updated = await store.update({
      stackId: original.stackId,
      segments: [
        { segmentId: b.segmentId, label: b.label, durationMs: b.durationMs },
        { segmentId: a.segmentId, label: a.label, durationMs: a.durationMs },
      ],
    });
    expect(updated.segments[0]!.segmentId).toBe(b.segmentId);
    expect(updated.segments[1]!.segmentId).toBe(a.segmentId);
  });

  it('clears description when explicitly set to undefined', async () => {
    const original = await seed();
    expect(original.description).toBe('Original description');
    const updated = await store.update({ stackId: original.stackId, description: undefined });
    expect(updated.description).toBeUndefined();
    const fromStore = await store.getById(original.stackId);
    expect(fromStore?.description).toBeUndefined();
  });

  it('clears icon when explicitly set to undefined', async () => {
    const original = await seed();
    expect(original.icon).toBe('🎯');
    const updated = await store.update({ stackId: original.stackId, icon: undefined });
    expect(updated.icon).toBeUndefined();
  });

  it('preserves description when update input omits it', async () => {
    const original = await seed();
    const updated = await store.update({ stackId: original.stackId, name: 'New Name' });
    expect(updated.description).toBe('Original description');
  });

  it('throws when stackId is not found', async () => {
    await expect(store.update({ stackId: 'nonexistent', name: 'X' })).rejects.toThrow('not found');
  });
});
