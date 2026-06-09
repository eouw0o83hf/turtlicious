// ---------------------------------------------------------------------------
// SVG serialiser.
// Accepts a fully-processed LogoResult (after all layers have run) and
// produces an SVG string ready for dangerouslySetInnerHTML or file export.
// ---------------------------------------------------------------------------

import type { LogoResult, Point } from './types';

type SvgRenderOptions = {
  includeTurtle?: boolean;
  includeBackground?: boolean;
  strokeColorOverride?: string;
};

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

const POINT_MATCH_EPSILON = 1e-6;

type SegmentRun = {
  points: Point[];
  color?: string;
  style: {
    strokeWidth: number;
    strokeLinecap: LogoResult['style']['strokeLinecap'];
    strokeLinejoin: LogoResult['style']['strokeLinejoin'];
    connectSegments: boolean;
    glow: boolean;
  };
};

function resolveSegmentStyle(result: LogoResult, segment: LogoResult['segments'][number]) {
  return {
    strokeWidth: segment.style?.strokeWidth ?? result.style.strokeWidth,
    strokeLinecap: segment.style?.strokeLinecap ?? result.style.strokeLinecap,
    strokeLinejoin:
      segment.style?.strokeLinejoin ?? result.style.strokeLinejoin,
    connectSegments: segment.style?.connectSegments ?? result.style.connectSegments,
    glow: segment.style?.glow ?? result.style.glow,
  };
}

function segmentStylesMatch(a: SegmentRun['style'], b: SegmentRun['style']) {
  return (
    a.strokeWidth === b.strokeWidth &&
    a.strokeLinecap === b.strokeLinecap &&
    a.strokeLinejoin === b.strokeLinejoin &&
    a.connectSegments === b.connectSegments &&
    a.glow === b.glow
  );
}

function pointsMatch(a: Point, b: Point) {
  return (
    Math.abs(a[0] - b[0]) <= POINT_MATCH_EPSILON &&
    Math.abs(a[1] - b[1]) <= POINT_MATCH_EPSILON
  );
}

function buildConnectedRuns(result: LogoResult) {
  const runs: SegmentRun[] = [];

  for (const segment of result.segments) {
    const start: Point = [segment.x1, segment.y1];
    const end: Point = [segment.x2, segment.y2];
    const style = resolveSegmentStyle(result, segment);
    const run = runs.at(-1);

    if (!style.connectSegments) {
      runs.push({ points: [start, end], color: segment.color, style });
      continue;
    }

    if (
      run &&
      run.color === segment.color &&
      segmentStylesMatch(run.style, style)
    ) {
      const lastPoint = run.points[run.points.length - 1];
      if (pointsMatch(lastPoint, start)) {
        run.points.push(end);
        continue;
      }
    }

    runs.push({ points: [start, end], color: segment.color, style });
  }

  return runs;
}

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

export function createSvgMarkup(
  result: LogoResult,
  options: SvgRenderOptions = {},
) {
  const {
    includeTurtle = true,
    includeBackground = true,
    strokeColorOverride,
  } = options;
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

  const pathMarkup = buildConnectedRuns(result)
    .map((run) => {
      const stroke = strokeColorOverride ?? run.color ?? result.style.pathColor;
      const styleAttr = run.style.glow
        ? ` style="filter: drop-shadow(0 0 4px ${stroke}bf)"`
        : '';

      if (run.points.length > 2) {
        const points = run.points
          .map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`)
          .join(' ');
        return `<polyline points="${points}" stroke="${stroke}" stroke-width="${run.style.strokeWidth.toFixed(2)}" stroke-linecap="${run.style.strokeLinecap}" stroke-linejoin="${run.style.strokeLinejoin}"${styleAttr} />`;
      }

      const [start, end] = run.points;
      return `<line x1="${start[0].toFixed(2)}" y1="${start[1].toFixed(2)}" x2="${end[0].toFixed(2)}" y2="${end[1].toFixed(2)}" stroke="${stroke}" stroke-width="${run.style.strokeWidth.toFixed(2)}" stroke-linecap="${run.style.strokeLinecap}" stroke-linejoin="${run.style.strokeLinejoin}"${styleAttr} />`;
    })
    .join('\n    ');

  const backgroundMarkup = includeBackground
    ? `<rect x="${viewBox.minX}" y="${viewBox.minY}" width="${viewBox.width}" height="${viewBox.height}" fill="#000000" />`
    : '';

  const turtleMarkup = includeTurtle
    ? `<polygon points="${turtlePointMarkup}" fill="${result.style.turtleColor}" opacity="0.9" />`
    : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox.minX} ${viewBox.minY} ${viewBox.width} ${viewBox.height}" role="img" aria-label="Turtle sketch">
  ${backgroundMarkup}
  <g fill="none">
    ${pathMarkup}
  </g>
  ${turtleMarkup}
</svg>`;
}
