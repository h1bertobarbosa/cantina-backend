# PostgreSQL Query Rules for AI Agents

Use this guide before writing or changing SQL in services, facades, migrations, reports, or operational scripts.

> **Nota de aderência ao repositório:** este projeto usa PostgreSQL com o driver `pg` puro (via `PostgresService.query<T>(sql, params)` em `src/postgres/postgres.service.ts`), migrations com `node-pg-migrate` em `migrations/`, dados particionados por `account_id` (não `tenant_id`), e SQL escrito majoritariamente inline dentro de `src/<feature>/*.service.ts` — não em `src/infrastructure/repositories/` (essa pasta não existe aqui). Alguns módulos têm uma camada de repositório parcial (`src/transactions/repository/`, `src/sales/repository/`); a maioria não tem. Não há `db/schema.sql` neste repositório.

## Core Principles

- Write explicit SQL that matches the indexes you expect PostgreSQL to use.
- Keep queries `account_id`-scoped unless the operation is explicitly platform-wide (this repo has no platform-wide/backoffice queries today).
- Select only the columns needed by the caller (DTO/mapper) in new/changed queries.
- Prefer deterministic ordering for lists — add a tie-breaker column (usually `id`) when changing a paginated query.
- Add or adjust indexes in migrations when adding new query patterns.
- Validate high-risk queries with tests and, when needed, `EXPLAIN (ANALYZE, BUFFERS)` locally.

## Sargability and Index Use

A query is sargable when PostgreSQL can use an index to search it efficiently. Do not wrap indexed columns in functions inside `WHERE` unless you created a matching expression index.

Bad:

```sql
where date_trunc('day', created_at) = $1
```

Good:

```sql
where created_at >= $1
  and created_at < $2
```

Rules:

- Use half-open ranges for dates and timestamps: `>= start` and `< end`.
- Do not use `lower(column)` in filters unless there is an index on `lower(column)`.
- Do not cast indexed columns in predicates to match parameter types.
- Make parameters match column types in TypeScript and SQL.
- Avoid implicit conversions such as comparing a `text` column to a numeric parameter.

## LIKE, ILIKE, and Search

B-tree indexes can support prefix searches such as:

```sql
where name like $1 || '%'
```

They do not support efficient contains searches:

```sql
where name ilike '%' || $1 || '%'
```

Rules:

- Use prefix search when possible.
- If contains search is required for production data, add a deliberate search strategy: `pg_trgm`, full-text search, or a normalized search table.
- Do not add `%term%` search to high-volume tables without an index and a documented reason.
- If using `lower(name)`, ensure a matching expression index exists, such as `(account_id, lower(name), id)` for account-scoped search — this repo currently uses `ILIKE '%term%'` for search (e.g. `src/sales/sales.service.ts:70-75`, `src/users/users.service.ts:65-70`) without a `pg_trgm` index; that's acceptable for this project's data volumes but should not be assumed to scale — flag it if a table using this pattern grows large.

## SELECT Columns

Do not use `select *` in application queries.

Rules:

- Select only columns required by the repository mapper.
- Alias database snake_case to the mapper shape when useful.
- Avoid returning large JSON, text, or metadata columns unless the use case needs them.
- Prefer explicit base select constants only when they stay focused and are reused safely.

Reason:

- Smaller result sets reduce network and memory use.
- Explicit columns make schema changes safer.
- Narrow selects can enable index-only scans.

## Pagination

Offset pagination is acceptable for small administrative lists, but it gets slower as `OFFSET` grows.

Acceptable for small or bounded lists:

```sql
order by created_at desc, id desc
limit $1 offset $2
```

Preferred for large or append-only datasets:

```sql
where account_id = $1
  and (created_at, id) < ($2, $3)
order by created_at desc, id desc
limit $4
```

Rules:

- Always include a deterministic tie-breaker in `ORDER BY`, usually `id`. **Note:** none of this repo's existing paginated queries do this today (see the gap noted in `postgres-guideline.md`) — add it for new/changed queries rather than copying the existing `ORDER BY <column> DESC` form.
- For new high-volume endpoints, prefer keyset pagination. This repo's tables are small (single-cantina scale); offset pagination is fine unless a specific table is known to grow large.
- If using offset pagination, enforce a maximum `limit` in the DTO (`@Max(100)` from `class-validator`, per `rules/api-style-guide.md`).
- Align indexes with sort order and filters, for example `(account_id, created_at desc, id desc)`.
- Do not paginate without an explicit `ORDER BY`.

## Joins, IN, and EXISTS

Use the construct that matches the question.

Rules:

- Use `exists` for existence checks — matches `src/sales/repository/adapter/pg-sale.repository.ts:18-29` (`billingExists`).
- Use `join` when the query needs columns from the joined table — matches `src/sales/sales.service.ts` (`transactions LEFT JOIN billing_items`).
- Avoid large `in (...)` lists. For large sets, use `unnest`, temporary tables, or a proper join source.
- Keep join predicates account-safe. Prefer joining on both `account_id` and entity IDs where tables are account-scoped.

Example (adapted to this repo's domain):

```sql
where exists (
  select 1
  from billings b
  where b.account_id = $1
    and b.client_id = $2
    and b.payed_at is null
)
```

## CTEs

PostgreSQL 12+ can inline CTEs, but CTEs can still hide expensive work when overused.

Rules:

- Use CTEs to improve readability when they express a real intermediate concept.
- Do not use CTEs as a substitute for clear joins or predicates.
- For performance-sensitive queries, check the plan.
- Use `not materialized` only when you have measured and need that behavior.

## Aggregations and Conditional Metrics

Use PostgreSQL `FILTER` for conditional aggregates.

Prefer:

```sql
sum(amount) filter (where type = 'earn') as earned_amount
```

Instead of:

```sql
sum(case when type = 'earn' then amount else 0 end) as earned_amount
```

Rules:

- Use `coalesce` for nullable aggregate results when API responses require numbers.
- Keep metric definitions stable and documented in the use case or presenter.
- Avoid recalculating historical campaign eligibility from current campaign rules. Use persisted evaluations or snapshots when available.

## Tenant Safety (`account_id`)

Every business table in this repo carries an `account_id` column (see any migration under `migrations/`).

Rules:

- Include `account_id = $1` in queries for account-scoped data.
- Beyond filtering the list query, this repo's dominant pattern for single-row lookups (`findOne`, `update`, `remove`) is: fetch the row by `id`, then check `row.account_id !== user.accountId` and throw `NotFoundException` if it doesn't match — see `src/users/users.service.ts:106-115`, `src/sales/sales.service.ts:122-133`. Follow this pattern for new single-row lookups, not just a `WHERE account_id = ...` on the initial query.
- Do not rely only on UUID uniqueness when the `account_id` boundary is part of the domain — always double-check the row's `account_id`.
- `accountId` must come from `@User() user: UserSession` (the JWT payload), never from the request body/query. See `src/sales/sales.controller.ts:29-37`.
- There are no platform-wide/backoffice/superadmin query paths in this repo today — every read/write observed is scoped to the authenticated user's `account_id`.

## Transactions and Multi-Statement Writes

This repo does not use explicit row locking (`SELECT ... FOR UPDATE`, `SKIP LOCKED`) anywhere today — do not introduce it speculatively.

Rules:

- When an operation writes to more than one table and both writes must succeed or fail together, wrap them in a real transaction using `PostgresService.getClient()` + `client.query('BEGIN')` / `COMMIT` / `ROLLBACK` in a `try/catch`, as done in `src/signup/signup.service.ts:32-66`.
- **Known gap:** `src/sales/new-sale.service.ts` (creates a transaction row, then a billing row, then billing_items) and `src/billings/facades/billing.facade.ts` (pays a billing across multiple tables) currently issue independent `PostgresService.query()` calls with no transaction wrapping them. Treat this as a bug to fix when touching these files, not as the pattern to copy into new code.
- If a future feature needs row-level locking (e.g. concurrent updates to the same billing balance), add `SELECT ... FOR UPDATE` inside an explicit transaction and document the lock order in the PR — there is no existing convention to follow yet.

## Idempotency and Uniqueness

**Nota de aderência ao repositório:** este repositório não tem Redis, fila, ou mecanismo de idempotency key hoje (não há dependência de cache/fila em `package.json`). As regras abaixo são para quando um fluxo de escrita precisar de proteção contra duplicidade — implemente com constraints do banco, não com cache.

Rules:

- Prefer a database unique constraint/index over an in-memory or cache-only check when an operation must not be duplicated (e.g. a unique `(account_id, email)` constraint, already used for users — see `migrations/1723330426605_create-users-table.js:47`).
- If an idempotency-key mechanism is introduced later, persist the key with a unique constraint in Postgres rather than relying solely on an external cache.

## Index Design

When adding a query, identify the expected index.

Rules:

- Put equality filters first, then range/sort columns, then tie-breakers.
- For account-scoped lists, index usually starts with `account_id`.
- Use partial indexes for common filtered subsets when they exist in this domain (e.g. open billings: `WHERE payed_at IS NULL`, used implicitly by `hasClientOpenBilling` in `src/sales/new-sale.service.ts:185-194`).
- Keep index predicates aligned with query predicates.
- Avoid adding broad indexes without a known query.

Example (adapted to this repo's tables):

```sql
create index idx_transactions_account_history
on transactions (account_id, created_at desc);
```

## `pg` / `PostgresService` Query Style

Rules:

- Use parameterized queries (`$1, $2, ...`) via `PostgresService.query(sql, params)`; never interpolate user input into SQL strings.
- Keep dynamic SQL restricted to whitelisted fragments such as known sort fields — this repo's established pattern is a `Record<string, string>` map from allowed API field names to real SQL columns (`SALES_ORDER_BY_COLUMNS` in `src/sales/sales.service.ts:12-19`, `USERS_ORDER_BY_COLUMNS` in `src/users/users.service.ts:31-36`). Reuse this exact shape for new dynamic sorting.
- Map raw `pg` rows (the `*Table` interfaces, e.g. `UsersTable`, `TransactionTable`) to output DTOs explicitly via a `static fromTable(row)` factory — do not return raw DB rows from a service/controller.
- Keep transactions in the service/facade where all writes must commit together (see the Transactions section above).
- Do not hide business rules in SQL that should live in the service/facade layer.

## Migrations

For query-affecting changes:

- Add `node-pg-migrate` migrations under `migrations/`, named `<timestamp>_<kebab-description>.js` with `exports.up`/`exports.down` (see `migrations/1757776646672_add-table-billing-history.js`).
- Add indexes and constraints in the same feature migration when practical.
- There is no `db/schema.sql` snapshot in this repo — do not add one unless explicitly requested; `migrations/` is the source of truth.
- Avoid destructive migrations unless the product explicitly requires them and rollback is clear.

## Review Checklist

Before handing off SQL changes, verify:

- no `select *` in new/changed queries;
- indexed columns are not wrapped in functions in `WHERE`;
- date filters use half-open ranges;
- query parameters match column types;
- account-scoped tables filter by `account_id`, and single-row lookups additionally re-check `row.account_id` after fetch;
- list queries have deterministic `ORDER BY` with a tie-breaker;
- `%term%` search has a deliberate index/search strategy (or is accepted as-is for this project's small data volumes — confirm with the team before adding `pg_trgm` infrastructure that doesn't exist yet);
- conditional aggregates use `FILTER` where appropriate;
- multi-table writes that must succeed/fail together are wrapped in a transaction;
- new query patterns have matching indexes added in the same migration;
- tests cover the query's behavior, including the `account_id` mismatch → `NotFoundException` path.
