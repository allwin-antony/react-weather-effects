import { defineConfig } from 'tsup';
import { libraryConfig } from '../../tsup.config.base';

const internalPackages = [/^@react-weather-overlays\/(core|effects)(\/|$)/];

export default defineConfig({
  ...libraryConfig,
  external: ['react', /^react\//],
  noExternal: internalPackages,
  dts: { resolve: internalPackages },
});
