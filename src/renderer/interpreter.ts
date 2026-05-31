// ---------------------------------------------------------------------------
// Logo / turtle language interpreter.
// Parses Logo source text and produces a LogoResult carrying the drawn
// segments, final turtle state, diagnostics, and base style.
// ---------------------------------------------------------------------------

import { RenderMonad, type RenderingStackMember } from './monad';
import {
  DEFAULT_BRUSH_CONFIG,
  DEFAULT_BRUSH_STATE,
  type BrushConfig,
  type BrushName,
  type BrushState,
  type LogoResult,
  type LogoStyle,
  type Segment,
  type Turtle,
} from './types';

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

const DEFAULT_STYLE: LogoStyle = {
  pathColor: LOGO_GREEN,
  turtleColor: LOGO_GREEN,
  glow: true,
  strokeWidth: 2.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  connectSegments: false,
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

const MAX_CALL_DEPTH = 256;

const LINE_BREAK = '\n';

function isVariableToken(token: string | undefined): token is string {
  return Boolean(token && token.startsWith('$'));
}

function normalizeVariableName(token: string) {
  return token.slice(1).toLowerCase();
}

function isExpressionTerminator(token: string | undefined) {
  return (
    token === undefined ||
    token === LINE_BREAK ||
    token === '[' ||
    token === ']'
  );
}

function isOperatorToken(token: string | undefined) {
  return token === '+' || token === '-' || token === '*' || token === '/';
}

function tokenizeLogo(source: string) {
  const tokens: string[] = [];

  source
    .replace(/[;#].*$|\/\/.*$/gm, '')
    .split(/\r?\n/)
    .forEach((line, index, lines) => {
      const lineTokens = line
        .replace(/([[]|\])/g, ' $1 ')
        .trim()
        .split(/\s+/)
        .filter(Boolean);

      tokens.push(...lineTokens);

      if (index < lines.length - 1) {
        tokens.push(LINE_BREAK);
      }
    });

  return tokens;
}

function normalizeCommand(token: string) {
  return token.toUpperCase().replace(/:$/, '');
}

function parseNumericExpression(
  tokens: string[],
  startIndex: number,
  variables: Map<string, number>,
  errors: string[],
) {
  let index = startIndex;

  const skipLineBreaks = () => {
    while (tokens[index] === LINE_BREAK) index += 1;
  };

  const parsePrimary = (): { ok: boolean; value: number } => {
    skipLineBreaks();
    const token = tokens[index];

    if (isExpressionTerminator(token)) {
      return { ok: false, value: 0 };
    }

    if (token === '+' || token === '-') {
      index += 1;
      const primary = parsePrimary();
      return {
        ok: primary.ok,
        value: token === '-' ? -primary.value : primary.value,
      };
    }

    if (isVariableToken(token)) {
      index += 1;
      const variableName = normalizeVariableName(token);
      const value = variables.get(variableName);

      if (value === undefined) {
        errors.push(`Unknown variable: ${token}`);
        return { ok: true, value: 0 };
      }

      return { ok: true, value };
    }

    const value = Number(token);
    if (Number.isFinite(value)) {
      index += 1;
      return { ok: true, value };
    }

    return { ok: false, value: 0 };
  };

  const parseTerm = (): { ok: boolean; value: number } => {
    let left = parsePrimary();
    if (!left.ok) return left;

    while (true) {
      skipLineBreaks();
      const operator = tokens[index];
      if (operator !== '*' && operator !== '/') break;

      index += 1;
      const right = parsePrimary();
      if (!right.ok) {
        errors.push(`Expected a number after ${operator}.`);
        return { ok: false, value: left.value };
      }

      if (operator === '*') {
        left = { ok: true, value: left.value * right.value };
      } else {
        if (right.value === 0) {
          errors.push('Division by zero.');
          left = { ok: false, value: 0 };
        } else {
          left = { ok: true, value: left.value / right.value };
        }
      }
    }

    return left;
  };

  const parseExpression = (): { ok: boolean; value: number } => {
    let left = parseTerm();
    if (!left.ok) return left;

    while (true) {
      skipLineBreaks();
      const operator = tokens[index];
      if (!isOperatorToken(operator) || operator === '*' || operator === '/') {
        break;
      }

      index += 1;
      const right = parseTerm();
      if (!right.ok) {
        errors.push(`Expected a number after ${operator}.`);
        return { ok: false, value: left.value };
      }

      left = {
        ok: true,
        value:
          operator === '+'
            ? left.value + right.value
            : left.value - right.value,
      };
    }

    return left;
  };

  const result = parseExpression();

  return {
    ok: result.ok,
    value: result.value,
    nextIndex: index,
    consumed: index - startIndex,
  };
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

function findProcedureEnd(tokens: string[], startIndex: number) {
  for (let index = startIndex; index < tokens.length; index += 1) {
    if (normalizeCommand(tokens[index]) === 'END') return index;
  }

  return -1;
}

function parseProgram(tokens: string[]) {
  const procedures = new Map<string, string[]>();
  const mainTokens: string[] = [];
  const errors: string[] = [];

  for (let index = 0; index < tokens.length; index += 1) {
    if (normalizeCommand(tokens[index]) !== 'TO') {
      mainTokens.push(tokens[index]);
      continue;
    }

    const rawName = tokens[index + 1];
    if (!rawName) {
      errors.push('TO expects a function name.');
      break;
    }

    const name = normalizeCommand(rawName);
    const endIndex = findProcedureEnd(tokens, index + 2);

    if (endIndex === -1) {
      errors.push(`TO ${rawName} is missing END.`);
      break;
    }

    procedures.set(name, tokens.slice(index + 2, endIndex));
    index = endIndex;
  }

  return { mainTokens, procedures, errors };
}

function isBrushName(value: string): value is BrushName {
  return value === 'default' || value === 'rainbow' || value === 'square';
}

function cloneBrushConfig(config: BrushConfig): BrushConfig {
  return {
    square: {
      width: config.square.width,
      smooth: config.square.smooth,
    },
  };
}

function createBrushState(initialBrushState?: BrushState): BrushState {
  const baseState = initialBrushState ?? DEFAULT_BRUSH_STATE;
  return {
    name: baseState.name,
    config: cloneBrushConfig(baseState.config),
  };
}

function parseBooleanValueToken(
  token: string | undefined,
  variables: Map<string, number>,
) {
  if (!token) return { ok: false, value: false };

  if (isVariableToken(token)) {
    const value = variables.get(normalizeVariableName(token));
    if (value === undefined) return { ok: false, value: false };
    return { ok: true, value: value !== 0 };
  }

  const normalizedToken = `${token}`.toLowerCase();
  if (['true', 'on', 'yes'].includes(normalizedToken)) {
    return { ok: true, value: true };
  }
  if (['false', 'off', 'no'].includes(normalizedToken)) {
    return { ok: true, value: false };
  }

  const numericValue = Number(token);
  if (Number.isFinite(numericValue)) {
    return { ok: true, value: numericValue !== 0 };
  }

  return { ok: false, value: false };
}

export function interpretLogo(
  source: string,
  initialBrushState?: BrushState,
): LogoResult {
  const tokens = tokenizeLogo(source);
  const program = parseProgram(tokens);
  const turtle: Turtle = { x: 0, y: 0, heading: 0, penDown: true };
  const segments: Segment[] = [];
  const errors: string[] = [...program.errors];
  const variables = new Map<string, number>();
  const brushState = createBrushState(initialBrushState);
  let hasBrushCommands = false;
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

  const executeRange = (
    stream: string[],
    start: number,
    end: number,
    callDepth = 0,
  ) => {
    if (callDepth > MAX_CALL_DEPTH) {
      errors.push('Procedure call depth limit reached.');
      return;
    }

    let index = start;

    while (index < end && stepCount < MAX_STEPS) {
      const token = stream[index];
      if (token === LINE_BREAK) {
        index += 1;
        continue;
      }

      const command = normalizeCommand(token);
      stepCount += 1;

      if (isVariableToken(token) && stream[index + 1] === '=') {
        const expression = parseNumericExpression(
          stream,
          index + 2,
          variables,
          errors,
        );

        if (!expression.ok && expression.consumed === 0) {
          errors.push(`Expected a numeric expression after ${token} =.`);
          index += 2;
          continue;
        }

        const variableName = normalizeVariableName(token);
        variables.set(variableName, expression.value);
        index = expression.nextIndex;
        continue;
      }

      if (command === '[' || command === ']') {
        index += 1;
        continue;
      }

      if (command === 'REPEAT') {
        const repeatExpression = parseNumericExpression(
          stream,
          index + 1,
          variables,
          errors,
        );

        const repeatCount = Math.max(
          0,
          Math.min(MAX_REPEAT_COUNT, Math.floor(repeatExpression.value)),
        );
        const openIndex = repeatExpression.nextIndex;

        if (stream[openIndex] !== '[') {
          errors.push('REPEAT expects a bracketed command block.');
          index = repeatExpression.nextIndex;
          continue;
        }

        const closeIndex = findClosingBracket(stream, openIndex);
        if (closeIndex === -1) {
          errors.push('REPEAT block is missing a closing bracket.');
          return;
        }

        for (
          let repeatIndex = 0;
          repeatIndex < repeatCount && stepCount < MAX_STEPS;
          repeatIndex += 1
        ) {
          executeRange(stream, openIndex + 1, closeIndex, callDepth + 1);
        }

        index = closeIndex + 1;
        continue;
      }

      if (COMMANDS_WITH_ARG.has(command)) {
        const amountExpression = parseNumericExpression(
          stream,
          index + 1,
          variables,
          errors,
        );

        if (!amountExpression.ok && amountExpression.consumed === 0) {
          errors.push(`Expected a numeric expression after ${token}.`);
          index += 1;
          continue;
        }

        const amount = amountExpression.value;

        if (command === 'FD' || command === 'FORWARD') move(amount);
        if (command === 'BK' || command === 'BACK') move(-amount);
        if (command === 'RT' || command === 'RIGHT') turtle.heading += amount;
        if (command === 'LT' || command === 'LEFT') turtle.heading -= amount;

        index = amountExpression.nextIndex;
        continue;
      }

      if (command === 'PU' || command === 'PENUP') {
        turtle.penDown = false;
        index += 1;
        continue;
      }

      if (command === 'SETBRUSH' || command === 'SB') {
        const nextBrushToken = stream[index + 1];
        if (!nextBrushToken || isExpressionTerminator(nextBrushToken)) {
          errors.push('SETBRUSH expects a brush type.');
          index += 1;
          continue;
        }

        const nextBrush = normalizeCommand(nextBrushToken).toLowerCase();
        if (!isBrushName(nextBrush)) {
          errors.push(`Unknown brush type: ${nextBrushToken}`);
          index += 2;
          continue;
        }

        brushState.name = nextBrush;
        hasBrushCommands = true;
        index += 2;
        continue;
      }

      if (command === 'SETBRUSHVALUE' || command === 'SBV') {
        const keyToken = stream[index + 1];
        if (!keyToken || isExpressionTerminator(keyToken)) {
          errors.push('SETBRUSHVALUE expects a key and value.');
          index += 1;
          continue;
        }

        const normalizedKey = normalizeCommand(keyToken).toLowerCase();

        if (normalizedKey === 'width') {
          const widthExpression = parseNumericExpression(
            stream,
            index + 2,
            variables,
            errors,
          );

          if (!widthExpression.ok && widthExpression.consumed === 0) {
            errors.push('SBV WIDTH expects a numeric value.');
            index += 2;
            continue;
          }

          brushState.config.square.width = widthExpression.value;
          hasBrushCommands = true;
          index = widthExpression.nextIndex;
          continue;
        }

        if (normalizedKey === 'smooth') {
          const smoothToken = stream[index + 2];
          const smoothValue = parseBooleanValueToken(smoothToken, variables);

          if (!smoothValue.ok) {
            errors.push('SBV SMOOTH expects a boolean value.');
            index += 2;
            continue;
          }

          brushState.config.square.smooth = smoothValue.value;
          hasBrushCommands = true;
          index += 3;
          continue;
        }

        errors.push(`Unknown brush value key: ${keyToken}`);
        index += 2;
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

      const procedure = program.procedures.get(command);
      if (procedure) {
        executeRange(procedure, 0, procedure.length, callDepth + 1);
        index += 1;
        continue;
      }

      errors.push(`Unknown command: ${token}`);
      index += 1;
    }
  };

  executeRange(program.mainTokens, 0, program.mainTokens.length);

  if (stepCount >= MAX_STEPS) {
    errors.push(`Stopped after ${MAX_STEPS.toLocaleString()} turtle steps.`);
  }

  return {
    segments,
    turtle,
    errors,
    stepCount,
    style: DEFAULT_STYLE,
    brushState,
    hasBrushCommands,
  };
}

/** Stack layer: interpret Logo source text into a LogoResult. */
export const logoInterpreterLayer: RenderingStackMember<string, LogoResult> = {
  name: 'Logo interpreter',
  run(source) {
    const result = interpretLogo(source);
    return new RenderMonad(result, result.errors);
  },
};

export function logoInterpreterLayerWithBrushState(
  brushName: BrushName,
  brushConfig: BrushConfig = DEFAULT_BRUSH_CONFIG,
): RenderingStackMember<string, LogoResult> {
  return {
    name: 'Logo interpreter',
    run(source) {
      const result = interpretLogo(source, {
        name: brushName,
        config: cloneBrushConfig(brushConfig),
      });
      return new RenderMonad(result, result.errors);
    },
  };
}
