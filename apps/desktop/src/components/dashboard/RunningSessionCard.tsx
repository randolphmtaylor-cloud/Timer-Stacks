import React from 'react';
import { useNavigate } from 'react-router-dom';
import type { Session, TimerStack } from '@timer-stacks/core';
import { formatMsHuman } from '@timer-stacks/core';
import { useSessionTick } from '../../hooks/useSessionTick.js';
import { useSessionStore } from '../../stores/sessionStore.js';
import { TimerDisplay } from '../ui/TimerDisplay.js';
import { ProgressBar } from '../ui/ProgressBar.js';
import { Button } from '../ui/Button.js';
import { cn } from '../ui/cn.js';

interface Props {
  session: Session;
  stack: TimerStack;
}

export function RunningSessionCard({ session, stack }: Props) {
  const navigate = useNavigate();
  const { pause, resume } = useSessionStore();
  const state = useSessionTick(session.sessionId);

  const activeSegment = stack.segments[session.activeSegmentIndex];
  const isRunning = session.status === 'running';
  const isPaused = session.status === 'paused';
  const segColor = activeSegment?.color ?? '#6366f1';

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border bg-white dark:bg-surface-800 shadow-card dark:shadow-card-dark',
        'transition-shadow duration-200 hover:shadow-float cursor-pointer',
        isRunning
          ? 'border-l-4 border-surface-200 dark:border-gray-700/50'
          : 'border-l-4 border-surface-200 dark:border-gray-700/50 opacity-80',
      )}
      style={{ borderLeftColor: segColor }}
      onClick={() => navigate(`/session/${session.sessionId}`)}
    >
      {/* Live pulse strip at top */}
      {isRunning && (
        <div
          className="absolute top-0 left-0 right-0 h-0.5 opacity-60"
          style={{ backgroundColor: segColor }}
        />
      )}

      <div className="p-4 sm:p-5">
        {/* Stack name + status */}
        <div className="flex flex-col gap-3 mb-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              {stack.icon && <span className="text-base leading-none">{stack.icon}</span>}
              {isRunning ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider" style={{ color: segColor }}>
                  <span
                    className="w-1.5 h-1.5 rounded-full animate-pulse"
                    style={{ backgroundColor: segColor }}
                  />
                  Running
                </span>
              ) : (
                <span className="text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                  Paused
                </span>
              )}
            </div>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-[15px] leading-snug truncate">
              {stack.name}
            </h3>
            {activeSegment && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                {activeSegment.label}
              </p>
            )}
          </div>

          {/* Big remaining timer */}
          <div className="shrink-0 text-left sm:text-right">
            <TimerDisplay ms={state?.stackRemainingMs ?? 0} size="lg" />
            <p className="text-[11px] text-gray-400 mt-0.5 font-medium">remaining</p>
          </div>
        </div>

        {/* Segment bar */}
        {state && (
          <div className="mb-4 space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-400">
                Segment {session.activeSegmentIndex + 1}/{stack.segments.length}
              </span>
              <TimerDisplay ms={state.segmentRemainingMs} size="sm" muted />
            </div>
            <ProgressBar
              value={state.segmentProgress}
              height="sm"
              color="bg-[var(--seg-color)]"
              style={{ '--seg-color': segColor } as React.CSSProperties}
              trackClassName="bg-surface-100 dark:bg-surface-700"
            />
          </div>
        )}

        {/* Stack progress (thin, subtle) */}
        {state && (
          <div className="mb-4">
            <ProgressBar
              value={state.stackProgress}
              height="xs"
              color="bg-gray-300 dark:bg-gray-500"
              trackClassName="bg-surface-100 dark:bg-surface-700"
              animated={false}
            />
          </div>
        )}

        {/* Segment color timeline */}
        <div className="flex gap-0.5 h-1 rounded-full overflow-hidden mb-4">
          {stack.segments.map((seg, i) => (
            <div
              key={seg.segmentId}
              className={cn('transition-opacity', i < session.activeSegmentIndex && 'opacity-25')}
              style={{
                flex: seg.durationMs,
                backgroundColor: seg.color ?? '#6366f1',
              }}
            />
          ))}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant={isRunning ? 'secondary' : 'primary'}
            onClick={(e) => {
              e.stopPropagation();
              isRunning ? pause(session.sessionId) : resume(session.sessionId);
            }}
          >
            {isRunning ? '⏸ Pause' : '▶ Resume'}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="min-w-0"
            onClick={(e) => { e.stopPropagation(); navigate(`/session/${session.sessionId}`); }}
          >
            Open session →
          </Button>
        </div>
      </div>
    </div>
  );
}
