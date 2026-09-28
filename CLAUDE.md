# Project

OrderFlow API — an order management API.

# Tech stack

- Plain JavaScript (no TypeScript, no build step)
- Express 4
- PostgreSQL
- Node >=18 required

# Commands

- `npm test` — run the full Jest suite (`jest --verbose`)
- `npm test -- <path>` — run a single test file, e.g. `npm test -- tests/pricing/discountCalculator.test.js`
- `npm run test:watch` — watch mode
- `npm run lint` — ESLint over `src/` only (tests/migrations are not linted)
- `npm run migrate` — apply SQL migrations in `migrations/` via `migrations/run.js`
- `npm run seed` — seed the dev database
- `npm run dev` — start with nodemon; `npm start` for a plain run

There is no `build` or `type-check` script — this is intentional, do not invent one.

# Architecture

- **Layering**: `routes/` (HTTP concerns only) → `services/` (business logic, orchestration,
  transactions) → `models/` (all SQL, one file per table). Routes must not import `config/database`
  directly or write ad-hoc SQL; that belongs in a model. `handlers/` holds a couple of
  standalone route modules that predate the services split (`payment.js`, `orderHistory.js`) —
  follow the routes→services→models layering for anything new rather than extending `handlers/`.
- **Pricing** (`src/pricing/discountCalculator.js`) and **tax** (`src/utils/taxCalculator.js`) are
  pure calculation modules with no DB access — keep them that way so they stay unit-testable
  without mocks.
- **Auth** (`src/middleware/auth.js`) does a DB lookup on every authenticated request (to catch
  deactivated users/role changes) and holds an in-memory role→permission matrix
  (`ROLE_PERMISSIONS`). Use `authenticate('resource:action')` on routes that need a specific
  permission, `authenticate()` for "just needs a valid token", `optionalAuth()` for routes that
  behave differently for logged-in vs anonymous callers.
- **Logging** goes through `src/utils/logger.js` (winston) — never `console.log` in `src/`.
  (`src/index.js`'s startup banner and `src/config/database.js`'s pool/slow-query logging are
  known, pre-existing exceptions — do not copy that pattern into new code.)

# Code style

- 2-space indentation, double quotes, semicolons — match the existing files exactly (no Prettier
  config is checked in; ESLint is the source of truth).
- Use `async/await`, not `.then()` chains.
- Every DB-backed model function takes/returns plain objects or raw `pg` rows — no ORM, no query
  builder. (`Cart` is the exception: an in-memory, non-persisted class with no DB access.)
- All SQL parameters go through `pg`'s parameterized placeholders (`$1`, `$2`, ...). Never
  interpolate request data into a query string.

# Git / commit conventions

- Commit messages follow Conventional Commits: `type(scope): summary`, e.g.
  `fix(auth): reject expired tokens before DB lookup`. Common types: `feat`, `fix`, `refactor`,
  `test`, `docs`, `chore`. Scope is the top-level module touched (`auth`, `orders`, `pricing`, etc.).
- Keep commits scoped to one logical change; don't bundle unrelated files.

# IMPORTANT

- **IMPORTANT:** Never write SQL by concatenating/templating user input into the query string —
  always use parameterized `pg` queries. (`src/routes/search.js` currently does this via
  `LIKE '%${query}%'` — this is a known, pre-existing vulnerability; do not copy that pattern into
  new code, and flag it rather than replicate it.)
- **IMPORTANT:** Never read or print the contents of `.env` / `.env.example` or any other secret
  material — the deny rule in `.claude/settings.json` should block this, but do not attempt to
  work around it.
- **YOU MUST** run migrations forward-only: never edit a migration file that has already been
  applied (i.e. any file below the highest-numbered file already in `migrations/`) — add a new
  numbered migration instead. See `.claude/rules/migrations.md`.