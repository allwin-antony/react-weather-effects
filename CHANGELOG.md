# Changelog

All notable changes to `react-weather-effects` are documented here. Earlier releases are described in the git history and GitHub Releases.

## 0.4.0 — 2026-11-27

### Added

- `layer` prop on `Rain`, `Snow`, `Fog`, and `Lightning`, matching the existing `Heat` prop. Lower values draw first. Defaults: `Fog` and `Heat` `0`, `Rain` and `Snow` `100`, `Lightning` `200`.
- Changing `layer` on a mounted effect reorders it without resetting particles, textures, or transitions. Previously, `Heat` ignored `layer` changes after mount.
- `WeatherCanvas` `dpr` accepts a number: the maximum device pixel ratio (default `2`), combined with the quality cap. Nonpositive or non-finite values use the default.
- `DPRCap` type export.

### Deprecated

- String values for `dpr`. `'light'` and `'normal'` map to `2`, and `'heavy'` maps to `1.5`, exactly as before. They log a development warning; replace them with the matching number.
- The `DPRWeight` type. Use `DPRCap` or a number.

### Changed

- Core bundle size: 3.28 kB to 3.42 kB minified and gzipped, under the 5 kB budget.

### Tooling

- CI workflow runs typecheck, tests, build, bundle size checks, and the demo build on pull requests and non-`main` pushes.
- The publish workflow skips `npm publish` when the package version already exists on npm.
- pnpm is pinned through `packageManager` (`pnpm@12.21.0`) for local development and CI.
- Demo playground: Max DPR control and a per-effect Layer control.
