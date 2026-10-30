---
name: ship-pr
description: Implement one plan issue of league-s end to end. Branch, tests first, code, docs, local checks, simulator check for mobile, draft PR, ready, then answer and fix every review comment until the reviewer approves. Use when given a plan issue number or a plan ID (PR-11…) to implement, or when asked to address review comments on a league-s PR.
---

# Ship one PR

Read `CLAUDE.md`, `docs/agents/pr-workflow.md`, `docs/agents/testing.md` and `docs/agents/review-rules.md` before you start.

## 1. Load the brief

```bash
gh issue view <N> --repo kejlerj/league-s --comments
```

- Check that every `Depends on: #X` issue is closed. If one is still open, stop and report it.
- Read the specs that the issue names. If the specs don't answer a product question, follow "Blocked" in `pr-workflow.md` and stop.
- Comment on the issue that you are starting it, and add yourself as assignee: `gh issue edit <N> --add-assignee @me`.

## 2. Branch in a worktree

```bash
git fetch origin
git worktree add -b <type>/<slug> .claude/worktrees/<slug> refs/remotes/origin/main
```

Work only inside that worktree. Use `refs/remotes/origin/main`: a file named `main` at the root makes a plain `main` ambiguous.

## 3. Build it

1. Write a short task list (skill `superpowers:writing-plans`, kept in the session).
2. For each task, write the failing test, watch it fail, write the code, watch it pass (skill `superpowers:test-driven-development`).
3. SQL changed: `sqlc generate`. New migration: next free number in `migrations/`.
4. Update the docs listed in `CLAUDE.md` › Rules for code.
5. Commit in small steps with conventional titles.

## 4. Check locally

Run every check of the parts you touched (`CLAUDE.md` › Commands). Everything has to pass. Docker must be running for `make itest`. If it isn't, say so to the user and wait, don't skip the step.

If `mobile/` changed in a way the user can see, run the `simulator-check` skill. Keep its result and screenshot links for the PR body.

Before going further, run the skill `superpowers:verification-before-completion`.

## 5. Open the PR as a draft

```bash
git push -u origin <branch>
gh pr create --draft --title "<conventional title>" --body-file <filled template>
```

Fill in every section of `.github/pull_request_template.md`. The body has to contain `Closes #<N>`.

In the desktop app, bind the PR to the session and turn on Auto-fix (ccd_pr tools). The app then wakes you on review comments, CI failures and conflicts.

## 6. Mark it ready

When CI is green on the draft:

```bash
gh pr ready <PR>
```

That starts the reviewer.

## 7. Answer the review

List the reviewer's inline comments and its reviews:

```bash
gh api repos/kejlerj/league-s/pulls/<PR>/comments --paginate --jq '.[] | {id, path, line, body, user: .user.login, in_reply_to_id}'
gh api repos/kejlerj/league-s/pulls/<PR>/reviews --jq '.[] | {state, user: .user.login, body}'
```

For each comment from `claude[bot]` that has no reply from you yet:

- `[blocking]`: fix it with a test when it is about behaviour, or reply with the reason the comment is wrong (spec line or code reference).
- `[nit]`: fix it if cheap, otherwise reply why not.
- Reply in the thread with what you did and the commit SHA:

  ```bash
  gh api repos/kejlerj/league-s/pulls/<PR>/comments/<comment_id>/replies -f body="Fixed in <sha>: <what>"
  ```

- Don't resolve the threads: the reviewer does.

Then rerun the local checks, and push new commits. Never force-push. The push starts a new review round.

Stop when:
- the PR is merged (auto-merge): remove the worktree with `git worktree remove .claude/worktrees/<slug>`, and report to the orchestrator;
- the PR gets the `needs-human` label: report what is blocking, and stop.

## 8. Report

End with: the PR link, what changed, the tests added, what was checked on the simulator, and anything left open.
