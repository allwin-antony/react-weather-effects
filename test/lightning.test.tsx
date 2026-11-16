import React from 'react';
import { render, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WeatherCanvas } from '../packages/core/src/WeatherCanvas';
import { Rain } from '../packages/effects/src/Rain';
import { Fog } from '../packages/effects/src/Fog';
import { Lightning } from '../packages/effects/src/Lightning';
import {
  SchedulerCtx,
  TickerCtx,
  type FrameScheduler,
  type FrameState,
  type DrawFn,
  type TickerContext,
  LAYER,
  createSeededRandom,
} from '../packages/core/src';

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

function createEffectHarness() {
  const canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = 600;
  const ctx = canvas.getContext('2d')!;
  const random = vi.fn(createSeededRandom('lightning-test-harness'));
  const frame: FrameState = {
    ctx,
    random,
    dt: 0,
    isAnimating: true,
    timestamp: 0,
    width: 800,
    height: 600,
    dpr: 1,
    budget: { maxParticles: 100, quality: 'medium', dpr: 1 },
    wind: { x: 0, y: 0 },
    pointer: null,
  };
  const callbacks = new Map<DrawFn, number>();
  const ticker: TickerContext = {
    getBudget: () => frame.budget,
    invalidate: vi.fn(),
    trackAsset: () => () => {},
    register: (layer: number, draw: DrawFn) => {
      callbacks.set(draw, layer);
      return () => {
        callbacks.delete(draw);
      };
    },
  };
  const draw = () => {
    if (frame.isAnimating) frame.timestamp += frame.dt * 1000;
    for (const [callback] of [...callbacks].sort((a, b) => a[1] - b[1])) {
      callback(frame);
    }
  };
  return { ctx, frame, random, ticker, draw, callbacks };
}

describe('Lightning Effect', () => {
  let scheduler: TestManualScheduler;

  beforeEach(() => {
    scheduler = new TestManualScheduler();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('throws helpful error if Lightning is used outside WeatherCanvas', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      render(<Lightning />);
    }).toThrow('<Lightning /> must be used inside <WeatherCanvas>');

    spy.mockRestore();
  });

  it('draws procedural lightning bolt strokes on canvas', () => {
    const { container } = render(
      <SchedulerCtx.Provider value={scheduler}>
        <WeatherCanvas mode="fullscreen" reducedMotion="animated">
          <Lightning frequency="frequent" color="rgba(200, 220, 255, 0.9)" />
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

  it('supports configurable color, brightness, and frequency', () => {
    const { ctx, frame, ticker, draw } = createEffectHarness();
    let capturedStrokeStyles: CanvasRenderingContext2D['strokeStyle'][] = [];
    const strokeSpy = vi.spyOn(ctx, 'stroke').mockImplementation(() => {
      capturedStrokeStyles.push(ctx.strokeStyle);
    });

    const { rerender } = render(
      <TickerCtx.Provider value={ticker}>
        <Lightning
          frequency="frequent"
          color="rgb(255, 200, 50)"
          brightness={1.5}
        />
      </TickerCtx.Provider>,
    );

    ctx.strokeStyle = 'rgb(255, 200, 50)';
    const expectedColor = ctx.strokeStyle;

    frame.dt = 0.05;
    act(draw);

    expect(strokeSpy).toHaveBeenCalled();
    expect(capturedStrokeStyles).toContain(expectedColor);

    // Disabling frequency stops strikes
    rerender(
      <TickerCtx.Provider value={ticker}>
        <Lightning frequency={0} />
      </TickerCtx.Provider>,
    );
    strokeSpy.mockClear();
    frame.dt = 0.5;
    act(draw);
    expect(strokeSpy).not.toHaveBeenCalled();
  });

  it('provides deterministic bolt generation when given a seed', () => {
    const harness1 = createEffectHarness();
    const harness2 = createEffectHarness();

    const lineToSpy1 = vi.spyOn(harness1.ctx, 'lineTo');
    const lineToSpy2 = vi.spyOn(harness2.ctx, 'lineTo');

    render(
      <TickerCtx.Provider value={harness1.ticker}>
        <Lightning seed="storm-seed-42" frequency="frequent" />
      </TickerCtx.Provider>,
    );
    render(
      <TickerCtx.Provider value={harness2.ticker}>
        <Lightning seed="storm-seed-42" frequency="frequent" />
      </TickerCtx.Provider>,
    );

    harness1.frame.dt = 0.05;
    harness2.frame.dt = 0.05;
    act(harness1.draw);
    act(harness2.draw);

    expect(lineToSpy1).toHaveBeenCalled();
    expect(lineToSpy2).toHaveBeenCalled();
    // Coordinates match exactly for identical seeds
    expect(lineToSpy1.mock.calls).toEqual(lineToSpy2.mock.calls);
  });

  it('preserves seeded geometry and strike timing across visual prop updates', () => {
    const first = createEffectHarness();
    const second = createEffectHarness();
    const lines1 = vi.spyOn(first.ctx, 'lineTo');
    const lines2 = vi.spyOn(second.ctx, 'lineTo');
    const { rerender } = render(
      <TickerCtx.Provider value={first.ticker}>
        <Lightning seed="live-settings" frequency="frequent" />
      </TickerCtx.Provider>,
    );
    render(
      <TickerCtx.Provider value={second.ticker}>
        <Lightning seed="live-settings" frequency="frequent" />
      </TickerCtx.Provider>,
    );
    act(first.draw);
    act(second.draw);
    expect(lines1.mock.calls).toEqual(lines2.mock.calls);

    rerender(
      <TickerCtx.Provider value={first.ticker}>
        <Lightning seed="live-settings" frequency="frequent" color="gold" brightness={0.7} />
      </TickerCtx.Provider>,
    );
    first.frame.dt = second.frame.dt = 0.05;
    for (let i = 0; i < 160; i++) {
      lines1.mockClear();
      lines2.mockClear();
      act(first.draw);
      act(second.draw);
      expect(lines1.mock.calls).toEqual(lines2.mock.calls);
    }
    expect(first.random).not.toHaveBeenCalled();
    expect(second.random).not.toHaveBeenCalled();
  });

  it('uses the shared canvas PRNG without consuming randomness on zero-delta redraws', () => {
    const first = createEffectHarness();
    const second = createEffectHarness();
    const lines1 = vi.spyOn(first.ctx, 'lineTo');
    const lines2 = vi.spyOn(second.ctx, 'lineTo');
    render(<TickerCtx.Provider value={first.ticker}><Lightning /></TickerCtx.Provider>);
    render(<TickerCtx.Provider value={second.ticker}><Lightning /></TickerCtx.Provider>);
    act(first.draw);
    act(second.draw);
    expect(first.random).toHaveBeenCalled();
    expect(lines1.mock.calls).toEqual(lines2.mock.calls);
    const geometry = [...lines1.mock.calls];

    lines1.mockClear();
    first.random.mockClear();
    act(first.draw);
    expect(lines1.mock.calls).toEqual(geometry);
    expect(first.random).not.toHaveBeenCalled();
  });

  it('freezes the existing bolt opacity and geometry when paused', () => {
    const { ctx, frame, ticker, draw, random } = createEffectHarness();
    const alphas: number[] = [];
    vi.spyOn(ctx, 'stroke').mockImplementation(() => { alphas.push(ctx.globalAlpha); });
    const lines = vi.spyOn(ctx, 'lineTo');
    render(<TickerCtx.Provider value={ticker}><Lightning /></TickerCtx.Provider>);
    frame.dt = 0.08;
    act(draw);
    const geometry = [...lines.mock.calls];
    const opacity = [...alphas];

    frame.isAnimating = false;
    frame.dt = 0;
    alphas.length = 0;
    lines.mockClear();
    random.mockClear();
    act(draw);
    expect(lines.mock.calls).toEqual(geometry);
    expect(alphas).toEqual(opacity);
    expect(random).not.toHaveBeenCalled();
  });

  it('scales procedural detail with quality and registers in the foreground', () => {
    const counts: number[] = [];
    for (const quality of ['low', 'medium', 'high'] as const) {
      const { ctx, frame, ticker, draw, callbacks } = createEffectHarness();
      frame.budget = { ...frame.budget, quality };
      const lines = vi.spyOn(ctx, 'lineTo');
      const strokes = vi.spyOn(ctx, 'stroke');
      render(<TickerCtx.Provider value={ticker}><Lightning seed="quality" /></TickerCtx.Provider>);
      expect([...callbacks.values()]).toEqual([LAYER.FOREGROUND]);
      act(draw);
      // Low quality skips wide atmospheric glow pass (6 strokes), medium/high have all 4 passes (8 strokes)
      const expectedStrokes = quality === 'low' ? 6 : 8;
      expect(strokes).toHaveBeenCalledTimes(expectedStrokes);
      counts.push(lines.mock.calls.length);
    }
    expect(counts[0]).toBeLessThan(counts[1]);
    expect(counts[1]).toBeLessThan(counts[2]);
  });

  it('sizes bolts to small contained canvases instead of a 100px minimum', () => {
    const { ctx, frame, ticker, draw, random } = createEffectHarness();
    frame.width = 40;
    frame.height = 60;
    random.mockReturnValue(0.5);
    const starts = vi.spyOn(ctx, 'moveTo');
    const ends = vi.spyOn(ctx, 'lineTo');
    render(<TickerCtx.Provider value={ticker}><Lightning /></TickerCtx.Provider>);
    act(draw);
    expect(starts.mock.calls[0][0]).toBeGreaterThanOrEqual(0);
    expect(starts.mock.calls[0][0]).toBeLessThan(frame.width);
    expect(Math.max(...ends.mock.calls.map(([, y]) => y))).toBeLessThanOrEqual(frame.height);
  });

  it.each([0, -1, Number.NaN, Infinity])('disables strikes for invalid frequency %s', (frequency) => {
    const { ctx, ticker, draw, random } = createEffectHarness();
    const strokes = vi.spyOn(ctx, 'stroke');
    const flashes = vi.spyOn(ctx, 'fillRect');
    render(<TickerCtx.Provider value={ticker}><Lightning frequency={frequency} flash /></TickerCtx.Provider>);
    act(draw);
    expect(strokes).not.toHaveBeenCalled();
    expect(flashes).not.toHaveBeenCalled();
    expect(random).not.toHaveBeenCalled();
  });

  it.each(['stroke', 'fillRect'] as const)('restores drawing state if %s throws', (method) => {
    const { ctx, ticker, draw } = createEffectHarness();
    ctx.globalAlpha = 0.25;
    ctx.lineWidth = 7;
    const restore = vi.spyOn(ctx, 'restore');
    vi.spyOn(ctx, method).mockImplementationOnce(() => { throw new Error('draw failed'); });
    render(<TickerCtx.Provider value={ticker}><Lightning flash /></TickerCtx.Provider>);
    expect(() => act(draw)).toThrow('draw failed');
    expect(ctx.globalAlpha).toBe(0.25);
    expect(ctx.lineWidth).toBe(7);
    expect(restore).toHaveBeenCalledTimes(method === 'stroke' ? 1 : 2);
  });

  it('composes independently with Rain and Fog inside WeatherCanvas', () => {
    const { container } = render(
      <SchedulerCtx.Provider value={scheduler}>
        <WeatherCanvas mode="fullscreen" reducedMotion="animated">
          <Fog density={0.4} />
          <Rain intensity={0.8} />
          <Lightning frequency="occasional" />
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

    expect(container.querySelectorAll('canvas')).toHaveLength(1);
    expect(canvas.getAttribute('aria-hidden')).toBe('true');
    expect(canvas.style.pointerEvents).toBe('none');
    expect(strokeSpy).toHaveBeenCalled();
    expect(drawImageSpy).toHaveBeenCalled();
    expect(drawImageSpy.mock.invocationCallOrder[0]).toBeLessThan(strokeSpy.mock.invocationCallOrder[0]);
  });

  describe('Accessibility & Photosensitivity Safeguards', () => {
    it('does NOT render screen-wide flash by default (opt-in only)', () => {
      const { ctx, frame, ticker, draw } = createEffectHarness();
      const fillRectSpy = vi.spyOn(ctx, 'fillRect');

      render(
        <TickerCtx.Provider value={ticker}>
          <Lightning frequency="frequent" />
        </TickerCtx.Provider>,
      );

      frame.dt = 0.05;
      act(draw);

      // fillRect is used only for screen flash; without opt-in it must not be called
      expect(fillRectSpy).not.toHaveBeenCalled();
    });

    it('renders screen-wide flash when explicitly opted-in via flash={true}', () => {
      const { ctx, frame, ticker, draw } = createEffectHarness();
      const fillRectSpy = vi.spyOn(ctx, 'fillRect');

      render(
        <TickerCtx.Provider value={ticker}>
          <Lightning frequency="frequent" flash={true} flashIntensity={0.5} />
        </TickerCtx.Provider>,
      );

      frame.dt = 0.05;
      act(draw);

      expect(fillRectSpy).toHaveBeenCalledWith(0, 0, 800, 600);
    });

    it('supports the screenFlash opt-in alias', () => {
      const { ctx, ticker, draw } = createEffectHarness();
      const flashes = vi.spyOn(ctx, 'fillRect');
      render(<TickerCtx.Provider value={ticker}><Lightning screenFlash /></TickerCtx.Provider>);
      act(draw);
      expect(flashes).toHaveBeenCalledWith(0, 0, 800, 600);
    });

    it.each([
      { flash: false },
      { flash: true, reducedMotion: true },
    ])('cancels an active flash immediately when settings change to %j', (settings) => {
      const { ctx, ticker, draw } = createEffectHarness();
      const flashes = vi.spyOn(ctx, 'fillRect');
      const { rerender } = render(
        <TickerCtx.Provider value={ticker}><Lightning flash /></TickerCtx.Provider>,
      );
      act(draw);
      expect(flashes).toHaveBeenCalled();

      rerender(<TickerCtx.Provider value={ticker}><Lightning {...settings} /></TickerCtx.Provider>);
      flashes.mockClear();
      act(draw);
      expect(flashes).not.toHaveBeenCalled();

      rerender(<TickerCtx.Provider value={ticker}><Lightning flash /></TickerCtx.Provider>);
      act(draw);
      expect(flashes).not.toHaveBeenCalled();
    });

    it('suppresses static flashes and does not revive a cancelled flash on resume', () => {
      const { ctx, frame, ticker, draw } = createEffectHarness();
      const flashes = vi.spyOn(ctx, 'fillRect');
      frame.isAnimating = false;
      render(<TickerCtx.Provider value={ticker}><Lightning flash reducedMotion={false} /></TickerCtx.Provider>);
      act(draw);
      expect(flashes).not.toHaveBeenCalled();

      frame.isAnimating = true;
      act(draw);
      expect(flashes).not.toHaveBeenCalled();
    });

    it('does not revive an animated flash after pausing and resuming', () => {
      const { ctx, frame, ticker, draw } = createEffectHarness();
      const flashes = vi.spyOn(ctx, 'fillRect');
      render(<TickerCtx.Provider value={ticker}><Lightning flash /></TickerCtx.Provider>);
      act(draw);
      expect(flashes).toHaveBeenCalled();
      flashes.mockClear();

      frame.isAnimating = false;
      act(draw);
      expect(flashes).not.toHaveBeenCalled();
      frame.isAnimating = true;
      act(draw);
      expect(flashes).not.toHaveBeenCalled();
    });

    it.each([
      { brightness: Number.NaN },
      { brightness: Infinity },
      { brightness: -1 },
      { flashIntensity: Number.NaN },
      { flashIntensity: Infinity },
      { flashIntensity: -1 },
    ])('does not flash with invalid brightness or intensity %j', (settings) => {
      const { ctx, ticker, draw } = createEffectHarness();
      const flashes = vi.spyOn(ctx, 'fillRect');
      render(<TickerCtx.Provider value={ticker}><Lightning flash {...settings} /></TickerCtx.Provider>);
      act(draw);
      expect(flashes).not.toHaveBeenCalled();
    });

    it('clamps flashIntensity to 0..1 and caps screen flash opacity at 0.6', () => {
      const { ctx, frame, ticker, draw } = createEffectHarness();
      const alphas: number[] = [];
      vi.spyOn(ctx, 'fillRect').mockImplementation(() => { alphas.push(ctx.globalAlpha); });
      const { rerender } = render(
        <TickerCtx.Provider value={ticker}><Lightning flash flashIntensity={2} /></TickerCtx.Provider>,
      );
      frame.dt = 0.06;
      act(draw);
      expect(alphas[0]).toBeCloseTo(0.5);

      rerender(<TickerCtx.Provider value={ticker}><Lightning flash flashIntensity={1} brightness={10} /></TickerCtx.Provider>);
      frame.dt = 0;
      act(draw);
      expect(alphas[1]).toBe(0.6);
    });

    it('suppresses screen-wide flashes in reduced-motion mode even when flash={true}', () => {
      const { ctx, frame, ticker, draw } = createEffectHarness();
      const fillRectSpy = vi.spyOn(ctx, 'fillRect');

      render(
        <TickerCtx.Provider value={ticker}>
          <Lightning
            frequency="frequent"
            flash={true}
            reducedMotion={true}
          />
        </TickerCtx.Provider>,
      );

      frame.dt = 0.05;
      act(draw);

      expect(fillRectSpy).not.toHaveBeenCalled();
    });

    it('suppresses screen-wide flashes when OS prefers reduced motion', () => {
      const matchMedia = window.matchMedia;
      vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({
        ...matchMedia(query),
        matches: query === '(prefers-reduced-motion: reduce)',
      }));

      const { ctx, frame, ticker, draw } = createEffectHarness();
      const fillRectSpy = vi.spyOn(ctx, 'fillRect');

      render(
        <TickerCtx.Provider value={ticker}>
          <Lightning frequency="frequent" flash={true} reducedMotion="auto" />
        </TickerCtx.Provider>,
      );

      frame.dt = 0.05;
      act(draw);

      expect(fillRectSpy).not.toHaveBeenCalled();
    });

    it('cancels active flashes on live OS preference changes and cleans up its listener', () => {
      const addEventListener = vi.fn();
      const removeEventListener = vi.fn();
      const media = {
        ...window.matchMedia('(prefers-reduced-motion: reduce)'),
        matches: false,
        addEventListener,
        removeEventListener,
      };
      vi.spyOn(window, 'matchMedia').mockReturnValue(media);
      const { ctx, ticker, draw } = createEffectHarness();
      const flashes = vi.spyOn(ctx, 'fillRect');
      const { unmount } = render(<TickerCtx.Provider value={ticker}><Lightning flash /></TickerCtx.Provider>);
      act(draw);
      expect(flashes).toHaveBeenCalled();
      expect(addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
      const change = addEventListener.mock.calls[0][1] as () => void;

      flashes.mockClear();
      vi.mocked(ticker.invalidate).mockClear();
      media.matches = true;
      act(change);
      expect(ticker.invalidate).toHaveBeenCalledOnce();
      act(draw);
      expect(flashes).not.toHaveBeenCalled();
      media.matches = false;
      act(change);
      act(draw);
      expect(flashes).not.toHaveBeenCalled();
      unmount();
      expect(removeEventListener).toHaveBeenCalledWith('change', change);
    });

    it('shares the screen flash cooldown across Lightning instances on one canvas', () => {
      const { ctx, ticker, draw } = createEffectHarness();
      const flashes = vi.spyOn(ctx, 'fillRect');
      render(
        <TickerCtx.Provider value={ticker}>
          <Lightning flash seed="first" />
          <Lightning flash seed="second" />
        </TickerCtx.Provider>,
      );
      act(draw);
      expect(flashes).toHaveBeenCalledTimes(1);
    });

    it('preserves the canvas flash cooldown across effect remounts', () => {
      const { ctx, frame, ticker, draw } = createEffectHarness();
      const flashes = vi.spyOn(ctx, 'fillRect');
      const scene = () => <TickerCtx.Provider value={ticker}><Lightning flash /></TickerCtx.Provider>;
      const first = render(scene());
      act(draw);
      expect(flashes).toHaveBeenCalledOnce();
      first.unmount();

      flashes.mockClear();
      frame.timestamp = 1000;
      const second = render(scene());
      act(draw);
      expect(flashes).not.toHaveBeenCalled();
      second.unmount();

      frame.timestamp = 2000;
      render(scene());
      act(draw);
      expect(flashes).toHaveBeenCalledOnce();
    });

    it('keeps screen flash cooldowns independent between canvases', () => {
      for (let i = 0; i < 2; i++) {
        const { ctx, ticker, draw } = createEffectHarness();
        const flashes = vi.spyOn(ctx, 'fillRect');
        render(<TickerCtx.Provider value={ticker}><Lightning flash /></TickerCtx.Provider>);
        act(draw);
        expect(flashes).toHaveBeenCalledOnce();
      }
    });

    it('enforces rate limiting (minimum 2s cooldown) to prevent rapid repeated flashing', () => {
      const { ctx, frame, ticker, draw } = createEffectHarness();
      const fillRectSpy = vi.spyOn(ctx, 'fillRect');

      render(
        <TickerCtx.Provider value={ticker}>
          <Lightning frequency={60} flash={true} />
        </TickerCtx.Provider>,
      );

      // Frame 1: First strike at t=0 triggers screen flash
      frame.dt = 0.05;
      act(draw);
      expect(fillRectSpy).toHaveBeenCalledTimes(1);

      // Frame 2: Active bolt finishes over the next 0.25s
      for (let i = 0; i < 3; i++) {
        frame.dt = 0.08;
        act(draw);
      }

      // Over the next 1.5 seconds, even if strikes trigger, cooldown prevents flashes
      fillRectSpy.mockClear();
      for (let i = 0; i < 15; i++) {
        frame.dt = 0.1;
        act(draw);
      }
      expect(fillRectSpy).not.toHaveBeenCalled();

      // Once simulationTime passes 2.0s cooldown, next strike triggers flash
      for (let i = 0; i < 10; i++) {
        frame.dt = 0.1;
        act(draw);
        if (fillRectSpy.mock.calls.length > 0) break;
      }
      expect(fillRectSpy).toHaveBeenCalledWith(0, 0, 800, 600);
    });
  });

  it('unregisters cleanly on unmount', () => {
    const { ticker, callbacks } = createEffectHarness();

    const { unmount } = render(
      <TickerCtx.Provider value={ticker}>
        <Lightning />
      </TickerCtx.Provider>,
    );

    expect(callbacks.size).toBe(1);

    unmount();

    expect(callbacks.size).toBe(0);
  });
});
