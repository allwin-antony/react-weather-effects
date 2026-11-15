# react-weather-effects

Composable, high-performance rain, snow, and fog visual effects for React, rendered on a single lightweight 2D canvas.

## Installation

Install `react-weather-effects` using your package manager of choice:

```sh
# npm
npm install react-weather-effects

# pnpm
pnpm add react-weather-effects

# Yarn
yarn add react-weather-effects
```

> **Beta Prerelease:** To install the current beta version:
> ```sh
> npm install react-weather-effects@beta
> # or pin specifically:
> npm install react-weather-effects@0.1.0-beta.0
> ```

### Requirements

- **React 18** or later (React 18 and 19 supported as peer dependencies).
- A modern browser with 2D `<canvas>` support. Contained sizing uses `ResizeObserver`.
- Full TypeScript declarations, ESM (`.mjs`), and CommonJS (`.cjs`) entry points included.

---

## Quick Start

Wrap any effect component inside `<WeatherCanvas>`:

```tsx
import { WeatherCanvas, Rain } from 'react-weather-effects';

export default function App() {
  return (
    <main style={{ minHeight: '100vh', background: '#0f172a', color: '#fff' }}>
      <h1>My Weather App</h1>

      <WeatherCanvas>
        <Rain intensity={0.6} />
      </WeatherCanvas>
    </main>
  );
}
```

By default, `<WeatherCanvas>` runs in `mode="fullscreen"`, covering the viewport with a transparent background. It ignores pointer events (`pointer-events: none`), so all underlying interactive elements remain clickable.

---

## Features

- **Single Canvas Engine:** One 2D `<canvas>` manages all effects, batching rendering at 60 FPS without DOM bloat.
- **Composable:** Combine multiple effects (`Rain`, `Snow`, `Fog`) inside a single canvas.
- **Configurable:** Adjust intensity, speed, wind angle, colors, and custom snowflake sprite artwork.
- **Motion-Aware & Accessible:** Automatically respects `prefers-reduced-motion` and pauses when hidden or offscreen.
- **Contained & Fullscreen:** Place inside specific cards/heroes (`mode="contained"`) or cover the whole screen.
- **SSR & Next.js Safe:** Safe for React Server Components (RSC) and Next.js App Router (runs cleanly with `'use client'`).

---

## Contents

- [Usage examples](#usage-examples)
- [API reference](#api-reference)
- [Quality and performance](#quality-and-performance)
- [Motion, accessibility, and lifecycle](#motion-accessibility-and-lifecycle)
- [Server rendering and Next.js](#server-rendering-and-nextjs)
- [Troubleshooting](#troubleshooting)
- [Local development](#local-development)
- [License](#license)

## Usage examples

### Keep an effect inside a container

Use `mode="contained"` and give the parent a positioning context and a nonzero height. Add `overflow: 'hidden'` when the effect should be clipped to the container's edges.

```tsx
import { WeatherCanvas, Snow } from 'react-weather-effects';

export function SnowCard() {
  return (
    <section
      style={{
        position: 'relative',
        height: 320,
        overflow: 'hidden',
        borderRadius: 12,
        background: '#0f172a',
      }}
    >
      <WeatherCanvas mode="contained" wind={{ x: -0.15, y: 0 }}>
        <Snow intensity={0.5} speed={0.8} />
      </WeatherCanvas>

      <div style={{ position: 'relative', zIndex: 2, padding: 24, color: '#fff' }}>
        <h2>Winter forecast</h2>
        <p>Snow remains behind this content.</p>
      </div>
    </section>
  );
}
```

Size and style the parent rather than passing `width`, `height`, or `style` to `WeatherCanvas`; those are not part of its public API.

### Combine effects

```tsx
import { WeatherCanvas, Rain, Fog } from 'react-weather-effects';

export function RainyScene() {
  return (
    <WeatherCanvas quality="medium" wind={{ x: 0.3, y: 0 }}>
      <Fog density={0.25} layers={2} />
      <Rain intensity={0.75} angle={12} speed={1.1} />
    </WeatherCanvas>
  );
}
```

Fog draws behind rain and snow. Rain and snow share a drawing priority; instances at that priority draw in registration order. Each effect has its own settings and can be mounted or removed independently.

### Use custom snow artwork

Add a static image to your application's public assets, for example `public/snowflakes/crystal.svg`, and pass its served URL:

```tsx
import { WeatherCanvas, Snow } from 'react-weather-effects';

export function CustomSnow() {
  return (
    <WeatherCanvas wind={{ x: 0.15, y: 0 }}>
      <Snow
        sprite="/snowflakes/crystal.svg"
        intensity={0.5}
        minSize={8}
        maxSize={24}
        speed={0.8}
        wobble
      />
    </WeatherCanvas>
  );
}
```

Pass a **URL string**, not an SVG React component or raw SVG markup. PNG, SVG, and other browser-supported image formats can be used. Demo artwork is not bundled into the installed library.

#### Sprite sizing and caching

- `minSize` and `maxSize` are **radii in CSS pixels**, not image widths. A sprite with radius `24` has a longest side of `48` CSS pixels; its original aspect ratio is preserved.
- Sprites keep their original colors and transparency. The `color` prop applies only to built-in flakes and the loading/error fallback.
- Each mounted `Snow` instance loads its sprite once, unless the `sprite` URL changes. Built-in flakes appear while loading and remain if loading or rasterization fails.
- The package rasterizes artwork into a reusable texture, so SVG paths and filters are not rendered separately for every particle on every frame.
- Texture resolution accounts for flake size and device pixel ratio. It grows in size buckets when needed and is capped at `1024` pixels per side. Very large flakes can therefore look softer.
- The maximum RGBA pixel storage for one cached texture is approximately **4 MiB**, excluding the source image and browser overhead. This is not a limit on download size or decoded source-image memory.
- Animated images are used as **static snapshots**. Sprite animation is not supported; particle movement and gentle rotation still work.

For remote images, the image server must allow anonymous cross-origin requests with an appropriate `Access-Control-Allow-Origin` header. Serving artwork from your own application is the simplest option.

`wobble={false}` disables the animated sway and gentle sprite rotation. Wind can still move the flakes. There is no separate `rotation` prop in the current API.

### Pause and resume a scene

```tsx
import { useState } from 'react';
import { WeatherCanvas, Snow } from 'react-weather-effects';

export function PausableSnow() {
  const [paused, setPaused] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setPaused((value) => !value)}>
        {paused ? 'Resume weather' : 'Pause weather'}
      </button>

      <WeatherCanvas paused={paused}>
        <Snow intensity={0.5} />
      </WeatherCanvas>
    </>
  );
}
```

Changing effect props updates the current scene without remounting its particle pool. Increasing intensity or quality initializes additional particles as needed; lowering them reduces the active count.

## API reference

All props are optional. `intensity` and `density` are fractions from `0` to `1`, not percentages from `0` to `100`; values outside that interval are clamped.

### `WeatherCanvas`

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `children` | `ReactNode` | None | Effect components that share this canvas. |
| `mode` | `'fullscreen' \| 'contained'` | `'fullscreen'` | Cover the viewport or fill the positioned parent. |
| `wind` | `{ x: number; y: number }` | `{ x: 0, y: 0 }` | Relative wind input. Positive `x` points right; positive `y` points down. |
| `quality` | `'low' \| 'medium' \| 'high'` | `'medium'` | Particle budget and maximum device pixel ratio. |
| `dpr` | `'light' \| 'normal' \| 'heavy'` | `'normal'` | Additional device pixel ratio cap; see [quality and performance](#quality-and-performance). |
| `reducedMotion` | `'auto' \| 'animated' \| 'static' \| 'off'` | `'auto'` | How to handle motion and system preferences. |
| `paused` | `boolean` | `false` | Freeze simulation while keeping the scene visible. |
| `seed` | `string \| number` | Per-instance seed | Seed for reproducible random initialization. |
| `zIndex` | `number` | `1` | CSS stacking order of the overlay within its ancestor stacking context. |
| `onContextLost` | `() => void` | None | Called when the 2D context cannot be acquired or is lost. |

Wind is an effect-specific input, not a velocity in pixels per second. Rain and snow use both components; fog currently uses horizontal wind only.

### `Rain`

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `intensity` | `number` | `0.7` | Fraction of this instance's particle budget to draw. `0` draws no rain. |
| `angle` | `number` | `10` | Degrees from vertical. Positive values lean right; negative values lean left. |
| `speed` | `number` | `1` | Multiplier for intrinsic falling speed. |
| `color` | `string` | `'rgba(190, 215, 245, 0.8)'` | CSS color for rain trails. |

### `Snow`

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `intensity` | `number` | `0.5` | Fraction of this instance's particle budget to draw. `0` draws no snow. |
| `speed` | `number` | `1` | Multiplier for intrinsic falling speed and wobble progression. |
| `color` | `string` | `'rgba(255, 255, 255, 0.85)'` | CSS color for built-in flakes and the sprite fallback. Does not tint artwork. |
| `sprite` | `string` | None | Static image URL. Omitting it uses soft, built-in snowflakes. |
| `minSize` | `number` | `1.5`, or `6` with a sprite | Minimum flake radius in CSS pixels. |
| `maxSize` | `number` | `4`, or `18` with a sprite | Maximum flake radius in CSS pixels. |
| `wobble` | `boolean` | `true` | Enable animated sway and gentle sprite rotation. |

Use nonnegative sizes, with `minSize <= maxSize`. Built-in flakes have a feathered glow that extends beyond their nominal radius.

### `Fog`

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `density` | `number` | `0.4` | Opacity multiplier. `0` draws no fog. |
| `speed` | `number` | `1` | Multiplier for intrinsic drift and shape movement. |
| `color` | `string` | `'rgba(220, 225, 235, 0.35)'` | CSS color used to tint the cached fog texture. |
| `layers` | `number` | `3` | Layer count, rounded and clamped between `1` and `6`. |

Use nonnegative speed multipliers for the usual falling and drifting behavior. Setting `speed={0}` does not necessarily stop wind-driven movement; use `WeatherCanvas paused` to freeze the entire scene.

### TypeScript exports

The public entry point exports these types in addition to the components:

- `WeatherCanvasProps`, `RainProps`, `SnowProps`, `FogProps`
- `Quality`, `DPRWeight`, `RenderBudget`
- `ReducedMotionProp`, `MotionMode`

`MotionMode` describes the resolved state (`'animated'`, `'static'`, or `'off'`). The `reducedMotion` prop also accepts `'auto'` through `ReducedMotionProp`.

## Quality and performance

Each `WeatherCanvas` owns its rendering budget:

| Quality | Maximum particles per rain or snow instance | DPR cap |
| --- | ---: | ---: |
| `'low'` | 150 | 1 |
| `'medium'` | 300 | 2 |
| `'high'` | 600 | 2 |

The particle cap is **per effect instance**, not a whole-scene limit. For example, medium quality with `Snow intensity={0.5}` draws 150 flakes. A second identical `Snow` instance can draw another 150. Fog uses a bounded layer count and cached textures instead of this particle count.

The `dpr` prop applies another resolution cap:

| DPR setting | Additional cap |
| --- | ---: |
| `'light'` | 2 |
| `'normal'` | 2 |
| `'heavy'` | 1.5 |

The effective ratio is the minimum of the device DPR, the quality cap, and the additional DPR cap. `light` and `normal` currently have the same cap. Size props remain in CSS pixels regardless of DPR.

For lower rendering cost:

1. Start with `quality="medium"`; use `'low'` on constrained devices or large canvases.
2. Reduce intensity, fog density, or fog layers before adding more effect instances.
3. Prefer contained scenes when the effect only needs to cover a small part of the page.
4. Keep sprite files reasonably sized. Caching reduces repeated rendering, but downloading, decoding, and the first rasterization still take work.
5. Measure the complete scene on target browsers and devices. Large translucent areas and overlapping effects can dominate rendering cost.

There is no fixed FPS guarantee or automatic quality downgrade. The engine reuses particle pools and textures, but hardware, canvas area, DPR, and composition still matter.

The repository's size check enforces a **5 kB minified-and-gzipped core-only budget**, excluding React. Rain and combined Rain/Snow/Fog sizes are reported separately; the core budget is not a size claim for all effects together.

## Motion, accessibility, and lifecycle

The default `reducedMotion="auto"` follows the user's `prefers-reduced-motion` setting:

| Setting | Behavior |
| --- | --- |
| `'auto'` | Animate when the system allows motion; otherwise draw a static scene. The unknown initial preference is treated as static. |
| `'animated'` | Animate regardless of the system preference. Use only when an explicit application choice is appropriate. |
| `'static'` | Draw a seeded scene without advancing simulation. |
| `'off'` | Clear the canvas and suppress effect drawing. |

`paused={true}` freezes the existing simulation rather than hiding the canvas. Static and paused scenes can still redraw after prop changes, resizing, or sprite loading, without advancing particle motion.

Each active canvas uses one shared animation loop. Scheduling stops when the page is hidden, the canvas is outside the viewport, its size is zero, it is paused, motion is disabled/static, or no effects are mounted. Resuming continues from the retained scene state rather than starting over.

The canvas is marked `aria-hidden="true"` and does not receive pointer events. Treat the effects as decorative: provide readable text or other accessible content when weather information itself matters.

### Seeds and scene resets

A fixed `seed` makes random initialization reproducible, but does not fix frame timing or guarantee identical screenshots across different rendering environments. Repeatable captures also need matching props, viewport, DPR, and simulation steps.

Changing `seed` resets the random generator but does not rebuild already initialized particles. To intentionally reset the whole scene, change the canvas's React `key` as well as its `seed`.

## Server rendering and Next.js

Importing and initially rendering the public components is SSR-safe. Canvas drawing and browser-dependent setup happen after the component mounts on the client.

In Next.js App Router or another React Server Components framework, put the weather scene behind a client-component boundary:

```tsx
'use client';

import { WeatherCanvas, Snow } from 'react-weather-effects';

export default function WeatherOverlay() {
  return (
    <WeatherCanvas>
      <Snow intensity={0.4} />
    </WeatherCanvas>
  );
}
```

You can then render `WeatherOverlay` from your layout or page. No animation runs on the server, and a sprite may initially show the built-in fallback until its image loads.

## Troubleshooting

| Symptom | What to check |
| --- | --- |
| An effect throws “must be used inside WeatherCanvas.” | Render it as a descendant of `WeatherCanvas`, not as a standalone sibling. |
| Nothing appears in contained mode. | Give the parent a nonzero height and `position: relative`. Check that it is visible and that `ResizeObserver` is available. |
| The scene is visible but does not animate. | Check `paused`, `reducedMotion`, system motion preferences, tab visibility, and whether the canvas is in the viewport. |
| Custom artwork is replaced by soft snowflakes. | Check the image URL, network response, and CORS headers. A loading or failed sprite uses the built-in fallback. |
| `color` does not change a custom sprite. | Artwork intentionally retains its original colors. Edit the source image to recolor it. |
| The overlay appears behind another element. | Check `zIndex` and ancestor stacking contexts. A higher value cannot escape its parent's stacking context. |
| Rendering is slow. | Lower quality and intensity, reduce fog layers, limit the covered area, and profile all active effects together. |

If the browser cannot provide a 2D rendering context, the engine stops drawing and scheduling. Use `onContextLost` if your application needs to respond to that condition.

## Local development

This section is for contributors working from a source checkout. It is not required when using the installed npm package. Use a maintained Node.js LTS release and pnpm.

From the repository root, install dependencies, build the library, and start the demo:

```sh
pnpm install
pnpm build
pnpm demo
```

The demo runs at `http://localhost:5173` by default. Vite may select another port if that one is occupied; use the address printed in the terminal.

The repository is a pnpm workspace:

```text
packages/
  core/                    Internal canvas engine, scheduler, budgets, and pools
  effects/                 Internal Rain, Snow, and Fog implementations
  react-weather-effects/   Public entry point and distributable bundle
apps/
  demo/                    Vite demonstration application
test/                      Vitest rendering and lifecycle tests
```

The public package bundles the private workspaces. Consumers should not need to install or resolve those private package names.

Run these commands from the repository root:

| Command | Purpose |
| --- | --- |
| `pnpm install` | Install workspace dependencies. |
| `pnpm build` | Build core, effects, and the public package in dependency order. |
| `pnpm demo` | Start the local Vite demo. Build the packages first. |
| `pnpm test` | Run the test suite once. |
| `pnpm test:watch` | Run tests in watch mode. |
| `pnpm typecheck` | Check TypeScript project references; writes generated files into `dist`. |
| `pnpm size` | Measure bundle sizes after a package build. |
| `pnpm --filter weather-effects-demo build` | Build the demo for production. |

Run `pnpm typecheck` and `pnpm build` sequentially, not at the same time: both write to the package `dist` directories. Run `pnpm build` after typechecking and before packing a release so the distributable declarations are bundled correctly.

The demo consumes built workspace packages. After changing library source, rebuild the packages and reload the demo; restart its server if it retains cached output.

### Test a local package build

After running `pnpm build`, create a tarball of the public package:

```sh
pnpm --dir packages/react-weather-effects pack --pack-destination ../..
```

Install the generated tarball in a separate application using its actual path. For the current beta version:

```sh
npm install /path/to/react-weather-effects-0.1.0-beta.0.tgz
```

For implementation contracts, package boundaries, and future plans, see `ARCHITECTURE.md` in the source repository. Keep changes focused, cover rendering and lifecycle behavior with tests, and verify the build, types, and size budget before submitting changes.

## License

Licensed under the MIT license.
