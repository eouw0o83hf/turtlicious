// ---------------------------------------------------------------------------
// SVG serialiser.
// Accepts a fully-processed LogoResult (after all layers have run) and
// produces an SVG string ready for dangerouslySetInnerHTML or file export.
// ---------------------------------------------------------------------------

import type { LogoResult, Point } from './types';

const SKETCH_WIDTH = 640;
const SKETCH_HEIGHT = 480;
const VIEWBOX_PADDING = 24;

type SketchBounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

const DEFAULT_BOUNDS: SketchBounds = {
  minX: -SKETCH_WIDTH / 2,
  minY: -SKETCH_HEIGHT / 2,
  maxX: SKETCH_WIDTH / 2,
  maxY: SKETCH_HEIGHT / 2,
};

function expandBounds(bounds: SketchBounds, [x, y]: Point) {
  if (x < bounds.minX) bounds.minX = x - VIEWBOX_PADDING;
  if (x > bounds.maxX) bounds.maxX = x + VIEWBOX_PADDING;
  if (y < bounds.minY) bounds.minY = y - VIEWBOX_PADDING;
  if (y > bounds.maxY) bounds.maxY = y + VIEWBOX_PADDING;
}

function getSketchBounds(result: LogoResult, turtlePoints: Point[]) {
  const bounds = { ...DEFAULT_BOUNDS };

  result.segments.forEach((segment) => {
    expandBounds(bounds, [segment.x1, segment.y1]);
    expandBounds(bounds, [segment.x2, segment.y2]);
  });

  turtlePoints.forEach((point) => expandBounds(bounds, point));

  return {
    minX: Math.floor(bounds.minX),
    minY: Math.floor(bounds.minY),
    width: Math.ceil(bounds.maxX) - Math.floor(bounds.minX),
    height: Math.ceil(bounds.maxY) - Math.floor(bounds.minY),
  };
}

export function createSvgMarkup(result: LogoResult) {
  const turtleRadians = (result.turtle.heading * Math.PI) / 180;
  const turtlePoints: Point[] = [
    [
      result.turtle.x + Math.sin(turtleRadians) * 13,
      result.turtle.y - Math.cos(turtleRadians) * 13,
    ],
    [
      result.turtle.x + Math.sin(turtleRadians + 2.45) * 9,
      result.turtle.y - Math.cos(turtleRadians + 2.45) * 9,
    ],
    [
      result.turtle.x + Math.sin(turtleRadians - 2.45) * 9,
      result.turtle.y - Math.cos(turtleRadians - 2.45) * 9,
    ],
  ];

  const viewBox = getSketchBounds(result, turtlePoints);
  const turtlePointMarkup = turtlePoints
    .map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`)
    .join(' ');

  const lines = result.segments
    .map((s) => {
      const stroke = s.color ?? result.style.pathColor;
      const colorAttr = s.color ? ` stroke="${stroke}"` : '';
      return `<line x1="${s.x1.toFixed(2)}" y1="${s.y1.toFixed(2)}" x2="${s.x2.toFixed(2)}" y2="${s.y2.toFixed(2)}"${colorAttr} />`;
    })
    .join('\n    ');

  const glowStyle = result.style.glow
    ? ` style="filter: drop-shadow(0 0 4px ${result.style.pathColor}bf)"`
    : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox.minX} ${viewBox.minY} ${viewBox.width} ${viewBox.height}" role="img" aria-label="Turtle sketch">
  <rect x="${viewBox.minX}" y="${viewBox.minY}" width="${viewBox.width}" height="${viewBox.height}" fill="#000000" />
  <g stroke="${result.style.pathColor}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"${glowStyle}>
    ${lines}
  </g>
  <polygon points="${turtlePointMarkup}" fill="${result.style.turtleColor}" opacity="0.9" />
</svg>`;
}
