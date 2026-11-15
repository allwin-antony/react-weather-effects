export type ReducedMotionProp = 'auto' | 'animated' | 'static' | 'off';
export type MotionMode = 'animated' | 'static' | 'off';

export function resolveMotion(
  prop: ReducedMotionProp = 'auto',
  osPreference: boolean | null,
): MotionMode {
  if (prop === 'auto') {
    // If osPreference is false (prefers-reduced-motion does NOT match), we animate.
    // If osPreference is true (prefers-reduced-motion matches), we use static.
    // If osPreference is null (SSR/unknown initial), we resolve conservatively to static.
    return osPreference === false ? 'animated' : 'static';
  }
  return prop;
}
