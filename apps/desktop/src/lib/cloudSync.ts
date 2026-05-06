import type { SessionRecord, TimerStack } from '@timer-stacks/core';

type SyncStatus = {
  ok: boolean;
  message?: string;
  error?: string;
};

type StacksResponse = SyncStatus & {
  stacks?: TimerStack[];
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

async function parseSyncResponse<T extends SyncStatus>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => ({}))) as T;
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error ?? `Sync API failed with status ${response.status}`);
  }
  return payload;
}

export async function checkCloudSyncStatus(): Promise<SyncStatus> {
  try {
    const response = await fetch(syncUrl('/api/sync/status'), {
      method: 'GET',
      headers: { accept: 'application/json' },
    });
    await parseSyncResponse<SyncStatus>(response);
    return { ok: true, message: 'Cloud sync connected' };
  } catch (error) {
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
