import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test/setup.ts'],
  },
  resolve: {
    alias: {
      '@react-weather-effects/core': path.resolve(__dirname, 'packages/core/src'),
      '@react-weather-effects/effects': path.resolve(__dirname, 'packages/effects/src'),
      'react-weather-effects': path.resolve(__dirname, 'packages/react-weather-effects/src'),
    },
  },
});
