// ---------------------------------------------------------------------------
// Stack store — manages all TimerStack CRUD via Zustand + LocalStackStorage
// ---------------------------------------------------------------------------

import { create } from 'zustand';
import type { TimerStack, CreateStackInput, UpdateStackInput } from '@timer-stacks/core';
import { LocalStackStorage } from '../lib/storage.js';
import { deleteCloudStack, mergeCloudStacks, upsertCloudStack } from '../lib/cloudSync.js';
import { useAuthStore } from './authStore.js';

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
    if (useAuthStore.getState().user) {
      get().syncCloud().catch(() => {});
    }
  },

  syncCloud: async () => {
    const { user, isConfigured } = useAuthStore.getState();
    if (!isConfigured || !user) return;

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

// Selectors
export const selectTemplates = (s: StackState) => s.stacks.filter((st) => st.isTemplate);
export const selectStacks = (s: StackState) => s.stacks.filter((st) => !st.isTemplate);
