import { describe, expect, it } from 'vitest';

import {
  RenderMonad,
  brushLayer,
  createSvgMarkup,
  interpretLogo,
  logoInterpreterLayer,
  renderLogoStack,
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
});
