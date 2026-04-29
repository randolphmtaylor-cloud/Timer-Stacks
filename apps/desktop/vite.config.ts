import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
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
});
