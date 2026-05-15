import React, { useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { nav, Sidebar } from './Sidebar.js';
import { cn } from '../ui/cn.js';
import { Button } from '../ui/Button.js';
import { isAudioUnlocked, unlockAudio } from '../../lib/sounds.js';
import { useSettingsStore } from '../../stores/settingsStore.js';

export function Layout() {
  return (
    <div className="app-viewport flex flex-col md:flex-row overflow-hidden bg-surface-50 dark:bg-surface-950">
      <MobileHeader />
      <Sidebar />
      <main className="flex-1 min-w-0 overflow-y-auto overscroll-contain safe-bottom">
        <Outlet />
      </main>
      <InAppAlertToast />
      <AudioUnlockPrompt />
    </div>
  );
}

function InAppAlertToast() {
  const [alert, setAlert] = useState<{ title: string; body: string } | null>(null);

  useEffect(() => {
    const handleAlert = (event: Event) => {
      const detail = (event as CustomEvent<{ title?: string; body?: string }>).detail;
      setAlert({
        title: detail?.title ?? 'Timer alert',
        body: detail?.body ?? 'Timer Stacks needs your attention.',
      });
      window.setTimeout(() => setAlert(null), 6500);
    };

    window.addEventListener('timer-stacks-alert', handleAlert);
    return () => window.removeEventListener('timer-stacks-alert', handleAlert);
  }, []);

  if (!alert) return null;

  return (
    <div className="fixed right-3 top-3 z-50 w-[min(24rem,calc(100vw-1.5rem))] rounded-xl border border-accent/20 bg-white p-4 shadow-float dark:border-accent/30 dark:bg-surface-900">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{alert.title}</p>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{alert.body}</p>
        </div>
        <button
          className="rounded-lg px-2 py-1 text-sm text-gray-400 hover:bg-surface-100 hover:text-gray-700 dark:hover:bg-surface-800 dark:hover:text-gray-200"
          onClick={() => setAlert(null)}
          aria-label="Dismiss alert"
        >
          ×
        </button>
      </div>
    </div>
  );
}

function AudioUnlockPrompt() {
  const { setSound } = useSettingsStore();
  const [message, setMessage] = useState<string | null>(null);
  const [enabling, setEnabling] = useState(false);

  useEffect(() => {
    const handleBlocked = (event: Event) => {
      const detail = (event as CustomEvent<{ message?: string }>).detail;
      setMessage(detail?.message ?? 'Tap Enable Sound to hear timer chimes.');
    };

    window.addEventListener('timer-stacks-audio-blocked', handleBlocked);
    return () => window.removeEventListener('timer-stacks-audio-blocked', handleBlocked);
  }, []);

  if (!message || isAudioUnlocked()) return null;

  async function handleEnableSound() {
    setEnabling(true);
    try {
      const unlocked = await unlockAudio();
      if (unlocked) {
        await setSound(true);
        setMessage(null);
      }
    } catch (error) {
      console.error('[audio] Failed to unlock audio', error);
    } finally {
      setEnabling(false);
    }
  }

  return (
    <div className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-md rounded-xl border border-amber-200 bg-white p-3 shadow-float dark:border-amber-900/60 dark:bg-surface-900">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-gray-700 dark:text-gray-200">{message}</p>
        <div className="flex shrink-0 gap-2">
          <Button size="sm" variant="primary" onClick={handleEnableSound} loading={enabling}>
            Enable Sound
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setMessage(null)}>
            Dismiss
          </Button>
        </div>
      </div>
    </div>
  );
}

function MobileHeader() {
  return (
    <header className="md:hidden shrink-0 safe-top safe-x bg-white/85 dark:bg-surface-900/90 glass border-b border-surface-200 dark:border-gray-800">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="text-xl leading-none">⏱</span>
          <span className="truncate text-[15px] font-semibold text-gray-900 dark:text-gray-100">
            Timer Stacks
          </span>
        </div>
        <span className="shrink-0 text-[11px] text-gray-400 dark:text-gray-500">v0.1</span>
      </div>
      <nav className="flex flex-wrap gap-1 px-3 pb-3">
        {nav.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              cn(
                'flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-3 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-accent/10 text-accent dark:bg-accent/20'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-surface-100 dark:hover:bg-surface-800',
              )
            }
          >
            <span className="text-base leading-none">{icon}</span>
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </header>
  );
}
