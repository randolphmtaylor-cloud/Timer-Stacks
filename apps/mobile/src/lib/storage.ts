// ---------------------------------------------------------------------------
// Mobile storage — thin AsyncStorage adapters over the shared base classes.
// All CRUD logic lives in packages/storage/src/base/*.
// ---------------------------------------------------------------------------

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { TimerStack } from '@timer-stacks/core';
import { BaseStackStorage, BaseSessionStorage, STORAGE_KEYS } from '@timer-stacks/storage';

// ---------------------------------------------------------------------------
// Stack storage
// ---------------------------------------------------------------------------

export class AsyncStackStorage extends BaseStackStorage {
  protected async readAll(): Promise<TimerStack[]> {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEYS.stacks);
      if (!raw) return [];
      return JSON.parse(raw) as TimerStack[];
    } catch {
      return [];
    }
  }

  protected async writeAll(stacks: TimerStack[]): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.stacks, JSON.stringify(stacks));
  }
}

// ---------------------------------------------------------------------------
// Session storage
// ---------------------------------------------------------------------------

export class AsyncSessionStorage extends BaseSessionStorage {
  protected async getItem(key: string): Promise<string | null> {
    return AsyncStorage.getItem(key);
  }
  protected async setItem(key: string, value: string): Promise<void> {
    await AsyncStorage.setItem(key, value);
  }
  protected async removeItem(key: string): Promise<void> {
    await AsyncStorage.removeItem(key);
  }
}
