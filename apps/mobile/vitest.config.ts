import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // Only run files that live under src/ — excludes Expo/RN files that
    // reference DOM or native modules vitest cannot resolve.
    include: ['src/**/__tests__/**/*.test.ts'],
  },
});
