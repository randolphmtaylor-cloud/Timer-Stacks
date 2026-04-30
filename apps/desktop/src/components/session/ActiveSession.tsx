import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSessionStore } from '../../stores/sessionStore.js';
import { useStackStore } from '../../stores/stackStore.js';
import { useSessionTick } from '../../hooks/useSessionTick.js';
import { TimerDisplay } from '../ui/TimerDisplay.js';
import { ProgressBar } from '../ui/ProgressBar.js';
import { Button } from '../ui/Button.js';
import { ConfirmDialog } from '../ui/Modal.js';
import { cn } from '../ui/cn.js';

export function ActiveSession() {
  const { id: sessionId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { sessions, pause, resume, skip, resetSegment, previousSegment, cancel } = useSessionStore();
  const { stacks } = useStackStore();
  const [confirmCancel, setConfirmCancel] = useState(false);

  const session = sessions.find((s) => s.sessionId === sessionId);
  const stack = session ? stacks.find((s) => s.stackId === session.stackId) : undefined;
  const tick = useSessionTick(sessionId ?? null);

  if (!session || !stack) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center gap-4 px-4 text-center">
        <span className="text-5xl">🏁</span>
        <p className="text-gray-600 dark:text-gray-400">Session not found or already completed.</p>
        <Button variant="secondary" onClick={() => navigate('/')}>Back to Dashboard</Button>
      </div>
    );
  }

  const activeSegment = stack.segments[session.activeSegmentIndex];
  const isRunning = session.status === 'running';
  const isPaused = session.status === 'paused';
  const isCompleted = session.status === 'completed';

  const upcoming = stack.segments.slice(session.activeSegmentIndex + 1);

  return (
    <div className="flex min-h-full w-full max-w-2xl flex-col mx-auto px-4 py-5 sm:px-6 md:p-8">
      {/* Back nav */}
      <div className="flex items-center gap-3 mb-6 md:mb-8">
        <button
          onClick={() => navigate('/')}
          className="min-h-11 min-w-11 p-2 rounded-xl hover:bg-surface-100 dark:hover:bg-surface-800 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
        >
          ←
        </button>
        <div className="flex min-w-0 items-center gap-2">
          {stack.icon && <span className="text-xl">{stack.icon}</span>}
          <h1 className="truncate text-lg font-semibold text-gray-900 dark:text-gray-100">{stack.name}</h1>
        </div>
        {isPaused && (
          <span className="ml-auto text-xs font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 px-2.5 py-1 rounded-full">
            Paused
          </span>
        )}
      </div>

      {/* Completion state */}
      {isCompleted && (
        <div className="flex flex-col items-center justify-center py-16 text-center animate-fade-in">
          <span className="text-6xl mb-4">🎉</span>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">Complete!</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            You finished <strong>{stack.name}</strong>
          </p>
          <Button variant="primary" onClick={() => navigate('/')}>Back to Dashboard</Button>
        </div>
      )}

      {!isCompleted && (
        <>
          {/* Current segment */}
          <div className="flex-1 flex flex-col items-center justify-center text-center py-6 sm:py-8">
            {activeSegment && (
              <div
                className="w-3 h-3 rounded-full mb-6"
                style={{ backgroundColor: activeSegment.color ?? '#6366f1' }}
              />
            )}
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
              {activeSegment?.label ?? 'Loading…'}
            </p>
            <TimerDisplay ms={tick?.segmentRemainingMs ?? 0} size="xl" className="mb-2" />
            <p className="text-sm text-gray-400 dark:text-gray-500">
              segment {session.activeSegmentIndex + 1} of {stack.segments.length}
            </p>
          </div>

          {/* Segment progress */}
          {tick && (
            <div className="mb-6 space-y-2">
              <ProgressBar
                value={tick.segmentProgress}
                height="md"
                color="bg-accent"
                animated
              />
              <div className="flex justify-between text-xs text-gray-400">
                <span>Segment</span>
                <span>{Math.round(tick.segmentProgress * 100)}%</span>
              </div>
            </div>
          )}

          {/* Stack summary */}
          <div className="bg-surface-50 dark:bg-surface-800/50 rounded-2xl p-4 mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs text-gray-400 mb-1">Stack remaining</p>
              <TimerDisplay ms={tick?.stackRemainingMs ?? 0} size="md" />
            </div>
            {tick && (
              <div className="text-right">
                <p className="text-xs text-gray-400 mb-1">Overall</p>
                <ProgressBar value={tick.stackProgress} className="w-full sm:w-24" height="sm" />
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="flex gap-3 justify-center mb-6">
            <Button
              size="lg"
              variant="primary"
              onClick={() => isRunning ? pause(session.sessionId) : resume(session.sessionId)}
              className="flex-1 max-w-xs"
            >
              {isRunning ? '⏸ Pause' : '▶ Resume'}
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:flex sm:justify-center">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => previousSegment(session.sessionId)}
              disabled={session.activeSegmentIndex === 0}
              aria-label="Previous Segment"
              title="Previous Segment"
            >
              ⏮ Previous Segment
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => resetSegment(session.sessionId)}
              aria-label="Reset Segment"
              title="Reset Segment"
            >
              ↺ Reset Segment
            </Button>
            <Button size="sm" variant="secondary" onClick={() => skip(session.sessionId)}>
              ⏭ Skip Segment
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirmCancel(true)}>
              ✕ Cancel
            </Button>
          </div>

          {/* Upcoming segments */}
          {upcoming.length > 0 && (
            <div className="mt-8">
              <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                Up Next
              </h3>
              <div className="space-y-2">
                {upcoming.map((seg, i) => (
                  <div
                    key={seg.segmentId}
                    className={cn(
                      'flex items-center gap-3 px-4 py-2.5 rounded-xl',
                      i === 0
                        ? 'bg-surface-100 dark:bg-surface-800'
                        : 'opacity-60',
                    )}
                  >
                    <div
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: seg.color ?? '#6366f1' }}
                    />
                    <span className="min-w-0 flex-1 truncate text-sm text-gray-700 dark:text-gray-300">{seg.label}</span>
                    <TimerDisplay ms={seg.durationMs} size="sm" muted />
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Dialogs */}
      <ConfirmDialog
        open={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        onConfirm={() => { cancel(session.sessionId, stack); navigate('/'); }}
        title="Cancel Session"
        message="This will end the session and record it as cancelled."
        confirmLabel="Cancel Session"
        danger
      />
    </div>
  );
}
