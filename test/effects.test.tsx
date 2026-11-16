import React, { useState } from 'react';
import { render, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  WeatherCanvas,
  Rain,
  Snow,
  Fog,
} from 'react-weather-effects';
import {
  createSeededRandom,
  SchedulerCtx,
  TickerCtx,
  type DrawFn,
  type FrameScheduler,
  type FrameState,
  type TickerContext,
} from '@react-weather-effects/core';

class TestManualScheduler implements FrameScheduler {
  private nextId = 1;
  private queue = new Map<number, (timestamp: number) => void>();

  request(cb: (timestamp: number) => void): number {
    const id = this.nextId++;
    this.queue.set(id, cb);
    return id;
  }

  cancel(id: number): void {
    this.queue.delete(id);
  }

  step(timestamp: number): void {
    const callbacks = Array.from(this.queue.values());
    this.queue.clear();
    for (const cb of callbacks) {
      cb(timestamp);
    }
  }
}

function createEffectHarness(maxParticles = 24) {
  const ctx = document.createElement('canvas').getContext('2d')!;
  const random = vi.fn(createSeededRandom('effect-rendering'));
  const frame: FrameState = {
    ctx, random, dt: 0, isAnimating: true, timestamp: 0, width: 800, height: 600, dpr: 1,
    budget: { maxParticles, quality: 'medium', dpr: 1 },
    wind: { x: 0, y: 0 }, pointer: null,
  };
  const callbacks = new Map<DrawFn, number>();
  const ticker: TickerContext = {
    getBudget: () => frame.budget,
    invalidate: vi.fn(),
    trackAsset: () => () => {},
    register: (layer, draw) => {
      callbacks.set(draw, layer);
      return () => { callbacks.delete(draw); };
    },
  };
  const draw = () => {
    for (const [callback] of [...callbacks].sort((a, b) => a[1] - b[1])) callback(frame);
  };
  return { ctx, frame, random, ticker, draw };
}

describe('Weather Effects', () => {
  let scheduler: TestManualScheduler;

  beforeEach(() => {
    scheduler = new TestManualScheduler();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('throws helpful error if Rain is used outside WeatherCanvas', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      render(<Rain />);
    }).toThrow('<Rain /> must be used inside <WeatherCanvas>');

    spy.mockRestore();
  });

  it('throws helpful error if Snow is used outside WeatherCanvas', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      render(<Snow />);
    }).toThrow('<Snow /> must be used inside <WeatherCanvas>');

    spy.mockRestore();
  });

  it('throws helpful error if Fog is used outside WeatherCanvas', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      render(<Fog />);
    }).toThrow('<Fog /> must be used inside <WeatherCanvas>');

    spy.mockRestore();
  });

  it('draws Rain by executing canvas stroke commands', () => {
    const { container } = render(
      <SchedulerCtx.Provider value={scheduler}>
        <WeatherCanvas mode="fullscreen" reducedMotion="animated">
          <Rain intensity={0.5} color="rgba(100, 150, 200, 0.7)" />
        </WeatherCanvas>
      </SchedulerCtx.Provider>,
    );

    const canvas = container.querySelector('canvas')!;
    const ctx = canvas.getContext('2d')!;
    const strokeSpy = vi.spyOn(ctx, 'stroke');

    act(() => {
      scheduler.step(100);
    });

    expect(strokeSpy).toHaveBeenCalled();
  });

  it('draws Snow using a cached soft texture', () => {
    const { container } = render(
      <SchedulerCtx.Provider value={scheduler}>
        <WeatherCanvas mode="fullscreen" reducedMotion="animated">
          <Snow intensity={0.5} color="rgba(255, 255, 255, 0.9)" />
        </WeatherCanvas>
      </SchedulerCtx.Provider>,
    );

    const canvas = container.querySelector('canvas')!;
    const ctx = canvas.getContext('2d')!;
    const drawImageSpy = vi.spyOn(ctx, 'drawImage');

    act(() => {
      scheduler.step(100);
    });

    expect(drawImageSpy).toHaveBeenCalledTimes(150);
  });

  it('draws Fog by executing canvas drawImage commands', () => {
    const { container } = render(
      <SchedulerCtx.Provider value={scheduler}>
        <WeatherCanvas mode="fullscreen" reducedMotion="animated">
          <Fog density={0.5} />
        </WeatherCanvas>
      </SchedulerCtx.Provider>,
    );

    const canvas = container.querySelector('canvas')!;
    const ctx = canvas.getContext('2d')!;
    const drawImageSpy = vi.spyOn(ctx, 'drawImage');

    act(() => {
      scheduler.step(100);
    });

    expect(drawImageSpy).toHaveBeenCalled();
  });

  it('renders Rain, Snow, and Fog together inside WeatherCanvas', () => {
    const { container } = render(
      <SchedulerCtx.Provider value={scheduler}>
        <WeatherCanvas mode="contained" reducedMotion="animated">
          <Rain intensity={0.6} angle={15} />
          <Snow intensity={0.4} wobble={true} />
          <Fog density={0.3} />
        </WeatherCanvas>
      </SchedulerCtx.Provider>,
    );

    const canvas = container.querySelector('canvas')!;
    const ctx = canvas.getContext('2d')!;
    const strokeSpy = vi.spyOn(ctx, 'stroke');
    const drawImageSpy = vi.spyOn(ctx, 'drawImage');

    act(() => {
      scheduler.step(100);
    });

    expect(strokeSpy).toHaveBeenCalled();
    expect(drawImageSpy).toHaveBeenCalled();
    expect(new Set(drawImageSpy.mock.calls.map(([texture]) => texture)).size).toBe(2);
    expect(drawImageSpy.mock.invocationCallOrder[0]).toBeLessThan(strokeSpy.mock.invocationCallOrder[0]);
  });

  it('supports multiple independent Rain instances with distinct styles', () => {
    const { container } = render(
      <SchedulerCtx.Provider value={scheduler}>
        <WeatherCanvas mode="fullscreen" reducedMotion="animated">
          <Rain intensity={0.3} angle={5} color="rgba(100, 150, 200, 0.5)" />
          <Rain intensity={0.8} angle={-15} color="rgba(200, 220, 255, 0.8)" />
        </WeatherCanvas>
      </SchedulerCtx.Provider>,
    );

    const canvas = container.querySelector('canvas')!;
    const ctx = canvas.getContext('2d')!;
    ctx.strokeStyle = 'rgba(100, 150, 200, 0.5)';
    const firstColor = ctx.strokeStyle;
    ctx.strokeStyle = 'rgba(200, 220, 255, 0.8)';
    const secondColor = ctx.strokeStyle;
    const styles: CanvasRenderingContext2D['strokeStyle'][] = [];
    vi.spyOn(ctx, 'stroke').mockImplementation(() => { styles.push(ctx.strokeStyle); });

    act(() => {
      scheduler.step(100);
    });

    expect(new Set(styles)).toEqual(new Set([firstColor, secondColor]));
    expect(styles.filter((style) => style === firstColor)).toHaveLength(90 * 3);
    expect(styles.filter((style) => style === secondColor)).toHaveLength(240 * 3);
  });

  it('updates Rain settings dynamically without unmounting or crashing', () => {
    function DynamicRainScene() {
      const [intensity, setIntensity] = useState(0.2);
      return (
        <SchedulerCtx.Provider value={scheduler}>
          <button onClick={() => setIntensity(0.9)}>Increase</button>
          <WeatherCanvas mode="fullscreen" reducedMotion="animated">
            <Rain intensity={intensity} angle={10} />
          </WeatherCanvas>
        </SchedulerCtx.Provider>
      );
    }

    const { getByText } = render(<DynamicRainScene />);

    act(() => {
      scheduler.step(100);
    });

    act(() => {
      getByText('Increase').click();
    });

    act(() => {
      scheduler.step(200);
    });
  });

  it('varies Snow opacity and size without allocating textures or advancing randomness on redraw', () => {
    const { ctx, random, ticker, draw } = createEffectHarness();
    const alphas: number[] = [];
    const originalDrawImage = ctx.drawImage;
    const images = vi.spyOn(ctx, 'drawImage').mockImplementation((...args) => {
      alphas.push(ctx.globalAlpha);
      originalDrawImage(...args);
    });
    render(<TickerCtx.Provider value={ticker}><Snow intensity={1} /></TickerCtx.Provider>);

    act(draw);
    const firstFrame = [...images.mock.calls];
    const texture = firstFrame[0][0] as HTMLCanvasElement;
    const gradients = vi.spyOn(texture.getContext('2d')!, 'createRadialGradient');
    expect(new Set(alphas).size).toBeGreaterThan(1);
    expect(new Set(firstFrame.map((args) => args[3])).size).toBeGreaterThan(1);
    expect(alphas.every((alpha) => alpha >= 0 && alpha <= 1)).toBe(true);
    expect(ctx.globalAlpha).toBe(1);

    images.mockClear();
    random.mockClear();
    act(draw);
    expect(images.mock.calls).toEqual(firstFrame);
    expect(random).not.toHaveBeenCalled();
    expect(gradients).not.toHaveBeenCalled();
  });

  it('updates Snow color and size without reseeding, and freezes flutter at zero speed', () => {
    const { ctx, frame, random, ticker, draw } = createEffectHarness(4);
    random.mockImplementation(() => 0.5);
    const images = vi.spyOn(ctx, 'drawImage');
    const { rerender } = render(
      <TickerCtx.Provider value={ticker}><Snow intensity={1} /></TickerCtx.Provider>,
    );
    act(draw);
    const original = images.mock.calls[0];

    rerender(
      <TickerCtx.Provider value={ticker}>
        <Snow intensity={1} color="#ffd700" minSize={3} maxSize={6} speed={0} />
      </TickerCtx.Provider>,
    );
    images.mockClear();
    random.mockClear();
    act(draw);
    const updated = images.mock.calls[0];
    expect(updated[0]).not.toBe(original[0]);
    expect(updated[3]).toBeGreaterThan(original[3]);
    expect(updated[1] + updated[3] / 2).toBeCloseTo(original[1] + original[3] / 2);
    expect(updated[2] + updated[4] / 2).toBeCloseTo(original[2] + original[4] / 2);
    expect(random).not.toHaveBeenCalled();

    images.mockClear();
    frame.dt = 0.1;
    frame.timestamp = 100;
    act(draw);
    expect(images.mock.calls[0]).toEqual(updated);
    expect(random).not.toHaveBeenCalled();
  });

  it('falls back to circles if the Snow texture context is unavailable', () => {
    const { ctx, ticker, draw } = createEffectHarness(4);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    const fill = vi.spyOn(ctx, 'fill');
    const images = vi.spyOn(ctx, 'drawImage');
    render(<TickerCtx.Provider value={ticker}><Snow intensity={1} /></TickerCtx.Provider>);
    act(draw);
    expect(fill).toHaveBeenCalledTimes(4);
    expect(images).not.toHaveBeenCalled();
  });

  it.each(['/snowflake.png', '/crystal.svg', '/sprite?id=crystal'])('caches Snow sprite %s without reloading or reseeding', async (spriteUrl) => {
    const { ctx, random, ticker, draw } = createEffectHarness(4);
    random.mockImplementation(() => 0.5);
    const image = document.createElement('img');
    Object.defineProperties(image, {
      naturalWidth: { value: 120 }, naturalHeight: { value: 60 },
    });
    const imageFactory = vi.spyOn(globalThis, 'Image').mockImplementation(function () { return image; });
    const release = vi.fn();
    const track = vi.spyOn(ticker, 'trackAsset').mockReturnValue(release);
    const images = vi.spyOn(ctx, 'drawImage');
    const positions = vi.spyOn(ctx, 'translate');
    const { rerender, unmount } = render(
      <TickerCtx.Provider value={ticker}>
        <Snow sprite={spriteUrl} intensity={1} minSize={10} maxSize={10} wobble={false} />
      </TickerCtx.Provider>,
    );
    expect(image.crossOrigin).toBe('anonymous');
    expect(image.getAttribute('src')).toBe(spriteUrl);
    expect(track).toHaveBeenCalledTimes(1);
    act(draw);
    const fallback = images.mock.calls[0];
    expect(fallback[0]).toBeInstanceOf(HTMLCanvasElement);

    await act(async () => {
      image.dispatchEvent(new Event('load'));
      await track.mock.calls[0][0];
    });
    images.mockClear();
    random.mockClear();
    act(draw);
    const cached = images.mock.calls[0][0] as HTMLCanvasElement;
    expect(cached).toBeInstanceOf(HTMLCanvasElement);
    expect([cached.width, cached.height]).toEqual([64, 32]);
    const rasterContext = cached.getContext('2d')!;
    const rasterImages = vi.mocked(rasterContext.drawImage);
    expect(rasterImages).toHaveBeenCalledExactlyOnceWith(image, 0, 0, 64, 32);
    expect(rasterContext.globalCompositeOperation).toBe('source-over');
    expect(images.mock.calls[0]).toEqual([cached, -10, -5, 20, 10]);
    expect(positions.mock.calls[0][0]).toBeCloseTo(fallback[1] + fallback[3] / 2);
    expect(positions.mock.calls[0][1]).toBeCloseTo(fallback[2] + fallback[4] / 2);
    expect(random).not.toHaveBeenCalled();
    expect(ctx.getTransform().e).toBe(0);
    expect(ctx.getTransform().f).toBe(0);

    rerender(
      <TickerCtx.Provider value={ticker}>
        <Snow sprite={spriteUrl} intensity={0.5} speed={2} color="blue" wobble={false} />
      </TickerCtx.Provider>,
    );
    images.mockClear();
    act(draw);
    expect(imageFactory).toHaveBeenCalledTimes(1);
    expect(images).toHaveBeenCalledTimes(2);
    expect(images.mock.calls[0][0]).toBe(cached);
    expect(rasterImages).toHaveBeenCalledTimes(1);
    expect(random).not.toHaveBeenCalled();
    unmount();
    expect(release).toHaveBeenCalledTimes(1);
    expect(image.onload).toBeNull();
    expect(image.onerror).toBeNull();
    expect(image.getAttribute('src')).toBeNull();
  });

  it('synchronously initializes the Snow sprite when the image is already complete (preloaded)', () => {
    const { ctx, random, ticker, draw } = createEffectHarness(4);
    random.mockImplementation(() => 0.5);
    const image = document.createElement('img');
    Object.defineProperties(image, {
      naturalWidth: { value: 64 },
      naturalHeight: { value: 64 },
      complete: { value: true },
    });
    vi.spyOn(globalThis, 'Image').mockImplementation(function () { return image; });
    const images = vi.spyOn(ctx, 'drawImage');

    render(
      <TickerCtx.Provider value={ticker}>
        <Snow sprite="/preloaded-flake.png" intensity={1} minSize={10} maxSize={10} wobble={false} />
      </TickerCtx.Provider>,
    );

    act(draw);
    const drawnTexture = images.mock.calls[0][0] as HTMLCanvasElement;
    expect(drawnTexture).toBeInstanceOf(HTMLCanvasElement);
    expect(images.mock.calls[0]).toEqual([drawnTexture, -10, -10, 20, 20]);
  });

  it('grows the Snow sprite cache only across size or DPR buckets without reloading or reseeding', async () => {
    const { ctx, frame, random, ticker, draw } = createEffectHarness(4);
    const image = document.createElement('img');
    Object.defineProperties(image, {
      naturalWidth: { value: 256 }, naturalHeight: { value: 128 },
    });
    const imageFactory = vi.spyOn(globalThis, 'Image').mockImplementation(function () { return image; });
    const track = vi.spyOn(ticker, 'trackAsset');
    const images = vi.spyOn(ctx, 'drawImage');
    const scene = (maxSize: number) => (
      <TickerCtx.Provider value={ticker}>
        <Snow sprite="/crystal.svg" intensity={1} minSize={10} maxSize={maxSize} />
      </TickerCtx.Provider>
    );
    const { rerender } = render(scene(10));
    await act(async () => {
      image.dispatchEvent(new Event('load'));
      await track.mock.calls[0][0];
    });
    act(draw);
    const first = images.mock.calls[0][0] as HTMLCanvasElement;
    expect([first.width, first.height]).toEqual([64, 32]);
    random.mockClear();

    rerender(scene(30));
    images.mockClear();
    act(draw);
    expect(images.mock.calls[0][0]).toBe(first);

    rerender(scene(40));
    images.mockClear();
    act(draw);
    const larger = images.mock.calls[0][0] as HTMLCanvasElement;
    expect(larger).not.toBe(first);
    expect([larger.width, larger.height]).toEqual([128, 64]);

    frame.dpr = 2;
    frame.budget = { ...frame.budget, dpr: 2 };
    images.mockClear();
    act(draw);
    const sharper = images.mock.calls[0][0] as HTMLCanvasElement;
    expect(sharper).not.toBe(larger);
    expect([sharper.width, sharper.height]).toEqual([256, 128]);

    frame.dpr = 1;
    frame.budget = { ...frame.budget, dpr: 1 };
    rerender(scene(10));
    images.mockClear();
    act(draw);
    act(draw);
    expect(images.mock.calls.every(([source]) => source === sharper)).toBe(true);
    expect(sharper.getContext('2d')!.drawImage).toHaveBeenCalledTimes(1);
    expect(imageFactory).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledTimes(1);
    expect(random).not.toHaveBeenCalled();
  });

  it('bounds tall Snow sprite textures while preserving their original aspect ratio', async () => {
    const { ctx, ticker, draw } = createEffectHarness(1);
    const image = document.createElement('img');
    Object.defineProperties(image, {
      naturalWidth: { value: 2048 }, naturalHeight: { value: 4096 },
    });
    vi.spyOn(globalThis, 'Image').mockImplementation(function () { return image; });
    const track = vi.spyOn(ticker, 'trackAsset');
    const images = vi.spyOn(ctx, 'drawImage');
    render(
      <TickerCtx.Provider value={ticker}>
        <Snow sprite="/tall.svg" intensity={1} minSize={2000} maxSize={2000} wobble={false} />
      </TickerCtx.Provider>,
    );
    await act(async () => {
      image.dispatchEvent(new Event('load'));
      await track.mock.calls[0][0];
    });
    act(draw);
    const cached = images.mock.calls[0][0] as HTMLCanvasElement;
    expect([cached.width, cached.height]).toEqual([512, 1024]);
    expect(images.mock.calls[0]).toEqual([cached, -1000, -2000, 2000, 4000]);
  });

  it.each(['context', 'draw'])('settles a failed Snow sprite rasterization (%s) with the built-in fallback', async (failure) => {
    const { ctx, ticker, draw } = createEffectHarness(4);
    const image = document.createElement('img');
    Object.defineProperties(image, {
      naturalWidth: { value: 64 }, naturalHeight: { value: 64 },
    });
    vi.spyOn(globalThis, 'Image').mockImplementation(function () { return image; });
    const release = vi.fn();
    const track = vi.spyOn(ticker, 'trackAsset').mockReturnValue(release);
    const images = vi.spyOn(ctx, 'drawImage');
    const { unmount } = render(
      <TickerCtx.Provider value={ticker}><Snow sprite="/broken.svg" intensity={1} /></TickerCtx.Provider>,
    );
    act(draw);
    const fallback = images.mock.calls[0][0];
    const brokenContext = document.createElement('canvas').getContext('2d')!;
    vi.spyOn(brokenContext, 'drawImage').mockImplementation(() => { throw new Error('Rasterization failed'); });
    const contexts = vi.spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue(failure === 'context' ? null : brokenContext);
    await act(async () => {
      image.dispatchEvent(new Event('load'));
      await track.mock.calls[0][0];
    });
    images.mockClear();
    act(draw);
    act(draw);
    expect(images.mock.calls.every(([source]) => source === fallback)).toBe(true);
    expect(contexts).toHaveBeenCalledTimes(1);
    unmount();
    expect(release).toHaveBeenCalledTimes(1);
    expect(image.onload).toBeNull();
    expect(image.getAttribute('src')).toBeNull();
  });

  it('retains a usable Snow sprite cache and does not retry a failed upgrade every frame', async () => {
    const { ctx, frame, ticker, draw } = createEffectHarness(4);
    const image = document.createElement('img');
    Object.defineProperties(image, {
      naturalWidth: { value: 64 }, naturalHeight: { value: 64 },
    });
    vi.spyOn(globalThis, 'Image').mockImplementation(function () { return image; });
    const track = vi.spyOn(ticker, 'trackAsset');
    const images = vi.spyOn(ctx, 'drawImage');
    render(
      <TickerCtx.Provider value={ticker}>
        <Snow sprite="/crystal.svg" intensity={1} minSize={20} maxSize={20} />
      </TickerCtx.Provider>,
    );
    await act(async () => {
      image.dispatchEvent(new Event('load'));
      await track.mock.calls[0][0];
    });
    act(draw);
    const cached = images.mock.calls[0][0];
    const contexts = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    frame.dpr = 2;
    frame.budget = { ...frame.budget, dpr: 2 };
    images.mockClear();
    act(draw);
    act(draw);
    expect(images.mock.calls.every(([source]) => source === cached)).toBe(true);
    expect(contexts).toHaveBeenCalledTimes(1);
  });

  it('ignores late Snow sprite loads and settles failed or cancelled assets with a fallback', async () => {
    const { ctx, ticker, draw } = createEffectHarness(4);
    const assets: HTMLImageElement[] = [];
    vi.spyOn(globalThis, 'Image').mockImplementation(function () {
      const image = document.createElement('img');
      Object.defineProperties(image, {
        naturalWidth: { value: 64 }, naturalHeight: { value: 64 },
      });
      assets.push(image);
      return image;
    });
    const release = vi.fn();
    const track = vi.spyOn(ticker, 'trackAsset').mockReturnValue(release);
    const images = vi.spyOn(ctx, 'drawImage');
    const { rerender, unmount } = render(
      <TickerCtx.Provider value={ticker}><Snow sprite="/old.png" /></TickerCtx.Provider>,
    );
    act(draw);
    const fallback = images.mock.calls[0][0];
    const lateLoad = assets[0].onload!;
    expect(images.mock.calls[0][3]).toBeGreaterThan(18);

    rerender(<TickerCtx.Provider value={ticker}><Snow sprite="/new.png" /></TickerCtx.Provider>);
    await act(async () => {
      lateLoad.call(assets[0], new Event('load'));
      await track.mock.calls[0][0];
      assets[1].dispatchEvent(new Event('error'));
      await track.mock.calls[1][0];
    });
    images.mockClear();
    act(draw);
    expect(images.mock.calls[0][0]).toBe(fallback);
    expect(release).toHaveBeenCalledTimes(1);
    unmount();
    expect(release).toHaveBeenCalledTimes(2);
  });

  it('draws tapered Rain trails and retains different intrinsic fall speeds', () => {
    const { ctx, frame, random, ticker, draw } = createEffectHarness(2);
    const values = [0.1, 0.5, 0.5, 0.9, 0.5, 0.5];
    let index = 0;
    random.mockImplementation(() => values[index++ % values.length]);
    frame.height = 10000;
    const alphas: number[] = [];
    const widths: number[] = [];
    vi.spyOn(ctx, 'stroke').mockImplementation(() => {
      alphas.push(ctx.globalAlpha);
      widths.push(ctx.lineWidth);
    });
    const starts = vi.spyOn(ctx, 'moveTo');
    const ends = vi.spyOn(ctx, 'lineTo');
    render(<TickerCtx.Provider value={ticker}><Rain intensity={1} angle={0} /></TickerCtx.Provider>);
    act(draw);
    expect(alphas[0]).toBeGreaterThan(alphas[1]);
    expect(alphas[1]).toBeGreaterThan(alphas[2]);
    expect(widths[0]).toBeGreaterThan(widths[1]);
    expect(widths[3]).toBeGreaterThan(widths[0]);
    const firstTrail = starts.mock.calls[0][1] - ends.mock.calls[0][1];
    const secondTrail = starts.mock.calls[3][1] - ends.mock.calls[3][1];
    expect(secondTrail).toBeGreaterThan(firstTrail);

    frame.dt = 0.1;
    random.mockClear();
    for (let i = 0; i < 10; i++) {
      starts.mockClear();
      ends.mockClear();
      frame.timestamp += 100;
      act(draw);
    }
    expect(starts.mock.calls[0][1] - ends.mock.calls[0][1]).toBeCloseTo(firstTrail);
    expect(starts.mock.calls[3][1] - ends.mock.calls[3][1]).toBeCloseTo(secondTrail);
    expect(random).not.toHaveBeenCalled();
    expect(ctx.globalAlpha).toBe(1);
  });

  it('keeps Snow and Rain within the live particle cap and draws nothing at zero intensity', () => {
    const { ctx, frame, random, ticker, draw } = createEffectHarness();
    const images = vi.spyOn(ctx, 'drawImage');
    const strokes = vi.spyOn(ctx, 'stroke');
    const { rerender } = render(
      <TickerCtx.Provider value={ticker}><Snow intensity={2} /><Rain intensity={2} /></TickerCtx.Provider>,
    );
    act(draw);
    expect(images).toHaveBeenCalledTimes(24);
    expect(strokes).toHaveBeenCalledTimes(24 * 3);

    images.mockClear();
    strokes.mockClear();
    random.mockClear();
    frame.budget = { ...frame.budget, maxParticles: 12 };
    act(draw);
    expect(images).toHaveBeenCalledTimes(12);
    expect(strokes).toHaveBeenCalledTimes(12 * 3);
    expect(random).not.toHaveBeenCalled();

    rerender(
      <TickerCtx.Provider value={ticker}><Snow intensity={-1} /><Rain intensity={-1} /></TickerCtx.Provider>,
    );
    images.mockClear();
    strokes.mockClear();
    act(draw);
    expect(images).not.toHaveBeenCalled();
    expect(strokes).not.toHaveBeenCalled();
    expect(random).not.toHaveBeenCalled();
  });

  it.each(['#aabbcc', 'rebeccapurple', 'rgba(20, 40, 60, 0.1)'])(
    'tints the feathered Fog mask with CSS color %s', (color) => {
      const { ctx, ticker, draw } = createEffectHarness();
      const images = vi.spyOn(ctx, 'drawImage');
      render(<TickerCtx.Provider value={ticker}><Fog color={color} /></TickerCtx.Provider>);
      act(draw);
      const texture = images.mock.calls[0][0] as HTMLCanvasElement;
      const textureCtx = texture.getContext('2d')!;
      expect(textureCtx.globalCompositeOperation).toBe('source-in');
      const tint = textureCtx.fillStyle;
      textureCtx.fillStyle = color;
      expect(tint).toBe(textureCtx.fillStyle);
    },
  );

  it('retains existing Fog wisps across layer changes and skips zero-density drawing', () => {
    const { ctx, random, ticker, draw } = createEffectHarness();
    const images = vi.spyOn(ctx, 'drawImage');
    const { rerender } = render(
      <TickerCtx.Provider value={ticker}><Fog layers={1} /></TickerCtx.Provider>,
    );
    act(draw);
    const firstLayer = [...images.mock.calls];

    rerender(<TickerCtx.Provider value={ticker}><Fog layers={3} /></TickerCtx.Provider>);
    images.mockClear();
    act(draw);
    expect(images).toHaveBeenCalledTimes(9);
    expect(images.mock.calls.slice(0, 3)).toEqual(firstLayer);

    rerender(<TickerCtx.Provider value={ticker}><Fog layers={1} /></TickerCtx.Provider>);
    images.mockClear();
    random.mockClear();
    act(draw);
    expect(images.mock.calls).toEqual(firstLayer);
    expect(random).not.toHaveBeenCalled();

    rerender(<TickerCtx.Provider value={ticker}><Fog layers={1} density={0} /></TickerCtx.Provider>);
    images.mockClear();
    act(draw);
    expect(images).not.toHaveBeenCalled();
    expect(random).not.toHaveBeenCalled();
  });

  it('rescales static Fog wisps on resize without reseeding or regenerating textures', () => {
    const { ctx, frame, random, ticker, draw } = createEffectHarness();
    const images = vi.spyOn(ctx, 'drawImage');
    render(<TickerCtx.Provider value={ticker}><Fog /></TickerCtx.Provider>);
    act(draw);
    const original = [...images.mock.calls];

    images.mockClear();
    random.mockClear();
    frame.width *= 2;
    frame.height *= 2;
    act(draw);
    images.mock.calls.forEach((args, i) => {
      expect(args[0]).toBe(original[i][0]);
      for (const j of [1, 2, 3, 4] as const) expect(args[j]).toBeCloseTo(original[i][j] * 2);
    });
    expect(random).not.toHaveBeenCalled();
    expect(ctx.globalAlpha).toBe(1);
  });

  it('controls Snow sprite rotation independently from sideways wobble and respects rotationSpeed', async () => {
    const { ctx, frame, random, ticker, draw } = createEffectHarness(4);
    random.mockImplementation(() => 0.5);
    const image = document.createElement('img');
    Object.defineProperties(image, {
      naturalWidth: { value: 100 }, naturalHeight: { value: 100 },
    });
    vi.spyOn(globalThis, 'Image').mockImplementation(function () { return image; });
    const track = vi.spyOn(ticker, 'trackAsset');
    const rotates = vi.spyOn(ctx, 'rotate');
    const translates = vi.spyOn(ctx, 'translate');

    // 1. Drift without rotating: wobble={true}, rotation={false}
    const { rerender } = render(
      <TickerCtx.Provider value={ticker}>
        <Snow sprite="/flake.png" intensity={0.5} wobble={true} rotation={false} />
      </TickerCtx.Provider>,
    );
    await act(async () => {
      image.dispatchEvent(new Event('load'));
      await track.mock.calls[0][0];
    });

    frame.dt = 0.05;
    act(draw);
    expect(translates).toHaveBeenCalled();
    expect(rotates).not.toHaveBeenCalled();

    // 2. Rotate without swaying: wobble={false}, rotation={true}
    rerender(
      <TickerCtx.Provider value={ticker}>
        <Snow sprite="/flake.png" intensity={0.5} wobble={false} rotation={true} />
      </TickerCtx.Provider>,
    );
    translates.mockClear();
    rotates.mockClear();
    frame.dt = 0.05;
    act(draw);
    expect(translates).toHaveBeenCalled();
    expect(rotates).toHaveBeenCalled();
    const angle1 = rotates.mock.calls[0][0];

    // Advance frame and measure rotation progression
    rotates.mockClear();
    frame.dt = 0.1;
    act(draw);
    const angle2 = rotates.mock.calls[0][0];
    const deltaNormal = Math.abs(angle2 - angle1);
    expect(deltaNormal).toBeGreaterThan(0);

    // 3. Double rotation speed: rotationSpeed={2}
    rerender(
      <TickerCtx.Provider value={ticker}>
        <Snow sprite="/flake.png" intensity={0.5} wobble={false} rotation={true} rotationSpeed={2} />
      </TickerCtx.Provider>,
    );
    rotates.mockClear();
    frame.dt = 0.1;
    act(draw);
    const angle3 = rotates.mock.calls[0][0];
    const deltaFast = Math.abs(angle3 - angle2);
    expect(deltaFast).toBeCloseTo(deltaNormal * 2, 4);

    // 4. Freeze rotation: rotationSpeed={0}
    rerender(
      <TickerCtx.Provider value={ticker}>
        <Snow sprite="/flake.png" intensity={0.5} wobble={false} rotation={true} rotationSpeed={0} />
      </TickerCtx.Provider>,
    );
    rotates.mockClear();
    frame.dt = 0.1;
    act(draw);
    const angle4 = rotates.mock.calls[0][0];
    expect(angle4).toBeCloseTo(angle3, 4);

    // 5. Default inheritance: wobble={false} without rotation prop disables rotation
    rerender(
      <TickerCtx.Provider value={ticker}>
        <Snow sprite="/flake.png" intensity={0.5} wobble={false} />
      </TickerCtx.Provider>,
    );
    rotates.mockClear();
    frame.dt = 0.1;
    act(draw);
    expect(rotates).not.toHaveBeenCalled();

    // 6. Default inheritance: rotationSpeed without rotation prop enables rotation
    rerender(
      <TickerCtx.Provider value={ticker}>
        <Snow sprite="/flake.png" intensity={0.5} wobble={false} rotationSpeed={1.5} />
      </TickerCtx.Provider>,
    );
    rotates.mockClear();
    frame.dt = 0.1;
    act(draw);
    expect(rotates).toHaveBeenCalled();
  });

  it('customizes Rain drop length, drop thickness, and bottom-edge splashes', () => {
    const { ctx, frame, random, ticker, draw } = createEffectHarness(4);
    random.mockImplementation(() => 0.5);

    const linesTo = vi.spyOn(ctx, 'lineTo');
    const movesTo = vi.spyOn(ctx, 'moveTo');
    const ellipses = vi.spyOn(ctx, 'ellipse');

    // 1. Baseline: dropLength=1, dropThickness=1, splashes=false
    const { rerender } = render(
      <TickerCtx.Provider value={ticker}>
        <Rain intensity={0.5} dropLength={1} dropThickness={1} splashes={false} />
      </TickerCtx.Provider>,
    );

    act(draw);
    expect(linesTo).toHaveBeenCalled();
    expect(ellipses).not.toHaveBeenCalled();

    const baselineLineWidth = ctx.lineWidth;
    const baseLineFrom = movesTo.mock.calls[0];
    const baseLineTo = linesTo.mock.calls[0];
    const baseDy = Math.abs(baseLineTo[1] - baseLineFrom[1]);

    // 2. Custom dropLength=2 and dropThickness=2
    rerender(
      <TickerCtx.Provider value={ticker}>
        <Rain intensity={0.5} dropLength={2} dropThickness={2} splashes={false} />
      </TickerCtx.Provider>,
    );

    linesTo.mockClear();
    movesTo.mockClear();
    act(draw);

    const thickLineWidth = ctx.lineWidth;
    expect(thickLineWidth).toBeCloseTo(baselineLineWidth * 2, 3);

    const longLineFrom = movesTo.mock.calls[0];
    const longLineTo = linesTo.mock.calls[0];
    const longDy = Math.abs(longLineTo[1] - longLineFrom[1]);
    expect(longDy).toBeCloseTo(baseDy * 2, 3);

    // 3. Optional bottom-edge splashes
    rerender(
      <TickerCtx.Provider value={ticker}>
        <Rain intensity={0.5} splashes={true} />
      </TickerCtx.Provider>,
    );

    // Advance frames until raindrops hit the bottom edge (height = 600)
    ellipses.mockClear();
    frame.dt = 0.08;
    for (let f = 0; f < 15; f++) {
      act(draw);
    }
    expect(ellipses).toHaveBeenCalled();
    const splashY = ellipses.mock.calls[0][1];
    expect(splashY).toBe(frame.height);
  });

  it.each([-45, 45])('places Rain splashes at the actual edge crossing for angle %s, without skipping the initial motion', (angle) => {
    const { ctx, frame, random, ticker, draw } = createEffectHarness(1);
    random.mockImplementation(() => 0.5);
    frame.height = 100;
    const ellipses = vi.spyOn(ctx, 'ellipse');
    const arcs = vi.spyOn(ctx, 'arc');
    render(
      <TickerCtx.Provider value={ticker}>
        <Rain intensity={1} angle={angle} splashes />
      </TickerCtx.Provider>,
    );
    act(draw);
    frame.dt = 0.1;
    act(draw);

    expect(ellipses).toHaveBeenCalledTimes(1);
    const expectedX = frame.width / 2 + Math.sign(angle) * 50;
    expect(ellipses.mock.calls[0][0]).toBeCloseTo(expectedX, 3);
    const elapsed = 0.1 - 50 / (875 * Math.cos(Math.PI / 4));
    const progress = elapsed / 0.39;
    const radius = 5.1 * (0.25 + 1.9 * (1 - (1 - progress) ** 3));
    expect(ellipses.mock.calls[0][2]).toBeCloseTo(radius, 3);
    expect(arcs).toHaveBeenCalledTimes(5);
  });

  it('animates varied Rain splash droplets rising and falling while the ripple expands and fades', () => {
    const { ctx, frame, random, ticker, draw } = createEffectHarness(1);
    random.mockImplementation(() => 0.5);
    frame.height = 100;
    const ellipses = vi.spyOn(ctx, 'ellipse');
    const arcs = vi.spyOn(ctx, 'arc');
    const fills = vi.spyOn(ctx, 'fill');
    const alphas: number[] = [];
    vi.spyOn(ctx, 'stroke').mockImplementation(() => { alphas.push(ctx.globalAlpha); });
    const scene = (intensity: number) => (
      <TickerCtx.Provider value={ticker}><Rain intensity={intensity} angle={0} splashes /></TickerCtx.Provider>
    );
    const { rerender } = render(scene(1));
    act(draw);
    frame.dt = 0.06;
    act(draw);
    rerender(scene(0));

    const sample = (dt: number) => {
      ellipses.mockClear();
      arcs.mockClear();
      fills.mockClear();
      alphas.length = 0;
      frame.dt = dt;
      act(draw);
      return { ripple: ellipses.mock.calls[0], droplets: [...arcs.mock.calls], alpha: alphas[0] };
    };
    const rising = sample(0.08);
    const peak = sample(0.1);
    const falling = sample(0.1);
    expect(rising.droplets).toHaveLength(5);
    expect(peak.droplets).toHaveLength(5);
    expect(falling.droplets).toHaveLength(5);
    expect(new Set(peak.droplets.map((drop) => drop[1])).size).toBe(5);
    expect(peak.droplets[0][1]).toBeLessThan(rising.droplets[0][1]);
    expect(falling.droplets[0][1]).toBeGreaterThan(peak.droplets[0][1]);
    expect(peak.ripple[2]).toBeGreaterThan(rising.ripple[2]);
    expect(falling.ripple[2]).toBeGreaterThan(peak.ripple[2]);
    expect(falling.ripple[3]).toBeLessThan(falling.ripple[2] * 0.25);
    expect(falling.alpha).toBeLessThan(peak.alpha);
    expect(fills).toHaveBeenCalledTimes(5);

    expect(sample(0.1).ripple).toBeDefined();
    expect(sample(0.02).ripple).toBeUndefined();
    expect(arcs).not.toHaveBeenCalled();
    expect(ctx.globalAlpha).toBe(1);
  });

  it('redraws Rain splashes at dt=0 without advancing motion or consuming randomness', () => {
    const { ctx, frame, random, ticker, draw } = createEffectHarness(1);
    random.mockImplementation(() => 0.5);
    frame.height = 100;
    const ellipses = vi.spyOn(ctx, 'ellipse');
    const arcs = vi.spyOn(ctx, 'arc');
    render(<TickerCtx.Provider value={ticker}><Rain intensity={1} angle={0} splashes /></TickerCtx.Provider>);
    act(draw);
    frame.dt = 0.06;
    act(draw);
    const ripple = [...ellipses.mock.calls];
    const droplets = [...arcs.mock.calls];
    expect(droplets.length).toBeGreaterThan(0);
    random.mockClear();
    frame.dt = 0;
    for (let i = 0; i < 2; i++) {
      ellipses.mockClear();
      arcs.mockClear();
      act(draw);
      expect(ellipses.mock.calls).toEqual(ripple);
      expect(arcs.mock.calls).toEqual(droplets);
    }
    expect(random).not.toHaveBeenCalled();
  });

  it.each([0, 1])('skips Rain splashes for offscreen edge crossings (x seed %s)', (xSeed) => {
    const { ctx, frame, random, ticker, draw } = createEffectHarness(1);
    const values = [0.5, xSeed, 0.5];
    let index = 0;
    random.mockImplementation(() => values[index++ % values.length]);
    frame.height = 100;
    const ellipses = vi.spyOn(ctx, 'ellipse');
    const arcs = vi.spyOn(ctx, 'arc');
    render(<TickerCtx.Provider value={ticker}><Rain intensity={1} angle={0} splashes /></TickerCtx.Provider>);
    act(draw);
    frame.dt = 0.1;
    act(draw);
    expect(ellipses).not.toHaveBeenCalled();
    expect(arcs).not.toHaveBeenCalled();
  });

  it('keeps live Rain splashes anchored to the bottom edge after resize', () => {
    const { ctx, frame, random, ticker, draw } = createEffectHarness(1);
    random.mockImplementation(() => 0.5);
    frame.height = 100;
    const ellipses = vi.spyOn(ctx, 'ellipse');
    const arcs = vi.spyOn(ctx, 'arc');
    render(<TickerCtx.Provider value={ticker}><Rain intensity={1} angle={0} splashes /></TickerCtx.Provider>);
    act(draw);
    frame.dt = 0.06;
    act(draw);
    const droplets = [...arcs.mock.calls];
    ellipses.mockClear();
    arcs.mockClear();
    random.mockClear();
    frame.height = 200;
    frame.dt = 0;
    act(draw);
    expect(ellipses.mock.calls[0][1]).toBe(200);
    arcs.mock.calls.forEach((drop, i) => {
      expect(drop[0]).toBe(droplets[i][0]);
      expect(drop[1]).toBeCloseTo(droplets[i][1] + 100);
    });
    expect(random).not.toHaveBeenCalled();
  });

  it('lets disabled Rain splashes expire instead of replaying stale impacts when re-enabled', () => {
    const { ctx, frame, random, ticker, draw } = createEffectHarness(1);
    random.mockImplementation(() => 0.5);
    frame.height = 100;
    const ellipses = vi.spyOn(ctx, 'ellipse');
    const scene = (intensity: number, splashes: boolean) => (
      <TickerCtx.Provider value={ticker}><Rain intensity={intensity} angle={0} splashes={splashes} /></TickerCtx.Provider>
    );
    const { rerender } = render(scene(1, true));
    act(draw);
    frame.dt = 0.06;
    act(draw);
    expect(ellipses).toHaveBeenCalled();
    rerender(scene(0, false));
    frame.dt = 0.1;
    for (let i = 0; i < 5; i++) act(draw);
    rerender(scene(0, true));
    ellipses.mockClear();
    frame.dt = 0;
    act(draw);
    expect(ellipses).not.toHaveBeenCalled();
  });

  it('bounds Rain splash drawing even when hundreds of raindrops hit the edge together', () => {
    const { ctx, frame, random, ticker, draw } = createEffectHarness(600);
    random.mockImplementation(() => 0.5);
    frame.height = 100;
    const ellipses = vi.spyOn(ctx, 'ellipse');
    const arcs = vi.spyOn(ctx, 'arc');
    render(<TickerCtx.Provider value={ticker}><Rain intensity={1} angle={0} splashes /></TickerCtx.Provider>);
    act(draw);
    frame.dt = 0.1;
    act(draw);
    expect(ellipses).toHaveBeenCalledTimes(128);
    expect(arcs).toHaveBeenCalledTimes(128 * 5);
  });

  it('keeps active Rain splashes alive instead of overwriting them when the pool is full', () => {
    const { ctx, frame, random, ticker, draw } = createEffectHarness(64);
    let index = 0;
    random.mockImplementation(() => {
      const particle = Math.floor(index / 3);
      const field = index++ % 3;
      if (particle >= 64 || field === 0) return 0.5;
      if (field === 1) return particle < 32 ? 0.25 : 0.75;
      return particle < 32 ? 0.5 : 0;
    });
    frame.height = 100;
    const ellipses = vi.spyOn(ctx, 'ellipse');
    render(<TickerCtx.Provider value={ticker}><Rain intensity={1} angle={0} splashes /></TickerCtx.Provider>);
    act(draw);
    frame.dt = 0.06;
    act(draw);
    expect(ellipses).toHaveBeenCalledTimes(32);
    const positions = ellipses.mock.calls.map((ripple) => ripple[0]);
    frame.dt = 0.1;
    act(draw);
    ellipses.mockClear();
    frame.dt = 0.05;
    act(draw);
    expect(ellipses.mock.calls.map((ripple) => ripple[0])).toEqual(positions);
  });
});
