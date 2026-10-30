---
name: simulator-check
description: Run the league-s mobile app on the iOS Simulator against the local API with seeded data, run the Maestro flows, and collect proof (result and screenshots) for a PR. Use for any league-s change under mobile/ that a user can see, or when asked to test the mobile app on the simulator.
---

# Simulator check

## 1. Start the API with data

Docker must be running (`docker info`). If it isn't, ask the user to start Docker Desktop, and wait.

After PR-06:

```bash
make dev-up
make seed
```

Before PR-06, from the repository root:

```bash
docker compose up -d
make migrate-up
```

Then run `make run` in the background (the Bash tool's `run_in_background`), and wait for `curl -sf localhost:8080/health` to answer. Create the data through the API or the admin.

Read the seeded league ID from the seed output. The app needs it until PR-20 adds the league picker.

## 2. Start the app

```bash
cd mobile
EXPO_PUBLIC_API_URL=http://localhost:8080/api/v1 npx expo start --ios
```

Run it in the background. The app on the simulator reaches the host's `localhost` directly.

In the desktop app:
1. Call the iOS Simulator tool's `attach` first, so the user sees the panel.
2. Use `screenshot`, `tap` and `text` to check the screens the PR changed, in light and dark mode (`set_appearance`).

## 3. Run Maestro

After PR-07, the flows are in `mobile/e2e/`:

```bash
maestro test mobile/e2e/
```

The flows open the app through Expo Go (`appId: host.exp.Exponent`, `openLink: exp://127.0.0.1:8081`), and assert on French copy (`assertVisible`).

A change the user can see needs a flow that goes through it. Add or update the flow in the same PR.

If Maestro is missing, ask the user to run `brew tap mobile-dev-inc/tap && brew install maestro`, and continue with simulator screenshots only. Say so in the PR.

## 4. Put the proof in the PR

1. Copy the Maestro summary (flows passed and failed) into the "Simulator check" section of the PR body.
2. Publish the screenshots on the `pr-assets` branch, which holds images only and is never merged:

   ```bash
   git fetch origin pr-assets || true
   git worktree add .claude/worktrees/pr-assets origin/pr-assets 2>/dev/null || git worktree add --orphan -b pr-assets .claude/worktrees/pr-assets
   mkdir -p .claude/worktrees/pr-assets/<branch-slug>
   cp <screenshots> .claude/worktrees/pr-assets/<branch-slug>/
   git -C .claude/worktrees/pr-assets add . && git -C .claude/worktrees/pr-assets commit -m "assets: <branch-slug>" && git -C .claude/worktrees/pr-assets push origin HEAD:pr-assets
   ```

3. Link each image in the PR body: `![<screen>](https://raw.githubusercontent.com/kejlerj/league-s/pr-assets/<branch-slug>/<file>.png)`.

## 5. Clean up

Stop the Expo and API background processes. Leave the Postgres container running. Never run `docker compose down -v`: it deletes the local data.
