const REQUIRED_ENV = ['TURSO_DATABASE_URL', 'TURSO_AUTH_TOKEN'];

export const schemaTables = ['stacks', 'stack_segments', 'app_settings'];

const timestampDefault = "(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))";

const schemaStatements = [
  'PRAGMA foreign_keys = ON',
  `CREATE TABLE IF NOT EXISTS stacks (
    id TEXT PRIMARY KEY,
    device_id TEXT NOT NULL,
    name TEXT NOT NULL DEFAULT '',
    description TEXT,
    total_duration_seconds INTEGER NOT NULL DEFAULT 0 CHECK (total_duration_seconds >= 0),
    is_template INTEGER NOT NULL DEFAULT 0 CHECK (is_template IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT ${timestampDefault},
    updated_at TEXT NOT NULL DEFAULT ${timestampDefault},
    deleted_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS stack_segments (
    id TEXT PRIMARY KEY,
    device_id TEXT NOT NULL,
    stack_id TEXT NOT NULL,
    name TEXT NOT NULL,
    duration_seconds INTEGER NOT NULL CHECK (duration_seconds > 0),
    position INTEGER NOT NULL CHECK (position >= 0),
    created_at TEXT NOT NULL DEFAULT ${timestampDefault},
    updated_at TEXT NOT NULL DEFAULT ${timestampDefault},
    deleted_at TEXT,
    FOREIGN KEY (stack_id) REFERENCES stacks(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS app_settings (
    id TEXT PRIMARY KEY,
    device_id TEXT NOT NULL,
    key TEXT NOT NULL,
    value TEXT,
    created_at TEXT NOT NULL DEFAULT ${timestampDefault},
    updated_at TEXT NOT NULL DEFAULT ${timestampDefault},
    deleted_at TEXT,
    UNIQUE (device_id, key)
  )`,
  'CREATE INDEX IF NOT EXISTS stacks_device_updated_idx ON stacks (device_id, updated_at)',
  'CREATE INDEX IF NOT EXISTS stack_segments_stack_position_idx ON stack_segments (stack_id, position)',
  'CREATE INDEX IF NOT EXISTS stack_segments_device_updated_idx ON stack_segments (device_id, updated_at)',
  'CREATE INDEX IF NOT EXISTS app_settings_device_updated_idx ON app_settings (device_id, updated_at)',
];

function normalizeTursoUrl(databaseUrl) {
  console.log(`[sync/schema] TURSO_DATABASE_URL first 15 chars: ${databaseUrl.slice(0, 15)}`);
  console.log(
    `[sync/schema] TURSO_DATABASE_URL startsWith("libsql://"): ${databaseUrl.startsWith('libsql://') ? 'yes' : 'no'}`,
  );
  console.log(`[sync/schema] TURSO_DATABASE_URL length: ${databaseUrl.length}`);

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

function getConfig(env) {
  const missing = REQUIRED_ENV.filter((key) => !env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variable(s): ${missing.join(', ')}`);
  }

  return {
    pipelineUrl: normalizeTursoUrl(env.TURSO_DATABASE_URL),
    authToken: env.TURSO_AUTH_TOKEN,
  };
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

async function executeStatement({ pipelineUrl, authToken, sql, fetchImpl }) {
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
          stmt: { sql },
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

  const error = getTursoError(payload?.results?.[0], 'Turso did not return an execution result');
  if (error) {
    throw new Error(`Turso statement failed: ${error}`);
  }
}

export async function createTursoSchema(options = {}) {
  const env = options.env ?? process.env;
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;

  if (typeof fetchImpl !== 'function') {
    throw new Error('A Fetch API implementation is required to connect to Turso');
  }

  const config = getConfig(env);

  for (const sql of schemaStatements) {
    await executeStatement({ ...config, sql, fetchImpl });
  }

  return {
    ok: true,
    status: 'connected',
    tables: schemaTables,
  };
}

export async function handleSchemaRequest(req, res) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'access-control-allow-methods': 'GET, POST, OPTIONS',
      'access-control-allow-origin': '*',
    });
    res.end();
    return;
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    writeJson(res, 405, {
      ok: false,
      error: 'Method not allowed',
    });
    return;
  }

  try {
    await createTursoSchema();
    writeJson(res, 200, {
      ok: true,
      status: 'connected',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[sync/schema] Turso schema setup failed:', message);
    writeJson(res, 500, {
      ok: false,
      error: message,
    });
  }
}

export function writeJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'access-control-allow-origin': '*',
    'content-type': 'application/json; charset=utf-8',
  });
  res.end(JSON.stringify(payload));
}
