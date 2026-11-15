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
      '@react-weather-overlays/core': path.resolve(__dirname, 'packages/core/src'),
      '@react-weather-overlays/effects': path.resolve(__dirname, 'packages/effects/src'),
      'react-weather-overlays': path.resolve(__dirname, 'packages/react-weather-overlays/src'),
    },
  },
});
