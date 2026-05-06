import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { logTursoEnvStatus } from './server/env.mjs';
import { handleSchemaRequest } from './server/tursoSchema.mjs';

export default defineConfig(({ mode }) => {
  const serverEnv = loadEnv(mode, __dirname, '');

  for (const [key, value] of Object.entries(serverEnv)) {
    process.env[key] ??= value;
  }

  logTursoEnvStatus(path.resolve(__dirname, '.env.local'));

  return {
    plugins: [
      react(),
      {
        name: 'timer-stacks-sync-schema-api',
        configureServer(server) {
          server.middlewares.use('/api/sync/schema', async (req, res) => {
            await handleSchemaRequest(req, res);
          });
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    // Tauri expects a fixed port in dev
    server: {
      port: 1420,
      strictPort: true,
    },
    build: {
      target: 'es2022',
    },
    // Allow importing from workspace packages
    optimizeDeps: {
      include: ['@timer-stacks/core', '@timer-stacks/storage'],
    },
  };
});
