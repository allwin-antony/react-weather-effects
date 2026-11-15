import { describe, it, expect } from 'vitest';
import { createSeededRandom, hashString } from '../packages/core/src/random';

describe('Seeded PRNG', () => {
  it('produces deterministic pseudo-random sequences for string seeds', () => {
    const rng1 = createSeededRandom('test-seed-123');
    const rng2 = createSeededRandom('test-seed-123');

    const seq1 = [rng1(), rng1(), rng1(), rng1(), rng1()];
    const seq2 = [rng2(), rng2(), rng2(), rng2(), rng2()];

    expect(seq1).toEqual(seq2);
    expect(seq1[0]).toBeGreaterThanOrEqual(0);
    expect(seq1[0]).toBeLessThan(1);
  });

  it('produces deterministic sequences for numeric seeds', () => {
    const rng1 = createSeededRandom(42);
    const rng2 = createSeededRandom(42);

    expect(rng1()).toBe(rng2());
    expect(rng1()).toBe(rng2());
  });

  it('produces different sequences for different seeds', () => {
    const rngA = createSeededRandom('seed-A');
    const rngB = createSeededRandom('seed-B');

    expect(rngA()).not.toBe(rngB());
  });

  it('hashes strings consistently', () => {
    expect(hashString('weather')).toBe(hashString('weather'));
    expect(hashString('rain')).not.toBe(hashString('snow'));
  });
});
