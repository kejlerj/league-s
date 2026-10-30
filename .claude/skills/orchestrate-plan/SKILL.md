---
name: orchestrate-plan
description: Drive the league-s plan to completion. Pick the open plan issues whose dependencies are merged, start one author session per issue (Opus 5.5, own worktree, ship-pr skill), at most 2 at a time, and track progress. Use when asked to continue, run or orchestrate the league-s plan, or to say what comes next.
---

# Orchestrate the plan

The plan is `docs/plans/2026-10-30-finish-project.md`. Each plan item is a GitHub issue with the `plan` label. GitHub is the source of truth for status, not the plan file.

## 1. Read the state

```bash
gh issue list --repo kejlerj/league-s --label plan --state all --limit 200 --json number,title,state,labels,body,assignees
gh pr list --repo kejlerj/league-s --state open --json number,title,isDraft,labels,headRefName,reviewDecision
```

For each open issue, read its `Depends on: #X, #Y` line. The issue is **ready** when:
- every issue it depends on is closed,
- it has no `blocked` label,
- it has no assignee, and no open PR says `Closes` it.

## 2. Decide what runs

- At most **2** PRs in progress (open, not merged). Count the open PRs that close a plan issue.
- Pick the ready issue with the lowest plan ID (`PR-05` before `PR-11`).
- Don't run two issues at the same time if both add a migration, or if both touch the same files.
- Phase 6 issues (product features) start with a design spec that the user approves. Never start their code PRs on your own.

## 3. Start an author session

For each issue picked, start a new session (desktop app `start_session`):

- model: Opus 5.5 (`claude-opus-5-5`),
- in its own worktree,
- brief: "Use the `ship-pr` skill on issue #<N> of kejlerj/league-s (<plan ID>: <title>). Follow CLAUDE.md. Report the PR link when it is merged or labelled needs-human."

## 4. React to reports

When a session reports back:
- **Merged**: check that the issue is closed and the CI of `main` is green. Then go back to step 1.
- **`needs-human`** or **`blocked`**: tell the user in one or two lines, with the link and the question. Go back to step 1 for other work.
- **Failed** (crash, can't finish): read its last report. Restart it once with what you learnt. If it fails again, label the issue `needs-human`.

## 5. Report to the user

After each change, in a few lines:
- what got merged,
- what is in progress (PR links),
- what is blocked on them, with the question,
- what comes next.

Never merge, close an issue by hand, change branch protection, or start Phase 6 code without the user.
