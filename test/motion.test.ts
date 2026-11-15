import { describe, it, expect } from 'vitest';
import { resolveMotion } from '../packages/core/src/motion';

describe('Reduced Motion Resolution', () => {
  it('resolves auto based on OS preference', () => {
    // OS allows motion
    expect(resolveMotion('auto', false)).toBe('animated');

    // OS prefers reduced motion
    expect(resolveMotion('auto', true)).toBe('static');

    // SSR or unknown initial state
    expect(resolveMotion('auto', null)).toBe('static');
  });

  it('honors explicit prop overrides', () => {
    expect(resolveMotion('animated', true)).toBe('animated');
    expect(resolveMotion('static', false)).toBe('static');
    expect(resolveMotion('off', false)).toBe('off');
  });
});
