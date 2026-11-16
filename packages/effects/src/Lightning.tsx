import { useContext, useEffect, useRef } from 'react';
import {
  createSeededRandom,
  type FrameState,
  LAYER,
  type TickerContext,
  TickerCtx,
} from '@react-weather-effects/core';

export type LightningFrequency = 'rare' | 'occasional' | 'frequent' | number;

export interface LightningProps {
  /**
   * Frequency of lightning strikes.
   * Can be a preset ('rare' | 'occasional' | 'frequent')
   * or a positive number (frequency <= 1 maps 0..1 to slow..fast; frequency > 1 represents strikes/minute).
   * Nonpositive or non-finite numeric values disable strikes.
   * Defaults to 'occasional'.
   */
  frequency?: LightningFrequency;

  /**
   * Main bolt stroke color (hex, rgb, rgba, or CSS color string).
   * Defaults to 'rgba(230, 240, 255, 0.95)'.
   */
  color?: string;

  /**
   * Brightness multiplier for the bolt (and screen flash if enabled).
   * Negative or non-finite values are treated as 0.
   * Defaults to 1.
   */
  brightness?: number;

  /**
   * Full-screen illumination flash intensity (0 to 1).
   * Clamped to 0..1; non-finite values are treated as 0.
   * Defaults to 0.3.
   * Note: Flashes only render when `flash` or `screenFlash` is explicitly enabled.
   */
  flashIntensity?: number;

  /**
   * Explicit opt-in for full-screen / canvas illumination flashes.
   * ACCESSIBILITY SAFEGUARD: Defaults to `false` (opt-in only) to protect photosensitive users.
   * When enabled, screen flashes are strictly rate-limited (minimum 2s cooldown per canvas,
   * shared across Lightning instances and effect remounts)
   * and automatically suppressed under reduced-motion mode.
   */
  flash?: boolean;

  /**
   * Alias for `flash`.
   */
  screenFlash?: boolean;

  /**
   * Optional PRNG seed (string or number) for reproducible strike timing and bolt geometry.
   * If omitted, uses the canvas's shared seeded PRNG (`state.random`).
   */
  seed?: string | number;

  /**
   * Reduced motion preference override ('auto' | boolean).
   * When true or when 'auto' matches OS prefers-reduced-motion, screen flashes are suppressed.
   * Defaults to 'auto'.
   */
  reducedMotion?: 'auto' | boolean;
}

interface LightningSettings {
  frequency: LightningFrequency;
  color: string;
  brightness: number;
  flashIntensity: number;
  flash: boolean;
  screenFlash: boolean;
  reducedMotion: 'auto' | boolean;
}

interface Segment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  widthRatio: number;
}

interface PathPoint {
  x: number;
  y: number;
}

interface ActiveBolt {
  segments: Segment[];
  duration: number; // in seconds
  elapsed: number; // in seconds
  hasFlash: boolean;
}

/** Minimum cooldown in seconds between screen-wide flashes for photosensitivity safety */
const MIN_FLASH_INTERVAL = 2.0;

// Simulation timestamps per canvas; weak keys retain cooldowns without retaining unmounted canvases.
const lastFlashTimes = /* @__PURE__ */ new WeakMap<TickerContext, number>();

/** Minimum interval in seconds between any two consecutive lightning strikes */
const MIN_STRIKE_INTERVAL = 2.0;

function calculateNextInterval(
  frequency: LightningFrequency,
  random: () => number,
): number {
  if (typeof frequency === 'number') {
    if (frequency <= 0) return Infinity;
    if (frequency <= 1) {
      // 0..1 maps to 15s..2.5s
      const base = 2.5 + (1 - frequency) * 12.5;
      const jitter = (random() - 0.5) * 0.4 * base;
      return Math.max(MIN_STRIKE_INTERVAL, base + jitter);
    }
    // frequency > 1: strikes per minute
    const base = 60 / frequency;
    const jitter = (random() - 0.5) * 0.4 * base;
    return Math.max(MIN_STRIKE_INTERVAL, base + jitter);
  }

  let base = 6.0;
  if (frequency === 'rare') {
    base = 12.0;
  } else if (frequency === 'frequent') {
    base = 3.0;
  }
  const jitter = (random() - 0.5) * 0.4 * base;
  return Math.max(MIN_STRIKE_INTERVAL, base + jitter);
}

function subdivide(
  p1: PathPoint,
  p2: PathPoint,
  depth: number,
  displacementScale: number,
  random: () => number,
  pointsOut: PathPoint[],
): void {
  if (depth <= 0) {
    pointsOut.push(p2);
    return;
  }

  const midX = (p1.x + p2.x) / 2;
  const midY = (p1.y + p2.y) / 2;

  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const length = Math.hypot(dx, dy);

  if (length < 1) {
    pointsOut.push(p2);
    return;
  }

  // Normal vector perpendicular to segment
  const nx = -dy / length;
  const ny = dx / length;

  // Midpoint displacement orthogonal to segment
  const offset = (random() - 0.5) * displacementScale * length;
  const displacedMid: PathPoint = {
    x: midX + nx * offset,
    y: midY + ny * offset,
  };

  subdivide(p1, displacedMid, depth - 1, displacementScale * 0.65, random, pointsOut);
  subdivide(displacedMid, p2, depth - 1, displacementScale * 0.65, random, pointsOut);
}

function generateBolt(
  width: number,
  height: number,
  random: () => number,
  quality: 'low' | 'medium' | 'high',
): Segment[] {
  const segments: Segment[] = [];
  const safeWidth = Math.max(width, 1);
  const safeHeight = Math.max(height, 1);

  // Origin point near the top of the canvas
  const startX = safeWidth * (0.2 + 0.6 * random());
  const startY = 0;

  // Termination point in the lower region of canvas
  const endX = startX + (random() - 0.5) * (safeWidth * 0.4);
  const endY = safeHeight * (0.8 + 0.2 * random());

  const maxDepth = quality === 'low' ? 3 : quality === 'high' ? 5 : 4;
  const maxBranches = quality === 'low' ? 1 : quality === 'high' ? 3 : 2;

  const trunkPoints: PathPoint[] = [{ x: startX, y: startY }];
  subdivide(
    { x: startX, y: startY },
    { x: endX, y: endY },
    maxDepth,
    0.45,
    random,
    trunkPoints,
  );

  for (let i = 0; i < trunkPoints.length - 1; i++) {
    segments.push({
      x1: trunkPoints[i].x,
      y1: trunkPoints[i].y,
      x2: trunkPoints[i + 1].x,
      y2: trunkPoints[i + 1].y,
      widthRatio: 1.0,
    });
  }

  // Procedural branching along trunk
  if (trunkPoints.length > 4 && maxBranches > 0) {
    const minIdx = Math.floor(trunkPoints.length * 0.2);
    const maxIdx = Math.floor(trunkPoints.length * 0.7);
    const range = Math.max(1, maxIdx - minIdx);

    const numBranches = Math.min(maxBranches, 1 + Math.floor(random() * maxBranches));
    for (let b = 0; b < numBranches; b++) {
      const idx = minIdx + Math.floor(random() * range);
      const origin = trunkPoints[idx];
      const nextPoint = trunkPoints[Math.min(idx + 1, trunkPoints.length - 1)];

      const segDx = nextPoint.x - origin.x;
      const segDy = nextPoint.y - origin.y;
      const angle = Math.atan2(segDy, segDx);

      // Branch off at 25° - 45°
      const side = random() < 0.5 ? -1 : 1;
      const branchAngle = angle + side * (0.4 + 0.4 * random());
      const branchLength = safeHeight * 0.25 * (0.5 + 0.5 * random());

      const branchEnd: PathPoint = {
        x: origin.x + Math.cos(branchAngle) * branchLength,
        y: origin.y + Math.sin(branchAngle) * branchLength,
      };

      const branchPoints: PathPoint[] = [origin];
      subdivide(origin, branchEnd, Math.max(1, maxDepth - 2), 0.35, random, branchPoints);

      for (let j = 0; j < branchPoints.length - 1; j++) {
        segments.push({
          x1: branchPoints[j].x,
          y1: branchPoints[j].y,
          x2: branchPoints[j + 1].x,
          y2: branchPoints[j + 1].y,
          widthRatio: 0.5,
        });
      }
    }
  }

  return segments;
}

function strokeSegments(
  ctx: CanvasRenderingContext2D,
  segments: Segment[],
  isTrunk: boolean,
): void {
  ctx.beginPath();
  for (let i = 0; i < segments.length; i++) {
    if ((segments[i].widthRatio >= 1) === isTrunk) {
      ctx.moveTo(segments[i].x1, segments[i].y1);
      ctx.lineTo(segments[i].x2, segments[i].y2);
    }
  }
  ctx.stroke();
}

function drawBolt(
  ctx: CanvasRenderingContext2D,
  segments: Segment[],
  color: string,
  alpha: number,
  brightness: number,
  quality: 'low' | 'medium' | 'high',
): void {
  if (segments.length === 0 || alpha <= 0) return;

  const qf = quality === 'low' ? 0.75 : quality === 'high' ? 1.2 : 1;
  const effectiveAlpha = Math.min(1, Math.max(0, alpha * brightness));
  if (effectiveAlpha <= 0) return;

  ctx.save();
  try {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Pass 1: Wide atmospheric glow (skipped on low quality for perf)
    if (quality !== 'low') {
      ctx.shadowColor = color;
      ctx.shadowBlur = 35 * qf;
      ctx.strokeStyle = color;
      ctx.globalAlpha = effectiveAlpha * 0.12;
      ctx.lineWidth = 12 * qf;
      strokeSegments(ctx, segments, true);
      ctx.lineWidth = 6 * qf;
      strokeSegments(ctx, segments, false);
    }

    // Pass 2: Medium colored glow
    ctx.shadowColor = color;
    ctx.shadowBlur = 15 * qf;
    ctx.strokeStyle = color;
    ctx.globalAlpha = effectiveAlpha * 0.35;
    ctx.lineWidth = 5 * qf;
    strokeSegments(ctx, segments, true);
    ctx.lineWidth = 2.5 * qf;
    strokeSegments(ctx, segments, false);

    // Pass 3: Bright white inner glow
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 8 * qf;
    ctx.strokeStyle = '#ffffff';
    ctx.globalAlpha = effectiveAlpha * 0.75;
    ctx.lineWidth = 2.5 * qf;
    strokeSegments(ctx, segments, true);
    ctx.lineWidth = 1.2 * qf;
    strokeSegments(ctx, segments, false);

    // Pass 4: Hot white core
    ctx.shadowBlur = 3 * qf;
    ctx.globalAlpha = effectiveAlpha;
    ctx.lineWidth = 1.2 * qf;
    strokeSegments(ctx, segments, true);
    ctx.lineWidth = 0.6 * qf;
    strokeSegments(ctx, segments, false);
  } finally {
    ctx.restore();
  }
}

function drawScreenFlash(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  flashElapsed: number,
  flashDuration: number,
  flashIntensity: number,
  brightness: number,
): void {
  const progress = flashElapsed / flashDuration;
  if (progress >= 1) return;

  // Sharp onset with smooth linear decay
  const decay = Math.max(0, 1 - progress);
  const alpha = Math.min(0.6, decay * flashIntensity * brightness);
  if (alpha <= 0) return;

  ctx.save();
  try {
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = alpha;
    ctx.fillRect(0, 0, width, height);
  } finally {
    ctx.restore();
  }
}

export function Lightning({
  frequency = 'occasional',
  color = 'rgba(230, 240, 255, 0.95)',
  brightness = 1,
  flashIntensity = 0.3,
  flash = false,
  screenFlash = false,
  seed,
  reducedMotion = 'auto',
}: LightningProps) {
  const ticker = useContext(TickerCtx);

  if (!ticker) {
    throw new Error('<Lightning /> must be used inside <WeatherCanvas>');
  }

  const effectiveBrightness = Number.isFinite(brightness) ? Math.max(0, brightness) : 0;
  const effectiveFlashIntensity = Number.isFinite(flashIntensity)
    ? Math.max(0, Math.min(1, flashIntensity))
    : 0;

  const settingsRef = useRef<LightningSettings>({
    frequency,
    color,
    brightness: effectiveBrightness,
    flashIntensity: effectiveFlashIntensity,
    flash,
    screenFlash,
    reducedMotion,
  });

  const seededRandomRef = useRef<(() => number) | null>(null);
  const osReducedMotionRef = useRef(true);

  useEffect(() => {
    settingsRef.current = {
      frequency,
      color,
      brightness: effectiveBrightness,
      flashIntensity: effectiveFlashIntensity,
      flash,
      screenFlash,
      reducedMotion,
    };
    ticker.invalidate();
  }, [
    ticker,
    frequency,
    color,
    effectiveBrightness,
    effectiveFlashIntensity,
    flash,
    screenFlash,
    reducedMotion,
  ]);

  useEffect(() => {
    seededRandomRef.current = seed !== undefined ? createSeededRandom(seed) : null;
    ticker.invalidate();
  }, [ticker, seed]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => {
      osReducedMotionRef.current = media.matches;
      ticker.invalidate();
    };
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, [ticker]);

  useEffect(() => {
    let countdown = 0; // Trigger initial strike on first step
    let activeBolt: ActiveBolt | null = null;

    const unregister = ticker.register(LAYER.FOREGROUND, (state: FrameState) => {
      const settings = settingsRef.current;
      const rnd = seededRandomRef.current ?? state.random;

      if (
        typeof settings.frequency === 'number'
        && (!Number.isFinite(settings.frequency) || settings.frequency <= 0)
      ) {
        activeBolt = null;
        return;
      }

      const reduced = settings.reducedMotion === true
        || (settings.reducedMotion === 'auto' && osReducedMotionRef.current);
      const canFlash = state.isAnimating && !reduced
        && (settings.flash || settings.screenFlash)
        && settings.brightness > 0 && settings.flashIntensity > 0;
      // Once cancelled, a flash must not reappear on a render-only update or resume.
      if (activeBolt && !canFlash) activeBolt.hasFlash = false;

      if (!activeBolt) {
        if (state.isAnimating) countdown -= state.dt;
        if (countdown <= 0) {
          const segments = generateBolt(
            state.width,
            state.height,
            rnd,
            state.budget.quality,
          );

          // Photosensitivity & reduced-motion safeguards
          const cooldownOk = state.timestamp - (lastFlashTimes.get(ticker) ?? -Infinity)
            >= MIN_FLASH_INTERVAL * 1000;
          const shouldFlash = canFlash && cooldownOk;

          if (shouldFlash) {
            lastFlashTimes.set(ticker, state.timestamp);
          }

          activeBolt = {
            segments,
            duration: 0.22,
            elapsed: state.isAnimating ? 0 : 0.05,
            hasFlash: shouldFlash,
          };
        }
      }

      if (activeBolt) {
        if (state.isAnimating) activeBolt.elapsed += state.dt;
        const progress = activeBolt.elapsed / activeBolt.duration;

        if (progress >= 1) {
          activeBolt = null;
          countdown = calculateNextInterval(settings.frequency, rnd);
        } else {
          // Instant sharp onset at t=0, secondary flicker (12-35%), smooth decay (35-100%)
          let alpha = 0;
          if (progress < 0.12) {
            alpha = 1.0;
          } else if (progress < 0.35) {
            alpha = 0.6 + 0.35 * Math.sin(((progress - 0.12) / 0.23) * Math.PI);
          } else {
            alpha = Math.max(0, 1 - (progress - 0.35) / 0.65);
          }

          drawBolt(
            state.ctx,
            activeBolt.segments,
            settings.color,
            alpha,
            settings.brightness,
            state.budget.quality,
          );

          if (activeBolt.hasFlash) {
            drawScreenFlash(
              state.ctx,
              state.width,
              state.height,
              activeBolt.elapsed,
              0.12,
              settings.flashIntensity,
              settings.brightness,
            );
          }
        }
      }
    });

    return unregister;
  }, [ticker]);

  return null;
}
