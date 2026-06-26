// ---------------------------------------------------------------------------
// Quick-timer types — shared between desktop and mobile.
// Pure data; no platform dependencies.
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
// Pure computation — platform-independent.
// ---------------------------------------------------------------------------

export function computeRemainingMs(timer: QuickTimerState): number {
  const totalMs = timer.durationSeconds * 1000;
  if (timer.status === 'idle') return totalMs;
  if (timer.status === 'completed') return 0;
  const ref =
    timer.status === 'paused' ? (timer.pausedAt ?? Date.now()) : Date.now();
  const elapsed = ref - (timer.startedAt ?? ref) - timer.totalPausedMs;
  return Math.max(0, totalMs - elapsed);
}

export const DEFAULT_TIMER_PRESETS: TimerPreset[] = [
  { id: 'default-30s',      name: '30 Seconds',    durationSeconds: 30,   icon: '⚡', color: '#f97316', createdAt: 0, order: 0 },
  { id: 'default-1m',       name: '1 Minute',      durationSeconds: 60,   icon: '🕐', color: '#f59e0b', createdAt: 0, order: 1 },
  { id: 'default-5m',       name: '5 Minutes',     durationSeconds: 300,  icon: '🎯', color: '#10b981', createdAt: 0, order: 2 },
  { id: 'default-10m',      name: '10 Minutes',    durationSeconds: 600,  icon: '☕', color: '#06b6d4', createdAt: 0, order: 3 },
  { id: 'default-15m',      name: '15 Minutes',    durationSeconds: 900,  icon: '📖', color: '#6366f1', createdAt: 0, order: 4 },
  { id: 'default-pomodoro', name: 'Pomodoro',      durationSeconds: 1500, icon: '🍅', color: '#ef4444', createdAt: 0, order: 5 },
  { id: 'default-practice', name: 'Practice Block',durationSeconds: 2700, icon: '🎵', color: '#8b5cf6', createdAt: 0, order: 6 },
  { id: 'default-focus',    name: 'Focus Session', durationSeconds: 3600, icon: '🧠', color: '#ec4899', createdAt: 0, order: 7 },
];

export const INITIAL_QUICK_TIMER: QuickTimerState = {
  durationSeconds: 300,
  startedAt: null,
  pausedAt: null,
  totalPausedMs: 0,
  status: 'idle',
  completedAt: null,
  activePresetId: null,
};
