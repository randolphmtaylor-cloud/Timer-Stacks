// ---------------------------------------------------------------------------
// Quick-timer store — independent from Timer Stacks session logic.
// Uses wall-clock timestamps (same pattern as SessionManager) so the timer
// stays accurate across sleep, focus loss, and app reload.
// ---------------------------------------------------------------------------

import { create } from 'zustand';
import { playCompletionSound } from '../lib/sounds.js';
import { notifyTimerComplete } from '../lib/notifications.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TimerPreset {
  id: string;
  name: string;
  durationSeconds: number;
  icon?: string;
  color?: string;
  createdAt: number;
  order: number;
}

export type QuickTimerStatus = 'idle' | 'running' | 'paused' | 'completed';

export interface QuickTimerState {
  durationSeconds: number;
  startedAt: number | null;
  pausedAt: number | null;
  totalPausedMs: number;
  status: QuickTimerStatus;
  completedAt: number | null;
  activePresetId: string | null;
}

export interface TimerSettings {
  soundEnabled: boolean;
  notificationsEnabled: boolean;
  autoRepeat: boolean;
}

// ---------------------------------------------------------------------------
// Pure computation
// ---------------------------------------------------------------------------

export function computeRemainingMs(timer: QuickTimerState): number {
  const totalMs = timer.durationSeconds * 1000;
  if (timer.status === 'idle') return totalMs;
  if (timer.status === 'completed') return 0;
  const ref =
    timer.status === 'paused' ? (timer.pausedAt ?? Date.now()) : Date.now();
  const elapsed =
    ref - (timer.startedAt ?? ref) - timer.totalPausedMs;
  return Math.max(0, totalMs - elapsed);
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_PRESETS: TimerPreset[] = [
  { id: 'default-30s',       name: '30 Seconds',      durationSeconds: 30,   icon: '⚡', color: '#f97316', createdAt: 0, order: 0 },
  { id: 'default-1m',        name: '1 Minute',         durationSeconds: 60,   icon: '🕐', color: '#f59e0b', createdAt: 0, order: 1 },
  { id: 'default-5m',        name: '5 Minutes',        durationSeconds: 300,  icon: '🎯', color: '#10b981', createdAt: 0, order: 2 },
  { id: 'default-10m',       name: '10 Minutes',       durationSeconds: 600,  icon: '☕', color: '#06b6d4', createdAt: 0, order: 3 },
  { id: 'default-15m',       name: '15 Minutes',       durationSeconds: 900,  icon: '📖', color: '#6366f1', createdAt: 0, order: 4 },
  { id: 'default-pomodoro',  name: 'Pomodoro',         durationSeconds: 1500, icon: '🍅', color: '#ef4444', createdAt: 0, order: 5 },
  { id: 'default-practice',  name: 'Practice Block',   durationSeconds: 2700, icon: '🎵', color: '#8b5cf6', createdAt: 0, order: 6 },
  { id: 'default-focus',     name: 'Focus Session',    durationSeconds: 3600, icon: '🧠', color: '#ec4899', createdAt: 0, order: 7 },
];

const INITIAL_TIMER: QuickTimerState = {
  durationSeconds: 300,
  startedAt: null,
  pausedAt: null,
  totalPausedMs: 0,
  status: 'idle',
  completedAt: null,
  activePresetId: null,
};

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'ts:quicktimer:v1';

interface PersistedData {
  timer: QuickTimerState;
  presets: TimerPreset[];
  recentDurations: number[];
  settings: TimerSettings;
}

function loadPersisted(): Partial<PersistedData> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PersistedData) : {};
  } catch {
    return {};
  }
}

function savePersisted(data: PersistedData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {}
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

interface TimerStore {
  timer: QuickTimerState;
  presets: TimerPreset[];
  recentDurations: number[];
  settings: TimerSettings;

  hydrate: () => void;
  setDuration: (seconds: number) => void;
  start: () => void;
  pause: () => void;
  resume: () => void;
  cancel: () => void;
  reset: () => void;
  _complete: () => void;

  addPreset: (p: Omit<TimerPreset, 'id' | 'createdAt' | 'order'>) => void;
  updatePreset: (id: string, updates: Partial<Omit<TimerPreset, 'id' | 'createdAt'>>) => void;
  deletePreset: (id: string) => void;
  reorderPresets: (orderedIds: string[]) => void;
  startPreset: (id: string) => void;

  updateSettings: (s: Partial<TimerSettings>) => void;
}

export const useTimerStore = create<TimerStore>((set, get) => {
  function persist(): void {
    const { timer, presets, recentDurations, settings } = get();
    savePersisted({ timer, presets, recentDurations, settings });
  }

  function addToRecents(seconds: number): number[] {
    return [seconds, ...get().recentDurations.filter((d) => d !== seconds)].slice(0, 10);
  }

  return {
    timer: INITIAL_TIMER,
    presets: DEFAULT_PRESETS,
    recentDurations: [],
    settings: { soundEnabled: true, notificationsEnabled: true, autoRepeat: false },

    hydrate() {
      const stored = loadPersisted();
      let timer = stored.timer ?? INITIAL_TIMER;

      // If a running timer expired while the app was closed, mark it complete
      if (timer.status === 'running' && computeRemainingMs(timer) <= 0) {
        timer = { ...timer, status: 'completed', completedAt: Date.now() };
      }

      set((s) => ({
        timer,
        presets: stored.presets?.length ? stored.presets : s.presets,
        recentDurations: stored.recentDurations ?? s.recentDurations,
        settings: stored.settings ? { ...s.settings, ...stored.settings } : s.settings,
      }));
    },

    setDuration(seconds) {
      set((s) => ({
        timer: { ...s.timer, durationSeconds: Math.max(1, Math.min(359999, seconds)) },
      }));
      persist();
    },

    start() {
      const { timer } = get();
      if (timer.durationSeconds <= 0) return;
      const now = Date.now();
      set({
        timer: {
          ...timer,
          startedAt: now,
          pausedAt: null,
          totalPausedMs: 0,
          status: 'running',
          completedAt: null,
        },
        recentDurations: addToRecents(timer.durationSeconds),
      });
      persist();
    },

    pause() {
      const { timer } = get();
      if (timer.status !== 'running') return;
      set((s) => ({ timer: { ...s.timer, status: 'paused', pausedAt: Date.now() } }));
      persist();
    },

    resume() {
      const { timer } = get();
      if (timer.status !== 'paused') return;
      const pausedMs = timer.pausedAt ? Date.now() - timer.pausedAt : 0;
      set((s) => ({
        timer: {
          ...s.timer,
          status: 'running',
          pausedAt: null,
          totalPausedMs: s.timer.totalPausedMs + pausedMs,
        },
      }));
      persist();
    },

    cancel() {
      set((s) => ({
        timer: { ...INITIAL_TIMER, durationSeconds: s.timer.durationSeconds, activePresetId: s.timer.activePresetId },
      }));
      persist();
    },

    reset() {
      set((s) => ({
        timer: { ...INITIAL_TIMER, durationSeconds: s.timer.durationSeconds, activePresetId: s.timer.activePresetId },
      }));
      persist();
    },

    _complete() {
      const { settings, timer } = get();
      set((s) => ({ timer: { ...s.timer, status: 'completed', completedAt: Date.now() } }));
      persist();

      if (settings.soundEnabled) playCompletionSound();
      if (settings.notificationsEnabled) {
        notifyTimerComplete('Timer complete', 'Your timer has finished.').catch(() => {});
      }

      if (settings.autoRepeat) {
        setTimeout(() => {
          const current = get().timer;
          if (current.status === 'completed') {
            set({
              timer: {
                ...INITIAL_TIMER,
                durationSeconds: timer.durationSeconds,
                activePresetId: timer.activePresetId,
                startedAt: Date.now(),
                status: 'running',
              },
            });
            persist();
          }
        }, 1500);
      }
    },

    addPreset(p) {
      const { presets } = get();
      const maxOrder = presets.reduce((m, x) => Math.max(m, x.order), -1);
      const newPreset: TimerPreset = {
        ...p,
        id: `p-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        createdAt: Date.now(),
        order: maxOrder + 1,
      };
      set((s) => ({ presets: [...s.presets, newPreset] }));
      persist();
    },

    updatePreset(id, updates) {
      set((s) => ({ presets: s.presets.map((p) => (p.id === id ? { ...p, ...updates } : p)) }));
      persist();
    },

    deletePreset(id) {
      set((s) => ({ presets: s.presets.filter((p) => p.id !== id) }));
      persist();
    },

    reorderPresets(orderedIds) {
      const map = new Map(get().presets.map((p) => [p.id, p]));
      const reordered = orderedIds
        .map((id, i) => {
          const p = map.get(id);
          return p ? { ...p, order: i } : null;
        })
        .filter(Boolean) as TimerPreset[];
      set({ presets: reordered });
      persist();
    },

    startPreset(id) {
      const preset = get().presets.find((p) => p.id === id);
      if (!preset) return;
      set({
        timer: {
          ...INITIAL_TIMER,
          durationSeconds: preset.durationSeconds,
          startedAt: Date.now(),
          status: 'running',
          activePresetId: id,
        },
        recentDurations: addToRecents(preset.durationSeconds),
      });
      persist();
    },

    updateSettings(s) {
      set((state) => ({ settings: { ...state.settings, ...s } }));
      persist();
    },
  };
});
