// ---------------------------------------------------------------------------
// Logo / turtle language interpreter.
//
// Implements the Turtlicious Logo language as defined in language.ts.
// Does not define the language; uses canonical definitions from language.ts.
// ---------------------------------------------------------------------------

import { RenderMonad, type RenderingStackMember } from './monad';
import { brushLayer } from './brush';
import { createOutlineProgram } from './outline';
import {
  DEFAULT_BRUSH_CONFIG,
  DEFAULT_BRUSH_STATE,
  type BrushConfig,
  type BrushName,
  type BrushState,
  type LogoResult,
  type Segment,
  type Turtle,
} from './types';
import {
  DEFAULT_PROGRAM,
  DEFAULT_STYLE,
  MAX_REPEAT_COUNT,
  MAX_STEPS,
  MAX_CALL_DEPTH,
  LINE_BREAK,
  COMMENT_STRIP_PATTERN,
  BLOCK_OPEN,
  BLOCK_CLOSE,
  ASSIGN_TOKEN,
  OP_ADD,
  OP_SUB,
  OP_MUL,
  OP_DIV,
  SBV_KEY_WIDTH,
  SBV_KEY_SMOOTH,
  isBrushName,
  matchesCommand,
  getMovementCommands,
  getPenCommands,
  getControlCommands,
  getBlockTokens,
  getProcedureCommands,
} from './language';

// Re-export default program for public API
export const DEFAULT_CODE = DEFAULT_PROGRAM;

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
    token === BLOCK_OPEN ||
    token === BLOCK_CLOSE
  );
}

function isOperatorToken(token: string | undefined) {
  return (
    token === OP_ADD || token === OP_SUB || token === OP_MUL || token === OP_DIV
  );
}

function tokenizeLogo(source: string) {
  const tokens: string[] = [];

  source
    .replace(COMMENT_STRIP_PATTERN, '')
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

function normalizeCommand(token: string | undefined) {
  if (!token) return '';
  return token.toUpperCase().replace(/:$/, '');
}

function parseNumericExpression(
  tokens: string[],
  startIndex: number,
  variables: Map<string, number | string>,
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

    if (token === OP_ADD || token === OP_SUB) {
      index += 1;
      const primary = parsePrimary();
      return {
        ok: primary.ok,
        value: token === OP_SUB ? -primary.value : primary.value,
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

      const numValue = value as number;
      if (!Number.isFinite(numValue)) {
        errors.push(`Variable ${token} contains a procedure, not a number.`);
        return { ok: true, value: 0 };
      }

      return { ok: true, value: numValue };
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
      if (operator !== OP_MUL && operator !== OP_DIV) break;

      index += 1;
      const right = parsePrimary();
      if (!right.ok) {
        errors.push(`Expected a number after ${operator}.`);
        return { ok: false, value: left.value };
      }

      if (operator === OP_MUL) {
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
      if (
        !isOperatorToken(operator) ||
        operator === OP_MUL ||
        operator === OP_DIV
      ) {
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
          operator === OP_ADD
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
    if (tokens[index] === BLOCK_OPEN) depth += 1;
    if (tokens[index] === BLOCK_CLOSE) depth -= 1;
    if (depth === 0) return index;
  }

  return -1;
}

function findProcedureEnd(tokens: string[], startIndex: number) {
  for (let index = startIndex; index < tokens.length; index += 1) {
    if (matchesCommand(normalizeCommand(tokens[index]), 'END')) return index;
  }

  return -1;
}

function parseProgram(tokens: string[]) {
  const procedures = new Map<string, string[]>();
  const mainTokens: string[] = [];
  const errors: string[] = [];

  for (let index = 0; index < tokens.length; index += 1) {
    if (!matchesCommand(normalizeCommand(tokens[index]), 'TO')) {
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

function cloneTurtleState(turtle: Turtle): Turtle {
  return {
    x: turtle.x,
    y: turtle.y,
    heading: turtle.heading,
    penDown: turtle.penDown,
  };
}

function restoreVariables(
  target: Map<string, number | string>,
  snapshot: Map<string, number | string>,
) {
  target.clear();
  snapshot.forEach((value, key) => {
    target.set(key, value);
  });
}

function parseBooleanValueToken(
  token: string | undefined,
  variables: Map<string, number | string>,
) {
  if (!token) return { ok: false, value: false };

  if (isVariableToken(token)) {
    const value = variables.get(normalizeVariableName(token));
    if (value === undefined) return { ok: false, value: false };
    const numValue = value as number;
    return {
      ok: true,
      value: Number.isFinite(numValue) ? numValue !== 0 : value !== '',
    };
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
  const variables = new Map<string, number | string>();
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
      if (!token || token === LINE_BREAK) {
        index += 1;
        continue;
      }

      const command = normalizeCommand(token);
      stepCount += 1;

      if (isVariableToken(token) && stream[index + 1] === ASSIGN_TOKEN) {
        const nextCommand = normalizeCommand(stream[index + 2]);

        if (matchesCommand(nextCommand, 'OUTLINE')) {
          const procedureNameToken = stream[index + 3];
          if (
            !procedureNameToken ||
            isExpressionTerminator(procedureNameToken) ||
            matchesCommand(
              normalizeCommand(procedureNameToken),
              ...getBlockTokens(),
            )
          ) {
            errors.push('OUTLINE expects a procedure name.');
            index += 2;
            continue;
          }

          const procedureNameOrVar = normalizeVariableName(procedureNameToken);
          let procedure: string[] | undefined;

          if (isVariableToken(procedureNameToken)) {
            const storedValue = variables.get(procedureNameOrVar);
            if (storedValue === undefined) {
              errors.push(`Unknown variable: ${procedureNameToken}`);
              index += 4;
              continue;
            }
            const strValue = storedValue as string;
            if (Number.isFinite(strValue as unknown as number)) {
              errors.push(
                `Variable ${procedureNameToken} is not an outline procedure.`,
              );
              index += 4;
              continue;
            }
            procedure = tokenizeLogo(strValue);
          } else {
            procedure = program.procedures.get(
              normalizeCommand(procedureNameToken),
            );
            if (!procedure) {
              errors.push(`Unknown procedure: ${procedureNameToken}`);
              index += 4;
              continue;
            }
          }

          const segmentsStart = segments.length;
          const errorsStart = errors.length;
          const turtleSnapshot = cloneTurtleState(turtle);
          const variablesSnapshot = new Map(variables);
          const brushSnapshot = createBrushState(brushState);
          const hasBrushCommandsSnapshot = hasBrushCommands;

          executeRange(procedure, 0, procedure.length, callDepth + 1);

          const procedureSegments = segments.slice(segmentsStart);
          const procedureBrushState = createBrushState(brushState);
          const procedureHasBrushCommands = hasBrushCommands;
          const procedureTurtle = cloneTurtleState(turtle);

          segments.length = segmentsStart;
          turtle.x = turtleSnapshot.x;
          turtle.y = turtleSnapshot.y;
          turtle.heading = turtleSnapshot.heading;
          turtle.penDown = turtleSnapshot.penDown;
          restoreVariables(variables, variablesSnapshot);
          brushState.name = brushSnapshot.name;
          brushState.config = cloneBrushConfig(brushSnapshot.config);
          hasBrushCommands = hasBrushCommandsSnapshot;

          if (errors.length === errorsStart && procedureSegments.length > 0) {
            const renderedProcedureResult = brushLayer(
              brushSnapshot.name,
              cloneBrushConfig(brushSnapshot.config),
            ).run({
              segments: procedureSegments,
              turtle: procedureTurtle,
              errors: [],
              stepCount: 0,
              style: DEFAULT_STYLE,
              brushState: procedureBrushState,
              hasBrushCommands: procedureHasBrushCommands,
            }).value;

            const outlineProgram = createOutlineProgram(
              renderedProcedureResult,
              {
                resetBrush: false,
              },
            );
            if (outlineProgram) {
              const variableName = normalizeVariableName(token);
              variables.set(variableName, outlineProgram);
            }
          }

          index += 4;
          continue;
        }

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

      if (matchesCommand(command, ...getBlockTokens())) {
        index += 1;
        continue;
      }

      if (matchesCommand(command, ...getControlCommands())) {
        if (!matchesCommand(command, 'REPEAT')) {
          index += 1;
          continue;
        }
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

        if (stream[openIndex] !== BLOCK_OPEN) {
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

      if (matchesCommand(command, ...getMovementCommands())) {
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

        if (matchesCommand(command, 'FD', 'FORWARD')) move(amount);
        if (matchesCommand(command, 'BK', 'BACK')) move(-amount);
        if (matchesCommand(command, 'RT', 'RIGHT')) turtle.heading += amount;
        if (matchesCommand(command, 'LT', 'LEFT')) turtle.heading -= amount;

        index = amountExpression.nextIndex;
        continue;
      }

      if (matchesCommand(command, ...getPenCommands())) {
        if (matchesCommand(command, 'PU', 'PENUP')) {
          turtle.penDown = false;
        } else if (matchesCommand(command, 'PD', 'PENDOWN')) {
          turtle.penDown = true;
        }
        index += 1;
        continue;
      }

      if (matchesCommand(command, 'SETBRUSH', 'SB')) {
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

      if (matchesCommand(command, 'SETBRUSHVALUE', 'SBV')) {
        const keyToken = stream[index + 1];
        if (!keyToken || isExpressionTerminator(keyToken)) {
          errors.push('SETBRUSHVALUE expects a key and value.');
          index += 1;
          continue;
        }

        const normalizedKey = normalizeCommand(keyToken).toLowerCase();

        if (normalizedKey === SBV_KEY_WIDTH) {
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

        if (normalizedKey === SBV_KEY_SMOOTH) {
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

      if (matchesCommand(command, 'HOME')) {
        turtle.x = 0;
        turtle.y = 0;
        turtle.heading = 0;
        index += 1;
        continue;
      }

      if (matchesCommand(command, 'CS', 'CLEARSCREEN')) {
        segments.length = 0;
        turtle.x = 0;
        turtle.y = 0;
        turtle.heading = 0;
        turtle.penDown = true;
        index += 1;
        continue;
      }

      if (matchesCommand(command, ...getProcedureCommands())) {
        if (matchesCommand(command, 'OUTLINE')) {
          const procedureNameToken = stream[index + 1];
          if (
            !procedureNameToken ||
            isExpressionTerminator(procedureNameToken) ||
            matchesCommand(
              normalizeCommand(procedureNameToken),
              ...getBlockTokens(),
            )
          ) {
            errors.push('OUTLINE expects a procedure name.');
            index += 1;
            continue;
          }

          const procedureNameOrVar = normalizeVariableName(procedureNameToken);
          let procedure: string[] | undefined;

          if (isVariableToken(procedureNameToken)) {
            const storedValue = variables.get(procedureNameOrVar);
            if (storedValue === undefined) {
              errors.push(`Unknown variable: ${procedureNameToken}`);
              index += 2;
              continue;
            }
            const strValue = storedValue as string;
            if (Number.isFinite(strValue as unknown as number)) {
              errors.push(
                `Variable ${procedureNameToken} is not an outline procedure.`,
              );
              index += 2;
              continue;
            }
            procedure = tokenizeLogo(strValue);
          } else {
            procedure = program.procedures.get(
              normalizeCommand(procedureNameToken),
            );
          }

          if (!procedure) {
            errors.push(`Unknown procedure: ${procedureNameToken}`);
            index += 2;
            continue;
          }

          const segmentsStart = segments.length;
          const errorsStart = errors.length;
          const turtleSnapshot = cloneTurtleState(turtle);
          const variablesSnapshot = new Map(variables);
          const brushSnapshot = createBrushState(brushState);
          const hasBrushCommandsSnapshot = hasBrushCommands;

          executeRange(procedure, 0, procedure.length, callDepth + 1);

          const procedureSegments = segments.slice(segmentsStart);
          const procedureBrushState = createBrushState(brushState);
          const procedureHasBrushCommands = hasBrushCommands;
          const procedureTurtle = cloneTurtleState(turtle);

          segments.length = segmentsStart;
          turtle.x = turtleSnapshot.x;
          turtle.y = turtleSnapshot.y;
          turtle.heading = turtleSnapshot.heading;
          turtle.penDown = turtleSnapshot.penDown;
          restoreVariables(variables, variablesSnapshot);
          brushState.name = brushSnapshot.name;
          brushState.config = cloneBrushConfig(brushSnapshot.config);
          hasBrushCommands = hasBrushCommandsSnapshot;

          if (errors.length === errorsStart && procedureSegments.length > 0) {
            const renderedProcedureResult = brushLayer(
              brushSnapshot.name,
              cloneBrushConfig(brushSnapshot.config),
            ).run({
              segments: procedureSegments,
              turtle: procedureTurtle,
              errors: [],
              stepCount: 0,
              style: DEFAULT_STYLE,
              brushState: procedureBrushState,
              hasBrushCommands: procedureHasBrushCommands,
            }).value;

            const outlineProgram = createOutlineProgram(
              renderedProcedureResult,
              {
                resetBrush: false,
              },
            );
            if (outlineProgram) {
              const outlineTokens = tokenizeLogo(outlineProgram);
              executeRange(
                outlineTokens,
                0,
                outlineTokens.length,
                callDepth + 1,
              );
            }
          }

          index += 2;
          continue;
        }

        index += 1;
        continue;
      }

      const procedure = program.procedures.get(command);
      if (procedure) {
        executeRange(procedure, 0, procedure.length, callDepth + 1);
        index += 1;
        continue;
      }

      if (isVariableToken(command)) {
        const storedValue = variables.get(normalizeVariableName(command));
        if (storedValue !== undefined) {
          const numValue = storedValue as number;
          if (!Number.isFinite(numValue)) {
            const strValue = storedValue as string;
            const varProcedure = tokenizeLogo(strValue);
            executeRange(varProcedure, 0, varProcedure.length, callDepth + 1);
            index += 1;
            continue;
          }
        }
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
