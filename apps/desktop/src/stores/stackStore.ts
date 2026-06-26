// ---------------------------------------------------------------------------
// Stack store — manages all TimerStack CRUD via Zustand + LocalStackStorage
// ---------------------------------------------------------------------------

import { create } from 'zustand';
import type { TimerStack, CreateStackInput, UpdateStackInput } from '@timer-stacks/core';
import { LocalStackStorage } from '../lib/storage.js';
import {
  deleteCloudStack,
  fetchCloudStackState,
  upsertCloudStack,
  upsertCloudStacks,
} from '../lib/cloudSync.js';

const storage = new LocalStackStorage();

type MergeResult = {
  stacks: TimerStack[];
  localOnlyStackIds: string[];
  cloudOnlyStackIds: string[];
  conflictsResolved: Array<{
    stackId: string;
    kept: 'local' | 'cloud';
    localUpdatedAt: number;
    cloudUpdatedAt: number;
  }>;
};

function mergeStacksByUpdatedAt(localStacks: TimerStack[], cloudStacks: TimerStack[]): MergeResult {
  const merged = new Map<string, TimerStack>();
  const localIds = new Set(localStacks.map((stack) => stack.stackId));
  const cloudOnlyStackIds: string[] = [];
  const localOnlyStackIds: string[] = [];
  const conflictsResolved: MergeResult['conflictsResolved'] = [];

  for (const stack of cloudStacks) {
    merged.set(stack.stackId, stack);
    if (!localIds.has(stack.stackId)) {
      cloudOnlyStackIds.push(stack.stackId);
    }
  }

  for (const localStack of localStacks) {
    const cloudStack = merged.get(localStack.stackId);

    if (!cloudStack) {
      merged.set(localStack.stackId, localStack);
      localOnlyStackIds.push(localStack.stackId);
      continue;
    }

    const keepLocal = localStack.updatedAt > cloudStack.updatedAt;
    const keepCloud = cloudStack.updatedAt > localStack.updatedAt;

    if (keepLocal || keepCloud) {
      conflictsResolved.push({
        stackId: localStack.stackId,
        kept: keepLocal ? 'local' : 'cloud',
        localUpdatedAt: localStack.updatedAt,
        cloudUpdatedAt: cloudStack.updatedAt,
      });
    }

    if (keepLocal) {
      merged.set(localStack.stackId, localStack);
    }
  }

  return {
    stacks: [...merged.values()].sort((a, b) => b.updatedAt - a.updatedAt),
    localOnlyStackIds,
    cloudOnlyStackIds,
    conflictsResolved,
  };
}

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
    const stacks = await storage.getAll();
    set({ stacks, isLoading: false });
    try {
      await get().syncCloud();
    } catch (error) {
      console.error('[stack-store] Initial cloud sync failed', error);
      if (stacks.length === 0) {
        await storage.seedIfEmpty();
        const seededStacks = await storage.getAll();
        set({ stacks: seededStacks });
      }
    }
  },

  syncCloud: async () => {
    console.info('[stack-store] Sync Now started: loading and merging cloud/local stacks');
    const localStacks = await storage.getAll();
    const { stacks: cloudStacks, deletedStackIds } = await fetchCloudStackState();
    const deletedStackIdSet = new Set(deletedStackIds);

    const {
      stacks: mergedStacks,
      localOnlyStackIds,
      cloudOnlyStackIds,
      conflictsResolved,
    } = mergeStacksByUpdatedAt(
      localStacks.filter((stack) => !deletedStackIdSet.has(stack.stackId)),
      cloudStacks,
    );

    console.info('[stack-store] Merged cloud/local stacks', {
      localStackCount: localStacks.length,
      cloudStackCount: cloudStacks.length,
      mergedStackCount: mergedStacks.length,
      localOnlyStackCount: localOnlyStackIds.length,
      cloudOnlyStackCount: cloudOnlyStackIds.length,
      localOnlyStackIds,
      cloudOnlyStackIds,
      deletedStackIds,
      conflictsResolvedCount: conflictsResolved.length,
      conflictsResolved,
    });

    // Re-read local stacks to capture any stacks created while the network
    // request was in flight. Without this, a newly created stack can be wiped
    // because `localStacks` above was a snapshot taken before the create ran.
    const postSyncLocalStacks = await storage.getAll();
    const mergedIds = new Set(mergedStacks.map((s) => s.stackId));
    const lateAdditions = postSyncLocalStacks.filter(
      (s) => !mergedIds.has(s.stackId) && !deletedStackIdSet.has(s.stackId),
    );
    const finalStacks = lateAdditions.length > 0
      ? [...mergedStacks, ...lateAdditions]
      : mergedStacks;

    if (lateAdditions.length > 0) {
      console.info('[stack-store] Preserved stacks created during sync window', {
        lateAdditionCount: lateAdditions.length,
        lateAdditionIds: lateAdditions.map((s) => s.stackId),
      });
    }

    await storage.replaceAll(finalStacks);
    console.info('[stack-store] Updating UI state with merged stacks', {
      stackCount: finalStacks.length,
    });
    set({ stacks: finalStacks });

    const uploadedStacks = await upsertCloudStacks(finalStacks);
    console.info('[stack-store] Uploaded merged stacks to cloud', {
      uploadedStackCount: mergedStacks.length,
      returnedCloudStackCount: uploadedStacks.length,
    });
  },

  create: async (input) => {
    const stack = await storage.create(input);
    set((s) => ({ stacks: [...s.stacks, stack] }));
    // Fire-and-forget cloud sync — a failure must not roll back the local
    // create, because that would wipe the stack while the session is running.
    // The next syncCloud call will push it to the cloud.
    upsertCloudStack(stack).catch((error) => {
      console.error('[stack-store] Failed to sync new stack to cloud (will retry on next sync)', error);
    });
    return stack;
  },

  update: async (input) => {
    const stack = await storage.update(input);
    set((s) => ({
      stacks: s.stacks.map((st) => (st.stackId === stack.stackId ? stack : st)),
    }));
    upsertCloudStack(stack).catch((error) => {
      console.error('[stack-store] Failed to sync updated stack to cloud (will retry on next sync)', error);
    });
    return stack;
  },

  delete: async (stackId) => {
    // Delete locally first so the UI is never blocked by a network failure.
    await storage.delete(stackId);
    set((s) => ({ stacks: s.stacks.filter((st) => st.stackId !== stackId) }));
    deleteCloudStack(stackId).catch((error) => {
      console.error('[stack-store] Failed to delete stack from cloud', error);
    });
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

// Selectors
export const selectTemplates = (s: StackState) => s.stacks.filter((st) => st.isTemplate);
export const selectStacks = (s: StackState) => s.stacks.filter((st) => !st.isTemplate);
