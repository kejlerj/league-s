# Code style

The first rule is to **look like the code around you**. Before adding a pattern, find how the closest package or screen already does it, and do the same. A second way of doing one thing is a cost for every later reader. If the existing way is wrong, don't fork it: open a `tech-debt` issue (`docs/agents/pr-workflow.md` › Follow-up issues) to fix it everywhere in its own PR.

## Principles

How they apply here, in order of importance.

### KISS
- The simplest code that meets the spec. A plain function before a type, a type before an interface, an interface before a framework.
- No cleverness: no reflection, no generics, no code generation (sqlc aside) unless they remove real repetition.
- A reader should understand a function without jumping to five other files.

### YAGNI
- Build what the issue asks, nothing for "later". No options, flags, parameters or extension points that no caller uses today.
- No speculative interfaces: an interface appears when a second implementation, or a test fake, needs it.
- Pagination, caching, configuration: only when the spec asks for them.

### DRY, with judgement
- Remove duplication of **knowledge**: one business rule lives in one place (the entity or the service), one constant has one definition, one API type has one source (`docs/openapi.yaml`).
- Duplicated **code** can stay until the third copy (rule of three). Two similar handlers are better than one handler full of conditions.
- A wrong abstraction costs more than duplication. If a shared helper starts taking flags to behave differently per caller, split it back.

### SOLID, the parts that matter in Go and React
- **Single responsibility**: a handler decodes and encodes HTTP, a service applies rules, a store talks to the database, an entity holds invariants. A React page fetches and composes, a component displays.
- **Interface segregation, dependency inversion**: small interfaces, declared on the consumer's side (as `match.Store` is declared in `match/service.go`). Accept interfaces, return concrete types.
- Open/closed and Liskov rarely come up here. Don't build class hierarchies to satisfy them.

### Clean code basics
- Names say what a thing is or does, in English. No abbreviations beyond the common ones (`ctx`, `err`, `id`, `db`, `tx`, `req`, `res`).
- Small functions with one level of abstraction. Return early instead of nesting.
- No dead code, no commented-out code, no `TODO` without an issue number.
- No code comments (project rule). If code needs one, rename or split it first.

## Go

- **Layout per domain** (`internal/app/<domain>`): `<domain>.go` (entity, rules, errors), `service.go` (rules needing the store, transactions), `store.go` (sqlc calls, translation of database errors), `handler.go` (routes, DTOs, status codes). Follow `match` or `squadmembership` for a new domain.
- **Errors**:
  - one sentinel error per operation and cause (`ErrJoinSquadFull`), declared in the domain package,
  - wrap with context: `fmt.Errorf("join player %s: %w", id, err)`, check with `errors.Is` / `errors.As`,
  - database errors are translated by **constraint name** in the store, never in the handler,
  - the handler maps domain errors to status codes. Clients never see a raw database or Go error,
  - no `panic` outside `main` and test helpers.
- **Context** is the first parameter of anything that does I/O. Never store it in a struct.
- **SQL** lives in `internal/database/queries/*.sql`. Run `sqlc generate`, never hand-edit `internal/db/`. Every query filters on `league_id`.
- **Transactions** go through the store's `InTx`, and locks are taken there (`FOR UPDATE`), as the match and squad services do.
- **DTOs**: separate request and response structs in the handler. IDs in bodies are `string` with `validate:"required,uuid"`, then `uuid.Parse`. `PATCH` fields are pointers.
- **Logging**: `slog` with context (`slog.ErrorContext`), structured keys. Never log tokens, passwords or reset links.
- **Tests**: table-driven where there are several cases, `t.Run` with readable names, the `testdb` seeder for data, no `time.Sleep`.
- Formatting and imports: `make fmt`. `make lint` must pass.

## TypeScript (admin and mobile)

- `strict` mode. No `any`, no `as` casts to silence the compiler, no non-null `!` without a reason the types can't express. Use `unknown` and narrow.
- Types for API data come from one place: the types generated from `docs/openapi.yaml` (`admin/src/api/types.ts`, `mobile/src/types/index.ts`). Don't redeclare an API shape by hand.
- Function components and hooks only. One component per file when it's exported. Props typed with a `type` or `interface` next to the component.
- Keep logic out of components. Pure functions go in `src/logic` (mobile) or next to the feature (admin), with unit tests.
- Named exports, except where the framework requires a default export (Expo Router route files).
- `async`/`await` over `.then` chains. Handle every error path the UI can show.

### Admin
- Server data goes through **TanStack Query** only: one query key per resource, invalidate after writes. No server data copied into `useState`.
- Network calls only in `src/api/`, UI primitives in `src/ui/` (no network), pages and forms in `src/features/<resource>/`.
- Tailwind classes. No inline styles, no new CSS files.

### Mobile
- Server data through the services in `src/services/` and the `useAsync` hook. **Zustand** only for client state (theme, follows).
- Styling with NativeWind classes, through the shared primitives (`Screen`, `Card`, `ThemedText`…), with `dark:` pairs written once in those primitives. No inline hex colors.
- Every user-facing string comes from `src/i18n/fr.ts`.
- Dates from the API are UTC. Format them in device time through `src/logic/dateTime.ts`.

## How the reviewer uses this file

Breaking these rules is a `[nit]`, unless it adds real complexity, duplicates a business rule, or goes against the existing structure of the package. Then it's `[blocking]`.
