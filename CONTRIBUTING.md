# Contributing

Thanks for taking a look. This is a local-first, self-hosted app maintained in spare
time, so the process is deliberately light. The one hard requirement is that
`npm run check` passes — it is the same Ubuntu core gate CI runs on every push／PR.

## Prerequisites

- **Python** >= 3.11, managed with [uv](https://docs.astral.sh/uv/)
- **Node.js** 20.19.0 (see `.nvmrc`; engines baseline is `>=20.19.0`) + npm
- Optional: [Ollama](https://ollama.com) for local LLM analysis

On Windows, empty 0-byte `node` / `npm` stubs in `C:\Windows\System32\` can shadow the real
install and make every command fail — the [README](README.md) has a section on fixing that
under 環境需求.

## Setup

```bash
uv sync --extra dev --locked
npm ci
```

Then pick a dev mode:

| Command | What runs |
|---------|-----------|
| `npm run dev` | Python server + Vite HMR + Electron shell |
| `npm run dev:web` | Server + Vite only (no Electron window) |
| `npm run dev:server` | Python server only (port 18820) |

To start from an empty database, stop dev and run
`python scripts/reset_local_databases.py --apply`.

## The gate: `npm run check`

Run it before opening a PR. It executes these steps in order and stops at the first
failure:

1. **`npm run lint`** — `ruff check` + `ruff format --check` on `server/` and `scripts/`,
   then ESLint on `web/src/`
2. **`npm run sync:presets:check`** — task preset artifacts must match `shared/task_presets.json`
3. **`npm run i18n:check`** — locale key parity across `zh-Hant` / `zh-Hans` / `en`
4. **`npm run openapi:check`** — committed OpenAPI schema and generated TS types must match
   a fresh export from the live FastAPI app
5. **`npm run typecheck`** — `tsc` for web, desktop, root tests, and desktop tests, plus
   Pyright (basic) over `server/` and `scripts/`
6. **`npm run test:all`** — pytest (`server/tests/`), web vitest, desktop vitest, and root
   vitest, in parallel

Individual suites are also available: `npm test` (root smoke/audit), `npm run test:server`,
`npm run test:web`, `npm run test:desktop`.

The short post-deploy smoke (`npm run verify:deploy`) is **not** part of the gate — it needs
a running server on `127.0.0.1:18820` and, on a database that already has an admin, a bearer
token in `VERIFY_BEARER` or `IM_ACCESS_TOKEN`. Everyday push／PR CI always runs **`quality`**
(Ubuntu). When Desktop／web paths change (or on `v*` tag／`workflow_dispatch`), the **`desktop`**
matrix also runs the same lightweight checks on Windows／macOS／Linux (`verify:desktop:fast` +
native sidecar build／startup smoke); unrelated paths skip the whole matrix.

**Release packaging** (`package` matrix on all three OS): `dist:win`／`dist:mac`／`dist:linux` +
`verify:desktop:full` + `package:cli` (CLI zip = PyInstaller onedir for the same entry as
`python -m server`／`intelligence-monitor`). Runs on **`v*` tag** or manual
**`workflow_dispatch`** only — same trigger for every OS. Pushing a `v*` tag (name without `v`
must equal root `VERSION`) creates a **GitHub Release** with **Desktop + CLI** attachments for
Windows／macOS／Linux; incomplete asset sets fail the `release` job. `workflow_dispatch` builds
artifacts but does **not** create a Release. GHCR publish also runs on tag／dispatch.

Release steps: bump root `VERSION` → `npm run sync:version` → commit／push →
`git tag vX.Y.Z` → `git push origin vX.Y.Z` → wait for Actions.

## Generated files are committed — regenerate, never hand-edit

These artifacts are tracked on purpose so the drift checks above have something to compare
against:

| Artifact | Source | Regenerate with |
|----------|--------|-----------------|
| `server/api/routes/task_preset_data.py`, `tasks.presets.*` in the three `common.json` locales | `shared/task_presets.json` | `npm run sync:presets` |
| `web/openapi/openapi.json`, `web/src/api/generated/schema.d.ts` | FastAPI route definitions | `npm run openapi:generate` |
| `web/src/theme.generated.css` | theme catalog under `web/src/styles/` | `npm run gen:themes` |
| `web/src/css/theme-textures.css` | texture generator | `npm run gen:textures` |
| `version` in the three `package.json` files and `pyproject.toml` | root `VERSION` | `npm run sync:version` |

## i18n

`zh-Hant` is the source of truth. Add a key there first, then mirror it into `zh-Hans` and
`en` — leaf keys must be identical in all three namespaces. Terminology and `error_code`
vocabulary live in [`docs/I18N-GLOSSARY.md`](docs/I18N-GLOSSARY.md); retired keys that must
never come back are listed in `scripts/check-i18n-parity.mjs`.

## Where tests go

The layout is enforced by `tests/smoke/test-layout.test.ts`:

- `server/tests/` — the only home for `test_*.py` / `*_test.py`
- `web/src/**` — web unit, component, and property tests, colocated with the code
- `desktop/tests/` — Electron shell tests
- `tests/` — cross-repo smoke and audit tests; a new file here must also be matched by an
  `include` glob in `vitest.config.ts`, and every glob must match at least one real file

## Code style

- **Python** — ruff, line length 120, target `py311`. Run
  `uv run --extra dev ruff format server/ scripts/` before committing.
- **TypeScript / React** — ESLint. New or modified UI under `web/src/pages/` should use
  `spacing`, `borderRadius`, `typography`, and `layoutWidth` from `web/src/styles/tokens.ts`
  instead of hardcoded `padding` / `gap` / `fontSize` values. The baseline is guarded by
  `web/src/styles/tokenCompliance.test.ts`; tighten `VIOLATION_BASELINES` after migrating a file.
- **Dependencies** — runtime deps are pinned exactly (`web/package.json` exact semver,
  `pyproject.toml` `==`), enforced by `tests/smoke/dependency-pinning.test.ts`. Ranges are
  fine for devDependencies.

## Docs

README is the overview; [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) is the source of
truth for architecture, schema policy, API contract, and auth. Do not add `docs/api/`,
`docs/schema/`, or `docs/frontend/` trees — those topics stay as sections inside
ARCHITECTURE. Note user-visible changes in `CHANGELOG.md`.

## Pull requests

There are no issue or PR templates and no separate code of conduct. Just describe what
changed and why, and say which parts of the gate you ran (and on which OS) if you could not
run all of it. Contributions are accepted under the project's [MIT license](LICENSE);
security issues should go through [`SECURITY.md`](SECURITY.md) instead of a public issue.
