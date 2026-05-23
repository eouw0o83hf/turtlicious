import { useCallback, useRef, useState, type KeyboardEvent } from 'react';

const DEFAULT_CODE = `<html>
<head>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: #000;
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
      overflow: hidden;
      font-family: monospace;
    }
    .scene {
      position: relative;
      width: 320px;
      height: 320px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .rays {
      position: absolute;
      inset: 0;
      border-radius: 50%;
      background: conic-gradient(
        from 0deg,
        transparent 0deg, rgba(255,200,0,0.12) 4deg,
        transparent 8deg, rgba(255,200,0,0.12) 12deg,
        transparent 16deg, rgba(255,200,0,0.12) 20deg,
        transparent 24deg, rgba(255,200,0,0.12) 28deg,
        transparent 32deg, rgba(255,200,0,0.12) 36deg,
        transparent 40deg, rgba(255,200,0,0.12) 44deg,
        transparent 48deg, rgba(255,200,0,0.12) 52deg,
        transparent 56deg, rgba(255,200,0,0.12) 60deg,
        transparent 64deg, rgba(255,200,0,0.12) 68deg,
        transparent 72deg, rgba(255,200,0,0.12) 76deg,
        transparent 80deg, rgba(255,200,0,0.12) 84deg,
        transparent 88deg, rgba(255,200,0,0.12) 92deg,
        transparent 96deg, rgba(255,200,0,0.12) 100deg,
        transparent 104deg, rgba(255,200,0,0.12) 108deg,
        transparent 112deg, rgba(255,200,0,0.12) 116deg,
        transparent 120deg, rgba(255,200,0,0.12) 124deg,
        transparent 128deg, rgba(255,200,0,0.12) 132deg,
        transparent 136deg, rgba(255,200,0,0.12) 140deg,
        transparent 144deg, rgba(255,200,0,0.12) 148deg,
        transparent 152deg, rgba(255,200,0,0.12) 156deg,
        transparent 160deg, rgba(255,200,0,0.12) 164deg,
        transparent 168deg, rgba(255,200,0,0.12) 172deg,
        transparent 176deg, rgba(255,200,0,0.12) 180deg,
        transparent 184deg, rgba(255,200,0,0.12) 188deg,
        transparent 192deg, rgba(255,200,0,0.12) 196deg,
        transparent 200deg, rgba(255,200,0,0.12) 204deg,
        transparent 208deg, rgba(255,200,0,0.12) 212deg,
        transparent 216deg, rgba(255,200,0,0.12) 220deg,
        transparent 224deg, rgba(255,200,0,0.12) 228deg,
        transparent 232deg, rgba(255,200,0,0.12) 236deg,
        transparent 240deg, rgba(255,200,0,0.12) 244deg,
        transparent 248deg, rgba(255,200,0,0.12) 252deg,
        transparent 256deg, rgba(255,200,0,0.12) 260deg,
        transparent 264deg, rgba(255,200,0,0.12) 268deg,
        transparent 272deg, rgba(255,200,0,0.12) 276deg,
        transparent 280deg, rgba(255,200,0,0.12) 284deg,
        transparent 288deg, rgba(255,200,0,0.12) 292deg,
        transparent 296deg, rgba(255,200,0,0.12) 300deg,
        transparent 304deg, rgba(255,200,0,0.12) 308deg,
        transparent 312deg, rgba(255,200,0,0.12) 316deg,
        transparent 320deg, rgba(255,200,0,0.12) 324deg,
        transparent 328deg, rgba(255,200,0,0.12) 332deg,
        transparent 336deg, rgba(255,200,0,0.12) 340deg,
        transparent 344deg, rgba(255,200,0,0.12) 348deg,
        transparent 352deg, rgba(255,200,0,0.12) 356deg,
        transparent 360deg
      );
      animation: spin 24s linear infinite;
    }
    .sun {
      width: 140px;
      height: 140px;
      border-radius: 50%;
      background: radial-gradient(circle at 38% 38%, #fff8cc 0%, #ffdd00 25%, #ff9900 55%, #ff4400 85%);
      box-shadow: 0 0 30px rgba(255, 200, 0, 0.9), 0 0 70px rgba(255, 120, 0, 0.6), 0 0 120px rgba(255, 60, 0, 0.3);
      animation: breathe 4s ease-in-out infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    @keyframes breathe {
      0%, 100% { transform: scale(1); box-shadow: 0 0 30px rgba(255,200,0,0.9), 0 0 70px rgba(255,120,0,0.6); }
      50% { transform: scale(1.07); box-shadow: 0 0 50px rgba(255,200,0,1), 0 0 100px rgba(255,120,0,0.9); }
    }
  </style>
</head>
<body>
  <div class="scene">
    <div class="rays"></div>
    <div class="sun"></div>
  </div>
</body>
</html>`;

const GLOW = '0 0 8px rgba(51, 255, 51, 0.75)';

function App() {
  const [code, setCode] = useState(DEFAULT_CODE);
  const [renderedCode, setRenderedCode] = useState(DEFAULT_CODE);
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });
  const [status, setStatus] = useState('OUTPUT OK');
  const [isRunning, setIsRunning] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);

  const handleRun = useCallback(() => {
    setIsRunning(true);
    setStatus('COMPILING...');
    setTimeout(() => {
      setRenderedCode(code);
      setStatus('OUTPUT OK');
      setIsRunning(false);
    }, 280);
  }, [code]);

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

      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        event.preventDefault();
        handleRun();
      }
    },
    [code, handleRun],
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

  return (
    <div className="app-shell">
      <div className="scanlines" />
      <div className="vignette" />

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
          <span className="shortcut">⌘+ENTER TO RUN</span>
          <button className="run-btn" onClick={handleRun} disabled={isRunning}>
            {isRunning ? 'RUNNING...' : '► RUN'}
          </button>
        </div>
      </header>

      <main className="workspace" aria-label="Code to image workspace">
        <section className="editor-pane" aria-label="HTML editor">
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
            aria-label="Editable HTML source"
          />
        </section>

        <section className="output-pane" aria-label="Rendered output">
          <iframe
            srcDoc={renderedCode}
            sandbox="allow-scripts"
            title="Output"
          />
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
        <span className="status-spacer">HTML/CSS/JS</span>
        <span>APPLE IIe COMPATIBLE</span>
        <span>UTF-8</span>
      </footer>
    </div>
  );
}

export default App;
