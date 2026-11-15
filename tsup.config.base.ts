import type { Options } from 'tsup';

export const libraryConfig: Options = {
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  splitting: false,
  sourcemap: true,
  treeshake: true,
  clean: true,
  target: 'es2020',
  platform: 'browser',
  external: ['react', /^react\//, /^@react-weather-effects\//],
  outExtension: ({ format }) => ({
    js: format === 'esm' ? '.mjs' : '.cjs',
    dts: format === 'esm' ? '.d.mts' : '.d.cts',
  }),
};
