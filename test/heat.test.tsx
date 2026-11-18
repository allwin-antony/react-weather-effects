import React from 'react';
import { render, act } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { WeatherCanvas, Heat, Fog } from 'react-weather-effects';
import {
  createSeededRandom,
  LAYER,
  TickerCtx,
  type DrawFn,
  type FrameState,
  type TickerContext,
} from '@react-weather-effects/core';

function createEffectHarness(maxParticles = 64, quality: 'low' | 'medium' | 'high' = 'medium') {
  const ctx = document.createElement('canvas').getContext('2d')!;
  const random = vi.fn(createSeededRandom('heat-harness-seed'));
  const frame: FrameState = {
    ctx,
    random,
    dt: 0,
    isAnimating: true,
    timestamp: 16,
    width: 800,
    height: 600,
    dpr: 1,
    budget: { maxParticles, quality, dpr: 1 },
    wind: { x: 0.2, y: 0 },
    pointer: null,
  };
  const samples: { alpha: number; args: unknown[] }[] = [];
  vi.spyOn(ctx, 'drawImage').mockImplementation((...args) => {
    samples.push({ alpha: ctx.globalAlpha, args });
  });
  const callbacks = new Map<DrawFn, number>();
  const releaseAsset = vi.fn();
  const trackAsset = vi.fn((_task: Promise<void>) => releaseAsset);
  const ticker: TickerContext = {
    getBudget: () => frame.budget,
    invalidate: vi.fn(),
    trackAsset,
    register: vi.fn((layer, draw) => {
      callbacks.set(draw, layer);
      return () => {
        callbacks.delete(draw);
      };
    }),
  };
  const draw = (overrideFrame?: Partial<FrameState>) => {
    samples.length = 0;
    const activeFrame = overrideFrame ? { ...frame, ...overrideFrame } : frame;
    for (const [callback] of [...callbacks].sort((a, b) => a[1] - b[1])) {
      callback(activeFrame);
    }
    return [...samples];
  };
  return { ctx, frame, random, ticker, draw, callbacks, trackAsset, releaseAsset };
}

function mockBackgroundImages(width = 1600, height = 1000) {
  const images: HTMLImageElement[] = [];
  vi.spyOn(globalThis, 'Image').mockImplementation(function () {
    const image = document.createElement('img');
    Object.defineProperties(image, {
      naturalWidth: { value: width },
      naturalHeight: { value: height },
      complete: { value: false },
    });
    images.push(image);
    return image;
  });
  return images;
}

describe('Heat Effect', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('throws helpful error if Heat is used outside WeatherCanvas', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      render(<Heat />);
    }).toThrow('<Heat /> must be used inside <WeatherCanvas>');

    spy.mockRestore();
  });

  it('registers on mount and unregisters on unmount', () => {
    const harness = createEffectHarness();

    const { unmount } = render(
      <TickerCtx.Provider value={harness.ticker}>
        <Heat />
      </TickerCtx.Provider>,
    );

    expect(harness.callbacks.size).toBe(1);
    unmount();
    expect(harness.callbacks.size).toBe(0);
  });

  it('draws feathered heat haze without glowing ribbons or solid vapor bubbles', () => {
    const harness = createEffectHarness();
    const arcSpy = vi.spyOn(harness.ctx, 'arc');
    const strokeSpy = vi.spyOn(harness.ctx, 'stroke');
    const fillRectSpy = vi.spyOn(harness.ctx, 'fillRect');

    const { unmount } = render(
      <TickerCtx.Provider value={harness.ticker}>
        <Heat intensity={0.7} mirage shimmer wisps />
      </TickerCtx.Provider>,
    );

    const samples = harness.draw({ dt: 0.016 });

    expect(samples.length).toBeGreaterThan(1);
    expect(samples.every(({ alpha }) => alpha <= 0.35)).toBe(true);
    expect(fillRectSpy).not.toHaveBeenCalled();
    expect(strokeSpy).not.toHaveBeenCalled();
    expect(arcSpy).not.toHaveBeenCalled();

    unmount();
  });

  it('registers draw callback at configured layer', () => {
    const harness = createEffectHarness();
    let registeredLayer: number | null = null;

    const mockTicker: TickerContext = {
      ...harness.ticker,
      register: (layer, draw) => {
        registeredLayer = layer;
        return harness.ticker.register(layer, draw);
      },
    };

    const { unmount } = render(
      <TickerCtx.Provider value={mockTicker}>
        <Heat layer={LAYER.BACKGROUND} />
      </TickerCtx.Provider>,
    );

    expect(registeredLayer).toBe(LAYER.BACKGROUND);
    unmount();
  });

  it('handles intensity = 0 gracefully without unnecessary drawing', () => {
    const harness = createEffectHarness();
    const { unmount } = render(
      <TickerCtx.Provider value={harness.ticker}>
        <Heat intensity={0} />
      </TickerCtx.Provider>,
    );

    expect(harness.draw()).toEqual([]);
    expect(harness.random).not.toHaveBeenCalled();
    unmount();
  });

  it('renders static scenes safely when isAnimating is false', () => {
    const harness = createEffectHarness();
    const { unmount } = render(
      <TickerCtx.Provider value={harness.ticker}>
        <Heat intensity={0.6} />
      </TickerCtx.Provider>,
    );

    // Frame with isAnimating = false
    const initial = harness.draw({ isAnimating: false, dt: 0 });
    expect(initial.length).toBeGreaterThan(0);
    harness.random.mockClear();
    expect(harness.draw({ isAnimating: false, dt: 0 })).toEqual(initial);
    expect(harness.draw({ isAnimating: false, dt: 0.1 })).toEqual(initial);
    expect(harness.random).not.toHaveBeenCalled();
    unmount();
  });

  it('handles toggle props: mirage=false, shimmer=false, wisps=false', () => {
    const harness = createEffectHarness();
    const { unmount } = render(
      <TickerCtx.Provider value={harness.ticker}>
        <Heat mirage={false} shimmer={false} wisps={false} intensity={0.5} />
      </TickerCtx.Provider>,
    );

    // Only the subtle ambient haze remains, with no animated lenses or mirage.
    expect(harness.draw()).toHaveLength(1);
    unmount();
  });

  it('adapts cached haze lens counts across quality tiers', () => {
    for (const [quality, count] of [['low', 8], ['medium', 12], ['high', 16]] as const) {
      const harness = createEffectHarness(64, quality);

      const { unmount } = render(
        <TickerCtx.Provider value={harness.ticker}>
          <Heat intensity={0.8} />
        </TickerCtx.Provider>,
      );

      expect(harness.draw()).toHaveLength(count);
      unmount();
    }
  });

  it('crossfades and retargets intensity without reseeding or reregistering', () => {
    const harness = createEffectHarness();
    const scene = (intensity: number) => (
      <TickerCtx.Provider value={harness.ticker}>
        <Heat intensity={intensity} speed={0} transitionDuration={400} mirage={false} shimmer={false} wisps={false} />
      </TickerCtx.Provider>
    );
    const { rerender } = render(scene(1));
    const initial = harness.draw();
    harness.random.mockClear();
    rerender(scene(0));
    expect(harness.draw()).toEqual(initial);
    expect(harness.draw({ dt: 0.1 })[0].alpha).toBeCloseTo(initial[0].alpha * 0.75);
    const halfway = harness.draw({ dt: 0.1 });
    expect(halfway[0].alpha).toBeCloseTo(initial[0].alpha * 0.5);
    rerender(scene(0.8));
    expect(harness.draw()).toEqual(halfway);
    expect(harness.draw({ dt: 0.1 })[0].alpha).toBeCloseTo(initial[0].alpha * 0.575);
    harness.draw({ dt: 0.1 });
    harness.draw({ dt: 0.1 });
    expect(harness.draw({ dt: 0.1 })[0].alpha).toBeCloseTo(initial[0].alpha * 0.8);
    rerender(scene(0));
    expect(harness.draw({ isAnimating: false })).toEqual([]);
    expect(harness.random).not.toHaveBeenCalled();
    expect(harness.ticker.register).toHaveBeenCalledTimes(1);
  });

  it('uses a cached, CSS-tinted mask and allocates no textures during drawing', () => {
    const harness = createEffectHarness();
    const scene = (color: string) => (
      <TickerCtx.Provider value={harness.ticker}><Heat color={color} /></TickerCtx.Provider>
    );
    const { rerender } = render(scene('#336699'));
    const first = harness.draw()[0].args[0] as HTMLCanvasElement;
    expect(first.getContext('2d')!.fillStyle).toBe('#336699');
    expect(first.getContext('2d')!.globalCompositeOperation).toBe('source-in');
    const allocations = vi.spyOn(document, 'createElement');
    const initial = harness.draw();
    expect(harness.draw()).toEqual(initial);
    expect(allocations).not.toHaveBeenCalled();
    rerender(scene('#cc9966'));
    const replacement = harness.draw()[0].args[0] as HTMLCanvasElement;
    expect(replacement).not.toBe(first);
    expect(replacement.getContext('2d')!.fillStyle).toBe('#cc9966');
    expect(harness.ticker.register).toHaveBeenCalledTimes(1);
  });

  it('loads and tracks a background, then refracts its pixels without reading the DOM', async () => {
    const images = mockBackgroundImages();
    const harness = createEffectHarness(300);
    const readback = vi.spyOn(harness.ctx, 'getImageData');
    render(<TickerCtx.Provider value={harness.ticker}><Heat backgroundImage="/desert.jpg" /></TickerCtx.Provider>);
    expect(images[0].crossOrigin).toBe('anonymous');
    expect(harness.trackAsset).toHaveBeenCalledTimes(1);
    expect(harness.draw().every(({ args }) => args.length === 5)).toBe(true);
    await act(async () => {
      images[0].dispatchEvent(new Event('load'));
      await harness.trackAsset.mock.calls[0][0];
    });
    const refracted = harness.draw().filter(({ args }) => args.length === 9);
    expect(refracted).toHaveLength(260);
    expect(refracted.every(({ args }) => args.length === 9)).toBe(true);
    const raster = refracted[0].args[0] as HTMLCanvasElement;
    expect(raster.getContext('2d')!.drawImage).toHaveBeenCalledWith(images[0], 0, 0, 1600, 1000);
    expect(readback).not.toHaveBeenCalled();
  });

  it('rasterizes a large background only once with a bounded cache size', () => {
    const images = mockBackgroundImages(8000, 4000);
    const harness = createEffectHarness();
    render(<TickerCtx.Provider value={harness.ticker}><Heat backgroundImage="/large.jpg" /></TickerCtx.Provider>);
    const allocations = vi.spyOn(document, 'createElement');
    images[0].dispatchEvent(new Event('load'));
    const raster = harness.draw().find(({ args }) => args.length === 9)!.args[0] as HTMLCanvasElement;
    expect(raster.width).toBe(2048);
    expect(raster.height).toBe(1024);
    expect(allocations).toHaveBeenCalledTimes(1);
    images[0].dispatchEvent(new Event('load'));
    expect(harness.draw().find(({ args }) => args.length === 9)!.args[0]).toBe(raster);
    expect(allocations).toHaveBeenCalledTimes(1);
  });

  it('retains the decoded image when a raster context cannot be allocated', () => {
    const images = mockBackgroundImages();
    const harness = createEffectHarness();
    render(<TickerCtx.Provider value={harness.ticker}><Heat backgroundImage="/desert.jpg" /></TickerCtx.Provider>);
    const contexts = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    images[0].dispatchEvent(new Event('load'));
    contexts.mockRestore();
    const refracted = harness.draw().filter(({ args }) => args.length === 9);
    expect(refracted.length).toBeGreaterThan(0);
    expect(refracted.every(({ args }) => args[0] === images[0])).toBe(true);
  });

  it.each([
    ['low', 150, 96], ['medium', 300, 240], ['high', 600, 504],
  ] as const)('bounds %s refraction tessellation to the render budget', (quality, cap, count) => {
    const images = mockBackgroundImages();
    const harness = createEffectHarness(cap, quality);
    render(<TickerCtx.Provider value={harness.ticker}><Heat backgroundImage="/desert.jpg" mirage={false} /></TickerCtx.Provider>);
    images[0].dispatchEvent(new Event('load'));
    const initial = harness.draw();
    expect(initial.filter(({ args }) => args.length === 9)).toHaveLength(count);
    harness.random.mockClear();
    harness.frame.budget = { maxParticles: 3, quality: 'low', dpr: 1 };
    expect(harness.draw().filter(({ args }) => args.length === 9)).toHaveLength(3);
    harness.frame.budget = { maxParticles: cap, quality, dpr: 1 };
    expect(harness.draw()).toEqual(initial);
    expect(harness.random).not.toHaveBeenCalled();
  });

  it.each([[1600, 600], [400, 900]])('samples centered cover crops safely at %i × %i', (width, height) => {
    const images = mockBackgroundImages();
    const harness = createEffectHarness(300);
    render(<TickerCtx.Provider value={harness.ticker}><Heat backgroundImage="/desert.jpg" /></TickerCtx.Provider>);
    images[0].dispatchEvent(new Event('load'));
    for (const { args } of harness.draw({ width, height })) {
      if (args.length !== 9) continue;
      const [sx, sy, sw, sh] = args.slice(1, 5) as number[];
      expect(sx).toBeGreaterThanOrEqual(0);
      expect(sy).toBeGreaterThanOrEqual(0);
      expect(sx + sw).toBeLessThanOrEqual(1600 + 1e-6);
      expect(sy + sh).toBeLessThanOrEqual(1000 + 1e-6);
    }
  });

  it('places a compressed, feathered sky reflection below the configured horizon', () => {
    const images = mockBackgroundImages();
    const harness = createEffectHarness(300);
    render(
      <TickerCtx.Provider value={harness.ticker}>
        <Heat backgroundImage="/desert.jpg" horizon={0.6} shimmer={false} wisps={false} />
      </TickerCtx.Provider>,
    );
    images[0].dispatchEvent(new Event('load'));
    const reflection = harness.draw().filter(({ args }) => args.length === 9);
    expect(reflection).toHaveLength(20);
    expect(reflection[0].args[6]).toBeGreaterThan(600 * 0.6);
    expect(reflection[0].args[2]).toBeGreaterThan(reflection[19].args[2] as number);
    expect(reflection[0].alpha).toBeLessThan(reflection[10].alpha);
    expect(reflection[19].alpha).toBeLessThan(reflection[10].alpha);
  });

  it('animates refraction through simulation time, but preserves paused frames and speed=0', () => {
    const images = mockBackgroundImages();
    const harness = createEffectHarness(300);
    const scene = (speed: number) => (
      <TickerCtx.Provider value={harness.ticker}><Heat backgroundImage="/desert.jpg" speed={speed} /></TickerCtx.Provider>
    );
    const { rerender } = render(scene(1));
    images[0].dispatchEvent(new Event('load'));
    const initial = harness.draw();
    const animated = harness.draw({ dt: 0.1 });
    expect(animated).not.toEqual(initial);
    expect(harness.draw({ isAnimating: false, dt: 0.1 })).toEqual(animated);
    expect(harness.draw({ dt: 0 })).toEqual(animated);
    rerender(scene(0));
    expect(harness.draw({ dt: 0.1 })).toEqual(animated);
    expect(harness.ticker.register).toHaveBeenCalledTimes(1);
  });

  it('ignores late image loads and settles failed or cancelled assets with a haze fallback', async () => {
    const images = mockBackgroundImages();
    const harness = createEffectHarness();
    const scene = (url: string) => (
      <TickerCtx.Provider value={harness.ticker}><Heat backgroundImage={url} /></TickerCtx.Provider>
    );
    const { rerender, unmount } = render(scene('/old.jpg'));
    const fallback = harness.draw();
    const lateLoad = images[0].onload!;
    rerender(scene('/new.jpg'));
    await act(async () => {
      lateLoad.call(images[0], new Event('load'));
      await harness.trackAsset.mock.calls[0][0];
      images[1].dispatchEvent(new Event('error'));
      await harness.trackAsset.mock.calls[1][0];
    });
    expect(harness.draw()).toEqual(fallback);
    expect(images[0].onload).toBeNull();
    expect(images[0].getAttribute('src')).toBeNull();
    expect(harness.releaseAsset).toHaveBeenCalledTimes(1);
    unmount();
    expect(images[1].onerror).toBeNull();
    expect(harness.releaseAsset).toHaveBeenCalledTimes(2);
  });

  it('balances drawing state even when an image draw throws', () => {
    const harness = createEffectHarness();
    render(<TickerCtx.Provider value={harness.ticker}><Heat /></TickerCtx.Provider>);
    harness.ctx.globalAlpha = 0.4;
    vi.spyOn(harness.ctx, 'drawImage').mockImplementation(() => { throw new Error('Draw failed'); });
    expect(() => harness.draw()).toThrow('Draw failed');
    expect(harness.ctx.globalAlpha).toBe(0.4);
  });

  it('cleans up correctly under StrictMode and remains safe for server rendering', () => {
    const harness = createEffectHarness();
    const { unmount } = render(
      <React.StrictMode><TickerCtx.Provider value={harness.ticker}><Heat /></TickerCtx.Provider></React.StrictMode>,
    );
    expect(harness.callbacks.size).toBe(1);
    unmount();
    expect(harness.callbacks.size).toBe(0);
    const images = vi.spyOn(globalThis, 'Image');
    const contexts = vi.spyOn(HTMLCanvasElement.prototype, 'getContext');
    expect(() => renderToString(<WeatherCanvas><Heat backgroundImage="/desert.jpg" /></WeatherCanvas>)).not.toThrow();
    expect(images).not.toHaveBeenCalled();
    expect(contexts).not.toHaveBeenCalled();
  });

  it('composes seamlessly with Fog and wind in WeatherCanvas', () => {
    const { container, unmount } = render(
      <WeatherCanvas wind={{ x: 0.5, y: 0 }}>
        <Heat intensity={0.6} />
        <Fog density={0.2} />
      </WeatherCanvas>,
    );

    const canvas = container.querySelector('canvas');
    expect(canvas).not.toBeNull();
    unmount();
  });
});
