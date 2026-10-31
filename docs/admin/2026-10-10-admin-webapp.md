# Admin webapp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A web back-office (admin and superadmin sign-in) to manage leagues, teams, players, seasons, squads, matches and admins, embedded in the Go binary under `/admin/`.

**Architecture:** Vite + React SPA in `admin/` of the Go repo. A typed `fetch` client talks to `/api/v1` on the same origin with the `session` cookie. TanStack Query holds the server state, a `SessionProvider` holds the current user and the route guards.

**Tech Stack:** Vite, React 19, strict TypeScript, Tailwind v4 (`@tailwindcss/vite`), React Router v7 (`react-router`), TanStack Query v5, Vitest, Testing Library, MSW v2.

**Spec:** `docs/admin/2026-10-10-admin-webapp-design.md`

## Global Constraints

- All the code goes in `admin/`. No file outside that folder is created or changed in this repo. `admin/embed.go`, `internal/server/routes.go` and the root `.gitignore` belong to the API.
- The Go repo has uncommitted work on `feat/auth`. Each commit uses a pathspec: `git add admin && git commit -m "<msg>" -- admin`. Never `git add -A`, `git stash`, `git checkout` or a branch switch in this repo.
- No comments in the code.
- French interface. No visible English text, including known error messages.
- `base: '/admin/'` in Vite, `basename: '/admin'` in the router, API under `/api/v1`.
- `fetch` with `credentials: 'same-origin'`. No token in `localStorage` or `sessionStorage`.
- snake_case JSON as the API returns it: the TypeScript types keep the names `league_id`, `start_on`, etc.
- Date-times in UTC RFC 3339, plain dates `YYYY-MM-DD`.
- Every dynamic URL segment goes through `seg()`.
- Password: 10 characters minimum, 72 bytes maximum.
- The API refuses unknown fields (`DisallowUnknownFields`): send only the fields listed in the spec. An "empty" body is sent as `{}`.
- Two error shapes: `{"error": "message"}` and, for field validation (422), `{"errors": {"<field>": "<message>"}}`; the message (in French) is shown under the field.
- Create: an empty optional field is sent as `null`. Update (`PATCH`): an empty optional field isn't sent at all. Clearing an existing field isn't possible in v1.
- `admin/dist` is not versioned, except `admin/dist/.gitkeep`. The source file is `admin/public/.gitkeep`, which Vite copies into `dist` on every build.
- All `npm` commands run from `admin/`. End-of-task check: `npm test -- --run && npx tsc --noEmit`.

## Review Focus

1. **Session expired during an entry**: a 401 on a write sends back to sign-in, then returns to the original page. Tested in Task 4.
2. **Empty optional fields**: a logo, an icon, a venue or a number left empty is never sent as `""` (the API rejects `""` as a URL): `null` on create, missing key on update. Tested in Task 6 and Task 12.
3. **Time zones**: a kickoff entered at 15:00 local time is sent in UTC and shows again as 15:00. Tested in Task 2.
4. **Double click on a submit button**: only one request is sent. Tested in Task 3.
5. **Deep link reloaded**: `/admin/leagues/x/seasons/y` opened directly works for an admin of the league and shows « Accès refusé » for another one. Tested in Task 4.

---

## File Structure

```
admin/
  .gitignore                 node_modules, dist
  package.json, tsconfig.json, vite.config.ts, index.html
  src/
    main.tsx                 mount, QueryClient, router
    routes.tsx               route table
    index.css                Tailwind import
    api/
      client.ts              api(), seg(), ApiError, onUnauthorized
      types.ts               resource types
      auth.ts leagues.ts teams.ts players.ts seasons.ts squad.ts matches.ts admins.ts
    lib/
      dates.ts               date and date-time conversions
      form.ts                emptyToNull, toInt
    auth/
      SessionProvider.tsx    useSession
      guards.tsx             RequireAuth, RequireLeague
    ui/
      Button.tsx Field.tsx Modal.tsx ConfirmDialog.tsx DataTable.tsx
      PageState.tsx Tabs.tsx Layout.tsx errorMessage.ts useSubmit.ts
    features/
      auth/        LoginPage ForgotPasswordPage ResetPasswordPage AccountPage
      leagues/     LeaguesPage LeaguePage LeagueForm
      teams/       TeamsTab TeamForm
      players/     PlayersTab PlayerForm
      seasons/     SeasonsTab SeasonForm SeasonPage SeasonTeamsTab StandingsTab
      squad/       SquadPage JoinForm TransferForm
      matches/     MatchesTab MatchForm ScoreForm matchActions.ts
      admins/      AdminsTab AcceptInvitationPage
    test/
      server.ts    MSW server
      fixtures.ts  test data
      render.tsx   renderRoute()
      setup.ts
```

Each test file sits next to the file it tests: `X.test.ts(x)`.

---

### Task 1: Project scaffold

**Files:**
- Create: `admin/package.json`, `admin/.gitignore`, `admin/tsconfig.json`, `admin/vite.config.ts`, `admin/index.html`, `admin/src/main.tsx`, `admin/src/index.css`, `admin/src/routes.tsx`
- Create: `admin/src/test/setup.ts`, `admin/src/test/server.ts`, `admin/src/test/fixtures.ts`, `admin/src/test/render.tsx`
- Test: `admin/src/test/render.test.tsx`

**Interfaces:**
- Produces:
  - `routes: RouteObject[]` in `src/routes.tsx` (a temporary `/` route that shows « Admin »).
  - `server` (MSW `setupServer`) in `src/test/server.ts`, started in `setup.ts` with `onUnhandledRequest: 'error'`.
  - `renderRoute(path: string): { user: UserEvent }` in `src/test/render.tsx`: mounts `routes` in a `createMemoryRouter` without `basename`, a fresh `QueryClient` (`retry: false`), and the `SessionProvider` once it exists (Task 4).
  - `API = '/api/v1'` exported by `src/test/server.ts` to write the handlers.

- [ ] **Step 1: Create the project**

`npm create vite@latest admin -- --template react-ts` from the root of the Go repo, then in `admin/`: `npm i react-router @tanstack/react-query` and `npm i -D tailwindcss @tailwindcss/vite vitest jsdom @testing-library/react @testing-library/user-event @testing-library/jest-dom msw`. Delete the template's demo files (`App.tsx`, `App.css`, `assets/`).

- [ ] **Step 2: Configure**

`vite.config.ts`: `base: '/admin/'`, plugins `react()` and `tailwindcss()`, `server.proxy = { '/api': 'http://localhost:8080' }`, `test = { environment: 'jsdom', setupFiles: './src/test/setup.ts', globals: true }`. `tsconfig`: `strict: true`, alias `@/*` to `src/*` (also in `resolve.alias`). `index.html`: `lang="fr"`, title « Ligue — Admin ». `.gitignore`: `node_modules`, `dist/*`, `!dist/.gitkeep`. Create an empty `public/.gitkeep`. Script `"test": "vitest"`.

- [ ] **Step 3: Write the harness test**

```tsx
test('renderRoute shows the requested route', async () => {
  renderRoute('/');
  expect(await screen.findByText('Admin')).toBeInTheDocument();
});
```

- [ ] **Step 4: Write `main.tsx`, `routes.tsx`, and the files of `src/test/`**

`main.tsx` creates the router with `createBrowserRouter(routes, { basename: '/admin' })`.

- [ ] **Step 5: Check**

Run: `npm test -- --run && npx tsc --noEmit && npm run build`
Expected: 1 test passes, no type error, `dist/index.html` references files under `/admin/assets/`, `dist/.gitkeep` exists.

- [ ] **Step 6: Commit**

`git add admin && git commit -m "feat(admin): scaffold Vite React app" -- admin`

---

### Task 2: API client, types and conversions

**Files:**
- Create: `admin/src/api/client.ts`, `admin/src/api/types.ts`, `admin/src/lib/dates.ts`, `admin/src/lib/form.ts`
- Test: `admin/src/api/client.test.ts`, `admin/src/lib/dates.test.ts`, `admin/src/lib/form.test.ts`

**Interfaces:**
- Produces:
  - `class ApiError extends Error { readonly status: number; readonly fields: Record<string, string> | null }`, constructor `(status, message, fields = null)` — `message` is the response's `error` field, or `HTTP <status>` if it's missing. `fields` is the `errors` field if present. Network failure: `status === 0`.
  - `api<T>(method: 'GET'|'POST'|'PUT'|'PATCH'|'DELETE', path: string, opts?: { body?: unknown; query?: Record<string, string | undefined> }): Promise<T>` — prefixes `/api/v1`, returns `undefined` on 204.
  - `seg(value: string): string` — `encodeURIComponent`.
  - `onUnauthorized(handler: () => void): void` — called on every 401 except for `GET /me` and `POST /auth/login`.
  - `dates.ts`: `dateToUtc(d: string): string` (`'2026-09-01'` → `'2026-09-01T00:00:00Z'`), `utcToDate(iso: string): string`, `localToUtc(v: string): string` (local `'YYYY-MM-DDTHH:mm'` → ISO UTC), `utcToLocal(iso: string): string`, `formatDateTime(iso: string | null): string` (fr-FR, `'—'` if `null`).
  - `form.ts`: `emptyToNull(v: string): string | null` (trim), `toInt(v: string): number | null`, `omitEmpty<T extends Record<string, unknown>>(o: T): Partial<T>` (removes the keys whose value is `null`, `undefined` or `''`).
  - `types.ts`: `User {id,email,name,is_superadmin}`, `Me = User & {leagues: {id,name}[]}`, `League {id,name,logo}`, `Team {id,league_id,name,logo}`, `Player {id,league_id,firstname,lastname,icon}`, `TieBreaker`, `Season`, `SeasonTeam {id,name,logo}`, `SquadMember`, `MatchStatus = 'scheduled'|'live'|'finished'|'postponed'|'cancelled'`, `Match`, `StandingRow`, `LeagueAdmin {id,email,name}`, `Invitation {id,email,expires_at}`, `InvitationPreview {email, league:{id,name}, account_exists}`. Exact fields: the spec's "Existing resources" section. Every optional API field is `T | null`.

- [ ] **Step 1: Write the tests**

```ts
test('api prefixes /api/v1, adds the query and skips undefined values', async () => {
  let url = '';
  server.use(http.get(`${API}/x`, ({ request }) => { url = request.url; return HttpResponse.json([]); }));
  await api('GET', '/x', { query: { a: '1', b: undefined } });
  expect(new URL(url).search).toBe('?a=1');
});
test('api returns undefined on 204', async () => {
  server.use(http.post(`${API}/x`, () => new HttpResponse(null, { status: 204 })));
  expect(await api('POST', '/x')).toBeUndefined();
});
test('api turns {error} into ApiError', async () => {
  server.use(http.post(`${API}/x`, () => HttpResponse.json({ error: 'nope' }, { status: 409 })));
  await expect(api('POST', '/x')).rejects.toMatchObject({ status: 409, message: 'nope' });
});
test('api exposes field errors', async () => {
  server.use(http.post(`${API}/x`, () => HttpResponse.json({ errors: { name: 'required' } }, { status: 422 })));
  await expect(api('POST', '/x')).rejects.toMatchObject({ status: 422, fields: { name: 'required' } });
});
test('network failure gives status 0', async () => {
  server.use(http.get(`${API}/x`, () => HttpResponse.error()));
  await expect(api('GET', '/x')).rejects.toMatchObject({ status: 0 });
});
test('401 calls onUnauthorized, except for /me and /auth/login', async () => {
  const spy = vi.fn(); onUnauthorized(spy);
  const r401 = () => HttpResponse.json({ error: 'x' }, { status: 401 });
  server.use(http.get(`${API}/me`, r401), http.post(`${API}/auth/login`, r401), http.post(`${API}/leagues`, r401));
  await api('GET', '/me').catch(() => {});
  await api('POST', '/auth/login').catch(() => {});
  expect(spy).not.toHaveBeenCalled();
  await api('POST', '/leagues').catch(() => {});
  expect(spy).toHaveBeenCalledTimes(1);
});
test('seg encodes reserved characters', () => { expect(seg('a/b?c')).toBe('a%2Fb%3Fc'); });
```

```ts
test('dateToUtc / utcToDate', () => {
  expect(dateToUtc('2026-09-01')).toBe('2026-09-01T00:00:00Z');
  expect(utcToDate('2026-09-01T00:00:00Z')).toBe('2026-09-01');
});
test('localToUtc and utcToLocal are inverses', () => {
  expect(utcToLocal(localToUtc('2026-10-11T15:00'))).toBe('2026-10-11T15:00');
});
test('formatDateTime(null) renders a dash', () => { expect(formatDateTime(null)).toBe('—'); });
```

```ts
test('emptyToNull', () => { expect(emptyToNull('  ')).toBeNull(); expect(emptyToNull(' a ')).toBe('a'); });
test('toInt', () => { expect(toInt('')).toBeNull(); expect(toInt('7')).toBe(7); expect(toInt('x')).toBeNull(); });
test('omitEmpty', () => { expect(omitEmpty({ a: 'x', b: null, c: '', d: 0 })).toEqual({ a: 'x', d: 0 }); });
```

- [x] **Step 2: Check it fails** — Run: `npm test -- --run`. Expected: FAIL, modules not found.
- [ ] **Step 3: Implement the four files.**
- [ ] **Step 4: Check** — Run: `npm test -- --run && npx tsc --noEmit`. Expected: PASS.
- [ ] **Step 5: Commit** — `feat(admin): API client, types and date helpers`

---

### Task 3: UI components and errors

**Files:**
- Create: `admin/src/ui/{Button,Field,Modal,ConfirmDialog,DataTable,PageState,Tabs}.tsx`, `admin/src/ui/errorMessage.ts`, `admin/src/ui/useSubmit.ts`
- Test: `admin/src/ui/errorMessage.test.ts`, `admin/src/ui/useSubmit.test.tsx`, `admin/src/ui/ConfirmDialog.test.tsx`

**Interfaces:**
- Consumes: `ApiError` (Task 2).
- Produces:
  - `errorMessage(err: unknown, overrides?: Record<number, string>): string` — order: if `err.fields`, `'Champs invalides : '` followed by `<field> (<text>)` separated by commas, with the texts `required` « obligatoire », `email` « e-mail invalide », `http_url` « URL http ou https attendue », `min` « trop petit », `max` « trop grand », any other rule « invalide »; then `overrides[status]`; status 0 or ≥ 500 → `'Une erreur est survenue. Réessayez.'`; 403 → `'Accès refusé.'`; 429 → `'Trop de tentatives. Réessayez dans une minute.'`; otherwise `err.message`.
  - `useSubmit<A extends unknown[]>(fn: (...a: A) => Promise<unknown>, overrides?: Record<number, string>): { submit: (...a: A) => Promise<boolean>; pending: boolean; error: string | null }` — ignores a call while another one is running; `submit` resolves `true` on success.
  - `Button({ variant?: 'primary'|'secondary'|'danger', pending?: boolean, ...buttonProps })` — disabled when `pending`.
  - `Field({ label, error?, ...inputProps })` — `<label>` linked to the `<input>`.
  - `Modal({ title, open, onClose, children })` — `role="dialog"`, `aria-label={title}`, closes on Escape.
  - `ConfirmDialog({ open, title, message, confirmLabel, onConfirm: () => Promise<unknown>, onClose, errorOverrides? })` — shows the error in the dialog and stays open if `onConfirm` fails.
  - `DataTable<T>({ rows, columns: { header: string; cell: (row: T) => ReactNode }[], rowKey: (row: T) => string, empty: string })`.
  - `PageState({ query, children })` — for a TanStack Query result: « Chargement… », or an error message + « Réessayer » button (`query.refetch`), or `children(data)`. A 404 shows « Introuvable. » without a button.
  - `Tabs({ tabs: { id: string; label: string; content: ReactNode }[] })` — active tab in the `?tab=` URL parameter.

- [ ] **Step 1: Write the tests**

```ts
test.each([
  [new ApiError(0, 'x'), undefined, 'Une erreur est survenue. Réessayez.'],
  [new ApiError(503, 'x'), undefined, 'Une erreur est survenue. Réessayez.'],
  [new ApiError(403, 'x'), undefined, 'Accès refusé.'],
  [new ApiError(429, 'x'), undefined, 'Trop de tentatives. Réessayez dans une minute.'],
  [new ApiError(409, 'déjà pris'), undefined, 'déjà pris'],
  [new ApiError(409, 'x'), { 409: 'Conflit.' }, 'Conflit.'],
  [new ApiError(403, 'x'), { 403: 'Mot de passe actuel incorrect.' }, 'Mot de passe actuel incorrect.'],
  [new ApiError(422, 'x', { name: 'required', logo: 'http_url' }), { 422: 'Autre.' }, 'Champs invalides : name (obligatoire), logo (URL http ou https attendue)'],
])('errorMessage', (err, overrides, expected) => {
  expect(errorMessage(err, overrides)).toBe(expected);
});
```

```tsx
test('useSubmit ignores the second call while the first one is running', async () => {
  let release!: () => void;
  const fn = vi.fn(() => new Promise<void>((r) => { release = r; }));
  const { result } = renderHook(() => useSubmit(fn));
  act(() => { void result.current.submit(); void result.current.submit(); });
  expect(fn).toHaveBeenCalledTimes(1);
  await act(async () => { release(); });
  expect(result.current.pending).toBe(false);
});
test('useSubmit exposes the message and resolves false on failure', async () => {
  const { result } = renderHook(() => useSubmit(() => Promise.reject(new ApiError(409, 'pris'))));
  let ok = true;
  await act(async () => { ok = await result.current.submit(); });
  expect(ok).toBe(false);
  expect(result.current.error).toBe('pris');
});
```

```tsx
test('ConfirmDialog stays open and shows the error if onConfirm fails', async () => {
  const onClose = vi.fn();
  render(<ConfirmDialog open title="Supprimer" message="Sûr ?" confirmLabel="Supprimer"
    onConfirm={() => Promise.reject(new ApiError(409, 'x'))} onClose={onClose}
    errorOverrides={{ 409: 'Cette ligue a un historique.' }} />);
  await userEvent.click(screen.getByRole('button', { name: 'Supprimer' }));
  expect(await screen.findByText('Cette ligue a un historique.')).toBeInTheDocument();
  expect(onClose).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Check it fails.**
- [ ] **Step 3: Implement.** Plain Tailwind style: neutral background, one accent color, readable tables, visible focus.
- [ ] **Step 4: Check** — `npm test -- --run && npx tsc --noEmit`.
- [ ] **Step 5: Commit** — `feat(admin): UI primitives and error mapping`

---

### Task 4: Session, guards, sign-in and layout

**Files:**
- Create: `admin/src/api/auth.ts`, `admin/src/auth/SessionProvider.tsx`, `admin/src/auth/guards.tsx`, `admin/src/ui/Layout.tsx`, `admin/src/features/auth/LoginPage.tsx`
- Modify: `admin/src/routes.tsx`, `admin/src/main.tsx`, `admin/src/test/render.tsx`, `admin/src/test/fixtures.ts`
- Test: `admin/src/auth/guards.test.tsx`, `admin/src/features/auth/LoginPage.test.tsx`

**Interfaces:**
- Consumes: `api`, `onUnauthorized`, `errorMessage`, `useSubmit`, `Field`, `Button`.
- Produces:
  - `auth.ts`: `login(email, password): Promise<User>`, `logout(): Promise<void>`, `getMe(): Promise<Me>`, `changePassword(current_password, new_password)`, `requestPasswordReset(email)`, `confirmPasswordReset(token, password)`.
  - `useSession(): { me: Me | null; loading: boolean; isSuperadmin: boolean; canWrite(leagueId: string): boolean; refresh(): Promise<void>; clear(): void }` — `canWrite` is true if superadmin or if `leagueId` is in `me.leagues`.
  - `RequireAuth`: while loading, « Chargement… »; without a session, `<Navigate to="/login" state={{ from: location }} replace />`; otherwise `<Layout><Outlet /></Layout>`.
  - `RequireLeague`: reads `:leagueId`, renders « Accès refusé. » if `!canWrite(leagueId)`, otherwise `<Outlet />`.
  - `Layout`: header with a « Ligues » link (`/`), the user's name, a « Mon compte » link (`/account`), a « Déconnexion » button.
  - `SessionProvider` registers `onUnauthorized(() => clear())`: `RequireAuth` then redirects to `/login` with `state.from`.
  - Fixtures: `superadmin: Me`, `adminOne: Me` (one league, id `L1`), `adminTwo: Me` (leagues `L1` and `L2`), and `mockMe(me: Me | null)`, which installs the `GET /me` handler (401 if `null`).
  - `renderRoute(path, { me?: Me | null })` calls `mockMe` (default `superadmin`).
  - Routes added: `/login` (public), and a `RequireAuth` parent with a temporary `/`, then `/leagues/:leagueId` under `RequireLeague` (temporary content « Ligue »).

- [ ] **Step 1: Write the tests**

```tsx
test('without a session, / redirects to sign-in', async () => {
  renderRoute('/', { me: null });
  expect(await screen.findByRole('heading', { name: 'Connexion' })).toBeInTheDocument();
});
test('an admin of another league sees Accès refusé on a deep link', async () => {
  renderRoute('/leagues/L2', { me: adminOne });
  expect(await screen.findByText('Accès refusé.')).toBeInTheDocument();
});
test('a superadmin can open any league', async () => {
  renderRoute('/leagues/L9', { me: superadmin });
  expect(await screen.findByText('Ligue')).toBeInTheDocument();
});
test('a 401 on a write sends to sign-in then back to the page', async () => {
  // render /leagues/L1 as adminOne, trigger api('POST', '/leagues/L1/teams') answering 401,
  // wait for the Connexion heading, switch mockMe(adminOne), sign in,
  // then wait for the text « Ligue ».
});
```

```tsx
test('a successful sign-in returns to the requested page', async () => {
  // me: null, route /leagues/L1; POST /auth/login → 200 then mockMe(adminOne)
  // type the email and password, click « Se connecter », wait for « Ligue »
});
test('wrong credentials', async () => {
  // POST /auth/login → 401; wait for « E-mail ou mot de passe incorrect. »
});
test('too many attempts', async () => {
  // POST /auth/login → 429; wait for « Trop de tentatives. Réessayez dans une minute. »
});
```

The three tests described in comments are written in full with `server.use`, `user.type`, `user.click` and the labels given.

- [ ] **Step 2: Check it fails.**
- [ ] **Step 3: Implement.** `LoginPage`: fields « E-mail » and « Mot de passe », button « Se connecter », link « Mot de passe oublié ? » to `/forgot-password`. After `login()`, call `refresh()` then navigate to `state.from` or `/`. Error override `{ 401: 'E-mail ou mot de passe incorrect.' }`. Signing out calls `logout()`, `clear()`, then empties the TanStack Query cache.
- [ ] **Step 4: Check.**
- [ ] **Step 5: Commit** — `feat(admin): session, route guards and login`

---

### Task 5: Password pages

**Files:**
- Create: `admin/src/features/auth/{ForgotPasswordPage,ResetPasswordPage,AccountPage}.tsx`
- Modify: `admin/src/routes.tsx`
- Test: one `.test.tsx` file per page

**Interfaces:**
- Consumes: functions of `api/auth.ts`, `useSubmit`, `Field`, `Button`.
- Produces: routes `/forgot-password` and `/reset-password` (public), `/account` (under `RequireAuth`).

Fixed texts:
- Forgotten: after sending, always « Si un compte existe pour cette adresse, un e-mail vient d'être envoyé. »
- Reset: reads `?token=`. Without a token, or on 400: « Lien invalide ou expiré. » On 422: « Le mot de passe doit contenir au moins 10 caractères. » Success: « Mot de passe modifié. » and a « Se connecter » link.
- Account: fields « Mot de passe actuel », « Nouveau mot de passe », « Confirmation ». Different confirmation: « Les mots de passe ne correspondent pas. », with no network call. 403: « Mot de passe actuel incorrect. » 422: same message as above. Success: « Mot de passe modifié. »
- The new password fields have `minLength={10}`.

- [ ] **Step 1: Write the tests** — one test per fixed text above (8 tests), each with the MSW handler returning the status concerned and a `findByText` assertion on the exact text. For the different confirmation, also check that no `PUT /me/password` request was sent.
- [ ] **Step 2: Check it fails.**
- [ ] **Step 3: Implement the three pages.**
- [ ] **Step 4: Check.**
- [ ] **Step 5: Commit** — `feat(admin): password reset and account pages`

---

### Task 6: Leagues

**Files:**
- Create: `admin/src/api/leagues.ts`, `admin/src/features/leagues/{LeaguesPage,LeagueForm,LeaguePage}.tsx`
- Modify: `admin/src/routes.tsx`, `admin/src/test/fixtures.ts`
- Test: `admin/src/features/leagues/LeaguesPage.test.tsx`, `LeaguePage.test.tsx`

**Interfaces:**
- Consumes: `useSession`, `Tabs`, `DataTable`, `Modal`, `ConfirmDialog`, `PageState`, `emptyToNull`.
- Produces:
  - `leagues.ts`: `listLeagues(): Promise<League[]>`, `getLeague(id)`, `createLeague({name, logo})`, `updateLeague(id, {name?, logo?})` (PATCH, passed through `omitEmpty`), `deleteLeague(id)`.
  - Query keys, convention for the whole plan: `['leagues']`, `['league', leagueId]`, then `['league', leagueId, '<resource>']` and `['season', seasonId, '<resource>']`.
  - `LeagueForm({ initial?: League, onDone })`: fields « Nom » (required, 50 max) and « Logo (URL) ».
  - `LeaguePage`: title = the league's name, « Modifier » button, and `Tabs` with the ids `teams`, `players`, `seasons`, `admins`. The contents are empty slots filled by tasks 7 to 9.
  - Fixtures: `leagueL1`, `leagueL2`.

Behaviour:
- Superadmin: list from `GET /leagues`, « Nouvelle ligue » button, « Supprimer » button per row with confirmation. 409: « Cette ligue a un historique. »
- Admin: list from `me.leagues`, without calling `GET /leagues`, without create or delete buttons.
- Admin with a single league: `/` redirects to `/leagues/<id>`.

- [ ] **Step 1: Write the tests**

```tsx
test('an admin of one league is redirected into it', async () => { /* adminOne on '/', wait for the title leagueL1.name */ });
test('an admin of two leagues sees their leagues, without a Nouvelle ligue button', async () => { /* adminTwo */ });
test('the superadmin creates a league; an empty logo is sent as null', async () => {
  // capture the body of POST /leagues; type only the name;
  // expect(body).toEqual({ name: 'Ligue Test', logo: null })
});
test('a refused delete shows Cette ligue a un historique.', async () => { /* DELETE → 409 */ });
test('LeaguePage shows the four tabs', async () => { /* Équipes, Joueurs, Saisons, Admins */ });
test('an unknown league shows Introuvable.', async () => { /* GET /leagues/L1 → 404 */ });
```

- [ ] **Step 2: Check it fails.**
- [ ] **Step 3: Implement.** After each write, invalidate `['leagues']`; after a create or delete by a superadmin, also call the session's `refresh()`.
- [ ] **Step 4: Check.**
- [ ] **Step 5: Commit** — `feat(admin): leagues list and league page`

---

### Task 7: Teams and players

**Files:**
- Create: `admin/src/api/teams.ts`, `admin/src/api/players.ts`, `admin/src/features/teams/{TeamsTab,TeamForm}.tsx`, `admin/src/features/players/{PlayersTab,PlayerForm}.tsx`
- Modify: `admin/src/features/leagues/LeaguePage.tsx`, `admin/src/test/fixtures.ts`
- Test: `TeamsTab.test.tsx`, `PlayersTab.test.tsx`

**Interfaces:**
- Produces:
  - `teams.ts`: `listTeams(leagueId)`, `createTeam(leagueId, {name, logo})`, `updateTeam(leagueId, teamId, {name?, logo?})`, `deleteTeam(leagueId, teamId)`.
  - `players.ts`: `listPlayers(leagueId, q?: string)` (`GET /leagues/{id}/players?q=`), `createPlayer(leagueId, {firstname, lastname, icon})`, `updatePlayer(...)`, `deletePlayer(...)`.
  - `TeamsTab({ leagueId })`, `PlayersTab({ leagueId })`.
  - Fixtures: `teamA`, `teamB`, `playerP1`, `playerP2`.

Behaviour: table, « Nouvelle équipe » / « Nouveau joueur » button, « Modifier » and « Supprimer » per row. Delete 409: « Cette équipe a un historique. » / « Ce joueur a un historique. » Players: a « Rechercher » field that sends `q` after 300 ms without typing. Fields: « Nom » + « Logo (URL) »; « Prénom », « Nom », « Photo (URL) ».

- [ ] **Step 1: Write the tests** — for each tab: list shown; create sends the right body with an empty URL field as `null`; edit sends a PATCH on the right path, without the URL field's key if it's empty; delete 409 shows the fixed text. For players, also: typing « dup » triggers a request with `q=dup`.
- [ ] **Step 2: Check it fails.**
- [ ] **Step 3: Implement and plug into `LeaguePage`.**
- [ ] **Step 4: Check.**
- [ ] **Step 5: Commit** — `feat(admin): teams and players management`

---

### Task 8: Seasons

**Files:**
- Create: `admin/src/api/seasons.ts`, `admin/src/features/seasons/{SeasonsTab,SeasonForm}.tsx`
- Modify: `admin/src/features/leagues/LeaguePage.tsx`, `admin/src/test/fixtures.ts`
- Test: `SeasonsTab.test.tsx`

**Interfaces:**
- Consumes: `dateToUtc`, `utcToDate`.
- Produces:
  - `seasons.ts`: `listSeasons(leagueId)`, `getSeason(leagueId, seasonId)`, `createSeason(leagueId, input)`, `updateSeason(leagueId, seasonId, input)`, `deleteSeason(...)`, `listSeasonTeams(leagueId, seasonId): Promise<SeasonTeam[]>`, `addSeasonTeam(leagueId, seasonId, teamId)`, `removeSeasonTeam(...)`.
  - `SeasonInput = { name; start_on; end_on; match_win_pts; match_draw_pts; match_loss_pts; tie_breakers: TieBreaker[] }`.
  - `TIE_BREAKER_LABELS: Record<TieBreaker, string>`: `goal_difference` « Différence de buts », `goals_scored` « Buts marqués », `head_to_head` « Confrontations directes », `fair_play` « Fair-play », `random` « Tirage au sort ».
  - `SeasonsTab({ leagueId })`: each season name is a link to `/leagues/:leagueId/seasons/:seasonId`.
  - Fixture: `seasonS1`.

Behaviour: form defaults 3 / 1 / 0 points and tie-breakers `goal_difference`, `goals_scored`. Tie-breakers are an ordered list: checkboxes, the order sent is the order of selection. End date before or equal to the start: « La fin doit être après le début. », with no network call. Delete 409: « Cette saison a des matchs. »

- [ ] **Step 1: Write the tests**

```tsx
test('create sends the dates in UTC and the defaults', async () => {
  // type name « 2026-2027 », start 2026-09-01, end 2027-06-30
  // expect(body).toEqual({ name: '2026-2027', start_on: '2026-09-01T00:00:00Z', end_on: '2027-06-30T00:00:00Z',
  //   match_win_pts: 3, match_draw_pts: 1, match_loss_pts: 0, tie_breakers: ['goal_difference', 'goals_scored'] })
});
test('end before start blocks the submit', async () => { /* fixed text, no POST request */ });
test('edit prefills the dates', async () => { /* start field is 2026-09-01 */ });
test('delete 409', async () => { /* Cette saison a des matchs. */ });
```

- [ ] **Step 2: Check it fails.**
- [ ] **Step 3: Implement and plug into `LeaguePage`.**
- [ ] **Step 4: Check.**
- [ ] **Step 5: Commit** — `feat(admin): seasons management`

---

### Task 9: Admins and invitations

**Files:**
- Create: `admin/src/api/admins.ts`, `admin/src/features/admins/{AdminsTab,AcceptInvitationPage}.tsx`
- Modify: `admin/src/features/leagues/LeaguePage.tsx`, `admin/src/routes.tsx`
- Test: `AdminsTab.test.tsx`, `AcceptInvitationPage.test.tsx`

**Interfaces:**
- Produces:
  - `admins.ts`: `listAdmins(leagueId): Promise<LeagueAdmin[]>`, `removeAdmin(leagueId, userId)`, `listInvitations(leagueId): Promise<Invitation[]>`, `invite(leagueId, email): Promise<Invitation & { link: string }>`, `cancelInvitation(leagueId, invitationId)`, `getInvitation(token): Promise<InvitationPreview>`, `acceptInvitation(token, body?: { name: string; password: string })` (sends `{}` without `body`).
  - Public route `/invitations/:token`.

Behaviour:
- `AdminsTab`: list of admins for everyone. For the superadmin only: « Inviter un admin » form (« E-mail » field), « Invitations en attente » list with expiry date and « Annuler » button, « Retirer » button per admin with confirmation. A plain admin doesn't call `GET .../invitations`.
- Invitation 409: « Cette personne est déjà admin de la ligue. » Success: « Invitation créée pour <email>. », the returned link (`link`) shown in a read-only field, and a « Copier le lien » button. Inviting an address again replaces the previous invitation: no error to handle.
- `AcceptInvitationPage`: title « Rejoindre <nom de la ligue> », invited address shown. If `account_exists` is false: fields « Nom » and « Mot de passe » (`minLength={10}`), button « Créer mon compte ». Otherwise: button « Rejoindre la ligue », request body `{}`. Success: « C'est fait. Vous pouvez vous connecter. » and a link to `/login`. 400 or 404 on load or on submit: « Lien invalide ou expiré. », no form. 422: « Le mot de passe doit contenir au moins 10 caractères. »

- [ ] **Step 1: Write the tests** — `AdminsTab`: a plain admin sees the list without a form and no `invitations` request is sent; the superadmin invites, sees the success message and the returned link; 409; cancelling an invitation; removing an admin. `AcceptInvitationPage`: a new account sends `{name, password}`; an existing account sends `{}`; 400 on load; 422. The token `a/b` is called under `/invitations/a%2Fb`.
- [ ] **Step 2: Check it fails.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Check.**
- [ ] **Step 5: Commit** — `feat(admin): league admins and invitations`

---

### Task 10: Season page, registered teams and standings

**Files:**
- Create: `admin/src/api/standings.ts`, `admin/src/features/seasons/{SeasonPage,SeasonTeamsTab,StandingsTab}.tsx`
- Modify: `admin/src/routes.tsx`
- Test: `SeasonPage.test.tsx`

**Interfaces:**
- Consumes: `listSeasonTeams`, `addSeasonTeam`, `removeSeasonTeam`, `listTeams`.
- Produces:
  - `getStandings(leagueId, seasonId): Promise<StandingRow[]>`.
  - Route `/leagues/:leagueId/seasons/:seasonId` under `RequireLeague`.
  - `SeasonPage`: back link to the league, the season's name, `Tabs` with `teams`, `matches`, `standings`. The `matches` tab is filled in Task 12.
  - `SeasonTeamsTab({ leagueId, seasonId })`: list of registered teams, each name being a link to `.../teams/:teamId` (squad). « Inscrire une équipe » dropdown limited to the league's teams that aren't registered. « Désinscrire » with confirmation; 409: « Cette équipe a des matchs dans la saison. »
  - `StandingsTab`: columns « # », « Équipe », « J », « G », « N », « P », « BP », « BC », « Diff », « Pts ». Empty: « Aucun match terminé. »
  - Keys: `['season', seasonId, 'teams']`, `['season', seasonId, 'standings']`.

- [ ] **Step 1: Write the tests** — the dropdown only offers teams that aren't registered; registering calls `POST .../seasons/S1/teams/<teamId>`; unregister 409; the standings show a row with its 10 values; empty standings.
- [ ] **Step 2: Check it fails.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Check.**
- [ ] **Step 5: Commit** — `feat(admin): season page, registered teams and standings`

---

### Task 11: Squads

**Files:**
- Create: `admin/src/api/squad.ts`, `admin/src/features/squad/{SquadPage,JoinForm,TransferForm}.tsx`
- Modify: `admin/src/routes.tsx`
- Test: `SquadPage.test.tsx`

**Interfaces:**
- Produces:
  - `squad.ts`: `listSquad(leagueId, seasonId, teamId, all: boolean)` (`?all=true` if `all`), `joinSquad(leagueId, seasonId, teamId, { player_id, number, joined_on })`, `changeNumber(..., membershipId, number: number | null)`, `leaveSquad(..., membershipId, left_on)`, `transfer(leagueId, seasonId, { player_id, from_team_id, to_team_id, number, on })`.
  - Route `/leagues/:leagueId/seasons/:seasonId/teams/:teamId`.

Behaviour:
- Table: « N° », « Joueur », « Arrivée », « Départ », actions. « Afficher les départs » checkbox that passes `all=true`.
- « Ajouter un joueur »: search among `listPlayers(leagueId, q)`, optional « Numéro » (1 to 99), « Date d'arrivée » (default: today).
- Per row without a leave date: « Numéro », « Départ » (date, default today), « Transférer » (destination team among the registered teams except this one, optional number, date).
- 409 and 422 errors from these actions show the API's message.

- [ ] **Step 1: Write the tests** — joining with an empty number sends `number: null` and `joined_on` in `YYYY-MM-DD` format; changing the number sends `PATCH .../squad/<membershipId>`; leaving sends `{ left_on }`; transfer sends `POST .../seasons/S1/transfers` with `from_team_id` = current team, and the destination list doesn't contain the current team; the « Afficher les départs » checkbox triggers a request with `all=true`.
- [ ] **Step 2: Check it fails.**
- [ ] **Step 3: Implement.** After a transfer, invalidate the squads of both teams.
- [ ] **Step 4: Check.**
- [ ] **Step 5: Commit** — `feat(admin): squad management`

---

### Task 12: Matches

**Files:**
- Create: `admin/src/api/matches.ts`, `admin/src/features/matches/{matchActions.ts,MatchesTab.tsx,MatchForm.tsx,ScoreForm.tsx}`
- Modify: `admin/src/features/seasons/SeasonPage.tsx`, `admin/src/test/fixtures.ts`
- Test: `matchActions.test.ts`, `MatchesTab.test.tsx`

**Interfaces:**
- Consumes: `localToUtc`, `utcToLocal`, `formatDateTime`, `emptyToNull`, `listSeasonTeams`.
- Produces:
  - `matches.ts`: `listMatches(leagueId, seasonId, filters: { matchday?: string; status?: MatchStatus })`, `scheduleMatch(leagueId, seasonId, { home_team_id, away_team_id, matchday, kickoff_at, venue })`, `updateMatch(..., matchId, patch)`, `deleteMatch`, `startMatch`, `setScore(..., matchId, home, away)` (PUT), `finishMatch`, `postponeMatch(..., matchId, kickoff_at: string | null)`, `cancelMatch`.
  - `type MatchAction = 'start' | 'score' | 'finish' | 'postpone' | 'cancel' | 'reschedule' | 'details' | 'delete'`
  - `matchActions(status: MatchStatus): MatchAction[]`
  - `STATUS_LABELS: Record<MatchStatus, string>`: « Programmé », « En cours », « Terminé », « Reporté », « Annulé ».

Action table, taken from the API's state machine:

| Status | Actions |
|---|---|
| `scheduled` | `start`, `reschedule`, `details`, `postpone`, `cancel`, `delete` |
| `live` | `score`, `finish`, `details` |
| `postponed` | `reschedule`, `details`, `cancel` |
| `finished` | `details` |
| `cancelled` | none |

Labels: « Démarrer », « Score », « Terminer », « Reporter », « Annuler », « Reprogrammer », « Détails », « Supprimer ».

- `reschedule`: matchday and kickoff (`PATCH` with `matchday`, `kickoff_at`).
- `details`: venue, referee, call time, video link (`PATCH` with `venue`, `referee`, `convocation_at`, `video_url`). Empty field: missing key (`omitEmpty`).
- `postpone`: optional new date.
- `cancel`, `delete`, `finish`: confirmation.
- Filters at the top: « Journée » (number) and « Statut ». Table sorted by matchday then kickoff: « J », « Date », « Domicile », score, « Extérieur », « Statut », actions.
- « Programmer un match »: home and away among the registered teams, matchday (≥ 1), optional kickoff, optional venue. Same teams: « Les deux équipes doivent être différentes. », with no network call.
- After any action, invalidate `['season', seasonId, 'matches']` and `['season', seasonId, 'standings']`.

- [ ] **Step 1: Write the tests**

```ts
test.each([
  ['scheduled', ['start', 'reschedule', 'details', 'postpone', 'cancel', 'delete']],
  ['live', ['score', 'finish', 'details']],
  ['postponed', ['reschedule', 'details', 'cancel']],
  ['finished', ['details']],
  ['cancelled', []],
])('matchActions(%s)', (status, expected) => {
  expect(matchActions(status as MatchStatus)).toEqual(expected);
});
```

`MatchesTab.test.tsx`: a `live` match shows « Score » and « Terminer » but not « Démarrer »; entering 2–1 sends `PUT .../score` with `{ home: 2, away: 1 }`; scheduling without a kickoff or venue sends `kickoff_at: null, venue: null`; a kickoff entered as `2026-10-11T15:00` is sent equal to `localToUtc('2026-10-11T15:00')`; same teams blocks the submit; the status filter triggers a request with `status=live`; « Détails » with a venue filled in and an empty video link sends a body without a `video_url` key; a 409 error from the API on « Démarrer » is shown.

- [ ] **Step 2: Check it fails.**
- [ ] **Step 3: Implement and plug into `SeasonPage`.**
- [ ] **Step 4: Check.**
- [ ] **Step 5: Commit** — `feat(admin): match scheduling and lifecycle`

---

### Task 13: Build, integration and end-to-end check

**Files:**
- Create: `admin/README.md` (dev, test, build commands; value of `ADMIN_URL`)

This task is done with the API and the mobile app running locally.

- [x] **Step 1: Build** — Run: `npm test -- --run && npx tsc --noEmit && npm run build`. Expected: everything passes, `admin/dist/index.html` exists.
- [ ] **Step 2: Check** that `admin/dist` exists so the API session can wire `admin/embed.go` and `GET /admin/*`. Ask it about the state of the spec's missing endpoints, and how to get a superadmin account locally (`SUPERADMIN_EMAIL`).
- [ ] **Step 3: Check in dev** — API running on `:8080`, `npm run dev`, open `http://localhost:5173/admin/`. Sign in as superadmin. Go through every screen. Note any gap between the proposed contract and the real API, then fix it on the webapp side or the API side.
- [ ] **Step 4: Create the data set through the webapp** — one league, a 2026-2027 season, 6 registered teams, 8 players per team with numbers, 3 matchdays of matches: the first finished with scores, one match in progress, one postponed, one cancelled, the rest scheduled. A video link on a finished match.
- [ ] **Step 5: Check the mobile app** — give the app the id of the league created (the app reads `LEAGUE_ID` in `src/config.ts`). Check the Suivi, Classement, Équipe and Match screens against the data entered: scores, standings, squads, statuses, video link. Each gap is attributed to the webapp, the API or the app, and fixed by the session concerned.
- [x] **Step 6: Check the binary** — once the embed handler is in place: Go build, open `http://localhost:8080/admin/`, reload on a deep link, sign in.
- [x] **Step 7: Commit** — `docs(admin): README`
