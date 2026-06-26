// ---------------------------------------------------------------------------
// BaseStackStorage — all CRUD logic lives here once.
//
// Subclasses supply two primitives:
//   readAll()  → Promise<TimerStack[]>
//   writeAll() → Promise<void>
//
// That is the only platform-specific part. Everything else — create, update,
// delete, duplicate, seedIfEmpty — is shared and tested in one place.
// ---------------------------------------------------------------------------

import { v4 as uuidv4 } from 'uuid';
import type { TimerStack, CreateStackInput, UpdateStackInput } from '@timer-stacks/core';
import { SEED_TEMPLATES } from '@timer-stacks/core';
import type { IStackStorage } from '../interfaces/IStackStorage.js';

export abstract class BaseStackStorage implements IStackStorage {
  /** Read the full list from the underlying store. */
  protected abstract readAll(): Promise<TimerStack[]>;
  /** Persist the full list to the underlying store. */
  protected abstract writeAll(stacks: TimerStack[]): Promise<void>;

  async getAll(): Promise<TimerStack[]> {
    return this.readAll();
  }

  async getById(stackId: string): Promise<TimerStack | null> {
    const stacks = await this.readAll();
    return stacks.find((s) => s.stackId === stackId) ?? null;
  }

  async create(input: CreateStackInput): Promise<TimerStack> {
    const now = Date.now();
    const stack: TimerStack = {
      stackId: uuidv4(),
      name: input.name,
      totalDurationMs:
        input.totalDurationMs ?? input.segments.reduce((a, s) => a + s.durationMs, 0),
      segments: input.segments.map((s) => ({
        segmentId: uuidv4(),
        label: s.label,
        durationMs: s.durationMs,
        color: s.color,
      })),
      isTemplate: input.isTemplate ?? false,
      description: input.description,
      icon: input.icon,
      createdAt: now,
      updatedAt: now,
    };
    const stacks = await this.readAll();
    stacks.push(stack);
    await this.writeAll(stacks);
    return stack;
  }

  async update(input: UpdateStackInput): Promise<TimerStack> {
    const stacks = await this.readAll();
    const idx = stacks.findIndex((s) => s.stackId === input.stackId);
    if (idx === -1) throw new Error(`Stack ${input.stackId} not found`);

    const existing = stacks[idx]!;
    const updated: TimerStack = {
      ...existing,
      name: input.name ?? existing.name,
      totalDurationMs: input.totalDurationMs ?? existing.totalDurationMs,
      segments: input.segments
        ? input.segments.map((s) => ({
            segmentId: s.segmentId ?? uuidv4(),
            label: s.label,
            durationMs: s.durationMs,
            color: s.color,
          }))
        : existing.segments,
      isTemplate: input.isTemplate ?? existing.isTemplate,
      // Use `in` rather than `??` so an explicit undefined clears the field.
      description: 'description' in input ? input.description : existing.description,
      icon: 'icon' in input ? input.icon : existing.icon,
      updatedAt: Date.now(),
    };

    stacks[idx] = updated;
    await this.writeAll(stacks);
    return updated;
  }

  async delete(stackId: string): Promise<void> {
    const stacks = await this.readAll();
    await this.writeAll(stacks.filter((s) => s.stackId !== stackId));
  }

  async duplicate(stackId: string): Promise<TimerStack> {
    const original = await this.getById(stackId);
    if (!original) throw new Error(`Stack ${stackId} not found`);
    return this.create({
      name: `${original.name} (Copy)`,
      totalDurationMs: original.totalDurationMs,
      segments: original.segments.map((s) => ({
        label: s.label,
        durationMs: s.durationMs,
        color: s.color,
      })),
      isTemplate: original.isTemplate,
      description: original.description,
      icon: original.icon,
    });
  }

  async seedIfEmpty(): Promise<void> {
    const stacks = await this.readAll();
    if (stacks.length === 0) {
      await this.writeAll([...SEED_TEMPLATES]);
    }
  }
}
