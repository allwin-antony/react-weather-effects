# react-weather-effects

Composable, high-performance rain, snow, fog, lightning, and desert heat visual effects for React, with shared wind controls and typed scene presets, rendered on a single lightweight 2D canvas.

[![npm version](https://img.shields.io/npm/v/react-weather-effects.svg)](https://www.npmjs.com/package/react-weather-effects)
[![Live Demo](https://img.shields.io/badge/Demo-Live%20Playground-0070f3?logo=vercel)](https://react-weather-effects-smoky.vercel.app/)
[![GitHub](https://img.shields.io/badge/GitHub-Repository-181717?logo=github)](https://github.com/allwin-antony/react-weather-effects)
[![Sponsor](https://img.shields.io/badge/Sponsor-GitHub-ea4aaa?logo=githubsponsors)](https://github.com/sponsors/allwin-antony)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

- **Live Demo:** [https://react-weather-effects-smoky.vercel.app/](https://react-weather-effects-smoky.vercel.app/)
- **GitHub:** [https://github.com/allwin-antony/react-weather-effects](https://github.com/allwin-antony/react-weather-effects)
- **npm:** [https://www.npmjs.com/package/react-weather-effects](https://www.npmjs.com/package/react-weather-effects)
- **Sponsor:** [https://github.com/sponsors/allwin-antony](https://github.com/sponsors/allwin-antony)

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

> **v0.2.0:** To pin this release:
> ```sh
> npm install react-weather-effects@0.2.0
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

- **Single Canvas Engine:** One 2D `<canvas>` manages all effects through a shared animation loop without DOM bloat.
- **Composable:** Combine multiple effects (`Rain`, `Snow`, `Fog`, `Lightning`, `Heat`) inside a single canvas.
- **Desert Heat & Mirage:** Subtle ground-level haze, with hot-air refraction and a faint horizon mirage when supplied a background image.
- **Rain Controls:** Adjust intensity, speed, angle, drop length/thickness, and colors, with optional bottom-edge splashes.
- **Snow Artwork:** Use built-in flakes or cached custom sprites, with size, wobble, rotation, and spinning-speed controls.
- **Layered Fog:** Configure density, drift speed, color, and up to six layers of cached atmospheric textures.
- **Procedural Lightning:** Seeded, branching bolts with frequency, color, and brightness controls; full-canvas flashes are opt-in and rate-limited.
- **Shared Wind:** Drive rain and snow horizontally and vertically, and fog horizontally, through `WeatherCanvas.wind`.
- **Scene Presets:** Start with `drizzle`, `rainstorm`, `snowfall`, `blizzard`, `mist`, or `thunderstorm`, or customize their typed configuration objects.
- **Smooth Scene Changes:** Opt into particle-preserving intensity and density fades with `transitionDuration`.
- **Seeded Scenes:** Reproduce random initialization with a canvas seed or an independent lightning seed.
- **Quality & DPR Controls:** Choose particle and resolution budgets; the core-only bundle stays below 5 kB gzipped, excluding React.
- **Motion-Aware & Accessible:** Automatically respects `prefers-reduced-motion` and pauses when hidden or offscreen.
- **Pause & Resume:** Freeze a scene without hiding it or resetting its particles.
- **Contained & Fullscreen:** Place inside specific cards/heroes (`mode="contained"`) or cover the whole screen.
- **SSR & Next.js Safe:** SSR-safe imports and server rendering; use a `'use client'` boundary in Next.js App Router.
- **TypeScript & Tree-Shaking:** Typed props and presets, tree-shakeable ESM, and CommonJS builds included.

Wind is a shared input for the existing effects, not a standalone component. `Wind` and `Clouds` remain roadmap items and are not exported in v0.2.0.

---

## Contents

- [Usage examples](#usage-examples)
- [Scene presets](#scene-presets)
- [API reference](#api-reference)
- [Quality and performance](#quality-and-performance)
- [Motion, accessibility, and lifecycle](#motion-accessibility-and-lifecycle)
- [Server rendering and Next.js](#server-rendering-and-nextjs)
- [Troubleshooting](#troubleshooting)
- [Local development](#local-development)
- [Sponsoring](#sponsoring)
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
import { WeatherCanvas, Rain, Fog, Lightning } from 'react-weather-effects';

export function RainyScene() {
  return (
    <WeatherCanvas quality="medium" wind={{ x: 0.3, y: 0 }}>
      <Fog density={0.25} layers={2} />
      <Rain intensity={0.75} angle={12} speed={1.1} />
      <Lightning frequency="occasional" />
    </WeatherCanvas>
  );
}
```

Fog draws behind rain and snow; lightning draws in the foreground. Rain and snow share a drawing priority; instances at that priority draw in registration order. Each effect has its own settings and can be mounted or removed independently.

### Transition between scenes

Set `transitionDuration` on each effect to fade intensity or density changes over that many milliseconds. Keep the canvas and effects mounted, and use `0` to hide an effect instead of conditionally removing it:

```tsx
import { WeatherCanvas, Rain, Snow, Fog } from 'react-weather-effects';

export function TransitioningScene({ scene }: { scene: 'rain' | 'snow' | 'clear' }) {
  return (
    <WeatherCanvas>
      <Fog density={scene === 'rain' ? 0.3 : 0} transitionDuration={800} />
      <Rain intensity={scene === 'rain' ? 0.8 : 0} transitionDuration={800} />
      <Snow intensity={scene === 'snow' ? 0.6 : 0} transitionDuration={800} />
    </WeatherCanvas>
  );
}
```

- The default is `0`, preserving instant updates. Initial mounting and unmounting are also immediate.
- Rain and snow fade added or removed particles without resetting the pool. Retained particles stay visible and continue moving; fog keeps its existing wisps and texture.
- Changing the target mid-fade continues from the current visibility. Negative or non-finite durations are treated as `0`.
- Fades use the shared simulation clock, so hidden/offscreen time does not advance them. Static and paused presentations apply the latest settings immediately without animating.
- Only rain/snow `intensity` and fog `density` are transitioned. Other props, including rain's existing velocity smoothing, retain their current behavior.

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

`wobble={false}` disables animated sideways sway and fall flutter. You can control sprite rotation separately with `rotation` (set `false` to let custom sprites drift upright without rotating, or `true` with `wobble={false}` to rotate without swaying) and adjust the spinning rate with `rotationSpeed` (multiplier, default `1`; set `0` to freeze rotation).

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

## Scene presets

Ready-to-use, typed weather configurations representing common meteorological conditions:

- `drizzle`: Gentle, fine precipitation with a soft breeze.
- `rainstorm`: Heavy rain with wind, ground splashes, and thin mist.
- `snowfall`: Calm winter snow with natural flake drift and wobble.
- `blizzard`: Intense winter snowstorm with dense multilayer fog and gale winds.
- `mist`: Atmospheric fog with faint, near-vertical droplets.
- `thunderstorm`: Torrential rain, atmospheric mist, and frequent lightning strikes.
- `heatwave`: Ground-level heat haze, hot-air shimmer, and a feathered horizon mirage. Supply a background image for refraction.

Each preset is available as a named export (for example, `import { thunderstorm, heatwave } from 'react-weather-effects'`) and in the `presets` dictionary. Presets are plain typed configuration objects (`ScenePreset` / `WeatherScene`) with optional `wind`, `rain`, `snow`, `fog`, `lightning`, and `heat` fields matching the corresponding component props. They do not mount effects automatically.

Use them directly or transition smoothly between them:

```tsx
import {
  WeatherCanvas,
  Rain,
  Snow,
  Fog,
  Lightning,
  presets,
  type PresetName,
} from 'react-weather-effects';

export function DynamicWeather({ sceneName }: { sceneName: PresetName }) {
  const scene = presets[sceneName];

  return (
    <WeatherCanvas wind={scene.wind}>
      <Rain intensity={0} transitionDuration={800} {...scene.rain} />
      <Snow intensity={0} transitionDuration={800} {...scene.snow} />
      <Fog density={0} transitionDuration={800} {...scene.fog} />
      {scene.lightning && <Lightning {...scene.lightning} />}
    </WeatherCanvas>
  );
}
```

Rain, snow, and fog remain mounted at zero intensity/density when absent from a preset, allowing their fades to complete. Lightning mounts and unmounts immediately; it does not support `transitionDuration`. All bundled presets leave full-canvas flashes disabled.

To customize a preset, spread its prop objects and then override individual settings, such as `<Rain {...thunderstorm.rain} intensity={0.7} />`. Presets and the dictionary are shallow-frozen; avoid mutating their shared nested objects.

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

#### Wind behavior

Wind values are relative inputs, not velocities in pixels per second or fractions limited to `0..1`. Negative `x` points left and negative `y` points up.

- **Rain:** Both components influence drop velocity alongside `angle` and `speed`; velocity changes are smoothed.
- **Snow:** Both components influence flake drift alongside intrinsic falling, wobble, and gentle gusts.
- **Fog:** Only horizontal `x` affects drift; `y` is ignored.
- **Lightning:** Wind does not affect bolts or strike timing.

Changing `wind` updates mounted effects without resetting their particle pools.

### `Rain`

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `intensity` | `number` | `0.7` | Fraction of this instance's particle budget to draw. `0` draws no rain. |
| `transitionDuration` | `number` | `0` | Intensity fade duration in milliseconds. Keep mounted and set intensity to `0` to fade out. |
| `angle` | `number` | `10` | Degrees from vertical. Positive values lean right; negative values lean left. |
| `speed` | `number` | `1` | Multiplier for intrinsic falling speed. |
| `dropLength` | `number` | `1` | Multiplier for raindrop streak length (< 1 for fine drizzle, > 1 for heavy downpour). Alias: `length`. |
| `dropThickness` | `number` | `1` | Multiplier for raindrop stroke thickness (< 1 for fine mist, > 1 for heavy rain). Alias: `thickness`. |
| `splashes` | `boolean` | `false` | Enable animated bottom-edge splashes for contained cards or heroes. Alias: `splash`. |
| `color` | `string` | `'rgba(190, 215, 245, 0.8)'` | CSS color for rain trails and splashes. |

With `splashes`, visible drops produce small, varied droplets that rise and fall over a softly expanding ground ripple. Splash size follows `dropThickness`; existing impacts finish their short animation when rain stops. Under heavy rain, excess impacts are skipped instead of restarting active splashes. Splashes stay at the current canvas bottom edge after resizing, and paused/static redraws preserve their state. Use contained mode for a defined ground edge; splashes do not detect other DOM surfaces.

### `Snow`

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `intensity` | `number` | `0.5` | Fraction of this instance's particle budget to draw. `0` draws no snow. |
| `transitionDuration` | `number` | `0` | Intensity fade duration in milliseconds. Keep mounted and set intensity to `0` to fade out. |
| `speed` | `number` | `1` | Multiplier for intrinsic falling speed and wobble progression. |
| `color` | `string` | `'rgba(255, 255, 255, 0.85)'` | CSS color for built-in flakes and the sprite fallback. Does not tint artwork. |
| `sprite` | `string` | None | Static image URL. Omitting it uses soft, built-in snowflakes. |
| `minSize` | `number` | `1.5`, or `6` with a sprite | Minimum flake radius in CSS pixels. |
| `maxSize` | `number` | `4`, or `18` with a sprite | Maximum flake radius in CSS pixels. |
| `wobble` | `boolean` | `true` | Enable animated sideways sway and fall flutter. |
| `rotation` | `boolean` | Value of `wobble` | Enable sprite rotation/spinning. Set `false` to drift without rotating. |
| `rotationSpeed` | `number` | `1` | Multiplier for sprite rotation/spinning speed. Defaults to `1`. Set to `0` to freeze angle. |

Use nonnegative sizes, with `minSize <= maxSize`. Built-in flakes have a feathered glow that extends beyond their nominal radius.

> **Tip — Preloading Custom Sprites:**
> While a custom sprite image is downloading over the network, `<Snow>` renders built-in circular flakes as a fallback. To eliminate any initial visual pop and render your custom sprite immediately on frame 0, preload your sprite in your HTML `<head>`:
> ```html
> <link rel="preload" as="image" href="/path/to/snowflake.png" />
> ```
> For optimal performance, keep custom flake images lightweight (SVG or compressed PNG/WebP under 50 KB).

### `Fog`

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `density` | `number` | `0.4` | Opacity multiplier. `0` draws no fog. |
| `transitionDuration` | `number` | `0` | Density fade duration in milliseconds. Keep mounted and set density to `0` to fade out. |
| `speed` | `number` | `1` | Multiplier for intrinsic drift and shape movement. |
| `color` | `string` | `'rgba(220, 225, 235, 0.35)'` | CSS color used to tint the cached fog texture. |
| `layers` | `number` | `3` | Layer count, rounded and clamped between `1` and `6`. |

Use nonnegative speed multipliers for the usual falling and drifting behavior. Setting `speed={0}` does not necessarily stop wind-driven movement; use `WeatherCanvas paused` to freeze the entire scene.

### `Lightning`

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `frequency` | `'rare' \| 'occasional' \| 'frequent' \| number` | `'occasional'` | Preset or numeric strike frequency. Nonpositive or non-finite numbers disable strikes. |
| `color` | `string` | `'rgba(230, 240, 255, 0.95)'` | CSS color for the procedural bolt's glow and core. |
| `brightness` | `number` | `1` | Bolt and flash brightness multiplier. Negative or non-finite values become `0`. |
| `flash` | `boolean` | `false` | Explicit opt-in for full-canvas illumination. Alias: `screenFlash`. |
| `flashIntensity` | `number` | `0.3` | Illumination intensity, clamped to `0..1`. Non-finite values become `0`; rendered opacity is capped at `0.6`. |
| `seed` | `string \| number` | Canvas PRNG | Optional effect-local seed for geometry and timing, independent of other effects' random consumption. |
| `reducedMotion` | `'auto' \| boolean` | `'auto'` | Suppress flashes when `true`, or follow the system preference with `'auto'`. `false` overrides the system preference, but never enables flashes in a static or paused canvas. |

The first draw seeds a bolt immediately. Presets use approximately `12s`, `6s`, and `3s` waits between bolts, with seeded ±20% jitter and a `2s` minimum wait. Positive numeric values up to `1` map from slow to fast; values above `1` specify an approximate strikes-per-minute rate, subject to the minimum wait and bolt duration. Visual prop changes do not reset the random sequence.

### `Heat`

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `intensity` | `number` | `0.5` | Overall intensity (`0..1`), scaling refraction amplitude and haze opacity. |
| `speed` | `number` | `1` | Nonnegative animation speed multiplier; `0` freezes the air turbulence. |
| `color` | `string` | `'rgba(255, 225, 180, 0.08)'` | Atmospheric haze color, including its opacity. |
| `backgroundImage` | `string` | — | Same-origin or CORS-enabled image URL to refract, sampled with centered `cover` sizing. |
| `horizon` | `number` | `0.55` | Ground horizon as a fraction of canvas height, clamped to `0.1..0.9`. |
| `transitionDuration` | `number` | `0` | Transition duration in ms when intensity changes; `0` applies immediately. |
| `mirage` | `boolean` | `true` | Thin, feathered sky reflection just below the horizon. |
| `shimmer` | `boolean` | `true` | Slowly rising, low-amplitude hot-air refraction. |
| `wisps` | `boolean` | `true` | Fine-scale air turbulence; no visible vapor particles. |
| `layer` | `number` | `LAYER.BACKGROUND` (0) | Stacking layer priority inside the canvas. |

Real heat haze bends background light rather than emitting glowing waves. The transparent weather canvas cannot read the DOM behind it: without `backgroundImage`, Heat renders only a restrained haze approximation. Failed image loads also fall back to haze.

For refraction, use the same image and centered `cover` sizing on the container. Keep Heat below rain, snow, or fog (`layer={-1}`) so the sampled background does not paint over them. This samples a static image, not arbitrary HTML, live video, or other weather layers.

In fullscreen mode, the matching background must also be viewport-sized (for example, on a fixed `inset: 0` element), not sized to a taller scrolling page. Source images are raster-cached once, with the longest edge capped at 2048 pixels; quality controls distortion tessellation, not source-image resolution.

```tsx
<div style={{ position: 'relative', height: 400, background: 'url(/desert.jpg) center / cover' }}>
  <WeatherCanvas mode="contained">
    <Heat backgroundImage="/desert.jpg" horizon={0.55} intensity={0.7} layer={-1} />
  </WeatherCanvas>
</div>
```

### TypeScript exports

The public entry point exports these types in addition to the components:

- `WeatherCanvasProps`, `RainProps`, `SnowProps`, `FogProps`, `LightningProps`, `LightningFrequency`, `HeatProps`
- `ScenePreset`, `WeatherScene`, `PresetName`, `ScenePresetName`
- `Quality`, `DPRWeight`, `RenderBudget`
- `ReducedMotionProp`, `MotionMode`

`WeatherScene` aliases `ScenePreset`. `PresetName` is the union of the named preset keys, and `ScenePresetName` aliases it.

`MotionMode` describes the resolved state (`'animated'`, `'static'`, or `'off'`). The `reducedMotion` prop also accepts `'auto'` through `ReducedMotionProp`.

## Quality and performance

Each `WeatherCanvas` owns its rendering budget:

| Quality | Maximum particles per rain or snow instance | DPR cap |
| --- | ---: | ---: |
| `'low'` | 150 | 1 |
| `'medium'` | 300 | 2 |
| `'high'` | 600 | 2 |

The particle cap is **per effect instance**, not a whole-scene limit. For example, medium quality with `Snow intensity={0.5}` draws 150 flakes. A second identical `Snow` instance can draw another 150. Fog uses a bounded layer count and cached textures instead of this particle count. New lightning bolts use the current quality's subdivision depth (`3`, `4`, or `5`) and at most `1`, `2`, or `3` branches.

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

The repository's size check enforces a **5 kB minified-and-gzipped core-only budget**, excluding React. Rain, Lightning, combined Rain/Snow/Fog, and all-effects sizes are reported separately; the core budget is not a size claim for all effects together.

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

Lightning renders bolts only by default. Enable `flash` or `screenFlash` only after an explicit user choice. Full-canvas flash onsets share a minimum `2s` cooldown per `WeatherCanvas`, including across Lightning effect remounts. Static/paused canvases never flash, and disabling flashes or enabling reduced motion cancels an active flash. These safeguards are not a WCAG certification: evaluate the complete page's visual output, especially when using multiple canvases, and leave flashes off for photosensitive audiences.

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
  effects/                 Internal Rain, Snow, Fog, and Lightning implementations
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

Install the generated tarball in a separate application using its actual path. For v0.2.0:

```sh
npm install /path/to/react-weather-effects-0.2.0.tgz
```

For implementation contracts, package boundaries, and future plans, see `ARCHITECTURE.md` in the source repository. Keep changes focused, cover rendering and lifecycle behavior with tests, and verify the build, types, and size budget before submitting changes.

## Sponsoring

If you find `react-weather-effects` useful, please consider sponsoring its ongoing development and maintenance:

💖 [**Sponsor on GitHub**](https://github.com/sponsors/allwin-antony)

## License

Licensed under the MIT license.
