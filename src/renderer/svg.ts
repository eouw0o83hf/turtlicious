// ---------------------------------------------------------------------------
// SVG serialiser.
// Accepts a fully-processed LogoResult (after all layers have run) and
// produces an SVG string ready for dangerouslySetInnerHTML or file export.
// ---------------------------------------------------------------------------

import type { LogoResult, Point, Segment } from './types';

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

type ResolvedStyle = {
  strokeWidth: number;
  strokeLinecap: LogoResult['style']['strokeLinecap'];
  strokeLinejoin: LogoResult['style']['strokeLinejoin'];
  connectSegments: boolean;
  glow: boolean;
};

type LineRun = {
  type: 'line-run';
  points: Point[];
  color?: string;
  style: ResolvedStyle;
};

type CircleElement = {
  type: 'circle';
  cx: number;
  cy: number;
  radius: number;
  color?: string;
  style: ResolvedStyle;
};

type ArcElement = {
  type: 'arc';
  cx: number;
  cy: number;
  radius: number;
  startAngle: number;
  endAngle: number;
  direction: 1 | -1;
  color?: string;
  style: ResolvedStyle;
};

type SvgElement = LineRun | CircleElement | ArcElement;

function getSegmentBounds(segment: Segment): Point[] {
  if (segment.type === 'line') {
    return [
      [segment.x1, segment.y1],
      [segment.x2, segment.y2],
    ];
  }

  if (segment.type === 'circle') {
    return [
      [segment.cx - segment.radius, segment.cy - segment.radius],
      [segment.cx + segment.radius, segment.cy + segment.radius],
    ];
  }

  if (segment.type === 'arc') {
    const x1 = segment.cx + Math.cos(segment.startAngle) * segment.radius;
    const y1 = segment.cy + Math.sin(segment.startAngle) * segment.radius;
    const x2 = segment.cx + Math.cos(segment.endAngle) * segment.radius;
    const y2 = segment.cy + Math.sin(segment.endAngle) * segment.radius;
    return [
      [x1, y1],
      [x2, y2],
      [segment.cx - segment.radius, segment.cy - segment.radius],
      [segment.cx + segment.radius, segment.cy + segment.radius],
    ];
  }

  return [];
}

function resolveSegmentStyle(
  result: LogoResult,
  segment: Segment,
): ResolvedStyle {
  return {
    strokeWidth: segment.style?.strokeWidth ?? result.style.strokeWidth,
    strokeLinecap: segment.style?.strokeLinecap ?? result.style.strokeLinecap,
    strokeLinejoin:
      segment.style?.strokeLinejoin ?? result.style.strokeLinejoin,
    connectSegments:
      segment.style?.connectSegments ?? result.style.connectSegments,
    glow: segment.style?.glow ?? result.style.glow,
  };
}

function stylesMatch(a: ResolvedStyle, b: ResolvedStyle) {
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

function buildSvgElements(result: LogoResult): SvgElement[] {
  const elements: SvgElement[] = [];

  for (const segment of result.segments) {
    const style = resolveSegmentStyle(result, segment);

    if (segment.type === 'circle') {
      elements.push({
        type: 'circle',
        cx: segment.cx,
        cy: segment.cy,
        radius: segment.radius,
        color: segment.color,
        style,
      });
      continue;
    }

    if (segment.type === 'arc') {
      elements.push({
        type: 'arc',
        cx: segment.cx,
        cy: segment.cy,
        radius: segment.radius,
        startAngle: segment.startAngle,
        endAngle: segment.endAngle,
        direction: segment.direction,
        color: segment.color,
        style,
      });
      continue;
    }

    // Line segment - try to connect with previous line run
    const points: Point[] = [
      [segment.x1, segment.y1],
      [segment.x2, segment.y2],
    ];
    const lastElement = elements.at(-1);

    if (
      style.connectSegments &&
      lastElement &&
      lastElement.type === 'line-run' &&
      lastElement.color === segment.color &&
      stylesMatch(lastElement.style, style)
    ) {
      const lastPoint = lastElement.points[lastElement.points.length - 1];
      if (pointsMatch(lastPoint, points[0])) {
        lastElement.points.push(points[1]);
        continue;
      }
    }

    elements.push({
      type: 'line-run',
      points,
      color: segment.color,
      style,
    });
  }

  return elements;
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
    const points = getSegmentBounds(segment);
    points.forEach((point) => expandBounds(bounds, point));
  });

  turtlePoints.forEach((point) => expandBounds(bounds, point));

  return {
    minX: Math.floor(bounds.minX),
    minY: Math.floor(bounds.minY),
    width: Math.ceil(bounds.maxX) - Math.floor(bounds.minX),
    height: Math.ceil(bounds.maxY) - Math.floor(bounds.minY),
  };
}

function renderSvgElement(
  element: SvgElement,
  defaultColor: string,
  strokeColorOverride?: string,
): string {
  const stroke = strokeColorOverride ?? element.color ?? defaultColor;
  const styleAttr = element.style.glow
    ? ` style="filter: drop-shadow(0 0 4px ${stroke}bf)"`
    : '';

  if (element.type === 'circle') {
    return `<circle cx="${element.cx.toFixed(2)}" cy="${element.cy.toFixed(2)}" r="${element.radius.toFixed(2)}" stroke="${stroke}" stroke-width="${element.style.strokeWidth.toFixed(2)}"${styleAttr} />`;
  }

  if (element.type === 'arc') {
    const x1 = element.cx + Math.cos(element.startAngle) * element.radius;
    const y1 = element.cy + Math.sin(element.startAngle) * element.radius;
    const x2 = element.cx + Math.cos(element.endAngle) * element.radius;
    const y2 = element.cy + Math.sin(element.endAngle) * element.radius;

    // Calculate arc sweep angle
    let adjustedEnd = element.endAngle;
    if (element.direction > 0) {
      while (adjustedEnd <= element.startAngle) adjustedEnd += Math.PI * 2;
    } else {
      while (adjustedEnd >= element.startAngle) adjustedEnd -= Math.PI * 2;
    }
    const delta = Math.abs(adjustedEnd - element.startAngle);

    const largeArcFlag = delta > Math.PI ? 1 : 0;
    const sweepFlag = element.direction === 1 ? 1 : 0;

    return `<path d="M ${x1.toFixed(2)},${y1.toFixed(2)} A ${element.radius.toFixed(2)},${element.radius.toFixed(2)} 0 ${largeArcFlag} ${sweepFlag} ${x2.toFixed(2)},${y2.toFixed(2)}" stroke="${stroke}" stroke-width="${element.style.strokeWidth.toFixed(2)}" stroke-linecap="${element.style.strokeLinecap}" stroke-linejoin="${element.style.strokeLinejoin}"${styleAttr} />`;
  }

  // Line run
  if (element.points.length > 2) {
    const points = element.points
      .map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`)
      .join(' ');
    return `<polyline points="${points}" stroke="${stroke}" stroke-width="${element.style.strokeWidth.toFixed(2)}" stroke-linecap="${element.style.strokeLinecap}" stroke-linejoin="${element.style.strokeLinejoin}"${styleAttr} />`;
  }

  const [start, end] = element.points;
  return `<line x1="${start[0].toFixed(2)}" y1="${start[1].toFixed(2)}" x2="${end[0].toFixed(2)}" y2="${end[1].toFixed(2)}" stroke="${stroke}" stroke-width="${element.style.strokeWidth.toFixed(2)}" stroke-linecap="${element.style.strokeLinecap}" stroke-linejoin="${element.style.strokeLinejoin}"${styleAttr} />`;
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
  const showTurtle = includeTurtle && result.turtle.visible;
  const turtleRadians = (result.turtle.heading * Math.PI) / 180;
  const turtlePoints: Point[] = showTurtle
    ? [
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
      ]
    : [];

  const viewBox = getSketchBounds(result, turtlePoints);
  const turtlePointMarkup = turtlePoints
    .map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`)
    .join(' ');

  const elements = buildSvgElements(result);
  const pathMarkup = elements
    .map((element) =>
      renderSvgElement(element, result.style.pathColor, strokeColorOverride),
    )
    .join('\n    ');

  const backgroundMarkup = includeBackground
    ? `<rect x="${viewBox.minX}" y="${viewBox.minY}" width="${viewBox.width}" height="${viewBox.height}" fill="#000000" />`
    : '';

  const turtleMarkup = showTurtle
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
