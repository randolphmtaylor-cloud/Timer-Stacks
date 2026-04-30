// ---------------------------------------------------------------------------
// Desktop session store
// ---------------------------------------------------------------------------

import { create } from 'zustand';
import type { Session, TimerStack, SessionRecord, SessionState } from '@timer-stacks/core';
import { SessionManager, sessionToRecord } from '@timer-stacks/core';
import { LocalSessionStorage } from '../lib/storage.js';
import { saveCloudSessionRecord } from '../lib/cloudSync.js';
import {
  ensureNotificationPermission,
  notifyStackComplete,
  notifyTimerComplete,
} from '../lib/notifications.js';
import { vibrateSegmentComplete, vibrateStackComplete } from '../lib/haptics.js';
import {
  playSegmentCompleteSound,
  playStackCompleteSound,
  unlockNotificationAudio,
} from '../lib/sounds.js';
import { useSettingsStore } from './settingsStore.js';

const persistedStorage = new LocalSessionStorage();
export const sessionManager = new SessionManager();
const deliveredCompletions = new Set<string>();

// ---------------------------------------------------------------------------
// Wire engine events → notifications + store sync
// ---------------------------------------------------------------------------
sessionManager.subscribe(async (events) => {
  for (const event of events) {
    switch (event.type) {
      case 'segment_completed': {
        const key = `${event.session.sessionId}:segment:${event.segmentIndex}`;
        if (deliveredCompletions.has(key)) break;
        deliveredCompletions.add(key);
        const { notificationsEnabled, soundEnabled } = useSettingsStore.getState();
        vibrateSegmentComplete();
        if (soundEnabled) playSegmentCompleteSound();
        if (notificationsEnabled) {
          await notifyTimerComplete('Segment complete', `${event.segmentLabel} is done.`);
        }
        break;
      }
      case 'stack_completed': {
        const key = `${event.session.sessionId}:stack`;
        if (deliveredCompletions.has(key)) break;
        deliveredCompletions.add(key);
        const { notificationsEnabled, soundEnabled } = useSettingsStore.getState();
        vibrateStackComplete();
        if (soundEnabled) playStackCompleteSound();
        if (notificationsEnabled) {
          await notifyStackComplete('Stack complete', `${event.stackName} is complete.`);
        }
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
  resetSegment: (sessionId: string) => void;
  previousSegment: (sessionId: string) => void;
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
    unlockNotificationAudio().catch(() => {});
    if (useSettingsStore.getState().notificationsEnabled) {
      ensureNotificationPermission().catch(() => {});
    }
    return session;
  },

  pause: (sessionId) => {
    unlockNotificationAudio().catch(() => {});
    sessionManager.pause(sessionId);
    get().syncFromManager();
  },
  resume: (sessionId) => {
    unlockNotificationAudio().catch(() => {});
    sessionManager.resume(sessionId);
    get().syncFromManager();
  },
  skip: (sessionId) => {
    unlockNotificationAudio().catch(() => {});
    sessionManager.skip(sessionId);
    get().syncFromManager();
  },
  resetSegment: (sessionId) => {
    unlockNotificationAudio().catch(() => {});
    sessionManager.resetSegment(sessionId);
    get().syncFromManager();
  },
  previousSegment: (sessionId) => {
    unlockNotificationAudio().catch(() => {});
    sessionManager.previousSegment(sessionId);
    get().syncFromManager();
  },
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
