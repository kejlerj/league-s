Closes #
<!-- Stacked PR only: Stacked on #<parent PR> -->

**Plan item:** PR-

## What changes

<!-- What the user, the admin or the API client sees differently. -->

## How

<!-- The main technical choices, and anything that differs from the spec or the issue, with the reason. -->

## Tests

<!-- For a PR that changes no behaviour, replace this list with: No new tests: <kind> — <why behaviour doesn't change>. See docs/agents/testing.md. -->

- Spec tests:
- Non-regression tests:
- Changed or removed tests (with the spec line that changed):

## Checks run locally

- [ ] Go: `make lint`, `make test`, `make itest`, `make vuln`
- [ ] Admin: `npm --prefix admin test -- --run`, `npm --prefix admin run build`
- [ ] Mobile: `npm --prefix mobile test`, `npx tsc --noEmit`
- [ ] Not relevant (say which parts were not touched):

## Simulator check

<!-- Mobile change the user can see: Maestro flows and result, screenshots (pr-assets branch). Otherwise "Not needed". -->

## Docs updated

- [ ] `docs/api/spec.md`
- [ ] `docs/api/endpoints.md`
- [ ] `docs/api/checklist.md`
- [ ] Other:
- [ ] None needed

🤖 Generated with [Claude Code](https://claude.com/claude-code)
