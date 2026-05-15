---
name: testing
description: "Use for ANY testing task in this project. Triggers: writing tests, fixing failing tests, test coverage, Playwright E2E tests, Vitest unit tests, Node.js built-in test runner, @testing-library/react, jsdom, test utilities, mocking, fixtures, test configuration (playwright.config.ts, vitest.config.ts, tsconfig.unit-tests.json)."
metadata:
  author: la-sentadita-hub
  version: "1.0.0"
---

# Testing Skill — La Sentadita Hub

Stack: **Playwright 1.58 (E2E) · Vitest 4 (integration) · Node.js built-in test runner (unit) · @testing-library/react 16 · jsdom**

## Test Types and When to Use Each

| Type | Tool | Location | Purpose |
|------|------|----------|---------|
| Unit | Node.js `--test` | `src/**/*.test.ts` | Pure business logic, no DOM |
| Integration | Vitest | `src/**/*.test.tsx` | React components, hooks |
| E2E | Playwright | `tests/**/*.spec.ts` | Full user flows |

## Unit Tests (Node.js built-in runner)

The project compiles unit tests via `tsconfig.unit-tests.json` → `.unit-test-dist/`.

```ts
// src/modules/schedule/application/shiftValidation.test.ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateShift } from './shiftValidation';

describe('validateShift', () => {
  it('rejects overlapping shifts', () => {
    const result = validateShift({ start: '09:00', end: '17:00' }, existing);
    assert.equal(result.valid, false);
  });
});
```

**Key rules:**
- Import from `node:test` and `node:assert/strict` — not Jest.
- Add new test files to `test:unit:run` script in `package.json`.
- No DOM, no React — pure TypeScript functions only.

## Vitest Tests (component/integration)

Config: `vitest.config.ts` with jsdom environment.

```tsx
// src/components/EmployeeCard.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';

describe('EmployeeCard', () => {
  it('shows employee name', () => {
    render(<EmployeeCard employee={mockEmployee} />);
    expect(screen.getByText('Juan García')).toBeInTheDocument();
  });

  it('calls onEdit when button clicked', async () => {
    const onEdit = vi.fn();
    render(<EmployeeCard employee={mockEmployee} onEdit={onEdit} />);
    await userEvent.click(screen.getByRole('button', { name: /editar/i }));
    expect(onEdit).toHaveBeenCalledWith(mockEmployee.id);
  });
});
```

**Key rules:**
- Use `@testing-library/user-event` for interactions — not `fireEvent`.
- Query by role, label, or text — never by `data-testid` unless unavoidable.
- Mock Server Actions with `vi.mock()` — never make real DB calls in Vitest.
- Wrap TanStack Query tests in `QueryClientProvider`.

## Playwright E2E Tests

Config: `playwright.config.ts`. Tests in `tests/` directory.

```ts
// tests/schedule/create-shift.spec.ts
import { test, expect } from '@playwright/test';

test('manager can create a new shift', async ({ page }) => {
  await page.goto('/schedule');
  await page.getByRole('button', { name: /agregar turno/i }).click();
  await page.getByLabel('Empleado').selectOption('Juan García');
  await page.getByLabel('Hora inicio').fill('09:00');
  await page.getByLabel('Hora fin').fill('17:00');
  await page.getByRole('button', { name: /guardar/i }).click();
  await expect(page.getByText('Turno creado')).toBeVisible();
});
```

**Key rules:**
- Use Playwright's built-in locators — `getByRole`, `getByLabel`, `getByText`.
- Avoid `page.waitForTimeout()` — use `expect(...).toBeVisible()` or `waitFor`.
- Create fixtures for auth state — don't log in via UI in every test.
- Use `test.describe.serial()` only when tests genuinely depend on order.
- Run `pnpm test:e2e` to execute; `pnpm test:e2e:ui` for interactive mode.

## Auth Fixtures for Playwright

```ts
// tests/fixtures/auth.ts
import { test as base } from '@playwright/test';

export const test = base.extend({
  managerPage: async ({ browser }, use) => {
    const ctx = await browser.newContext({ storageState: 'tests/.auth/manager.json' });
    await use(await ctx.newPage());
    await ctx.close();
  },
});
```

Pre-populate `tests/.auth/manager.json` via a `globalSetup` that logs in once and saves cookies.

## Mocking Supabase

```ts
// For Vitest — mock the Supabase client
vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockResolvedValue({ data: mockData, error: null }),
  })),
}));
```

## Test Running Commands

```bash
pnpm test:unit          # Compile + run Node.js unit tests
pnpm test:vitest        # Run Vitest integration tests
pnpm test:vitest:watch  # Watch mode
pnpm test:e2e           # Playwright E2E (requires running server)
pnpm test:e2e:ui        # Playwright interactive UI
```

## Coverage and Quality

- Aim for 100% coverage on pure business logic in `src/modules/*/application/`.
- E2E tests for critical paths: auth flow, schedule creation, employee management.
- Never test implementation details — test behavior from the user's perspective.
- Keep tests fast: unit < 10ms each, Vitest < 5s total, E2E < 30s per test.

## Common Pitfalls

- `await userEvent.setup()` is required in `@testing-library/user-event` v14 — use `const user = userEvent.setup()` not the default export directly.
- Playwright `expect` is auto-retrying — `toBeVisible()` waits; `not.toBeVisible()` also waits for disappearance.
- Don't test Zod schemas directly — test the functions that use them.
- `vi.clearAllMocks()` in `afterEach` — or use `clearMocks: true` in vitest.config.ts.
