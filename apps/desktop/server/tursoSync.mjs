import { createTursoSchema, writeJson } from './tursoSchema.mjs';

const REQUIRED_ENV = ['TURSO_DATABASE_URL', 'TURSO_AUTH_TOKEN'];

function normalizeTursoUrl(databaseUrl) {
  const httpUrl = databaseUrl.startsWith('libsql://')
    ? `https://${databaseUrl.slice('libsql://'.length)}`
    : databaseUrl;
  const url = new URL(httpUrl);

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('TURSO_DATABASE_URL must use libsql://, https://, or http://');
  }

  url.pathname = '/v2/pipeline';
  url.search = '';
  url.hash = '';
  return url.toString();
}

function getConfig(env = process.env) {
  const missing = REQUIRED_ENV.filter((key) => !env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variable(s): ${missing.join(', ')}`);
  }

  return {
    pipelineUrl: normalizeTursoUrl(env.TURSO_DATABASE_URL),
    authToken: env.TURSO_AUTH_TOKEN,
  };
}

function tursoValue(value) {
  if (value === null || value === undefined) return { type: 'null' };
  if (typeof value === 'number') return { type: 'integer', value: String(Math.trunc(value)) };
  return { type: 'text', value: String(value) };
}

function fromTursoValue(value) {
  if (!value || value.type === 'null') return null;
  if (value.type === 'integer' || value.type === 'float') return Number(value.value);
  return value.value ?? null;
}

function getTursoError(result, fallback) {
  if (!result) return fallback;
  if (result.type === 'error') {
    return result.error?.message ?? result.error ?? fallback;
  }
  if (result.type !== 'ok') {
    return `Unexpected Turso response type: ${result.type}`;
  }
  return null;
}

async function execute({ sql, args = [], fetchImpl = globalThis.fetch }) {
  if (typeof fetchImpl !== 'function') {
    throw new Error('A Fetch API implementation is required to connect to Turso');
  }

  const { pipelineUrl, authToken } = getConfig();
  const response = await fetchImpl(pipelineUrl, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${authToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      requests: [
        {
          type: 'execute',
          stmt: {
            sql,
            args: args.map(tursoValue),
          },
        },
        {
          type: 'close',
        },
      ],
    }),
  });

  const text = await response.text();
  let payload;
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { raw: text };
  }

  if (!response.ok) {
    const message = payload?.message ?? payload?.error ?? text;
    throw new Error(`Turso request failed (${response.status}): ${message}`);
  }

  const result = payload?.results?.[0];
  const error = getTursoError(result, 'Turso did not return an execution result');
  if (error) {
    throw new Error(`Turso statement failed: ${error}`);
  }

  return result.response?.result ?? { cols: [], rows: [] };
}

async function readJson(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return req.body ? JSON.parse(req.body) : {};

  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

function rowToObject(result, row) {
  const names = (result.cols ?? []).map((col) => col.name);
  return Object.fromEntries(row.map((value, index) => [names[index], fromTursoValue(value)]));
}

function rowToStack(row) {
  return {
    stackId: row.id,
    name: row.name,
    description: row.description ?? undefined,
    icon: row.icon ?? undefined,
    totalDurationMs: Number(row.total_duration_seconds) * 1000,
    isTemplate: Number(row.is_template) === 1,
    createdAt: Date.parse(row.created_at),
    updatedAt: Date.parse(row.updated_at),
    segments: [],
  };
}

function rowToSegment(row) {
  return {
    segmentId: row.id,
    label: row.name,
    durationMs: Number(row.duration_seconds) * 1000,
    color: row.color ?? undefined,
  };
}

function normalizeSettings(settings) {
  return {
    theme: ['light', 'dark', 'system'].includes(settings?.theme) ? settings.theme : 'system',
    notificationsEnabled:
      typeof settings?.notificationsEnabled === 'boolean' ? settings.notificationsEnabled : true,
    soundEnabled: typeof settings?.soundEnabled === 'boolean' ? settings.soundEnabled : true,
    updatedAt: Number.isFinite(Number(settings?.updatedAt)) ? Number(settings.updatedAt) : Date.now(),
  };
}

function isoFromMs(ms) {
  return new Date(ms).toISOString();
}

function secondsFromMs(ms) {
  return Math.max(0, Math.round(Number(ms) / 1000));
}

export async function fetchStacks() {
  await createTursoSchema();

  const stackResult = await execute({
    sql: `SELECT id, name, description, icon, total_duration_seconds, is_template, created_at, updated_at
      FROM stacks
      WHERE deleted_at IS NULL
      ORDER BY updated_at DESC`,
  });
  const segmentResult = await execute({
    sql: `SELECT id, stack_id, name, duration_seconds, color, position
      FROM stack_segments
      WHERE deleted_at IS NULL
      ORDER BY stack_id, position ASC`,
  });

  const stacks = new Map(
    (stackResult.rows ?? [])
      .map((row) => rowToObject(stackResult, row))
      .map((row) => [row.id, rowToStack(row)]),
  );

  for (const row of segmentResult.rows ?? []) {
    const segment = rowToObject(segmentResult, row);
    stacks.get(segment.stack_id)?.segments.push(rowToSegment(segment));
  }

  return [...stacks.values()];
}

export async function fetchDeletedStackIds() {
  await createTursoSchema();

  const result = await execute({
    sql: `SELECT id
      FROM stacks
      WHERE deleted_at IS NOT NULL`,
  });

  return (result.rows ?? []).map((row) => String(rowToObject(result, row).id));
}

export async function upsertStacks(stacks, deviceId) {
  await createTursoSchema();

  for (const stack of stacks) {
    await execute({
      sql: `INSERT INTO stacks (
          id, device_id, name, description, icon, total_duration_seconds, is_template, created_at, updated_at, deleted_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
        ON CONFLICT(id) DO UPDATE SET
          device_id = excluded.device_id,
          name = excluded.name,
          description = excluded.description,
          icon = excluded.icon,
          total_duration_seconds = excluded.total_duration_seconds,
          is_template = excluded.is_template,
          updated_at = excluded.updated_at,
          deleted_at = NULL`,
      args: [
        stack.stackId,
        deviceId,
        stack.name,
        stack.description ?? null,
        stack.icon ?? null,
        secondsFromMs(stack.totalDurationMs),
        stack.isTemplate ? 1 : 0,
        isoFromMs(stack.createdAt),
        isoFromMs(stack.updatedAt),
      ],
    });

    await execute({
      sql: 'UPDATE stack_segments SET deleted_at = ? WHERE stack_id = ?',
      args: [new Date().toISOString(), stack.stackId],
    });

    for (const [position, segment] of stack.segments.entries()) {
      await execute({
        sql: `INSERT INTO stack_segments (
            id, device_id, stack_id, name, duration_seconds, color, position, created_at, updated_at, deleted_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
          ON CONFLICT(id) DO UPDATE SET
            device_id = excluded.device_id,
            stack_id = excluded.stack_id,
            name = excluded.name,
            duration_seconds = excluded.duration_seconds,
            color = excluded.color,
            position = excluded.position,
            updated_at = excluded.updated_at,
            deleted_at = NULL`,
        args: [
          segment.segmentId,
          deviceId,
          stack.stackId,
          segment.label,
          secondsFromMs(segment.durationMs),
          segment.color ?? null,
          position,
          isoFromMs(stack.createdAt),
          isoFromMs(stack.updatedAt),
        ],
      });
    }
  }
}

export async function fetchSettings(deviceId) {
  await createTursoSchema();

  const result = await execute({
    sql: `SELECT key, value, updated_at
      FROM app_settings
      WHERE device_id = ? AND deleted_at IS NULL`,
    args: [deviceId],
  });

  const settings = {};
  let updatedAt = 0;
  for (const row of result.rows ?? []) {
    const item = rowToObject(result, row);
    settings[item.key] = item.value === 'true' ? true : item.value === 'false' ? false : item.value;
    updatedAt = Math.max(updatedAt, Date.parse(item.updated_at));
  }

  return normalizeSettings({ ...settings, updatedAt });
}

export async function upsertSettings(settings, deviceId) {
  await createTursoSchema();

  const normalized = normalizeSettings(settings);
  const updatedAt = isoFromMs(normalized.updatedAt);
  const entries = {
    theme: normalized.theme,
    notificationsEnabled: String(normalized.notificationsEnabled),
    soundEnabled: String(normalized.soundEnabled),
  };

  for (const [key, value] of Object.entries(entries)) {
    await execute({
      sql: `INSERT INTO app_settings (
          id, device_id, key, value, created_at, updated_at, deleted_at
        ) VALUES (?, ?, ?, ?, ?, ?, NULL)
        ON CONFLICT(device_id, key) DO UPDATE SET
          value = excluded.value,
          updated_at = excluded.updated_at,
          deleted_at = NULL`,
      args: [`${deviceId}:${key}`, deviceId, key, value, updatedAt, updatedAt],
    });
  }
}

export async function deleteStack(stackId) {
  await createTursoSchema();
  const deletedAt = new Date().toISOString();
  await execute({
    sql: 'UPDATE stacks SET deleted_at = ?, updated_at = ? WHERE id = ?',
    args: [deletedAt, deletedAt, stackId],
  });
  await execute({
    sql: 'UPDATE stack_segments SET deleted_at = ?, updated_at = ? WHERE stack_id = ?',
    args: [deletedAt, deletedAt, stackId],
  });
}

export async function handleSyncStatusRequest(req, res) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'access-control-allow-headers': 'accept, content-type',
      'access-control-allow-methods': 'GET, POST, OPTIONS',
      'access-control-allow-origin': '*',
    });
    res.end();
    return;
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    writeJson(res, 405, { ok: false, error: 'Method not allowed' });
    return;
  }

  try {
    await createTursoSchema();
    writeJson(res, 200, {
      ok: true,
      status: 'connected',
    });
  } catch (error) {
    writeJson(res, 503, {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function handleStacksRequest(req, res) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'access-control-allow-headers': 'accept, content-type',
      'access-control-allow-methods': 'GET, POST, DELETE, OPTIONS',
      'access-control-allow-origin': '*',
    });
    res.end();
    return;
  }

  try {
    if (req.method === 'GET') {
      writeJson(res, 200, {
        ok: true,
        stacks: await fetchStacks(),
        deletedStackIds: await fetchDeletedStackIds(),
      });
      return;
    }

    const body = await readJson(req);

    if (req.method === 'POST') {
      await upsertStacks(Array.isArray(body.stacks) ? body.stacks : [], String(body.deviceId ?? 'web'));
      writeJson(res, 200, {
        ok: true,
        stacks: await fetchStacks(),
        deletedStackIds: await fetchDeletedStackIds(),
      });
      return;
    }

    if (req.method === 'DELETE') {
      if (!body.stackId) {
        writeJson(res, 400, { ok: false, error: 'stackId is required' });
        return;
      }
      await deleteStack(String(body.stackId));
      writeJson(res, 200, {
        ok: true,
        stacks: await fetchStacks(),
        deletedStackIds: await fetchDeletedStackIds(),
      });
      return;
    }

    writeJson(res, 405, { ok: false, error: 'Method not allowed' });
  } catch (error) {
    writeJson(res, 500, {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function handleSettingsRequest(req, res) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'access-control-allow-headers': 'accept, content-type',
      'access-control-allow-methods': 'GET, POST, OPTIONS',
      'access-control-allow-origin': '*',
    });
    res.end();
    return;
  }

  try {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
    const deviceId = url.searchParams.get('deviceId') ?? 'web';

    if (req.method === 'GET') {
      writeJson(res, 200, {
        ok: true,
        settings: await fetchSettings(deviceId),
      });
      return;
    }

    if (req.method === 'POST') {
      const body = await readJson(req);
      const requestDeviceId = String(body.deviceId ?? deviceId);
      await upsertSettings(body.settings ?? {}, requestDeviceId);
      writeJson(res, 200, {
        ok: true,
        settings: await fetchSettings(requestDeviceId),
      });
      return;
    }

    writeJson(res, 405, { ok: false, error: 'Method not allowed' });
  } catch (error) {
    writeJson(res, 500, {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
