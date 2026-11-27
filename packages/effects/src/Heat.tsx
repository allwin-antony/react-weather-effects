import { useContext, useEffect, useRef } from 'react';
import {
  type FrameState,
  LAYER,
  TickerCtx,
} from '@react-weather-effects/core';
import { useLayeredDraw } from './useLayeredDraw';
import { createTransition, stepTransition } from './transition';

export interface HeatProps {
  /**
   * Overall intensity of the heat effect (0 to 1).
   * Controls refraction amplitude and atmospheric haze opacity.
   * Defaults to 0.5.
   */
  intensity?: number;

  /**
   * Heat wave animation speed multiplier.
   * Defaults to 1.
   */
  speed?: number;

  /**
   * Color of the subtle atmospheric haze, including its opacity.
   * Defaults to 'rgba(255, 225, 180, 0.08)'.
   */
  color?: string;

  /**
   * Optional image URL to refract. Match a centered, cover-sized CSS background.
   * Use a same-origin or CORS-enabled image; without one, only haze is drawn.
   */
  backgroundImage?: string;

  /** Ground horizon as a fraction of canvas height (0 to 1). Defaults to 0.55. */
  horizon?: number;

  /**
   * Duration in milliseconds to smoothly transition intensity changes.
   * Defaults to 0 (immediate).
   */
  transitionDuration?: number;

  /**
   * Enable a thin, feathered mirage band just below the horizon.
   * Defaults to true.
   */
  mirage?: boolean;

  /**
   * Enable slow, rising hot-air refraction.
   * Defaults to true.
   */
  shimmer?: boolean;

  /**
   * Enable fine-scale air turbulence, not visible vapor particles.
   * Defaults to true.
   */
  wisps?: boolean;

  /**
   * Draw order within the canvas; lower values draw first (behind).
   * Defaults to LAYER.BACKGROUND (0).
   */
  layer?: number;
}

interface HeatSettings {
  intensity: number;
  speed: number;
  color: string;
  horizon: number;
  transitionDuration: number;
  mirage: boolean;
  shimmer: boolean;
  wisps: boolean;
}

interface HeatBackground {
  source: CanvasImageSource;
  width: number;
  height: number;
}

function createSurface(width: number, height: number): HTMLCanvasElement | OffscreenCanvas | null {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(width, height);
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

export function Heat({
  intensity = 0.5,
  speed = 1,
  color = 'rgba(255, 225, 180, 0.08)',
  backgroundImage,
  horizon = 0.55,
  transitionDuration = 0,
  mirage = true,
  shimmer = true,
  wisps = true,
  layer = LAYER.BACKGROUND,
}: HeatProps = {}) {
  const ticker = useContext(TickerCtx);

  if (!ticker) {
    throw new Error('<Heat /> must be used inside <WeatherCanvas>');
  }

  const drawRef = useLayeredDraw(ticker, layer);

  const settingsRef = useRef<HeatSettings>({
    intensity,
    speed,
    color,
    horizon,
    transitionDuration,
    mirage,
    shimmer,
    wisps,
  });

  useEffect(() => {
    settingsRef.current = {
      intensity,
      speed,
      color,
      horizon,
      transitionDuration,
      mirage,
      shimmer,
      wisps,
    };
    ticker.invalidate();
  }, [ticker, intensity, speed, color, horizon, transitionDuration, mirage, shimmer, wisps]);

  const hazeRef = useRef<HTMLCanvasElement | OffscreenCanvas | null>(null);
  const backgroundRef = useRef<HeatBackground | null>(null);

  // Cache a feathered lens instead of stroking ribbons or drawing solid bubbles.
  useEffect(() => {
    const size = 128;
    const surface = createSurface(size, size);
    if (!surface) return;
    const ctx = surface.getContext('2d');
    if (!ctx) return;

    const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.7)');
    gradient.addColorStop(0.4, 'rgba(255, 255, 255, 0.3)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, size, size);
    hazeRef.current = surface;
    ticker.invalidate();

    return () => { hazeRef.current = null; };
  }, [ticker, color]);

  useEffect(() => {
    backgroundRef.current = null;
    ticker.invalidate();
    if (!backgroundImage || typeof Image === 'undefined') return;

    let isMounted = true;
    let installed = false;
    const image = new Image();
    image.crossOrigin = 'anonymous';
    let settle!: () => void;
    const task = new Promise<void>((resolve) => { settle = resolve; });
    const release = ticker.trackAsset(task);
    const installImage = () => {
      if (isMounted && !installed && image.naturalWidth > 0 && image.naturalHeight > 0) {
        installed = true;
        backgroundRef.current = { source: image, width: image.naturalWidth, height: image.naturalHeight };
        // Rasterize once: cropped SVG drawImage calls otherwise rerender the vector scene.
        const scale = Math.min(1, 2048 / Math.max(image.naturalWidth, image.naturalHeight));
        const width = Math.max(1, Math.round(image.naturalWidth * scale));
        const height = Math.max(1, Math.round(image.naturalHeight * scale));
        try {
          const surface = createSurface(width, height);
          const ctx = surface?.getContext('2d');
          if (surface && ctx) {
            ctx.drawImage(image, 0, 0, width, height);
            backgroundRef.current = { source: surface, width, height };
          }
        } catch {
          // Keep the decoded image usable if a raster surface cannot be allocated.
        }
        ticker.invalidate();
      }
      settle();
    };
    image.onload = installImage;
    image.onerror = () => {
      settle();
      if (isMounted) ticker.invalidate();
    };
    image.src = backgroundImage;
    if (image.complete && image.naturalWidth > 0 && image.naturalHeight > 0) installImage();

    return () => {
      isMounted = false;
      image.onload = image.onerror = null;
      image.removeAttribute('src');
      backgroundRef.current = null;
      release();
      settle();
    };
  }, [ticker, backgroundImage]);

  useEffect(() => {
    const phases: number[] = [];
    let simTime = 0;

    let currentIntensity = Number.isFinite(settingsRef.current.intensity)
      ? Math.max(0, Math.min(1, settingsRef.current.intensity)) : 0;
    const transition = createTransition(currentIntensity, settingsRef.current.transitionDuration);

    drawRef.current = (state: FrameState) => {
      const settings = settingsRef.current;
      const targetIntensity = Number.isFinite(settings.intensity)
        ? Math.max(0, Math.min(1, settings.intensity)) : 0;
      const step = stepTransition(transition, targetIntensity, settings.transitionDuration, state);
      currentIntensity = step === 1 ? targetIntensity : currentIntensity + (targetIntensity - currentIntensity) * step;

      if (currentIntensity <= 0 || state.width <= 0 || state.height <= 0) return;

      const currentSpeed = Number.isFinite(settings.speed) ? Math.max(0, settings.speed) : 0;

      if (state.isAnimating && state.dt > 0) {
        simTime += state.dt * currentSpeed;
      }

      while (phases.length < 3) phases.push(state.random() * Math.PI * 2);

      const ctx = state.ctx;
      const width = state.width;
      const height = state.height;
      const ground = Number.isFinite(settings.horizon)
        ? Math.max(0.1, Math.min(0.9, settings.horizon)) : 0.55;
      const haze = hazeRef.current;
      const image = backgroundRef.current;
      const hasImage = image !== null;
      const quality = state.budget.quality;

      ctx.save();
      try {
        if (hasImage) {
          // Sample cached scene pixels: no DOM capture or GPU readback.
          const scale = Math.min(image.width / width, image.height / height);
          const cropX = (image.width - width * scale) / 2;
          const cropY = (image.height - height * scale) / 2;

          if ((settings.shimmer || settings.wisps) && state.budget.maxParticles > 0) {
            const columns = Math.min(quality === 'low' ? 6 : quality === 'high' ? 14 : 10, state.budget.maxParticles);
            const rows = Math.max(1, Math.min(
              quality === 'low' ? 16 : quality === 'high' ? 36 : 24,
              Math.floor(state.budget.maxParticles / columns),
            ));
            const top = height * Math.max(0, ground - 0.2);
            const bottom = height * Math.min(1, ground + 0.45);
            const cellW = width / columns;
            const cellH = (bottom - top) / rows;
            ctx.globalAlpha = currentIntensity;

            for (let row = 0; row < rows; row++) {
              const y = top + row * cellH;
              const distance = ((y + cellH / 2) / height - ground) / 0.16;
              const envelope = Math.exp(-distance * distance);
              const amplitude = currentIntensity * (0.25 + envelope * 2.5);
              for (let column = 0; column < columns; column++) {
                const x = column * cellW;
                const flowX = x - simTime * state.wind.x * 22;
                const slow = settings.shimmer
                  ? Math.sin(y * 0.045 + flowX * 0.012 + simTime * 2.8 + phases[0]) +
                    Math.sin(y * 0.019 - flowX * 0.008 + simTime * 1.7 + phases[1]) * 0.5 : 0;
                const fine = settings.wisps
                  ? Math.sin(y * 0.13 + flowX * 0.037 + simTime * 6.5 + phases[2]) * 0.35 : 0;
                const offsetX = (slow * 0.55 + fine) * amplitude;
                const offsetY = (slow + fine) * amplitude * 0.6;
                const sx = Math.max(0, Math.min(image.width - cellW * scale, cropX + (x + offsetX) * scale));
                const sy = Math.max(0, Math.min(image.height - cellH * scale, cropY + (y + offsetY) * scale));
                ctx.drawImage(image.source, sx, sy, cellW * scale, cellH * scale, x, y, cellW, cellH);
              }
            }
          }

          if (settings.mirage) {
            const bandTop = height * (ground + 0.025);
            const bandHeight = height * Math.min(0.1, 1 - ground - 0.025);
            const rows = quality === 'low' ? 12 : quality === 'high' ? 28 : 20;
            const rowHeight = bandHeight / rows;
            for (let row = 0; row < rows; row++) {
              const progress = (row + 0.5) / rows;
              const y = bandTop + row * rowHeight;
              const sy = cropY + (height * ground - (y - bandTop) * 0.7) * scale;
              const ripple = Math.sin(row * 0.8 + simTime * 3 + phases[1]) * currentIntensity;
              ctx.globalAlpha = Math.sin(progress * Math.PI) ** 2 * currentIntensity * 0.22;
              // Reversed row order compresses a faint sky reflection below the horizon.
              ctx.drawImage(image.source, cropX, sy, width * scale, rowHeight * scale, 0, y + ripple, width, rowHeight + 0.5);
            }
          }
        }

        if (haze) {
          ctx.globalAlpha = currentIntensity * 0.35;
          ctx.drawImage(haze, -width * 0.1, height * (ground - 0.12), width * 1.2, height * 0.38);

          // Without scene pixels, use restrained, soft lenses rather than fake refraction.
          if (!hasImage && (settings.shimmer || settings.wisps)) {
            const count = Math.min(quality === 'low' ? 6 : quality === 'high' ? 14 : 10, state.budget.maxParticles);
            for (let i = 0; i < count; i++) {
              const phase = phases[i % 3] + i * 2.4;
              const rise = ((simTime * 0.08 + phase / (Math.PI * 2)) % 1 + 1) % 1;
              const x = ((i * 0.61803398875 + phases[0] / (Math.PI * 2)) % 1) * width +
                Math.sin(simTime + phase) * 6 + state.wind.x * rise * 18;
              const y = height * (ground + 0.22 - rise * 0.36);
              const drawW = Math.max(40, width * 0.09) * (0.8 + rise * 0.5);
              const drawH = height * (settings.shimmer ? 0.24 : 0.08);
              ctx.globalAlpha = currentIntensity * Math.sin(rise * Math.PI) ** 2 * 0.3;
              ctx.drawImage(haze, x - drawW / 2, y - drawH / 2, drawW, drawH);
            }
          }
          if (!hasImage && settings.mirage) {
            ctx.globalAlpha = currentIntensity * 0.45;
            ctx.drawImage(haze, -width * 0.1, height * (ground + 0.025), width * 1.2, height * 0.07);
          }
        }
      } finally {
        ctx.restore();
      }
    };

    return () => {
      drawRef.current = null;
    };
  }, [ticker, drawRef]);

  return null;
}
