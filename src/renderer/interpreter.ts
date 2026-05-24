// ---------------------------------------------------------------------------
// Logo / turtle language interpreter.
// Parses Logo source text and produces a LogoResult carrying the drawn
// segments, final turtle state, diagnostics, and base style.
// ---------------------------------------------------------------------------

import { RenderMonad, type RenderingStackMember } from './monad';
import type { LogoResult, Segment, Turtle } from './types';

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

const LOGO_GREEN = '#33ff33';
const MAX_REPEAT_COUNT = 1000;
const MAX_STEPS = 25_000;

const DEFAULT_STYLE = {
  pathColor: LOGO_GREEN,
  turtleColor: LOGO_GREEN,
  glow: true,
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

  return { segments, turtle, errors, stepCount, style: DEFAULT_STYLE };
}

/** Stack layer: interpret Logo source text into a LogoResult. */
export const logoInterpreterLayer: RenderingStackMember<string, LogoResult> = {
  name: 'Logo interpreter',
  run(source) {
    const result = interpretLogo(source);
    return new RenderMonad(result, result.errors);
  },
};
