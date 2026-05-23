export const DEFAULT_CODE = `; Turtlicious turtle sketch
; Commands: FD, BK, RT, LT, PU, PD, HOME, CS, REPEAT
CS
REPEAT 36 [
  REPEAT 4 [
    FD 90
    RT 90
  ]
  RT 10
]

PU
HOME
RT 90
FD 140
LT 90
PD
REPEAT 36 [
  FD 8
  RT 20
]`;

const SKETCH_WIDTH = 640;
const SKETCH_HEIGHT = 480;
const MAX_REPEAT_COUNT = 1000;
const MAX_STEPS = 25_000;

type Turtle = {
  x: number;
  y: number;
  heading: number;
  penDown: boolean;
};

export type Segment = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

export type LogoResult = {
  segments: Segment[];
  turtle: Turtle;
  errors: string[];
  stepCount: number;
};

const COMMANDS_WITH_ARG = new Set([
  'FD',
  'FORWARD',
  'BK',
  'BACK',
  'RT',
  'RIGHT',
  'LT',
  'LEFT',
]);

function tokenizeLogo(source: string) {
  return source
    .replace(/;.*$/gm, '')
    .replace(/([[]|\])/g, ' $1 ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function normalizeCommand(token: string) {
  return token.toUpperCase();
}

function parseNumber(token: string | undefined, fallback = 0) {
  if (!token) return fallback;
  const value = Number(token);
  return Number.isFinite(value) ? value : fallback;
}

function findClosingBracket(tokens: string[], openIndex: number) {
  let depth = 0;

  for (let index = openIndex; index < tokens.length; index += 1) {
    if (tokens[index] === '[') depth += 1;
    if (tokens[index] === ']') depth -= 1;
    if (depth === 0) return index;
  }

  return -1;
}

export function interpretLogo(source: string): LogoResult {
  const tokens = tokenizeLogo(source);
  const turtle: Turtle = { x: 0, y: 0, heading: 0, penDown: true };
  const segments: Segment[] = [];
  const errors: string[] = [];
  let stepCount = 0;

  const move = (distance: number) => {
    const radians = (turtle.heading * Math.PI) / 180;
    const nextX = turtle.x + Math.sin(radians) * distance;
    const nextY = turtle.y - Math.cos(radians) * distance;

    if (turtle.penDown) {
      segments.push({ x1: turtle.x, y1: turtle.y, x2: nextX, y2: nextY });
    }

    turtle.x = nextX;
    turtle.y = nextY;
  };

  const executeRange = (start: number, end: number) => {
    let index = start;

    while (index < end && stepCount < MAX_STEPS) {
      const command = normalizeCommand(tokens[index]);
      stepCount += 1;

      if (command === '[' || command === ']') {
        index += 1;
        continue;
      }

      if (command === 'REPEAT') {
        const repeatCount = Math.max(
          0,
          Math.min(
            MAX_REPEAT_COUNT,
            Math.floor(parseNumber(tokens[index + 1])),
          ),
        );
        const openIndex = index + 2;

        if (tokens[openIndex] !== '[') {
          errors.push('REPEAT expects a bracketed command block.');
          index += 2;
          continue;
        }

        const closeIndex = findClosingBracket(tokens, openIndex);
        if (closeIndex === -1) {
          errors.push('REPEAT block is missing a closing bracket.');
          return;
        }

        for (
          let repeatIndex = 0;
          repeatIndex < repeatCount && stepCount < MAX_STEPS;
          repeatIndex += 1
        ) {
          executeRange(openIndex + 1, closeIndex);
        }

        index = closeIndex + 1;
        continue;
      }

      if (COMMANDS_WITH_ARG.has(command)) {
        const amount = parseNumber(tokens[index + 1]);

        if (command === 'FD' || command === 'FORWARD') move(amount);
        if (command === 'BK' || command === 'BACK') move(-amount);
        if (command === 'RT' || command === 'RIGHT') turtle.heading += amount;
        if (command === 'LT' || command === 'LEFT') turtle.heading -= amount;

        index += 2;
        continue;
      }

      if (command === 'PU' || command === 'PENUP') {
        turtle.penDown = false;
        index += 1;
        continue;
      }

      if (command === 'PD' || command === 'PENDOWN') {
        turtle.penDown = true;
        index += 1;
        continue;
      }

      if (command === 'HOME') {
        turtle.x = 0;
        turtle.y = 0;
        turtle.heading = 0;
        index += 1;
        continue;
      }

      if (command === 'CS' || command === 'CLEARSCREEN') {
        segments.length = 0;
        turtle.x = 0;
        turtle.y = 0;
        turtle.heading = 0;
        turtle.penDown = true;
        index += 1;
        continue;
      }

      errors.push(`Unknown command: ${tokens[index]}`);
      index += 1;
    }
  };

  executeRange(0, tokens.length);

  if (stepCount >= MAX_STEPS) {
    errors.push(`Stopped after ${MAX_STEPS.toLocaleString()} turtle steps.`);
  }

  return { segments, turtle, errors, stepCount };
}

export function createSvgMarkup(result: LogoResult) {
  const turtleRadians = (result.turtle.heading * Math.PI) / 180;
  const turtlePoints = [
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
    .map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`)
    .join(' ');

  const lines = result.segments
    .map(
      (segment) =>
        `<line x1="${segment.x1.toFixed(2)}" y1="${segment.y1.toFixed(2)}" x2="${segment.x2.toFixed(2)}" y2="${segment.y2.toFixed(2)}" />`,
    )
    .join('\n    ');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-SKETCH_WIDTH / 2} ${-SKETCH_HEIGHT / 2} ${SKETCH_WIDTH} ${SKETCH_HEIGHT}" role="img" aria-label="Turtle sketch">
  <rect x="${-SKETCH_WIDTH / 2}" y="${-SKETCH_HEIGHT / 2}" width="${SKETCH_WIDTH}" height="${SKETCH_HEIGHT}" fill="#000000" />
  <g stroke="#33ff33" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none">
    ${lines}
  </g>
  <polygon points="${turtlePoints}" fill="#33ff33" opacity="0.9" />
</svg>`;
}
