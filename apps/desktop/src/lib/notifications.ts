import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from '@tauri-apps/plugin-notification';
import type { INotificationService, NotificationPayload } from '@timer-stacks/storage';

type Permission = 'default' | 'denied' | 'granted' | 'prompt' | 'prompt-with-rationale';
const IN_APP_ALERT_EVENT = 'timer-stacks-alert';

export type InAppAlertDetail = {
  title: string;
  body: string;
};

function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

function isWebNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export async function ensureNotificationPermission(): Promise<boolean> {
  console.info('[notifications] Checking notification permission');
  if (!isTauriRuntime()) {
    if (!isWebNotificationSupported()) return false;
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') return false;

    try {
      const permission = await Notification.requestPermission();
      console.info('[notifications] Browser notification permission result', { permission });
      return permission === 'granted';
    } catch (error) {
      console.error('[notifications] Browser notification permission request failed', error);
      return false;
    }
  }

  try {
    if (await isPermissionGranted()) return true;
    const permission = (await requestPermission()) as Permission;
    console.info('[notifications] Tauri notification permission result', { permission });
    return permission === 'granted';
  } catch (error) {
    console.error('[notifications] Tauri notification permission request failed', error);
    return false;
  }
}

export async function ensureStartupNotificationPermission(): Promise<boolean> {
  if (isTauriRuntime()) return ensureNotificationPermission();
  return isWebNotificationSupported() && Notification.permission === 'granted';
}

function showInAppAlert(title: string, body: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<InAppAlertDetail>(IN_APP_ALERT_EVENT, {
    detail: { title, body },
  }));
}

async function notify(title: string, body: string): Promise<boolean> {
  if (!(await ensureNotificationPermission())) {
    console.warn('[notifications] Permission unavailable; using in-app alert', { title });
    showInAppAlert(title, body);
    return false;
  }

  if (!isTauriRuntime()) {
    try {
      new Notification(title, { body });
      console.info('[notifications] Browser notification delivered', { title });
      return true;
    } catch (error) {
      console.error('[notifications] Browser notification failed; using in-app alert', error);
      showInAppAlert(title, body);
      return false;
    }
  }

  try {
    sendNotification({ title, body });
    console.info('[notifications] Tauri notification delivered', { title });
    return true;
  } catch (error) {
    console.error('[notifications] Tauri notification failed; using in-app alert', error);
    showInAppAlert(title, body);
    return false;
  }
}

export async function notifyTimerComplete(
  title = 'Timer complete',
  body = 'Timer is done.',
): Promise<void> {
  await notify(title, body);
}

export async function notifyStackComplete(
  title = 'Stack complete',
  body = 'Stack is complete.',
): Promise<void> {
  await notify(title, body);
}

export class WebNotificationService implements INotificationService {
  async requestPermission(): Promise<boolean> {
    return ensureNotificationPermission();
  }

  async isPermitted(): Promise<boolean> {
    if (!isTauriRuntime()) {
      return isWebNotificationSupported() && Notification.permission === 'granted';
    }
    try {
      return isPermissionGranted();
    } catch {
      return false;
    }
  }

  async show(payload: NotificationPayload): Promise<boolean> {
    return notify(payload.title, payload.body);
  }
}
