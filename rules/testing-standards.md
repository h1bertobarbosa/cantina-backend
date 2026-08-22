---
name: testing-standards
description: Enforces senior-level testing practices using Jest and optional Sinon, focusing on isolation, cleanup, deterministic inputs, and the AAA pattern.
license: MIT
---

# Testing Standards

Use this guide when creating, changing, or reviewing unit, integration, controller, repository, and e2e tests.

This project uses Jest (`@swc/jest` for unit specs, `ts-jest` for e2e — see `package.json`) as the test runner. `*.spec.ts` unit specs live beside implementation under `src/`; e2e specs live under `test/` (config in `test/jest-e2e.json`).

> **Nota de aderência ao repositório:**
> - **Sinon is not installed** in this project (no `sinon` in `package.json`). The Sinon guidance below only applies if a future suite explicitly adds the dependency — default to plain Jest mocks (`jest.fn()`, `jest.spyOn()`), which is what this repo's tooling actually supports today.
> - There is no `test/factories/` directory yet — most existing specs (`src/sales/sales.service.spec.ts`, `src/clients/clients.service.spec.ts`) only instantiate the service and assert `toBeDefined()`, with no mocked dependencies, no AAA structure, and no real behavioral coverage. That is test debt to fix when touching those files (see `AGENTS.md` section 6), not a pattern to copy. When you add real coverage, it's fine to introduce `test/factories/` per this guide's convention since none of the current specs need complex object graphs yet.
> - `job` specs mentioned below are aspirational — there are no background jobs/workers in this repo currently (no queue/cron dependency in `package.json`).

## When to Use

- Creating new unit, integration, controller, repository, job, or e2e tests.
- Refactoring existing tests to reduce flakiness.
- Reviewing pull requests for testing quality.
- Implementing business logic that requires high behavioral confidence.
- Changing persistence, HTTP contracts, auth, jobs, or concurrency-sensitive flows.

## Core Principles

- Prefer behavioral safety over line coverage.
- Tests must be deterministic and independent.
- Each test must control its own mocks, data, clock, and expected side effects.
- Follow Arrange / Act / Assert.
- Verify one behavior per test. Multiple assertions are acceptable only when they describe the same behavior.
- Test through public APIs of the unit under test. Avoid asserting private implementation details.
- Business logic branches belong in unit tests; infrastructure wiring belongs in integration/e2e tests.

## Tooling and Cleanup

- Use Jest as the runner and default mocking tool.
- Use Sinon only when a suite explicitly needs Sinon APIs and the dependency is available.
- If using Sinon, create a `SinonSandbox` in `beforeEach` and call `sandbox.restore()` in `afterEach`.
- Always restore Jest spies and fake timers after each test with `jest.restoreAllMocks()` / `jest.clearAllMocks()` and `jest.useRealTimers()` when timers are used.
- Use only one fake timer system in a test file: Jest timers or Sinon timers. Never mix both.
- Do not let mocked global state leak across tests.

## Test Location

- Place fast unit specs next to the implementation as `*.spec.ts` under `src/`.
- Place cross-module, HTTP, e2e, database harness, and shared test infrastructure under `test/`.
- Put reusable test factories/builders under `test/factories/` or a nearby test support module when they are module-local.
- Do not add test-only helpers to production source paths unless they are explicitly part of a public test support boundary.

## AAA Structure

Use clear Arrange / Act / Assert sections for non-trivial tests:

```ts
it('rejects payment when the credit card is expired', async () => {
  // Arrange
  const user = buildUser({ cardStatus: 'expired' });
  const repository = {
    save: jest.fn(),
  };
  const useCase = new ProcessPaymentUseCase(repository);

  // Act & Assert
  await expect(useCase.execute(user)).rejects.toThrow(PaymentRejectedError);
  expect(repository.save).not.toHaveBeenCalled();
});
```

Rules:

- Keep setup close to the behavior being tested.
- Move repetitive object creation into factories.
- Keep assertions specific to the expected behavior.
- Avoid tests that pass on any thrown error. Assert the expected error class, message, or stable application code.

## Unit Tests

Unit tests target domain services, use cases, policies, presenters, guards, and small infrastructure helpers.

Rules:

- Do not access the network, database, filesystem, queues, or external APIs.
- Stub ports and gateway interfaces.
- Freeze time when current time affects behavior.
- Stub ID generation or randomness when exact assertions depend on it.
- Cover business branches, errors, side effects, and idempotency decisions.
- Keep tests fast enough to run frequently during development.

## Integration and Repository Tests

Integration tests validate real adapters and boundaries.

Rules:

- Use the project database harness for PostgreSQL-backed repository or migration behavior.
- Keep database state isolated per test or suite.
- Assert persistence side effects through public repository behavior, not by duplicating implementation logic.
- Cover constraints, transactions, idempotency, locking, pagination ordering, and mapping boundaries when those are part of the change.
- Do not re-test every domain branch already covered by unit tests.

## HTTP and E2E Tests

HTTP/e2e tests validate route wiring, guards, filters, serialization, and real contract behavior.

Rules:

- Exercise real HTTP behavior when the full stack is part of the risk.
- Use e2e tests for auth, tenancy, global filters, middleware, persistence-heavy flows, and route contract smoke coverage.
- Use controller specs for route wiring, DTO mapping, role checks, presenter calls, and use case delegation.
- For e2e tests, cover happy paths and contract failures such as `400`, `401`, `403`, `404`, and `409`.
- Do not duplicate complex business branch coverage in e2e when unit tests already own it.

## Deterministic Time and Randomness

- Use `jest.useFakeTimers().setSystemTime(...)` when code depends on current time.
- Always return to real timers in `afterEach`.
- Stub UUID, token, random, or hash generation when exact values are asserted.
- Avoid sleeps and arbitrary timeouts. Prefer controlled promises, fake timers, or explicit readiness checks.

Example:

```ts
beforeEach(() => {
  jest.useFakeTimers().setSystemTime(new Date('2026-05-05T12:00:00.000Z'));
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});
```

## Test Data

- Use factories/builders for domain objects, DTOs, and persistence rows that appear in multiple tests.
- Set only fields relevant to the scenario; let factories provide safe defaults.
- Keep factory defaults valid and boring.
- Prefer named scenario builders over large inline objects.
- Avoid sharing mutable test objects between tests.

## Assertion Depth

A strong test checks the exact observable behavior:

- State assertion: returned value or persisted state.
- Behavior assertion: collaborator was called with the expected payload.
- Error assertion: expected class, message, or stable error code.
- Side-effect assertion: event, job, email, ledger entry, or outbox write happened exactly as expected.
- Negative assertion: important side effects did not happen when the operation fails.

Use precise expectations:

```ts
expect(repository.save).toHaveBeenCalledTimes(1);
expect(repository.save).toHaveBeenCalledWith(
  expect.objectContaining({
    status: 'cancelled',
  }),
);
```

## Review Checklist

- Test file is in the correct location for its scope.
- Test name describes behavior, not implementation.
- Arrange / Act / Assert structure is clear.
- Test is isolated and does not depend on another test.
- Mocks, spies, timers, and sandbox state are restored.
- Unit tests do not touch external boundaries.
- Integration tests use real adapters only where that risk matters.
- Error tests assert the specific expected failure.
- Time, randomness, IDs, and generated data are deterministic.
- New use cases, repository behavior, migrations, controllers, jobs, and presenters have focused coverage.
