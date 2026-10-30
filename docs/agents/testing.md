# Testing

Every PR adds tests. The reviewer refuses a behaviour change without one.

## Two kinds of tests, required on both front and back

- **Spec tests**: one test per business rule that the PR adds or changes. The test name says the rule, close to its wording in the spec (`TestCreateSeason_RefusesOverlappingSeason`, `test('a shared match keeps the perspective of the first followed team')`).
- **Non-regression tests**: every bug fix starts with a test that fails without the fix. Existing tests are never deleted or loosened to make a change pass. When a test has to change because the spec changed, the PR description says which spec line changed.

## Which test for which change

| Change | Back (Go) | Admin | Mobile |
|---|---|---|---|
| Domain rule (match lifecycle, standings, squad) | Unit test of the entity or service, no build tag | none | none |
| Route, validation, status code, error | Integration test of the handler (`//go:build integration`), real Postgres through `testdb`, IDs from the seeder | none | none |
| Auth or permission | Test on the real router (`internal/server/*_test.go`): 401, 403 (admin of another league), success | Guard tests | none |
| Cross-domain flow (season → matches → standings) | `internal/scenario` (after PR-09) | Playwright in `admin/e2e/` (after PR-07) | Maestro in `mobile/e2e/` (after PR-07) |
| Page or screen | none | Page test with MSW: the normal path and one error | Screen test with a mocked `fetch`: loading, error, data |
| Pure logic | none | Unit test | Unit test in `src/logic` |
| API contract (after PR-08) | `docs/openapi.yaml` updated, the route test passes | Generated types updated | Generated types updated |

## Go conventions

- Integration tests use `testdb.New(t, pool)`, which empties the database and returns a seeder. No hard-coded IDs: create the data with the seeder, and use `uuid.New()` for unknown IDs.
- Check the JSON body and the status code, not only the status code.
- Isolation: for every new route that reads by ID, add a test that a resource of another league is a 404.

## Simulator (mobile): paused until PR-26

To save usage, simulator checks are paused. Until the final simulator pass (PR-26):

- a mobile change is covered by jest screen tests: loading, error and data states, plus the interaction that changed,
- don't run the simulator or Maestro, and don't write Maestro flows,
- in the PR body, under "Simulator check", list the screens the change affects, so PR-26 knows what to cover.

PR-26 writes the Maestro flows for every screen, runs them on the simulator against seeded data, and fixes what it finds. After PR-26, the rules below apply to every mobile PR.

A mobile change that the user can see needs:

1. a Maestro flow in `mobile/e2e/` that goes through the change and asserts what is shown (`assertVisible` on French copy),
2. a run on the iOS Simulator against the local API with seeded data (skill `simulator-check`),
3. the Maestro result and a screenshot in the PR description.

Until PR-07 adds Maestro, do steps 2 and 3 with the desktop app's iOS Simulator tool (screenshots), and say so in the PR.
