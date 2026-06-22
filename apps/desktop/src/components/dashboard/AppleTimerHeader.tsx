import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Session, TimerStack } from '@timer-stacks/core';
import { useSessionTick } from '../../hooks/useSessionTick.js';
import { useSessionStore } from '../../stores/sessionStore.js';
import { cn } from '../ui/cn.js';

interface Props {
  session: Session;
  stack: TimerStack;
}

function formatTimerMs(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatStackRemaining(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m remaining`;
  if (m > 0) return `${m}m ${s}s remaining`;
  return `${s}s remaining`;
}

function ActiveTimer({ session, stack }: Props) {
  const navigate = useNavigate();
  const { pause, resume, skip, cancel } = useSessionStore();
  const state = useSessionTick(session.sessionId);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const isRunning = session.status === 'running';
  const activeSegment = stack.segments[session.activeSegmentIndex];
  const segColor = activeSegment?.color ?? '#6366f1';
  const isLastSegment = session.activeSegmentIndex >= stack.segments.length - 1;

  function handleCancel() {
    if (!confirmCancel) { setConfirmCancel(true); return; }
    cancel(session.sessionId, stack).catch((err) => {
      console.error('[AppleTimerHeader] cancel failed', err);
    });
  }

  const segRemaining = state?.segmentRemainingMs ?? 0;
  const stackRemaining = state?.stackRemainingMs ?? 0;
  const segProgress = state?.segmentProgress ?? 0;

  return (
    <div className="relative overflow-hidden rounded-3xl bg-white dark:bg-surface-800 shadow-lg border border-surface-100 dark:border-gray-700/50">
      {/* Top accent bar */}
      <div
        className="absolute top-0 left-0 right-0 h-1 transition-opacity duration-300"
        style={{ backgroundColor: segColor, opacity: isRunning ? 0.9 : 0.4 }}
      />

      <div className="pt-6 pb-5 px-6 sm:px-8">
        {/* Status row */}
        <div className="flex items-center justify-center gap-2 mb-3">
          {isRunning ? (
            <span
              className="w-2 h-2 rounded-full animate-pulse"
              style={{ backgroundColor: segColor }}
            />
          ) : (
            <span className="w-2 h-2 rounded-full bg-amber-400 dark:bg-amber-500" />
          )}
          <span
            className={cn(
              'text-xs font-semibold uppercase tracking-widest',
              isRunning ? 'text-gray-500 dark:text-gray-400' : 'text-amber-600 dark:text-amber-400',
            )}
          >
            {isRunning ? stack.name : `${stack.name} — Paused`}
          </span>
        </div>

        {/* Segment name */}
        {activeSegment && (
          <p className="text-center text-sm font-medium text-gray-400 dark:text-gray-500 mb-1 tracking-wide">
            {activeSegment.label}
          </p>
        )}

        {/* Large segment timer */}
        <div
          className={cn(
            'text-center font-mono tabular-nums font-light tracking-tight select-none transition-opacity duration-200',
            'text-6xl sm:text-7xl',
            !isRunning && 'opacity-60',
          )}
          style={{ color: segColor }}
        >
          {formatTimerMs(segRemaining)}
        </div>

        {/* Stack remaining */}
        <p className="text-center text-sm text-gray-400 dark:text-gray-500 mt-2 font-medium tabular-nums">
          {formatStackRemaining(stackRemaining)}
          {stack.segments.length > 1 && (
            <span className="ml-2 text-gray-300 dark:text-gray-600">
              · {session.activeSegmentIndex + 1}/{stack.segments.length} segments
            </span>
          )}
        </p>

        {/* Segment progress bar */}
        <div className="mt-4 mx-auto max-w-sm">
          <div className="h-1 rounded-full bg-surface-100 dark:bg-surface-700 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: `${segProgress * 100}%`, backgroundColor: segColor }}
            />
          </div>
        </div>

        {/* Segment color timeline */}
        {stack.segments.length > 1 && (
          <div className="flex gap-0.5 h-0.5 mt-2 mx-auto max-w-sm rounded-full overflow-hidden">
            {stack.segments.map((seg, i) => (
              <div
                key={seg.segmentId}
                className={cn(i < session.activeSegmentIndex ? 'opacity-20' : '')}
                style={{ flex: seg.durationMs, backgroundColor: seg.color ?? '#6366f1' }}
              />
            ))}
          </div>
        )}

        {/* Controls */}
        <div className="flex items-center justify-center gap-2 mt-5 flex-wrap">
          {/* Pause / Resume */}
          <button
            onClick={() => isRunning ? pause(session.sessionId) : resume(session.sessionId)}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold transition-all duration-150',
              isRunning
                ? 'bg-surface-100 dark:bg-surface-700 text-gray-700 dark:text-gray-300 hover:bg-surface-200 dark:hover:bg-surface-600'
                : 'text-white',
            )}
            style={!isRunning ? { backgroundColor: segColor } : {}}
            aria-label={isRunning ? 'Pause' : 'Resume'}
          >
            {isRunning ? '⏸ Pause' : '▶ Resume'}
          </button>

          {/* Skip */}
          {!isLastSegment && (
            <button
              onClick={() => skip(session.sessionId)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold bg-surface-100 dark:bg-surface-700 text-gray-700 dark:text-gray-300 hover:bg-surface-200 dark:hover:bg-surface-600 transition-all duration-150"
              aria-label="Skip segment"
            >
              ⏭ Skip
            </button>
          )}

          {/* Open full session */}
          <button
            onClick={() => navigate(`/session/${session.sessionId}`)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-surface-100 dark:hover:bg-surface-700 transition-all duration-150"
            aria-label="Open session"
          >
            Expand →
          </button>

          {/* Cancel */}
          {confirmCancel ? (
            <>
              <button
                onClick={handleCancel}
                className="flex items-center gap-1 px-4 py-2 rounded-full text-sm font-semibold bg-red-500 text-white hover:bg-red-600 transition-all duration-150"
              >
                Confirm cancel
              </button>
              <button
                onClick={() => setConfirmCancel(false)}
                className="px-3 py-2 rounded-full text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                Keep
              </button>
            </>
          ) : (
            <button
              onClick={handleCancel}
              className="px-3 py-2 rounded-full text-sm text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 transition-colors"
              aria-label="Cancel session"
            >
              ✕
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Public export — renders the active stack session header
// ---------------------------------------------------------------------------

interface AppleTimerHeaderProps {
  sessions: Session[];
  stacks: TimerStack[];
}

export function AppleTimerHeader({ sessions, stacks }: AppleTimerHeaderProps) {
  const primary =
    sessions.find((s) => s.status === 'running') ??
    sessions.find((s) => s.status === 'paused');

  if (!primary) return null;

  const stack = stacks.find((s) => s.stackId === primary.stackId);
  if (!stack) return null;

  return <ActiveTimer session={primary} stack={stack} />;
}
