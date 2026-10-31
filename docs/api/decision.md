# league-s decisions

## 001 · Business errors: typed constants per operation, checked by `exhaustive`

**Date:** 2026-09-27
**Status:** adopted

### Context

Each handler translates the store's business errors into HTTP status codes. With classic sentinels (`var ErrNotFound = errors.New(...)`), nothing flags a forgotten case: the error falls into the final `if err != nil` and goes out as a 500. It only shows up in tests, or in production in the logs.

Go has neither union types nor `never` as in TypeScript. So the compiler can't check that a `switch` covers every case.

### Decision

Each operation that has business errors has its own error type, based on `string`, with its errors declared as constants:

```go
type CreateError string

func (e CreateError) Error() string { return string(e) }

const (
	ErrCreateLeagueNotFound CreateError = "league not found"
	ErrCreateNameTaken      CreateError = "team name is already taken in this league"
)
```

- The store keeps `error` as its return type, to avoid the typed `nil` trap.
- The handler gets the error with `errors.AsType[CreateError](err)`, then does a `switch` **without `default`**.
- The `exhaustive` linter (golangci-lint) flags any missing `case`. `default-signifies-exhaustive` must not be turned on.
- The 500 stays **after** the `switch`, for unexpected errors (pgx, network…).
- The constant's message is the one returned to the client (`createErr.Error()`).
- Naming convention: `<Operation>Error` for the type, `Err<Operation><Case>` for the constants.

### Alternatives rejected

| Alternative | Why rejected |
|---|---|
| `errors.New` sentinels + `errors.Is` (the Go norm) | A forgotten case is only caught by tests. |
| One mapping function per package | All the handlers of a package share the same mapping, and a new sentinel can be forgotten in it. |
| The error carries its HTTP status | The domain would depend on HTTP. |
| A single error type per package | `exhaustive` would require each handler to also handle the errors impossible for its operation. |
| Opaque errors + behaviour (`NotFound() bool`, Dave Cheney) | Minimal coupling, but no exhaustiveness check. |

### Consequences

- ✅ Each operation documents exactly what can fail.
- ✅ A case forgotten in a handler is caught by the linter, locally and in CI.
- ✅ Constants are immutable, unlike a `var` that another package could reassign.
- ⚠️ It is not the standard Go pattern: a Go reader will stop on it. Hence this document.
- ⚠️ More code: one type per operation.
- ⚠️ The guarantee is one-way: nothing checks that the store returns *only* errors of that type. Integration tests cover each case.
- ⚠️ Two operations can have errors with the same meaning but distinct (`ErrGetNotFound`, `ErrDeleteNotFound`). `errors.Is` doesn't link them.
- ⚠️ `errors.AsType` must be given the value type (`CreateError`), not `*CreateError`. With the pointer, the code compiles but never finds the error.

Cheney's criticism of sentinels and error types is mostly about coupling in the public APIs of libraries. Here, everything is in `internal/` and the error is used in the package that defines it.

### References

- Dave Cheney, [Constant errors](https://dave.cheney.net/2016/04/07/constant-errors) (2016)
- Dave Cheney, [Don't just check errors, handle them gracefully](https://dave.cheney.net/2016/04/27/dont-just-check-errors-handle-them-gracefully) (2016)
- Go blog, [Working with Errors in Go 1.13](https://go.dev/blog/go1.13-errors)
- [exhaustive](https://github.com/nishanths/exhaustive)
- Wesley Powell, [Better Golang Error Handling](https://dev.to/wspowell/better-golang-error-handling-182m) (2022), same approach

## 002 · Multi-tenant: one shared database, isolated per league

**Date:** 2026-09-27
**Status:** adopted. Row-Level Security remains an open option.

### Context

Several amateur leagues use the same API and the same database. Each league is a **tenant**: its teams, players, seasons and matches must never be visible or changeable from another league.

### Decision

A single database, a single schema. Every business table carries a `league_id`. Isolation is ensured at two levels.

**1. In the code**
- Every route is under `/api/v1/leagues/{leagueID}/...`. The `league_id` always comes from the URL, never from the body.
- Every SQL query filters on `league_id`. A resource of another league answers 404, as if it didn't exist.
- Integration tests check cross-league access (`"team of another league"`, `"season of another league"`).

**2. In the database**
- `team`, `player` and `season` have a `UNIQUE (id, league_id)` constraint.
- The link tables reference it with composite foreign keys, for example `season_team (team_id, league_id) → team (id, league_id)`. So Postgres refuses to link two resources of different leagues, even if the code has a bug.
- `match` has no `league_id`: it references `season_team (season_id, team_id)`, which is already isolated per league.
- Business uniqueness is per league (`UNIQUE (league_id, name)`): two leagues can each have a team "Les Bleus".

### Alternatives rejected

| Alternative | Why rejected |
|---|---|
| One Postgres schema per league | Better isolation, but each migration must be applied N times, and sqlc or goose must handle the schema dynamically. Too heavy for amateur leagues. |
| One database per league | Maximum isolation, but one connection pool per league and infrastructure to run per customer. Reserved for regulatory needs or large customers. |
| The tenant in a header or a subdomain | Less visible than a URL segment, and harder to test. The URL makes the scope explicit in every route. |

### Consequences

- ✅ Simple to operate: one database, one migration, one pool.
- ✅ On writes, mixing two leagues takes two mistakes at once: a filter forgotten in the code *and* a constraint missing from the schema.
- ⚠️ A `WHERE league_id = $x` forgotten in a **read** query isn't blocked by the composite keys: they protect writes, not reads. Only the cross-access tests catch it.
- ⚠️ For now, nothing prevents writing in any league by changing the ID in the URL. Per-league authentication (next step of the roadmap) will close this hole: an admin of league A will have rights only on league A.

### Open option: Row-Level Security (RLS)

Postgres can filter rows by tenant itself, which would add a third level of protection and would also cover forgotten reads.

Principle:

```sql
ALTER TABLE team ENABLE ROW LEVEL SECURITY;

CREATE POLICY team_isolation ON team
    USING (league_id = current_setting('app.league_id')::bigint);
```

For each HTTP request, in a transaction:

```sql
SET LOCAL app.league_id = '42';
```

To take into account before adopting it:
- each HTTP request will have to open a transaction for the `SET LOCAL`, otherwise the value would stay on the pool's connection and leak to the next request;
- the table owner bypasses RLS by default: a connection with a separate application role is needed, or `FORCE ROW LEVEL SECURITY`;
- migrations and tests (`testdb`) will have to connect with a role that bypasses the policies, or set `app.league_id`;
- errors become less readable: a row filtered by a policy looks like a row that doesn't exist.

To reassess once per-league authentication is in place, since it is what will provide the trusted `league_id`.

### References

- Postgres, [Row Security Policies](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)

## 003 · Data access: sqlc + pgx, no ORM

**Date:** 2026-09-27
**Status:** adopted

### Context

The API reads and writes in Postgres, with a rich schema: composite keys, named constraints, enum `match_status`, dates. Data access has to be typed, testable, and show the SQL actually run.

### Decision

- **SQL is written by hand** in `internal/database/queries/*.sql`, one named query per operation (`-- name: GetTeamByID :one`).
- **sqlc generates the Go code** in `internal/db`: one struct per table, one typed function per query, and `Queries` to call them. sqlc reads the migrations (`schema: "migrations"`), so a query that doesn't match the schema is refused at generation time.
- **The driver is pgx v5** (`sql_package: "pgx/v5"`), used directly with `pgxpool`, without going through `database/sql`.
- **The domain stores** (`internal/app/*/store.go`) wrap `db.Queries`. They convert the generated types into domain types and translate Postgres errors (`*pgconn.PgError`, `pgx.ErrNoRows`) into business errors (see 001).
- Configuration: `emit_pointers_for_null_types` (a nullable column becomes a pointer), and `overrides` to get `time.Time` instead of `pgtype.Date` / `pgtype.Timestamptz`.

### Alternatives rejected

| Alternative | Why rejected |
|---|---|
| GORM | Implicit generated SQL, errors found at run time, a lot of reflection. Composite keys and named constraints are poorly handled. |
| ent | Schema defined in Go and powerful code generation, but it moves away from SQL, and the schema would duplicate the goose migrations. |
| Hand-written `database/sql` or sqlx | Same control over SQL, but the `Scan` calls and structs have to be written and maintained by hand, with no check against the schema. |
| A query builder (squirrel, goqu) | Useful for dynamic queries, but the SQL becomes less readable, with no typing of results. |
| pgx through `database/sql` | Loses features specific to Postgres and `pgxpool` (native types, better performance), with no benefit here since the project targets only Postgres. |

### Consequences

- ✅ SQL is readable and reviewed like code. No hidden query.
- ✅ A column or type error is caught at generation, not in production.
- ✅ No reflection at run time: the generated code is plain Go, readable in `internal/db`.
- ✅ Transactions stay explicit: `pool.Begin`, then `q.WithTx(tx)`.
- ⚠️ Dynamic queries (optional filters, variable sort) are tedious: they need `sqlc.narg` and `CASE` / `COALESCE`, or one query per variant. This will have to be handled for paginated lists.
- ⚠️ `sqlc generate` has to be rerun after every change to a query or a migration. The generated code is committed, and excluded from lint.
- ⚠️ The code depends on Postgres (types, error codes, constraint names). That's deliberate: changing databases is not a goal.

### References

- [sqlc](https://docs.sqlc.dev/)
- [pgx](https://github.com/jackc/pgx)

## 004 · Code layout: one package per domain

**Date:** 2026-09-27
**Status:** adopted

### Context

The code can be split by technical layer (`handlers/`, `stores/`, `models/`) or by business domain (`league/`, `team/`…). The project will grow with `squad`, `match`, then authentication.

### Decision

One package per domain in `internal/app/`:

```
internal/app/team/
├── team.go          domain type + business errors
├── store.go         PostgresStore, on top of db.Queries
├── handler.go       routes, request/response DTOs, HTTP translation
├── handler_test.go  integration tests
└── main_test.go     starts the test Postgres
```

Shared code stays in separate technical packages:
- `internal/db`: the code generated by sqlc;
- `internal/httpx`: the HTTP helpers (`JSON`, `Error`, `Decode`, `IDParam`);
- `internal/testdb`, `internal/testhttp`: the test helpers;
- `internal/server`: wiring routes and dependencies together.

### Alternatives rejected

| Alternative | Why rejected |
|---|---|
| By layer (`handlers/`, `stores/`, `models/`) | Common in Node / NestJS, but in Go the package name is part of the identifier. `handlers.CreateTeam` and `stores.TeamStore` read worse than `team.Handler` and `team.GetError`. Each new feature would also touch every folder. |
| Hexagonal / clean architecture (`domain/`, `ports/`, `adapters/`) | Many folders and interfaces for an API of this size. To reconsider if the business logic grows, for example with `match`. |
| Everything in a single package | No boundary between domains, and names that clash (`ErrGetNotFound` exists in every domain). |

### Consequences

- ✅ Everything about a domain is in one place. Adding `squad` means adding a folder.
- ✅ Names read with their package (`team.Handler`, `season.CreateError`), without a repeated prefix.
- ✅ Details stay private to the package: DTOs, `toResponse`, `pathIDs` are not exported.
- ⚠️ Go forbids circular imports. `season` already imports `team` (for `team.Team` in `GetTeams`). If `team` ever needs `season`, the shared type will have to move, or go through an interface.
- ⚠️ There is no service layer yet: the handler calls the store directly. Logic that touches several domains (player transfer, match result) will need a service, planned for `match`.

## 005 · HTTP router: chi or `net/http.ServeMux`?

**Date:** 2026-09-27
**Status:** open, to decide

### Context

The project uses chi (`github.com/go-chi/chi/v5`). It uses it for:
- routes per method (`r.Get`, `r.Post`, `r.Delete`);
- URL parameters (`chi.URLParam` in `httpx.IDParam`);
- sub-routers: each domain exposes `Routes() chi.Router`, mounted by `server` with `r.Route("/api/v1", …)` and `r.Mount("/leagues/{leagueID}/teams", …)`;
- the middlewares `middleware.Logger`, `middleware.Recoverer`, and `go-chi/cors`.

Since **Go 1.22**, the standard library's router (`http.ServeMux`) also handles:
- the method in the pattern: `mux.HandleFunc("GET /leagues/{leagueID}/teams/{teamID}", h)`;
- URL parameters: `r.PathValue("teamID")`;
- the trailing wildcard `{path...}`;
- priority to the most specific pattern, and an automatic 405 response with the `Allow` header.

Before Go 1.22, a third-party router was almost a must. That's no longer the case, and many recent Go projects do without one. The question will come up in an interview.

### Options

**A. Keep chi**
- ✅ Already in place and tested. chi is light, idiomatic (standard `net/http` handlers) and widespread.
- ✅ `Route` and `Mount` let each domain declare its routes relatively, without knowing its prefix.
- ✅ Ready-made middlewares, groupable per sub-router (`r.With`, `r.Group`). Handy for the upcoming per-league auth, which will only concern some routes.
- ⚠️ One more dependency, while the standard library now covers the essentials.

**B. Move to `http.ServeMux`**
- ✅ Zero dependencies for routing. It's the current trend in Go.
- ✅ `r.PathValue` is standard: `httpx.IDParam` would no longer depend on chi.
- ⚠️ No direct equivalent of `Mount` with parameters. `http.StripPrefix` only accepts a fixed prefix, so a sub-router can't be mounted under `/leagues/{leagueID}/teams`. Each domain would have to register its full paths, for example with a `team.RegisterRoutes(mux, prefix)` function.
- ⚠️ No built-in middleware system: handlers have to be wrapped by hand (`func(http.Handler) http.Handler`), with a small helper to chain them. On the other hand, chi's middlewares and `go-chi/cors` have this standard signature: they stay usable without the chi router.
- ⚠️ A migration to do: `Routes()` in the four domains, `server/routes.go`, `httpx.IDParam`, and the test routers (`newTestRouter`).

### Questions to decide

- Is "zero dependencies" worth the migration work and losing `Mount`?
- How will per-league auth be plugged in? If it must apply to groups of routes, chi's groups are a real advantage.
- For the interview: the choice has to be justifiable. "chi because `Mount` and middleware groups simplify the per-domain layout" holds up as well as "the standard library is enough since Go 1.22".

A way to decide: rewrite a single domain (`league`, the simplest) with `ServeMux` on a branch, and compare.

### References

- Go blog, [Routing Enhancements for Go 1.22](https://go.dev/blog/routing-enhancements)
- [`net/http.ServeMux`](https://pkg.go.dev/net/http#ServeMux)
- [chi](https://github.com/go-chi/chi)

## 006 · Identifiers: UUID v7 everywhere

**Date:** 2026-09-27
**Status:** adopted and applied

### Context

Every table uses `BIGSERIAL` IDs (1, 2, 3…), visible in the URLs: `/leagues/1/teams/42`. They are easy to guess.

### What the question hides

Guessable IDs are only a vulnerability if **authorization is missing**. If `GET /leagues/1/teams/42` returns a team one isn't allowed to see, the vulnerability is the missing authorization, not the ID. It is number 1 of the OWASP API Security Top 10 ("Broken Object Level Authorization"). A UUID only makes it harder to find.

Sequential IDs still raise two real problems:
- **enumeration**: every resource can be walked through with a loop from 1 to N;
- **leaking business information**: ID 42 reveals that there are at least 42 leagues, and the gap between two IDs reveals the pace of creations.

### Options

| Option | For | Against |
|---|---|---|
| A. Keep `BIGSERIAL` everywhere | Nothing to migrate. 8 bytes, compact indexes, IDs readable in logs and tests. | Enumeration and volume leak. |
| B. UUID v4 everywhere | Unguessable. | Random: each insert lands anywhere in the index (see the benchmarks). |
| **C. UUID v7 everywhere** | Unguessable in practice, and time-ordered: inserts stay at the end of the index. `uuidv7()` is native since Postgres 18. | Reveals the creation time to the millisecond. 16 bytes instead of 8. |
| D. Internal `BIGSERIAL` + a public identifier | Joins and composite keys stay `BIGINT`. | Two identifiers per table, and a lookup on every request. |
| E. UUID v7 only for `app_user` and auth | No migration of existing tables. | Two ID conventions in the same project. Public IDs stay enumerable. |

### Decision

**UUID v7 everywhere** (option C):

```sql
id UUID PRIMARY KEY DEFAULT uuidv7()
```

- every foreign key, including `league_id` in the composite keys, becomes `UUID`;
- sqlc generates `pgtype.UUID` by default. An `override` replaces it with `github.com/google/uuid.UUID`;
- `httpx.IDParam` parses with `uuid.Parse` instead of `strconv.ParseInt`. A malformed ID still answers 400.

**Why now:** there is no production data yet, so nothing to convert. The local database has to be recreated anyway (Postgres 18 and renumbered migrations). And `squad`, `match` and auth will add tables: each domain added makes the migration more expensive.

**What doesn't change:** a UUID is not access control. Every write goes through the per-league authorization middleware, and 403 tests check it.

### Impact on performance

| Benchmark | Setup | bigint | UUID v7 | UUID v4 |
|---|---|---|---|---|
| Jeremy Schneider, ardentperf (Feb. 2024) | 20 M rows + 1 M inserted, 1 core, 2 GB of RAM | 3,480 TPS, index 1.97 GB | 3,420 TPS (−2%), index 2.47 GB (+25%) | 2,670 TPS (−23%), index 2.65 GB |
| myDBA.dev | Postgres 18.0, 10 M rows, 16 connections, 8 vCPU | index 214 MB, page fill 89.7% | −12% TPS, index 302 MB (+41%), fill 87.2% | −40% TPS, index 397 MB, fill 65.4% |
| Andrew Atkinson (Aug. 2026), real case | Move from UUID v1 to v7 on an app in production | — | A multi-row insert goes from 0.7 ms to 0.03 ms (23 times faster) | — |

The Supabase article only measures generation speed and storage size, not write throughput. Its conclusion: generation is almost never the bottleneck.

**Why v4 is slow and v7 isn't.** A B-tree index is sorted. With an increasing ID (bigint, v7), each insert goes into the last page, which stays in memory. With a random ID (v4), each insert lands on a different page: it has to be read back from disk, split in two when it's full (page split), and Postgres writes more full pages to the WAL. Result: half-empty pages (65% against 87-90%), a bigger index, and lower throughput.

![BIGINT, UUID v4 and UUID v7 in a B-tree index: where inserts land](img/uuid-bigint-uuidv7-index.png)

**What remains between v7 and bigint:** 16 bytes instead of 8 per key. Hence an index 25 to 40% bigger (fewer rows fit in memory), and 2 to 12% less throughput depending on the load.

**For this project:** amateur leagues mean a few thousand rows per table. At that scale, indexes fit entirely in memory and the difference can't be measured. The real trap to avoid was v4, and v7 avoids it.

### Consequences

- ✅ Public IDs are no longer enumerable and no longer reveal the volume.
- ✅ Performance close to bigint, unlike v4.
- ✅ IDs can be generated in Go if needed (before the insert, for a transaction or an import), without a round trip to the database.
- ⚠️ Migration of the whole project: 19 columns in 7 migrations, about 30 places in the Go code, about 90 lines of tests.
- ⚠️ IDs less readable in logs and tests: tests can no longer write `/leagues/999` for an unknown ID.
- ⚠️ The creation time can be read from the ID. Irrelevant for public data.
- ⚠️ `ORDER BY id` sorts by creation time, but only to the millisecond. For a guaranteed order, sort on `created_at`.

### References

- OWASP, [API1:2023 Broken Object Level Authorization](https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/)
- Postgres, [UUID Functions](https://www.postgresql.org/docs/current/functions-uuid.html)
- Supabase, [Choosing a Postgres Primary Key](https://supabase.com/blog/choosing-a-postgres-primary-key) (2022)
- Jeremy Schneider, [UUID Benchmark War](https://ardentperf.com/2024/02/03/uuid-benchmark-war/) (2024)
- myDBA.dev, [UUID vs BIGINT Primary Key in Postgres](https://mydba.dev/blog/uuid-vs-bigint-primary-key-postgres)
- Andrew Atkinson, [PostgreSQL 18: 23x Faster Inserts With UUID v7](https://andyatkinson.com/postgresql-18-uuidv7) (2026)

Further reading (found during the research, not read in detail):
- Scaling Postgres, [UUID vs Bigint Battle!!! (episode 302)](https://www.scalingpostgres.com/episodes/302-uuid-vs-bigint-battle/)
- Umang Sinha, [PostgreSQL UUID Performance: Benchmarking Random (v4) and Time-based (v7) UUIDs](https://www.umangsinha.in/blog/postgresql-uuid-performance-benchmark)
- DevOps Daily, [Stop Using Random UUIDs as Primary Keys: uuidv7() Lands in PostgreSQL 18](https://devops-daily.com/posts/postgres-18-uuidv7-primary-keys)

## 007 · Rich entities for business logic (starting with `match`)

**Date:** 2026-09-27
**Status:** adopted, not implemented yet (planned with the `match` package)

### Context

The current domains (`league`, `team`, `player`, `season`) are CRUD: their types are plain data structs, without methods, and all the logic sits in the store (error translation) and the handler. This is called an "anemic" model. For CRUD, it's enough.

`match` is different. It has real business rules:
- a lifecycle: `scheduled`, `live`, `finished`, `postponed`, `cancelled`, with forbidden transitions (a cancelled match isn't finished, a finished match's score isn't changed);
- invariants: two different teams, a score that is complete or absent, no negative score, a score required to finish;
- a rule reused elsewhere: who won, which the standings need.

If these rules are spread across handlers, the service and SQL, they end up duplicated or forgotten.

### Decision

**The rules live in the entity, as methods.** The `match.Match` type is no longer a bag of data: it can only change state through its methods, which refuse invalid transitions.

```go
type Match struct {
	id       uuid.UUID
	homeTeam uuid.UUID
	awayTeam uuid.UUID
	status   Status
	score    *Score
}

func NewMatch(seasonID, home, away uuid.UUID, matchday int) (*Match, error)

func (m *Match) Start() error
func (m *Match) SetScore(home, away int) error
func (m *Match) Finish() error
func (m *Match) Postpone() error
func (m *Match) Winner() (teamID uuid.UUID, draw bool, err error)
```

- **Unexported fields**: outside the `match` package, `m.status = "finished"` can't be written. In Go, encapsulation works at the **package** level, not the type level. So the store, which is in the same package, can rebuild a `Match` from a `db.Match` row without exposing a public setter.
- **Pointer receivers** for the methods that change state (`Start`, `Finish`…).
- **A `NewMatch` constructor** that validates the invariants and returns an error, instead of a `Match{…}` literal that could be invalid.
- **Errors typed per operation** (decision 001): `FinishError`, `SetScoreError`… The handler translates them into 409 or 422, and `exhaustive` checks that none is forgotten.
- **A `Status` type of the domain's own**, translated from `db.MatchStatus` in the store. The domain doesn't depend on generated code.

**A service orchestrates, the entity decides.** The service applies the "load → apply the rule → save" cycle:

```go
func (s *Service) Finish(ctx context.Context, leagueID, matchID uuid.UUID) error {
	// in a transaction:
	// m, err := store.GetForUpdate(ctx, tx, leagueID, matchID)
	// if err := m.Finish(); err != nil { return err }
	// return store.Save(ctx, tx, m)
}
```

The service handles what goes beyond a single match: the transaction, concurrency, and the rules that need other data (a single match per team and per matchday, a kickoff during the season).

**The SQL constraints stay in place** (`CHECK (home_team_id <> away_team_id)`, `CHECK (status <> 'finished' OR home_score IS NOT NULL)`…). As for multi-tenancy (decision 002), it is a second level: the entity gives readable errors, and the database guarantees consistency even in case of a bug.

**The proposed lifecycle** (to confirm during implementation):

```
scheduled ──Start──► live ──Finish──► finished
    │  ▲
    │  └──Reschedule── postponed ◄──Postpone── scheduled
    └──Cancel──► cancelled
```

### Alternatives rejected

| Alternative | Why rejected |
|---|---|
| Anemic model + rules in the service ("transaction script") | Very common in Go and enough for CRUD. But the rules of `match` would be scattered across the service's methods, and `standing.Compute` would have to reimplement `Winner`. Above all, nothing would prevent other code from changing `status` directly. |
| Rules only in SQL (`CHECK`, triggers) | The simple invariants are already there. But a state machine in triggers is hard to read and to test, and Postgres errors say little to the client. |
| Full DDD (aggregates, repository interfaces, hexagonal architecture) | Too much ceremony for the size of the project. The useful idea (the entity protects its invariants) is taken without the rest. |
| Rich entities everywhere, including `league` or `team` | No rule to protect today: it would be extra code with no benefit. A domain will be enriched when it has real rules. |

### Consequences

- ✅ All of a match's rules are in one place, readable like the business specification.
- ✅ **Pure unit tests**, without a database or HTTP: `m.Finish()` on a cancelled match must fail. They will be the first `make test` tests in `internal/app`.
- ✅ `standing.Compute` reuses `Match.Winner()` instead of reimplementing the rule.
- ✅ An invalid state can't be built from outside the package.
- ⚠️ Two styles in the project: anemic CRUD domains and one rich domain. That's intended, and it's the rule to explain: a domain is enriched when it has invariants to protect.
- ⚠️ More code: conversion `db.Match` ↔ `Match`, a service layer, and getters if the handler needs to read unexported fields.
- ⚠️ "Load → change → save" is exposed to concurrent writes (two admins entering a score at the same time). It needs a transaction with `SELECT … FOR UPDATE`, or an optimistic lock on `updated_at`.
- ⚠️ The store must be able to rebuild a `Match` in any state, including `finished`, without going through the transitions again. This rebuilding stays private to the package.

### References

- Martin Fowler, [Anemic Domain Model](https://martinfowler.com/bliki/AnemicDomainModel.html)
- Martin Fowler, [Transaction Script](https://martinfowler.com/eaaCatalog/transactionScript.html)
- Effective Go, [Names](https://go.dev/doc/effective_go#names) (visibility through the capital letter, at the package level)

## 008 · Squad: preventing overlapping memberships

**Date:** 2026-09-27
**Status:** decided (#15, #120): option **A**, with inclusive bounds (`'[]'`), scoped by season

**Decision.** The owner decided in #15 that `left_on` is the player's **last day** in the team, and that a player is in only one team at a time in a league, history included. Migration `00012` adds `squad_membership_no_overlap` = `EXCLUDE USING gist (player_id WITH =, season_id WITH =, daterange(joined_on, left_on, '[]') WITH &&)`, translated to `ErrJoinOverlap` (409). Inclusive bounds follow from "last day": a transfer on day D joins the new team on D + 1 (`Transfer.JoinedOn`). `season_id` stays in the constraint: memberships stay inside their season and seasons don't overlap (`season_league_no_overlap`), so this is "one team at a time in the league", and an open membership of a past season (`left_on` null) doesn't block the next season. `squad_membership_active_player` is kept: it still gives the clearer `ErrJoinPlayerAlreadyActive`. Shirt numbers keep their partial index only.

### Context

Each membership of a player in a team is a row of `squad_membership`, with `joined_on` and `left_on` (`NULL` while they are in the squad). It is **business** history: the dates describe reality, not changes to the database.

Today, the only protection is the partial unique index `squad_membership_active_player`: a player can't have **two active memberships** in the same season. It doesn't prevent two **finished memberships that overlap**:

```
Team A  [2025-08-01 ─────────────── 2025-12-31]
Team B               [2025-10-01 ─────────────── 2026-01-31]
```

Through the API, this case doesn't happen: a team can only be joined after leaving the previous one. But a backdated entry, an import or a bug could create it, and the standings or the statistics would become wrong. The same hole exists for shirt numbers (`squad_membership_active_number`).

### Options

Tested on Postgres 18 (`postgres:18`, throwaway container). Both need the `btree_gist` extension, to combine equality on UUIDs and date overlap in the same GiST index.

**A. An exclusion constraint on the current columns** (available for a long time)

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

CONSTRAINT squad_membership_no_overlap EXCLUDE USING gist (
    player_id WITH =,
    season_id WITH =,
    daterange(joined_on, left_on, '[)') WITH &&
)
```

**B. A Postgres 18 temporal constraint** (`WITHOUT OVERLAPS`)

```sql
period daterange GENERATED ALWAYS AS (daterange(joined_on, left_on, '[)')) STORED,
CONSTRAINT squad_membership_no_overlap UNIQUE (player_id, season_id, period WITHOUT OVERLAPS)
```

`WITHOUT OVERLAPS` doesn't accept an expression (`daterange(joined_on, left_on)` gives a syntax error). It needs a real range-typed column, here generated from the two dates. It is the SQL:2011 standard syntax, and it opens the door to Postgres 18's temporal foreign keys (`PERIOD`).

**C. Add nothing**: the rule stays enforced by the API and the future transfer service.

| | A. `EXCLUDE` | B. `WITHOUT OVERLAPS` | C. Nothing |
|---|---|---|---|
| Enforced in the database | ✅ | ✅ | ❌ |
| Schema | unchanged | one more generated column | unchanged |
| sqlc | nothing to change | `period` shows up in `SELECT *` / `RETURNING *` with a `pgtype.Range` type: needs an override or listing the columns | nothing |
| Readability | less known GiST syntax | close to the SQL standard, very readable | — |
| Interest in an interview | good | very good (Postgres 18 feature) | low |

### Points to decide

- **Exclusive end bound (`'[)'`)**: `left_on` is then the first day the player is **no longer** in the team. A same-day transfer (`left_on` = `joined_on` of the new team) is accepted. With `'[]'` (inclusive bounds), that same transfer would be refused, since the two periods would share a day. Tested: `'[)'` accepts the same-day transfer and refuses a real overlap. This convention must also be written in the DTO and in the API docs.
- **Keep `squad_membership_active_player` or not**: the new constraint covers it (two open memberships always overlap). Removing it simplifies the schema, but the store translates it today into `ErrJoinPlayerAlreadyActive`. The new constraint would have to be translated instead (code `23P01`, `exclusion_violation`).
- **Shirt numbers**: should the same guarantee apply to `(season_id, team_id, number)`? Only if the history of numbers matters to the business.

Recommendation: **B**, with `'[)'`, if the cost on the sqlc side is acceptable. Otherwise **A**, which gives the same guarantee without touching the schema.

### References

- Postgres, [Exclusion constraints](https://www.postgresql.org/docs/current/ddl-constraints.html#DDL-CONSTRAINTS-EXCLUSION)
- Postgres, [Range types](https://www.postgresql.org/docs/current/rangetypes.html)
- Postgres, [`btree_gist`](https://www.postgresql.org/docs/current/btree-gist.html)
- Postgres 18, [`CREATE TABLE`](https://www.postgresql.org/docs/18/sql-createtable.html) (`WITHOUT OVERLAPS`, `PERIOD`)

## 009 · Change history (audit)

**Date:** 2026-09-27
**Status:** open, to decide with authentication

### Context

The project keeps the **business** history (squad memberships, finished matches), but not the **technical** history: who changed what, when, and what the old value was. As soon as there are several admins per league, the question will come up: "who changed this match's score?".

**Postgres has no native versioning.** The SQL:2011 standard provides system-versioned tables (`WITH SYSTEM VERSIONING`, `AS OF` queries). SQL Server, MariaDB and Db2 offer them, Postgres doesn't. Backups and point-in-time recovery restore a whole database to a given date, but don't let one query a row's history.

### Options

| Option | Principle | For | Against |
|---|---|---|---|
| **A. Triggers + `*_history` tables** | On each `UPDATE` or `DELETE`, a trigger copies the old row into a twin table | Complete, invisible to the Go code, the history keeps the same schema | One table and one trigger per tracked table, to maintain with each migration. The user who made the change isn't known to the trigger without a trick |
| **B. A generic audit table** | A single trigger writes to `audit_log`: table, id, operation, old and new value as `JSONB`, date | A single table and a single function for the whole schema | Less convenient queries (JSON), table that grows fast |
| **C. Audit in the Go code** | The service writes an event ("score changed from 1-0 to 2-0 by X") in the same transaction | Knows the user and the business intent, easy to display | Can be forgotten: a write that doesn't go through the service isn't tracked |
| **D. Change data capture (CDC)** | Read the WAL with logical replication (Debezium…) | No impact on the app, nothing can be forgotten | Heavy infrastructure, out of proportion here |

**Knowing who made a change**: a trigger doesn't know which admin is signed in, since the app always connects with the same Postgres role. The user has to be passed to the database, for example with `SET LOCAL app.user_id = '…'` at the start of the transaction, which the trigger reads with `current_setting('app.user_id')`. It is the same mechanism as RLS (decision 002), with the same constraints: one transaction per request.

### Leads

- History that has business value (score changes, a match's status) can justify **C**, because it should be displayed and say *who* did it.
- For a global safety net ("who deleted this team?"), **B** is the simplest to set up.
- To decide once authentication is in place, since the main point is to link a change to an admin.

### References

- Postgres, [Trigger functions](https://www.postgresql.org/docs/current/plpgsql-trigger.html)
- Postgres, [Logical replication](https://www.postgresql.org/docs/current/logical-replication.html)
