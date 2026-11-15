import type { FrameState } from '@react-weather-effects/core';

interface Transition {
  target: number;
  duration: number;
  remaining: number;
}

function resolveDuration(duration: number): number {
  return Number.isFinite(duration) ? Math.max(0, duration) : 0;
}

export function createTransition(target: number, duration: number): Transition {
  return { target, duration: resolveDuration(duration), remaining: 0 };
}

/** Blend from the current value so interrupted transitions never restart visually. */
export function stepTransition(
  transition: Transition,
  target: number,
  duration: number,
  state: Readonly<FrameState>,
): number {
  const nextDuration = resolveDuration(duration);
  if (target !== transition.target || nextDuration !== transition.duration) {
    transition.target = target;
    transition.duration = nextDuration;
    transition.remaining = nextDuration;
  }

  if (!state.isAnimating || nextDuration === 0) {
    transition.remaining = 0;
    return 1;
  }
  if (transition.remaining === 0) return 1;

  const elapsed = state.dt * 1000;
  const step = elapsed + 1e-6 >= transition.remaining ? 1 : elapsed / transition.remaining;
  transition.remaining = step === 1 ? 0 : transition.remaining - elapsed;
  return step;
}

interface ParticleTransition {
  transition: Transition;
  visibility: Float32Array;
  count: number;
}

export function createParticleTransition(
  count: number,
  capacity: number,
  duration: number,
): ParticleTransition {
  const visibility = new Float32Array(capacity);
  visibility.fill(1, 0, count);
  return { transition: createTransition(count, duration), visibility, count };
}

export function updateParticleTransition(
  particles: ParticleTransition,
  targetCount: number,
  duration: number,
  state: Readonly<FrameState>,
): void {
  const capacity = state.budget.maxParticles;
  if (particles.visibility.length < capacity) {
    const visibility = new Float32Array(capacity);
    visibility.set(particles.visibility);
    particles.visibility = visibility;
  }

  // A quality downgrade remains a hard cap, including particles fading out.
  if (particles.count > capacity) particles.visibility.fill(0, capacity, particles.count);
  const count = Math.min(capacity, Math.max(particles.count, targetCount));
  const step = stepTransition(particles.transition, targetCount, duration, state);
  for (let i = 0; i < count; i++) {
    const target = i < targetCount ? 1 : 0;
    particles.visibility[i] = step === 1
      ? target
      : particles.visibility[i] + (target - particles.visibility[i]) * step;
  }
  particles.count = step === 1 ? targetCount : count;
}
