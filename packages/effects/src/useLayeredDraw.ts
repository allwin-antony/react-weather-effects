import { useEffect, useRef, type MutableRefObject } from 'react';
import type { DrawFn, TickerContext } from '@react-weather-effects/core';

/**
 * Registers an effect's draw function at `layer`.
 *
 * The effect assigns its stateful draw closure to the returned ref. Changing
 * `layer` re-registers a stable forwarder, so particle pools, textures, and
 * transitions survive reordering.
 */
export function useLayeredDraw(
  ticker: TickerContext,
  layer: number,
): MutableRefObject<DrawFn | null> {
  const drawRef = useRef<DrawFn | null>(null);

  useEffect(
    () => ticker.register(layer, (state) => drawRef.current?.(state)),
    [ticker, layer],
  );

  return drawRef;
}
