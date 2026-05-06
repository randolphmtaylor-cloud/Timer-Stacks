import React, { useEffect, useState } from 'react';
import { useSettingsStore } from '../../stores/settingsStore.js';
import { useStackStore } from '../../stores/stackStore.js';
import {
  ensureNotificationPermission,
  notifyStackComplete,
  notifyTimerComplete,
} from '../../lib/notifications.js';
import { checkCloudSyncStatus } from '../../lib/cloudSync.js';
import {
  playSegmentCompleteSound,
  playStackCompleteSound,
  unlockNotificationAudio,
} from '../../lib/sounds.js';
import { Card } from '../ui/Card.js';
import { Button } from '../ui/Button.js';

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-4 border-b border-surface-100 dark:border-gray-700/50 last:border-0">
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{label}</p>
        {description && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{description}</p>}
      </div>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-11 w-16 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-accent/40 md:h-6 md:w-11 ${
          checked ? 'bg-accent' : 'bg-surface-300 dark:bg-gray-600'
        }`}
      >
        <span
          className={`inline-block h-7 w-7 transform rounded-full bg-white shadow transition-transform md:h-4 md:w-4 ${
            checked ? 'translate-x-8 md:translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );
}

export function Settings() {
  const { theme, notificationsEnabled, soundEnabled, setTheme, setNotifications, setSound } =
    useSettingsStore();
  const { stacks, syncCloud } = useStackStore();
  const [testingNotifications, setTestingNotifications] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'checking' | 'connected' | 'unavailable'>('checking');
  const [syncError, setSyncError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    refreshSyncStatus().catch(() => {});
  }, []);

  async function testNotifications() {
    setTestingNotifications(true);
    try {
      await unlockNotificationAudio();
      if (soundEnabled) playSegmentCompleteSound();
      if (notificationsEnabled) {
        await ensureNotificationPermission();
        await notifyTimerComplete('Segment complete', 'Notification test segment is done.');
      }

      window.setTimeout(() => {
        if (soundEnabled) playStackCompleteSound();
        if (notificationsEnabled) {
          notifyStackComplete('Stack complete', 'Notification test stack is complete.').catch(() => {});
        }
      }, 700);
    } finally {
      window.setTimeout(() => setTestingNotifications(false), 900);
    }
  }

  function handleNotificationsChange(enabled: boolean) {
    setNotifications(enabled);
    if (enabled) {
      ensureNotificationPermission().catch(() => {});
    }
  }

  function exportTemplates() {
    const templates = stacks.filter((s) => s.isTemplate);
    const blob = new Blob([JSON.stringify(templates, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'timer-stacks-templates.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function refreshSyncStatus() {
    setSyncStatus('checking');
    const status = await checkCloudSyncStatus();
    setSyncStatus(status.ok ? 'connected' : 'unavailable');
    setSyncError(status.ok ? null : status.error ?? null);
  }

  async function handleSyncNow() {
    setIsSyncing(true);
    try {
      await syncCloud();
      await refreshSyncStatus();
    } catch (error) {
      setSyncStatus('unavailable');
      setSyncError(error instanceof Error ? error.message : 'Cloud sync failed');
    } finally {
      setIsSyncing(false);
    }
  }

  return (
    <div className="w-full max-w-xl mx-auto px-4 py-5 sm:px-6 md:p-8">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-8">Settings</h1>

      {/* Cloud sync */}
      <section className="mb-8">
        <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
          Cloud Sync
        </h2>
        <Card>
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {syncStatus === 'connected'
                  ? 'Cloud sync connected'
                  : syncStatus === 'checking'
                    ? 'Checking cloud sync'
                    : 'Cloud sync unavailable'}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Timer Stacks syncs through the Turso API using server-side credentials.
              </p>
              {syncError && <p className="text-xs text-red-500 mt-2">{syncError}</p>}
            </div>
            <div className="grid grid-cols-1 gap-2 sm:flex">
              <Button size="sm" variant="secondary" onClick={handleSyncNow} loading={isSyncing}>
                Sync Now
              </Button>
              <Button size="sm" variant="ghost" onClick={() => refreshSyncStatus()}>
                Check Status
              </Button>
            </div>
          </div>
        </Card>
      </section>

      {/* Appearance */}
      <section className="mb-8">
        <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
          Appearance
        </h2>
        <Card>
          <div className="space-y-1">
            {(['light', 'dark', 'system'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTheme(t)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  theme === t
                    ? 'bg-accent/10 text-accent'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-surface-50 dark:hover:bg-surface-700'
                }`}
              >
                <span className="capitalize">{t}</span>
                {theme === t && <span>✓</span>}
              </button>
            ))}
          </div>
        </Card>
      </section>

      {/* Notifications */}
      <section className="mb-8">
        <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
          Notifications
        </h2>
        <Card>
          <ToggleRow
            label="Enable Notifications"
            description="Show OS notifications when segments and stacks complete"
            checked={notificationsEnabled}
            onChange={handleNotificationsChange}
          />
          <ToggleRow
            label="Sound Cues"
            description="Play a sound when transitions occur"
            checked={soundEnabled}
            onChange={setSound}
          />
          <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                Test Alerts
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Play both sounds and send sample segment and stack notifications
              </p>
            </div>
            <Button
              size="sm"
              variant="secondary"
              onClick={testNotifications}
              loading={testingNotifications}
              className="w-full sm:w-auto"
            >
              Test Alerts
            </Button>
          </div>
        </Card>
      </section>

      {/* Data */}
      <section>
        <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
          Data
        </h2>
        <Card>
          <div className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Export Templates</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Download all templates as JSON</p>
            </div>
            <Button size="sm" variant="secondary" onClick={exportTemplates} className="w-full sm:w-auto">
              Export
            </Button>
          </div>
        </Card>
      </section>
    </div>
  );
}
