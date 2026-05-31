// ---------------------------------------------------------------------------
// Public API for the renderer package.
// Consumers import from here; internal modules cross-import as needed.
// ---------------------------------------------------------------------------

export type {
  BrushConfig,
  BrushName,
  BrushState,
  LogoResult,
  LogoStyle,
  Point,
  Segment,
  Turtle,
} from './types';
export { DEFAULT_BRUSH_CONFIG } from './types';
export { RenderMonad, type RenderingStackMember } from './monad';
export {
  DEFAULT_CODE,
  interpretLogo,
  logoInterpreterLayer,
  logoInterpreterLayerWithBrushState,
} from './interpreter';
export { createSvgMarkup } from './svg';
export { brushLayer } from './layers';
export {
  COMMANDS,
  COMMAND_NAMES,
  BRUSH_NAMES,
  COLOR_LOGO_GREEN,
  COMMENT_MARKERS,
  COMMENT_STRIP_PATTERN,
  DEFAULT_PROGRAM,
  DEFAULT_STYLE,
  LINE_BREAK,
  MAX_CALL_DEPTH,
  MAX_REPEAT_COUNT,
  MAX_STEPS,
  BOOLEAN_TRUE_VALUES,
  BOOLEAN_FALSE_VALUES,
  getCommandSpec,
  getAllCommandNames,
  isBrushName,
  matchesCommand,
  getMovementCommands,
  getPenCommands,
  getTurtleCommands,
  getStyleCommands,
  getControlCommands,
  getProcedureCommands,
  type CommandName,
  type CommandCategory,
  type CommandParameter,
  type CommandSpec,
} from './language';

import { RenderMonad } from './monad';
import { logoInterpreterLayerWithBrushState } from './interpreter';
import { brushLayer } from './layers';
import {
  DEFAULT_BRUSH_CONFIG,
  type BrushConfig,
  type BrushName,
} from './types';

export function renderLogoStack(
  source: string,
  brush: BrushName = 'default',
  brushConfig: BrushConfig = DEFAULT_BRUSH_CONFIG,
) {
  return RenderMonad.of(source)
    .chain(logoInterpreterLayerWithBrushState(brush, brushConfig))
    .chain(brushLayer(brush, brushConfig));
}
