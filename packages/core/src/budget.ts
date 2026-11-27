export type Quality = 'low' | 'medium' | 'high';
/** @deprecated Pass a numeric maximum device pixel ratio to `dpr` instead. 'light' and 'normal' map to 2, 'heavy' to 1.5. */
export type DPRWeight = 'light' | 'normal' | 'heavy';

/** Maximum device pixel ratio (for example `1`, `1.5`, or `2`), or a deprecated `DPRWeight` name. */
export type DPRCap = number | DPRWeight;

export const DEFAULT_DPR_CAP = 2;

const LEGACY_DPR_CAPS: Record<DPRWeight, number> = { light: 2, normal: 2, heavy: 1.5 };

/** Resolve a `dpr` prop to a positive numeric cap; invalid values use the default. */
export function resolveDPRCap(cap: DPRCap = DEFAULT_DPR_CAP): number {
  if (typeof cap === 'string') return LEGACY_DPR_CAPS[cap] ?? DEFAULT_DPR_CAP;
  return Number.isFinite(cap) && cap > 0 ? cap : DEFAULT_DPR_CAP;
}

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

export function clampDPR(cap: DPRCap = DEFAULT_DPR_CAP): number {
  if (typeof window === 'undefined') return 1;
  const raw = window.devicePixelRatio ?? 1;
  return Math.min(raw, resolveDPRCap(cap));
}

export function resolveRenderBudget(
  quality: Quality = 'medium',
  dprCap: DPRCap = DEFAULT_DPR_CAP,
): RenderBudget {
  const limits = QUALITY_LIMITS[quality];
  const dpr = Math.min(clampDPR(dprCap), limits.dprCap);
  return {
    maxParticles: limits.maxParticles,
    dpr,
    quality,
  };
}
