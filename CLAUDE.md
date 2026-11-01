# league-s

An app for amateur football leagues (five, urban football). Each league is run by its own organizers and is fully separate from the others.

Three parts in one repository:

| Folder | What | Stack |
|---|---|---|
| `/` (`cmd/`, `internal/`, `migrations/`) | JSON API under `/api/v1` | Go, chi, pgx, sqlc, goose, Postgres 18 |
| `admin/` | Back-office for league admins, served by the Go binary under `/admin` (`go:embed`) | Vite, React 19, TypeScript, Tailwind, TanStack Query, Vitest, MSW |
| `mobile/` | Supporter app (iOS first) | Expo, React Native, Expo Router, NativeWind, Zustand, jest-expo |

Each part has its own `package.json` or `go.mod`. There is no npm workspace: run npm commands with `--prefix admin` or `--prefix mobile`.

## Read first

- `docs/plans/2026-10-30-finish-project.md`: the plan. The list of PRs and their order.
- `docs/agents/pr-workflow.md`: how a PR is written, reviewed and merged.
- `docs/agents/testing.md`: which tests each change needs.
- `docs/agents/review-rules.md`: what the reviewer checks. Read it before opening a PR.
- `docs/agents/code-style.md`: language idioms and design principles.
- Specs (the source of truth; still in French until PR-27 translates them):
  - API: `docs/api/spec.md` (business rules), `docs/api/endpoints.md` (routes), `docs/api/decision.md` (technical decisions), `docs/api/checklist.md` (tasks)
  - Admin: `docs/admin/2026-10-10-admin-webapp-design.md`
  - Mobile: `docs/mobile/2026-09-10-ligue-amateur-v5-design.md`. Commit `233f68a` of the mobile app later removed odds, events, MVP and positions, because the API has no data for them.

The `plan/` folder at the root is the old, git-ignored copy of `docs/api/`. Don't use it.

## Commands

| Part | Check | Command |
|---|---|---|
| Go | lint | `make lint` |
| Go | unit tests | `make test` |
| Go | integration tests (testcontainers, Docker must be running) | `make itest` |
| Go | vulnerabilities | `make vuln` |
| Go | SQL changed | `sqlc generate`, then commit `internal/db/` |
| Go | new migration | `migrations/000NN_<name>.sql` (goose), next free number |
| Admin | tests | `npm --prefix admin test -- --run` |
| Admin | types and build | `npm --prefix admin run build` |
| Admin, Mobile | `docs/openapi.yaml` changed | `npm --prefix admin run api-types` and `npm --prefix mobile run api-types`, then commit the generated files |
| Mobile | tests | `npm --prefix mobile test` |
| Mobile | types | `cd mobile && npx tsc --noEmit` |
| Mobile | simulator and Maestro (`maestro test mobile/e2e/`) | skill `simulator-check` |

Local API: `docker compose up -d`, `make migrate-up`, then `make run` (port 8080). Copy `.env.example` to `.env` first.

## Rules for code

- **Everything in English, except what users read.**
  - English: identifiers (variables, functions, types, packages, files, routes, i18n keys), test names, commits, PR and issue texts, log messages, SQL names, docs and specs.
  - French: only text shown to users. UI copy, API error messages displayed in the admin, mobile strings (the values in `mobile/src/i18n/fr.ts`).
- **No code comments**, unless the user approves them.
- Style, idioms and design principles: `docs/agents/code-style.md`.
- Leagues never mix: every query filters on the `leagueID` of the URL. A resource of another league is a 404.
- The API is snake_case JSON, UUID v7 IDs, date-times in UTC (RFC 3339), dates as `YYYY-MM-DD`.
- Errors: `{"error": "..."}`, and for field validation `{"errors": {"<field>": "<rule>"}}` with a 422.
- Domain rules live in the entity or the service (`internal/app/<domain>`), not in the handler. Store errors are translated by constraint name.
- Follow the existing structure of each package before adding a new pattern.
- Change the spec docs in the same PR as the code: a rule that becomes enforced goes from ⚠️ to ✅ in `docs/api/spec.md`, a new route goes into `docs/api/endpoints.md`, a finished task gets ticked in `docs/api/checklist.md`.

## Rules for git

- Never commit to `main`. One branch per PR: `<type>/SOC-<issue>-<slug>`, e.g. `feat/SOC-32-season-overlap`.
- **PR title**: `<type>: [SOC-<issue>] <Summary>`, e.g. `feat: [SOC-32] Refuse overlapping seasons`. `<issue>` is the GitHub issue number the PR closes. The squash merge uses this title as the commit on `main`.
- Types: `feat` (new behaviour), `fix` (bug), `refactor` (same behaviour), `test` (tests only), `docs`, `ci` (workflows), `config` (env, app or tool configuration), `chore` (dependencies, housekeeping), `perf`.
- Commits inside a PR: conventional titles (`feat(match): ...`). They disappear in the squash merge.
- Open PRs as **drafts**. Mark one ready (`gh pr ready`) only when every local check passes. The reviewer runs only on ready PRs.
- Never force-push a branch that is under review. Push new commits, so the reviewer can see what changed. One exception: restacking a stacked PR after its parent is merged (`docs/agents/pr-workflow.md` › Stacked PRs), with `git push --force-with-lease` only.
- Never merge by hand and never bypass branch protection. Turn on auto-merge (`gh pr merge --auto --squash`) on a PR whose base is `main`. GitHub then merges it once it is approved and green. Never turn it on for a PR stacked on another branch.
- **Mark what you write on GitHub.** Agents post with the owner's account, so every comment, thread reply, review body and issue body an agent writes starts with `🤖 ` (e.g. `gh issue comment <N> --body "🤖 Starting this."`). An unmarked comment from `kejlerj` is the owner speaking. One exception: a bot command such as `@dependabot rebase` must stay the first thing in the comment, so it gets no marker.
- Don't run destructive commands on the local database (`migrate-reset`, `docker compose down -v`) without asking.

## Decisions that need the user

Never decide these alone. Open an issue labelled `needs-decision` (template: options, trade-offs, your recommendation), and move on to other work:
- a new library, framework, tool, external service or language, in any part (`go.mod`, `package.json`, CI actions, hosting). Libraries already named in the plan or the specs (Playwright, Maestro, testcontainers, an OpenAPI generator) are already approved, but the choice of a specific package among several still needs a decision,
- a product question the specs don't answer,
- a change to a business rule written in the specs.

## Models

- Implementation (author sessions): Opus 5.5.
- Review (GitHub Actions): Sonnet 5.5.
- No limit on PRs running at the same time. Hitting the Pro plan's usage limit is fine: sessions resume when it resets.

## Simulator checks

A mobile change the user can see is checked on the iOS Simulator with its Maestro flow (skill `simulator-check`), on top of jest screen tests. See `docs/agents/testing.md` › Simulator.
