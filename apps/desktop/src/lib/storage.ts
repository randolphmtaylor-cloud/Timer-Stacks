// ---------------------------------------------------------------------------
// Desktop storage — thin localStorage adapters over the shared base classes.
// All CRUD logic lives in packages/storage/src/base/*.
// ---------------------------------------------------------------------------

import type { TimerStack } from '@timer-stacks/core';
import { BaseStackStorage, BaseSessionStorage, STORAGE_KEYS } from '@timer-stacks/storage';

// ---------------------------------------------------------------------------
// Sync localStorage primitives wrapped as async to satisfy base class API
// ---------------------------------------------------------------------------

function lsGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch (error) {
    console.error('[storage] localStorage read failed', { key, error });
    return null;
  }
}
function lsSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch (error) {
    console.error('[storage] localStorage write failed', {
      key,
      bytes: value.length,
      error,
    });
    throw error;
  }
}
function lsRemove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.error('[storage] localStorage remove failed', { key, error });
  }
}
function lsReadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = lsGet(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch (error) {
    console.error('[storage] localStorage JSON parse failed', { key, error });
    return fallback;
  }
}

// ---------------------------------------------------------------------------
// Stack storage
// ---------------------------------------------------------------------------

export class LocalStackStorage extends BaseStackStorage {
  protected async readAll(): Promise<TimerStack[]> {
    return lsReadJSON<TimerStack[]>(STORAGE_KEYS.stacks, []);
  }

  protected async writeAll(stacks: TimerStack[]): Promise<void> {
    console.info('[storage] Persisting stacks to localStorage', {
      key: STORAGE_KEYS.stacks,
      stackCount: stacks.length,
    });
    lsSet(STORAGE_KEYS.stacks, JSON.stringify(stacks));
  }

  async replaceAll(stacks: TimerStack[]): Promise<void> {
    await this.writeAll(stacks);
    console.info('[storage] Replaced all local stacks', {
      stackCount: stacks.length,
      stackIds: stacks.map((stack) => stack.stackId),
    });
  }
}

// ---------------------------------------------------------------------------
// Session storage
// ---------------------------------------------------------------------------

export class LocalSessionStorage extends BaseSessionStorage {
  protected async getItem(key: string): Promise<string | null> {
    return lsGet(key);
  }
  protected async setItem(key: string, value: string): Promise<void> {
    lsSet(key, value);
  }
  protected async removeItem(key: string): Promise<void> {
    lsRemove(key);
  }
}
