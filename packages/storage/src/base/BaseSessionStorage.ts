// ---------------------------------------------------------------------------
// BaseSessionStorage — shared session history and active-session persistence.
//
// Subclasses supply:
//   getItem(key)      → Promise<string | null>
//   setItem(key, val) → Promise<void>
//   removeItem(key)   → Promise<void>
// ---------------------------------------------------------------------------

import type { Session, SessionRecord } from '@timer-stacks/core';
import type { ISessionStorage } from '../interfaces/ISessionStorage.js';
import { STORAGE_KEYS, HISTORY_LIMIT } from '../constants.js';

export abstract class BaseSessionStorage implements ISessionStorage {
  protected abstract getItem(key: string): Promise<string | null>;
  protected abstract setItem(key: string, value: string): Promise<void>;
  protected abstract removeItem(key: string): Promise<void>;

  private async readJSON<T>(key: string, fallback: T): Promise<T> {
    try {
      const raw = await this.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }

  private async writeJSON<T>(key: string, value: T): Promise<void> {
    await this.setItem(key, JSON.stringify(value));
  }

  async saveActiveSessions(sessions: Session[]): Promise<void> {
    await this.writeJSON(STORAGE_KEYS.activeSessions, sessions);
  }

  async loadActiveSessions(): Promise<Session[]> {
    return this.readJSON<Session[]>(STORAGE_KEYS.activeSessions, []);
  }

  async clearActiveSessions(): Promise<void> {
    await this.removeItem(STORAGE_KEYS.activeSessions);
  }

  async saveRecord(record: SessionRecord): Promise<void> {
    const history = await this.readJSON<SessionRecord[]>(STORAGE_KEYS.history, []);
    history.unshift(record);
    if (history.length > HISTORY_LIMIT) history.splice(HISTORY_LIMIT);
    await this.writeJSON(STORAGE_KEYS.history, history);
  }

  async getHistory(limit = 100): Promise<SessionRecord[]> {
    const history = await this.readJSON<SessionRecord[]>(STORAGE_KEYS.history, []);
    return history.slice(0, limit);
  }

  async deleteRecord(recordId: string): Promise<void> {
    const history = await this.readJSON<SessionRecord[]>(STORAGE_KEYS.history, []);
    await this.writeJSON(
      STORAGE_KEYS.history,
      history.filter((r) => r.recordId !== recordId),
    );
  }

  async clearHistory(): Promise<void> {
    await this.removeItem(STORAGE_KEYS.history);
  }
}
