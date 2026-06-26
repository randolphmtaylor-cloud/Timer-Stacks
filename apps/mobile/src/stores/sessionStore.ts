// ---------------------------------------------------------------------------
// Mobile session store
// ---------------------------------------------------------------------------

import { create } from 'zustand';
import { Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import type { Session, TimerStack, SessionRecord, SessionState } from '@timer-stacks/core';
import {
  computeSessionState,
  SessionManager,
  sessionToRecord,
  buildSegmentTransitionMessage,
  buildStackCompletedMessage,
} from '@timer-stacks/core';
import { AsyncSessionStorage } from '../lib/storage.js';
import { ExpoNotificationService } from '../lib/notifications.js';
import { saveCloudSessionRecord } from '../lib/cloudSync.js';
import { watchBridge, buildWatchSnapshot } from '../lib/watchConnectivity.js';
import { useSettingsStore } from './settingsStore.js';
import { useStackStore } from './stackStore.js';

const persistedStorage = new AsyncSessionStorage();
const notificationService = new ExpoNotificationService();
export const sessionManager = new SessionManager();
const deliveredCompletions = new Set<string>();
const persistedRecords = new Set<string>();

function pushWatchSnapshot(session: Session, stack: TimerStack): void {
  try {
    const state = computeSessionState(session, stack, Date.now());
    watchBridge.sendSessionSnapshot(
      buildWatchSnapshot(session, stack, {
        activeSegmentIndex: session.activeSegmentIndex,
        segmentRemainingMs: state.segmentRemainingMs,
        totalRemainingMs:   state.stackRemainingMs,
      }),
    );
  } catch {
    // Never throw — watch sync is best-effort
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

function showInAppAlert(title: string, body: string): void {
  Alert.alert(title, body);
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
    if (!stack) continue;

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
        const key = `${event.session.sessionId}:segment:${event.segmentIndex}`;
        if (deliveredCompletions.has(key)) break;
        deliveredCompletions.add(key);
        const nextStarted = events.find(
          (e) => e.type === 'segment_started' && e.segmentIndex === event.segmentIndex + 1,
        );
        const { notificationsEnabled, soundEnabled } = useSettingsStore.getState();
        console.info('[session-store] Segment completed', {
          sessionId: event.session.sessionId,
          segmentIndex: event.segmentIndex,
          segmentLabel: event.segmentLabel,
          notificationsEnabled,
          soundEnabled,
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
        if (nextStarted && nextStarted.type === 'segment_started') {
          const msg = buildSegmentTransitionMessage(event.segmentLabel, nextStarted.segmentLabel);
          if (notificationsEnabled) {
            const delivered = await notificationService.show({
              title: msg.title,
              body: msg.body,
              sound: soundEnabled ? 'chime' : 'tick',
            });
            if (!delivered) showInAppAlert(msg.title, msg.body);
          } else {
            showInAppAlert(msg.title, msg.body);
          }
          // Push updated snapshot so the watch advances to the new segment
          const stk = useStackStore.getState().stacks.find((s) => s.stackId === event.session.stackId);
          if (stk) pushWatchSnapshot(event.session, stk);
        }
        break;
      }
      case 'stack_completed': {
        const key = `${event.session.sessionId}:stack`;
        if (deliveredCompletions.has(key)) break;
        deliveredCompletions.add(key);
        const msg = buildStackCompletedMessage(event.stackName);
        const { notificationsEnabled, soundEnabled } = useSettingsStore.getState();
        console.info('[session-store] Stack completed', {
          sessionId: event.session.sessionId,
          stackName: event.stackName,
          notificationsEnabled,
          soundEnabled,
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        if (notificationsEnabled) {
          const delivered = await notificationService.show({
            title: msg.title,
            body: msg.body,
            sound: soundEnabled ? 'complete' : 'tick',
          });
          if (!delivered) showInAppAlert(msg.title, msg.body);
        } else {
          showInAppAlert(msg.title, msg.body);
        }
        const stack = useStackStore.getState().stacks.find((item) => item.stackId === event.session.stackId);
        if (stack) {
          await persistCompletedSession(event.session, stack);
          pushWatchSnapshot({ ...event.session, status: 'completed' }, stack);
        }
        break;
      }
    }
  }
  useSessionStore.getState().syncFromManager();
});

// Wire watch → phone action commands.
// The watch can pause / resume / skip / stop. After applying the action the
// store pushes a fresh snapshot so the watch display updates immediately.
watchBridge.onAction((action, sessionId) => {
  const store = useSessionStore.getState();
  switch (action) {
    case 'pause':       store.pause(sessionId);       break;
    case 'resume':      store.resume(sessionId);      break;
    case 'skipSegment': store.skip(sessionId);        break;
    case 'stopSession': {
      const stack = useStackStore.getState().stacks.find(
        (s) => s.stackId === sessionManager.getSession(sessionId)?.stackId,
      );
      if (stack) store.cancel(sessionId, stack).catch(() => {});
      break;
    }
  }
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
      sessions: [...activeSessionsOnly(s.sessions).filter((x) => x.sessionId !== session.sessionId), session],
    }));
    console.info('[session-store] Session started', {
      sessionId: session.sessionId,
      stackId: stack.stackId,
      stackName: stack.name,
    });
    if (useSettingsStore.getState().notificationsEnabled) {
      notificationService.requestPermission().catch(() => {});
    }
    pushWatchSnapshot(session, stack);
    return session;
  },

  pause: (sessionId) => {
    sessionManager.pause(sessionId);
    get().syncFromManager();
    const session = sessionManager.getSession(sessionId);
    const stack = useStackStore.getState().stacks.find((s) => s.stackId === session?.stackId);
    if (session && stack) pushWatchSnapshot(session, stack);
  },

  resume: (sessionId) => {
    sessionManager.resume(sessionId);
    get().syncFromManager();
    const session = sessionManager.getSession(sessionId);
    const stack = useStackStore.getState().stacks.find((s) => s.stackId === session?.stackId);
    if (session && stack) pushWatchSnapshot(session, stack);
  },

  skip: (sessionId) => {
    sessionManager.skip(sessionId);
    get().syncFromManager();
    const session = sessionManager.getSession(sessionId);
    const stack = useStackStore.getState().stacks.find((s) => s.stackId === session?.stackId);
    if (session && stack) pushWatchSnapshot(session, stack);
  },

  resetSegment: (sessionId) => { sessionManager.resetSegment(sessionId); get().syncFromManager(); },
  previousSegment: (sessionId) => { sessionManager.previousSegment(sessionId); get().syncFromManager(); },
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
    const active = activeSessionsOnly(sessionManager.getAllSessions());
    set((s) => ({
      sessions: s.sessions.filter((x) => x.sessionId !== sessionId && isActiveSession(x)),
    }));
    persistedStorage.saveActiveSessions(active).catch((error) => {
      console.error('[session-store] Failed to persist active sessions after cancel', error);
    });
    // Push a terminal snapshot so the watch shows completion state
    if (session) pushWatchSnapshot({ ...session, status: 'cancelled' }, stack);
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
