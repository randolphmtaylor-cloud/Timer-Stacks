import http from 'node:http';
import { loadDesktopEnv } from './env.mjs';
import { handleSchemaRequest, writeJson } from './tursoSchema.mjs';

loadDesktopEnv();

const port = Number.parseInt(process.env.SYNC_API_PORT ?? process.env.PORT ?? '1421', 10);
const host = process.env.SYNC_API_HOST ?? '127.0.0.1';

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? `${host}:${port}`}`);

  if (url.pathname === '/api/sync/schema') {
    await handleSchemaRequest(req, res);
    return;
  }

  writeJson(res, 404, {
    ok: false,
    error: 'Not found',
  });
});

server.listen(port, host, () => {
  console.log(`[sync-api] Listening on http://${host}:${port}`);
  console.log(`[sync-api] Schema endpoint ready at http://${host}:${port}/api/sync/schema`);
});

server.on('error', (error) => {
  console.error('[sync-api] Failed to start server:', error);
  process.exitCode = 1;
});
