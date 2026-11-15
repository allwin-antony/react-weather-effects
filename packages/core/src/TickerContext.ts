import React from 'react';
import type { RenderBudget } from './budget';

export interface FrameState {
  ctx: CanvasRenderingContext2D;
  dt: number; // seconds; capped at 0.1s; 0 on first frame after pause
  width: number; // CSS pixels
  height: number; // CSS pixels
  dpr: number; // clamped DPR applied by engine
  budget: Readonly<RenderBudget>; // current per-canvas quality settings
  wind: Readonly<{ x: number; y: number }>;
  pointer: Readonly<{ x: number; y: number }> | null; // null in v0.1
  timestamp: number; // simulation ms since scene start; excludes paused time
  random: () => number; // seeded PRNG — never use Math.random() in effects
}

export type DrawFn = (state: Readonly<FrameState>) => void;

export interface TickerContext {
  /**
   * Register a draw function at a given layer priority.
   * Returns an idempotent cleanup function that unregisters it.
   */
  register: (layer: number, fn: DrawFn) => () => void;

  /** Mark the scene dirty; coalesce render-only updates without stepping simulation. */
  invalidate: () => void;

  /** Read this canvas's latest budget during effect setup; stable getter identity. */
  getBudget: () => Readonly<RenderBudget>;

  /** Track async texture initialization for the internal capture-readiness barrier. */
  trackAsset: (task: Promise<void>) => () => void;
}

export const LAYER = {
  BACKGROUND: 0,
  MIDGROUND: 100,
  FOREGROUND: 200,
} as const;

export const TickerCtx = React.createContext<TickerContext | null>(null);
