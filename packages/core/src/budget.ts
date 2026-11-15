export type Quality = 'low' | 'medium' | 'high';
export type DPRWeight = 'light' | 'normal' | 'heavy';

export interface RenderBudget {
  readonly maxParticles: number;
  readonly dpr: number;
  readonly quality: Quality;
}

export const QUALITY_LIMITS = {
  low: { maxParticles: 150, dprCap: 1 },
  medium: { maxParticles: 300, dprCap: 2 },
  high: { maxParticles: 600, dprCap: 2 },
} as const;

export function clampDPR(weight: DPRWeight = 'normal'): number {
  if (typeof window === 'undefined') return 1;
  const raw = window.devicePixelRatio ?? 1;
  const caps: Record<DPRWeight, number> = { light: 2, normal: 2, heavy: 1.5 };
  return Math.min(raw, caps[weight]);
}

export function resolveRenderBudget(
  quality: Quality = 'medium',
  dprWeight: DPRWeight = 'normal',
): RenderBudget {
  const limits = QUALITY_LIMITS[quality];
  const dpr = Math.min(clampDPR(dprWeight), limits.dprCap);
  return {
    maxParticles: limits.maxParticles,
    dpr,
    quality,
  };
}
