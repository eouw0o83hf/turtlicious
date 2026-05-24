// ---------------------------------------------------------------------------
// Public API for the renderer package.
// Consumers import from here; internal modules cross-import as needed.
// ---------------------------------------------------------------------------

export type { LogoResult, LogoStyle, Segment, Turtle, Point } from './types';
export { RenderMonad, type RenderingStackMember } from './monad';
export {
  DEFAULT_CODE,
  interpretLogo,
  logoInterpreterLayer,
} from './interpreter';
export { createSvgMarkup } from './svg';
export { brushLayer, type BrushName } from './layers';

import { RenderMonad } from './monad';
import { logoInterpreterLayer } from './interpreter';
import { brushLayer, type BrushName } from './layers';

export function renderLogoStack(source: string, brush: BrushName = 'default') {
  return RenderMonad.of(source)
    .chain(logoInterpreterLayer)
    .chain(brushLayer(brush));
}
