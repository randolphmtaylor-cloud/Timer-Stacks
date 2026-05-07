// ---------------------------------------------------------------------------
// Stack store — manages all TimerStack CRUD via Zustand + LocalStackStorage
// ---------------------------------------------------------------------------

import { create } from 'zustand';
import type { TimerStack, CreateStackInput, UpdateStackInput } from '@timer-stacks/core';
import { LocalStackStorage } from '../lib/storage.js';
import { deleteCloudStack, fetchCloudStacks, upsertCloudStack } from '../lib/cloudSync.js';

const storage = new LocalStackStorage();

interface StackState {
  stacks: TimerStack[];
  isLoading: boolean;

  // Actions
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
    console.info('[stack-store] Sync Now started: loading cloud stacks as source of truth');
    const cloudStacks = await fetchCloudStacks();
    console.info('[stack-store] Applying cloud stacks to local storage', {
      stackCount: cloudStacks.length,
      stackIds: cloudStacks.map((stack) => stack.stackId),
    });
    await storage.replaceAll(cloudStacks);
    console.info('[stack-store] Updating UI state with cloud stacks', {
      stackCount: cloudStacks.length,
    });
    set({ stacks: cloudStacks });
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

// Selectors
export const selectTemplates = (s: StackState) => s.stacks.filter((st) => st.isTemplate);
export const selectStacks = (s: StackState) => s.stacks.filter((st) => !st.isTemplate);
