# league-s

An app for amateur football leagues (five, urban football). Each league is run by its own organizers and is fully separate from the others.

Three parts in one repository:

| Folder | What | Stack |
|---|---|---|
| `/` (`cmd/`, `internal/`, `migrations/`) | JSON API under `/api/v1` | Go, chi, pgx, sqlc, goose, Postgres 18 |
| `admin/` | Back-office for league admins, served by the Go binary under `/admin` (`go:embed`) | Vite, React 19, TypeScript, Tailwind, TanStack Query, Vitest, MSW |
| `mobile/` | Supporter app (iOS first) | Expo, React Native, Expo Router, NativeWind, Zustand, jest-expo |

`mobile/` arrives with PR-04 of the plan. Until then, the mobile app lives in `/Users/jeje/Documents/dev/league-s`.

## Read first

- `docs/plans/2026-10-30-finish-project.md`: the plan. The list of PRs and their order.
- `docs/agents/pr-workflow.md`: how a PR is written, reviewed and merged.
- `docs/agents/testing.md`: which tests each change needs.
- `docs/agents/review-rules.md`: what the reviewer checks. Read it before opening a PR.
- Specs (the source of truth, in French):
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
| Mobile | tests | `npm --prefix mobile test` |
| Mobile | types | `cd mobile && npx tsc --noEmit` |
| Mobile | simulator | skill `simulator-check` |

Local API: `docker compose up -d`, `make migrate-up`, then `make run` (port 8080). Copy `.env.example` to `.env` first.

## Rules for code

- **No code comments**, unless the user approves them.
- All UI text is in French. Mobile copy goes in `mobile/src/i18n/fr.ts`.
- Leagues never mix: every query filters on the `leagueID` of the URL. A resource of another league is a 404.
- The API is snake_case JSON, UUID v7 IDs, date-times in UTC (RFC 3339), dates as `YYYY-MM-DD`.
- Errors: `{"error": "..."}`, and for field validation `{"errors": {"<field>": "<rule>"}}` with a 422.
- Domain rules live in the entity or the service (`internal/app/<domain>`), not in the handler. Store errors are translated by constraint name.
- Follow the existing structure of each package before adding a new pattern.
- Change the spec docs in the same PR as the code: a rule that becomes enforced goes from ⚠️ to ✅ in `docs/api/spec.md`, a new route goes into `docs/api/endpoints.md`, a finished task gets ticked in `docs/api/checklist.md`.

## Rules for git

- Never commit to `main`. One branch per PR: `feat/<slug>`, `fix/<slug>`, `chore/<slug>`, `test/<slug>`, `docs/<slug>`.
- Conventional commit titles: `feat(match): ...`, `fix(admin): ...`.
- Open PRs as **drafts**. Mark one ready (`gh pr ready`) only when every local check passes. The reviewer runs only on ready PRs.
- Never force-push a branch that is under review. Push new commits, so the reviewer can see what changed.
- Never merge by hand and never bypass branch protection. Auto-merge does it after approval.
- Don't run destructive commands on the local database (`migrate-reset`, `docker compose down -v`) without asking.

## Models

- Implementation (author sessions): Opus 5.5.
- Review (GitHub Actions): Sonnet 5.5.
- The user is on a Pro plan with shared limits: run at most 2 PRs at the same time.
