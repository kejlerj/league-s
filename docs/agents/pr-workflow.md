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

- the plan ID (`PR-11`…),
- the scope, the acceptance criteria, and the specs it refers to,
- `Depends on: #<issue>, …`,
- the parts it touches (back, admin, mobile), and whether it needs a simulator check.

When the issue and the specs disagree, the specs win. Say so in the PR description.

## Steps

1. **Branch.** From the latest `origin/main`, in a worktree: `feat/<slug>`.
2. **Plan.** For more than a few files, write a short task list first (skill `superpowers:writing-plans`). Keep it in the session, not in the repo.
3. **Tests first.** Write the failing spec tests, then the code (skill `superpowers:test-driven-development`). See `testing.md`.
4. **Docs.** Update `docs/api/*.md` and the specs touched by the change.
5. **Local checks.** Run every check of the parts you touched (`CLAUDE.md` › Commands). If you touched `mobile/`, run the `simulator-check` skill.
6. **Draft PR.** `gh pr create --draft`, filling in `.github/pull_request_template.md`. The body says `Closes #<issue>`.
7. **Ready.** When CI is green on the draft, run `gh pr ready`. That starts the review.
8. **Review loop.** For each reviewer comment:
   - **blocking**: fix it, or explain why the comment is wrong (with a reference to the spec or the code),
   - **nit**: fix it if cheap, otherwise reply why not,
   - reply in the comment's thread with what you did and the commit SHA,
   - never resolve the reviewer's threads yourself: the reviewer resolves them.

   Then push. The push starts a new review.
9. **Merge.** Once the reviewer approves and every required check is green, auto-merge squash-merges the PR and closes the issue. Then remove the worktree.

## Limits

- **3 review rounds.** After the third "changes requested" with blocking comments still open, the reviewer adds the `needs-human` label and stops reviewing that PR. The author stops too and reports to the orchestrator.
- **Scope.** A PR does one plan item. Something else found on the way becomes a new issue, labelled `plan` and `found-during-review`, not an extra change.
- **Size.** Aim for less than about 600 changed lines, generated code excluded. Bigger means split the item into two PRs.
- **Parallel work.** At most 2 PRs open and not merged at the same time (Pro plan limits). Two PRs that both add a migration run one after the other.
- **Blocked.** A product question that the specs don't answer is never guessed. Label the issue `blocked`, write the question in a comment, move to the next issue.

## Labels

| Label | Meaning |
|---|---|
| `plan` | An item of the plan |
| `back`, `admin`, `mobile` | Parts touched |
| `simulator` | Needs a simulator check |
| `blocked` | Waiting for a product decision |
| `needs-human` | The review loop gave up |
| `found-during-review` | Found while working on another PR |
