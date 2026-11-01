# Testing

A PR that changes behaviour adds tests. The reviewer refuses a behaviour change without one.

## PRs that don't need new tests

Some PRs change no behaviour. They don't need new tests, but they still need every existing check to pass:

| Kind of PR | Examples | What proves it works |
|---|---|---|
| CI and tooling | workflows, Makefile, linters, scripts | the CI run of the PR itself |
| Types only | fixing TypeScript errors without changing what runs | `tsc` passes, existing tests pass |
| Pure refactor | rename, move, extract, with the same behaviour | existing tests pass unchanged |
| Docs | specs, README, guidelines | none |
| Dependency bump | Dependabot, version upgrades | existing tests pass |
| Config | `.env.example`, app config with no logic | the app or the API starts |

Rules:
- Say it in the PR's "Tests" section: `No new tests: <kind> — <why behaviour doesn't change>`.
- A pure refactor that has to change existing tests isn't pure. Explain each changed test, or add tests.
- A refactor of code with no tests at all adds tests first, so the refactor is checked.
- If a fix in one of these PRs changes behaviour after all (a type fix that was hiding a bug, for example), that part needs a test like any other change.

## Two kinds of tests, required on both front and back

- **Spec tests**: one test per business rule that the PR adds or changes. The test name says the rule, close to its wording in the spec (`TestCreateSeason_RefusesOverlappingSeason`, `test('a shared match keeps the perspective of the first followed team')`).
- **Non-regression tests**: every bug fix starts with a test that fails without the fix. Existing tests are never deleted or loosened to make a change pass. When a test has to change because the spec changed, the PR description says which spec line changed.

## Which test for which change

| Change | Back (Go) | Admin | Mobile |
|---|---|---|---|
| Domain rule (match lifecycle, standings, squad) | Unit test of the entity or service, no build tag | none | none |
| Route, validation, status code, error | Integration test of the handler (`//go:build integration`), real Postgres through `testdb`, IDs from the seeder | none | none |
| Auth or permission | Test on the real router (`internal/server/*_test.go`): 401, 403 (admin of another league), success | Guard tests | none |
| Cross-domain flow (season → matches → standings) | `internal/scenario` (after PR-09) | Playwright in `admin/e2e/` (`make e2e`) | Maestro in `mobile/e2e/` (after PR-07) |
| Page or screen | none | Page test with MSW: the normal path and one error | Screen test with a mocked `fetch`: loading, error, data |
| Pure logic | none | Unit test | Unit test in `src/logic` |
| API contract | `docs/openapi.yaml` updated, `TestOpenAPIDescribesEveryRoute` passes | `npm --prefix admin run api-types`, commit `src/api/schema.ts` | `npm --prefix mobile run api-types`, commit `src/types/api.ts` |

## Generated API types

The admin and the mobile app take their API types from `docs/openapi.yaml`, through `openapi-typescript`. After any change to the spec, regenerate both files and commit them:

```bash
npm --prefix admin run api-types
npm --prefix mobile run api-types
```

The generated files are `admin/src/api/schema.ts` and `mobile/src/types/api.ts`. Never edit them by hand. `admin/src/api/types.ts` and `mobile/src/types/index.ts` give the schemas short names. The `Admin` and `Mobile` CI jobs regenerate the files and fail when the committed copy differs.

## Go conventions

- Integration tests use `testdb.New(t, pool)`, which empties the database and returns a seeder. No hard-coded IDs: create the data with the seeder, and use `uuid.New()` for unknown IDs.
- Check the JSON body and the status code, not only the status code.
- Isolation: for every new route that reads by ID, add a test that a resource of another league is a 404.

## Simulator (mobile)

A mobile change that the user can see needs:

1. jest screen tests: loading, error and data states, plus the interaction that changed,
2. a Maestro flow in `mobile/e2e/` that goes through the change and asserts what is shown (`assertVisible` on French copy). Add a new flow, or extend the flow of the screen,
3. a run on the iOS Simulator against the local API with seeded data (skill `simulator-check`): `maestro test mobile/e2e/`,
4. the Maestro result and screenshots in the PR description (`pr-assets` branch).

The flows open the app in Expo Go (`exp://127.0.0.1:8081`) and pick the seeded league "District Five Demo". `mobile/e2e/admin-data-set.yaml` checks the league that the admin final check builds (`npx --prefix admin playwright test full-league`). It is tagged `admin-data-set` and excluded from the default run: run it with `maestro test --include-tags admin-data-set mobile/e2e/`.

The `Mobile E2E` CI job runs the same default flows on a macOS runner for every PR that touches `mobile/`: Postgres, the API with the seed, Expo Go on an iOS simulator, then `maestro test mobile/e2e/`. When it fails, the `mobile-e2e` artifact of the run holds the API and Expo logs and Maestro's screenshots.

If Maestro isn't installed (`maestro --version`), do step 3 with the desktop app's iOS Simulator tool (screenshots), and say so in the PR.
