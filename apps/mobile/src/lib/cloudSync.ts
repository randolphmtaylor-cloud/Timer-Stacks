import AsyncStorage from '@react-native-async-storage/async-storage';
import { v4 as uuidv4 } from 'uuid';
import type { SessionRecord, TimerStack } from '@timer-stacks/core';

type SyncStatus = {
  ok: boolean;
  status?: string;
  message?: string;
  error?: string;
};

type StacksResponse = SyncStatus & {
  stacks?: TimerStack[];
};

const DEVICE_ID_KEY = 'timer-stacks-device-id';
const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};
const syncApiBaseUrl = env.EXPO_PUBLIC_SYNC_API_URL ?? '';

function syncUrl(path: string): string {
  return `${syncApiBaseUrl}${path}`;
}

async function getDeviceId(): Promise<string> {
  const existing = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (existing) return existing;

  const generated = uuidv4();
  await AsyncStorage.setItem(DEVICE_ID_KEY, generated);
  return generated;
}

async function readSyncPayload<T extends SyncStatus>(response: Response): Promise<T> {
  const text = await response.text();
  console.info('[cloud-sync] Raw response body', text);
  if (!text) return {} as T;

  try {
    return JSON.parse(text) as T;
  } catch (error) {
    console.error('[cloud-sync] JSON parse failed', error);
    throw new Error('Malformed sync API response');
  }
}

async function parseSyncResponse<T extends SyncStatus>(response: Response): Promise<T> {
  console.info('[cloud-sync] HTTP status', response.status);
  const payload = await readSyncPayload<T>(response);
  console.info('[cloud-sync] Parsed JSON', payload);

  if (!response.ok) {
    const detail = payload.error ?? payload.message;
    throw new Error(
      detail
        ? `Sync API failed with status ${response.status}: ${detail}`
        : `Sync API failed with status ${response.status}`,
    );
  }

  if (payload.ok !== true) {
    const detail = payload.error ?? payload.message;
    throw new Error(detail ?? 'Sync API response did not include ok: true');
  }

  return payload;
}

export async function fetchCloudStacks(): Promise<TimerStack[]> {
  const response = await fetch(syncUrl('/api/sync/stacks'), {
    method: 'GET',
    headers: { accept: 'application/json' },
  });
  const payload = await parseSyncResponse<StacksResponse>(response);
  return payload.stacks ?? [];
}

export async function upsertCloudStack(stack: TimerStack): Promise<void> {
  await upsertCloudStacks([stack]);
}

export async function upsertCloudStacks(stacks: TimerStack[]): Promise<TimerStack[]> {
  const response = await fetch(syncUrl('/api/sync/stacks'), {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      deviceId: await getDeviceId(),
      stacks,
    }),
  });
  const payload = await parseSyncResponse<StacksResponse>(response);
  return payload.stacks ?? stacks;
}

export async function saveCloudSessionRecord(_record: SessionRecord): Promise<void> {
  // Session history remains local for now; stack sync is handled by the Turso API.
}
