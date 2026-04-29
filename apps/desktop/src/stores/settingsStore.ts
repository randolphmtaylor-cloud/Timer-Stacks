import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Theme = 'light' | 'dark' | 'system';

interface Settings {
  theme: Theme;
  notificationsEnabled: boolean;
  soundEnabled: boolean;

  setTheme: (theme: Theme) => void;
  setNotifications: (enabled: boolean) => void;
  setSound: (enabled: boolean) => void;
}

export const useSettingsStore = create<Settings>()(
  persist(
    (set) => ({
      theme: 'system',
      notificationsEnabled: true,
      soundEnabled: true,

      setTheme: (theme) => set({ theme }),
      setNotifications: (notificationsEnabled) => set({ notificationsEnabled }),
      setSound: (soundEnabled) => set({ soundEnabled }),
    }),
    { name: 'ts:settings' },
  ),
);
