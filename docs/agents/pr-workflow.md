# PR workflow

How one item of the plan becomes a merged PR, with no human in the loop unless something blocks.

## Roles

| Role | Who | Where |
|---|---|---|
| Orchestrator | A Claude Code session in the desktop app, using the `orchestrate-plan` skill | Picks the next plan issue whose dependencies are merged, starts an author session for it |
| Author | One Claude Code session per PR (Opus 5.5), in its own worktree, using the `ship-pr` skill | Writes the code and the tests, opens the PR, answers the review |
| Reviewer | `claude[bot]` in GitHub Actions (Sonnet 5.5), `.github/workflows/claude-review.yml` | Comments inline, requests changes or approves |
| Human | The repository owner | Answers `needs-human` PRs and product questions |

## The issue is the brief

Each PR starts from a GitHub issue with the `plan` label (template `.github/ISSUE_TEMPLATE/plan-item.md`). The issue gives:

- the plan ID (`PR-11`…), and the phase's milestone,
- the scope, the acceptance criteria, and the specs it refers to,
- `Depends on: #<issue>, …`,
- the parts it touches (back, admin, mobile), and whether it needs a simulator check.

When the issue and the specs disagree, the specs win. Say so in the PR description.

## Steps

1. **Branch.** In a worktree, named `<type>/SOC-<issue>-<slug>`:
   - from the latest `origin/main` when every dependency is merged,
   - from the parent PR's branch when a dependency is still open (see Stacked PRs).
2. **Plan.** Write a short task list (skill `superpowers:writing-plans`) and post it on the issue as a checklist comment. Keep it ticked as you go. It lets another session resume the work, and gives the reviewer context. Never commit it to the repo.
3. **Tests first.** Write the failing spec tests, then the code (skill `superpowers:test-driven-development`). See `testing.md`.
4. **Docs.** Update `docs/api/*.md` and the specs touched by the change.
5. **Local checks.** Run every check of the parts you touched (`CLAUDE.md` › Commands). Simulator checks are paused until PR-26.
6. **Draft PR.** `gh pr create --draft`, titled `<type>: [SOC-<issue>] <Summary>` (`CLAUDE.md` › Rules for git), filling in `.github/pull_request_template.md`. The body says `Closes #<issue>`.
7. **Ready.** When every local check passed, run `gh pr ready` in the same turn as `gh pr create`, without waiting for CI: Auto-fix wakes the author on a CI failure, never on green CI. A PR stays a draft only when a local check could not run, and the orchestrator nudges it. That starts the review. If the PR's base is `main`, also turn on auto-merge: `gh pr merge --auto --squash`. Exception: a design spec PR for a product feature (Phase 6) never gets auto-merge. Label it `needs-decision` instead: the user approves the spec by merging it.
8. **Review loop.** For each reviewer comment:
   - **blocking**: fix it, or explain why the comment is wrong (with a reference to the spec or the code),
   - **nit**: fix it if cheap, otherwise reply why not,
   - reply in the comment's thread with what you did and the commit SHA,
   - never resolve the reviewer's threads yourself: the reviewer resolves them.

   Then push. The push starts a new review.
9. **Merge.** Once the reviewer approves and every required check is green, auto-merge squash-merges the PR and closes the issue. Then remove the worktree.

## Stacked PRs

When an issue depends on a PR that is open but not merged yet, the work can start without waiting: the new PR is stacked on the parent PR.

**When to stack**
- The parent PR is marked ready and its CI is green. Never stack on a draft: it may still change a lot.
- One level deep at most. If the parent is itself stacked, wait.
- The child needs the parent's code. A dependency that is only about ordering (e.g. two migrations) is not a reason to stack: wait for the merge.

**How**
1. Branch from the parent's branch: `git worktree add -b <type>/SOC-<issue>-<slug> .claude/worktrees/SOC-<issue> refs/remotes/origin/<parent-branch>`.
2. Open the PR with the parent's branch as base: `gh pr create --draft --base <parent-branch>`. The reviewer then sees only the child's own changes.
3. In the PR body, add `Stacked on #<parent PR>` under `Closes #<issue>`.
4. Mark it ready as usual. Don't turn on auto-merge: its base isn't `main`, so it would merge into the parent branch.

**When the parent is merged**
The parent is squash-merged: its work is now one new commit on `main`, but the child branch still carries the parent's original commits. They have to go, otherwise they show up again in the child's diff and conflict with the squash commit.
1. `git fetch origin`
2. `git rebase --onto origin/main <old tip of the parent branch> <your branch>`. The old tip is the parent's last commit, the one the child was built on (written down when the child was created). This replays only the child's own commits on top of `main` and drops the parent's original ones.
3. Check that only the child's commits are left: `git log --oneline origin/main..HEAD`. If a parent commit is still listed, the old tip was wrong: `git rebase --abort` if the rebase is still in progress, otherwise `git reset --hard ORIG_HEAD`, then redo step 2 with the right SHA (`git reflog` shows it).
4. `git diff origin/main...HEAD --stat` should list only the child's files.
5. Rerun the local checks.
6. `git push --force-with-lease`
7. `gh pr edit <PR> --base main`. GitHub may already have done it when it deleted the parent branch.
8. `gh pr merge --auto --squash`
9. Comment on the PR that it was restacked on `main`, so the reviewer knows the base moved.

**When the parent changes during its review**
Rebase the child on the parent's new tip, rerun the checks, and `git push --force-with-lease`. Say so in a PR comment, so the reviewer knows the base moved.

## Limits

- **3 review rounds.** After the third "changes requested" with blocking comments still open, the reviewer adds the `needs-human` label and stops reviewing that PR. The author stops too and reports to the orchestrator.
- **Scope.** A PR does one plan item. Something else found on the way becomes a new issue (see Follow-up issues), not an extra change.
- **Size.** Aim for less than about 600 changed lines, generated code excluded. Bigger means split the item into two PRs.
- **Parallel work.** No limit on PRs open at the same time. If the Pro plan's usage limit is hit, sessions wait for the reset. Two PRs that both add a migration, or that touch the same files, run one after the other.
- **Review workflow changes.** The Claude action refuses to run on a PR that changes `.github/workflows/claude-review.yml` (the file must match `main`, so a PR can't rewrite the reviewer). Such a PR gets no review: put the change in its own small PR, label it `needs-human`, and the owner reviews and merges it.
- **Decisions.** A product question the specs don't answer, a business rule change, or a new library, tool or service is never decided by an agent (`CLAUDE.md` › Decisions that need the user). Label the issue `needs-decision`, write the question in a comment (options, trade-offs, recommendation), and move to the next issue. The owner answers in a comment on that issue; the orchestrator then closes it and turns the answer into issues.

## Follow-up issues

Authors and the reviewer open an issue whenever they find, outside the PR's scope:
- existing code that breaks `docs/agents/code-style.md` or `CLAUDE.md` (French identifiers, duplicated business rule, layer mixing…),
- code that should be refactored (too complex, dead, wrong abstraction),
- a bug, a missing test, or a spec item nobody planned.

How:
1. Search first, to avoid duplicates: `gh issue list --search "<keywords>" --state open`. If one exists, add a comment instead.
2. Create it with the `plan` label, plus `tech-debt` (guidelines, refactor) or `bug`, plus the parts touched. Use the plan item template: scope, acceptance criteria, files concerned, `Depends on`.
3. Don't fix it in the current PR, unless the PR can't be correct without it.

The orchestrator picks these issues up like any other plan item. A refactor issue never changes behaviour (`refactor:` PR, no new tests needed if existing tests cover the code).

## Repository settings this relies on

- Branch protection on `main`: PR required, 1 approval, required checks, stale approvals dismissed on push, conversations resolved before merge.
- "Allow auto-merge" on.
- "Automatically delete head branches" on: GitHub then moves stacked PRs to `main` by itself.

## Labels

| Label | Meaning |
|---|---|
| `plan` | An item of the plan |
| `back`, `admin`, `mobile` | Parts touched |
| `simulator` | Needs a simulator check |
| `needs-decision` | Waiting for the user: product question, business rule, new library or tool |
| `tech-debt` | Existing code to fix against the guidelines, or to refactor |
| `bug` | A bug found outside a PR's scope |
| `needs-human` | The review loop gave up |
