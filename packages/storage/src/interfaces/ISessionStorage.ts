import type { Session, SessionRecord } from '@timer-stacks/core';

export interface ISessionStorage {
  /** Persist active/paused sessions so they survive app restart */
  saveActiveSessions(sessions: Session[]): Promise<void>;
  loadActiveSessions(): Promise<Session[]>;
  clearActiveSessions(): Promise<void>;

  /** History records (completed / cancelled) */
  saveRecord(record: SessionRecord): Promise<void>;
  getHistory(limit?: number): Promise<SessionRecord[]>;
  deleteRecord(recordId: string): Promise<void>;
  clearHistory(): Promise<void>;
}
