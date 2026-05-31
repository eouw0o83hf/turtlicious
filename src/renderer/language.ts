// ---------------------------------------------------------------------------
// Turtlicious Logo Language Definition
//
// This file is the canonical definition of the Turtlicious Logo language.
// All language features, commands, constants, and constraints are defined here.
// The interpreter implements this specification; it does not define it.
// All language changes MUST be made here first, then propagated to the
// interpreter and other components.
// ---------------------------------------------------------------------------

/**
 * Command category for documentation and organization.
 */
export type CommandCategory =
  | 'movement'
  | 'pen'
  | 'turtle'
  | 'style'
  | 'control'
  | 'procedure';

/**
 * Parameter definition for a command.
 */
export interface CommandParameter {
  name: string;
  type: 'number' | 'boolean' | 'string';
  description: string;
}

/**
 * Complete command specification.
 */
export interface CommandSpec {
  /** Primary command name (uppercase). */
  name: string;
  /** Short description of what the command does. */
  description: string;
  /** Command category for documentation. */
  category: CommandCategory;
  /** Alternative names/aliases (uppercase). */
  aliases: string[];
  /** Required parameters, in order. */
  parameters: CommandParameter[];
  /** Example usage. */
  example: string;
}

// ============================================================================
// Language Constants
// ============================================================================

/**
 * Default turtle color: Apple II green.
 */
export const COLOR_LOGO_GREEN = '#33ff33';

/**
 * Maximum number of iterations allowed in a REPEAT block.
 */
export const MAX_REPEAT_COUNT = 1000;

/**
 * Maximum number of turtle steps before halting execution.
 */
export const MAX_STEPS = 25_000;

/**
 * Maximum call depth for procedure recursion.
 */
export const MAX_CALL_DEPTH = 256;

/**
 * Boolean values recognized by the interpreter (case-insensitive).
 */
export const BOOLEAN_TRUE_VALUES = ['true', 'on', 'yes'];
export const BOOLEAN_FALSE_VALUES = ['false', 'off', 'no'];

/**
 * Internal line break token used during tokenization.
 */
export const LINE_BREAK = '\n';

// ============================================================================
// Default Style Configuration
// ============================================================================

/**
 * Default visual style for all Logo drawings.
 */
export const DEFAULT_STYLE = {
  pathColor: COLOR_LOGO_GREEN,
  turtleColor: COLOR_LOGO_GREEN,
  glow: true,
  strokeWidth: 2.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  connectSegments: false,
};

// ============================================================================
// Brush Names (Language-Level Definition)
// ============================================================================

/**
 * Available brush styles in the Logo language.
 * These are the canonical brush names available to scripts.
 */
export const BRUSH_NAMES = ['default', 'rainbow', 'square'] as const;

/**
 * Type guard for brush names.
 */
export function isBrushName(
  value: string,
): value is 'default' | 'rainbow' | 'square' {
  return BRUSH_NAMES.includes(value as any);
}

// ============================================================================
// Command Specifications (Language Definition)
// ============================================================================

/**
 * Canonical definitions of all Logo commands.
 * Order matters: this is the authoritative listing.
 */
export const COMMANDS: CommandSpec[] = [
  // Movement Commands
  {
    name: 'FORWARD',
    aliases: ['FD'],
    category: 'movement',
    description: 'Move turtle forward by the specified distance in pixels.',
    parameters: [
      { name: 'distance', type: 'number', description: 'Distance in pixels' },
    ],
    example: 'FD 100',
  },
  {
    name: 'BACK',
    aliases: ['BK'],
    category: 'movement',
    description: 'Move turtle backward by the specified distance in pixels.',
    parameters: [
      { name: 'distance', type: 'number', description: 'Distance in pixels' },
    ],
    example: 'BK 50',
  },
  {
    name: 'RIGHT',
    aliases: ['RT'],
    category: 'turtle',
    description: 'Turn turtle right (clockwise) by the specified degrees.',
    parameters: [
      { name: 'angle', type: 'number', description: 'Angle in degrees' },
    ],
    example: 'RT 90',
  },
  {
    name: 'LEFT',
    aliases: ['LT'],
    category: 'turtle',
    description:
      'Turn turtle left (counterclockwise) by the specified degrees.',
    parameters: [
      { name: 'angle', type: 'number', description: 'Angle in degrees' },
    ],
    example: 'LT 45',
  },

  // Pen Commands
  {
    name: 'PENUP',
    aliases: ['PU'],
    category: 'pen',
    description: 'Lift the pen up; movement will not draw.',
    parameters: [],
    example: 'PU',
  },
  {
    name: 'PENDOWN',
    aliases: ['PD'],
    category: 'pen',
    description: 'Put the pen down; movement will draw.',
    parameters: [],
    example: 'PD',
  },

  // Turtle State Commands
  {
    name: 'HOME',
    aliases: [],
    category: 'turtle',
    description: 'Return turtle to origin (0, 0) with heading 0 degrees.',
    parameters: [],
    example: 'HOME',
  },
  {
    name: 'CLEARSCREEN',
    aliases: ['CS'],
    category: 'turtle',
    description: 'Clear all drawings and reset turtle to origin with pen down.',
    parameters: [],
    example: 'CS',
  },

  // Style Commands
  {
    name: 'SETBRUSH',
    aliases: ['SB'],
    category: 'style',
    description: 'Set the active brush style.',
    parameters: [
      {
        name: 'brushName',
        type: 'string',
        description: 'One of: default, rainbow, square',
      },
    ],
    example: 'SETBRUSH square',
  },
  {
    name: 'SETBRUSHVALUE',
    aliases: ['SBV'],
    category: 'style',
    description: 'Set a configuration value for the current brush.',
    parameters: [
      {
        name: 'key',
        type: 'string',
        description: 'Configuration key (e.g., width, smooth)',
      },
      {
        name: 'value',
        type: 'string',
        description: 'Configuration value (number or boolean)',
      },
    ],
    example: 'SBV WIDTH 50',
  },

  // Control Flow Commands
  {
    name: 'REPEAT',
    aliases: [],
    category: 'control',
    description: 'Repeat a block of commands the specified number of times.',
    parameters: [
      { name: 'count', type: 'number', description: 'Number of iterations' },
      { name: 'block', type: 'string', description: 'Commands in [brackets]' },
    ],
    example: 'REPEAT 4 [ FD 100 RT 90 ]',
  },

  // Procedure Definition Commands
  {
    name: 'TO',
    aliases: [],
    category: 'procedure',
    description: 'Define a named procedure (function) of Logo commands.',
    parameters: [
      { name: 'name', type: 'string', description: 'Procedure name' },
      { name: 'body', type: 'string', description: 'Commands until END' },
    ],
    example: 'TO SQUARE [ REPEAT 4 [ FD 100 RT 90 ] ] END',
  },
  {
    name: 'END',
    aliases: [],
    category: 'procedure',
    description: 'Mark the end of a procedure definition.',
    parameters: [],
    example: 'END',
  },
];

/**
 * Quick lookup for commands that require numeric arguments.
 */
export function commandsWithNumericArg(): Set<string> {
  return new Set(['FD', 'FORWARD', 'BK', 'BACK', 'RT', 'RIGHT', 'LT', 'LEFT']);
}

/**
 * Get command specification by name (case-insensitive).
 */
export function getCommandSpec(commandName: string): CommandSpec | undefined {
  const upper = commandName.toUpperCase();
  return COMMANDS.find(
    (cmd) => cmd.name === upper || cmd.aliases.includes(upper),
  );
}

/**
 * Get all command names (primary + aliases) for validation.
 */
export function getAllCommandNames(): string[] {
  const names: string[] = [];
  COMMANDS.forEach((cmd) => {
    names.push(cmd.name);
    names.push(...cmd.aliases);
  });
  return names;
}

// ============================================================================
// Default Program
// ============================================================================

/**
 * Canonical default program shown on app startup.
 * Demonstrates language features.
 */
export const DEFAULT_PROGRAM = `; Turtlicious turtle sketch
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

// ============================================================================
// Comment Syntax (Language Feature)
// ============================================================================

/**
 * Comment markers recognized by the tokenizer.
 * Comments strip everything from the marker to the end of line.
 */
export const COMMENT_MARKERS = [';', '#', '//'] as const;

/**
 * Regex pattern for removing comments from source code.
 * Strips semicolon, hash, and double-slash comments.
 */
export const COMMENT_STRIP_PATTERN = /[;#].*$|\/\/.*$/gm;
