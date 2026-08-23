---
name: postgres-guideline
description: Standardization guide for PostgreSQL access via the `pg` driver in this repository. Focused on performance, integrity, and schema consistency.
---

# PostgreSQL Style Guide

> **Nota de aderência ao repositório:** este projeto **não** usa `pg-promise`, `tenant_id` ou uma pasta `src/infrastructure/repositories/`. O acesso ao banco é feito via driver `pg` puro, encapsulado em `PostgresService.query<T>(sql, params)` (`src/postgres/postgres.service.ts`), migrations com `dbmate` em `migrations/`, e multi-tenancy pela coluna `account_id`. Os exemplos abaixo foram adaptados para refletir isso — trate menções remanescentes a outras stacks como erro a corrigir se encontrar.

Use this guide when creating migrations, designing tables, changing PostgreSQL access code, or reviewing database-facing code.

This guide defines the baseline schema and query conventions. For detailed query-writing and performance rules, also read [`postgres-queries.md`](postgres-queries.md).

## Responsibilities

- Standardize schemas, tables, columns, constraints, and indexes.
- Define durable data type choices for financial, audit, and schemaless data.
- Keep database integrity aligned with domain rules through foreign keys, unique constraints, checks, and transactional guarantees.
- Guide secure and performant SQL with the `pg` driver via `PostgresService`.
- Establish the canonical expectations for pagination (soft delete is not used in this schema today — see Data Types).

## When to Use

- Creating or changing `dbmate` migrations (`migrations/`).
- Implementing or changing PostgreSQL access code in a NestJS service/facade/repository.
- Designing data models that respect the `account_id` tenant boundary.
- Reviewing SQL for performance, integrity, or schema consistency.
- Adding indexes, transactions, or pagination contracts.

## Mandatory Standards

- Use plural table names, snake_case columns, and English names.
- Use `uuid` primary keys. Generate them in the application layer via the injected `GUID_PROVIDER` (`UuidV7Provider`, UUIDv7) — see `src/libs/src/guid/`. Never generate IDs in SQL (`gen_random_uuid()`) for new tables unless explicitly decided otherwise.
- Add `created_at` and `updated_at` as `timestamptz` to every table (already the dominant pattern — see any file in `migrations/`).
- Do not use `select *` in **new** application queries; select only the columns the mapper/DTO needs. **Nota:** grande parte do código existente (`users.service.ts`, `products.service.ts`, `clients.service.ts`, `sales.service.ts`, `signin.service.ts`, `billings/*`) usa `SELECT *` — é dívida técnica conhecida, não um padrão a copiar. Não é necessário reescrever essas queries só por isso, mas todo código novo deve selecionar colunas explícitas.
- Always write explicit joins with `join ... on` (matches existing usage, e.g. `src/sales/sales.service.ts`, `src/billings/billings.service.ts`).
- Pagination must have deterministic ordering. This repo does not sort by `id` as a tie-breaker today (see `SALES_ORDER_BY_COLUMNS`/`USERS_ORDER_BY_COLUMNS`); add a stable tie-breaker column when introducing new paginated queries to avoid inconsistent ordering across pages.
- Never interpolate user input into SQL strings. Use positional `pg` parameters (`$1, $2, ...`) through `PostgresService.query(sql, params)`.
- Keep complex business rules in the service/facade layer. Use the database for atomic integrity through constraints, references, and transactions.
- Multi-statement writes that must succeed or fail together must use a real transaction: `const client = await postgresService.getClient(); ... client.query('BEGIN') ... client.query('COMMIT')` (with `ROLLBACK` on error), as done in `src/signup/signup.service.ts`. **Nota:** `src/sales/new-sale.service.ts` and `src/billings/facades/billing.facade.ts` currently perform multi-table writes without a transaction — this is a known gap (see `AGENTS.md` section 6), not a pattern to replicate.
- Repository interfaces (ports/adapters) are the preferred shape for data access when a module already has one (`src/transactions/repository/`, `src/sales/repository/`), but most modules (`users`, `products`, `clients`, `billings`) query `PostgresService` directly from the service/facade — that is the current dominant pattern in this repo, not a violation. Do not introduce a repository abstraction for a single module without team alignment; it would create a third inconsistent pattern.
- There is no `db/schema.sql` file in this repository. The migrations directory (`migrations/`) is the single source of truth for schema; do not create a schema snapshot file unless explicitly requested.

## Data Types

- Use `uuid` for entity identifiers and foreign keys.
- Use `text` for variable-length strings unless a strict length is part of the domain.
- Use `numeric(precision, scale)` for money or decimal amounts. Do not use floating point types for financial values.
- Use `integer` or `bigint` for counters, points, stamps, and version columns based on expected range.
- Use `timestamptz` for timestamps that represent real instants.
- Use `date` only for calendar dates without time-of-day semantics.
- Use `jsonb` only for schemaless metadata or integration payloads. Do not hide query-critical fields inside JSON.
- Use constrained `text` values with `check` constraints when an enum must remain database-visible.
- **Soft delete (`deleted_at`) is not used anywhere in this schema today** — every `remove()`/`delete()` flow does a hard `DELETE FROM` (see `src/users/users.service.ts`, `src/sales/sales.service.ts`). Do not add `deleted_at` to a table unless the product explicitly requires an audit trail/undo for that entity; keep hard deletes consistent with the rest of the schema otherwise.

## Table Definition Example

Adapted to this repo's actual conventions (`account_id` tenant column, FK to `accounts`, hard delete):

```sql
create table users (
  id uuid primary key,
  account_id uuid not null,
  email text not null,
  status text not null check (status in ('ACTIVE', 'INACTIVE')),
  created_at timestamptz not null default current_timestamp,
  updated_at timestamptz not null default current_timestamp,
  constraint users_account_email_uk unique (account_id, email),
  constraint users_account_fk foreign key (account_id) references accounts (id) on delete restrict
);

create index idx_users_list_active
on users (account_id, created_at desc);
```

## `PostgresService` Query Example

This repo has no repository-per-table convention; most modules query `PostgresService` directly from the service (see `src/users/users.service.ts`, `src/clients/clients.service.ts`). Use this shape for new query methods:

```ts
import { Injectable } from '@nestjs/common';
import { PostgresService } from 'src/postgres/postgres.service';

interface UsersTable {
  id: string;
  account_id: string;
  email: string;
  created_at: Date;
}

@Injectable()
export class UsersService {
  constructor(private readonly postgresService: PostgresService) {}

  async findByAccount(accountId: string, limit: number, offset: number) {
    return this.postgresService.query<UsersTable>(
      `SELECT id, email, created_at
       FROM users
       WHERE account_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [accountId, limit, offset],
    );
  }

  async exists(accountId: string, email: string): Promise<boolean> {
    const [row] = await this.postgresService.query<{ exists: boolean }>(
      `SELECT EXISTS(
         SELECT 1 FROM users WHERE account_id = $1 AND email = $2
       )`,
      [accountId, email],
    );
    return row.exists;
  }
}
```

## Index and Query Rules

- Keep predicates sargable. Do not wrap indexed columns in functions inside `where` unless a matching expression index exists.
- Prefer half-open timestamp ranges:

```sql
where created_at >= $1
  and created_at < $2
```

- Avoid patterns such as `date_trunc('day', created_at) = $1` on indexed columns.
- B-tree indexes support prefix searches such as `like 'term%'`, not contains searches such as `like '%term%'`.
- Use `pg_trgm`, full-text search, or a normalized search table for production contains search.
- Keep parameter types aligned with column types to avoid implicit casts that bypass indexes.
- Use `exists` for existence checks and `join` when the query needs columns from another table.
- Prefer `filter` for conditional aggregates:

```sql
sum(amount) filter (where status = 'paid')
```

## Pagination

- Offset pagination is what this repo uses today (`LIMIT`/`OFFSET` with `page`/`perPage`, e.g. `src/users/users.service.ts`, `src/sales/sales.service.ts`) and is acceptable for this project's table sizes (small commerce/cantina data volumes). Only consider keyset pagination if a table is expected to grow large and append-only.
- Every paginated query must have deterministic ordering. **Gap found:** current `orderBy` whitelists (`SALES_ORDER_BY_COLUMNS`, `USERS_ORDER_BY_COLUMNS`) do not add an `id`/tie-breaker column, so rows with equal sort values can shift between pages — add a tie-breaker when touching these queries.
- **Gap found:** `perPage`/`limit` has a default (10) but no enforced maximum in the query DTOs (`src/users/dto/query-user.dto.ts`, `src/sales/dto/query-sale.dto.ts`). New/changed query DTOs should cap it (e.g. `@Max(100)` from `class-validator`) to avoid unbounded result sets.

Offset example (matches current repo style):

```sql
order by created_at desc
limit $1 offset $2
```

Offset example with tie-breaker (prefer this for new paginated queries):

```sql
where account_id = $1
order by created_at desc, id desc
limit $2 offset $3
```

## Review Checklist

- Tables, columns, constraints, and indexes follow naming conventions.
- Primary keys are UUIDs generated by the application layer via `GUID_PROVIDER`.
- Auditable tables include `created_at` and `updated_at` as `timestamptz`.
- New tables needing an audit trail/undo use `deleted_at`; otherwise stick to hard delete, consistent with the rest of the schema.
- Foreign keys, unique constraints, and checks protect durable invariants.
- New queries use explicit columns (not `select *`), explicit joins, and parameterized values.
- Pagination has deterministic ordering (with a tie-breaker) and a bounded `limit`.
- New query patterns have matching indexes added in the same migration.
- Multi-table writes that must succeed/fail together are wrapped in a real transaction (`BEGIN`/`COMMIT`/`ROLLBACK` via `PostgresService.getClient()`).
- Business rules remain in the service/facade layer, with the database enforcing atomic integrity (FKs, constraints, transactions).
