import { TimerStackSchema, type SessionRecord, type TimerStack } from '@timer-stacks/core';

type SyncStatus = {
  ok: boolean;
  status?: string;
  message?: string;
  error?: string;
};

type StacksResponse = SyncStatus & {
  stacks?: TimerStack[];
  deletedStackIds?: string[];
};

export type CloudSettings = {
  theme: 'light' | 'dark' | 'system';
  notificationsEnabled: boolean;
  soundEnabled: boolean;
  updatedAt: number;
};

type SettingsResponse = SyncStatus & {
  settings?: CloudSettings;
};

const DEVICE_ID_KEY = 'timer-stacks-device-id';
const SETTINGS_SCOPE_ID = 'timer-stacks-global-settings';
const syncApiBaseUrl = (import.meta.env.VITE_SYNC_API_BASE_URL ?? '').replace(/\/$/, '');
const SYNC_STATUS_PATH = '/api/sync/status';
const SYNC_STACKS_PATH = '/api/sync/stacks';
const SYNC_SETTINGS_PATH = '/api/sync/settings';

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

async function readSyncPayload<T extends SyncStatus>(
  response: Response,
  context: { method: string; url: string },
): Promise<T> {
  const text = await response.text();
  console.info('[cloud-sync] Raw response body', {
    method: context.method,
    url: context.url,
    status: response.status,
    body: text,
  });
  if (!text) return {} as T;

  try {
    return JSON.parse(text) as T;
  } catch (error) {
    console.error('[cloud-sync] JSON parse failed', {
      method: context.method,
      url: context.url,
      status: response.status,
      contentType: response.headers.get('content-type'),
      bodyPreview: text.slice(0, 500),
      error,
    });
    throw new Error(
      `Malformed sync API response from ${context.method} ${context.url} (HTTP ${response.status})`,
    );
  }
}

async function parseSyncResponse<T extends SyncStatus>(
  response: Response,
  context: { method: string; url: string },
): Promise<T> {
  console.info('[cloud-sync] HTTP status', {
    method: context.method,
    url: context.url,
    status: response.status,
  });
  const payload = await readSyncPayload<T>(response, context);
  console.info('[cloud-sync] Parsed JSON', {
    method: context.method,
    url: context.url,
    payload,
  });

  if (!response.ok) {
    const detail = payload.error ?? payload.message;
    console.error('[cloud-sync] Sync API returned an error response', {
      method: context.method,
      url: context.url,
      status: response.status,
      payload,
    });
    throw new Error(
      detail
        ? `Sync API failed for ${context.method} ${context.url} with status ${response.status}: ${detail}`
        : `Sync API failed for ${context.method} ${context.url} with status ${response.status}`,
    );
  }

  if (payload.ok !== true) {
    const detail = payload.error ?? payload.message;
    console.error('[cloud-sync] Sync API response missing ok: true', {
      method: context.method,
      url: context.url,
      payload,
    });
    throw new Error(
      detail ?? `Sync API response from ${context.method} ${context.url} did not include ok: true`,
    );
  }

  return payload;
}

async function requestSync<T extends SyncStatus>(
  path: string,
  init: RequestInit & { method: string },
): Promise<T> {
  const url = syncUrl(path);

  try {
    const response = await fetch(url, init);
    return await parseSyncResponse<T>(response, { method: init.method, url });
  } catch (error) {
    console.error('[cloud-sync] Request failed', {
      method: init.method,
      url,
      error,
    });
    throw error;
  }
}

export async function checkCloudSyncStatus(): Promise<SyncStatus> {
  try {
    await requestSync<SyncStatus>(SYNC_STATUS_PATH, {
      method: 'GET',
      headers: { accept: 'application/json' },
    });
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

function validateStacksResponse(payload: StacksResponse, context: string): TimerStack[] {
  if (!Array.isArray(payload.stacks)) {
    console.error(`[cloud-sync] ${context} response did not include a stacks array`, {
      payload,
    });
    throw new Error(`Sync API ${context} response did not include a stacks array`);
  }

  const validated = TimerStackSchema.array().safeParse(payload.stacks);
  if (!validated.success) {
    console.error(`[cloud-sync] ${context} response failed validation`, {
      issues: validated.error.issues,
      stackCount: payload.stacks.length,
    });
    throw new Error(`Sync API returned invalid stack data after ${context}`);
  }

  return validated.data;
}

export async function fetchCloudStacks(): Promise<TimerStack[]> {
  console.info('[cloud-sync] Loading cloud stacks');
  const payload = await requestSync<StacksResponse>(SYNC_STACKS_PATH, {
    method: 'GET',
    headers: { accept: 'application/json' },
  });

  const stacks = validateStacksResponse(payload, 'load');

  console.info('[cloud-sync] Loaded and validated cloud stacks', {
    stackCount: stacks.length,
    stackIds: stacks.map((stack) => stack.stackId),
  });
  return stacks;
}

export async function fetchCloudStackState(): Promise<{
  stacks: TimerStack[];
  deletedStackIds: string[];
}> {
  const payload = await requestSync<StacksResponse>(SYNC_STACKS_PATH, {
    method: 'GET',
    headers: { accept: 'application/json' },
  });

  return {
    stacks: validateStacksResponse(payload, 'load'),
    deletedStackIds: Array.isArray(payload.deletedStackIds) ? payload.deletedStackIds : [],
  };
}

export async function upsertCloudStack(stack: TimerStack): Promise<void> {
  await upsertCloudStacks([stack]);
}

export async function upsertCloudStacks(stacks: TimerStack[]): Promise<TimerStack[]> {
  console.info('[cloud-sync] Uploading stacks to cloud', {
    uploadedStackCount: stacks.length,
    stackIds: stacks.map((stack) => stack.stackId),
  });
  const payload = await requestSync<StacksResponse>(SYNC_STACKS_PATH, {
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

  const validated = validateStacksResponse(payload, 'upload');

  console.info('[cloud-sync] Uploaded stacks and received cloud state', {
    uploadedStackCount: stacks.length,
    cloudStackCount: validated.length,
  });
  return validated;
}

export async function deleteCloudStack(stackId: string): Promise<TimerStack[]> {
  const payload = await requestSync<StacksResponse>(SYNC_STACKS_PATH, {
    method: 'DELETE',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ stackId }),
  });

  return validateStacksResponse(payload, 'delete');
}

export async function fetchCloudSettings(): Promise<CloudSettings> {
  const payload = await requestSync<SettingsResponse>(
    `${SYNC_SETTINGS_PATH}?deviceId=${encodeURIComponent(SETTINGS_SCOPE_ID)}`,
    {
      method: 'GET',
      headers: { accept: 'application/json' },
    },
  );

  if (!payload.settings) {
    throw new Error('Sync API settings response did not include settings');
  }

  return payload.settings;
}

export async function saveCloudSettings(settings: CloudSettings): Promise<CloudSettings> {
  const payload = await requestSync<SettingsResponse>(SYNC_SETTINGS_PATH, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      deviceId: SETTINGS_SCOPE_ID,
      settings,
    }),
  });

  if (!payload.settings) {
    throw new Error('Sync API settings upload response did not include settings');
  }

  return payload.settings;
}

export async function saveCloudSessionRecord(_record: SessionRecord): Promise<void> {
  // Session history is still stored locally; stack sync uses the Turso API above.
}
