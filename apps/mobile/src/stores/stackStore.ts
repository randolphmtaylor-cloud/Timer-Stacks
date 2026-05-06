import { create } from 'zustand';
import type { TimerStack, CreateStackInput, UpdateStackInput } from '@timer-stacks/core';
import { AsyncStackStorage } from '../lib/storage.js';
import { deleteCloudStack, mergeCloudStacks, upsertCloudStack } from '../lib/cloudSync.js';

const storage = new AsyncStackStorage();

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
    await storage.seedIfEmpty();
    const stacks = await storage.getAll();
    set({ stacks, isLoading: false });
    get().syncCloud().catch(() => {});
  },

  syncCloud: async () => {
    const localStacks = await storage.getAll();
    const stacks = await mergeCloudStacks(localStacks);
    await storage.replaceAll(stacks);
    set({ stacks });
  },

  create: async (input) => {
    const stack = await storage.create(input);
    set((s) => ({ stacks: [...s.stacks, stack] }));
    upsertCloudStack(stack).catch(() => {});
    return stack;
  },

  update: async (input) => {
    const stack = await storage.update(input);
    set((s) => ({
      stacks: s.stacks.map((st) => (st.stackId === stack.stackId ? stack : st)),
    }));
    upsertCloudStack(stack).catch(() => {});
    return stack;
  },

  delete: async (stackId) => {
    await storage.delete(stackId);
    set((s) => ({ stacks: s.stacks.filter((st) => st.stackId !== stackId) }));
    deleteCloudStack(stackId).catch(() => {});
  },

  duplicate: async (stackId) => {
    const stack = await storage.duplicate(stackId);
    set((s) => ({ stacks: [...s.stacks, stack] }));
    upsertCloudStack(stack).catch(() => {});
    return stack;
  },
}));
