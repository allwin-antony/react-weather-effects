import React, {
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  type DPRCap,
  DEFAULT_DPR_CAP,
  type Quality,
  type RenderBudget,
  resolveRenderBudget,
} from './budget';
import { type MotionMode, type ReducedMotionProp, resolveMotion } from './motion';
import { createSeededRandom } from './random';
import { defaultScheduler, SchedulerCtx } from './scheduler';
import {
  type DrawFn,
  type FrameState,
  type TickerContext,
  TickerCtx,
} from './TickerContext';

const __DEV__ =
  typeof process !== 'undefined' && process.env && process.env.NODE_ENV !== 'production';

export interface WeatherCanvasProps {
  children?: React.ReactNode;
  mode?: 'fullscreen' | 'contained';
  wind?: { x: number; y: number };
  /** Maximum device pixel ratio; combines with the quality cap. Defaults to 2. String names are deprecated. */
  dpr?: DPRCap;
  quality?: Quality;
  reducedMotion?: ReducedMotionProp;
  paused?: boolean;
  seed?: string | number;
  zIndex?: number;
  onContextLost?: () => void;
}

interface Registration {
  id: number;
  layer: number;
  fn: DrawFn;
  seq: number;
}

export function WeatherCanvas({
  children,
  mode = 'fullscreen',
  wind = { x: 0, y: 0 },
  dpr = DEFAULT_DPR_CAP,
  quality = 'medium',
  reducedMotion = 'auto',
  paused = false,
  seed,
  zIndex = 1,
  onContextLost,
}: WeatherCanvasProps) {
  const [canvasNode, setCanvasNode] = useState<HTMLCanvasElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const setCanvasRef = useCallback((node: HTMLCanvasElement | null) => {
    canvasRef.current = node;
    setCanvasNode(node);
  }, []);

  // Injected scheduler for deterministic test harness or default RAF
  const injectedScheduler = useContext(SchedulerCtx);
  const scheduler = injectedScheduler ?? defaultScheduler;

  // Stable seed across re-renders
  const autoSeed = useId();
  const effectiveSeed = seed ?? autoSeed;
  const randomFnRef = useRef<() => number>(createSeededRandom(effectiveSeed));

  // Reset PRNG if seed changes
  useEffect(() => {
    randomFnRef.current = createSeededRandom(effectiveSeed);
  }, [effectiveSeed]);

  // Context & canvas state
  const [contextAvailable, setContextAvailable] = useState<boolean>(true);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);

  // Dimensions in CSS pixels
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });

  // OS Reduced Motion preference
  const [osPreference, setOsPreference] = useState<boolean | null>(null);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setOsPreference(mq.matches);

    const handler = (e: MediaQueryListEvent) => setOsPreference(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const motionMode: MotionMode = resolveMotion(reducedMotion, osPreference);

  // Visibility and viewport tracking
  const [pageVisible, setPageVisible] = useState<boolean>(() => {
    if (typeof document === 'undefined') return true;
    return document.visibilityState === 'visible';
  });

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const handleVisibility = () => {
      setPageVisible(document.visibilityState === 'visible');
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  const [inViewport, setInViewport] = useState<boolean>(true);
  useEffect(() => {
    const el = canvasNode;
    if (!el || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry) {
          setInViewport(entry.isIntersecting);
        }
      },
      { threshold: 0 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [canvasNode]);

  // Budget management: state + ref for synchronous access
  const [budget, setBudget] = useState<RenderBudget>(() => resolveRenderBudget(quality, dpr));
  const budgetRef = useRef<RenderBudget>(budget);

  // Registrations registry
  const nextRegId = useRef<number>(1);
  const nextSeq = useRef<number>(1);
  const registrationsRef = useRef<Registration[]>([]);
  const orderedSnapshotRef = useRef<Registration[]>([]);
  const [effectCount, setEffectCount] = useState<number>(0);

  // Wind and settings refs
  const windRef = useRef<{ x: number; y: number }>(wind);

  // Simulation time tracking
  const simulationTime = useRef<number>(0);
  const lastTimestamp = useRef<number | null>(null);
  const rafId = useRef<number | null>(null);

  // Asset tracking for deterministic capture readiness
  const pendingAssetsRef = useRef<Set<Promise<void>>>(new Set());

  // Invalidation microtask scheduling
  const isMicrotaskScheduled = useRef<boolean>(false);
  const isDirtyRef = useRef<boolean>(true);

  // Derived eligibility
  const canPresent =
    contextAvailable &&
    dimensions.width > 0 &&
    dimensions.height > 0 &&
    pageVisible &&
    inViewport &&
    motionMode !== 'off';

  const shouldAnimate =
    canPresent && effectCount > 0 && !paused && motionMode === 'animated';

  const canPresentRef = useRef(canPresent);
  canPresentRef.current = canPresent;

  const shouldAnimateRef = useRef(shouldAnimate);
  shouldAnimateRef.current = shouldAnimate;

  const motionModeRef = useRef(motionMode);
  motionModeRef.current = motionMode;

  const onContextLostRef = useRef(onContextLost);
  onContextLostRef.current = onContextLost;

  // Frame drawing implementation
  const drawFrame = useCallback((dt: number, timestamp: number) => {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx || canvas.width === 0 || canvas.height === 0) return;

    const snapshot = orderedSnapshotRef.current;
    const currentBudget = budgetRef.current;
    const currentDpr = currentBudget.dpr;

    isDirtyRef.current = false;

    const frameState: FrameState = {
      ctx,
      dt,
      isAnimating: shouldAnimateRef.current,
      width: dimensions.width,
      height: dimensions.height,
      dpr: currentDpr,
      budget: currentBudget,
      wind: windRef.current,
      pointer: null,
      timestamp,
      random: randomFnRef.current,
    };

    ctx.save();
    try {
      // Clear in backing-store pixels, then set scale to CSS pixels
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(currentDpr, 0, 0, currentDpr, 0, 0);

      // If off or no effects registered, clearing is all that is needed
      if (motionModeRef.current === 'off' || snapshot.length === 0) {
        return;
      }

      for (const reg of snapshot) {
        ctx.save();
        ctx.beginPath();
        try {
          reg.fn(frameState);
        } catch (err) {
          if (__DEV__) {
            console.error('Weather effect draw error:', err);
          }
        } finally {
          ctx.restore();
          ctx.beginPath();
        }
      }
    } finally {
      ctx.restore();
      ctx.beginPath();
    }
  }, [dimensions.width, dimensions.height]);

  const drawFrameRef = useRef(drawFrame);
  drawFrameRef.current = drawFrame;

  // Invalidate handler
  const invalidate = useCallback(() => {
    isDirtyRef.current = true;

    // If currently animating, the next RAF tick will consume the update
    if (shouldAnimateRef.current) {
      return;
    }

    // Static, paused, or stopped: coalesce into a single microtask
    if (!isMicrotaskScheduled.current) {
      isMicrotaskScheduled.current = true;
      queueMicrotask(() => {
        isMicrotaskScheduled.current = false;
        if (!canPresentRef.current) return;
        drawFrameRef.current(0, simulationTime.current);
      });
    }
  }, []);

  useEffect(() => {
    if (__DEV__ && typeof dpr === 'string') {
      console.warn(
        `WeatherCanvas: dpr="${dpr}" is deprecated; pass a numeric maximum device pixel ratio instead (for example dpr={1.5}).`,
      );
    }
  }, [dpr]);

  // Update budget when quality or dpr prop changes, and invalidate
  useEffect(() => {
    const nextBudget = resolveRenderBudget(quality, dpr);
    budgetRef.current = nextBudget;
    setBudget(nextBudget);
    invalidate();
  }, [quality, dpr, invalidate]);

  // DPR change media query
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    let mql: MediaQueryList | undefined;

    const updateDpr = () => {
      if (mql) mql.removeEventListener('change', updateDpr);
      const nextBudget = resolveRenderBudget(quality, dpr);
      budgetRef.current = nextBudget;
      setBudget(nextBudget);
      invalidate();

      const currentDppx = window.devicePixelRatio ?? 1;
      mql = window.matchMedia(`(resolution: ${currentDppx}dppx)`);
      mql.addEventListener('change', updateDpr, { once: true });
    };

    updateDpr();
    return () => mql?.removeEventListener('change', updateDpr);
  }, [quality, dpr, invalidate]);

  // Update wind and invalidate static/paused scenes
  useEffect(() => {
    windRef.current = wind;
    invalidate();
  }, [wind.x, wind.y, invalidate]);

  // When canPresent becomes true (e.g. visibility or viewport returned),
  // redraw any pending dirty state if not currently animating
  useEffect(() => {
    if (canPresent && isDirtyRef.current && !shouldAnimate) {
      invalidate();
    }
  }, [canPresent, shouldAnimate, invalidate]);

  // Update sorted snapshot helper
  const updateSnapshot = useCallback(() => {
    const sorted = [...registrationsRef.current].sort((a, b) => {
      if (a.layer !== b.layer) return a.layer - b.layer;
      return a.seq - b.seq;
    });
    orderedSnapshotRef.current = sorted;
    setEffectCount(sorted.length);
  }, []);

  // TickerContext methods
  const register = useCallback(
    (layer: number, fn: DrawFn) => {
      const id = nextRegId.current++;
      const seq = nextSeq.current++;
      const reg: Registration = { id, layer, fn, seq };

      registrationsRef.current.push(reg);
      updateSnapshot();
      invalidate();

      let unregistered = false;
      return () => {
        if (unregistered) return;
        unregistered = true;
        registrationsRef.current = registrationsRef.current.filter((r) => r.id !== id);
        updateSnapshot();
        invalidate();
      };
    },
    [updateSnapshot, invalidate],
  );

  const getBudget = useCallback(() => budgetRef.current, []);

  const trackAsset = useCallback(
    (task: Promise<void>) => {
      pendingAssetsRef.current.add(task);
      let settled = false;

      const finish = () => {
        if (!settled) {
          settled = true;
          pendingAssetsRef.current.delete(task);
        }
      };

      task.then(
        () => {
          finish();
          invalidate();
        },
        () => {
          finish();
          invalidate();
        },
      );

      return () => {
        finish();
      };
    },
    [invalidate],
  );

  // Stable TickerContext object
  const tickerContext = useMemo<TickerContext>(
    () => ({
      register,
      invalidate,
      getBudget,
      trackAsset,
    }),
    [register, invalidate, getBudget, trackAsset],
  );

  // Canvas context initialization & loss handling
  useEffect(() => {
    const canvas = canvasNode;
    if (!canvas) return;

    let ctx: CanvasRenderingContext2D | null = null;
    try {
      ctx = canvas.getContext('2d');
    } catch {
      ctx = null;
    }

    if (!ctx) {
      if (__DEV__) {
        console.warn('WeatherCanvas: Failed to acquire 2D rendering context.');
      }
      setContextAvailable(false);
      onContextLostRef.current?.();
      return;
    }

    ctxRef.current = ctx;
    setContextAvailable(true);
    invalidate();

    const handleContextLost = (e: Event) => {
      e.preventDefault();
      setContextAvailable(false);
      ctxRef.current = null;
      onContextLostRef.current?.();
    };

    const handleContextRestored = () => {
      const restoredCtx = canvas.getContext('2d');
      if (restoredCtx) {
        ctxRef.current = restoredCtx;
        setContextAvailable(true);
        invalidate();
      }
    };

    canvas.addEventListener('contextlost', handleContextLost);
    canvas.addEventListener('contextrestored', handleContextRestored);

    return () => {
      canvas.removeEventListener('contextlost', handleContextLost);
      canvas.removeEventListener('contextrestored', handleContextRestored);
    };
  }, [canvasNode, invalidate]);

  // ResizeObserver for element dimensions
  useEffect(() => {
    const target = mode === 'fullscreen' ? canvasNode : (containerRef.current ?? canvasNode);
    if (!target) return;

    if (mode === 'fullscreen') {
      const updateFullscreenSize = () => {
        const w = typeof window !== 'undefined' ? window.innerWidth : 0;
        const h = typeof window !== 'undefined' ? window.innerHeight : 0;
        setDimensions((prev) => {
          if (prev.width === w && prev.height === h) return prev;
          return { width: w, height: h };
        });
      };
      updateFullscreenSize();
      window.addEventListener('resize', updateFullscreenSize);
      return () => window.removeEventListener('resize', updateFullscreenSize);
    }

    if (typeof ResizeObserver === 'undefined') return;

    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setDimensions((prev) => {
        if (prev.width === width && prev.height === height) return prev;
        return { width, height };
      });
    });

    ro.observe(target);
    return () => ro.disconnect();
  }, [mode, canvasNode]);

  // Adjust canvas backing store dimensions when CSS dimensions or DPR changes
  useEffect(() => {
    const canvas = canvasNode;
    if (!canvas) return;

    const currentDpr = budget.dpr;
    const backingWidth = Math.round(dimensions.width * currentDpr);
    const backingHeight = Math.round(dimensions.height * currentDpr);

    if (canvas.width !== backingWidth || canvas.height !== backingHeight) {
      canvas.width = backingWidth;
      canvas.height = backingHeight;
      invalidate();
    }
  }, [dimensions, budget.dpr, canvasNode, invalidate]);

  // Handle immediate clear on motionMode === 'off'
  useEffect(() => {
    if (motionMode === 'off') {
      const canvas = canvasRef.current;
      const ctx = ctxRef.current;
      if (canvas && ctx && canvas.width > 0 && canvas.height > 0) {
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
      }
    } else {
      invalidate();
    }
  }, [motionMode, invalidate]);

  // Main animation lifecycle loop
  useEffect(() => {
    if (!shouldAnimate) {
      if (rafId.current !== null) {
        scheduler.cancel(rafId.current);
        rafId.current = null;
      }
      return;
    }

    let stopped = false;
    lastTimestamp.current = null;

    function tick(now: number) {
      rafId.current = null;
      if (stopped || !shouldAnimateRef.current) return;

      const dt =
        lastTimestamp.current === null
          ? 0
          : Math.min(Math.max((now - lastTimestamp.current) / 1000, 0), 0.1);

      lastTimestamp.current = now;
      simulationTime.current += dt * 1000;

      drawFrameRef.current(dt, simulationTime.current);

      if (!stopped && shouldAnimateRef.current) {
        rafId.current = scheduler.request(tick);
      }
    }

    rafId.current = scheduler.request(tick);

    return () => {
      stopped = true;
      if (rafId.current !== null) {
        scheduler.cancel(rafId.current);
        rafId.current = null;
      }
    };
  }, [shouldAnimate, scheduler]);

  // Container style preserves the canvas DOM node across mode changes
  const containerStyle: React.CSSProperties =
    mode === 'fullscreen'
      ? {
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          pointerEvents: 'none',
          zIndex,
        }
      : {
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          zIndex,
        };

  const canvasStyle: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
  };

  return (
    <TickerCtx.Provider value={tickerContext}>
      <div ref={containerRef} style={containerStyle}>
        <canvas ref={setCanvasRef} aria-hidden="true" style={canvasStyle} />
        {children}
      </div>
    </TickerCtx.Provider>
  );
}
