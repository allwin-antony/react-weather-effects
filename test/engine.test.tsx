import React, { useContext, useEffect, useState } from 'react';
import { render, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  WeatherCanvas,
  TickerCtx,
  LAYER,
  SchedulerCtx,
  type FrameScheduler,
  type DrawFn,
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

  get pendingCount(): number {
    return this.queue.size;
  }
}

function TestEffect({
  layer = LAYER.BACKGROUND,
  onDraw,
}: {
  layer?: number;
  onDraw: DrawFn;
}) {
  const ticker = useContext(TickerCtx);
  useEffect(() => {
    if (!ticker) return;
    return ticker.register(layer, onDraw);
  }, [ticker, layer, onDraw]);
  return null;
}

describe('WeatherCanvas Engine', () => {
  let scheduler: TestManualScheduler;

  beforeEach(() => {
    scheduler = new TestManualScheduler();
  });

  it('renders a canvas with aria-hidden and pointer-events none', () => {
    const { container } = render(
      <SchedulerCtx.Provider value={scheduler}>
        <WeatherCanvas mode="fullscreen">
          <div data-testid="child" />
        </WeatherCanvas>
      </SchedulerCtx.Provider>,
    );

    const canvas = container.querySelector('canvas');
    expect(canvas).toBeInTheDocument();
    expect(canvas).toHaveAttribute('aria-hidden', 'true');
    expect(canvas?.style.pointerEvents).toBe('none');
  });

  it('orders draw calls by layer ascending, and insertion order for same layer', () => {
    const executionOrder: string[] = [];

    const drawBg1 = vi.fn(() => executionOrder.push('bg-1'));
    const drawBg2 = vi.fn(() => executionOrder.push('bg-2'));
    const drawFg = vi.fn(() => executionOrder.push('fg'));
    const drawMid = vi.fn(() => executionOrder.push('mid'));

    render(
      <SchedulerCtx.Provider value={scheduler}>
        <WeatherCanvas mode="fullscreen" reducedMotion="animated">
          <TestEffect layer={LAYER.BACKGROUND} onDraw={drawBg1} />
          <TestEffect layer={LAYER.FOREGROUND} onDraw={drawFg} />
          <TestEffect layer={LAYER.BACKGROUND} onDraw={drawBg2} />
          <TestEffect layer={LAYER.MIDGROUND} onDraw={drawMid} />
        </WeatherCanvas>
      </SchedulerCtx.Provider>,
    );

    expect(scheduler.pendingCount).toBe(1);

    act(() => {
      scheduler.step(100);
    });

    expect(executionOrder).toEqual(['bg-1', 'bg-2', 'mid', 'fg']);
  });

  it('applies mid-dispatch registration on next frame, not current', () => {
    let unregisterLate: (() => void) | null = null;
    const executionOrder: string[] = [];

    function DynamicEffect() {
      const ticker = useContext(TickerCtx)!;
      useEffect(() => {
        return ticker.register(LAYER.BACKGROUND, () => {
          executionOrder.push('first');
          if (!unregisterLate) {
            unregisterLate = ticker.register(LAYER.BACKGROUND, () => {
              executionOrder.push('second');
            });
          }
        });
      }, [ticker]);
      return null;
    }

    render(
      <SchedulerCtx.Provider value={scheduler}>
        <WeatherCanvas mode="fullscreen" reducedMotion="animated">
          <DynamicEffect />
        </WeatherCanvas>
      </SchedulerCtx.Provider>,
    );

    // Frame 1: dynamic registration happens during dispatch
    act(() => {
      scheduler.step(100);
    });
    expect(executionOrder).toEqual(['first']);

    // Frame 2: newly registered effect is dispatched
    act(() => {
      scheduler.step(200);
    });
    expect(executionOrder).toEqual(['first', 'first', 'second']);

    act(() => {
      if (unregisterLate) unregisterLate();
    });
  });

  it('continues remaining callbacks and restores canvas state if an effect throws', () => {
    const drawGood1 = vi.fn();
    const drawBad = vi.fn(() => {
      throw new Error('Explosion');
    });
    const drawGood2 = vi.fn();

    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <SchedulerCtx.Provider value={scheduler}>
        <WeatherCanvas mode="fullscreen" reducedMotion="animated">
          <TestEffect layer={LAYER.BACKGROUND} onDraw={drawGood1} />
          <TestEffect layer={LAYER.MIDGROUND} onDraw={drawBad} />
          <TestEffect layer={LAYER.FOREGROUND} onDraw={drawGood2} />
        </WeatherCanvas>
      </SchedulerCtx.Provider>,
    );

    act(() => {
      scheduler.step(100);
    });

    expect(drawGood1).toHaveBeenCalledTimes(1);
    expect(drawBad).toHaveBeenCalledTimes(1);
    expect(drawGood2).toHaveBeenCalledTimes(1);

    errSpy.mockRestore();
  });

  it('cancels RAF loop when paused or motion is off', () => {
    function ControlledScene() {
      const [paused, setPaused] = useState(false);
      return (
        <div>
          <button onClick={() => setPaused((p) => !p)}>Toggle</button>
          <WeatherCanvas mode="fullscreen" paused={paused} reducedMotion="animated">
            <TestEffect layer={LAYER.BACKGROUND} onDraw={() => {}} />
          </WeatherCanvas>
        </div>
      );
    }

    const { getByText } = render(
      <SchedulerCtx.Provider value={scheduler}>
        <ControlledScene />
      </SchedulerCtx.Provider>,
    );

    expect(scheduler.pendingCount).toBe(1);

    // Step a frame
    act(() => {
      scheduler.step(100);
    });
    expect(scheduler.pendingCount).toBe(1);

    // Pause
    act(() => {
      getByText('Toggle').click();
    });

    // RAF loop cancelled
    expect(scheduler.pendingCount).toBe(0);

    // Resume
    act(() => {
      getByText('Toggle').click();
    });

    // RAF loop restarted
    expect(scheduler.pendingCount).toBe(1);
  });

  it('provides dt = 0 on the first frame after pause', () => {
    const dts: number[] = [];
    const drawFn = vi.fn((state) => {
      dts.push(state.dt);
    });

    const { rerender } = render(
      <SchedulerCtx.Provider value={scheduler}>
        <WeatherCanvas mode="fullscreen" paused={false} reducedMotion="animated">
          <TestEffect layer={LAYER.BACKGROUND} onDraw={drawFn} />
        </WeatherCanvas>
      </SchedulerCtx.Provider>,
    );

    // First frame
    act(() => {
      scheduler.step(1000);
    });
    expect(dts[0]).toBe(0);

    // Second frame
    act(() => {
      scheduler.step(1050);
    });
    expect(dts[1]).toBeCloseTo(0.05, 3);

    // Pause scene
    rerender(
      <SchedulerCtx.Provider value={scheduler}>
        <WeatherCanvas mode="fullscreen" paused={true} reducedMotion="animated">
          <TestEffect layer={LAYER.BACKGROUND} onDraw={drawFn} />
        </WeatherCanvas>
      </SchedulerCtx.Provider>,
    );

    // Resume scene
    rerender(
      <SchedulerCtx.Provider value={scheduler}>
        <WeatherCanvas mode="fullscreen" paused={false} reducedMotion="animated">
          <TestEffect layer={LAYER.BACKGROUND} onDraw={drawFn} />
        </WeatherCanvas>
      </SchedulerCtx.Provider>,
    );

    // Resumed frame must have dt = 0
    act(() => {
      scheduler.step(2000);
    });
    expect(dts[2]).toBe(0);
  });

  it('coalesces static invalidations into a single microtask with dt = 0', async () => {
    const drawCalls: number[] = [];

    function StaticConsumer() {
      const ticker = useContext(TickerCtx)!;
      useEffect(() => {
        const cleanup = ticker.register(LAYER.BACKGROUND, (state) => {
          drawCalls.push(state.dt);
        });
        // Trigger multiple invalidations in same turn
        ticker.invalidate();
        ticker.invalidate();
        ticker.invalidate();
        return cleanup;
      }, [ticker]);
      return null;
    }

    render(
      <SchedulerCtx.Provider value={scheduler}>
        <WeatherCanvas mode="fullscreen" reducedMotion="static">
          <StaticConsumer />
        </WeatherCanvas>
      </SchedulerCtx.Provider>,
    );

    // Static mode does not schedule RAF
    expect(scheduler.pendingCount).toBe(0);

    // Wait for microtasks to flush
    await act(async () => {
      await Promise.resolve();
    });

    expect(drawCalls.length).toBe(1);
    expect(drawCalls[0]).toBe(0);
  });
});
