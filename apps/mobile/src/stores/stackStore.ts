import { create } from 'zustand';
import type { TimerStack, CreateStackInput, UpdateStackInput } from '@timer-stacks/core';
import { AsyncStackStorage } from '../lib/storage.js';

const storage = new AsyncStackStorage();

interface StackState {
  stacks: TimerStack[];
  isLoading: boolean;
  load: () => Promise<void>;
  create: (input: CreateStackInput) => Promise<TimerStack>;
  update: (input: UpdateStackInput) => Promise<TimerStack>;
  delete: (stackId: string) => Promise<void>;
  duplicate: (stackId: string) => Promise<TimerStack>;
}

export const useStackStore = create<StackState>((set) => ({
  stacks: [],
  isLoading: false,

  load: async () => {
    set({ isLoading: true });
    await storage.seedIfEmpty();
    const stacks = await storage.getAll();
    set({ stacks, isLoading: false });
  },

  create: async (input) => {
    const stack = await storage.create(input);
    set((s) => ({ stacks: [...s.stacks, stack] }));
    return stack;
  },

  update: async (input) => {
    const stack = await storage.update(input);
    set((s) => ({
      stacks: s.stacks.map((st) => (st.stackId === stack.stackId ? stack : st)),
    }));
    return stack;
  },

  delete: async (stackId) => {
    await storage.delete(stackId);
    set((s) => ({ stacks: s.stacks.filter((st) => st.stackId !== stackId) }));
  },

  duplicate: async (stackId) => {
    const stack = await storage.duplicate(stackId);
    set((s) => ({ stacks: [...s.stacks, stack] }));
    return stack;
  },
}));
