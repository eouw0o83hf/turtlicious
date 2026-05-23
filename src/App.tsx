import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';

import { DEFAULT_CODE, createSvgMarkup, interpretLogo } from './logo';

const GLOW = '0 0 8px rgba(51, 255, 51, 0.75)';

function App() {
  const [code, setCode] = useState(DEFAULT_CODE);
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const result = useMemo(() => interpretLogo(code), [code]);
  const svgMarkup = useMemo(() => createSvgMarkup(result), [result]);

  const handleDownloadSvg = useCallback(() => {
    const blob = new Blob([svgMarkup], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'turtlicious-turtle-sketch.svg';
    link.click();
    URL.revokeObjectURL(url);
  }, [svgMarkup]);

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

  const lineCount = code.split('\n').length;
  const status =
    result.errors.length > 0
      ? `${result.errors.length} TURTLE ERROR${result.errors.length === 1 ? '' : 'S'}`
      : 'LIVE OUTPUT OK';

  return (
    <div className="app-shell">
      <div className="scanlines" />

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
          <span className="shortcut">LIVE TURTLE RENDER</span>
          <button className="run-btn" onClick={handleDownloadSvg} type="button">
            ⇩ SVG
          </button>
        </div>
      </header>

      <main className="workspace" aria-label="Turtle workspace">
        <section className="editor-pane" aria-label="Turtle editor">
          <div ref={lineNumbersRef} className="line-numbers" aria-hidden="true">
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
        </section>

        <section className="output-pane" aria-label="Turtle sketch output">
          <div
            className="sketch-frame"
            dangerouslySetInnerHTML={{ __html: svgMarkup }}
          />
          {result.errors.length > 0 && (
            <ol className="turtle-errors" aria-label="Turtle errors">
              {result.errors.slice(0, 4).map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ol>
          )}
        </section>
      </main>

      <footer className="status-bar">
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
        <span>{result.segments.length} TRAILS</span>
        <span>{result.stepCount} STEPS</span>
      </footer>
    </div>
  );
}

export default App;
