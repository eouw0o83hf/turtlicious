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
export * from './layers';

// ---------------------------------------------------------------------------
// Default rendering stack: interpreter → red path mutation.
// Compose a different stack by calling RenderMonad.of(source).chain(...)
// with any selection of layers from the layers/ directory.
// ---------------------------------------------------------------------------

import { RenderMonad } from './monad';
import { logoInterpreterLayer } from './interpreter';

export function renderLogoStack(source: string) {
  return RenderMonad.of(source).chain(logoInterpreterLayer);
}
