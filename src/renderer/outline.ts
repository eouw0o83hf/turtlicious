import type { LogoResult, Point, Segment } from './types';

const POINT_EPSILON = 1e-6;
const ARC_STEP_RADIANS = Math.PI / 16;

type StrokePath = {
  points: Point[];
  closed: boolean;
};

type Vector = {
  x: number;
  y: number;
};

function pointsMatch(a: Point, b: Point) {
  return (
    Math.abs(a[0] - b[0]) <= POINT_EPSILON &&
    Math.abs(a[1] - b[1]) <= POINT_EPSILON
  );
}

function dedupeSequentialPoints(points: Point[]) {
  return points.filter((point, index) => {
    if (index === 0) return true;
    return !pointsMatch(point, points[index - 1]);
  });
}

function addVectors(a: Vector, b: Vector): Vector {
  return { x: a.x + b.x, y: a.y + b.y };
}

function scaleVector(vector: Vector, amount: number): Vector {
  return { x: vector.x * amount, y: vector.y * amount };
}

function angleOf(vector: Vector) {
  return Math.atan2(vector.y, vector.x);
}

function vectorFromAngle(angle: number, radius: number): Vector {
  return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
}

function crossProduct(a: Vector, b: Vector) {
  return a.x * b.y - a.y * b.x;
}

function signedArea(points: Point[]) {
  let area = 0;

  for (let index = 0; index < points.length; index += 1) {
    const [x1, y1] = points[index];
    const [x2, y2] = points[(index + 1) % points.length];
    area += x1 * y2 - x2 * y1;
  }

  return area / 2;
}

function formatNumber(value: number) {
  const normalized = Math.abs(value) <= POINT_EPSILON ? 0 : value;
  const rounded = Number(normalized.toFixed(2));
  return Number.isInteger(rounded)
    ? String(rounded)
    : rounded
        .toFixed(2)
        .replace(/\.0+$/, '')
        .replace(/(\.\d*[1-9])0+$/, '$1');
}

function normalizeDegrees(angle: number) {
  let normalized = angle % 360;

  if (normalized > 180) normalized -= 360;
  if (normalized <= -180) normalized += 360;

  return normalized;
}

function offsetPoint(point: Point, normal: Vector, amount: number): Point {
  return [point[0] + normal.x * amount, point[1] + normal.y * amount];
}

function buildSegmentData(start: Point, end: Point) {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const length = Math.hypot(dx, dy);

  if (length <= POINT_EPSILON) {
    return null;
  }

  const direction = { x: dx / length, y: dy / length };
  return {
    direction,
    normal: { x: -direction.y, y: direction.x },
  };
}

function lineIntersection(a1: Point, a2: Point, b1: Point, b2: Point) {
  const x1 = a1[0];
  const y1 = a1[1];
  const x2 = a2[0];
  const y2 = a2[1];
  const x3 = b1[0];
  const y3 = b1[1];
  const x4 = b2[0];
  const y4 = b2[1];
  const denominator = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);

  if (Math.abs(denominator) <= POINT_EPSILON) {
    return null;
  }

  const determinant1 = x1 * y2 - y1 * x2;
  const determinant2 = x3 * y4 - y3 * x4;

  return [
    (determinant1 * (x3 - x4) - (x1 - x2) * determinant2) / denominator,
    (determinant1 * (y3 - y4) - (y1 - y2) * determinant2) / denominator,
  ] as Point;
}

function buildArcPoints(
  center: Point,
  radius: number,
  startAngle: number,
  endAngle: number,
  direction: 1 | -1,
) {
  let adjustedEnd = endAngle;

  if (direction > 0) {
    while (adjustedEnd <= startAngle) adjustedEnd += Math.PI * 2;
  } else {
    while (adjustedEnd >= startAngle) adjustedEnd -= Math.PI * 2;
  }

  const delta = adjustedEnd - startAngle;
  const steps = Math.max(2, Math.ceil(Math.abs(delta) / ARC_STEP_RADIANS));
  const points: Point[] = [];

  for (let step = 1; step <= steps; step += 1) {
    const angle = startAngle + (delta * step) / steps;
    const offset = vectorFromAngle(angle, radius);
    points.push([center[0] + offset.x, center[1] + offset.y]);
  }

  return points;
}

function buildOpenRoundEndCap(
  center: Point,
  tangent: Vector,
  normal: Vector,
  radius: number,
) {
  const steps = Math.max(4, Math.ceil(Math.PI / ARC_STEP_RADIANS));
  const points: Point[] = [];

  for (let step = 1; step <= steps; step += 1) {
    const theta = (Math.PI * step) / steps;
    const offset = addVectors(
      scaleVector(normal, Math.cos(theta) * radius),
      scaleVector(tangent, Math.sin(theta) * radius),
    );
    points.push([center[0] + offset.x, center[1] + offset.y]);
  }

  return points;
}

function buildOpenRoundStartCap(
  center: Point,
  tangent: Vector,
  normal: Vector,
  radius: number,
) {
  const steps = Math.max(4, Math.ceil(Math.PI / ARC_STEP_RADIANS));
  const points: Point[] = [];

  for (let step = 1; step <= steps; step += 1) {
    const theta = (Math.PI * step) / steps;
    const offset = addVectors(
      scaleVector(normal, -Math.cos(theta) * radius),
      scaleVector(tangent, -Math.sin(theta) * radius),
    );
    points.push([center[0] + offset.x, center[1] + offset.y]);
  }

  return points;
}

function getJoinPoint(
  prevPoint: Point,
  currentPoint: Point,
  nextPoint: Point,
  prevNormal: Vector,
  nextNormal: Vector,
  amount: number,
) {
  const intersection = lineIntersection(
    offsetPoint(prevPoint, prevNormal, amount),
    offsetPoint(currentPoint, prevNormal, amount),
    offsetPoint(currentPoint, nextNormal, amount),
    offsetPoint(nextPoint, nextNormal, amount),
  );

  return intersection ?? offsetPoint(currentPoint, nextNormal, amount);
}

function convertSegmentToPoints(segment: Segment): Point[] {
  if (segment.type === 'line') {
    return [
      [segment.x1, segment.y1],
      [segment.x2, segment.y2],
    ];
  }

  if (segment.type === 'circle') {
    return buildArcPoints(
      [segment.cx, segment.cy],
      segment.radius,
      0,
      Math.PI * 2,
      1,
    );
  }

  if (segment.type === 'arc') {
    return buildArcPoints(
      [segment.cx, segment.cy],
      segment.radius,
      segment.startAngle,
      segment.endAngle,
      segment.direction,
    );
  }

  return [];
}

function buildStrokePaths(result: LogoResult) {
  if (!result.style.connectSegments) {
    return result.segments
      .map((segment) => ({
        points: dedupeSequentialPoints(convertSegmentToPoints(segment)),
        closed: segment.type === 'circle',
      }))
      .filter((path) => path.points.length >= 2);
  }

  const paths: Array<{ points: Point[]; color: string | undefined }> = [];

  result.segments.forEach((segment) => {
    const points = convertSegmentToPoints(segment);
    const start: Point = points[0];
    const end: Point = points[points.length - 1];
    const color = segment.color ?? result.style.pathColor;
    const current = paths.at(-1);

    if (
      current &&
      current.color === color &&
      pointsMatch(current.points[current.points.length - 1], start)
    ) {
      current.points.push(...points.slice(1));
      return;
    }

    paths.push({ points, color });
  });

  return paths
    .map((path) => {
      const points = dedupeSequentialPoints(path.points);
      const closed =
        points.length >= 3 && pointsMatch(points[0], points[points.length - 1]);

      return {
        points,
        closed,
      };
    })
    .filter((path) => path.points.length >= 2);
}

function outlineClosedPath(path: StrokePath, result: LogoResult) {
  const radius = result.style.strokeWidth / 2;
  const points = path.points.slice(0, -1);

  if (points.length < 3 || radius <= POINT_EPSILON) {
    return [];
  }

  const segmentData = points.map((point, index) =>
    buildSegmentData(point, points[(index + 1) % points.length]),
  );

  if (segmentData.some((segment) => segment === null)) {
    return [];
  }

  const segments = segmentData as Array<{ direction: Vector; normal: Vector }>;
  const leftLoop: Point[] = [];
  const rightLoop: Point[] = [];

  for (let index = 0; index < points.length; index += 1) {
    const prevIndex = (index - 1 + points.length) % points.length;
    const nextIndex = index;

    leftLoop.push(
      getJoinPoint(
        points[prevIndex],
        points[index],
        points[(index + 1) % points.length],
        segments[prevIndex].normal,
        segments[nextIndex].normal,
        radius,
      ),
    );
    rightLoop.push(
      getJoinPoint(
        points[prevIndex],
        points[index],
        points[(index + 1) % points.length],
        segments[prevIndex].normal,
        segments[nextIndex].normal,
        -radius,
      ),
    );
  }

  const contours = [leftLoop, [...rightLoop].reverse()];
  return contours.sort(
    (a, b) => Math.abs(signedArea(b)) - Math.abs(signedArea(a)),
  );
}

function outlineOpenPath(path: StrokePath, result: LogoResult) {
  const radius = result.style.strokeWidth / 2;
  const points = dedupeSequentialPoints(path.points);

  if (points.length < 2 || radius <= POINT_EPSILON) {
    return [];
  }

  const segmentData = points
    .slice(0, -1)
    .map((point, index) => buildSegmentData(point, points[index + 1]));

  if (segmentData.some((segment) => segment === null)) {
    return [];
  }

  const segments = segmentData as Array<{ direction: Vector; normal: Vector }>;
  const leftBoundary: Point[] = [
    offsetPoint(points[0], segments[0].normal, radius),
  ];
  const rightBoundary: Point[] = [
    offsetPoint(points[0], segments[0].normal, -radius),
  ];

  for (let index = 1; index < points.length - 1; index += 1) {
    const prevSegment = segments[index - 1];
    const nextSegment = segments[index];
    const turn = crossProduct(prevSegment.direction, nextSegment.direction);

    if (result.style.strokeLinejoin === 'round' && turn < -POINT_EPSILON) {
      leftBoundary.push(
        ...buildArcPoints(
          points[index],
          radius,
          angleOf(prevSegment.normal),
          angleOf(nextSegment.normal),
          -1,
        ),
      );
      rightBoundary.push(
        getJoinPoint(
          points[index - 1],
          points[index],
          points[index + 1],
          prevSegment.normal,
          nextSegment.normal,
          -radius,
        ),
      );
      continue;
    }

    if (result.style.strokeLinejoin === 'round' && turn > POINT_EPSILON) {
      leftBoundary.push(
        getJoinPoint(
          points[index - 1],
          points[index],
          points[index + 1],
          prevSegment.normal,
          nextSegment.normal,
          radius,
        ),
      );
      rightBoundary.push(
        ...buildArcPoints(
          points[index],
          radius,
          angleOf(scaleVector(prevSegment.normal, -1)),
          angleOf(scaleVector(nextSegment.normal, -1)),
          1,
        ),
      );
      continue;
    }

    leftBoundary.push(
      getJoinPoint(
        points[index - 1],
        points[index],
        points[index + 1],
        prevSegment.normal,
        nextSegment.normal,
        radius,
      ),
    );
    rightBoundary.push(
      getJoinPoint(
        points[index - 1],
        points[index],
        points[index + 1],
        prevSegment.normal,
        nextSegment.normal,
        -radius,
      ),
    );
  }

  const lastSegment = segments[segments.length - 1];
  const startPoint = points[0];
  const endPoint = points[points.length - 1];
  const startLeft = leftBoundary[0];
  const startRight = rightBoundary[0];
  const endLeft = offsetPoint(endPoint, lastSegment.normal, radius);
  const endRight = offsetPoint(endPoint, lastSegment.normal, -radius);

  leftBoundary.push(endLeft);

  const contour: Point[] = [...leftBoundary];

  if (result.style.strokeLinecap === 'round') {
    contour.push(
      ...buildOpenRoundEndCap(
        endPoint,
        lastSegment.direction,
        lastSegment.normal,
        radius,
      ),
    );
  } else {
    contour.push(endRight);
  }

  contour.push(...rightBoundary.slice(1).reverse(), startRight);

  if (result.style.strokeLinecap === 'round') {
    contour.push(
      ...buildOpenRoundStartCap(
        startPoint,
        segments[0].direction,
        segments[0].normal,
        radius,
      ),
    );
  } else {
    contour.push(startLeft);
  }

  return [dedupeSequentialPoints(contour)];
}

function buildOutlineContours(result: LogoResult) {
  return buildStrokePaths(result)
    .flatMap((path) =>
      path.closed
        ? outlineClosedPath(path, result)
        : outlineOpenPath(path, result),
    )
    .map((contour) => {
      const normalized = dedupeSequentialPoints(contour);

      if (
        normalized.length > 1 &&
        pointsMatch(normalized[0], normalized[normalized.length - 1])
      ) {
        return normalized.slice(0, -1);
      }

      return normalized;
    })
    .filter((contour) => contour.length >= 3);
}

function appendMoveCommands(
  lines: string[],
  current: { point: Point; heading: number },
  target: Point,
) {
  const dx = target[0] - current.point[0];
  const dy = target[1] - current.point[1];
  const distance = Math.hypot(dx, dy);

  if (distance <= POINT_EPSILON) {
    current.point = target;
    return;
  }

  const desiredHeading = (Math.atan2(dx, -dy) * 180) / Math.PI;
  const turn = normalizeDegrees(desiredHeading - current.heading);

  if (Math.abs(turn) > POINT_EPSILON) {
    lines.push(`${turn > 0 ? 'RT' : 'LT'} ${formatNumber(Math.abs(turn))}`);
    current.heading = normalizeDegrees(current.heading + turn);
  }

  lines.push(`FD ${formatNumber(distance)}`);
  current.point = target;
}

function contourToCommands(
  contour: Point[],
  current: { point: Point; heading: number },
) {
  const lines: string[] = ['PU'];
  appendMoveCommands(lines, current, contour[0]);
  lines.push('PD');

  const closedContour = [...contour, contour[0]];

  for (let index = 1; index < closedContour.length; index += 1) {
    appendMoveCommands(lines, current, closedContour[index]);
  }

  return lines;
}

export type CreateOutlineProgramOptions = {
  resetBrush?: boolean;
};

export function createOutlineProgram(
  result: LogoResult,
  options: CreateOutlineProgramOptions = {},
) {
  const { resetBrush = true } = options;
  const contours = buildOutlineContours(result);

  if (contours.length === 0) {
    return '';
  }

  const lines = resetBrush ? ['SB square'] : [];
  const current = { point: [0, 0] as Point, heading: 0 };

  contours.forEach((contour, index) => {
    if (lines.length > 0 || index > 0) {
      lines.push('');
    }
    lines.push(...contourToCommands(contour, current));
  });

  return lines.join('\n').trim();
}

export function createOutlineProgramFromSegments(
  segments: Segment[],
  style: LogoResult['style'],
) {
  return createOutlineProgram({
    segments,
    style,
    errors: [],
    stepCount: 0,
    turtle: { x: 0, y: 0, heading: 0, penDown: true, visible: true },
    brushState: {
      name: 'square',
      config: { square: { width: 5, smooth: false } },
    },
    hasBrushCommands: false,
  });
}
