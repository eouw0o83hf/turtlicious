import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent,
} from 'react';

import {
  DEFAULT_BRUSH_CONFIG,
  DEFAULT_CODE,
  createSvgMarkup,
  renderLogoStack,
  type BrushConfig,
  type BrushName,
} from './renderer';
import { LanguageReferencePanel } from './LanguageReferencePanel';
import './styles/language-reference.css';

const GLOW = '0 0 8px rgba(51, 255, 51, 0.75)';
const DEFAULT_LEFT_PANE_WIDTH = 34;
const MIN_LEFT_PANE_WIDTH = 24;
const MAX_LEFT_PANE_WIDTH = 70;
const MIN_ZOOM = 0.35;
const MAX_ZOOM = 5;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function App() {
  const [code, setCode] = useState(DEFAULT_CODE);
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });
  const [isFocused, setIsFocused] = useState(false);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isReferenceOpen, setIsReferenceOpen] = useState(false);
  const [leftPaneWidth, setLeftPaneWidth] = useState(DEFAULT_LEFT_PANE_WIDTH);
  const [sketchView, setSketchView] = useState({ x: 0, y: 0, scale: 1 });
  const [isPanning, setIsPanning] = useState(false);
  const [brushName, setBrushName] = useState<BrushName>('default');
  const [brushConfig, setBrushConfig] =
    useState<BrushConfig>(DEFAULT_BRUSH_CONFIG);
  const workspaceRef = useRef<HTMLElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const panStartRef = useRef({ pointerX: 0, pointerY: 0, viewX: 0, viewY: 0 });
  const renderState = useMemo(
    () => renderLogoStack(code, brushName, brushConfig),
    [code, brushName, brushConfig],
  );
  const result = renderState.value;
  const errors = renderState.errors;
  const svgMarkup = useMemo(() => createSvgMarkup(result), [result]);

  const handleDownloadSvg = useCallback(() => {
    const exportMarkup = createSvgMarkup(result, {
      includeTurtle: false,
      includeBackground: false,
      strokeColorOverride: '#000000',
    });
    const blob = new Blob([exportMarkup], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'turtlicious-turtle-sketch.svg';
    link.click();
    URL.revokeObjectURL(url);
  }, [result]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === 'Tab') {
        event.preventDefault();
        const textarea = textareaRef.current;
        if (!textarea) return;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const nextCode = `${code.substring(0, start)}  ${code.substring(end)}`;
        setCode(nextCode);
        requestAnimationFrame(() => {
          textarea.selectionStart = textarea.selectionEnd = start + 2;
        });
      }
    },
    [code],
  );

  const updateCursorPos = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const beforeCursor = textarea.value.substring(0, textarea.selectionStart);
    const lines = beforeCursor.split('\n');
    setCursorPos({
      line: lines.length,
      col: lines[lines.length - 1].length + 1,
    });
  }, []);

  const syncScroll = useCallback(() => {
    const textarea = textareaRef.current;
    const lineNumbers = lineNumbersRef.current;
    if (textarea && lineNumbers) lineNumbers.scrollTop = textarea.scrollTop;
  }, []);

  const handlePaneResizeStart = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      const workspace = workspaceRef.current;
      if (!workspace) return;

      const resize = (pointerEvent: PointerEvent) => {
        const rect = workspace.getBoundingClientRect();
        const nextWidth =
          ((pointerEvent.clientX - rect.left) / rect.width) * 100;
        setLeftPaneWidth(
          clamp(nextWidth, MIN_LEFT_PANE_WIDTH, MAX_LEFT_PANE_WIDTH),
        );
      };

      const stopResize = () => {
        window.removeEventListener('pointermove', resize);
        window.removeEventListener('pointerup', stopResize);
      };

      window.addEventListener('pointermove', resize);
      window.addEventListener('pointerup', stopResize);
    },
    [],
  );

  const handleSketchPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      setIsPanning(true);
      panStartRef.current = {
        pointerX: event.clientX,
        pointerY: event.clientY,
        viewX: sketchView.x,
        viewY: sketchView.y,
      };
    },
    [sketchView.x, sketchView.y],
  );

  const handleSketchPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!isPanning) return;
      const start = panStartRef.current;
      setSketchView((currentView) => ({
        ...currentView,
        x: start.viewX + event.clientX - start.pointerX,
        y: start.viewY + event.clientY - start.pointerY,
      }));
    },
    [isPanning],
  );

  const handleSketchPointerUp = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      setIsPanning(false);
    },
    [],
  );

  const handleSketchWheel = useCallback((event: WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const zoomFactor = event.deltaY < 0 ? 1.12 : 0.88;
    setSketchView((currentView) => ({
      ...currentView,
      scale: clamp(currentView.scale * zoomFactor, MIN_ZOOM, MAX_ZOOM),
    }));
  }, []);

  const lineCount = code.split('\n').length;
  const status =
    errors.length > 0
      ? `${errors.length} TURTLE ERROR${errors.length === 1 ? '' : 'S'}`
      : 'LIVE OUTPUT OK';

  const handleConfigClose = useCallback(() => {
    setIsConfigOpen(false);
  }, []);

  return (
    <div className="app-shell">
      <div className="scanlines" />

      {isConfigOpen && (
        <div
          className="config-modal-backdrop"
          onClick={handleConfigClose}
          role="presentation"
        >
          <section
            className="config-modal"
            aria-label="Configuration"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
          >
            <div className="config-modal-header">
              <span className="config-modal-title">CONFIGURATION</span>
              <button
                aria-label="Close configuration"
                className="icon-btn modal-close-btn"
                onClick={handleConfigClose}
                type="button"
              >
                X
              </button>
            </div>
            <div className="config-modal-body">
              <label className="config-field" htmlFor="brush-select">
                <span className="config-field-label">Brush</span>
                <select
                  id="brush-select"
                  className="brush-select"
                  value={brushName}
                  onChange={(e) => setBrushName(e.target.value as BrushName)}
                  aria-label="Select brush"
                >
                  <option value="default">⬛ DEFAULT</option>
                  <option value="rainbow">🌈 RAINBOW</option>
                  <option value="square">◻ SQUARE</option>
                </select>
              </label>

              {brushName === 'square' && (
                <>
                  <label className="config-field" htmlFor="square-width">
                    <span className="config-field-label">Width</span>
                    <input
                      id="square-width"
                      className="brush-number-input"
                      type="number"
                      min="0.25"
                      max="64"
                      step="0.25"
                      value={brushConfig.square.width}
                      onChange={(event) => {
                        const next = Number(event.target.value);
                        setBrushConfig((currentConfig) => ({
                          ...currentConfig,
                          square: {
                            ...currentConfig.square,
                            width: Number.isFinite(next)
                              ? next
                              : DEFAULT_BRUSH_CONFIG.square.width,
                          },
                        }));
                      }}
                      aria-label="Square brush width"
                    />
                  </label>

                  <label className="config-toggle" htmlFor="square-smooth">
                    <input
                      id="square-smooth"
                      type="checkbox"
                      checked={brushConfig.square.smooth}
                      onChange={(event) => {
                        const nextSmooth = event.target.checked;
                        setBrushConfig((currentConfig) => ({
                          ...currentConfig,
                          square: {
                            ...currentConfig.square,
                            smooth: nextSmooth,
                          },
                        }));
                      }}
                      aria-label="Square brush smooth corners"
                    />
                    <span>Smooth corners</span>
                  </label>
                </>
              )}
            </div>
          </section>
        </div>
      )}

      <header className="top-bar">
        <div className="brand-mark">
          <img
            src="/assets/turtlicious-logo.svg"
            alt="Turtlicious"
            className="brand-logo"
          />
          <span style={{ textShadow: GLOW }}>▓▓ TURTLICIO.US ▓▓</span>
        </div>

        <div className="toolbar">
          <button
            aria-label="Open configuration"
            className="icon-btn gear-btn"
            onClick={() => setIsConfigOpen(true)}
            type="button"
          >
            <img
              alt=""
              aria-hidden="true"
              className="gear-icon"
              src="/assets/turtlicious-gear.svg"
            />
          </button>
          <button
            aria-label="Show language reference"
            className="icon-btn help-btn"
            onClick={() => setIsReferenceOpen(true)}
            type="button"
            title="Logo language reference"
          >
            ?
          </button>
          <button className="run-btn" onClick={handleDownloadSvg} type="button">
            ⇩ SVG
          </button>
        </div>
      </header>

      <main
        ref={workspaceRef}
        className="workspace"
        aria-label="Turtle workspace"
      >
        <section
          className="editor-pane"
          style={{ flexBasis: `${leftPaneWidth}%` }}
          aria-label="Turtle editor"
        >
          <div className="editor-body">
            <div
              ref={lineNumbersRef}
              className="line-numbers"
              aria-hidden="true"
            >
              {Array.from({ length: lineCount }, (_, index) => (
                <div key={index}>{index + 1}</div>
              ))}
            </div>

            <textarea
              ref={textareaRef}
              className="crt-textarea"
              value={code}
              onChange={(event) => {
                setCode(event.target.value);
                updateCursorPos();
              }}
              onKeyDown={handleKeyDown}
              onSelect={updateCursorPos}
              onClick={updateCursorPos}
              onKeyUp={updateCursorPos}
              onScroll={syncScroll}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              spellCheck={false}
              autoCorrect="off"
              autoCapitalize="off"
              aria-label="Editable turtle source"
            />
          </div>
          {errors.length > 0 && (
            <ol className="turtle-errors" aria-label="Turtle errors">
              {errors.slice(0, 4).map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ol>
          )}
        </section>

        <div
          className="pane-divider"
          role="separator"
          aria-label="Resize panes"
          aria-orientation="vertical"
          aria-valuemin={MIN_LEFT_PANE_WIDTH}
          aria-valuemax={MAX_LEFT_PANE_WIDTH}
          aria-valuenow={Math.round(leftPaneWidth)}
          onPointerDown={handlePaneResizeStart}
        />

        <section
          className="output-pane"
          style={{ flexBasis: `${100 - leftPaneWidth}%` }}
          aria-label="Turtle sketch output"
        >
          <div
            className={`sketch-frame${isPanning ? ' is-panning' : ''}`}
            aria-label="Pan and zoom turtle sketch"
            onPointerDown={handleSketchPointerDown}
            onPointerMove={handleSketchPointerMove}
            onPointerUp={handleSketchPointerUp}
            onPointerCancel={handleSketchPointerUp}
            onWheel={handleSketchWheel}
          >
            <div
              className="sketch-canvas"
              style={{
                transform: `translate(${sketchView.x}px, ${sketchView.y}px) scale(${sketchView.scale})`,
              }}
              dangerouslySetInnerHTML={{ __html: svgMarkup }}
            />
          </div>
        </section>
      </main>

      <footer className="status-bar" aria-label="Status bar">
        <span className="status-primary" style={{ textShadow: GLOW }}>
          <span
            className="block-cursor"
            style={{ opacity: isFocused ? 1 : 0.3 }}
          />
          {status}
        </span>
        <span>
          LN {cursorPos.line} &nbsp;COL {cursorPos.col}
        </span>
        <span className="status-spacer">TURTLE</span>
        <span>{Math.round(sketchView.scale * 100)}% ZOOM</span>
        <span>{result.segments.length} TRAILS</span>
        <span>{result.stepCount} STEPS</span>
      </footer>

      <LanguageReferencePanel
        isOpen={isReferenceOpen}
        onClose={() => setIsReferenceOpen(false)}
      />
    </div>
  );
}

export default App;
