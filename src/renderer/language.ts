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

// ============================================================================
// Command Name Registry (single source of truth for all command names)
//
// To add a command to the language:
//   1. Add its name (and any aliases) here.
//   2. TypeScript will require the COMMANDS spec array to use it as-is.
//   3. The interpreter can then reference it via matchesCommand().
// ============================================================================

/**
 * Exhaustive tuple of every built-in command name and alias.
 * This is the single source of truth; all other usages are derived from it.
 */
export const COMMAND_NAMES = [
  'FORWARD',
  'FD',
  'BACK',
  'BK',
  'RIGHT',
  'RT',
  'LEFT',
  'LT',
  'PENUP',
  'PU',
  'PENDOWN',
  'PD',
  'HOME',
  'CLEARSCREEN',
  'CS',
  'SETBRUSH',
  'SB',
  'SETBRUSHVALUE',
  'SBV',
  'REPEAT',
  'TO',
  'END',
  // Block delimiters — structural tokens that appear in the command stream
  '[',
  ']',
] as const;

/** Union type of every valid built-in command name. */
export type CommandName = (typeof COMMAND_NAMES)[number];

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
 * Both `name` and `aliases` are constrained to registered CommandName values,
 * so the COMMANDS array cannot reference names absent from COMMAND_NAMES.
 */
export interface CommandSpec {
  /** Primary command name — must be a registered CommandName. */
  name: CommandName;
  /** Short description of what the command does. */
  description: string;
  /** Command category for documentation. */
  category: CommandCategory;
  /** Aliases — each must also be a registered CommandName. */
  aliases: CommandName[];
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
// Expression Syntax Tokens
//
// All token literals used in expression parsing and variable assignment.
// Any future syntax additions must be declared here first.
// ============================================================================

/** Block open delimiter (begins a REPEAT body or other block). */
export const BLOCK_OPEN: CommandName = '[';
/** Block close delimiter (ends a block). */
export const BLOCK_CLOSE: CommandName = ']';

/** Variable / property assignment operator. */
export const ASSIGN_TOKEN = '=' as const;

/** Arithmetic addition operator. */
export const OP_ADD = '+' as const;
/** Arithmetic subtraction / unary negation operator. */
export const OP_SUB = '-' as const;
/** Arithmetic multiplication operator. */
export const OP_MUL = '*' as const;
/** Arithmetic division operator. */
export const OP_DIV = '/' as const;

/** All arithmetic operator tokens, in canonical order. */
export const ARITH_OPERATORS = [OP_ADD, OP_SUB, OP_MUL, OP_DIV] as const;
export type ArithOperator = (typeof ARITH_OPERATORS)[number];

// ============================================================================
// SETBRUSHVALUE Parameter Keys
//
// The recognized key names for the SBV / SETBRUSHVALUE command.
// Add new brush parameters here before implementing them.
// ============================================================================

/** SBV key for the stroke width of the square brush. */
export const SBV_KEY_WIDTH = 'width' as const;
/** SBV key for the smooth-corners flag of the square brush. */
export const SBV_KEY_SMOOTH = 'smooth' as const;

export type SbvKey = typeof SBV_KEY_WIDTH | typeof SBV_KEY_SMOOTH;

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
  return BRUSH_NAMES.includes(value as (typeof BRUSH_NAMES)[number]);
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
 * Get command specification by name (case-insensitive).
 */
export function getCommandSpec(commandName: string): CommandSpec | undefined {
  const upper = commandName.toUpperCase();
  return COMMANDS.find(
    (cmd) => cmd.name === upper || cmd.aliases.includes(upper as CommandName),
  );
}

/**
 * Get all command names (primary + aliases) for validation.
 */
export function getAllCommandNames(): CommandName[] {
  const names: CommandName[] = [];
  COMMANDS.forEach((cmd) => {
    names.push(cmd.name);
    names.push(...cmd.aliases);
  });
  return names;
}

// ============================================================================
// Command Matching (Interpreter Use Only)
// ============================================================================

/**
 * Check if a normalized command token matches any of the supplied
 * canonical CommandName values.
 *
 * The `normalizedCommand` argument is a runtime string (user input).
 * Every entry in `names` MUST be a registered CommandName — TypeScript
 * will reject any string literal that is absent from COMMAND_NAMES,
 * preventing undeclared commands from being referenced here.
 *
 * This is the ONLY way the interpreter should perform command comparisons.
 * @example
 *   if (matchesCommand(command, 'FD', 'FORWARD')) { move(amount); }
 */
export function matchesCommand(
  normalizedCommand: string,
  ...names: CommandName[]
): boolean {
  return (names as string[]).includes(normalizedCommand);
}

/**
 * Block delimiter tokens.
 */
export function getBlockTokens(): CommandName[] {
  return [BLOCK_OPEN, BLOCK_CLOSE];
}

/**
 * Movement commands (require a numeric argument).
 */
export function getMovementCommands(): CommandName[] {
  return ['FD', 'FORWARD', 'BK', 'BACK', 'RT', 'RIGHT', 'LT', 'LEFT'];
}

/**
 * Pen state commands.
 */
export function getPenCommands(): CommandName[] {
  return ['PU', 'PENUP', 'PD', 'PENDOWN'];
}

/**
 * Turtle state commands (non-movement).
 */
export function getTurtleCommands(): CommandName[] {
  return ['HOME', 'CS', 'CLEARSCREEN'];
}

/**
 * Visual style / brush commands.
 */
export function getStyleCommands(): CommandName[] {
  return ['SETBRUSH', 'SB', 'SETBRUSHVALUE', 'SBV'];
}

/**
 * Control-flow commands.
 */
export function getControlCommands(): CommandName[] {
  return ['REPEAT'];
}

/**
 * Procedure-definition commands.
 */
export function getProcedureCommands(): CommandName[] {
  return ['TO', 'END'];
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
