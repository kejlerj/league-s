# Webapp admin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un back-office web (login admin et superadmin) pour gérer ligues, équipes, joueurs, saisons, effectifs, matchs et admins, embarqué dans le binaire Go sous `/admin/`.

**Architecture:** SPA Vite + React dans `admin/` du repo Go. Un client `fetch` typé parle à `/api/v1` sur la même origine avec le cookie `session`. TanStack Query porte l'état serveur, un `SessionProvider` porte l'utilisateur courant et les gardes de routes.

**Tech Stack:** Vite, React 19, TypeScript strict, Tailwind v4 (`@tailwindcss/vite`), React Router v7 (`react-router`), TanStack Query v5, Vitest, Testing Library, MSW v2.

**Spec:** `docs/admin/2026-10-10-admin-webapp-design.md`

## Global Constraints

- Tout le code va dans `admin/`. Aucun fichier hors de ce dossier n'est créé ni modifié dans ce repo. `admin/embed.go`, `internal/server/routes.go` et le `.gitignore` racine relèvent de l'API.
- Le repo Go a du travail non commité sur `feat/auth`. Chaque commit se fait avec un pathspec : `git add admin && git commit -m "<msg>" -- admin`. Jamais de `git add -A`, `git stash`, `git checkout` ni changement de branche dans ce repo.
- Aucun commentaire dans le code.
- Interface en français. Aucun texte anglais visible, y compris les messages d'erreur connus.
- `base: '/admin/'` dans Vite, `basename: '/admin'` dans le routeur, API sous `/api/v1`.
- `fetch` avec `credentials: 'same-origin'`. Aucun jeton dans `localStorage` ou `sessionStorage`.
- JSON en snake_case tel que l'API le renvoie : les types TypeScript gardent les noms `league_id`, `start_on`, etc.
- Dates-heures en UTC RFC 3339, dates simples `YYYY-MM-DD`.
- Chaque segment d'URL dynamique passe par `seg()`.
- Mot de passe : 10 caractères minimum, 72 octets maximum.
- L'API refuse les champs inconnus (`DisallowUnknownFields`) : n'envoyer que les champs listés dans la spec. Un corps « vide » s'envoie comme `{}`.
- Deux formes d'erreur : `{"error": "message"}` et, pour la validation des champs (422), `{"errors": {"<champ>": "<message>"}}`, le message (en français) s'affiche sous le champ.
- Création : un champ optionnel vide part en `null`. Modification (`PATCH`) : un champ optionnel vide n'est pas envoyé du tout. Vider un champ existant n'est pas possible en v1.
- `admin/dist` n'est pas versionné, sauf `admin/dist/.gitkeep`. Le fichier source est `admin/public/.gitkeep`, que Vite recopie dans `dist` à chaque build.
- Toutes les commandes `npm` se lancent depuis `admin/`. Vérification de fin de tâche : `npm test -- --run && npx tsc --noEmit`.

## Review Focus

1. **Session expirée pendant une saisie** : un 401 sur une écriture renvoie au login, puis ramène à la page d'origine. Testé en Task 4.
2. **Champs optionnels vides** : un logo, une icône, un lieu ou un numéro laissé vide ne part jamais en `""` (l'API rejette `""` comme URL) : `null` en création, clé absente en modification. Testé en Task 6 et Task 12.
3. **Fuseaux horaires** : un coup d'envoi saisi à 15:00 heure locale part en UTC et se réaffiche à 15:00. Testé en Task 2.
4. **Double clic sur un bouton d'envoi** : une seule requête part. Testé en Task 3.
5. **Lien profond rechargé** : `/admin/leagues/x/seasons/y` ouvert directement fonctionne pour un admin de la ligue et affiche « Accès refusé » pour un autre. Testé en Task 4.

---

## File Structure

```
admin/
  .gitignore                 node_modules, dist
  package.json, tsconfig.json, vite.config.ts, index.html
  src/
    main.tsx                 montage, QueryClient, routeur
    routes.tsx               table des routes
    index.css                import Tailwind
    api/
      client.ts              api(), seg(), ApiError, onUnauthorized
      types.ts               types des ressources
      auth.ts leagues.ts teams.ts players.ts seasons.ts squad.ts matches.ts admins.ts
    lib/
      dates.ts               conversions date et date-heure
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
      server.ts    serveur MSW
      fixtures.ts  données de test
      render.tsx   renderRoute()
      setup.ts
```

Chaque fichier de test est à côté du fichier testé : `X.test.ts(x)`.

---

### Task 1: Socle du projet

**Files:**
- Create: `admin/package.json`, `admin/.gitignore`, `admin/tsconfig.json`, `admin/vite.config.ts`, `admin/index.html`, `admin/src/main.tsx`, `admin/src/index.css`, `admin/src/routes.tsx`
- Create: `admin/src/test/setup.ts`, `admin/src/test/server.ts`, `admin/src/test/fixtures.ts`, `admin/src/test/render.tsx`
- Test: `admin/src/test/render.test.tsx`

**Interfaces:**
- Produces:
  - `routes: RouteObject[]` dans `src/routes.tsx` (une route `/` provisoire qui affiche « Admin »).
  - `server` (MSW `setupServer`) dans `src/test/server.ts`, démarré dans `setup.ts` avec `onUnhandledRequest: 'error'`.
  - `renderRoute(path: string): { user: UserEvent }` dans `src/test/render.tsx` : monte `routes` dans un `createMemoryRouter` avec `basename` absent, un `QueryClient` neuf (`retry: false`), et le `SessionProvider` dès qu'il existe (Task 4).
  - `API = '/api/v1'` exporté par `src/test/server.ts` pour écrire les handlers.

- [ ] **Step 1: Créer le projet**

`npm create vite@latest admin -- --template react-ts` depuis la racine du repo Go, puis dans `admin/` : `npm i react-router @tanstack/react-query` et `npm i -D tailwindcss @tailwindcss/vite vitest jsdom @testing-library/react @testing-library/user-event @testing-library/jest-dom msw`. Supprimer les fichiers de démo du gabarit (`App.tsx`, `App.css`, `assets/`).

- [ ] **Step 2: Configurer**

`vite.config.ts` : `base: '/admin/'`, plugins `react()` et `tailwindcss()`, `server.proxy = { '/api': 'http://localhost:8080' }`, `test = { environment: 'jsdom', setupFiles: './src/test/setup.ts', globals: true }`. `tsconfig` : `strict: true`, alias `@/*` vers `src/*` (aussi dans `resolve.alias`). `index.html` : `lang="fr"`, titre « Ligue — Admin ». `.gitignore` : `node_modules`, `dist/*`, `!dist/.gitkeep`. Créer `public/.gitkeep` vide. Script `"test": "vitest"`.

- [ ] **Step 3: Écrire le test du harnais**

```tsx
test('renderRoute affiche la route demandée', async () => {
  renderRoute('/');
  expect(await screen.findByText('Admin')).toBeInTheDocument();
});
```

- [ ] **Step 4: Écrire `main.tsx`, `routes.tsx`, et les fichiers de `src/test/`**

`main.tsx` crée le routeur avec `createBrowserRouter(routes, { basename: '/admin' })`.

- [ ] **Step 5: Vérifier**

Run: `npm test -- --run && npx tsc --noEmit && npm run build`
Expected: 1 test passe, aucun type en erreur, `dist/index.html` référence des fichiers sous `/admin/assets/`, `dist/.gitkeep` existe.

- [ ] **Step 6: Commit**

`git add admin && git commit -m "feat(admin): scaffold Vite React app" -- admin`

---

### Task 2: Client API, types et conversions

**Files:**
- Create: `admin/src/api/client.ts`, `admin/src/api/types.ts`, `admin/src/lib/dates.ts`, `admin/src/lib/form.ts`
- Test: `admin/src/api/client.test.ts`, `admin/src/lib/dates.test.ts`, `admin/src/lib/form.test.ts`

**Interfaces:**
- Produces:
  - `class ApiError extends Error { readonly status: number; readonly fields: Record<string, string> | null }`, constructeur `(status, message, fields = null)` — `message` vaut le champ `error` de la réponse, ou `HTTP <status>` s'il manque. `fields` vaut le champ `errors` s'il est présent. Panne réseau : `status === 0`.
  - `api<T>(method: 'GET'|'POST'|'PUT'|'PATCH'|'DELETE', path: string, opts?: { body?: unknown; query?: Record<string, string | undefined> }): Promise<T>` — préfixe `/api/v1`, renvoie `undefined` sur 204.
  - `seg(value: string): string` — `encodeURIComponent`.
  - `onUnauthorized(handler: () => void): void` — appelé sur tout 401 sauf pour `GET /me` et `POST /auth/login`.
  - `dates.ts` : `dateToUtc(d: string): string` (`'2026-09-01'` → `'2026-09-01T00:00:00Z'`), `utcToDate(iso: string): string`, `localToUtc(v: string): string` (`'YYYY-MM-DDTHH:mm'` local → ISO UTC), `utcToLocal(iso: string): string`, `formatDateTime(iso: string | null): string` (fr-FR, `'—'` si `null`).
  - `form.ts` : `emptyToNull(v: string): string | null` (trim), `toInt(v: string): number | null`, `omitEmpty<T extends Record<string, unknown>>(o: T): Partial<T>` (retire les clés dont la valeur est `null`, `undefined` ou `''`).
  - `types.ts` : `User {id,email,name,is_superadmin}`, `Me = User & {leagues: {id,name}[]}`, `League {id,name,logo}`, `Team {id,league_id,name,logo}`, `Player {id,league_id,firstname,lastname,icon}`, `TieBreaker`, `Season`, `SeasonTeam {id,name,logo}`, `SquadMember`, `MatchStatus = 'scheduled'|'live'|'finished'|'postponed'|'cancelled'`, `Match`, `StandingRow`, `LeagueAdmin {id,email,name}`, `Invitation {id,email,expires_at}`, `InvitationPreview {email, league:{id,name}, account_exists}`. Champs exacts : section « Ressources existantes » de la spec. Tout champ optionnel de l'API est `T | null`.

- [ ] **Step 1: Écrire les tests**

```ts
test('api préfixe /api/v1, ajoute la query et ignore les valeurs undefined', async () => {
  let url = '';
  server.use(http.get(`${API}/x`, ({ request }) => { url = request.url; return HttpResponse.json([]); }));
  await api('GET', '/x', { query: { a: '1', b: undefined } });
  expect(new URL(url).search).toBe('?a=1');
});
test('api renvoie undefined sur 204', async () => {
  server.use(http.post(`${API}/x`, () => new HttpResponse(null, { status: 204 })));
  expect(await api('POST', '/x')).toBeUndefined();
});
test('api convertit {error} en ApiError', async () => {
  server.use(http.post(`${API}/x`, () => HttpResponse.json({ error: 'nope' }, { status: 409 })));
  await expect(api('POST', '/x')).rejects.toMatchObject({ status: 409, message: 'nope' });
});
test('api expose les erreurs de champs', async () => {
  server.use(http.post(`${API}/x`, () => HttpResponse.json({ errors: { name: 'required' } }, { status: 422 })));
  await expect(api('POST', '/x')).rejects.toMatchObject({ status: 422, fields: { name: 'required' } });
});
test('panne réseau donne status 0', async () => {
  server.use(http.get(`${API}/x`, () => HttpResponse.error()));
  await expect(api('GET', '/x')).rejects.toMatchObject({ status: 0 });
});
test('401 appelle onUnauthorized, sauf pour /me et /auth/login', async () => {
  const spy = vi.fn(); onUnauthorized(spy);
  const r401 = () => HttpResponse.json({ error: 'x' }, { status: 401 });
  server.use(http.get(`${API}/me`, r401), http.post(`${API}/auth/login`, r401), http.post(`${API}/leagues`, r401));
  await api('GET', '/me').catch(() => {});
  await api('POST', '/auth/login').catch(() => {});
  expect(spy).not.toHaveBeenCalled();
  await api('POST', '/leagues').catch(() => {});
  expect(spy).toHaveBeenCalledTimes(1);
});
test('seg encode les caractères réservés', () => { expect(seg('a/b?c')).toBe('a%2Fb%3Fc'); });
```

```ts
test('dateToUtc / utcToDate', () => {
  expect(dateToUtc('2026-09-01')).toBe('2026-09-01T00:00:00Z');
  expect(utcToDate('2026-09-01T00:00:00Z')).toBe('2026-09-01');
});
test('localToUtc et utcToLocal sont inverses', () => {
  expect(utcToLocal(localToUtc('2026-10-11T15:00'))).toBe('2026-10-11T15:00');
});
test('formatDateTime(null) rend un tiret', () => { expect(formatDateTime(null)).toBe('—'); });
```

```ts
test('emptyToNull', () => { expect(emptyToNull('  ')).toBeNull(); expect(emptyToNull(' a ')).toBe('a'); });
test('toInt', () => { expect(toInt('')).toBeNull(); expect(toInt('7')).toBe(7); expect(toInt('x')).toBeNull(); });
test('omitEmpty', () => { expect(omitEmpty({ a: 'x', b: null, c: '', d: 0 })).toEqual({ a: 'x', d: 0 }); });
```

- [ ] **Step 2: Vérifier l'échec** — Run: `npm test -- --run`. Expected: FAIL, modules introuvables.
- [ ] **Step 3: Implémenter les quatre fichiers.**
- [ ] **Step 4: Vérifier** — Run: `npm test -- --run && npx tsc --noEmit`. Expected: PASS.
- [ ] **Step 5: Commit** — `feat(admin): API client, types and date helpers`

---

### Task 3: Composants d'interface et erreurs

**Files:**
- Create: `admin/src/ui/{Button,Field,Modal,ConfirmDialog,DataTable,PageState,Tabs}.tsx`, `admin/src/ui/errorMessage.ts`, `admin/src/ui/useSubmit.ts`
- Test: `admin/src/ui/errorMessage.test.ts`, `admin/src/ui/useSubmit.test.tsx`, `admin/src/ui/ConfirmDialog.test.tsx`

**Interfaces:**
- Consumes: `ApiError` (Task 2).
- Produces:
  - `errorMessage(err: unknown, overrides?: Record<number, string>): string` — ordre : si `err.fields`, `'Champs invalides : '` suivi de `<champ> (<texte>)` séparés par des virgules, avec les textes `required` « obligatoire », `email` « e-mail invalide », `http_url` « URL http ou https attendue », `min` « trop petit », `max` « trop grand », autre règle « invalide » ; puis `overrides[status]` ; status 0 ou ≥ 500 → `'Une erreur est survenue. Réessayez.'` ; 403 → `'Accès refusé.'` ; 429 → `'Trop de tentatives. Réessayez dans une minute.'` ; sinon `err.message`.
  - `useSubmit<A extends unknown[]>(fn: (...a: A) => Promise<unknown>, overrides?: Record<number, string>): { submit: (...a: A) => Promise<boolean>; pending: boolean; error: string | null }` — ignore un appel pendant qu'un autre est en cours ; `submit` résout `true` si réussi.
  - `Button({ variant?: 'primary'|'secondary'|'danger', pending?: boolean, ...buttonProps })` — désactivé quand `pending`.
  - `Field({ label, error?, ...inputProps })` — `<label>` lié à l'`<input>`.
  - `Modal({ title, open, onClose, children })` — `role="dialog"`, `aria-label={title}`, fermeture sur Échap.
  - `ConfirmDialog({ open, title, message, confirmLabel, onConfirm: () => Promise<unknown>, onClose, errorOverrides? })` — affiche l'erreur dans la boîte et reste ouvert si `onConfirm` échoue.
  - `DataTable<T>({ rows, columns: { header: string; cell: (row: T) => ReactNode }[], rowKey: (row: T) => string, empty: string })`.
  - `PageState({ query, children })` — pour un résultat TanStack Query : « Chargement… », ou message d'erreur + bouton « Réessayer » (`query.refetch`), ou `children(data)`. Un 404 affiche « Introuvable. » sans bouton.
  - `Tabs({ tabs: { id: string; label: string; content: ReactNode }[] })` — onglet actif dans le paramètre d'URL `?tab=`.

- [ ] **Step 1: Écrire les tests**

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
test('useSubmit ignore le second appel tant que le premier est en cours', async () => {
  let release!: () => void;
  const fn = vi.fn(() => new Promise<void>((r) => { release = r; }));
  const { result } = renderHook(() => useSubmit(fn));
  act(() => { void result.current.submit(); void result.current.submit(); });
  expect(fn).toHaveBeenCalledTimes(1);
  await act(async () => { release(); });
  expect(result.current.pending).toBe(false);
});
test('useSubmit expose le message et résout false en cas d\'échec', async () => {
  const { result } = renderHook(() => useSubmit(() => Promise.reject(new ApiError(409, 'pris'))));
  let ok = true;
  await act(async () => { ok = await result.current.submit(); });
  expect(ok).toBe(false);
  expect(result.current.error).toBe('pris');
});
```

```tsx
test('ConfirmDialog reste ouvert et montre l\'erreur si onConfirm échoue', async () => {
  const onClose = vi.fn();
  render(<ConfirmDialog open title="Supprimer" message="Sûr ?" confirmLabel="Supprimer"
    onConfirm={() => Promise.reject(new ApiError(409, 'x'))} onClose={onClose}
    errorOverrides={{ 409: 'Cette ligue a un historique.' }} />);
  await userEvent.click(screen.getByRole('button', { name: 'Supprimer' }));
  expect(await screen.findByText('Cette ligue a un historique.')).toBeInTheDocument();
  expect(onClose).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Vérifier l'échec.**
- [ ] **Step 3: Implémenter.** Style Tailwind sobre : fond neutre, une couleur d'accent, tableaux lisibles, focus visible.
- [ ] **Step 4: Vérifier** — `npm test -- --run && npx tsc --noEmit`.
- [ ] **Step 5: Commit** — `feat(admin): UI primitives and error mapping`

---

### Task 4: Session, gardes, connexion et gabarit

**Files:**
- Create: `admin/src/api/auth.ts`, `admin/src/auth/SessionProvider.tsx`, `admin/src/auth/guards.tsx`, `admin/src/ui/Layout.tsx`, `admin/src/features/auth/LoginPage.tsx`
- Modify: `admin/src/routes.tsx`, `admin/src/main.tsx`, `admin/src/test/render.tsx`, `admin/src/test/fixtures.ts`
- Test: `admin/src/auth/guards.test.tsx`, `admin/src/features/auth/LoginPage.test.tsx`

**Interfaces:**
- Consumes: `api`, `onUnauthorized`, `errorMessage`, `useSubmit`, `Field`, `Button`.
- Produces:
  - `auth.ts` : `login(email, password): Promise<User>`, `logout(): Promise<void>`, `getMe(): Promise<Me>`, `changePassword(current_password, new_password)`, `requestPasswordReset(email)`, `confirmPasswordReset(token, password)`.
  - `useSession(): { me: Me | null; loading: boolean; isSuperadmin: boolean; canWrite(leagueId: string): boolean; refresh(): Promise<void>; clear(): void }` — `canWrite` vrai si superadmin ou si `leagueId` est dans `me.leagues`.
  - `RequireAuth` : pendant le chargement « Chargement… » ; sans session, `<Navigate to="/login" state={{ from: location }} replace />` ; sinon `<Layout><Outlet /></Layout>`.
  - `RequireLeague` : lit `:leagueId`, rend « Accès refusé. » si `!canWrite(leagueId)`, sinon `<Outlet />`.
  - `Layout` : en-tête avec lien « Ligues » (`/`), nom de l'utilisateur, lien « Mon compte » (`/account`), bouton « Déconnexion ».
  - `SessionProvider` enregistre `onUnauthorized(() => clear())` : `RequireAuth` redirige alors vers `/login` avec `state.from`.
  - Fixtures : `superadmin: Me`, `adminOne: Me` (une ligue, id `L1`), `adminTwo: Me` (ligues `L1` et `L2`), et `mockMe(me: Me | null)` qui installe le handler `GET /me` (401 si `null`).
  - `renderRoute(path, { me?: Me | null })` appelle `mockMe` (défaut `superadmin`).
  - Routes ajoutées : `/login` (public), et un parent `RequireAuth` avec `/` provisoire, puis `/leagues/:leagueId` sous `RequireLeague` (contenu provisoire « Ligue »).

- [ ] **Step 1: Écrire les tests**

```tsx
test('sans session, / redirige vers la connexion', async () => {
  renderRoute('/', { me: null });
  expect(await screen.findByRole('heading', { name: 'Connexion' })).toBeInTheDocument();
});
test('un admin d\'une autre ligue voit Accès refusé sur un lien profond', async () => {
  renderRoute('/leagues/L2', { me: adminOne });
  expect(await screen.findByText('Accès refusé.')).toBeInTheDocument();
});
test('un superadmin accède à n\'importe quelle ligue', async () => {
  renderRoute('/leagues/L9', { me: superadmin });
  expect(await screen.findByText('Ligue')).toBeInTheDocument();
});
test('un 401 sur une écriture renvoie au login puis ramène à la page', async () => {
  // rendre /leagues/L1 en adminOne, déclencher api('POST', '/leagues/L1/teams') répondant 401,
  // attendre le titre Connexion, basculer mockMe(adminOne), se connecter,
  // puis attendre le texte « Ligue ».
});
```

```tsx
test('connexion réussie ramène à la page demandée', async () => {
  // me: null, route /leagues/L1 ; POST /auth/login → 200 puis mockMe(adminOne)
  // saisir e-mail et mot de passe, cliquer « Se connecter », attendre « Ligue »
});
test('identifiants faux', async () => {
  // POST /auth/login → 401 ; attendre « E-mail ou mot de passe incorrect. »
});
test('trop de tentatives', async () => {
  // POST /auth/login → 429 ; attendre « Trop de tentatives. Réessayez dans une minute. »
});
```

Les trois tests décrits en commentaire s'écrivent en entier avec `server.use`, `user.type`, `user.click` et les libellés donnés.

- [ ] **Step 2: Vérifier l'échec.**
- [ ] **Step 3: Implémenter.** `LoginPage` : champs « E-mail » et « Mot de passe », bouton « Se connecter », lien « Mot de passe oublié ? » vers `/forgot-password`. Après `login()`, appeler `refresh()` puis naviguer vers `state.from` ou `/`. Override d'erreur `{ 401: 'E-mail ou mot de passe incorrect.' }`. La déconnexion appelle `logout()`, `clear()`, puis vide le cache TanStack Query.
- [ ] **Step 4: Vérifier.**
- [ ] **Step 5: Commit** — `feat(admin): session, route guards and login`

---

### Task 5: Pages de mot de passe

**Files:**
- Create: `admin/src/features/auth/{ForgotPasswordPage,ResetPasswordPage,AccountPage}.tsx`
- Modify: `admin/src/routes.tsx`
- Test: un fichier `.test.tsx` par page

**Interfaces:**
- Consumes: fonctions de `api/auth.ts`, `useSubmit`, `Field`, `Button`.
- Produces: routes `/forgot-password` et `/reset-password` (publiques), `/account` (sous `RequireAuth`).

Textes fixes :
- Oubli : après envoi, toujours « Si un compte existe pour cette adresse, un e-mail vient d'être envoyé. »
- Réinitialisation : lit `?token=`. Sans jeton, ou sur 400 : « Lien invalide ou expiré. » Sur 422 : « Le mot de passe doit contenir au moins 10 caractères. » Succès : « Mot de passe modifié. » et lien « Se connecter ».
- Compte : champs « Mot de passe actuel », « Nouveau mot de passe », « Confirmation ». Confirmation différente : « Les mots de passe ne correspondent pas. », sans appel réseau. 403 : « Mot de passe actuel incorrect. » 422 : même message que ci-dessus. Succès : « Mot de passe modifié. »
- Les champs de nouveau mot de passe ont `minLength={10}`.

- [ ] **Step 1: Écrire les tests** — un test par texte fixe ci-dessus (8 tests), chacun avec le handler MSW qui renvoie le statut concerné et une assertion `findByText` sur le texte exact. Pour la confirmation différente, vérifier en plus qu'aucune requête `PUT /me/password` n'est partie.
- [ ] **Step 2: Vérifier l'échec.**
- [ ] **Step 3: Implémenter les trois pages.**
- [ ] **Step 4: Vérifier.**
- [ ] **Step 5: Commit** — `feat(admin): password reset and account pages`

---

### Task 6: Ligues

**Files:**
- Create: `admin/src/api/leagues.ts`, `admin/src/features/leagues/{LeaguesPage,LeagueForm,LeaguePage}.tsx`
- Modify: `admin/src/routes.tsx`, `admin/src/test/fixtures.ts`
- Test: `admin/src/features/leagues/LeaguesPage.test.tsx`, `LeaguePage.test.tsx`

**Interfaces:**
- Consumes: `useSession`, `Tabs`, `DataTable`, `Modal`, `ConfirmDialog`, `PageState`, `emptyToNull`.
- Produces:
  - `leagues.ts` : `listLeagues(): Promise<League[]>`, `getLeague(id)`, `createLeague({name, logo})`, `updateLeague(id, {name?, logo?})` (PATCH, passé par `omitEmpty`), `deleteLeague(id)`.
  - Clés de requête, convention pour tout le plan : `['leagues']`, `['league', leagueId]`, puis `['league', leagueId, '<ressource>']` et `['season', seasonId, '<ressource>']`.
  - `LeagueForm({ initial?: League, onDone })` : champs « Nom » (requis, 50 max) et « Logo (URL) ».
  - `LeaguePage` : titre = nom de la ligue, bouton « Modifier », et `Tabs` avec les identifiants `teams`, `players`, `seasons`, `admins`. Les contenus sont des emplacements vides remplis par les tâches 7 à 9.
  - Fixtures : `leagueL1`, `leagueL2`.

Comportement :
- Superadmin : liste de `GET /leagues`, bouton « Nouvelle ligue », bouton « Supprimer » par ligne avec confirmation. 409 : « Cette ligue a un historique. »
- Admin : liste de `me.leagues`, sans appel à `GET /leagues`, sans boutons de création ni de suppression.
- Admin avec une seule ligue : `/` redirige vers `/leagues/<id>`.

- [ ] **Step 1: Écrire les tests**

```tsx
test('un admin à une ligue est redirigé dedans', async () => { /* adminOne sur '/', attendre le titre leagueL1.name */ });
test('un admin à deux ligues voit ses ligues, sans bouton Nouvelle ligue', async () => { /* adminTwo */ });
test('le superadmin crée une ligue ; un logo vide part en null', async () => {
  // capturer le corps de POST /leagues ; saisir seulement le nom ;
  // expect(body).toEqual({ name: 'Ligue Test', logo: null })
});
test('suppression refusée affiche Cette ligue a un historique.', async () => { /* DELETE → 409 */ });
test('LeaguePage affiche les quatre onglets', async () => { /* Équipes, Joueurs, Saisons, Admins */ });
test('ligue inconnue affiche Introuvable.', async () => { /* GET /leagues/L1 → 404 */ });
```

- [ ] **Step 2: Vérifier l'échec.**
- [ ] **Step 3: Implémenter.** Après chaque écriture, invalider `['leagues']` ; après création ou suppression par un superadmin, appeler aussi `refresh()` de la session.
- [ ] **Step 4: Vérifier.**
- [ ] **Step 5: Commit** — `feat(admin): leagues list and league page`

---

### Task 7: Équipes et joueurs

**Files:**
- Create: `admin/src/api/teams.ts`, `admin/src/api/players.ts`, `admin/src/features/teams/{TeamsTab,TeamForm}.tsx`, `admin/src/features/players/{PlayersTab,PlayerForm}.tsx`
- Modify: `admin/src/features/leagues/LeaguePage.tsx`, `admin/src/test/fixtures.ts`
- Test: `TeamsTab.test.tsx`, `PlayersTab.test.tsx`

**Interfaces:**
- Produces:
  - `teams.ts` : `listTeams(leagueId)`, `createTeam(leagueId, {name, logo})`, `updateTeam(leagueId, teamId, {name?, logo?})`, `deleteTeam(leagueId, teamId)`.
  - `players.ts` : `listPlayers(leagueId, q?: string)` (`GET /leagues/{id}/players?q=`), `createPlayer(leagueId, {firstname, lastname, icon})`, `updatePlayer(...)`, `deletePlayer(...)`.
  - `TeamsTab({ leagueId })`, `PlayersTab({ leagueId })`.
  - Fixtures : `teamA`, `teamB`, `playerP1`, `playerP2`.

Comportement : tableau, bouton « Nouvelle équipe » / « Nouveau joueur », « Modifier » et « Supprimer » par ligne. Suppression 409 : « Cette équipe a un historique. » / « Ce joueur a un historique. » Joueurs : champ « Rechercher » qui renvoie `q` après 300 ms sans frappe. Champs : « Nom » + « Logo (URL) » ; « Prénom », « Nom », « Photo (URL) ».

- [ ] **Step 1: Écrire les tests** — pour chaque onglet : liste affichée ; création envoie le bon corps avec champ URL vide en `null` ; modification envoie un PATCH sur le bon chemin, sans la clé du champ URL s'il est vide ; suppression 409 affiche le texte fixe. Pour les joueurs en plus : taper « dup » déclenche une requête avec `q=dup`.
- [ ] **Step 2: Vérifier l'échec.**
- [ ] **Step 3: Implémenter et brancher dans `LeaguePage`.**
- [ ] **Step 4: Vérifier.**
- [ ] **Step 5: Commit** — `feat(admin): teams and players management`

---

### Task 8: Saisons

**Files:**
- Create: `admin/src/api/seasons.ts`, `admin/src/features/seasons/{SeasonsTab,SeasonForm}.tsx`
- Modify: `admin/src/features/leagues/LeaguePage.tsx`, `admin/src/test/fixtures.ts`
- Test: `SeasonsTab.test.tsx`

**Interfaces:**
- Consumes: `dateToUtc`, `utcToDate`.
- Produces:
  - `seasons.ts` : `listSeasons(leagueId)`, `getSeason(leagueId, seasonId)`, `createSeason(leagueId, input)`, `updateSeason(leagueId, seasonId, input)`, `deleteSeason(...)`, `listSeasonTeams(leagueId, seasonId): Promise<SeasonTeam[]>`, `addSeasonTeam(leagueId, seasonId, teamId)`, `removeSeasonTeam(...)`.
  - `SeasonInput = { name; start_on; end_on; match_win_pts; match_draw_pts; match_loss_pts; tie_breakers: TieBreaker[] }`.
  - `TIE_BREAKER_LABELS: Record<TieBreaker, string>` : `goal_difference` « Différence de buts », `goals_scored` « Buts marqués », `head_to_head` « Confrontations directes », `fair_play` « Fair-play », `random` « Tirage au sort ».
  - `SeasonsTab({ leagueId })` : chaque nom de saison est un lien vers `/leagues/:leagueId/seasons/:seasonId`.
  - Fixture : `seasonS1`.

Comportement : valeurs par défaut du formulaire 3 / 1 / 0 points et départages `goal_difference`, `goals_scored`. Les départages sont une liste ordonnée : cases à cocher, l'ordre d'envoi est l'ordre de sélection. Date de fin antérieure ou égale au début : « La fin doit être après le début. », sans appel réseau. Suppression 409 : « Cette saison a des matchs. »

- [ ] **Step 1: Écrire les tests**

```tsx
test('création envoie les dates en UTC et les valeurs par défaut', async () => {
  // saisir nom « 2026-2027 », début 2026-09-01, fin 2027-06-30
  // expect(body).toEqual({ name: '2026-2027', start_on: '2026-09-01T00:00:00Z', end_on: '2027-06-30T00:00:00Z',
  //   match_win_pts: 3, match_draw_pts: 1, match_loss_pts: 0, tie_breakers: ['goal_difference', 'goals_scored'] })
});
test('fin avant début bloque l\'envoi', async () => { /* texte fixe, aucune requête POST */ });
test('modification préremplit les dates', async () => { /* champ début vaut 2026-09-01 */ });
test('suppression 409', async () => { /* Cette saison a des matchs. */ });
```

- [ ] **Step 2: Vérifier l'échec.**
- [ ] **Step 3: Implémenter et brancher dans `LeaguePage`.**
- [ ] **Step 4: Vérifier.**
- [ ] **Step 5: Commit** — `feat(admin): seasons management`

---

### Task 9: Admins et invitations

**Files:**
- Create: `admin/src/api/admins.ts`, `admin/src/features/admins/{AdminsTab,AcceptInvitationPage}.tsx`
- Modify: `admin/src/features/leagues/LeaguePage.tsx`, `admin/src/routes.tsx`
- Test: `AdminsTab.test.tsx`, `AcceptInvitationPage.test.tsx`

**Interfaces:**
- Produces:
  - `admins.ts` : `listAdmins(leagueId): Promise<LeagueAdmin[]>`, `removeAdmin(leagueId, userId)`, `listInvitations(leagueId): Promise<Invitation[]>`, `invite(leagueId, email): Promise<Invitation & { link: string }>`, `cancelInvitation(leagueId, invitationId)`, `getInvitation(token): Promise<InvitationPreview>`, `acceptInvitation(token, body?: { name: string; password: string })` (envoie `{}` sans `body`).
  - Route publique `/invitations/:token`.

Comportement :
- `AdminsTab` : liste des admins pour tous. Pour le superadmin seulement : formulaire « Inviter un admin » (champ « E-mail »), liste « Invitations en attente » avec date d'expiration et bouton « Annuler », bouton « Retirer » par admin avec confirmation. Un admin simple n'appelle pas `GET .../invitations`.
- Invitation 409 : « Cette personne est déjà admin de la ligue. » Succès : « Invitation créée pour <email>. », le lien renvoyé (`link`) affiché dans un champ en lecture seule, et un bouton « Copier le lien ». Réinviter une adresse remplace l'invitation précédente : pas d'erreur à gérer.
- `AcceptInvitationPage` : titre « Rejoindre <nom de la ligue> », adresse invitée affichée. Si `account_exists` est faux : champs « Nom » et « Mot de passe » (`minLength={10}`), bouton « Créer mon compte ». Sinon : bouton « Rejoindre la ligue », corps de requête `{}`. Succès : « C'est fait. Vous pouvez vous connecter. » et lien vers `/login`. 400 ou 404 au chargement ou à l'envoi : « Lien invalide ou expiré. », sans formulaire. 422 : « Le mot de passe doit contenir au moins 10 caractères. »

- [ ] **Step 1: Écrire les tests** — `AdminsTab` : un admin simple voit la liste sans formulaire et aucune requête `invitations` ne part ; le superadmin invite, voit le message de succès et le lien renvoyé ; 409 ; annulation d'une invitation ; retrait d'un admin. `AcceptInvitationPage` : nouveau compte envoie `{name, password}` ; compte existant envoie `{}` ; 400 au chargement ; 422. Le jeton `a/b` est appelé sous `/invitations/a%2Fb`.
- [ ] **Step 2: Vérifier l'échec.**
- [ ] **Step 3: Implémenter.**
- [ ] **Step 4: Vérifier.**
- [ ] **Step 5: Commit** — `feat(admin): league admins and invitations`

---

### Task 10: Page saison, équipes inscrites et classement

**Files:**
- Create: `admin/src/api/standings.ts`, `admin/src/features/seasons/{SeasonPage,SeasonTeamsTab,StandingsTab}.tsx`
- Modify: `admin/src/routes.tsx`
- Test: `SeasonPage.test.tsx`

**Interfaces:**
- Consumes: `listSeasonTeams`, `addSeasonTeam`, `removeSeasonTeam`, `listTeams`.
- Produces:
  - `getStandings(leagueId, seasonId): Promise<StandingRow[]>`.
  - Route `/leagues/:leagueId/seasons/:seasonId` sous `RequireLeague`.
  - `SeasonPage` : lien de retour vers la ligue, nom de la saison, `Tabs` avec `teams`, `matches`, `standings`. L'onglet `matches` est rempli en Task 12.
  - `SeasonTeamsTab({ leagueId, seasonId })` : liste des équipes inscrites, chaque nom étant un lien vers `.../teams/:teamId` (effectif). Liste déroulante « Inscrire une équipe » limitée aux équipes de la ligue non inscrites. « Désinscrire » avec confirmation ; 409 : « Cette équipe a des matchs dans la saison. »
  - `StandingsTab` : colonnes « # », « Équipe », « J », « G », « N », « P », « BP », « BC », « Diff », « Pts ». Vide : « Aucun match terminé. »
  - Clés : `['season', seasonId, 'teams']`, `['season', seasonId, 'standings']`.

- [ ] **Step 1: Écrire les tests** — la liste déroulante ne propose que les équipes non inscrites ; l'inscription appelle `POST .../seasons/S1/teams/<teamId>` ; désinscription 409 ; le classement affiche une ligne avec ses 10 valeurs ; classement vide.
- [ ] **Step 2: Vérifier l'échec.**
- [ ] **Step 3: Implémenter.**
- [ ] **Step 4: Vérifier.**
- [ ] **Step 5: Commit** — `feat(admin): season page, registered teams and standings`

---

### Task 11: Effectifs

**Files:**
- Create: `admin/src/api/squad.ts`, `admin/src/features/squad/{SquadPage,JoinForm,TransferForm}.tsx`
- Modify: `admin/src/routes.tsx`
- Test: `SquadPage.test.tsx`

**Interfaces:**
- Produces:
  - `squad.ts` : `listSquad(leagueId, seasonId, teamId, all: boolean)` (`?all=true` si `all`), `joinSquad(leagueId, seasonId, teamId, { player_id, number, joined_on })`, `changeNumber(..., membershipId, number: number | null)`, `leaveSquad(..., membershipId, left_on)`, `transfer(leagueId, seasonId, { player_id, from_team_id, to_team_id, number, on })`.
  - Route `/leagues/:leagueId/seasons/:seasonId/teams/:teamId`.

Comportement :
- Tableau : « N° », « Joueur », « Arrivée », « Départ », actions. Case « Afficher les départs » qui passe `all=true`.
- « Ajouter un joueur » : recherche parmi `listPlayers(leagueId, q)`, « Numéro » optionnel (1 à 99), « Date d'arrivée » (défaut : aujourd'hui).
- Par ligne sans départ : « Numéro », « Départ » (date, défaut aujourd'hui), « Transférer » (équipe de destination parmi les équipes inscrites sauf celle-ci, numéro optionnel, date).
- Les erreurs 409 et 422 de ces actions affichent le message de l'API.

- [ ] **Step 1: Écrire les tests** — entrée avec numéro vide envoie `number: null` et `joined_on` au format `YYYY-MM-DD` ; changement de numéro envoie `PATCH .../squad/<membershipId>` ; départ envoie `{ left_on }` ; transfert envoie `POST .../seasons/S1/transfers` avec `from_team_id` = équipe courante, et la liste de destination ne contient pas l'équipe courante ; la case « Afficher les départs » déclenche une requête avec `all=true`.
- [ ] **Step 2: Vérifier l'échec.**
- [ ] **Step 3: Implémenter.** Après un transfert, invalider les effectifs des deux équipes.
- [ ] **Step 4: Vérifier.**
- [ ] **Step 5: Commit** — `feat(admin): squad management`

---

### Task 12: Matchs

**Files:**
- Create: `admin/src/api/matches.ts`, `admin/src/features/matches/{matchActions.ts,MatchesTab.tsx,MatchForm.tsx,ScoreForm.tsx}`
- Modify: `admin/src/features/seasons/SeasonPage.tsx`, `admin/src/test/fixtures.ts`
- Test: `matchActions.test.ts`, `MatchesTab.test.tsx`

**Interfaces:**
- Consumes: `localToUtc`, `utcToLocal`, `formatDateTime`, `emptyToNull`, `listSeasonTeams`.
- Produces:
  - `matches.ts` : `listMatches(leagueId, seasonId, filters: { matchday?: string; status?: MatchStatus })`, `scheduleMatch(leagueId, seasonId, { home_team_id, away_team_id, matchday, kickoff_at, venue })`, `updateMatch(..., matchId, patch)`, `deleteMatch`, `startMatch`, `setScore(..., matchId, home, away)` (PUT), `finishMatch`, `postponeMatch(..., matchId, kickoff_at: string | null)`, `cancelMatch`.
  - `type MatchAction = 'start' | 'score' | 'finish' | 'postpone' | 'cancel' | 'reschedule' | 'details' | 'delete'`
  - `matchActions(status: MatchStatus): MatchAction[]`
  - `STATUS_LABELS: Record<MatchStatus, string>` : « Programmé », « En cours », « Terminé », « Reporté », « Annulé ».

Table des actions, tirée de la machine d'états de l'API :

| Statut | Actions |
|---|---|
| `scheduled` | `start`, `reschedule`, `details`, `postpone`, `cancel`, `delete` |
| `live` | `score`, `finish`, `details` |
| `postponed` | `reschedule`, `details`, `cancel` |
| `finished` | `details` |
| `cancelled` | aucune |

Libellés : « Démarrer », « Score », « Terminer », « Reporter », « Annuler », « Reprogrammer », « Détails », « Supprimer ».

- `reschedule` : journée et coup d'envoi (`PATCH` avec `matchday`, `kickoff_at`).
- `details` : lieu, arbitre, heure de convocation, lien vidéo (`PATCH` avec `venue`, `referee`, `convocation_at`, `video_url`). Champ vide : clé absente (`omitEmpty`).
- `postpone` : nouvelle date optionnelle.
- `cancel`, `delete`, `finish` : confirmation.
- Filtres en tête : « Journée » (nombre) et « Statut ». Tableau trié par journée puis coup d'envoi : « J », « Date », « Domicile », score, « Extérieur », « Statut », actions.
- « Programmer un match » : domicile et extérieur parmi les équipes inscrites, journée (≥ 1), coup d'envoi optionnel, lieu optionnel. Mêmes équipes : « Les deux équipes doivent être différentes. », sans appel réseau.
- Après toute action, invalider `['season', seasonId, 'matches']` et `['season', seasonId, 'standings']`.

- [ ] **Step 1: Écrire les tests**

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

`MatchesTab.test.tsx` : un match `live` montre « Score » et « Terminer » mais pas « Démarrer » ; la saisie 2–1 envoie `PUT .../score` avec `{ home: 2, away: 1 }` ; programmer sans coup d'envoi ni lieu envoie `kickoff_at: null, venue: null` ; un coup d'envoi saisi `2026-10-11T15:00` part égal à `localToUtc('2026-10-11T15:00')` ; mêmes équipes bloque l'envoi ; le filtre de statut déclenche une requête avec `status=live` ; « Détails » avec lieu rempli et lien vidéo vide envoie un corps sans clé `video_url` ; une erreur 409 de l'API sur « Démarrer » s'affiche.

- [ ] **Step 2: Vérifier l'échec.**
- [ ] **Step 3: Implémenter et brancher dans `SeasonPage`.**
- [ ] **Step 4: Vérifier.**
- [ ] **Step 5: Commit** — `feat(admin): match scheduling and lifecycle`

---

### Task 13: Build, intégration et vérification de bout en bout

**Files:**
- Create: `admin/README.md` (commandes dev, test, build ; valeur de `ADMIN_URL`)

Cette tâche se fait avec l'API et l'app mobile lancées en local.

- [ ] **Step 1: Build** — Run: `npm test -- --run && npx tsc --noEmit && npm run build`. Expected: tout passe, `admin/dist/index.html` existe.
- [ ] **Step 2: Vérifier** que `admin/dist` existe pour qu'il câble `admin/embed.go` et `GET /admin/*`. Lui demander l'état des endpoints manquants de la spec, et comment obtenir un compte superadmin en local (`SUPERADMIN_EMAIL`).
- [ ] **Step 3: Vérifier en dev** — API lancée sur `:8080`, `npm run dev`, ouvrir `http://localhost:5173/admin/`. Se connecter en superadmin. Parcourir chaque écran. Noter tout écart entre le contrat proposé et l'API réelle, puis corriger côté webapp ou côté API.
- [ ] **Step 4: Créer le jeu de données via la webapp** — une ligue, une saison 2026-2027, 6 équipes inscrites, 8 joueurs par équipe avec numéros, 3 journées de matchs : la première terminée avec scores, un match en cours, un reporté, un annulé, le reste programmé. Un lien vidéo sur un match terminé.
- [ ] **Step 5: Vérifier l'app mobile** — donner à l'app l'identifiant de la ligue créée (l'app lit `LEAGUE_ID` dans `src/config.ts`). Contrôler les écrans Suivi, Classement, Équipe et Match contre les données saisies : scores, classement, effectifs, statuts, lien vidéo. Tout écart est attribué à la webapp, à l'API ou à l'app, et corrigé par la session concernée.
- [ ] **Step 6: Vérifier le binaire** — une fois le handler embed en place : build Go, ouvrir `http://localhost:8080/admin/`, recharger sur un lien profond, se connecter.
- [ ] **Step 7: Commit** — `docs(admin): README`
