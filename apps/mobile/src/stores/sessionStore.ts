// ---------------------------------------------------------------------------
// Mobile session store
// ---------------------------------------------------------------------------

import { create } from 'zustand';
import type { Session, TimerStack, SessionRecord, SessionState } from '@timer-stacks/core';
import {
  SessionManager,
  sessionToRecord,
  buildSegmentTransitionMessage,
  buildStackCompletedMessage,
} from '@timer-stacks/core';
import { AsyncSessionStorage } from '../lib/storage.js';
import { ExpoNotificationService } from '../lib/notifications.js';
import { saveCloudSessionRecord } from '../lib/cloudSync.js';

const persistedStorage = new AsyncSessionStorage();
const notificationService = new ExpoNotificationService();
export const sessionManager = new SessionManager();

// ---------------------------------------------------------------------------
// Wire engine events → notifications + store sync
// ---------------------------------------------------------------------------
sessionManager.subscribe(async (events) => {
  for (const event of events) {
    switch (event.type) {
      case 'segment_completed': {
        const nextStarted = events.find(
          (e) => e.type === 'segment_started' && e.segmentIndex === event.segmentIndex + 1,
        );
        if (nextStarted && nextStarted.type === 'segment_started') {
          const msg = buildSegmentTransitionMessage(event.segmentLabel, nextStarted.segmentLabel);
          await notificationService.show({ title: msg.title, body: msg.body, sound: 'chime' });
        }
        break;
      }
      case 'stack_completed': {
        const msg = buildStackCompletedMessage(event.stackName);
        await notificationService.show({ title: msg.title, body: msg.body, sound: 'complete' });
        break;
      }
    }
  }
  useSessionStore.getState().syncFromManager();
});

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

interface SessionStoreState {
  sessions: Session[];
  history: SessionRecord[];

  start: (stack: TimerStack) => Session;
  pause: (sessionId: string) => void;
  resume: (sessionId: string) => void;
  skip: (sessionId: string) => void;
  reset: (sessionId: string) => void;
  cancel: (sessionId: string, stack: TimerStack) => Promise<void>;

  syncFromManager: () => void;
  loadHistory: () => Promise<void>;
  hydrate: (stacks: TimerStack[]) => Promise<void>;
  getSessionState: (sessionId: string) => SessionState | null;
}

export const useSessionStore = create<SessionStoreState>((set, get) => ({
  sessions: [],
  history: [],

  start: (stack) => {
    const session = sessionManager.start(stack);
    set((s) => ({
      sessions: [...s.sessions.filter((x) => x.sessionId !== session.sessionId), session],
    }));
    notificationService.requestPermission().catch(() => {});
    return session;
  },

  pause: (sessionId) => { sessionManager.pause(sessionId); get().syncFromManager(); },
  resume: (sessionId) => { sessionManager.resume(sessionId); get().syncFromManager(); },
  skip: (sessionId) => { sessionManager.skip(sessionId); get().syncFromManager(); },
  reset: (sessionId) => { sessionManager.reset(sessionId); get().syncFromManager(); },

  cancel: async (sessionId, stack) => {
    const session = sessionManager.getSession(sessionId);
    if (session && session.startedAt !== null) {
      const record = sessionToRecord(session, stack, Date.now());
      await persistedStorage.saveRecord(record);
      saveCloudSessionRecord(record).catch(() => {});
      set((s) => ({ history: [record, ...s.history] }));
    }
    sessionManager.cancel(sessionId);
    set((s) => ({ sessions: s.sessions.filter((x) => x.sessionId !== sessionId) }));
  },

  syncFromManager: () => {
    const all = sessionManager.getAllSessions();
    set({ sessions: all });
    persistedStorage.saveActiveSessions(all).catch(() => {});
  },

  loadHistory: async () => {
    const history = await persistedStorage.getHistory();
    set({ history });
  },

  hydrate: async (stacks) => {
    const saved = await persistedStorage.loadActiveSessions();
    if (saved.length > 0) {
      sessionManager.hydrate(saved, stacks);
      set({ sessions: sessionManager.getAllSessions() });
    }
  },

  getSessionState: (sessionId) => sessionManager.getSessionState(sessionId),
}));
