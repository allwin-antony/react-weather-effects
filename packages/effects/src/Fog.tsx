import { useContext, useEffect, useRef } from 'react';
import {
  type FrameState,
  LAYER,
  TickerCtx,
} from '@react-weather-overlays/core';

export interface FogProps {
  density?: number;
  speed?: number;
  color?: string;
  layers?: number;
}

interface FogSettings {
  density: number;
  speed: number;
  color: string;
  layers: number;
}

interface FogPuff {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  baseSpeed: number;
  alpha: number;
  phase: number;
}

function createOffscreenSurface(size: number): HTMLCanvasElement | OffscreenCanvas | null {
  if (typeof OffscreenCanvas !== 'undefined') {
    return new OffscreenCanvas(size, size);
  }
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    return canvas;
  }
  return null;
}

function renderRadialGradient(
  surface: HTMLCanvasElement | OffscreenCanvas,
  size: number,
  color: string,
): void {
  const ctx = surface.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
  if (!ctx) return;

  ctx.clearRect(0, 0, size, size);
  for (let i = 0; i < 6; i++) {
    const x = size * (0.22 + i * 0.112);
    const y = size * (0.48 + Math.sin(i * 2.4) * 0.09);
    const radius = size * (0.18 + Math.sin(i * 1.7) * 0.03);
    const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
    grad.addColorStop(0, 'rgba(255, 255, 255, 0.85)');
    grad.addColorStop(0.4, 'rgba(255, 255, 255, 0.5)');
    grad.addColorStop(0.75, 'rgba(255, 255, 255, 0.1)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  // Tint the feathered mask without parsing CSS colors or introducing opaque rings.
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, size, size);
}

export function Fog({
  density = 0.4,
  speed = 1,
  color = 'rgba(220, 225, 235, 0.35)',
  layers = 3,
}: FogProps) {
  const ticker = useContext(TickerCtx);

  if (!ticker) {
    throw new Error('<Fog /> must be used inside <WeatherCanvas>');
  }

  const settingsRef = useRef<FogSettings>({ density, speed, color, layers });

  useEffect(() => {
    settingsRef.current = { density, speed, color, layers };
    ticker.invalidate();
  }, [ticker, density, speed, color, layers]);

  // Cached texture
  const textureRef = useRef<CanvasImageSource | null>(null);
  const imageBitmapRef = useRef<ImageBitmap | null>(null);

  // Regenerate texture whenever ticker or color changes
  useEffect(() => {
    let isMounted = true;
    const budget = ticker.getBudget();
    const textureSize = budget.quality === 'low' ? 256 : budget.quality === 'high' ? 512 : 384;

    const surface = createOffscreenSurface(textureSize);
    if (!surface) return;

    renderRadialGradient(surface, textureSize, color);
    textureRef.current = surface;
    ticker.invalidate();

    // Optional ImageBitmap conversion with asset tracking
    if (typeof createImageBitmap === 'function') {
      const assetTask = (async () => {
        try {
          const bitmap = await createImageBitmap(surface);
          if (!isMounted) {
            bitmap.close();
            return;
          }
          if (imageBitmapRef.current) {
            imageBitmapRef.current.close();
          }
          imageBitmapRef.current = bitmap;
          textureRef.current = bitmap;
          ticker.invalidate();
        } catch {
          // Graceful fallback: retain usable offscreen canvas surface
        }
      })();

      const releaseTask = ticker.trackAsset(assetTask);

      return () => {
        isMounted = false;
        releaseTask();
        if (imageBitmapRef.current) {
          imageBitmapRef.current.close();
          imageBitmapRef.current = null;
        }
        textureRef.current = null;
      };
    }

    return () => {
      isMounted = false;
      textureRef.current = null;
    };
  }, [ticker, color]);

  useEffect(() => {
    const puffs: FogPuff[] = [];
    const unregister = ticker.register(LAYER.BACKGROUND, (state: FrameState) => {
      const texture = textureRef.current;
      if (!texture) return;

      const settings = settingsRef.current;
      const numLayers = Math.round(Math.max(1, Math.min(6, settings.layers)));
      const count = numLayers * 3;
      const baseAlpha = Math.max(0, Math.min(1, settings.density));
      if (baseAlpha === 0) return;

      // Normalized positions resize with the canvas; new layers retain existing wisps.
      for (let i = puffs.length; i < count; i++) {
        const layer = Math.floor(i / 3);
        puffs.push({
          x: (i % 3) * 0.55 - 0.05 + (state.random() - 0.5) * 0.25,
          y: 0.15 + (layer / numLayers) * 0.72 + (state.random() - 0.5) * 0.12,
          scaleX: 1 + state.random() * 0.7,
          scaleY: 0.65 + state.random() * 0.55,
          baseSpeed: 8 + (layer + 1) * 7,
          alpha: 0.5 + state.random() * 0.4,
          phase: state.random() * Math.PI * 2,
        });
      }

      const dt = state.dt;

      // Update positions applying live settings.speed
      if (dt > 0) {
        for (let i = 0; i < count; i++) {
          const puff = puffs[i];
          const vx = puff.baseSpeed * settings.speed + state.wind.x * 35;
          puff.x += (vx * dt) / state.width;
          puff.phase += dt * 0.12 * settings.speed;
          const margin = Math.max(320 / state.width, 0.65) * puff.scaleX * 0.55;
          const totalWidth = 1 + margin * 2;

          if (puff.x > 1 + margin || puff.x < -margin) {
            puff.x = ((puff.x + margin) % totalWidth + totalWidth) % totalWidth - margin;
          }
        }
      }

      // Draw fog puffs
      const ctx = state.ctx;

      for (let i = 0; i < count; i++) {
        const puff = puffs[i];
        const drawW = Math.max(320, state.width * 0.65) * puff.scaleX * (1 + Math.sin(puff.phase) * 0.03);
        const drawH = Math.max(160, state.height * 0.55) * puff.scaleY;
        const y = puff.y * state.height + Math.sin(puff.phase) * drawH * 0.08;

        ctx.globalAlpha = baseAlpha * puff.alpha * (0.9 + Math.sin(puff.phase * 0.7) * 0.1);
        ctx.drawImage(texture, puff.x * state.width - drawW / 2, y - drawH / 2, drawW, drawH);
      }

      ctx.globalAlpha = 1.0;
    });

    return unregister;
  }, [ticker]);

  return null;
}
