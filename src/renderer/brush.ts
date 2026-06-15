// ---------------------------------------------------------------------------
// Brush — applies a visual style to each path segment before rendering.
//
// Each brush is a named variant; call brushLayer(name) and chain it into a
// rendering stack.
// ---------------------------------------------------------------------------

import { RenderMonad, type RenderingStackMember } from './monad';
import {
  DEFAULT_BRUSH_CONFIG,
  type BrushConfig,
  type BrushName,
  type LogoResult,
  type Segment,
  type SegmentBrushState,
  type SquareBrushOptions,
} from './types';

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

function cloneBrushConfig(config: BrushConfig): BrushConfig {
  return {
    square: {
      width: config.square.width,
      smooth: config.square.smooth,
    },
  };
}

function getEffectiveBrushState(
  segment: Segment,
  fallbackName: BrushName,
  fallbackConfig: BrushConfig,
): SegmentBrushState {
  const snapshot = segment.brushState;
  if (snapshot) {
    return {
      name: snapshot.name,
      config: cloneBrushConfig(snapshot.config),
    };
  }

  return {
    name: fallbackName,
    config: cloneBrushConfig(fallbackConfig),
  };
}

function applyPerSegmentBrushes(
  result: LogoResult,
  fallbackName: BrushName,
  fallbackConfig: BrushConfig,
): LogoResult {
  const useProgramBrushSnapshots = result.hasBrushCommands;

  const rainbowSegmentTotal = result.segments.filter((segment) => {
    const brushState = useProgramBrushSnapshots
      ? getEffectiveBrushState(segment, fallbackName, fallbackConfig)
      : { name: fallbackName, config: cloneBrushConfig(fallbackConfig) };
    return brushState.name === 'rainbow';
  }).length;

  let rainbowSegmentIndex = 0;

  const segments: Segment[] = result.segments.map((segment): Segment => {
    const brushState = useProgramBrushSnapshots
      ? getEffectiveBrushState(segment, fallbackName, fallbackConfig)
      : { name: fallbackName, config: cloneBrushConfig(fallbackConfig) };

    if (brushState.name === 'default') {
      return {
        ...segment,
        style: {
          ...segment.style,
          connectSegments: false,
          glow: true,
        },
      };
    }

    if (brushState.name === 'rainbow') {
      const color = `hsl(${((rainbowSegmentIndex / Math.max(rainbowSegmentTotal - 1, 1)) * 360).toFixed(1)}, 100%, 62%)`;
      rainbowSegmentIndex += 1;

      return {
        ...segment,
        color,
        style: {
          ...segment.style,
          connectSegments: false,
          glow: false,
        },
      };
    }

    const width = normalizeSquareWidth(brushState.config.square.width);
    const smooth = brushState.config.square.smooth;
    const strokeLinecap = smooth ? ('round' as const) : ('butt' as const);
    const strokeLinejoin = smooth ? ('round' as const) : ('miter' as const);

    return {
      ...segment,
      style: {
        ...segment.style,
        strokeWidth: width,
        strokeLinecap,
        strokeLinejoin,
        connectSegments: segment.type === 'line',
        glow: false,
      },
    };
  });

  const lastSegmentStyle = segments.at(-1)?.style;

  return {
    ...result,
    segments,
    style: {
      ...result.style,
      strokeWidth: lastSegmentStyle?.strokeWidth ?? result.style.strokeWidth,
      strokeLinecap: lastSegmentStyle?.strokeLinecap ?? result.style.strokeLinecap,
      strokeLinejoin:
        lastSegmentStyle?.strokeLinejoin ?? result.style.strokeLinejoin,
      connectSegments:
        lastSegmentStyle?.connectSegments ?? result.style.connectSegments,
      glow: segments.some((segment) => segment.style?.glow ?? true),
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
      const brushed = applyPerSegmentBrushes(result, name, config);

      if (name === 'default' && !result.hasBrushCommands) {
        return RenderMonad.of(defaultBrush(brushed));
      }
      if (name === 'rainbow' && !result.hasBrushCommands) {
        return RenderMonad.of(rainbowBrush(brushed));
      }
      if (name === 'square' && !result.hasBrushCommands) {
        return RenderMonad.of(squareBrush(brushed, config.square));
      }

      return RenderMonad.of(brushed);
    },
  };
}
