import { describe, expect, it } from 'vitest';

import { createSvgMarkup, interpretLogo } from './logo';

function expectPoint(actual: number, expected: number) {
  expect(actual).toBeCloseTo(expected, 6);
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
});

describe('createSvgMarkup', () => {
  it('serializes interpreted trails and turtle marker as svg', () => {
    const result = interpretLogo('FD 10');
    const svg = createSvgMarkup(result);

    expect(svg).toContain('<svg');
    expect(svg).toContain('aria-label="Turtle sketch"');
    expect(svg).toContain('<line x1="0.00" y1="0.00" x2="0.00" y2="-10.00" />');
    expect(svg).toContain('<polygon');
  });
});
