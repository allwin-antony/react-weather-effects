import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  resolveRenderBudget,
  clampDPR,
  QUALITY_LIMITS,
} from '../packages/core/src/budget';

describe('Render Budget', () => {
  beforeEach(() => {
    vi.stubGlobal('devicePixelRatio', 3);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('clamps DPR according to weights', () => {
    // window.devicePixelRatio is 3
    expect(clampDPR('light')).toBe(2);
    expect(clampDPR('normal')).toBe(2);
    expect(clampDPR('heavy')).toBe(1.5);
  });

  it('resolves budget with quality limits', () => {
    // low quality caps maxParticles at 150 and DPR cap at 1
    const low = resolveRenderBudget('low', 'normal');
    expect(low.maxParticles).toBe(QUALITY_LIMITS.low.maxParticles);
    expect(low.dpr).toBe(1);

    // medium quality caps maxParticles at 300 and DPR cap at 2
    const med = resolveRenderBudget('medium', 'normal');
    expect(med.maxParticles).toBe(QUALITY_LIMITS.medium.maxParticles);
    expect(med.dpr).toBe(2);

    // high quality + heavy dpr weight -> min(1.5, 2) = 1.5
    const highHeavy = resolveRenderBudget('high', 'heavy');
    expect(highHeavy.maxParticles).toBe(QUALITY_LIMITS.high.maxParticles);
    expect(highHeavy.dpr).toBe(1.5);
  });
});
