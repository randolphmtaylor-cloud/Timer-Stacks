import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { fetchCloudSettings, saveCloudSettings, type CloudSettings } from '../lib/cloudSync.js';

type Theme = 'light' | 'dark' | 'system';

interface Settings {
  theme: Theme;
  notificationsEnabled: boolean;
  soundEnabled: boolean;
  updatedAt: number;

  loadCloudSettings: () => Promise<void>;
  setTheme: (theme: Theme) => Promise<void>;
  setNotifications: (enabled: boolean) => Promise<void>;
  setSound: (enabled: boolean) => Promise<void>;
}

function toCloudSettings(settings: Settings): CloudSettings {
  return {
    theme: settings.theme,
    notificationsEnabled: settings.notificationsEnabled,
    soundEnabled: settings.soundEnabled,
    updatedAt: settings.updatedAt,
  };
}

export const useSettingsStore = create<Settings>()(
  persist(
    (set, get) => ({
      theme: 'system',
      notificationsEnabled: true,
      soundEnabled: false,
      updatedAt: 0,

      loadCloudSettings: async () => {
        const cloud = await fetchCloudSettings();
        if (cloud.updatedAt > get().updatedAt) {
          set(cloud);
        }
      },
      setTheme: async (theme) => {
        set({ theme, updatedAt: Date.now() });
        await saveCloudSettings(toCloudSettings(get()));
      },
      setNotifications: async (notificationsEnabled) => {
        set({ notificationsEnabled, updatedAt: Date.now() });
        await saveCloudSettings(toCloudSettings(get()));
      },
      setSound: async (soundEnabled) => {
        set({ soundEnabled, updatedAt: Date.now() });
        await saveCloudSettings(toCloudSettings(get()));
      },
    }),
    {
      name: 'ts:settings',
      partialize: ({ theme, notificationsEnabled, soundEnabled, updatedAt }) => ({
        theme,
        notificationsEnabled,
        soundEnabled,
        updatedAt,
      }),
    },
  ),
);
