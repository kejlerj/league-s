# League-s — plan to finish the project

Date: 2026-10-30

Goal: finish the API, the admin webapp and the mobile app through a series of small PRs that agents write, review and merge without help, under the rules in §3.

---

## 1. Current state

| Part | Where | State |
|---|---|---|
| Go API | repo root (GitHub `kejlerj/league-s`) | All domains done (league, team, player, season, squad, match, standings). **Auth, invitations and PATCH/DELETE are written but not committed** (branch `feat/auth`, about 50 modified files plus new `internal/app/auth`, `internal/mailer`, migrations 00009 and 00010). Unit tests pass. Integration tests were not run (Docker was off). |
| Sentry | PR `kejlerj/league-s#4` | Open since 2026-10-05, not merged. |
| Admin webapp | `admin/` | Plan tasks 1 to 12 are committed on `feat/auth` (never pushed). Some changes are still uncommitted, including a new `LeagueMatchesTab`. 141 tests pass. Task 13 (build, embed, end-to-end check) is not done. |
| Mobile app | `mobile/` (imported 2026-10-31, before that a local-only repo) | Reads the real API: Suivi, Classement, Team, Match, Moi (theme). 58 tests pass. **2 TypeScript errors** (`app/`, `src/theme/useThemeSync.ts`). `LEAGUE_ID` is hard-coded. `src/config.ts` has an uncommitted change. |
| Leftover | `.claude/worktrees/finish-plan` (branch `feat/mobile-read-endpoints`) | Mostly merged through PR `kejlerj/league-s#3`. Still holds `cmd/seed/main.go`, a demo data seeder that is worth keeping. |
| CI | `.github/workflows/ci.yml` | Go only: lint, vuln, unit, integration. Nothing for admin or mobile. No branch protection on `main`. |

---

## 2. Step 0: one repository (monorepo)

**Done on 2026-10-31, branch `chore/monorepo`.** The mobile app was imported into `mobile/` with its history. The old local mobile repo is kept as a backup until this branch is merged.

Recommendation: **move the mobile app into the Go repo**, not into a new parent folder.

```
league-s/               (kejlerj/league-s)
  cmd/ internal/ migrations/ ...   Go API, stays at the root
  admin/                           admin webapp (already here; go:embed needs it inside the Go module)
  mobile/                          the Expo app, imported with its git history
  docs/                            specs and plans: plan/*.md + docs/superpowers/* from the mobile repo
  CLAUDE.md                        one set of rules for every agent
```

Why:
- One PR can change the API and both clients together. The reviewer sees the whole contract change.
- One CI, one branch protection, one review workflow.
- The Go code stays at the root, so `go:embed` and imports don't change.

How (done together, now, not by an autonomous agent):
1. Commit the pending work in both repos (see PR-01 and PR-02).
2. In the mobile repo: `git mv` everything into `mobile/`, commit.
3. In the Go repo: `git merge --allow-unrelated-histories` from the mobile repo. History is kept.
4. Move `plan/` and the mobile `docs/` into `docs/`.
5. Keep the old local mobile repo as a backup until the first mobile PR is merged.

---

## 3. The PR workflow

### 3.1 Roles

| Role | Who | Runs where |
|---|---|---|
| Orchestrator | One Claude Code session (desktop app), skill `orchestrate-plan` | Works through §5 in order. Starts one author session per PR, in its own worktree. No limit on parallel PRs: hitting the Pro usage limit is fine. |
| Author | One Claude Code session per PR (Opus 5.5) | Writes the code and tests, runs every check, tests on the simulator, opens the PR, answers and fixes review comments. |
| Reviewer | Claude Sonnet 5.5 in GitHub Actions (`anthropics/claude-code-action`, subscription token), as `claude[bot]` | Runs when a PR is marked ready, and on each later push. Skips drafts. Posts inline comments. Approves when nothing blocking is left. |

The reviewer has to be a different GitHub identity from the author: **GitHub refuses an approval from the PR's own author**, and the author agents use your `kejlerj` account. The Claude GitHub App solves this.

### 3.2 Loop for one PR

1. The orchestrator starts an author session for every issue that is ready (dependencies merged, or stackable), with the issue as the brief. Anything waiting on the user is skipped, along with what depends on it; everything else keeps going (skill `orchestrate-plan`).
2. The author creates `feat/<slug>` from `main`, writes the tests first (TDD), then the code.
3. The author runs the local checks (§3.4). Simulator checks are paused until PR-26: mobile changes rely on jest screen tests.
4. The author opens the PR **as a draft** with the template (`Closes #<issue>`, what changed, the tests added, simulator proof).
5. When CI is green, the author marks the PR ready. The reviewer action runs: it reads the issue, the diff and the specs, then posts inline comments, each marked **blocking** or **nit**.
6. The desktop app's Auto-fix wakes the author on each comment. The author fixes or answers every thread, then pushes.
7. The push starts a new review. The reviewer checks its earlier threads and resolves the fixed ones.
8. When no blocking comment is left and CI is green, the reviewer approves. Auto-merge then squash-merges.
9. Safety limit: after 3 review rounds without approval, the reviewer adds the `needs-human` label and stops. The orchestrator moves on to other PRs and tells you.

### 3.3 Definition of done (the reviewer checks every point)

- The issue's acceptance criteria are met and match the specs in `docs/`.
- **Spec tests**: each new business rule has a test named after the rule (Go handler or service test, admin page test, mobile screen test).
- **Non-regression tests**: a bug fix comes with a test that fails without the fix. Existing suites stay green.
- API change: Go integration test plus an update to `docs/endpoints.md`. Once PR-08 lands, the OpenAPI file is updated too.
- Mobile change: jest screen tests, and the affected screens listed in the PR. After PR-26: a Maestro flow too, run on the simulator, with the result and a screenshot.
- Spec docs updated (`spec.md` ⚠️ → ✅, checklist ticked).
- No code comments (your rule), French UI copy, conventional commit titles.

### 3.4 Checks before opening a PR

| Part | Command |
|---|---|
| Go | `make lint && make test && make itest && make vuln` (Docker must be running) |
| Admin | `npm --prefix admin test -- --run && npm --prefix admin run build` |
| Mobile | `npm --prefix mobile test && npx --prefix mobile tsc --noEmit` |
| Mobile E2E | paused until PR-26, then `make dev-up seed` and `maestro test mobile/e2e/` |
| Admin E2E | `make dev-up seed` then `npm --prefix admin run e2e` (Playwright, after PR-07) |

### 3.5 Test layers

| Layer | Back (Go) | Admin | Mobile |
|---|---|---|---|
| Unit | domain rules (`match`, `standing`, `squad`) | components, `api/client` | `src/logic`, store, components |
| Spec / integration | handlers on a real Postgres (testcontainers), auth 401/403 on the real router | pages with MSW | screens with a mocked `fetch` |
| Scenario / E2E | `internal/scenario`: full season, transfer, postponed match | Playwright against the real API and seeded data | Maestro on the iOS Simulator against the real API and seeded data |
| Contract | OpenAPI file checked against the router | TS types generated from OpenAPI | same generated types |

---

## 4. Specs not implemented yet

### 4.1 Decided in the specs: agents can do these without asking

**API** (from `docs/api/spec.md`, `docs/api/checklist.md`, `docs/api/endpoints.md`)
- Only one season at a time per league (no overlap constraint, 409).
- Default points 3/1/0 when the client leaves them out. The create DTO still uses `int32`, so omitted fields become 0/0/0.
- `max_squad_size` exists in the database but is not exposed by the season API.
- Readable validation messages. `httpx.Decode` still returns the raw tag (`"required"`).
- Team list of an unknown league returns `[]` instead of 404 (TODO in `team/handler.go:124`). Check the player and season lists for the same issue.
- Status codes: 201 to register a team in a season, 204 to unregister. To check.
- Security headers middleware (`nosniff`, CSP, `Referrer-Policy`, `Cache-Control: no-store`).
- Periodic cleanup of expired sessions, reset tokens and invitations.
- Sentry (PR #4), with the request ID on events.
- Scenario tests (`internal/scenario`), and seeder helpers for squad and match.
- Endpoints: `GET /teams/{id}/seasons`, `GET /players/{id}/career`, current club in `GET /players/{id}`.
- OpenAPI documentation.
- Deployment: Docker image of the app, migrations as a separate step.

**Admin** (from `docs/admin/2026-10-10-admin-webapp-design.md`)
- Task 13: build wired into `make build`, the binary serves `/admin`, end-to-end check.
- Final check from the spec: build a real data set through the admin, then confirm the mobile app shows it.
- Follow-ups to each API change above (season overlap error, `max_squad_size` field, validation messages).

**Mobile** (from `docs/mobile/2026-09-10-ligue-amateur-v5-design.md`, adjusted by the API-wiring commit `233f68a`)
- Fix the 2 TypeScript errors.
- League choice: `LEAGUE_ID` is hard-coded, but the API is multi-tenant.
- Production API address (`EXPO_PUBLIC_API_URL`, build profiles).
- Team: `Voir l'effectif complet` is inert. Player detail and career screen, once the API has them.

### 4.2 Need your decision before an agent can start (see §6)

These come from the v5 design. They were out of scope or were removed when the app was wired to the real API, because the API has no data for them.

- **Match events** (goals, cards, substitutions). They unlock "Faits de match", the Buteurs, Passeurs and MVP tabs of Classement, goals and assists in the squad, and fair-play as a tie-breaker.
- **MVP vote**: needs an identity per device or per user, and abuse protection.
- **Pronos**: predictions per matchday and a leaderboard. Needs supporter accounts.
- **Boutique**: catalog, cart, payment.
- **Push notifications** (the `full` and `result` levels per followed team in Moi).
- **Search** for teams and leagues, the live match screen, the matchday results screen. Named in the design, never specified in detail.
- Open business questions in `spec.md`: what `left_on` means (last day in the team, or first day out), the exact match transitions, past squad stints overlapping, `random` as a tie-breaker.
- Hosting target for deployment.

---

## 5. PR list

Each line becomes one GitHub issue (label `plan`, with dependencies). Its PR is titled `<type>: [SOC-<issue number>] <Summary>`. The orchestrator runs them in order and in parallel where the dependencies allow.

**🧪** = needs simulator testing. Paused: these screens are checked together in PR-26. **B / A / M** = touches back / admin / mobile.

### Phase 0: land the existing work (with you, before going autonomous)

| PR | Content | Parts | Depends on |
|---|---|---|---|
| PR-01 | **Auth, invitations, PATCH/DELETE.** Commit the uncommitted Go work from `feat/auth` onto a clean branch from `main`. Run `make itest` with Docker. Update `checklist.md` (invitations are done). | B | none |
| PR-02 | **Admin webapp.** The 14 admin commits plus the uncommitted admin changes (`LeagueMatchesTab`…). | A | PR-01 |
| PR-03 | **Sentry.** Rebase PR #4 on `main`, check that reset and invitation links never reach Sentry, merge. | B | PR-01 |
| PR-04 | **Monorepo** (§2). Done on branch `chore/monorepo`, on top of `chore/agent-harness`. Merge it right after the harness PR. | M | harness PR |

### Phase 1: foundations for autonomy

| PR | Content | Parts | Depends on |
|---|---|---|---|
| PR-05 | **CI for every part.** `admin` job (vitest, tsc, build) and `mobile` job (jest, tsc), with path filters. Fix the 2 mobile TS errors. On a fresh checkout `tsc` also fails on `../global.css`, because `mobile/expo-env.d.ts` is generated by Expo and git-ignored: create it in CI before `tsc`. Required checks on `main`. | A M | PR-04 |
| PR-06 | **Local stack and seed.** `cmd/seed` from the leftover worktree, plus `make dev-up` (Postgres, migrations, API) and `make seed`. Fixed seed IDs so E2E tests are stable. `mobile/.env.example`. | B | PR-04 |
| PR-07 | **Admin E2E harness.** Playwright in `admin/e2e/` against the real API and seeded data (login, create a season, schedule and finish a match). `make e2e`. The mobile half moved to PR-26. | A | PR-06 |
| PR-08 | **OpenAPI contract.** `docs/openapi.yaml` for every route. A Go test fails if a router route is missing from it. TS types generated for admin and mobile, plus a CI check that they are up to date. | B A M | PR-05 |
| PR-09 | **Scenario tests.** `internal/scenario`: a full season up to the standings, a mid-season transfer, a postponed then rescheduled match. Seeder helpers `SquadMember` and `Match`. | B | PR-01 |
| PR-10 | **Mobile E2E in CI** (optional, after PR-26). macOS runner (free on a public repo), simulator build, API with Postgres, Maestro. Lets the reviewer see real simulator proof. | M 🧪 | PR-26 |
| PR-27 | **Translate the specs to English.** `docs/api/*`, `docs/admin/*` and the remaining French parts of `docs/mobile/*`. Meaning unchanged, French UI copy quoted in the specs stays in French. Docs only, no new tests. | docs | harness PR |
| PR-28 | **Rename French identifiers to English.** Mobile screens and components (`SuiviScreen` → `FollowingScreen`…), routes (`/suivi`, `/classement`, `/moi`), `fr.ts` keys (`journee`…), French test names, in admin and Go too if any. Pure refactor: tests unchanged except names, the UI text stays French. | M A B | PR-05 |

### Phase 2: API debt (small PRs, each with its admin follow-up)

| PR | Content | Parts | Depends on |
|---|---|---|---|
| PR-11 | One season at a time: `EXCLUDE USING gist` with `btree_gist`, 409, admin message. | B A | PR-05 |
| PR-12 | Default points 3/1/0. Expose `max_squad_size` (API plus admin season form). | B A | PR-05 |
| PR-13 | Readable validation messages. Admin shows them per field. | B A | PR-05 |
| PR-14 | API consistency: 404 on lists of an unknown league, 201/204 on register/unregister (check first, close the item if already done). | B A | PR-05 |
| PR-15 | Security headers middleware. | B | PR-05 |
| PR-16 | Cleanup of expired sessions, reset tokens and invitations. | B | PR-05 |
| PR-17 | Read endpoints: team seasons, player career, current club. | B | PR-08 |

### Phase 3: finish the admin

| PR | Content | Parts | Depends on |
|---|---|---|---|
| PR-18 | Task 13: `make build` builds the admin before the Go binary. One binary serves `/admin` and `/api`. Playwright runs against it. | B A | PR-07 |
| PR-19 | Final check from the admin spec, admin half: a Playwright scenario builds a full league through the admin. The mobile half (the app shows it) is in PR-26. | A | PR-18 |

### Phase 4: finish the mobile app (specified scope)

| PR | Content | Parts | Depends on |
|---|---|---|---|
| PR-20 | **League choice.** Remove `LEAGUE_ID`. League picker on first launch, change it from Moi, persisted. Follows are reset per league. | M 🧪 | PR-07 |
| PR-21 | **Player screen.** "Voir l'effectif complet", player detail with career. | M 🧪 | PR-17, PR-20 |
| PR-22 | **Team history.** Seasons played by the team, past seasons' standings. | M 🧪 | PR-17, PR-20 |
| PR-23 | **Production config.** `app.config.ts`, API address per profile, EAS profiles, ATS limited to dev. | M 🧪 | PR-20 |
| PR-26 | **Final simulator pass.** Maestro set up in `mobile/e2e/`, one flow per screen (Suivi, Classement, Team follow, Match, Moi theme, league picker, player, team history), plus the PR-19 data set from the admin shown in the app. Run on the iOS Simulator against seeded data. Fix what fails, each fix with a jest non-regression test. Then simulator checks become mandatory again (`docs/agents/testing.md`). | M 🧪 | PR-19 to PR-23 |

### Phase 5: deployment (needs the hosting decision)

| PR | Content | Parts | Depends on |
|---|---|---|---|
| PR-24 | Multi-stage Dockerfile (admin build, Go build), migrations as a separate step, `docker compose` for prod. | B | PR-18, hosting decision |
| PR-25 | Deployment workflow to the chosen host, plus a smoke test on `/health`. | B | PR-24 |

### Phase 6: product features (only after you decide, §6)

Each needs a short design spec first. The orchestrator writes it with the `superpowers:brainstorming` skill and asks you to approve it before opening any code PR.

| PR group | Feature | Parts |
|---|---|---|
| PR-30…33 | Match events: table and API, admin entry during a live match, "Faits de match" on mobile, Buteurs and Passeurs tabs | B A M 🧪 |
| PR-34…35 | MVP vote | B M 🧪 |
| PR-36…39 | Pronos | B M 🧪 |
| PR-40… | Push notifications, Boutique, search | to define |

### Critical path and parallel work

```
PR-01 ─┬─ PR-02 ── PR-04 ─┬─ PR-05 ─┬─ PR-11..16 (in parallel)
       ├─ PR-03           │         └─ PR-08 ── PR-17 ─┬─ PR-21
       └─ PR-09           └─ PR-06 ── PR-07 ─┬─ PR-18 ── PR-19
                                             └─ PR-20 ─┴─ PR-22, PR-23

PR-19, PR-21, PR-22, PR-23 ── PR-26 (final simulator pass) ── PR-10
```

PRs in Phase 2 touch different packages, so they can run in parallel. Two PRs that both add a migration must merge one after the other: the second rebases and renumbers its migration.

---

## 6. Decisions I need from you

1. ~~Reviewer setup~~: decided. Claude GitHub App, Sonnet 5.5, subscription token.
2. **Merge**: auto-merge as soon as the reviewer approves and CI is green (recommended), or you click merge.
3. **Product scope for Phase 6**: which features, in what order (match events first is the natural start: it unlocks the most screens).
4. **Open business questions** in §4.2 (`left_on`, match transitions, overlap of past squad stints, `random` tie-breaker). Without answers, agents keep the current choices written in `spec.md`.
5. **Hosting** for Phase 5.

---

## 7. Setup needed before going autonomous

Done in PR `chore/agent-harness`: items 2 to 5 (`CLAUDE.md`, `docs/agents/`, skills, templates, reviewer workflow).

| # | What | Who |
|---|---|---|
| 1 | Phase 0 (PR-01 to PR-04), the monorepo merge in particular | Claude, with you |
| 2 | Root `CLAUDE.md`: layout, commands, conventions, definition of done, PR workflow | Claude |
| 3 | Project skills in `.claude/skills/`: `ship-pr` (author loop §3.2 to §3.4), `simulator-check` (stack, seed, simulator, Maestro, screenshot), `orchestrate-plan` (pick the next issue, start sessions, track dependencies) | Claude |
| 4 | `.github/pull_request_template.md` and `.github/ISSUE_TEMPLATE/plan-item.md` | Claude |
| 5 | `.github/workflows/claude-review.yml` plus `.github/claude/review.md` (the reviewer's rules: §3.3, blocking or nit, round limit) | Claude |
| 6 | Install the Claude GitHub App on `kejlerj/league-s` and add the `CLAUDE_CODE_OAUTH_TOKEN` (or `ANTHROPIC_API_KEY`) secret. Run `/install-github-app` from a `claude` terminal session. It can't run in this app. | You |
| 7 | Repo settings: allow auto-merge, delete branches after merge. `main` protection: PR required, 1 approval, required checks, stale approvals dismissed on push, conversations resolved. | Claude via `gh api`, with your OK |
| 8 | One GitHub issue per PR in §5, with labels and dependencies | Claude |
| 9 | Install Maestro: `brew tap mobile-dev-inc/tap && brew install maestro`. Start Docker Desktop and leave it running. | You |
| 10 | Desktop app: turn on Auto-fix for PRs (wakes the author on review comments and CI failures). Use auto permission mode, and allow the usual `go`, `make`, `npm`, `gh`, `maestro` commands (`/fewer-permission-prompts`). | You, with Claude for the allowlist |
| 11 | Clean up the `finish-plan` worktree once `cmd/seed` has moved (PR-06) | Claude |
