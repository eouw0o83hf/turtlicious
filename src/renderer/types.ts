// ---------------------------------------------------------------------------
// Core domain types shared across the rendering stack.
// ---------------------------------------------------------------------------

/** Internal turtle state. */
export type Turtle = {
  x: number;
  y: number;
  heading: number;
  penDown: boolean;
};

/** Internal 2-D coordinate helper. */
export type Point = [number, number];

/** A single line segment drawn while the pen is down. */
export type Segment = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

/** Visual style properties that layers can mutate. */
export type LogoStyle = {
  pathColor: string;
  turtleColor: string;
};

/** The value carried through the rendering stack. */
export type LogoResult = {
  segments: Segment[];
  turtle: Turtle;
  errors: string[];
  stepCount: number;
  style: LogoStyle;
};
