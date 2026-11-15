// Layout per particle: [x, y, vx, vy, alpha, life, maxLife] — 7 floats
export const PARTICLE_STRIDE = 7;

export function createParticlePool(count: number): Float32Array {
  return new Float32Array(count * PARTICLE_STRIDE);
}

export function growParticlePool(pool: Float32Array, count: number): Float32Array {
  if (pool.length >= count * PARTICLE_STRIDE) return pool;
  const next = createParticlePool(count);
  next.set(pool);
  return next;
}

// Zero-allocation: explicit scalar params + indexed writes
export function resetParticle(
  pool: Float32Array,
  i: number,
  x: number,
  y: number,
  vx: number,
  vy: number,
  life: number,
): void {
  const base = i * PARTICLE_STRIDE;
  pool[base] = x;
  pool[base + 1] = y;
  pool[base + 2] = vx;
  pool[base + 3] = vy;
  pool[base + 4] = 1; // alpha
  pool[base + 5] = 0; // life elapsed
  pool[base + 6] = life; // maxLife
}
