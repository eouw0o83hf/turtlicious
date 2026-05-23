# turtlicious

Standalone React web app and deployment repository for <http://turtlicio.us>.

## Structure

- `src/` — React application source, styles, and tests.
- `public/` — static assets copied by Vite.
- `infra/` — future cloud infrastructure and deployment glue.
- `ops/` — future operational scripts and runbooks.
- `.github/workflows/` — CI build and test automation.
- `Makefile` — common development and verification commands.

## Commands

- `make install` — install dependencies from `package-lock.json`.
- `make run` — run the Vite dev server on <http://localhost:5173>.
- `make test` — run unit tests.
- `make build` — type-check and build production assets.
- `make check` — run lint, type-check, tests, and build.

Node.js 22+ is expected for local development.
