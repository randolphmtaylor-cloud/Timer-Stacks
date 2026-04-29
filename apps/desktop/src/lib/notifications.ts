import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from '@tauri-apps/plugin-notification';
import type { INotificationService, NotificationPayload } from '@timer-stacks/storage';

type Permission = 'default' | 'denied' | 'granted' | 'prompt' | 'prompt-with-rationale';

function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export async function ensureNotificationPermission(): Promise<boolean> {
  if (!isTauriRuntime()) return false;

  try {
    if (await isPermissionGranted()) return true;
    const permission = (await requestPermission()) as Permission;
    return permission === 'granted';
  } catch {
    return false;
  }
}

async function notify(title: string, body: string): Promise<void> {
  if (!(await ensureNotificationPermission())) return;

  try {
    sendNotification({ title, body });
  } catch {
    // Native notifications are a convenience; timer state remains authoritative.
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
    if (!isTauriRuntime()) return false;
    try {
      return isPermissionGranted();
    } catch {
      return false;
    }
  }

  async show(payload: NotificationPayload): Promise<void> {
    await notify(payload.title, payload.body);
  }
}
