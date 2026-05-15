// ---------------------------------------------------------------------------
// Desktop session store
// ---------------------------------------------------------------------------

import { create } from 'zustand';
import type { Session, TimerStack, SessionRecord, SessionState } from '@timer-stacks/core';
import {
  buildSegmentTransitionMessage,
  computeSessionState,
  SessionManager,
  sessionToRecord,
} from '@timer-stacks/core';
import { LocalSessionStorage } from '../lib/storage.js';
import { saveCloudSessionRecord } from '../lib/cloudSync.js';
import {
  ensureNotificationPermission,
  notifyStackComplete,
  notifyTimerComplete,
} from '../lib/notifications.js';
import { vibrateSegmentComplete, vibrateStackComplete } from '../lib/haptics.js';
import {
  isAudioUnlocked,
  playSegmentCompleteSound,
  playStackCompleteSound,
  unlockAudio,
} from '../lib/sounds.js';
import { useSettingsStore } from './settingsStore.js';
import { useStackStore } from './stackStore.js';

const persistedStorage = new LocalSessionStorage();
export const sessionManager = new SessionManager();
const deliveredCompletions = new Set<string>();
const persistedRecords = new Set<string>();

function unlockSoundFromUserGesture(): void {
  const { soundEnabled } = useSettingsStore.getState();
  if (soundEnabled && !isAudioUnlocked()) {
    unlockAudio().catch((error) => {
      console.error('[audio] Failed to unlock audio from timer control', error);
    });
  }
}

function isActiveSession(session: Session): boolean {
  return (
    (session.status === 'running' || session.status === 'paused') &&
    session.completedAt === null
  );
}

function activeSessionsOnly(sessions: Session[]): Session[] {
  return sessions.filter(isActiveSession);
}

async function persistCompletedSession(session: Session, stack: TimerStack): Promise<void> {
  if (persistedRecords.has(session.sessionId)) return;
  const history = await persistedStorage.getHistory();
  if (history.some((record) => record.sessionId === session.sessionId)) {
    persistedRecords.add(session.sessionId);
    return;
  }

  const record = sessionToRecord(session, stack, Date.now());
  await persistedStorage.saveRecord(record);
  persistedRecords.add(session.sessionId);
  saveCloudSessionRecord(record).catch((error) => {
    console.error('[session-store] Failed to sync completed session record', error);
  });
  useSessionStore.setState((state) => ({ history: [record, ...state.history] }));
  console.info('[session-store] Persisted completed session record', {
    sessionId: session.sessionId,
    stackId: session.stackId,
    status: record.status,
  });
}

async function finalizeStoredSessions(
  sessions: Session[],
  stacks: TimerStack[],
): Promise<Session[]> {
  const stackById = new Map(stacks.map((stack) => [stack.stackId, stack]));
  const active: Session[] = [];

  for (const session of sessions) {
    const stack = stackById.get(session.stackId);
    if (!stack) {
      console.warn('[session-store] Dropping stored session with missing stack', {
        sessionId: session.sessionId,
        stackId: session.stackId,
      });
      continue;
    }

    if (session.status === 'completed' || session.completedAt !== null) {
      await persistCompletedSession({ ...session, status: 'completed' }, stack);
      continue;
    }

    if (session.status === 'running') {
      const state = computeSessionState(session, stack, Date.now());
      if (state.stackRemainingMs <= 0) {
        const completedAt = session.startedAt !== null
          ? session.startedAt + session.totalPausedMs + stack.totalDurationMs
          : Date.now();
        await persistCompletedSession(
          { ...session, status: 'completed', completedAt },
          stack,
        );
        continue;
      }
    }

    if (isActiveSession(session)) active.push(session);
  }

  return active;
}

// ---------------------------------------------------------------------------
// Wire engine events → notifications + store sync
// ---------------------------------------------------------------------------
sessionManager.subscribe(async (events) => {
  for (const event of events) {
    switch (event.type) {
      case 'segment_completed': {
        const nextStarted = events.find(
          (candidate) =>
            candidate.type === 'segment_started' &&
            candidate.segmentIndex === event.segmentIndex + 1,
        );
        if (!nextStarted || nextStarted.type !== 'segment_started') break;
        const key = `${event.session.sessionId}:segment:${event.segmentIndex}`;
        if (deliveredCompletions.has(key)) break;
        deliveredCompletions.add(key);
        const { notificationsEnabled, soundEnabled } = useSettingsStore.getState();
        const msg = buildSegmentTransitionMessage(event.segmentLabel, nextStarted.segmentLabel);
        console.info('[session-store] Segment completed', {
          sessionId: event.session.sessionId,
          segmentIndex: event.segmentIndex,
          segmentLabel: event.segmentLabel,
          notificationsEnabled,
          soundEnabled,
        });
        vibrateSegmentComplete();
        if (soundEnabled) {
          const played = playSegmentCompleteSound();
          console.info('[session-store] Segment sound playback result', { played });
        }
        if (notificationsEnabled) {
          await notifyTimerComplete(msg.title, msg.body);
        }
        break;
      }
      case 'stack_completed': {
        const key = `${event.session.sessionId}:stack`;
        if (deliveredCompletions.has(key)) break;
        deliveredCompletions.add(key);
        const { notificationsEnabled, soundEnabled } = useSettingsStore.getState();
        console.info('[session-store] Stack completed', {
          sessionId: event.session.sessionId,
          stackName: event.stackName,
          notificationsEnabled,
          soundEnabled,
        });
        vibrateStackComplete();
        if (soundEnabled) {
          const played = playStackCompleteSound();
          console.info('[session-store] Stack sound playback result', { played });
        }
        if (notificationsEnabled) {
          await notifyStackComplete('Stack complete', `${event.stackName} is complete.`);
        }
        const stack = useStackStore.getState().stacks.find((item) => item.stackId === event.session.stackId);
        if (stack) {
          await persistCompletedSession(event.session, stack);
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
    unlockSoundFromUserGesture();
    const session = sessionManager.start(stack);
    set((s) => ({
      sessions: [...activeSessionsOnly(s.sessions).filter((x) => x.sessionId !== session.sessionId), session],
    }));
    console.info('[session-store] Session started', {
      sessionId: session.sessionId,
      stackId: stack.stackId,
      stackName: stack.name,
    });
    if (useSettingsStore.getState().notificationsEnabled) {
      ensureNotificationPermission().catch(() => {});
    }
    return session;
  },

  pause: (sessionId) => {
    unlockSoundFromUserGesture();
    sessionManager.pause(sessionId);
    get().syncFromManager();
  },
  resume: (sessionId) => {
    unlockSoundFromUserGesture();
    sessionManager.resume(sessionId);
    get().syncFromManager();
  },
  skip: (sessionId) => {
    unlockSoundFromUserGesture();
    sessionManager.skip(sessionId);
    get().syncFromManager();
  },
  resetSegment: (sessionId) => {
    unlockSoundFromUserGesture();
    sessionManager.resetSegment(sessionId);
    get().syncFromManager();
  },
  previousSegment: (sessionId) => {
    unlockSoundFromUserGesture();
    sessionManager.previousSegment(sessionId);
    get().syncFromManager();
  },
  reset: (sessionId) => {
    unlockSoundFromUserGesture();
    sessionManager.reset(sessionId);
    get().syncFromManager();
  },

  cancel: async (sessionId, stack) => {
    const session = sessionManager.getSession(sessionId);
    if (session && session.startedAt !== null) {
      const record = sessionToRecord(session, stack, Date.now());
      await persistedStorage.saveRecord(record);
      saveCloudSessionRecord(record).catch(() => {});
      set((s) => ({ history: [record, ...s.history] }));
    }
    sessionManager.cancel(sessionId);
    const active = activeSessionsOnly(sessionManager.getAllSessions());
    set((s) => ({
      sessions: s.sessions.filter((x) => x.sessionId !== sessionId && isActiveSession(x)),
    }));
    persistedStorage.saveActiveSessions(active).catch((error) => {
      console.error('[session-store] Failed to persist active sessions after cancel', error);
    });
  },

  syncFromManager: () => {
    const all = activeSessionsOnly(sessionManager.getAllSessions());
    set({ sessions: all });
    persistedStorage.saveActiveSessions(all).catch(() => {});
  },

  loadHistory: async () => {
    const history = await persistedStorage.getHistory();
    set({ history });
  },

  hydrate: async (stacks) => {
    const saved = await persistedStorage.loadActiveSessions();
    const active = await finalizeStoredSessions(saved, stacks);
    await persistedStorage.saveActiveSessions(active);
    console.info('[session-store] Hydrating active sessions', {
      storedCount: saved.length,
      activeCount: active.length,
    });
    if (active.length > 0) {
      sessionManager.hydrate(active, stacks);
    }
    set({ sessions: activeSessionsOnly(sessionManager.getAllSessions()) });
  },

  getSessionState: (sessionId) => sessionManager.getSessionState(sessionId),
}));
