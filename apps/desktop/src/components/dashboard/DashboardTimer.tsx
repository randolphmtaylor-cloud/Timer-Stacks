import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTimerStore, computeRemainingMs } from '../../stores/timerStore.js';
import { PresetModal } from './PresetModal.js';
import { cn } from '../ui/cn.js';

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

function secondsToDigits(s: number): number[] {
  s = Math.min(359999, Math.max(0, Math.floor(s)));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [
    Math.floor(h / 10), h % 10,
    Math.floor(m / 10), m % 10,
    Math.floor(sec / 10), sec % 10,
  ];
}

function digitsToSeconds(d: number[]): number {
  const h = (d[0] ?? 0) * 10 + (d[1] ?? 0);
  const m = (d[2] ?? 0) * 10 + (d[3] ?? 0);
  const s = (d[4] ?? 0) * 10 + (d[5] ?? 0);
  return h * 3600 + m * 60 + s;
}

function formatCountdown(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatDurationShort(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0 && m === 0 && s === 0) return `${h}h`;
  if (h > 0 && s === 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0 && s === 0) return `${m}m`;
  if (m > 0 && s > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

// ---------------------------------------------------------------------------
// SVG progress ring
// ---------------------------------------------------------------------------

const RING_RADIUS = 100;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS; // ≈ 628.318

interface RingProps {
  progress: number; // 0–1, 1 = full
  color: string;
  size?: number;
}

function ProgressRing({ progress, color, size = 240 }: RingProps) {
  const center = size / 2;
  const offset = RING_CIRCUMFERENCE * (1 - Math.max(0, Math.min(1, progress)));
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* Track */}
      <circle
        cx={center}
        cy={center}
        r={RING_RADIUS}
        fill="none"
        strokeWidth={8}
        className="stroke-surface-100 dark:stroke-surface-700"
      />
      {/* Progress arc */}
      <circle
        cx={center}
        cy={center}
        r={RING_RADIUS}
        fill="none"
        strokeWidth={8}
        stroke={color}
        strokeDasharray={RING_CIRCUMFERENCE}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${center} ${center})`}
        style={{ transition: 'stroke-dashoffset 0.15s linear' }}
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Digit-slot time picker (idle / input mode)
// ---------------------------------------------------------------------------

interface DigitSlotsProps {
  digits: number[];
  editing: boolean;
  onActivate: () => void;
}

function DigitSlots({ digits: d, editing, onActivate }: DigitSlotsProps) {
  const hoursZero = d[0] === 0 && d[1] === 0;
  const minutesZero = hoursZero && d[2] === 0 && d[3] === 0;

  function Digit({ value, faded }: { value: number; faded?: boolean }) {
    return (
      <span
        className={cn(
          'transition-opacity duration-100',
          faded ? 'opacity-20' : 'opacity-100',
        )}
      >
        {value}
      </span>
    );
  }

  function Sep() {
    return <span className="opacity-25 mx-0.5">:</span>;
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onActivate}
      onFocus={onActivate}
      className={cn(
        'font-mono text-[4.5rem] sm:text-[5.5rem] font-light tabular-nums select-none cursor-text',
        'text-gray-900 dark:text-gray-100 outline-none leading-none',
        editing
          ? 'ring-2 ring-accent/30 rounded-2xl px-4 py-2'
          : 'px-4 py-2',
      )}
    >
      <Digit value={d[0] ?? 0} faded={hoursZero} />
      <Digit value={d[1] ?? 0} faded={hoursZero} />
      <Sep />
      <Digit value={d[2] ?? 0} faded={minutesZero} />
      <Digit value={d[3] ?? 0} faded={minutesZero} />
      <Sep />
      <Digit value={d[4] ?? 0} />
      <Digit value={d[5] ?? 0} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function DashboardTimer() {
  const {
    timer,
    presets,
    recentDurations,
    settings,
    hydrate,
    setDuration,
    start,
    pause,
    resume,
    cancel,
    reset,
    _complete,
    startPreset,
  } = useTimerStore();

  // ── Live remaining time ──────────────────────────────────────────────────
  const [remainingMs, setRemainingMs] = useState(() => computeRemainingMs(timer));

  // ── Local input state ────────────────────────────────────────────────────
  const [digits, setDigits] = useState<number[]>(() => secondsToDigits(timer.durationSeconds));
  const [editing, setEditing] = useState(false);
  const [presetsOpen, setPresetsOpen] = useState(false);
  const [flash, setFlash] = useState(false);

  // Keep digit display in sync when a preset changes the store duration
  useEffect(() => {
    if (timer.status === 'idle') {
      setDigits(secondsToDigits(timer.durationSeconds));
    }
  }, [timer.durationSeconds, timer.status]);

  // Hydrate persisted state on mount
  useEffect(() => {
    hydrate();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Tick + completion detection ──────────────────────────────────────────
  useEffect(() => {
    const tick = () => {
      const r = computeRemainingMs(useTimerStore.getState().timer);
      setRemainingMs(r);
      const s = useTimerStore.getState().timer;
      if (r <= 0 && s.status === 'running') {
        _complete();
        setFlash(true);
        setTimeout(() => setFlash(false), 2000);
      }
    };
    tick();
    const id = setInterval(tick, 100);
    return () => clearInterval(id);
  }, [timer.status, timer.startedAt, timer.durationSeconds, _complete]);

  // ── Keyboard listener for digit entry ────────────────────────────────────
  const handleGlobalKey = useCallback(
    (e: KeyboardEvent) => {
      if (!editing || timer.status !== 'idle') return;
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        const n = parseInt(e.key, 10);
        setDigits((prev) => {
          const next = [...prev.slice(1), n];
          setDuration(digitsToSeconds(next));
          return next;
        });
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        setDigits((prev) => {
          const next = [0, ...prev.slice(0, -1)];
          setDuration(digitsToSeconds(next));
          return next;
        });
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const secs = digitsToSeconds(digits);
        if (secs > 0) { setEditing(false); setDuration(secs); start(); }
      } else if (e.key === 'Escape') {
        setEditing(false);
      }
    },
    [editing, timer.status, digits, setDuration, start],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleGlobalKey);
    return () => window.removeEventListener('keydown', handleGlobalKey);
  }, [handleGlobalKey]);

  // Clicking outside the card exits editing
  const cardRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!editing) return;
    const handler = (e: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        setEditing(false);
      }
    };
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, [editing]);

  // ── Scroll-to-adjust (when idle) ─────────────────────────────────────────
  function handleWheel(e: React.WheelEvent) {
    if (timer.status !== 'idle') return;
    e.preventDefault();
    const delta = e.deltaY < 0 ? 60 : -60;
    const newSecs = Math.max(1, Math.min(359999, timer.durationSeconds + delta));
    setDuration(newSecs);
    setDigits(secondsToDigits(newSecs));
  }

  // ── Derived values ────────────────────────────────────────────────────────
  const isIdle = timer.status === 'idle';
  const isRunning = timer.status === 'running';
  const isPaused = timer.status === 'paused';
  const isCompleted = timer.status === 'completed';
  const isActive = isRunning || isPaused || isCompleted;

  const progress = isIdle ? 1 : isCompleted ? 0 : remainingMs / (timer.durationSeconds * 1000);
  const activePreset = timer.activePresetId
    ? presets.find((p) => p.id === timer.activePresetId)
    : null;
  const accentColor = activePreset?.color ?? '#6366f1';
  const ringColor = isCompleted ? '#22c55e' : isPaused ? '#f59e0b' : accentColor;

  const sortedPresets = [...presets].sort((a, b) => a.order - b.order);
  const quickPresets = sortedPresets.slice(0, 6);

  function handleStart() {
    const secs = digitsToSeconds(digits);
    if (secs <= 0) return;
    setEditing(false);
    if (timer.durationSeconds !== secs) setDuration(secs);
    start();
  }

  function handlePresetChipClick(id: string) {
    startPreset(id);
  }

  function handleRecentClick(secs: number) {
    setDuration(secs);
    setDigits(secondsToDigits(secs));
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      <div
        ref={cardRef}
        className={cn(
          'rounded-3xl bg-white dark:bg-surface-800 border border-surface-100 dark:border-gray-700/50 shadow-lg overflow-hidden',
          flash ? 'ring-4 ring-green-400/40' : '',
          'transition-shadow duration-300',
        )}
      >
        {/* ── Top accent line ───────────────────────────────────────────── */}
        {isActive && (
          <div
            className="h-0.5 transition-colors duration-300"
            style={{ backgroundColor: ringColor }}
          />
        )}

        {/* ── Main area ─────────────────────────────────────────────────── */}
        <div className="pt-8 pb-6 px-6 flex flex-col items-center gap-0">

          {/* Status badge */}
          {isActive && (
            <div className="flex items-center gap-1.5 mb-4">
              {isRunning && (
                <span
                  className="w-1.5 h-1.5 rounded-full animate-pulse"
                  style={{ backgroundColor: accentColor }}
                />
              )}
              <span
                className={cn(
                  'text-[11px] font-semibold uppercase tracking-widest',
                  isRunning && 'text-gray-500 dark:text-gray-400',
                  isPaused && 'text-amber-500 dark:text-amber-400',
                  isCompleted && 'text-green-500',
                )}
              >
                {isRunning
                  ? (activePreset ? activePreset.name : 'Running')
                  : isPaused
                  ? 'Paused'
                  : "Time's Up!"}
              </span>
            </div>
          )}

          {/* ── Timer display ─────────────────────────────────────────── */}
          <div
            className="relative flex items-center justify-center"
            onWheel={handleWheel}
            style={{ touchAction: 'none' }}
          >
            {/* Ring (shown when active) */}
            {isActive && (
              <div className="absolute inset-0 flex items-center justify-center">
                <ProgressRing progress={progress} color={ringColor} size={240} />
              </div>
            )}

            {/* Center content */}
            <div className={cn('relative z-10 flex items-center justify-center', isActive ? 'w-60 h-60' : '')}>
              {isIdle ? (
                <DigitSlots
                  digits={digits}
                  editing={editing}
                  onActivate={() => setEditing(true)}
                />
              ) : (
                <div
                  className={cn(
                    'font-mono font-light tabular-nums text-center leading-none',
                    isCompleted ? 'text-green-500' : 'text-gray-900 dark:text-gray-100',
                    timer.durationSeconds >= 3600 ? 'text-5xl' : 'text-6xl sm:text-7xl',
                    isCompleted && flash ? 'animate-pulse' : '',
                    isPaused ? 'opacity-60' : '',
                  )}
                >
                  {isCompleted ? '00:00' : formatCountdown(remainingMs)}
                </div>
              )}
            </div>
          </div>

          {/* Hint text */}
          {isIdle && (
            <p className="text-xs text-gray-300 dark:text-gray-600 mt-3 text-center">
              {editing
                ? 'Type digits · Enter to start · Esc to cancel · Scroll to adjust'
                : 'Click to set time · Scroll to adjust · or choose a preset below'}
            </p>
          )}

          {/* ── Controls ──────────────────────────────────────────────── */}
          <div className="flex items-center gap-3 mt-6 flex-wrap justify-center">
            {isIdle && (
              <button
                onClick={handleStart}
                disabled={digitsToSeconds(digits) === 0}
                className="px-8 py-2.5 rounded-full text-sm font-semibold text-white disabled:opacity-30 transition-all hover:scale-[1.03] active:scale-[0.98]"
                style={{ backgroundColor: accentColor }}
              >
                Start
              </button>
            )}

            {(isRunning || isPaused) && (
              <>
                <button
                  onClick={() => (isRunning ? pause() : resume())}
                  className={cn(
                    'px-6 py-2.5 rounded-full text-sm font-semibold transition-all hover:scale-[1.03] active:scale-[0.98]',
                    isPaused
                      ? 'text-white'
                      : 'bg-surface-100 dark:bg-surface-700 text-gray-800 dark:text-gray-200',
                  )}
                  style={isPaused ? { backgroundColor: accentColor } : {}}
                >
                  {isRunning ? '⏸ Pause' : '▶ Resume'}
                </button>
                <button
                  onClick={cancel}
                  className="px-5 py-2.5 rounded-full text-sm font-medium text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
                >
                  ✕ Cancel
                </button>
              </>
            )}

            {isCompleted && (
              <>
                <div className="text-2xl">✓</div>
                <button
                  onClick={reset}
                  className="px-8 py-2.5 rounded-full text-sm font-semibold text-white bg-green-500 hover:bg-green-600 transition-colors"
                >
                  ↺ Reset
                </button>
              </>
            )}
          </div>

          {/* Settings row (auto-repeat) */}
          {isIdle && (
            <div className="flex items-center gap-4 mt-3">
              <label className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={settings.autoRepeat}
                  onChange={(e) =>
                    useTimerStore.getState().updateSettings({ autoRepeat: e.target.checked })
                  }
                  className="rounded"
                />
                Auto-repeat
              </label>
              <label className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={settings.soundEnabled}
                  onChange={(e) =>
                    useTimerStore.getState().updateSettings({ soundEnabled: e.target.checked })
                  }
                  className="rounded"
                />
                Sound
              </label>
            </div>
          )}
        </div>

        {/* ── Preset strip ──────────────────────────────────────────────── */}
        <div className="border-t border-surface-100 dark:border-gray-700/40 px-5 py-3 flex items-center gap-2 overflow-x-auto scrollbar-hide">
          {quickPresets.map((preset) => (
            <button
              key={preset.id}
              onClick={() => handlePresetChipClick(preset.id)}
              title={`${preset.name} — ${formatDurationShort(preset.durationSeconds)}`}
              className={cn(
                'flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium',
                'bg-surface-50 dark:bg-surface-700/50 text-gray-600 dark:text-gray-400',
                'hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors',
                'border border-surface-100 dark:border-gray-700/40',
                timer.activePresetId === preset.id && isActive
                  ? 'ring-2 ring-offset-1 ring-offset-white dark:ring-offset-surface-800 ring-accent'
                  : '',
              )}
            >
              {preset.icon && <span>{preset.icon}</span>}
              <span>{formatDurationShort(preset.durationSeconds)}</span>
            </button>
          ))}

          <button
            onClick={() => setPresetsOpen(true)}
            className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors"
          >
            ··· Manage
          </button>
        </div>

        {/* ── Recent timers ─────────────────────────────────────────────── */}
        {recentDurations.length > 0 && isIdle && (
          <div className="border-t border-surface-100 dark:border-gray-700/40 px-5 py-2.5 flex items-center gap-2 overflow-x-auto scrollbar-hide">
            <span className="flex-shrink-0 text-[10px] font-semibold uppercase tracking-widest text-gray-300 dark:text-gray-600">
              Recent
            </span>
            {recentDurations.slice(0, 8).map((secs) => (
              <button
                key={secs}
                onClick={() => handleRecentClick(secs)}
                className="flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-medium bg-surface-50 dark:bg-surface-700/40 text-gray-500 dark:text-gray-400 hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors border border-surface-100 dark:border-gray-700/30"
              >
                {formatDurationShort(secs)}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Preset modal */}
      {presetsOpen && <PresetModal onClose={() => setPresetsOpen(false)} />}
    </>
  );
}
