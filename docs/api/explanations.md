# league-s explanations

Concepts worth being able to explain, which are not decisions specific to the project. The decisions are in `decision.md`.

## 1 · Why data is copied field by field between the layers

### The observation

The same team goes through three different structs:

```
Postgres ──► db.Team ──toTeam()──► team.Team ──toResponse()──► teamResponse ──► JSON
            (sqlc)     store.go     (domain)     handler.go      (DTO)
```

And the other way, the JSON received is decoded into `createTeamRequest`, then copied into a `team.Team`.

At each step, fields are copied one by one, and a list gets a new slice:

```go
res := make([]teamResponse, len(teams))
for i, t := range teams {
	res[i] = toResponse(t)
}
```

Why not return `db.Team` to the client directly?

### Reason 1: the API contract must not follow the database schema

`db.Team` is **generated** from the migrations. It holds everything the table has, including `CreatedAt` and `UpdatedAt`, and it changes with every migration.

If `db.Team` were returned directly:
- **adding a column would expose it in the API automatically.** Today it's `updated_at`. Tomorrow, in a `user` table, it would be `password_hash`;
- **renaming a column would break clients**, although it is a purely internal change;
- **the JSON names can't be chosen**, since generated code isn't edited.

`teamResponse` is the public contract: it lists exactly what the client receives, with the chosen names (`league_id`). The database can change without the API changing, and the other way round.

### Reason 2: the client must not be able to send everything (mass assignment)

`createTeamRequest` holds only `Name` and `Logo`. If the JSON were decoded directly into `team.Team` or `db.Team`, the client could send:

```json
{ "name": "Les Bleus", "id": 12, "league_id": 7 }
```

and choose the ID itself, or **create a team in another league** than the one in the URL. That would be a multi-tenant isolation hole (see decision 002).

With a request DTO, the sensitive fields simply don't exist. `LeagueID` is taken from the URL, never from the body. The DTO also carries the validation rules (`validate:"required,max=50"`), which only concern the HTTP input.

It is a classic vulnerability: "mass assignment" (OWASP API Security Top 10, "Broken Object Property Level Authorization").

### Reason 3: the domain depends neither on the database nor on HTTP

`team.Team` is the business type. It has no `json` tag, no pgx type, no technical field:
- the store builds it from `db.Team` (`toTeam`);
- the handler turns it into `teamResponse` (`toResponse`).

This is what makes it possible to write the logic of `match` (`Start`, `SetScore`, `Finish`, `Winner`) on plain types, testable without a database and without HTTP.

Each layer has its type, and each conversion is a boundary:

| Type | Layer | Depends on | Changes when… |
|---|---|---|---|
| `db.Team` | store | SQL schema (generated) | a migration changes the table |
| `team.Team` | domain | nothing | the business changes |
| `teamResponse` / `createTeamRequest` | handler | HTTP contract | the API changes (versioned) |

### Why a loop and a `make`

Go has no `.map()` on slices like JavaScript, and the standard library doesn't offer one (the `slices` package has no `Map`). The explicit loop is the idiomatic way.

`make([]teamResponse, len(teams))` creates the slice **at the right size from the start**: a single allocation, then it is filled by index. With `append` on an empty slice, Go would have to grow the array several times.

`[]db.Team` can't be converted directly to `[]teamResponse` either. Even with identical fields, Go doesn't convert slices from one type to another, and here the fields differ anyway (`CreatedAt`, the tags).

A detail worth knowing: `make([]T, n)` creates a slice of length `n`, filled with zero values. For an empty list, the JSON is `[]`, whereas a `nil` slice would give `null`. Clients like always getting an array.

### The cost

- **More code**: `toX` functions to write and keep up to date.
- **One copy per request**, negligible next to the round trip to Postgres and the network.
- **A risk of forgetting**: a new field added to the domain but not to the DTO doesn't show up in the response. Integration tests catch it.

### What about doing the projection directly in SQL?

`SELECT id, league_id, name, logo` instead of `SELECT *`: sqlc then generates a struct with only those fields.

- **For reason 1, it mostly works.** A new column no longer leaks, and an alias (`AS`) protects against a rename. But the API contract is then written in the SQL files and tied to one query. It can't express a nested response, a computed field, a date format, or a response that combines several queries.
- **For reason 2, it isn't enough.** The projection is about what goes out, whereas mass assignment is about what comes in. An `INSERT` that lists its columns does prevent writing `id`. But `league_id` is a legitimate column of the `INSERT`: the question is not *which columns* are written, but *where each value comes from*. `league_id` must come from the URL, not from the body. Only the request DTO separates the two sources.

### Reason 3 is not functional

Reasons 1 and 2 have a visible effect: the API contract and security. Reason 3 has none: the app behaves exactly the same with or without a domain layer. It is a matter of architecture and dependencies, so of the cost of future changes:
- a migration only touches the store;
- an API change only touches the handler;
- business logic is tested without a database or HTTP.

That's why some projects skip it on a simple CRUD, whereas nobody should skip the DTOs.

### Nuances worth knowing

- On a small CRUD, some projects skip the domain layer and convert `db.Team` directly to a DTO. That's defensible. The boundary that really matters is the **HTTP DTO**: it is what protects the contract and security.
- sqlc can generate `json` tags (`emit_json_tags`), which makes returning `db.Team` directly tempting. That is exactly what is avoided here, for reasons 1 and 2.
- Current inconsistency in the project: `League` and `Season` have `json` tags although they have DTOs, unlike `Team` and `Player`. Those tags serve no purpose and wrongly suggest that the domain type is serialized.

### To say in an interview, in one sentence

"I separate the database model, the business model and the HTTP DTOs: the API has a stable contract that doesn't follow the schema, the client can only send the allowed fields, which matters for per-league isolation, and the business logic stays testable without a database or HTTP. The price is conversion code."

## 2 · Check then write: concurrency

### The problem

Any operation that does **"read → decide → write"** has the same flaw: between the read and the write, another request can get through and make the decision wrong. This holds for a check in a service, in a rich entity or in a handler.

**Example 1: the shirt number (uniqueness).** Two admins give number 10 to two different players, at the same time:

```
Admin A: "is 10 free?" → yes
Admin B: "is 10 free?" → yes
Admin A: INSERT number 10 → OK
Admin B: INSERT number 10 → OK without a database constraint: two players have number 10
```

**Example 2: the squad size (counting).** The squad has 9 players out of 10. Two simultaneous additions each count 9, each insert, and the squad ends up at 11.

**Example 3: a match's lifecycle (entity).**

```
Request A: loads the match (live) → m.Finish() OK
Request B: loads the match (live) → m.Cancel() OK → saves: cancelled
Request A: saves: finished
```

The match ends `finished` although it was cancelled in the meantime. B's update is lost: it is a "lost update". No `CHECK` prevents it, because a `CHECK` only sees the **new** row, never the old one: it can't forbid a transition.

### The solutions

For a rule to be **enforced**, one of these two things is needed:
- **the database decides at write time**;
- **what was read stays true until the write**.

| Solution | Principle | Example in the project | When to use it |
|---|---|---|---|
| **Database constraint** | The database refuses the write. The store translates the error into a business error | `squad_membership_active_number` → `ErrJoinNumberTaken` | Uniqueness, existence, non-overlap |
| **Conditional write** | The rule is in the `WHERE`: `UPDATE … WHERE id = $1 AND status = 'live'`. Zero rows changed = the rule no longer holds | `CloseSquadMembership`: `WHERE … AND left_on IS NULL` | A simple transition on a single row |
| **Pessimistic lock** | `SELECT … FOR UPDATE` in a transaction: other requests wait for the transaction to end | Lock the `season_team` row before counting the squad | A count, or a rule that reads several rows |
| **Optimistic lock** | A version is read back at write time: `UPDATE … WHERE id = $1 AND updated_at = $old`. Zero rows = someone got there first → 409 "try again" | Worth considering for rich entities (`match`) | Rare conflicts, and blocking is unwanted |

A pessimistic lock blocks, but never fails. An optimistic lock doesn't block, but can fail, and the client must then retry.

### What about checking upfront?

Checking before writing, in a service or an entity, **is still useful**: in 99% of cases there is no concurrency, and a precise message can be given before touching the database. But it is **not a guarantee**. One of the mechanisms above is still needed, and the database error must still be translated for the remaining 1%.

For a database constraint already translated by the store, checking upfront gives the client nothing: it gets the same 409, with the same message, and one query fewer is made. It becomes worthwhile when:
- **several errors at once** should be reported (the database stops at the first one);
- the operation has a **side effect** before the write (an external call, an email);
- the operation does **heavy work** before the write.

Its cost: the rule is written in two places, which must be kept in sync.

### Where to put each rule

| Kind of rule | First | Final guarantee |
|---|---|---|
| Format (length, range, URL) | DTO validation (422) | `CHECK` in the database |
| State transition of an entity | Entity method | Lock (pessimistic or optimistic) or conditional write. A `CHECK` isn't enough |
| Uniqueness, existence, overlap | Database constraint, translated by the store | The same constraint |
| Rule over several rows or tables (counting, season dates) | Service | Pessimistic lock in the transaction |

### To say in an interview, in one sentence

"A check before a write is not a guarantee, because another request can get in between. Either the database decides at write time (constraint, conditional `WHERE`), or I lock what I read (`FOR UPDATE`, or a version). Checking upfront is for giving a good message, not for enforcing the rule."
