const repoSections = [
  'React application',
  'Native runtime',
  'Deployment glue',
] as const;

function App() {
  return (
    <main className="app-shell">
      <section className="hero" aria-labelledby="hero-title">
        <p className="eyebrow">turtlicio.us</p>
        <h1 id="hero-title">Turtlicious</h1>
        <p className="hero-copy">
          A standalone React app repository for development, native runtime, and
          future cloud deployment automation.
        </p>
        <ul className="repo-sections" aria-label="Repository capabilities">
          {repoSections.map((section) => (
            <li key={section}>{section}</li>
          ))}
        </ul>
      </section>
    </main>
  );
}

export default App;
