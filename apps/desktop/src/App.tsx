import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { formatMs } from '@timer-stacks/core';
import { useSettingsStore } from './stores/settingsStore.js';
import { useStackStore } from './stores/stackStore.js';
import { useSessionStore } from './stores/sessionStore.js';
import { ensureStartupNotificationPermission } from './lib/notifications.js';
import { updateDesktopTrayTimer } from './lib/desktopTray.js';
import { Layout } from './components/layout/Layout.js';
import { Dashboard } from './components/dashboard/Dashboard.js';
import { StackBuilder } from './components/builder/StackBuilder.js';
import { ActiveSession } from './components/session/ActiveSession.js';
import { TemplatesLibrary } from './components/templates/TemplatesLibrary.js';
import { History } from './components/history/History.js';
import { Settings } from './components/settings/Settings.js';

function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { theme } = useSettingsStore();

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else if (theme === 'light') {
      root.classList.remove('dark');
    } else {
      // System
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const apply = (dark: boolean) =>
        dark ? root.classList.add('dark') : root.classList.remove('dark');
      apply(mq.matches);
      const handler = (e: MediaQueryListEvent) => apply(e.matches);
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    }
    return undefined;
  }, [theme]);

  return <>{children}</>;
}

export default function App() {
  const { load: loadStacks, stacks } = useStackStore();
  const { hydrate: hydrateSessions, sessions, getSessionState } = useSessionStore();
  const { loadCloudSettings, notificationsEnabled } = useSettingsStore();

  // Bootstrap
  useEffect(() => {
    loadStacks();
    loadCloudSettings().catch((error) => {
      console.error('[settings-store] Initial cloud settings sync failed', error);
    });
  }, [loadCloudSettings, loadStacks]);

  useEffect(() => {
    if (notificationsEnabled) {
      ensureStartupNotificationPermission().catch(() => {});
    }
  }, [notificationsEnabled]);

  // Restore sessions after stacks are loaded
  useEffect(() => {
    if (stacks.length > 0) {
      hydrateSessions(stacks);
    }
  }, [stacks, hydrateSessions]);

  useEffect(() => {
    const updateTray = () => {
      const active = sessions.find((session) => session.status === 'running') ??
        sessions.find((session) => session.status === 'paused');

      if (!active) {
        updateDesktopTrayTimer(null).catch(() => {});
        return;
      }

      const state = getSessionState(active.sessionId);
      const paused = active.status === 'paused';
      const segRemaining = formatMs(state?.segmentRemainingMs ?? 0);
      const stackRemaining = formatMs(state?.stackRemainingMs ?? 0);
      const prefix = paused ? '⏸ ' : '';
      // Show "seg / stack" so the tray conveys both timers at a glance
      const label = `${prefix}${segRemaining} / ${stackRemaining}`;
      updateDesktopTrayTimer(label).catch(() => {});
    };

    updateTray();
    const id = window.setInterval(updateTray, 1000);
    return () => window.clearInterval(id);
  }, [getSessionState, sessions]);

  // Keyboard shortcut: N = new stack
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault();
        window.location.hash = '/builder';
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/builder" element={<StackBuilder />} />
            <Route path="/session/:id" element={<ActiveSession />} />
            <Route path="/templates" element={<TemplatesLibrary />} />
            <Route path="/history" element={<History />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}
