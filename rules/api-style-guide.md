---
name: api-style-guide
description: Specialist in RESTful API design following rigorous resource modeling standards, command-based versioning, and stable pagination, for this NestJS backend.
---

# API Style Guide

> **Nota de aderência ao repositório:** este backend **não** segue Clean Architecture (não há camadas `use-cases`/`domain`/`infrastructure` separadas nem classes `*UseCase`). O padrão real é módulo NestJS por feature: `Controller` fino → `Service`/`Facade` (que contém regra de negócio **e** acesso a dados via `PostgresService`) → Postgres. Trate os trechos de "Clean Architecture"/"use case" abaixo como direção aspiracional para novo código complexo, não como descrição do que já existe — ver `AGENTS.md` para o fluxo real. O arquivo `api-endpoints.md` referenciado abaixo não existe neste repositório; ignore essa referência até que ele seja criado.

Use this guide when designing or reviewing HTTP contracts. It defines the resource modeling and REST semantics expected by this backend.

## Responsibilities

- Guide REST resource modeling with plural English names and kebab-case paths.
- Separate CRUD-style updates from business commands.
- Standardize success responses, error responses, pagination envelopes, and pagination links.
- Apply HTTP status codes according to operation semantics.
- Keep NestJS DTO validation and HTTP controllers aligned with Clean Architecture.
- Define integration contracts between frontend/backend or service/service boundaries.

## When to Use

- Creating new HTTP modules, controllers, or route groups.
- Changing frontend-facing DTOs, presenters, or response contracts.
- Reviewing endpoints for weak resource modeling or inconsistent semantics.
- Designing contracts between this backend and another service.
- Adding pagination, command endpoints, version checks, or external-call resilience.

## Mandatory Standards

- Use plural resource names in English and kebab-case.
- Correct: `/customer-invoices`.
- Incorrect: `/customerInvoices` or `/customer_invoices`.
- Keep route hierarchy to at most two nesting levels, such as `/customers/:customerId/invoices`.
- For deeper relationships, prefer query parameters or a higher-level resource.
- Prefer `PATCH` for partial resource updates on **new** endpoints. **Nota:** `src/users/users.controller.ts:53` and `src/clients/clients.controller.ts:65` already expose `PUT :id` for full-resource replacement — that is existing, shipped behavior; do not change it opportunistically (it would break existing clients). For genuinely partial updates, this repo already has the right precedent to copy: `PATCH :id/change-password` (`users.controller.ts:66`) and `PATCH items/:id/update-purchase-date` (`billings.controller.ts:73`).
- Use command endpoints for business actions: `POST /resources/:id/action-name`. **Nota:** this repo does not yet have a command-style endpoint (the closest is `PATCH :id/pay` in `billings.controller.ts:52`, which is `PATCH` rather than `POST`) — treat the `POST .../action-name` form as the target for genuinely new business actions going forward, and don't rename the existing `pay` route without confirming API consumers.
- If a resource exists but does not belong to the authenticated user or tenant, return `404 Not Found` instead of `403 Forbidden` to avoid information leaks.
- Paginated responses must return `data`, `meta`, and `links` for new external contracts.
- Validate `page` and `limit`; `limit` must be capped at `100`.
- Every paginated persistence query must have deterministic sorting and a matching database index.
- Controllers must handle HTTP protocol concerns only. Business rules belong in use cases and domain services.
- DTOs must validate input at the boundary and must not become domain models.

## Resource Modeling

Use resource paths for entities and collections:

```text
GET /v1/customer-invoices
GET /v1/customer-invoices/:invoiceId
POST /v1/customer-invoices
PATCH /v1/customer-invoices/:invoiceId
```

Use command paths when the operation represents a business transition rather than a generic field update:

```text
POST /v1/customer-invoices/:invoiceId/cancel
POST /v1/customer-invoices/:invoiceId/retry-payment
POST /v1/customer-invoices/:invoiceId/send-email
```

Avoid action verbs for normal CRUD:

```text
POST /v1/createCustomerInvoice
POST /v1/customer-invoices/:invoiceId/update
```

## HTTP Status Codes

- `200 OK`: successful read, partial update, or command returning a response body.
- `201 Created`: successful creation of a new resource.
- `202 Accepted`: asynchronous command accepted for later processing.
- `204 No Content`: successful operation with no response body.
- `400 Bad Request`: malformed request or invalid primitive input.
- `401 Unauthorized`: missing or invalid authentication.
- `403 Forbidden`: authenticated caller lacks permission and the resource existence can be safely disclosed.
- `404 Not Found`: resource is missing or does not belong to the current tenant/user.
- `409 Conflict`: version conflict, duplicate unique resource, invalid state transition, insufficient balance, or stale operation.
- `422 Unprocessable Entity`: valid syntax but failed business precondition or validation mapped by the application.

## Pagination Contract

New paginated endpoints should use page-based pagination — matches this repo's existing convention (`page`/`perPage`, e.g. `src/users/dto/query-user.dto.ts`, `src/sales/dto/query-sale.dto.ts`).

Query parameters:

- `page`: default `1`, minimum `1` (already the pattern — see `QueryUserDto` constructor).
- `limit`/`perPage`: default `20` here, **but every current query DTO defaults to `10` and none enforce a maximum** (`src/users/dto/query-user.dto.ts:26`, `src/sales/dto/query-sale.dto.ts`). Don't silently change the default on existing endpoints; do add a `@Max(100)` validator (see the DTO example below) to any query DTO you touch, since none have one today.

Response shape used by every existing endpoint in this repo — `data` + `meta`, **no `links`**:

```ts
{
  data: items,
  meta: {
    page,
    perPage,
    total,
  },
}
```

(see `src/users/users.service.ts:96-103`, `src/sales/sales.service.ts:114-119`). A `links` block (`first`/`prev`/`next`/`last`) is not implemented anywhere in this codebase. Only add `links` for a genuinely new external-facing contract where a consumer needs it — do not retrofit it onto the existing internal endpoints listed above, since that would be a breaking response-shape change for current clients.

Rules:

- If `links` is added for a new contract, `links.prev` and `links.next` must be `null` when the page does not exist.
- Align the query with a deterministic `ORDER BY`; this repo's existing `orderBy` whitelists (`SALES_ORDER_BY_COLUMNS`, `USERS_ORDER_BY_COLUMNS`) don't add an `id` tie-breaker — add one for new/changed queries.
- Ensure the database has an index that supports the filter and ordering (see `rules/postgres-guideline.md`).

## NestJS Controller Example

This repo's controllers are thin and delegate to a `*Service` (or an orchestration service/facade for multi-step operations, e.g. `NewSaleService`, `PayBillingService`) — there is no `*UseCase` naming convention here:

```ts
import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Query } from '@nestjs/common';
import { User, UserSession } from 'src/signin/decorators/user.decorator';

@Controller('scheduled-events')
export class ScheduledEventsController {
  constructor(private readonly scheduledEventsService: ScheduledEventsService) {}

  @Patch(':id/cancel')
  @HttpCode(HttpStatus.OK)
  async cancel(
    @User() user: UserSession,
    @Param('id') id: string,
    @Body() dto: CancelEventDto,
  ) {
    return this.scheduledEventsService.cancel({ ...dto, id, accountId: user.accountId });
  }

  @Get()
  async list(@User() user: UserSession, @Query() query: QueryScheduledEventDto) {
    return this.scheduledEventsService.findAll({ ...query, accountId: user.accountId });
  }
}
```

## DTO Validation Example

```ts
import { Transform } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

export class PaginationQueryDto {
  @Transform(({ value }) => Number.parseInt(value ?? '1', 10))
  @IsInt()
  @Min(1)
  page = 1;

  @Transform(({ value }) => Number.parseInt(value ?? '20', 10))
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}
```

## External Call Resilience

**Nota de aderência ao repositório:** este backend não tem, hoje, nenhuma chamada a serviço externo (sem `HttpModule`, sem `axios`/`fetch`, sem gateway de infraestrutura). Esta seção é orientação para quando a primeira integração externa for adicionada — não descreve nada existente.

- Keep outbound integration contracts behind a dedicated provider/adapter (mirroring how `GUID_PROVIDER`/`HASHING_PROVIDER` are abstracted behind an interface + DI token in `src/libs/`), not called directly from a controller.
- Use timeouts and explicit retry policy for idempotent external calls.
- Use idempotency keys for commands that may be retried by clients or workers.
- Map external errors to application errors (`BadRequestException`, etc.) before they reach the controller/response.

## Review Checklist

- Path uses plural English resource names and kebab-case.
- Route hierarchy has at most two nesting levels.
- New partial-update endpoints use `PATCH`; existing `PUT` endpoints (`users`, `clients`) are left as-is unless explicitly asked to change. New business transitions use command-style `POST` where practical.
- Account-owned missing/foreign resources return `404` (checked via post-fetch `account_id` comparison, not just a `WHERE` clause).
- DTOs validate params, query, and body values at the HTTP boundary (`class-validator` + global `ValidationPipe`).
- Controllers delegate business behavior to the service/facade — no SQL or business rules in the controller.
- Output DTOs (`static fromTable(row)`) own response mapping and do not leak raw DB rows (`*Table` interfaces) to the client.
- Paginated responses match the existing `{ data, meta }` shape unless the endpoint is a genuinely new external contract that needs `links`.
- Paginated queries have deterministic sorting (with a tie-breaker) and a supporting database index.
- Swagger decorators (`@ApiTags`, `@ApiBearerAuth`, `@ApiProperty`) and tests match the actual route contract.
