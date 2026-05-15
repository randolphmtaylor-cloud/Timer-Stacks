// ---------------------------------------------------------------------------
// Mobile notification service — expo-notifications.
//
// Message builders live in @timer-stacks/core. This file is purely the
// platform-specific adapter that delivers a NotificationPayload to the OS.
// ---------------------------------------------------------------------------

import * as Notifications from 'expo-notifications';
import type { INotificationService, NotificationPayload } from '@timer-stacks/storage';

// Configure foreground presentation (show alert + sound even when app is open)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export class ExpoNotificationService implements INotificationService {
  async requestPermission(): Promise<boolean> {
    const { status } = await Notifications.requestPermissionsAsync();
    console.info('[notifications] Permission request result', { status });
    return status === 'granted';
  }

  async isPermitted(): Promise<boolean> {
    const { status } = await Notifications.getPermissionsAsync();
    console.info('[notifications] Permission status', { status });
    return status === 'granted';
  }

  async show(payload: NotificationPayload): Promise<boolean> {
    if (!(await this.isPermitted())) return false;
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: payload.title,
          body: payload.body,
          sound: payload.sound !== 'tick', // play sound for chime/complete, skip for tick
        },
        trigger: null, // immediate
      });
      console.info('[notifications] Expo notification scheduled', {
        title: payload.title,
        sound: payload.sound,
      });
      return true;
    } catch (error) {
      console.error('[notifications] Expo notification failed', error);
      return false;
    }
  }
}
