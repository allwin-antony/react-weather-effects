import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  resolveRenderBudget,
  clampDPR,
  resolveDPRCap,
  QUALITY_LIMITS,
} from '../packages/core/src/budget';

describe('Render Budget', () => {
  beforeEach(() => {
    vi.stubGlobal('devicePixelRatio', 3);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('clamps DPR to a numeric cap', () => {
    // window.devicePixelRatio is 3
    expect(clampDPR()).toBe(2);
    expect(clampDPR(1.5)).toBe(1.5);
    expect(clampDPR(1)).toBe(1);
    expect(clampDPR(4)).toBe(3);
  });

  it('falls back to the default cap for invalid numbers', () => {
    expect(resolveDPRCap(0)).toBe(2);
    expect(resolveDPRCap(-1)).toBe(2);
    expect(resolveDPRCap(Number.NaN)).toBe(2);
  });

  it('keeps deprecated DPR names working', () => {
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

    // high quality + 1.5 dpr cap -> min(1.5, 2) = 1.5
    const highHeavy = resolveRenderBudget('high', 1.5);
    expect(highHeavy.maxParticles).toBe(QUALITY_LIMITS.high.maxParticles);
    expect(highHeavy.dpr).toBe(1.5);
  });
});
