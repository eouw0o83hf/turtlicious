// ---------------------------------------------------------------------------
// Brush layer — applies a visual style to each path segment before rendering.
//
// Each brush is a named variant; the layer is produced by calling
// brushLayer(name) and chaining it into a rendering stack.
// ---------------------------------------------------------------------------

import { RenderMonad, type RenderingStackMember } from '../monad';
import type { LogoResult } from '../types';

export type BrushName = 'default' | 'rainbow';

// ---------------------------------------------------------------------------
// Default brush — the canonical green CRT glow.
// No transformation; segments inherit style.pathColor and glow is on.
// ---------------------------------------------------------------------------
function defaultBrush(result: LogoResult): LogoResult {
  return result;
}

// ---------------------------------------------------------------------------
// Rainbow brush — flows through the full HSL spectrum across all segments.
// Each segment gets an individual color; glow is off (segments vary).
// ---------------------------------------------------------------------------
function rainbowBrush(result: LogoResult): LogoResult {
  const total = result.segments.length;
  const segments = result.segments.map((seg, i) => ({
    ...seg,
    color: `hsl(${((i / Math.max(total - 1, 1)) * 360).toFixed(1)}, 100%, 62%)`,
  }));
  return {
    ...result,
    segments,
    style: { ...result.style, glow: false },
  };
}

const BRUSHES: Record<BrushName, (result: LogoResult) => LogoResult> = {
  default: defaultBrush,
  rainbow: rainbowBrush,
};

export function brushLayer(
  name: BrushName,
): RenderingStackMember<LogoResult, LogoResult> {
  return {
    name: `Brush: ${name}`,
    run(result) {
      return RenderMonad.of(BRUSHES[name](result));
    },
  };
}
