import { TimerStackSchema, type SessionRecord, type TimerStack } from '@timer-stacks/core';

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
const syncApiBaseUrl = (import.meta.env.VITE_SYNC_API_BASE_URL ?? '').replace(/\/$/, '');
const SYNC_STATUS_PATH = '/api/sync/status';
const SYNC_STACKS_PATH = '/api/sync/stacks';

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

export async function fetchCloudStacks(): Promise<TimerStack[]> {
  console.info('[cloud-sync] Loading cloud stacks');
  const payload = await requestSync<StacksResponse>(SYNC_STACKS_PATH, {
    method: 'GET',
    headers: { accept: 'application/json' },
  });

  if (!Array.isArray(payload.stacks)) {
    console.error('[cloud-sync] Stack load response did not include a stacks array', {
      payload,
    });
    throw new Error('Sync API response did not include a stacks array');
  }

  const validated = TimerStackSchema.array().safeParse(payload.stacks);
  if (!validated.success) {
    console.error('[cloud-sync] Stack load response failed validation', {
      issues: validated.error.issues,
      stackCount: payload.stacks.length,
    });
    throw new Error('Sync API returned invalid stack data');
  }

  console.info('[cloud-sync] Loaded and validated cloud stacks', {
    stackCount: validated.data.length,
    stackIds: validated.data.map((stack) => stack.stackId),
  });
  return validated.data;
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

  if (!Array.isArray(payload.stacks)) {
    console.error('[cloud-sync] Stack upload response did not include a stacks array', {
      payload,
    });
    throw new Error('Sync API upload response did not include a stacks array');
  }

  const validated = TimerStackSchema.array().safeParse(payload.stacks);
  if (!validated.success) {
    console.error('[cloud-sync] Stack upload response failed validation', {
      issues: validated.error.issues,
      stackCount: payload.stacks.length,
    });
    throw new Error('Sync API returned invalid stack data after upload');
  }

  console.info('[cloud-sync] Uploaded stacks and received cloud state', {
    uploadedStackCount: stacks.length,
    cloudStackCount: validated.data.length,
  });
  return validated.data;
}

export async function saveCloudSessionRecord(_record: SessionRecord): Promise<void> {
  // Session history is still stored locally; stack sync uses the Turso API above.
}
