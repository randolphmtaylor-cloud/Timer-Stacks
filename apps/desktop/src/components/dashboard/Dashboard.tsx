import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useStackStore } from '../../stores/stackStore.js';
import { useSessionStore } from '../../stores/sessionStore.js';
import { StackCard } from './StackCard.js';
import { RunningSessionCard } from './RunningSessionCard.js';
import { Button } from '../ui/Button.js';

export function Dashboard() {
  const navigate = useNavigate();
  const { stacks } = useStackStore();
  const { sessions } = useSessionStore();

  const activeSessions = sessions.filter(
    (s) => s.status === 'running' || s.status === 'paused',
  );
  const userStacks = stacks.filter((s) => !s.isTemplate);
  const templates = stacks.filter((s) => s.isTemplate);
  const hasAnyStacks = userStacks.length > 0 || templates.length > 0;

  return (
    <div className="min-h-full overflow-x-hidden">
      {/* ── Page header ──────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6 md:px-8 md:py-5 bg-surface-50/80 dark:bg-surface-950/80 backdrop-blur-sm border-b border-surface-100 dark:border-gray-800/50">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Dashboard</h1>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
            {activeSessions.length > 0
              ? `${activeSessions.length} session${activeSessions.length !== 1 ? 's' : ''} running`
              : hasAnyStacks
                ? `${stacks.length} stack${stacks.length !== 1 ? 's' : ''}`
                : 'No stacks yet'}
          </p>
        </div>
        <Button variant="primary" size="md" onClick={() => navigate('/builder')} className="shrink-0">
          + New Stack
        </Button>
      </div>

      <div className="w-full max-w-5xl mx-auto space-y-8 px-4 py-5 sm:px-6 md:px-8 md:py-6 md:space-y-10">

        {/* ── Active sessions — pinned, visually prominent ──────── */}
        {activeSessions.length > 0 && (
          <section>
            <SectionLabel>Running Now</SectionLabel>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {activeSessions.map((session) => {
                const stack = stacks.find((s) => s.stackId === session.stackId);
                if (!stack) return null;
                return (
                  <RunningSessionCard key={session.sessionId} session={session} stack={stack} />
                );
              })}
            </div>
          </section>
        )}

        {/* ── Content ──────────────────────────────────────────── */}
        {!hasAnyStacks ? (
          <EmptyState onCreateClick={() => navigate('/builder')} />
        ) : (
          <>
            {userStacks.length > 0 && (
              <section>
                <SectionLabel>My Stacks</SectionLabel>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {userStacks.map((stack) => (
                    <StackCard key={stack.stackId} stack={stack} />
                  ))}
                </div>
              </section>
            )}

            {templates.length > 0 && (
              <section>
                <SectionLabel>Templates</SectionLabel>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {templates.map((stack) => (
                    <StackCard key={stack.stackId} stack={stack} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-4">
      {children}
    </h2>
  );
}

function EmptyState({ onCreateClick }: { onCreateClick: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center px-2 py-20 text-center animate-fade-in sm:py-32">
      <div className="w-20 h-20 rounded-3xl bg-accent/10 dark:bg-accent/20 flex items-center justify-center mb-6 text-4xl">
        ⏱
      </div>
      <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-2">
        No stacks yet
      </h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-8 max-w-xs leading-relaxed">
        Build structured timer routines — practice sessions, deep work blocks,
        workout circuits — and run them one segment at a time.
      </p>
      <Button variant="primary" size="lg" onClick={onCreateClick} className="w-full max-w-xs">
        Create Your First Stack
      </Button>
      <p className="text-xs text-gray-400 dark:text-gray-600 mt-4">
        Or browse the{' '}
        <button
          onClick={() => (window.location.href = '#/templates')}
          className="underline underline-offset-2 hover:text-gray-600 dark:hover:text-gray-400"
        >
          included templates
        </button>
      </p>
    </div>
  );
}
