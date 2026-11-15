import React from 'react';
import { act, render } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Fog, Rain, Snow, WeatherCanvas } from 'react-weather-effects';
import {
  createSeededRandom,
  SchedulerCtx,
  TickerCtx,
  type DrawFn,
  type FrameScheduler,
  type FrameState,
  type TickerContext,
} from '@react-weather-effects/core';

const effects = [
  { name: 'Rain', render: (value: number, duration = 400) => (
    <Rain intensity={value} transitionDuration={duration} angle={0} speed={0} />
  ) },
  { name: 'Snow', render: (value: number, duration = 400) => (
    <Snow intensity={value} transitionDuration={duration} speed={0} wobble={false} />
  ) },
  { name: 'Fog', render: (value: number, duration = 400) => (
    <Fog density={value} transitionDuration={duration} speed={0} layers={1} />
  ) },
];

interface Sample {
  alpha: number;
  args: unknown[];
}

function createEffectHarness() {
  const ctx = document.createElement('canvas').getContext('2d')!;
  const random = vi.fn(createSeededRandom('transitions'));
  const frame: FrameState = {
    ctx, random, dt: 0, isAnimating: true, timestamp: 0, width: 800, height: 600, dpr: 1,
    budget: { maxParticles: 4, quality: 'medium', dpr: 1 },
    wind: { x: 0, y: 0 }, pointer: null,
  };
  const samples: Sample[] = [];
  let position: number[] = [];
  vi.spyOn(ctx, 'moveTo').mockImplementation((x, y) => { position = [x, y]; });
  vi.spyOn(ctx, 'stroke').mockImplementation(() => {
    samples.push({ alpha: ctx.globalAlpha, args: position });
  });
  vi.spyOn(ctx, 'drawImage').mockImplementation((...args) => {
    samples.push({ alpha: ctx.globalAlpha, args });
  });
  const callbacks = new Set<DrawFn>();
  const ticker: TickerContext = {
    getBudget: () => frame.budget,
    invalidate: vi.fn(),
    trackAsset: () => () => {},
    register: vi.fn((_layer, callback) => {
      callbacks.add(callback);
      return () => { callbacks.delete(callback); };
    }),
  };
  const draw = (dt = 0) => {
    frame.dt = dt;
    frame.timestamp += dt * 1000;
    samples.length = 0;
    act(() => { for (const callback of callbacks) callback(frame); });
    return [...samples];
  };
  return { ctx, frame, random, ticker, callbacks, draw };
}

class TestManualScheduler implements FrameScheduler {
  private nextId = 1;
  private queue = new Map<number, (timestamp: number) => void>();

  request(callback: (timestamp: number) => void): number {
    const id = this.nextId++;
    this.queue.set(id, callback);
    return id;
  }

  cancel(id: number): void {
    this.queue.delete(id);
  }

  step(timestamp: number): void {
    const callbacks = [...this.queue.values()];
    this.queue.clear();
    for (const callback of callbacks) callback(timestamp);
  }

  get pendingCount(): number {
    return this.queue.size;
  }
}

describe('Opt-in scene transitions', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each(effects)('fades $name out and back in without reseeding or reregistering', (effect) => {
    const { ctx, random, ticker, callbacks, draw } = createEffectHarness();
    const scene = (value: number) => (
      <TickerCtx.Provider value={ticker}>{effect.render(value)}</TickerCtx.Provider>
    );
    const { rerender, unmount } = render(scene(1));
    const initial = draw();
    expect(initial.length).toBeGreaterThan(0);
    random.mockClear();

    rerender(scene(0));
    expect(draw()).toEqual(initial);
    expect(draw()).toEqual(initial);
    for (const progress of [0.25, 0.5, 0.75]) {
      const samples = draw(0.1);
      expect(samples).toHaveLength(initial.length);
      samples.forEach((sample, i) => {
        expect(sample.args).toEqual(initial[i].args);
        expect(sample.alpha).toBeCloseTo(initial[i].alpha * (1 - progress));
      });
    }
    expect(draw(0.1)).toEqual([]);
    expect(draw(0.1)).toEqual([]);

    rerender(scene(1));
    expect(draw()).toEqual([]);
    for (const progress of [0.25, 0.5, 0.75, 1]) {
      const samples = draw(0.1);
      expect(samples).toHaveLength(initial.length);
      samples.forEach((sample, i) => {
        expect(sample.args).toEqual(initial[i].args);
        expect(sample.alpha).toBeCloseTo(initial[i].alpha * progress);
      });
    }
    expect(random).not.toHaveBeenCalled();
    expect(ticker.register).toHaveBeenCalledTimes(1);
    expect(ctx.globalAlpha).toBe(1);
    unmount();
    expect(callbacks.size).toBe(0);
  });

  it.each(effects)('retargets an interrupted $name fade from its current visibility', (effect) => {
    const { ticker, draw } = createEffectHarness();
    const scene = (value: number) => (
      <TickerCtx.Provider value={ticker}>{effect.render(value)}</TickerCtx.Provider>
    );
    const { rerender } = render(scene(1));
    const initial = draw();
    rerender(scene(0));
    const interrupted = draw(0.1);
    rerender(scene(1));
    expect(draw()).toEqual(interrupted);
    const resumed = draw(0.1);
    resumed.forEach((sample, i) => {
      expect(sample.alpha).toBeCloseTo(initial[i].alpha * 0.8125);
    });
    draw(0.1);
    draw(0.1);
    expect(draw(0.1)).toEqual(initial);
  });

  it.each(effects.slice(0, 2))('fades only added or removed $name particles when intensity changes', (effect) => {
    const { random, ticker, draw } = createEffectHarness();
    const scene = (value: number) => (
      <TickerCtx.Provider value={ticker}>{effect.render(value)}</TickerCtx.Provider>
    );
    const { rerender } = render(scene(0.5));
    const original = draw();
    rerender(scene(1));
    expect(draw()).toEqual(original);
    draw(0.1);
    const halfway = draw(0.1);
    draw(0.1);
    const full = draw(0.1);
    expect(full).toHaveLength(original.length * 2);
    halfway.forEach((sample, i) => {
      expect(sample.args).toEqual(full[i].args);
      expect(sample.alpha).toBeCloseTo(full[i].alpha * (i < original.length ? 1 : 0.5));
    });
    random.mockClear();

    rerender(scene(0.25));
    expect(draw()).toEqual(full);
    draw(0.1);
    const thinning = draw(0.1);
    thinning.forEach((sample, i) => {
      expect(sample.alpha).toBeCloseTo(full[i].alpha * (i < full.length / 4 ? 1 : 0.5));
    });
    draw(0.1);
    expect(draw(0.1)).toEqual(full.slice(0, full.length / 4));
    expect(random).not.toHaveBeenCalled();
  });

  it('interpolates Fog density without replacing its texture or wisps', () => {
    const { random, ticker, draw } = createEffectHarness();
    const scene = (value: number) => (
      <TickerCtx.Provider value={ticker}>{effects[2].render(value)}</TickerCtx.Provider>
    );
    const { rerender } = render(scene(0.5));
    const original = draw();
    random.mockClear();
    rerender(scene(1));
    draw(0.1);
    const halfway = draw(0.1);
    halfway.forEach((sample, i) => {
      expect(sample.args).toEqual(original[i].args);
      expect(sample.alpha).toBeCloseTo(original[i].alpha * 1.5);
    });
    draw(0.1);
    draw(0.1).forEach((sample, i) => {
      expect(sample.alpha).toBeCloseTo(original[i].alpha * 2);
    });
    expect(random).not.toHaveBeenCalled();
  });

  it.each(effects)('applies zero or invalid $name durations immediately, including mid-fade', (effect) => {
    const { ticker, draw } = createEffectHarness();
    const scene = (value: number, duration: number) => (
      <TickerCtx.Provider value={ticker}>{effect.render(value, duration)}</TickerCtx.Provider>
    );
    const { rerender } = render(scene(1, 400));
    const initial = draw();
    for (const duration of [0, -1, NaN, Infinity]) {
      rerender(scene(0, 400));
      expect(draw(0.1).length).toBeGreaterThan(0);
      rerender(scene(0, duration));
      expect(draw()).toEqual([]);
      rerender(scene(1, duration));
      expect(draw()).toEqual(initial);
    }
  });

  it.each(effects.slice(0, 2))('preserves $name particles while growing capacity and respects downgraded caps during fades', (effect) => {
    const { frame, random, ticker, draw } = createEffectHarness();
    render(<TickerCtx.Provider value={ticker}>{effect.render(1)}</TickerCtx.Provider>);
    const initial = draw();
    frame.budget = { ...frame.budget, maxParticles: 8 };
    expect(draw()).toEqual(initial);
    const growing = draw(0.1);
    expect(growing).toHaveLength(initial.length * 2);
    expect(growing.slice(0, initial.length)).toEqual(initial);
    random.mockClear();

    frame.budget = { ...frame.budget, maxParticles: 2 };
    expect(draw()).toEqual(initial.slice(0, initial.length / 2));
    frame.budget = { ...frame.budget, maxParticles: 8 };
    expect(draw()).toEqual(initial.slice(0, initial.length / 2));
    expect(draw(0.1)).toHaveLength(initial.length * 2);
    expect(random).not.toHaveBeenCalled();
  });

  it.each(['static', 'paused', 'reduced-motion'])('updates a %s scene immediately without scheduling animation', async (mode) => {
    const scheduler = new TestManualScheduler();
    if (mode === 'reduced-motion') {
      const matchMedia = window.matchMedia;
      vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({
        ...matchMedia(query), matches: query === '(prefers-reduced-motion: reduce)',
      }));
    }
    const scene = (value: number) => (
      <SchedulerCtx.Provider value={scheduler}>
        <WeatherCanvas
          mode="contained" quality="low" seed="static-transitions"
          reducedMotion={mode === 'static' ? 'static' : mode === 'paused' ? 'animated' : 'auto'}
          paused={mode === 'paused'}
        >
          {effects.map((effect) => <React.Fragment key={effect.name}>{effect.render(value)}</React.Fragment>)}
        </WeatherCanvas>
      </SchedulerCtx.Provider>
    );
    const { container, rerender } = render(scene(1));
    const ctx = container.querySelector('canvas')!.getContext('2d')!;
    const strokes = vi.spyOn(ctx, 'stroke');
    const images = vi.spyOn(ctx, 'drawImage');
    await act(async () => { await Promise.resolve(); });
    expect(strokes).toHaveBeenCalled();
    expect(images).toHaveBeenCalled();
    strokes.mockClear();
    images.mockClear();

    rerender(scene(0));
    await act(async () => { await Promise.resolve(); });
    expect(strokes).not.toHaveBeenCalled();
    expect(images).not.toHaveBeenCalled();
    expect(scheduler.pendingCount).toBe(0);

    rerender(scene(1));
    await act(async () => { await Promise.resolve(); });
    expect(strokes).toHaveBeenCalledTimes(150 * 3);
    expect(images).toHaveBeenCalledTimes(153);
    expect(scheduler.pendingCount).toBe(0);
  });

  it('crossfades a composed scene on the existing canvas animation loop', () => {
    const scheduler = new TestManualScheduler();
    const scene = (value: number) => (
      <SchedulerCtx.Provider value={scheduler}>
        <WeatherCanvas mode="contained" quality="low" reducedMotion="animated">
          {effects.map((effect) => <React.Fragment key={effect.name}>{effect.render(value)}</React.Fragment>)}
        </WeatherCanvas>
      </SchedulerCtx.Provider>
    );
    const { container, rerender, unmount } = render(scene(1));
    const canvas = container.querySelector('canvas')!;
    const ctx = canvas.getContext('2d')!;
    const strokes = vi.spyOn(ctx, 'stroke');
    const images = vi.spyOn(ctx, 'drawImage');
    act(() => { scheduler.step(0); });
    strokes.mockClear();
    images.mockClear();
    rerender(scene(0));
    act(() => { scheduler.step(100); });
    expect(strokes).toHaveBeenCalledTimes(150 * 3);
    expect(images).toHaveBeenCalledTimes(153);
    expect(scheduler.pendingCount).toBe(1);
    act(() => { scheduler.step(200); scheduler.step(300); });
    strokes.mockClear();
    images.mockClear();
    act(() => { scheduler.step(400); });
    expect(strokes).not.toHaveBeenCalled();
    expect(images).not.toHaveBeenCalled();
    expect(container.querySelector('canvas')).toBe(canvas);
    unmount();
    expect(scheduler.pendingCount).toBe(0);
  });

  it('keeps transition-enabled effects safe to render on the server', () => {
    const contexts = vi.spyOn(HTMLCanvasElement.prototype, 'getContext');
    expect(() => renderToString(
      <WeatherCanvas>{effects.map((effect) => (
        <React.Fragment key={effect.name}>{effect.render(1)}</React.Fragment>
      ))}</WeatherCanvas>,
    )).not.toThrow();
    expect(contexts).not.toHaveBeenCalled();
  });
});
