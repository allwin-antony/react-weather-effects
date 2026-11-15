import { useContext, useEffect, useRef } from 'react';
import {
  createParticlePool,
  type FrameState,
  growParticlePool,
  LAYER,
  PARTICLE_STRIDE,
  TickerCtx,
} from '@react-weather-effects/core';
import { createParticleTransition, updateParticleTransition } from './transition';

export interface RainProps {
  intensity?: number;
  /** Intensity fade duration in milliseconds; 0 (default) applies changes immediately. */
  transitionDuration?: number;
  angle?: number; // degrees from vertical
  color?: string;
  speed?: number;
  /**
   * Multiplier for raindrop trail length.
   * Defaults to 1. Values < 1 produce fine drizzle; values > 1 produce longer downpour streaks.
   */
  dropLength?: number;
  length?: number;
  /**
   * Multiplier for raindrop stroke thickness.
   * Defaults to 1. Values < 1 produce delicate droplets; values > 1 produce thick heavy drops.
   */
  dropThickness?: number;
  thickness?: number;
  /**
   * Enable animated splashes along the bottom edge of the canvas.
   * Ideal for contained cards, heroes, or window widgets where raindrops hit the ground.
   * Defaults to false.
   */
  splashes?: boolean;
  splash?: boolean;
}

interface RainSettings {
  intensity: number;
  transitionDuration: number;
  angle: number;
  color: string;
  speed: number;
  dropLength: number;
  dropThickness: number;
  splashes: boolean;
}

const SPLASH_STRIDE = 6;

function seedParticle(
  pool: Float32Array,
  i: number,
  state: FrameState,
  settings: RainSettings,
  isInitial: boolean,
): void {
  const base = i * PARTICLE_STRIDE;
  const angleRad = (settings.angle * Math.PI) / 180;
  const depth = state.random();
  const fallSpeed = 550 + depth * 650;
  const speed = fallSpeed * settings.speed;

  const vx = Math.sin(angleRad) * speed + state.wind.x * (140 + depth * 150);
  const vy = Math.cos(angleRad) * speed + state.wind.y * (60 + depth * 50);

  // Initial seeding spreads particles across full viewport
  const x = state.random() * (state.width + 200) - 100;
  const y = isInitial
    ? state.random() * (state.height + 100) - 50
    : -50 - state.random() * 100;

  pool[base] = x;
  pool[base + 1] = y;
  pool[base + 2] = vx;
  pool[base + 3] = vy;
  pool[base + 4] = 0.3 + depth * 0.6; // alpha
  pool[base + 5] = fallSpeed; // intrinsic speed, retained through wind changes
  pool[base + 6] = depth;
}

function seedParticleRange(
  pool: Float32Array,
  startIndex: number,
  endIndex: number,
  state: FrameState,
  settings: RainSettings,
): void {
  for (let i = startIndex; i < endIndex; i++) {
    seedParticle(pool, i, state, settings, true);
  }
}

function updatePool(
  pool: Float32Array,
  count: number,
  state: FrameState,
  settings: RainSettings,
  visibility: Float32Array,
  splashPool: Float32Array,
  maxSplashes: number,
  splashState: { head: number },
): void {
  const dt = state.dt;
  const width = state.width;
  const height = state.height;
  const wrapWidth = width + 200;
  const angleRad = (settings.angle * Math.PI) / 180;
  const sinAngle = Math.sin(angleRad);
  const cosAngle = Math.cos(angleRad);
  const response = 1 - Math.exp(-dt * 5);

  for (let i = 0; i < count; i++) {
    const base = i * PARTICLE_STRIDE;
    let x = pool[base];
    let y = pool[base + 1];
    let vx = pool[base + 2];
    let vy = pool[base + 3];
    const depth = pool[base + 6];
    const speed = pool[base + 5] * settings.speed;

    // Smoothly apply wind influence
    const targetVx = sinAngle * speed + state.wind.x * (140 + depth * 150);
    const targetVy = cosAngle * speed + state.wind.y * (60 + depth * 50);
    vx += (targetVx - vx) * response;
    vy += (targetVy - vy) * response;

    const prevY = y;
    x += vx * dt;
    y += vy * dt;

    if (settings.splashes && prevY < height && y >= height && visibility[i] > 0.05) {
      const sBase = splashState.head * SPLASH_STRIDE;
      splashState.head = (splashState.head + 1) % maxSplashes;
      splashPool[sBase] = x;
      splashPool[sBase + 1] = height;
      splashPool[sBase + 2] = 0; // progress
      splashPool[sBase + 3] = 1 / (0.12 + depth * 0.08); // speed (duration ~0.12s to 0.20s)
      splashPool[sBase + 4] = (2.5 + depth * 4.5) * Math.max(0.4, Math.min(3, settings.dropThickness));
      splashPool[sBase + 5] = (0.25 + depth * 0.45) * visibility[i];
    }

    // Re-enter from the upwind side at the same height, outside the visible canvas.
    if (x > width + 100 || x < -100) {
      x = ((x + 100) % wrapWidth + wrapWidth) % wrapWidth - 100;
    }

    if (y > height + 60) {
      seedParticle(pool, i, state, settings, false);
    } else {
      pool[base] = x;
      pool[base + 1] = y;
      pool[base + 2] = vx;
      pool[base + 3] = vy;
    }
  }

  if (settings.splashes && dt > 0) {
    for (let s = 0; s < maxSplashes; s++) {
      const sBase = s * SPLASH_STRIDE;
      if (splashPool[sBase + 2] < 1) {
        splashPool[sBase + 2] += dt * splashPool[sBase + 3];
      }
    }
  }
}

function drawPool(
  pool: Float32Array,
  count: number,
  state: FrameState,
  settings: RainSettings,
  visibility: Float32Array,
  splashPool: Float32Array,
  maxSplashes: number,
): void {
  if (count === 0 && (!settings.splashes || maxSplashes === 0)) return;

  const ctx = state.ctx;
  ctx.strokeStyle = settings.color;
  ctx.lineCap = 'round';

  if (count > 0) {
    for (let i = 0; i < count; i++) {
      if (visibility[i] === 0) continue;
      const base = i * PARTICLE_STRIDE;
      const x = pool[base];
      const y = pool[base + 1];
      const vx = pool[base + 2];
      const vy = pool[base + 3];
      const depth = pool[base + 6];
      const trailFactor = (0.012 + depth * 0.025) * settings.dropLength;
      const fade = Math.max(0, Math.min(1, (y + 25) / 45, (state.height + 35 - y) / 80));

      // Short tapered segments approximate a fading trail without per-frame gradients.
      for (let segment = 0; segment < 3; segment++) {
        const start = (segment / 3) * trailFactor;
        const end = ((segment + 1) / 3) * trailFactor;
        ctx.globalAlpha = pool[base + 4] * fade * visibility[i] * Math.pow(1 - segment / 3, 2);
        ctx.lineWidth = (0.6 + depth * 1.1) * (1 - segment * 0.2) * settings.dropThickness;
        ctx.beginPath();
        ctx.moveTo(x - vx * start, y - vy * start);
        ctx.lineTo(x - vx * end, y - vy * end);
        ctx.stroke();
      }
    }
  }

  if (settings.splashes) {
    ctx.fillStyle = settings.color;
    const angleRad = (settings.angle * Math.PI) / 180;
    const sinAngle = Math.sin(angleRad);

    for (let s = 0; s < maxSplashes; s++) {
      const sBase = s * SPLASH_STRIDE;
      const progress = splashPool[sBase + 2];
      if (progress >= 1 || progress <= 0) continue;

      const x = splashPool[sBase];
      const y = splashPool[sBase + 1];
      const size = splashPool[sBase + 4];
      const alpha = splashPool[sBase + 5] * (1 - progress);
      if (alpha <= 0.01) continue;

      ctx.globalAlpha = alpha;
      ctx.lineWidth = Math.max(0.4, 0.8 * settings.dropThickness * (1 - progress * 0.5));

      // Ground ripple crescent (curving upwards along bottom edge)
      const rx = size * (0.6 + progress * 1.4);
      const ry = rx * 0.35;
      ctx.beginPath();
      ctx.ellipse(x, y, rx, ry, 0, Math.PI, Math.PI * 2);
      ctx.stroke();

      // Splash beads leaping upward in a parabolic bounce
      const arc = Math.sin(progress * Math.PI);
      const dotR = Math.max(0.3, 0.9 * settings.dropThickness * (1 - progress * 0.6));

      const leftX = x - rx * 0.85 + sinAngle * 4 * progress;
      const leftY = y - size * 1.6 * arc;
      const rightX = x + rx * 0.85 + sinAngle * 4 * progress;
      const rightY = y - size * 1.4 * arc;
      const midX = x + sinAngle * 6 * progress;
      const midY = y - size * 2.2 * arc;

      ctx.beginPath();
      ctx.arc(leftX, leftY, dotR, 0, Math.PI * 2);
      ctx.arc(rightX, rightY, dotR, 0, Math.PI * 2);
      ctx.arc(midX, midY, dotR, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.globalAlpha = 1;
}

export function Rain({
  intensity = 0.7,
  transitionDuration = 0,
  angle = 10,
  color = 'rgba(190, 215, 245, 0.8)',
  speed = 1,
  dropLength,
  length,
  dropThickness,
  thickness,
  splashes,
  splash,
}: RainProps) {
  const ticker = useContext(TickerCtx);

  if (!ticker) {
    throw new Error('<Rain /> must be used inside <WeatherCanvas>');
  }

  const effectiveDropLength = dropLength ?? length ?? 1;
  const effectiveDropThickness = dropThickness ?? thickness ?? 1;
  const effectiveSplashes = splashes ?? splash ?? false;

  const settingsRef = useRef<RainSettings>({
    intensity,
    transitionDuration,
    angle,
    color,
    speed,
    dropLength: effectiveDropLength,
    dropThickness: effectiveDropThickness,
    splashes: effectiveSplashes,
  });

  useEffect(() => {
    settingsRef.current = {
      intensity,
      transitionDuration,
      angle,
      color,
      speed,
      dropLength: effectiveDropLength,
      dropThickness: effectiveDropThickness,
      splashes: effectiveSplashes,
    };
    ticker.invalidate();
  }, [
    ticker,
    intensity,
    transitionDuration,
    angle,
    color,
    speed,
    effectiveDropLength,
    effectiveDropThickness,
    effectiveSplashes,
  ]);

  useEffect(() => {
    const capacity = ticker.getBudget().maxParticles;
    let pool = createParticlePool(capacity);
    const particles = createParticleTransition(
      Math.round(Math.max(0, Math.min(1, settingsRef.current.intensity)) * capacity),
      capacity,
      settingsRef.current.transitionDuration,
    );
    let initializedCount = 0;
    const maxSplashes = Math.min(128, Math.max(32, Math.round(capacity * 0.5)));
    const splashPool = new Float32Array(maxSplashes * SPLASH_STRIDE);
    const splashState = { head: 0 };

    const unregister = ticker.register(LAYER.MIDGROUND, (state) => {
      const settings = settingsRef.current;
      const targetCount = Math.round(
        Math.max(0, Math.min(1, settings.intensity)) * state.budget.maxParticles,
      );
      updateParticleTransition(particles, targetCount, settings.transitionDuration, state);
      const count = particles.count;

      pool = growParticlePool(pool, state.budget.maxParticles);
      if (count > initializedCount) {
        seedParticleRange(pool, initializedCount, count, state, settings);
        initializedCount = count;
      }

      if (state.dt > 0) {
        updatePool(
          pool,
          count,
          state,
          settings,
          particles.visibility,
          splashPool,
          maxSplashes,
          splashState,
        );
      }
      drawPool(pool, count, state, settings, particles.visibility, splashPool, maxSplashes);
    });

    return unregister;
  }, [ticker]);

  return null;
}
