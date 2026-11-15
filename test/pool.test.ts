import { describe, it, expect } from 'vitest';
import {
  createParticlePool,
  growParticlePool,
  resetParticle,
  PARTICLE_STRIDE,
} from '../packages/core/src/pool';

describe('Particle Pool', () => {
  it('creates particle pool with correct stride', () => {
    const pool = createParticlePool(10);
    expect(pool.length).toBe(10 * PARTICLE_STRIDE);
    expect(PARTICLE_STRIDE).toBe(7);
  });

  it('resets particle attributes correctly with zero allocations', () => {
    const pool = createParticlePool(5);
    resetParticle(pool, 2, 100, 200, 15, -25, 3.5);

    const base = 2 * PARTICLE_STRIDE;
    expect(pool[base]).toBe(100);
    expect(pool[base + 1]).toBe(200);
    expect(pool[base + 2]).toBe(15);
    expect(pool[base + 3]).toBe(-25);
    expect(pool[base + 4]).toBe(1); // alpha
    expect(pool[base + 5]).toBe(0); // life elapsed
    expect(pool[base + 6]).toBe(3.5); // maxLife
  });

  it('grows particle pool while preserving existing particle data', () => {
    const pool = createParticlePool(2);
    resetParticle(pool, 0, 10, 20, 1, 2, 3);
    resetParticle(pool, 1, 30, 40, 4, 5, 6);

    const grown = growParticlePool(pool, 4);
    expect(grown.length).toBe(4 * PARTICLE_STRIDE);

    // Existing data preserved
    expect(grown[0]).toBe(10);
    expect(grown[1]).toBe(20);
    expect(grown[PARTICLE_STRIDE]).toBe(30);
    expect(grown[PARTICLE_STRIDE + 1]).toBe(40);

    // If requested count is less than or equal to current capacity, returns same instance
    const unchanged = growParticlePool(grown, 3);
    expect(unchanged).toBe(grown);
  });
});
