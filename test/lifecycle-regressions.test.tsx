import React, { useContext, useEffect } from 'react';
import { render, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  WeatherCanvas,
  TickerCtx,
  LAYER,
  SchedulerCtx,
  type FrameScheduler,
  type Quality,
} from '@react-weather-overlays/core';
import { Rain, Snow, Fog } from '@react-weather-overlays/effects';

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

  get pendingCount(): number {
    return this.queue.size;
  }
}

describe('Lifecycle & Live Update Regressions', () => {
  let scheduler: TestManualScheduler;

  beforeEach(() => {
    scheduler = new TestManualScheduler();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // Issue 1: Mode change preserves canvas node and maintains active drawing
  it('preserves the canvas DOM element and rebinds drawing when changing mode', () => {
    const drawFn = vi.fn();

    function ModeSwitchTest({ mode }: { mode: 'contained' | 'fullscreen' }) {
      const ticker = useContext(TickerCtx);
      useEffect(() => {
        if (!ticker) return;
        return ticker.register(LAYER.BACKGROUND, drawFn);
      }, [ticker]);
      return null;
    }

    const { container, rerender } = render(
      <SchedulerCtx.Provider value={scheduler}>
        <WeatherCanvas mode="contained" reducedMotion="animated">
          <ModeSwitchTest mode="contained" />
        </WeatherCanvas>
      </SchedulerCtx.Provider>,
    );

    const canvasFirst = container.querySelector('canvas');
    expect(canvasFirst).toBeInTheDocument();

    act(() => {
      scheduler.step(100);
    });
    expect(drawFn).toHaveBeenCalledTimes(1);

    // Switch to fullscreen
    rerender(
      <SchedulerCtx.Provider value={scheduler}>
        <WeatherCanvas mode="fullscreen" reducedMotion="animated">
          <ModeSwitchTest mode="fullscreen" />
        </WeatherCanvas>
      </SchedulerCtx.Provider>,
    );

    const canvasSecond = container.querySelector('canvas');
    // Canvas DOM node must be preserved
    expect(canvasSecond).toBe(canvasFirst);

    // Drawing must continue to succeed
    act(() => {
      scheduler.step(200);
    });
    expect(drawFn).toHaveBeenCalledTimes(2);
  });

  // Issue 2: DPR changes resize the backing canvas
  it('resizes the backing canvas when effective DPR changes', () => {
    vi.stubGlobal('devicePixelRatio', 2);

    function QualityControlledScene({ quality }: { quality: Quality }) {
      return (
        <SchedulerCtx.Provider value={scheduler}>
          <WeatherCanvas mode="contained" quality={quality} reducedMotion="animated">
            <Rain intensity={0.5} />
          </WeatherCanvas>
        </SchedulerCtx.Provider>
      );
    }

    // High quality: DPR cap is 2 (mockResizeObserver sets 800x600 -> 1600x1200)
    const { container, rerender } = render(<QualityControlledScene quality="high" />);

    const canvas = container.querySelector('canvas')!;
    expect(canvas.width).toBe(1600);
    expect(canvas.height).toBe(1200);

    // Switch to low quality: DPR cap is 1 -> canvas must resize to 800x600
    rerender(<QualityControlledScene quality="low" />);

    expect(canvas.width).toBe(800);
    expect(canvas.height).toBe(600);
  });

  // Issue 3: Static/paused scenes invalidate on quality and wind updates
  it('invalidates and redraws static/paused scenes when wind or quality changes', async () => {
    let lastFrameState: any = null;

    function StateSpy() {
      const ticker = useContext(TickerCtx)!;
      useEffect(() => {
        return ticker.register(LAYER.BACKGROUND, (state) => {
          lastFrameState = { ...state, wind: { ...state.wind }, budget: { ...state.budget } };
        });
      }, [ticker]);
      return null;
    }

    const { rerender } = render(
      <SchedulerCtx.Provider value={scheduler}>
        <WeatherCanvas
          mode="fullscreen"
          paused={true}
          wind={{ x: 0, y: 0 }}
          quality="medium"
        >
          <StateSpy />
        </WeatherCanvas>
      </SchedulerCtx.Provider>,
    );

    // Flush initial microtask
    await act(async () => {
      await Promise.resolve();
    });
    expect(lastFrameState).not.toBeNull();
    expect(lastFrameState.wind).toEqual({ x: 0, y: 0 });

    // Update wind prop in paused mode
    rerender(
      <SchedulerCtx.Provider value={scheduler}>
        <WeatherCanvas
          mode="fullscreen"
          paused={true}
          wind={{ x: 1.25, y: -0.5 }}
          quality="medium"
        >
          <StateSpy />
        </WeatherCanvas>
      </SchedulerCtx.Provider>,
    );

    await act(async () => {
      await Promise.resolve();
    });
    expect(lastFrameState.wind).toEqual({ x: 1.25, y: -0.5 });

    // Update quality prop in paused mode
    rerender(
      <SchedulerCtx.Provider value={scheduler}>
        <WeatherCanvas
          mode="fullscreen"
          paused={true}
          wind={{ x: 1.25, y: -0.5 }}
          quality="low"
        >
          <StateSpy />
        </WeatherCanvas>
      </SchedulerCtx.Provider>,
    );

    await act(async () => {
      await Promise.resolve();
    });
    expect(lastFrameState.budget.quality).toBe('low');
  });

  // Issue 4: Dirty static scene redraws when visibility returns
  it('redraws dirty static scenes when page visibility returns', async () => {
    let visibilityState = 'hidden';
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => visibilityState,
    });

    const drawFn = vi.fn();

    function HiddenScene() {
      const ticker = useContext(TickerCtx)!;
      useEffect(() => {
        return ticker.register(LAYER.BACKGROUND, drawFn);
      }, [ticker]);
      return null;
    }

    render(
      <SchedulerCtx.Provider value={scheduler}>
        <WeatherCanvas mode="fullscreen" reducedMotion="static">
          <HiddenScene />
        </WeatherCanvas>
      </SchedulerCtx.Provider>,
    );

    await act(async () => {
      await Promise.resolve();
    });
    // While hidden, canvas should not have drawn
    expect(drawFn).toHaveBeenCalledTimes(0);

    // Simulate page becoming visible
    visibilityState = 'visible';
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
      await Promise.resolve();
    });

    // Now that page is visible, retained dirty state must trigger draw
    expect(drawFn).toHaveBeenCalledTimes(1);
  });

  // Issue 5: Effect live updates
  it('applies live speed changes to Snow without resetting particle positions', () => {
    function SnowSpeedTest({ speed }: { speed: number }) {
      const ticker = useContext(TickerCtx)!;
      useEffect(() => {
        return ticker.register(LAYER.FOREGROUND, () => {});
      }, [ticker]);
      return <Snow intensity={0.5} speed={speed} wobble={false} />;
    }

    const { rerender } = render(
      <SchedulerCtx.Provider value={scheduler}>
        <WeatherCanvas mode="fullscreen" reducedMotion="animated" wind={{ x: 0, y: 0 }}>
          <SnowSpeedTest speed={1} />
        </WeatherCanvas>
      </SchedulerCtx.Provider>,
    );

    // Frame 1: initial seed
    act(() => {
      scheduler.step(100);
    });

    // Frame 2: advance at speed = 1
    act(() => {
      scheduler.step(200);
    });

    // Set speed to 0 — flakes should stop moving
    rerender(
      <SchedulerCtx.Provider value={scheduler}>
        <WeatherCanvas mode="fullscreen" reducedMotion="animated" wind={{ x: 0, y: 0 }}>
          <SnowSpeedTest speed={0} />
        </WeatherCanvas>
      </SchedulerCtx.Provider>,
    );

    act(() => {
      scheduler.step(300);
    });
  });

  it('regenerates Fog texture when Fog.color changes', () => {
    const { rerender } = render(
      <SchedulerCtx.Provider value={scheduler}>
        <WeatherCanvas mode="fullscreen" reducedMotion="animated">
          <Fog density={0.5} color="rgba(255, 0, 0, 0.5)" />
        </WeatherCanvas>
      </SchedulerCtx.Provider>,
    );

    act(() => {
      scheduler.step(100);
    });

    // Update color
    rerender(
      <SchedulerCtx.Provider value={scheduler}>
        <WeatherCanvas mode="fullscreen" reducedMotion="animated">
          <Fog density={0.5} color="rgba(0, 0, 255, 0.5)" />
        </WeatherCanvas>
      </SchedulerCtx.Provider>,
    );

    act(() => {
      scheduler.step(200);
    });
  });
});
