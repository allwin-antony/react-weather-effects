import { useContext, useEffect, useRef } from 'react';
import {
  createParticlePool,
  type FrameState,
  growParticlePool,
  LAYER,
  PARTICLE_STRIDE,
  TickerCtx,
} from '@react-weather-effects/core';
import { useLayeredDraw } from './useLayeredDraw';
import { createParticleTransition, updateParticleTransition } from './transition';

export interface SnowProps {
  intensity?: number;
  /** Intensity fade duration in milliseconds; 0 (default) applies changes immediately. */
  transitionDuration?: number;
  speed?: number;
  color?: string;
  /**
   * Static image URL with original colors preserved. Remote images must allow CORS.
   * Cached as a raster texture up to 1024px per side; animated images use a snapshot.
   *
   * @tip To avoid a brief initial flash of built-in circular flakes while your image downloads,
   * preload it in your document `<head>`: `<link rel="preload" as="image" href="/path/to/flake.png" />`.
   * Preloaded or cached images initialize the sprite texture synchronously on frame 0.
   */
  sprite?: string;
  /** Radius in CSS pixels; defaults to 6 for sprites, 1.5 for built-in flakes. */
  minSize?: number;
  /** Radius in CSS pixels; defaults to 18 for sprites, 4 for built-in flakes. */
  maxSize?: number;
  /** Enable animated sideways sway and fall flutter. Defaults to true. */
  wobble?: boolean;
  /**
   * Enable sprite rotation / spinning.
   * Defaults to `wobble` (enabled when wobble is enabled).
   * Set to `false` to let sprites drift without rotating, or `true` with `wobble={false}` to rotate without swaying.
   */
  rotation?: boolean;
  /**
   * Multiplier for sprite rotation / spinning speed.
   * Defaults to 1. Set to 0 to freeze rotation.
   */
  rotationSpeed?: number;
  /**
   * Draw order within the canvas; lower values draw first (behind).
   * Defaults to LAYER.MIDGROUND (100).
   */
  layer?: number;
}

interface SnowSettings {
  intensity: number;
  transitionDuration: number;
  speed: number;
  color: string;
  minSize: number;
  maxSize: number;
  wobble: boolean;
  rotation: boolean;
  rotationSpeed: number;
}

interface SnowSprite {
  image: HTMLImageElement;
  texture: HTMLCanvasElement;
  aspect: number;
  requestedSize: number;
}

function getSnowSpriteSize(settings: SnowSettings, dpr: number): number {
  const diameter = Math.max(0, settings.minSize, settings.maxSize) * 2 * dpr;
  // Buckets avoid tiny resize rebuilds; 1024 squared RGBA pixels need at most 4 MiB.
  return Math.min(1024, Math.max(64, 2 ** Math.ceil(Math.log2(diameter || 1))));
}

function createSnowSprite(image: HTMLImageElement, size: number): SnowSprite | null {
  if (typeof document === 'undefined') return null;

  try {
    const aspect = image.naturalWidth / image.naturalHeight;
    const texture = document.createElement('canvas');
    texture.width = Math.max(1, Math.ceil(size * Math.min(1, aspect)));
    texture.height = Math.max(1, Math.ceil(size / Math.max(1, aspect)));
    const ctx = texture.getContext('2d');
    if (!ctx) return null;

    // Render vectors and filters once, rather than for every flake on every frame.
    ctx.drawImage(image, 0, 0, texture.width, texture.height);
    return { image, texture, aspect, requestedSize: size };
  } catch {
    return null;
  }
}

function createSnowTexture(color: string): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;

  const surface = document.createElement('canvas');
  surface.width = surface.height = 64;
  const ctx = surface.getContext('2d');
  if (!ctx) return null;

  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
  gradient.addColorStop(0.25, 'rgba(255, 255, 255, 0.95)');
  gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.55)');
  gradient.addColorStop(0.75, 'rgba(255, 255, 255, 0.15)');
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 64, 64);
  return surface;
}

function seedSnowflake(
  pool: Float32Array,
  i: number,
  state: FrameState,
  isInitial: boolean,
): void {
  const base = i * PARTICLE_STRIDE;
  // Smaller, distant flakes drift more slowly than foreground flakes.
  const depth = Math.pow(state.random(), 1.5);
  const fallSpeed = 22 + depth * 54 + state.random() * 12;

  let x: number;
  let y: number;

  if (isInitial) {
    x = state.random() * (state.width + 100) - 50;
    y = state.random() * (state.height + 50) - 25;
  } else {
    const windX = state.wind.x;
    const vFlux = Math.max(20, fallSpeed) * state.width;
    const hFlux = Math.abs(windX * 90) * state.height;
    const sideRatio = hFlux / (vFlux + hFlux);

    if (state.random() < sideRatio) {
      x = windX > 0 ? -20 - state.random() * 30 : state.width + 20 + state.random() * 30;
      y = state.random() * (state.height + 50) - 25;
    } else {
      x = state.random() * (state.width + 100) - 50;
      y = -20 - state.random() * 50;
    }
  }

  const phase = state.random() * Math.PI * 2;

  pool[base] = x;
  pool[base + 1] = y;
  pool[base + 2] = phase; // rotation angle
  pool[base + 3] = fallSpeed; // intrinsic fall speed
  pool[base + 4] = 0.3 + depth * 0.6; // alpha
  pool[base + 5] = phase; // wobble phase
  pool[base + 6] = depth;
}

function seedSnowRange(
  pool: Float32Array,
  startIndex: number,
  endIndex: number,
  state: FrameState,
): void {
  for (let i = startIndex; i < endIndex; i++) {
    seedSnowflake(pool, i, state, true);
  }
}

function updateSnow(
  pool: Float32Array,
  count: number,
  state: FrameState,
  settings: SnowSettings,
): void {
  const dt = state.dt;
  const width = state.width;
  const height = state.height;
  const wrapWidth = width + 100;
  const gust = 1 + Math.sin(state.timestamp * 0.0004) * 0.2;

  for (let i = 0; i < count; i++) {
    const base = i * PARTICLE_STRIDE;
    let x = pool[base];
    let y = pool[base + 1];
    let angle = pool[base + 2];
    let phase = pool[base + 5];
    const baseVy = pool[base + 3];
    const depth = pool[base + 6];

    if (settings.wobble) {
      phase += dt * (0.65 + depth * 1.4) * settings.speed;
      pool[base + 5] = phase;
    }

    if (settings.rotation && settings.rotationSpeed !== 0) {
      const spinDir = i % 2 === 0 ? 1 : -1;
      const spinRate = (0.65 + depth * 1.4) * spinDir;
      angle += dt * spinRate * settings.rotationSpeed;
    }

    const sway = settings.wobble
      ? (Math.sin(phase) * (10 + depth * 22) + Math.sin(phase * 0.5) * 8) * settings.speed
      : 0;
    const vx = sway + state.wind.x * (50 + depth * 80) * gust;
    const flutter = settings.wobble ? 1 + Math.sin(phase * 0.8) * 0.12 : 1;
    const vy = baseVy * settings.speed * flutter;

    x += vx * dt;
    y += (vy + state.wind.y * 30) * dt;

    // Preserve horizontal coverage without restarting flakes at the top.
    if (x > width + 50 || x < -50) {
      x = ((x + 50) % wrapWidth + wrapWidth) % wrapWidth - 50;
    }

    if (y > height + 30) {
      seedSnowflake(pool, i, state, false);
    } else {
      pool[base] = x;
      pool[base + 1] = y;
      pool[base + 2] = angle;
    }
  }
}

function drawSnow(
  pool: Float32Array,
  count: number,
  state: FrameState,
  settings: SnowSettings,
  texture: CanvasImageSource | null,
  sprite: SnowSprite | null,
  visibility: Float32Array,
): void {
  if (count === 0) return;

  const ctx = state.ctx;
  const aspect = sprite ? sprite.aspect : 1;
  ctx.fillStyle = settings.color;

  for (let i = 0; i < count; i++) {
    if (visibility[i] === 0) continue;
    const base = i * PARTICLE_STRIDE;
    const x = pool[base];
    const y = pool[base + 1];
    const depth = pool[base + 6];
    const r = Math.max(0, settings.minSize + depth * (settings.maxSize - settings.minSize));
    if (r === 0) continue;

    const fade = Math.max(0, Math.min(1, (y + 20) / 45, (state.height + 20 - y) / 55));
    ctx.globalAlpha = pool[base + 4] * fade * visibility[i];
    if (sprite) {
      const halfWidth = r * Math.min(1, aspect);
      const halfHeight = r / Math.max(1, aspect);
      ctx.save();
      try {
        ctx.translate(x, y);
        if (settings.rotation) ctx.rotate(pool[base + 2]);
        ctx.drawImage(sprite.texture, -halfWidth, -halfHeight, halfWidth * 2, halfHeight * 2);
      } finally {
        ctx.restore();
      }
    } else if (texture) {
      const radius = r * 1.55;
      ctx.drawImage(texture, x - radius, y - radius, radius * 2, radius * 2);
    } else {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.globalAlpha = 1;
}

export function Snow({
  intensity = 0.5,
  transitionDuration = 0,
  speed = 1,
  color = 'rgba(255, 255, 255, 0.85)',
  sprite,
  minSize = sprite ? 6 : 1.5,
  maxSize = sprite ? 18 : 4,
  wobble = true,
  rotation,
  rotationSpeed,
  layer = LAYER.MIDGROUND,
}: SnowProps) {
  const ticker = useContext(TickerCtx);

  if (!ticker) {
    throw new Error('<Snow /> must be used inside <WeatherCanvas>');
  }

  const drawRef = useLayeredDraw(ticker, layer);

  const effectiveRotation = rotation ?? (rotationSpeed !== undefined ? true : wobble);
  const effectiveRotationSpeed = rotationSpeed ?? 1;

  const settingsRef = useRef<SnowSettings>({
    intensity,
    transitionDuration,
    speed,
    color,
    minSize,
    maxSize,
    wobble,
    rotation: effectiveRotation,
    rotationSpeed: effectiveRotationSpeed,
  });
  const textureRef = useRef<CanvasImageSource | null>(null);
  const spriteRef = useRef<SnowSprite | null>(null);

  useEffect(() => {
    settingsRef.current = {
      intensity,
      transitionDuration,
      speed,
      color,
      minSize,
      maxSize,
      wobble,
      rotation: effectiveRotation,
      rotationSpeed: effectiveRotationSpeed,
    };
    ticker.invalidate();
  }, [
    ticker,
    intensity,
    transitionDuration,
    speed,
    color,
    minSize,
    maxSize,
    wobble,
    effectiveRotation,
    effectiveRotationSpeed,
  ]);

  useEffect(() => {
    textureRef.current = createSnowTexture(color);
    ticker.invalidate();
    return () => {
      textureRef.current = null;
    };
  }, [ticker, color]);

  useEffect(() => {
    if (!sprite || typeof Image === 'undefined') return;

    let isMounted = true;
    let settle!: () => void;
    const image = new Image();
    image.crossOrigin = 'anonymous';

    const applyLoadedImage = () => {
      if (isMounted && image.naturalWidth > 0 && image.naturalHeight > 0) {
        spriteRef.current = createSnowSprite(
          image,
          getSnowSpriteSize(settingsRef.current, ticker.getBudget().dpr),
        );
        ticker.invalidate();
      }
    };

    const task = new Promise<void>((resolve) => {
      settle = resolve;
      image.onload = () => {
        applyLoadedImage();
        resolve();
      };
      image.onerror = () => { resolve(); };
    });
    const releaseTask = ticker.trackAsset(task);
    image.src = sprite;

    if (image.complete && image.naturalWidth > 0 && image.naturalHeight > 0) {
      applyLoadedImage();
    }

    return () => {
      isMounted = false;
      image.onload = null;
      image.onerror = null;
      image.removeAttribute('src');
      spriteRef.current = null;
      settle();
      releaseTask();
    };
  }, [ticker, sprite]);

  useEffect(() => {
    const capacity = ticker.getBudget().maxParticles;
    let pool = createParticlePool(capacity);
    const particles = createParticleTransition(
      Math.round(Math.max(0, Math.min(1, settingsRef.current.intensity)) * capacity),
      capacity,
      settingsRef.current.transitionDuration,
    );
    let initializedCount = 0;

    drawRef.current = (state) => {
      const settings = settingsRef.current;
      const targetCount = Math.round(
        Math.max(0, Math.min(1, settings.intensity)) * state.budget.maxParticles,
      );
      updateParticleTransition(particles, targetCount, settings.transitionDuration, state);
      const count = particles.count;

      pool = growParticlePool(pool, state.budget.maxParticles);
      if (count > initializedCount) {
        seedSnowRange(pool, initializedCount, count, state);
        initializedCount = count;
      }

      if (state.dt > 0) {
        updateSnow(pool, count, state, settings);
      }

      const cachedSprite = spriteRef.current;
      if (cachedSprite && count > 0) {
        const size = getSnowSpriteSize(settings, state.dpr);
        if (size > cachedSprite.requestedSize) {
          // Remember failed upgrades too, so allocation failures aren't retried every frame.
          cachedSprite.requestedSize = size;
          spriteRef.current = createSnowSprite(cachedSprite.image, size) ?? cachedSprite;
        }
      }
      drawSnow(pool, count, state, settings, textureRef.current, spriteRef.current, particles.visibility);
    };

    return () => {
      drawRef.current = null;
    };
  }, [ticker, drawRef]);

  return null;
}
