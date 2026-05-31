// ---------------------------------------------------------------------------
// Logo Language Reference / Man Page
//
// Displays comprehensive documentation of all available Logo commands.
// Automatically generated from canonical language definitions in language.ts.
// ---------------------------------------------------------------------------

import { COMMANDS, type CommandCategory, type CommandSpec } from './renderer';

const CATEGORY_DESCRIPTIONS: Record<CommandCategory, string> = {
  movement: 'Movement - Control turtle position',
  pen: 'Pen - Control drawing pen',
  turtle: 'Turtle - Control turtle state and heading',
  style: 'Style - Apply visual styles and brush effects',
  control: 'Control Flow - Repeat and conditionals',
  procedure: 'Procedures - Define and call functions',
};

const CATEGORY_ORDER: CommandCategory[] = [
  'movement',
  'pen',
  'turtle',
  'style',
  'control',
  'procedure',
];

interface CommandDocProps {
  command: CommandSpec;
}

/**
 * Single command documentation card.
 */
function CommandDoc({ command }: CommandDocProps) {
  const aliases =
    command.aliases.length > 0 ? ` (${command.aliases.join(', ')})` : '';

  return (
    <div className="command-doc">
      <div className="command-header">
        <h3 className="command-name">
          {command.name}
          {aliases && <span className="command-aliases">{aliases}</span>}
        </h3>
      </div>

      <p className="command-description">{command.description}</p>

      {command.parameters.length > 0 && (
        <div className="command-parameters">
          <h4>Parameters:</h4>
          <ul>
            {command.parameters.map((param, idx: number) => (
              <li key={idx}>
                <span className="param-name">{param.name}</span>
                <span className="param-type">({param.type})</span>
                {' — '}
                <span className="param-desc">{param.description}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="command-example">
        <h4>Example:</h4>
        <code>{command.example}</code>
      </div>
    </div>
  );
}

interface LanguageReferencePanelProps {
  /**
   * Whether the reference panel is visible.
   */
  isOpen: boolean;
  /**
   * Callback when the user closes the panel.
   */
  onClose: () => void;
}

/**
 * Complete Logo language reference panel.
 * Shows all commands organized by category, with descriptions and examples.
 */
export function LanguageReferencePanel({
  isOpen,
  onClose,
}: LanguageReferencePanelProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="language-reference-overlay" onClick={onClose}>
      <div
        className="language-reference-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="reference-header">
          <h2>Logo Language Reference</h2>
          <button className="close-button" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="reference-content">
          {CATEGORY_ORDER.map((category) => {
            const commandsInCategory = COMMANDS.filter(
              (cmd: CommandSpec) => cmd.category === category,
            );

            return (
              <section
                key={category}
                className={`category-section category-${category}`}
              >
                <h3 className="category-title">
                  {CATEGORY_DESCRIPTIONS[category]}
                </h3>

                <div className="commands-grid">
                  {commandsInCategory.map((command: CommandSpec) => (
                    <CommandDoc key={command.name} command={command} />
                  ))}
                </div>
              </section>
            );
          })}

          <section className="language-info">
            <h3>Language Features</h3>
            <div className="info-content">
              <h4>Comments</h4>
              <p>
                Comments start with <code>;</code>, <code>#</code>, or{' '}
                <code>//</code> and extend to the end of the line:
              </p>
              <pre>{`FD 100 ; Move forward 100 units
RT 90 # Turn right
LT 45 // Turn left`}</pre>

              <h4>Variables</h4>
              <p>
                Define variables with the <code>$</code> prefix and use them
                with arithmetic:
              </p>
              <pre>{`$distance = 50
FD $distance + 25
$angle = 45
RT $angle * 2`}</pre>

              <h4>Procedures</h4>
              <p>Define reusable procedures with TO/END blocks:</p>
              <pre>{`TO SQUARE
  REPEAT 4 [
    FD 100
    RT 90
  ]
END

SQUARE`}</pre>

              <h4>Arithmetic</h4>
              <p>Numeric expressions support +, -, *, / operators:</p>
              <pre>{`FD 100 + 50
RT 360 / 8
$x = 2 * $y - 10`}</pre>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
