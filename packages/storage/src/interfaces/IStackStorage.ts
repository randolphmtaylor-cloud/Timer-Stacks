import type { TimerStack, CreateStackInput, UpdateStackInput } from '@timer-stacks/core';

export interface IStackStorage {
  getAll(): Promise<TimerStack[]>;
  getById(stackId: string): Promise<TimerStack | null>;
  create(input: CreateStackInput): Promise<TimerStack>;
  update(input: UpdateStackInput): Promise<TimerStack>;
  delete(stackId: string): Promise<void>;
  duplicate(stackId: string): Promise<TimerStack>;
  /** Seed initial templates if storage is empty */
  seedIfEmpty(): Promise<void>;
}
