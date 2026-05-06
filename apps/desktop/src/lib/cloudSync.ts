import type { SessionRecord, TimerStack } from '@timer-stacks/core';

type SyncStatus = {
  ok: boolean;
  message?: string;
  error?: string;
};

type StacksResponse = SyncStatus & {
  stacks?: TimerStack[];
};

type SchemaResponse = SyncStatus & {
  tables?: string[];
};

const DEVICE_ID_KEY = 'timer-stacks-device-id';
const syncApiBaseUrl = import.meta.env.VITE_SYNC_API_BASE_URL ?? '';

function syncUrl(path: string): string {
  return `${syncApiBaseUrl}${path}`;
}

function getDeviceId(): string {
  try {
    const existing = localStorage.getItem(DEVICE_ID_KEY);
    if (existing) return existing;

    const generated = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, generated);
    return generated;
  } catch {
    return 'web';
  }
}

async function readSyncPayload<T extends SyncStatus>(response: Response): Promise<T> {
  const text = await response.text();
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
    throw new Error('Malformed sync API response');
  }

  return payload;
}

export async function checkCloudSyncStatus(): Promise<SyncStatus> {
  try {
    const response = await fetch(syncUrl('/api/sync/schema'), {
      method: 'POST',
      headers: { accept: 'application/json' },
    });
    await parseSyncResponse<SchemaResponse>(response);
    return { ok: true, message: 'Cloud sync connected' };
  } catch (error) {
    console.error('[cloud-sync] Status check failed', error);
    return {
      ok: false,
      message: 'Cloud sync unavailable',
      error: error instanceof Error ? error.message : String(error),
    };
  }
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
      deviceId: getDeviceId(),
      stacks,
    }),
  });
  const payload = await parseSyncResponse<StacksResponse>(response);
  return payload.stacks ?? stacks;
}

export async function deleteCloudStack(stackId: string): Promise<void> {
  const response = await fetch(syncUrl('/api/sync/stacks'), {
    method: 'DELETE',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ stackId, deviceId: getDeviceId() }),
  });
  await parseSyncResponse<SyncStatus>(response);
}

export async function mergeCloudStacks(localStacks: TimerStack[]): Promise<TimerStack[]> {
  const remoteStacks = await upsertCloudStacks(localStacks);
  const merged = new Map<string, TimerStack>();

  for (const stack of remoteStacks) merged.set(stack.stackId, stack);
  for (const stack of localStacks) {
    const remote = merged.get(stack.stackId);
    if (!remote || stack.updatedAt > remote.updatedAt) {
      merged.set(stack.stackId, stack);
    }
  }

  return [...merged.values()].sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function saveCloudSessionRecord(_record: SessionRecord): Promise<void> {
  // Session history is still stored locally; stack sync uses the Turso API above.
}
