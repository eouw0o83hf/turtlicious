import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
  DEFAULT_BRUSH_CONFIG,
  RenderMonad,
  brushLayer,
  createOutlineProgram,
  createSvgMarkup,
  interpretLogo,
  logoInterpreterLayer,
  renderLogoStack,
  matchesCommand,
  getMovementCommands,
  getPenCommands,
  getTurtleCommands,
  getStyleCommands,
  getControlCommands,
  getProcedureCommands,
  COMMAND_NAMES,
} from './renderer';

function expectPoint(actual: number, expected: number) {
  expect(actual).toBeCloseTo(expected, 6);
}

function getViewBox(svg: string) {
  const match = svg.match(/viewBox="([^"]+)"/);
  if (!match) throw new Error('SVG is missing a viewBox.');
  return match[1].split(' ').map(Number);
}

describe('interpretLogo', () => {
  it('moves forward and turns the turtle through 2d space', () => {
    const result = interpretLogo('FD 10 RT 90 FD 5');

    expect(result.errors).toEqual([]);
    expect(result.segments).toHaveLength(2);
    expectPoint(result.segments[0].x1, 0);
    expectPoint(result.segments[0].y1, 0);
    expectPoint(result.segments[0].x2, 0);
    expectPoint(result.segments[0].y2, -10);
    expectPoint(result.segments[1].x1, 0);
    expectPoint(result.segments[1].y1, -10);
    expectPoint(result.segments[1].x2, 5);
    expectPoint(result.segments[1].y2, -10);
    expectPoint(result.turtle.x, 5);
    expectPoint(result.turtle.y, -10);
    expectPoint(result.turtle.heading, 90);
  });

  it('supports pen up and pen down without drawing hidden movement', () => {
    const result = interpretLogo('FD 10 PU FD 20 PD BK 5');

    expect(result.errors).toEqual([]);
    expect(result.segments).toHaveLength(2);
    expectPoint(result.segments[0].y2, -10);
    expectPoint(result.segments[1].y1, -30);
    expectPoint(result.segments[1].y2, -25);
  });

  it('supports repeat blocks and case-insensitive long command names', () => {
    const result = interpretLogo('repeat 4 [ forward 10 right 90 ]');

    expect(result.errors).toEqual([]);
    expect(result.segments).toHaveLength(4);
    expectPoint(result.turtle.x, 0);
    expectPoint(result.turtle.y, 0);
    expectPoint(result.turtle.heading, 360);
  });

  it('resets position, heading, pen, and trails with clear screen', () => {
    const result = interpretLogo('FD 10 RT 90 PU CS FD 5');

    expect(result.errors).toEqual([]);
    expect(result.segments).toHaveLength(1);
    expectPoint(result.segments[0].x1, 0);
    expectPoint(result.segments[0].y1, 0);
    expectPoint(result.segments[0].x2, 0);
    expectPoint(result.segments[0].y2, -5);
    expect(result.turtle.penDown).toBe(true);
  });

  it('reports malformed or unknown commands while preserving valid trails', () => {
    const result = interpretLogo('FD 10 WIGGLE REPEAT 2 FD 5');

    expect(result.segments).toHaveLength(2);
    expect(result.errors).toContain('Unknown command: WIGGLE');
    expect(result.errors).toContain(
      'REPEAT expects a bracketed command block.',
    );
  });

  it('supports named procedures with TO and END', () => {
    const result = interpretLogo(`
to star:
  repeat 5 [
    fd 100
    rt 144
  ]
end

star:
`);

    expect(result.errors).toEqual([]);
    expect(result.segments).toHaveLength(5);
    expectPoint(result.turtle.heading, 720);
  });

  it('supports OUTLINE to draw only the rendered outline of a procedure', () => {
    const result = interpretLogo(`
TO FOO [
  SB SQUARE
  SBV WIDTH 50
  FD 100
]
END

OUTLINE FOO
`);

    const xs = result.segments.flatMap((segment) => [segment.x1, segment.x2]);
    const ys = result.segments.flatMap((segment) => [segment.y1, segment.y2]);

    expect(result.errors).toEqual([]);
    expect(result.segments).toHaveLength(4);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(50, 6);
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(100, 6);
  });

  it('reports missing or unknown procedure names for OUTLINE', () => {
    const missingName = interpretLogo('OUTLINE');
    const unknownName = interpretLogo('OUTLINE MISSING_PROC');

    expect(missingName.errors).toContain('OUTLINE expects a procedure name.');
    expect(unknownName.errors).toContain('Unknown procedure: MISSING_PROC');
  });

  it('keeps active brush settings when executing OUTLINE', () => {
    const result = renderLogoStack(`
TO FOO [
  FD 100
]
END

SB SQUARE
SBV WIDTH 50
OUTLINE FOO
`).value;

    expect(result.errors).toEqual([]);
    expect(result.style.strokeWidth).toBe(50);
    expect(result.style.strokeLinejoin).toBe('miter');
    expect(result.style.strokeLinecap).toBe('butt');
  });

  it('substitutes numeric variables and arithmetic in later commands', () => {
    const result = interpretLogo(`
$A = 10
$B = $A + 1
$C = $B * 2
$D = $C - 2

FD $D / 5
`);

    expect(result.errors).toEqual([]);
    expect(result.segments).toHaveLength(1);
    expectPoint(result.segments[0].y2, -4);
    expectPoint(result.turtle.x, 0);
    expectPoint(result.turtle.y, -4);
    expectPoint(result.turtle.heading, 0);
  });

  it('reports undefined variables', () => {
    const result = interpretLogo('FD $missing');

    expect(result.errors).toContain('Unknown variable: $missing');
    expect(result.segments).toHaveLength(1);
  });

  it('supports case-invariant brush style commands and shorthands', () => {
    const result = interpretLogo('Sb SqUaRe SBV width 50 sBv smooth true');

    expect(result.errors).toEqual([]);
    expect(result.brushState.name).toBe('square');
    expect(result.brushState.config.square.width).toBe(50);
    expect(result.brushState.config.square.smooth).toBe(true);
  });

  it('supports semicolon, hash, and double-slash comments', () => {
    const resultSemicolon = interpretLogo('FD 10 ; this is a comment');
    const resultHash = interpretLogo('FD 10 # this is a comment');
    const resultDoubleSlash = interpretLogo('FD 10 // this is a comment');

    expect(resultSemicolon.errors).toEqual([]);
    expect(resultSemicolon.segments).toHaveLength(1);
    expect(resultHash.errors).toEqual([]);
    expect(resultHash.segments).toHaveLength(1);
    expect(resultDoubleSlash.errors).toEqual([]);
    expect(resultDoubleSlash.segments).toHaveLength(1);
  });

  it('ignores everything after comment marker on a line', () => {
    const result = interpretLogo(`
      FD 10 // RT 90 FD 5 would be parsed here
      RT 90
      FD 5 # but this comment prevents FD 5 RT 90 FD 10
    `);

    expect(result.errors).toEqual([]);
    expect(result.segments).toHaveLength(2);
    expectPoint(result.segments[0].y2, -10);
    expectPoint(result.segments[1].x2, 5);
  });
});

describe('createSvgMarkup', () => {
  it('serializes interpreted trails and turtle marker as svg', () => {
    const result = interpretLogo('FD 10');
    const svg = createSvgMarkup(result);

    expect(svg).toContain('<svg');
    expect(svg).toContain('aria-label="Turtle sketch"');
    expect(svg).toContain('stroke="#33ff33"');
    expect(svg).toContain('<line x1="0.00" y1="0.00" x2="0.00" y2="-10.00" />');
    expect(svg).toContain('<polygon');
  });

  it('keeps the default sketch bounds for drawings that fit', () => {
    const svg = createSvgMarkup(interpretLogo('FD 10 RT 90 FD 10'));

    expect(getViewBox(svg)).toEqual([-320, -240, 640, 480]);
  });

  it('expands the sketch bounds when the turtle traverses past an edge', () => {
    const svg = createSvgMarkup(interpretLogo('RT 90 FD 500'));
    const [minX, minY, width, height] = getViewBox(svg);

    expect(minX).toBe(-320);
    expect(minY).toBe(-240);
    expect(width).toBeGreaterThan(640);
    expect(height).toBe(480);
    expect(svg).toContain(
      `<rect x="${minX}" y="${minY}" width="${width}" height="${height}" fill="#000000" />`,
    );
  });

  it('supports export options for black lines without turtle', () => {
    const svg = createSvgMarkup(interpretLogo('FD 10 RT 45 FD 10'), {
      includeTurtle: false,
      includeBackground: false,
      strokeColorOverride: '#000000',
    });

    expect(svg).toContain('stroke="#000000"');
    expect(svg).not.toContain('<polygon');
    expect(svg).not.toContain('<rect ');
  });
});

describe('render stack', () => {
  it('composes stack members through the render monad contract', () => {
    const stack = RenderMonad.of('FD 10').chain(logoInterpreterLayer);

    expect(stack.errors).toEqual([]);
    expect(stack.value.segments).toHaveLength(1);
    expect(stack.value.style.pathColor).toBe('#33ff33');
  });

  it('propagates interpreter diagnostics through the stack', () => {
    const stack = renderLogoStack('WIGGLE');

    expect(stack.errors).toContain('Unknown command: WIGGLE');
  });

  it('renders paths with the default green color', () => {
    const stack = renderLogoStack('FD 10');
    const svg = createSvgMarkup(stack.value);

    expect(svg).toContain('stroke="#33ff33"');
    expect(svg).toContain('fill="#33ff33"');
  });

  it('applies in-script brush commands over initial brush defaults', () => {
    const stack = renderLogoStack(
      'SB square SBV width 50 SBV smooth false RT 90 FD 100 LT 45 FD 100',
      'default',
      DEFAULT_BRUSH_CONFIG,
    );
    const svg = createSvgMarkup(stack.value);

    expect(svg).toContain('stroke-width="50.00"');
    expect(svg).toContain('stroke-linejoin="miter"');
    expect(svg).toContain('stroke-linecap="butt"');
  });

  it('creates an outline program from the final rendered stroke footprint', () => {
    const outlinedSource = createOutlineProgram(
      renderLogoStack('SB square\nSBV width 50\nFD 100').value,
    );
    const outlined = renderLogoStack(outlinedSource).value;
    const xs = outlined.segments.flatMap((segment) => [segment.x1, segment.x2]);
    const ys = outlined.segments.flatMap((segment) => [segment.y1, segment.y2]);

    expect(outlined.errors).toEqual([]);
    expect(outlined.segments).toHaveLength(4);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(50, 6);
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(100, 6);
  });

  it('keeps orthogonal square-brush outlines axis-aligned for right-angle paths', () => {
    const outlinedSource = createOutlineProgram(
      renderLogoStack('SB square\nSBV width 100\nFD 100\nRT 90\nFD 100').value,
    );
    const outlined = renderLogoStack(outlinedSource).value;
    const epsilon = 1e-6;

    expect(outlinedSource).toContain('PD');
    expect(outlined.errors).toEqual([]);
    expect(outlined.segments.length).toBeGreaterThan(0);

    outlined.segments.forEach((segment) => {
      const isVertical = Math.abs(segment.x1 - segment.x2) <= epsilon;
      const isHorizontal = Math.abs(segment.y1 - segment.y2) <= epsilon;
      expect(isVertical || isHorizontal).toBe(true);
    });
  });
});

describe('brush layer', () => {
  it('default brush leaves segments and style unchanged', () => {
    const base = RenderMonad.of('FD 10 RT 90 FD 5').chain(logoInterpreterLayer);
    const brushed = base.chain(brushLayer('default'));

    expect(brushed.value.segments).toHaveLength(2);
    expect(brushed.value.style.pathColor).toBe('#33ff33');
    expect(brushed.value.style.glow).toBe(true);
    expect(brushed.value.segments[0].color).toBeUndefined();
  });

  it('rainbow brush assigns per-segment hsl colors and disables glow', () => {
    const base = RenderMonad.of('REPEAT 4 [ FD 10 RT 90 ]').chain(
      logoInterpreterLayer,
    );
    const brushed = base.chain(brushLayer('rainbow'));

    expect(brushed.value.style.glow).toBe(false);
    brushed.value.segments.forEach((seg) => {
      expect(seg.color).toMatch(/^hsl\(/);
    });
  });

  it('rainbow svg contains per-segment stroke attributes', () => {
    const stack = renderLogoStack('FD 10 RT 90 FD 10', 'rainbow');
    const svg = createSvgMarkup(stack.value);

    expect(svg).toContain('stroke="hsl(');
    expect(svg).not.toContain('drop-shadow');
  });

  it('square brush renders configurable width and angular corners', () => {
    const stack = renderLogoStack('RT 90 FD 100 LT 45 FD 100', 'square', {
      square: { width: 50, smooth: false },
    });
    const svg = createSvgMarkup(stack.value);

    expect(svg).toContain('stroke-width="50.00"');
    expect(svg).toContain('stroke-linejoin="miter"');
    expect(svg).toContain('stroke-linecap="butt"');
    expect(svg).toMatch(
      /<polyline points="0\.00,0\.00 100\.00,-?0\.00 170\.71,-70\.71"/,
    );
  });

  it('square brush renders smooth curved corners when enabled', () => {
    const stack = renderLogoStack('RT 90 FD 100 LT 45 FD 100', 'square', {
      square: { width: 50, smooth: true },
    });
    const svg = createSvgMarkup(stack.value);

    expect(svg).toContain('stroke-width="50.00"');
    expect(svg).toContain('stroke-linejoin="round"');
    expect(svg).toContain('stroke-linecap="round"');
  });
});

// ============================================================================
// Constraint Tests - Enforce Language Definition Usage
// ============================================================================

describe('interpreter implementation constraints', () => {
  it('CONSTRAINT: matchesCommand() function validates all command groups', () => {
    // This test ensures that the matchesCommand function works correctly
    // and that all command group functions are properly defined

    // Test movement commands
    const movementCmds = getMovementCommands();
    expect(movementCmds).toContain('FD');
    expect(movementCmds).toContain('FORWARD');
    expect(movementCmds).toContain('BK');
    expect(movementCmds).toContain('BACK');
    expect(movementCmds).toContain('RT');
    expect(movementCmds).toContain('RIGHT');
    expect(movementCmds).toContain('LT');
    expect(movementCmds).toContain('LEFT');

    // Test pen commands
    const penCmds = getPenCommands();
    expect(penCmds).toContain('PU');
    expect(penCmds).toContain('PENUP');
    expect(penCmds).toContain('PD');
    expect(penCmds).toContain('PENDOWN');

    // Test turtle commands
    const turtleCmds = getTurtleCommands();
    expect(turtleCmds).toContain('HOME');
    expect(turtleCmds).toContain('CS');
    expect(turtleCmds).toContain('CLEARSCREEN');

    // Test style commands
    const styleCmds = getStyleCommands();
    expect(styleCmds).toContain('SETBRUSH');
    expect(styleCmds).toContain('SB');
    expect(styleCmds).toContain('SETBRUSHVALUE');
    expect(styleCmds).toContain('SBV');

    // Test control commands
    const controlCmds = getControlCommands();
    expect(controlCmds).toContain('REPEAT');

    // Test procedure commands
    const procedureCmds = getProcedureCommands();
    expect(procedureCmds).toContain('TO');
    expect(procedureCmds).toContain('END');
    expect(procedureCmds).toContain('OUTLINE');
  });

  it('CONSTRAINT: CommandName type covers all command group members', () => {
    // Verify that every value returned by the group helpers is also in
    // the canonical COMMAND_NAMES tuple.  If a group function referenced
    // a string that was not in COMMAND_NAMES, TypeScript would already
    // reject it at compile time (CommandName[]), but this runtime check
    // provides a second safety net and documents the expectation.
    const allGroupMembers: string[] = [
      ...getMovementCommands(),
      ...getPenCommands(),
      ...getTurtleCommands(),
      ...getStyleCommands(),
      ...getControlCommands(),
      ...getProcedureCommands(),
    ];

    const nameSet = new Set<string>(COMMAND_NAMES);
    allGroupMembers.forEach((name) => {
      expect(nameSet.has(name)).toBe(true);
    });
  });

  it('CONSTRAINT: matchesCommand() correctly identifies command matches', () => {
    // Verify matchesCommand works for all command types
    expect(matchesCommand('FD', 'FD')).toBe(true);
    expect(matchesCommand('FORWARD', 'FORWARD')).toBe(true);
    expect(matchesCommand('BK', 'BK')).toBe(true);
    expect(matchesCommand('HOME', 'HOME')).toBe(true);
    expect(matchesCommand('PU', 'PU')).toBe(true);
    expect(matchesCommand('CS', 'CS')).toBe(true);
    expect(matchesCommand('SB', 'SB')).toBe(true);

    // Verify non-matches
    expect(matchesCommand('FD', 'BK')).toBe(false);
    expect(matchesCommand('HOME', 'CS')).toBe(false);
    expect(matchesCommand('PU', 'PD')).toBe(false);
  });

  it('CONSTRAINT: All built-in commands are executable', () => {
    // Test that all major command groups actually work in the interpreter
    const commandTests = [
      { code: 'FD 10', expectedSegments: 1, desc: 'FORWARD command' },
      { code: 'BK 5', expectedSegments: 1, desc: 'BACK command' },
      { code: 'PU FD 10 PD FD 10', expectedSegments: 1, desc: 'PEN commands' },
      { code: 'HOME', expectedSegments: 0, desc: 'HOME command' },
      { code: 'CS FD 10', expectedSegments: 1, desc: 'CLEARSCREEN command' },
      {
        code: 'SB RAINBOW FD 10',
        expectedSegments: 1,
        desc: 'SETBRUSH command',
      },
      { code: 'REPEAT 2 [FD 10]', expectedSegments: 2, desc: 'REPEAT command' },
      {
        code: 'TO FOO [ SB SQUARE SBV WIDTH 50 FD 100 ] END OUTLINE FOO',
        expectedSegments: 4,
        desc: 'OUTLINE command',
      },
    ];

    commandTests.forEach((test) => {
      const result = interpretLogo(test.code);
      expect(result.errors, `${test.desc} should not produce errors`).toEqual(
        [],
      );
      expect(
        result.segments,
        `${test.desc} should produce expected segments`,
      ).toHaveLength(test.expectedSegments);
    });
  });

  it('CONSTRAINT: interpreter.ts contains no direct string/char equality comparisons for command dispatch', () => {
    // Read the interpreter source at test time so any future edits are
    // caught immediately on the next test run.
    const dir = dirname(fileURLToPath(import.meta.url));
    const source = readFileSync(
      resolve(dir, 'renderer/interpreter.ts'),
      'utf-8',
    );

    // Remove line comments so commented-out examples don't trigger false positives.
    const stripped = source
      .split('\n')
      .map((line) => line.replace(/\/\/.*$/, ''))
      .join('\n');

    // Every `=== 'anything'` or `=== "anything"` is forbidden.
    // All token literals must be imported named constants from language.ts;
    // no raw string literals may appear in equality comparisons.
    const forbiddenPattern = /===\s*['"][^'"]+['"]/g;
    const violations = [...stripped.matchAll(forbiddenPattern)].map(
      (m) => m[0],
    );

    expect(
      violations,
      'interpreter.ts must not use direct string literals in equality comparisons. ' +
        'All token literals must be named constants imported from language.ts. ' +
        `Found: ${violations.join(', ')}`,
    ).toEqual([]);
  });
});
