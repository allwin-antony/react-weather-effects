import type { RainProps } from './Rain';
import type { SnowProps } from './Snow';
import type { FogProps } from './Fog';
import type { LightningProps } from './Lightning';

export interface ScenePreset {
  wind?: { x: number; y: number };
  rain?: RainProps;
  snow?: SnowProps;
  fog?: FogProps;
  lightning?: LightningProps;
}

export type WeatherScene = ScenePreset;

/**
 * Light, gentle rain with fine droplets and a soft breeze.
 */
export const drizzle: ScenePreset = Object.freeze({
  wind: { x: 0.1, y: 0 },
  rain: {
    intensity: 0.25,
    speed: 0.8,
    angle: 4,
    dropLength: 0.7,
    dropThickness: 0.7,
  },
});

/**
 * Heavy, driving rainstorm with high winds, ground splashes, and atmospheric mist.
 */
export const rainstorm: ScenePreset = Object.freeze({
  wind: { x: 0.6, y: 0 },
  rain: {
    intensity: 0.85,
    angle: 18,
    speed: 1.2,
    dropLength: 1.2,
    dropThickness: 1.1,
    splashes: true,
  },
  fog: {
    density: 0.3,
    speed: 1.2,
    layers: 2,
  },
});

/**
 * Calm, graceful winter snowfall with gentle flake sway.
 */
export const snowfall: ScenePreset = Object.freeze({
  wind: { x: 0.2, y: 0 },
  snow: {
    intensity: 0.5,
    speed: 0.85,
    wobble: true,
  },
});

/**
 * Violent winter blizzard with blinding snow, dense multilayer fog, and fierce gale winds.
 */
export const blizzard: ScenePreset = Object.freeze({
  wind: { x: 1.4, y: 0 },
  snow: {
    intensity: 0.95,
    speed: 1.8,
    wobble: true,
  },
  fog: {
    density: 0.5,
    layers: 4,
  },
});

/**
 * Dense, atmospheric mist and fog with faint, near-vertical droplets.
 */
export const mist: ScenePreset = Object.freeze({
  wind: { x: 0.1, y: 0 },
  rain: {
    intensity: 0.15,
    angle: 0,
    speed: 0.9,
    dropLength: 0.6,
    dropThickness: 0.6,
  },
  fog: {
    density: 0.7,
    speed: 0.6,
    layers: 3,
  },
});

/**
 * Severe thunderstorm with torrential rain, atmospheric fog, and frequent lightning strikes.
 */
export const thunderstorm: ScenePreset = Object.freeze({
  wind: { x: 0.7, y: 0 },
  rain: {
    intensity: 0.9,
    angle: 16,
    speed: 1.3,
    splashes: true,
  },
  fog: {
    density: 0.35,
    speed: 1.2,
    layers: 2,
  },
  lightning: {
    frequency: 'frequent' as const,
    brightness: 1,
  },
});

export const presets = Object.freeze({
  drizzle,
  rainstorm,
  snowfall,
  blizzard,
  mist,
  thunderstorm,
});

export type PresetName = keyof typeof presets;
export type ScenePresetName = PresetName;
