import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const serverDir = path.dirname(fileURLToPath(import.meta.url));
export const desktopAppDir = path.resolve(serverDir, '..');
export const desktopEnvPath = path.join(desktopAppDir, '.env.local');

function parseEnvValue(value) {
  const trimmed = value.trim().replace(/^\uFEFF/, '');
  const quote = trimmed[0];

  if ((quote === '"' || quote === "'") && trimmed.endsWith(quote)) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

function parseEnvFile(contents) {
  const parsed = {};

  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const normalized = trimmed.startsWith('export ') ? trimmed.slice(7).trim() : trimmed;
    const separatorIndex = normalized.indexOf('=');
    if (separatorIndex === -1) continue;

    const key = normalized.slice(0, separatorIndex).trim();
    if (!key) continue;

    parsed[key] = parseEnvValue(normalized.slice(separatorIndex + 1));
  }

  return parsed;
}

export function loadDesktopEnv(options = {}) {
  const envPath = options.envPath ?? desktopEnvPath;
  const override = options.override ?? false;

  let loaded = false;
  if (fs.existsSync(envPath)) {
    const parsed = parseEnvFile(fs.readFileSync(envPath, 'utf8'));

    for (const [key, value] of Object.entries(parsed)) {
      if (override || process.env[key] === undefined) {
        process.env[key] = value;
      }
    }

    loaded = true;
  }

  logTursoEnvStatus(envPath, loaded);

  return {
    envPath,
    loaded,
  };
}

export function logTursoEnvStatus(envPath = desktopEnvPath, loaded = fs.existsSync(envPath)) {
  const resolvedPath = path.resolve(envPath);
  const exists = fs.existsSync(resolvedPath);
  const databaseUrl = process.env.TURSO_DATABASE_URL ?? '';

  console.log(`[sync/env] Resolved .env.local path: ${resolvedPath}`);
  console.log(`[sync/env] .env.local exists: ${exists ? 'yes' : 'no'}`);
  console.log(`[sync/env] .env.local loaded: ${loaded ? 'yes' : 'no'}`);
  console.log(`[sync/env] TURSO_DATABASE_URL present: ${process.env.TURSO_DATABASE_URL ? 'yes' : 'no'}`);
  console.log(`[sync/env] TURSO_DATABASE_URL first 15 chars: ${databaseUrl.slice(0, 15)}`);
  console.log(
    `[sync/env] TURSO_DATABASE_URL startsWith("libsql://"): ${databaseUrl.startsWith('libsql://') ? 'yes' : 'no'}`,
  );
  console.log(`[sync/env] TURSO_DATABASE_URL length: ${databaseUrl.length}`);
  console.log(`[sync/env] TURSO_AUTH_TOKEN present: ${process.env.TURSO_AUTH_TOKEN ? 'yes' : 'no'}`);
}
