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
    return status === 'granted';
  }

  async isPermitted(): Promise<boolean> {
    const { status } = await Notifications.getPermissionsAsync();
    return status === 'granted';
  }

  async show(payload: NotificationPayload): Promise<void> {
    if (!(await this.isPermitted())) return;
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: payload.title,
          body: payload.body,
          sound: payload.sound !== 'tick', // play sound for chime/complete, skip for tick
        },
        trigger: null, // immediate
      });
    } catch {
      // Fail silently — UI remains correct without notification
    }
  }
}
