import React from 'react';
import { render, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { WeatherCanvas } from '../packages/core/src/WeatherCanvas';
import { Rain } from '../packages/effects/src/Rain';
import { Snow } from '../packages/effects/src/Snow';
import { Fog } from '../packages/effects/src/Fog';
import { Lightning } from '../packages/effects/src/Lightning';
import { Heat } from '../packages/effects/src/Heat';
import {
  presets,
  drizzle,
  rainstorm,
  snowfall,
  blizzard,
  mist,
  thunderstorm,
  heatwave,
  type ScenePreset,
  type PresetName,
} from '../packages/effects/src/presets';

describe('Scene Presets Public API', () => {
  const PRESET_NAMES: PresetName[] = [
    'drizzle',
    'rainstorm',
    'snowfall',
    'blizzard',
    'mist',
    'thunderstorm',
    'heatwave',
  ];

  it('exports all 7 named presets individually and in the presets dictionary', () => {
    expect(presets.drizzle).toBe(drizzle);
    expect(presets.rainstorm).toBe(rainstorm);
    expect(presets.snowfall).toBe(snowfall);
    expect(presets.blizzard).toBe(blizzard);
    expect(presets.mist).toBe(mist);
    expect(presets.thunderstorm).toBe(thunderstorm);
    expect(presets.heatwave).toBe(heatwave);

    for (const name of PRESET_NAMES) {
      expect(presets[name]).toBeDefined();
      expect(typeof presets[name]).toBe('object');
    }
  });

  it('provides immutable frozen scene preset objects', () => {
    expect(Object.isFrozen(presets)).toBe(true);
    for (const name of PRESET_NAMES) {
      expect(Object.isFrozen(presets[name])).toBe(true);
    }
  });

  it('defines valid, sensible configurations for drizzle', () => {
    expect(drizzle.wind).toEqual({ x: 0.1, y: 0 });
    expect(drizzle.rain).toBeDefined();
    expect(drizzle.rain?.intensity).toBeLessThan(0.5);
    expect(drizzle.rain?.speed).toBeLessThan(1);
    expect(drizzle.snow).toBeUndefined();
    expect(drizzle.lightning).toBeUndefined();
  });

  it('defines valid, sensible configurations for rainstorm', () => {
    expect(rainstorm.wind?.x).toBeGreaterThan(0.4);
    expect(rainstorm.rain?.intensity).toBeGreaterThan(0.7);
    expect(rainstorm.rain?.splashes).toBe(true);
    expect(rainstorm.fog?.density).toBeGreaterThan(0);
    expect(rainstorm.snow).toBeUndefined();
  });

  it('defines valid, sensible configurations for snowfall', () => {
    expect(snowfall.snow?.intensity).toBeGreaterThan(0.3);
    expect(snowfall.snow?.wobble).toBe(true);
    expect(snowfall.rain).toBeUndefined();
    expect(snowfall.lightning).toBeUndefined();
  });

  it('defines valid, sensible configurations for blizzard', () => {
    expect(blizzard.wind?.x).toBeGreaterThanOrEqual(1.0);
    expect(blizzard.snow?.intensity).toBeGreaterThan(0.9);
    expect(blizzard.snow?.speed).toBeGreaterThan(1.5);
    expect(blizzard.fog?.density).toBeGreaterThanOrEqual(0.4);
    expect(blizzard.fog?.layers).toBeGreaterThanOrEqual(3);
    expect(blizzard.rain).toBeUndefined();
  });

  it('defines valid, sensible configurations for mist', () => {
    expect(mist.fog?.density).toBeGreaterThanOrEqual(0.6);
    expect(mist.rain?.intensity).toBeLessThan(0.3);
    expect(mist.snow).toBeUndefined();
  });

  it('defines valid, sensible configurations for thunderstorm', () => {
    expect(thunderstorm.rain?.intensity).toBeGreaterThan(0.8);
    expect(thunderstorm.lightning?.frequency).toBe('frequent');
    expect(thunderstorm.fog?.density).toBeGreaterThan(0.2);
    expect(thunderstorm.snow).toBeUndefined();
  });

  it('defines valid, sensible configurations for heatwave', () => {
    expect(heatwave.heat).toBeDefined();
    expect(heatwave.heat?.intensity).toBeGreaterThan(0.5);
    expect(heatwave.heat?.mirage).toBe(true);
    expect(heatwave.heat?.shimmer).toBe(true);
    expect(heatwave.heat?.wisps).toBe(true);
    expect(heatwave.rain).toBeUndefined();
    expect(heatwave.snow).toBeUndefined();
  });

  it('composes directly with WeatherCanvas and effect components', () => {
    const scene: ScenePreset = presets.thunderstorm;

    const { container, unmount } = render(
      <WeatherCanvas wind={scene.wind}>
        {scene.rain && <Rain {...scene.rain} />}
        {scene.snow && <Snow {...scene.snow} />}
        {scene.fog && <Fog {...scene.fog} />}
        {scene.lightning && <Lightning {...scene.lightning} />}
        {scene.heat && <Heat {...scene.heat} />}
      </WeatherCanvas>,
    );

    const canvas = container.querySelector('canvas');
    expect(canvas).not.toBeNull();
    unmount();
  });

  it('supports natural switching between scene presets via transitions', () => {
    function WeatherSceneView({ presetName }: { presetName: PresetName }) {
      const active = presets[presetName];
      return (
        <WeatherCanvas wind={active.wind}>
          <Rain intensity={active.rain?.intensity ?? 0} transitionDuration={200} {...active.rain} />
          <Snow intensity={active.snow?.intensity ?? 0} transitionDuration={200} {...active.snow} />
          <Fog density={active.fog?.density ?? 0} transitionDuration={200} {...active.fog} />
          {active.lightning && <Lightning {...active.lightning} />}
          {active.heat && <Heat {...active.heat} />}
        </WeatherCanvas>
      );
    }

    const { rerender, unmount } = render(<WeatherSceneView presetName="drizzle" />);

    // Switch from drizzle to blizzard
    act(() => {
      rerender(<WeatherSceneView presetName="blizzard" />);
    });

    // Switch from blizzard to thunderstorm
    act(() => {
      rerender(<WeatherSceneView presetName="thunderstorm" />);
    });

    // Switch to mist
    act(() => {
      rerender(<WeatherSceneView presetName="mist" />);
    });

    // Switch to heatwave
    act(() => {
      rerender(<WeatherSceneView presetName="heatwave" />);
    });

    unmount();
  });
});
