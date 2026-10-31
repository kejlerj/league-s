# Review rules

What the reviewer (`claude[bot]`, `.github/workflows/claude-review.yml`) checks. Authors read this before marking a PR ready.

## What to check, in order

1. **Scope.** The PR does what its issue (`Closes #N`) asks, and nothing else. It touches no file outside that scope without a reason given in the description.
2. **Spec conformance.** Every acceptance criterion of the issue is met. Behaviour matches `docs/api/spec.md`, `docs/api/endpoints.md`, `docs/admin/*`, `docs/mobile/*`. A difference from the spec is a blocking comment, unless the PR description explains it and the spec doc is updated in the same PR.
3. **Correctness.** Bugs, missing error cases, wrong status codes, race conditions (locks, transactions), off-by-one on dates (season bounds are inclusive, UTC).
4. **League isolation.** Every new query filters on the URL's `leagueID`. Every new write route has the right guard (`LeagueAdminWrites`, `SuperadminWrites`, `Superadmin`).
5. **Security.** No secret, token or reset link in logs or responses where it shouldn't be. Input validated. No raw database errors returned to the client.
6. **Tests** (see `docs/agents/testing.md`):
   - a PR that changes no behaviour (CI, types only, pure refactor, docs, dependency bump, config) needs no new tests, if the "Tests" section says so and the diff agrees. Block it if you find a behaviour change in it without a test,
   - a spec test for each new or changed rule,
   - a non-regression test for each bug fix,
   - no test deleted or loosened without a spec change,
   - mobile change: jest screen tests cover it, and the description lists the affected screens. Until PR-26 is merged, a missing simulator run or Maestro flow is **not** blocking. After PR-26, both are required.
7. **Docs.** Spec docs updated: ⚠️ → ✅, new routes, ticked checklist items.
8. **Conventions** (`CLAUDE.md`, `docs/agents/code-style.md`):
   - PR title `<type>: [SOC-<issue>] <Summary>`, with the type matching the change (a `refactor` that changes behaviour is a `feat` or a `fix`),
   - code and docs in English (identifiers, test names, commits), only UI copy in French,
   - no code comments, snake_case JSON,
   - the existing structure of the package,
   - KISS, YAGNI and DRY as that file applies them.
9. **Stacked PR** (body says `Stacked on #N`): review only this PR's own diff against its base. Auto-merge must be off while its base is not `main`.

Don't comment on formatting that the linters handle.

## Problems outside the diff

When you see existing code that the PR doesn't touch and that breaks the guidelines, needs a refactor, or has a bug: don't block the PR for it. Open a follow-up issue as described in `docs/agents/pr-workflow.md` › Follow-up issues (search for a duplicate first), and link it in your review summary.

## New dependencies

A new library, tool, CI action or external service in the diff (`go.mod`, `package.json`, workflows) is `[blocking]` unless the plan or the specs name it, or an issue labelled `needs-decision` shows the user chose it. Point to `CLAUDE.md` › Decisions that need the user.

## How to comment

- One inline comment per problem, on the line concerned.
- Start each comment with **`[blocking]`** or **`[nit]`**.
  - `[blocking]`: the PR can't be merged as is (bug, spec difference, missing test, security, isolation).
  - `[nit]`: an improvement that doesn't block.
- Say what is wrong, why (point to the spec line or the code), and what would fix it.
- No praise comments, and no summary of the diff.

## Deciding

- At least one `[blocking]` comment still open → **request changes**, with a short list of the blocking points.
- None → **approve**, even if nits are left. Don't block on CI: branch protection already waits for it.

## Later rounds

1. Read the author's replies on your earlier threads.
2. Resolve each thread that is fixed, or where the author's explanation is right.
3. Reply in the thread when the answer doesn't convince you, and keep it open.
4. Review only what changed since your last review, plus anything those changes break.
5. Don't raise new nits on code that was already reviewed.

## Round limit

If this is the 4th review, and the 3 before it were "changes requested", and blocking comments are still open: add the `needs-human` label, post one comment that lists what is blocking, and stop.
