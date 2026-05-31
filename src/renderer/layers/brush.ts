// ---------------------------------------------------------------------------
// Brush layer — applies a visual style to each path segment before rendering.
//
// Each brush is a named variant; the layer is produced by calling
// brushLayer(name) and chaining it into a rendering stack.
// ---------------------------------------------------------------------------

import { RenderMonad, type RenderingStackMember } from '../monad';
import {
  DEFAULT_BRUSH_CONFIG,
  type BrushConfig,
  type BrushName,
  type LogoResult,
  type SquareBrushOptions,
} from '../types';

function normalizeSquareWidth(width: number) {
  if (!Number.isFinite(width)) return DEFAULT_BRUSH_CONFIG.square.width;
  return Math.min(64, Math.max(0.25, width));
}

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

function squareBrush(
  result: LogoResult,
  options: SquareBrushOptions,
): LogoResult {
  const strokeWidth = normalizeSquareWidth(options.width);

  return {
    ...result,
    style: {
      ...result.style,
      strokeWidth,
      strokeLinecap: options.smooth ? 'round' : 'butt',
      strokeLinejoin: options.smooth ? 'round' : 'miter',
      connectSegments: true,
    },
  };
}

export function brushLayer(
  name: BrushName,
  config: BrushConfig = DEFAULT_BRUSH_CONFIG,
): RenderingStackMember<LogoResult, LogoResult> {
  return {
    name: `Brush: ${name}`,
    run(result) {
      const effectiveName = result.hasBrushCommands
        ? result.brushState.name
        : name;
      const effectiveConfig = result.hasBrushCommands
        ? result.brushState.config
        : config;

      if (effectiveName === 'default')
        return RenderMonad.of(defaultBrush(result));
      if (effectiveName === 'rainbow')
        return RenderMonad.of(rainbowBrush(result));
      return RenderMonad.of(squareBrush(result, effectiveConfig.square));
    },
  };
}
