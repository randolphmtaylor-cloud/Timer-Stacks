import { create } from 'zustand';
import type { TimerStack, CreateStackInput, UpdateStackInput } from '@timer-stacks/core';
import { AsyncStackStorage } from '../lib/storage.js';
import {
  deleteCloudStack,
  fetchCloudStackState,
  upsertCloudStack,
  upsertCloudStacks,
} from '../lib/cloudSync.js';

const storage = new AsyncStackStorage();

function mergeStacksByUpdatedAt(localStacks: TimerStack[], cloudStacks: TimerStack[]): TimerStack[] {
  const merged = new Map<string, TimerStack>();

  for (const stack of cloudStacks) {
    merged.set(stack.stackId, stack);
  }

  for (const localStack of localStacks) {
    const cloudStack = merged.get(localStack.stackId);
    if (!cloudStack || localStack.updatedAt > cloudStack.updatedAt) {
      merged.set(localStack.stackId, localStack);
    }
  }

  return [...merged.values()].sort((a, b) => b.updatedAt - a.updatedAt);
}

interface StackState {
  stacks: TimerStack[];
  isLoading: boolean;
  load: () => Promise<void>;
  syncCloud: () => Promise<void>;
  create: (input: CreateStackInput) => Promise<TimerStack>;
  update: (input: UpdateStackInput) => Promise<TimerStack>;
  delete: (stackId: string) => Promise<void>;
  duplicate: (stackId: string) => Promise<TimerStack>;
}

export const useStackStore = create<StackState>((set, get) => ({
  stacks: [],
  isLoading: false,

  load: async () => {
    set({ isLoading: true });
    const stacks = await storage.getAll();
    set({ stacks, isLoading: false });
    get()
      .syncCloud()
      .catch(async () => {
        if (stacks.length === 0) {
          await storage.seedIfEmpty();
          const seededStacks = await storage.getAll();
          set({ stacks: seededStacks });
        }
      });
  },

  syncCloud: async () => {
    const localStacks = await storage.getAll();
    const { stacks: cloudStacks, deletedStackIds } = await fetchCloudStackState();
    const deletedStackIdSet = new Set(deletedStackIds);
    const stacks = mergeStacksByUpdatedAt(
      localStacks.filter((stack) => !deletedStackIdSet.has(stack.stackId)),
      cloudStacks,
    );
    await storage.replaceAll(stacks);
    set({ stacks });
    await upsertCloudStacks(stacks);
  },

  create: async (input) => {
    const stack = await storage.create(input);
    set((s) => ({ stacks: [...s.stacks, stack] }));
    try {
      await upsertCloudStack(stack);
    } catch (error) {
      await storage.delete(stack.stackId);
      set((s) => ({ stacks: s.stacks.filter((st) => st.stackId !== stack.stackId) }));
      throw error;
    }
    return stack;
  },

  update: async (input) => {
    const previous = await storage.getById(input.stackId);
    const stack = await storage.update(input);
    set((s) => ({
      stacks: s.stacks.map((st) => (st.stackId === stack.stackId ? stack : st)),
    }));
    try {
      await upsertCloudStack(stack);
    } catch (error) {
      if (previous) {
        await storage.update(previous);
        set((s) => ({
          stacks: s.stacks.map((st) => (st.stackId === previous.stackId ? previous : st)),
        }));
      }
      throw error;
    }
    return stack;
  },

  delete: async (stackId) => {
    await deleteCloudStack(stackId);
    await storage.delete(stackId);
    set((s) => ({ stacks: s.stacks.filter((st) => st.stackId !== stackId) }));
  },

  duplicate: async (stackId) => {
    const stack = await storage.duplicate(stackId);
    set((s) => ({ stacks: [...s.stacks, stack] }));
    try {
      await upsertCloudStack(stack);
    } catch (error) {
      await storage.delete(stack.stackId);
      set((s) => ({ stacks: s.stacks.filter((st) => st.stackId !== stack.stackId) }));
      throw error;
    }
    return stack;
  },
}));
