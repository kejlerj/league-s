# Admin

The league back-office. A Vite + React SPA, embedded in the Go binary and served under `/admin/`.

## Commands

```bash
npm ci
npm run dev
npm test -- --run
npx tsc -b
npm run build
```

- `npm run dev`: http://localhost:5173/admin/, with a proxy from `/api` to `http://localhost:8080`.
- `npm run build`: writes `dist/`, which `embed.go` embeds at `go build`. Restart the API after a build.
- From the repository root, `make build` runs `npm run build`, then builds the Go binary `./main` that serves the admin and the API.
- `npm run e2e`: Playwright tests in `e2e/`, against the binary and the demo seed. Run them with `make e2e` from the repository root.

## API configuration

`ADMIN_URL` must point to the root of the admin, prefix included:

- dev: `http://localhost:5173/admin`
- prod: `https://<host>/admin`

Password reset links (`/reset-password?token=`) and invitation links (`/invitation?token=`) are built from this value.

The API serves `/admin` with its own Content Security Policy (`internal/server/routes.go`): scripts, styles and API calls from the same origin only, and images from the same origin or any `https:` host, for league and team logos.

## Layout

- `src/api`: the `fetch` client and one module per resource.
- `src/auth`: the current session and the route guards.
- `src/features`: pages and forms, one folder per resource.
- `src/ui`: presentation components. `useSubmit` puts each 422 field message under its input through `field(name)`.
- `src/test`: the MSW server, test data, `renderRoute`.
