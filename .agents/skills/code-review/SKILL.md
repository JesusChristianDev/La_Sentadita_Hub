---
name: code-review
description: "Use when reviewing, refactoring, or improving code quality in this project. Triggers: code review requests, refactoring, improving readability, removing duplication, simplifying logic, improving TypeScript types, cleaning up imports, dead code removal, performance improvements, accessibility improvements."
metadata:
  author: la-sentadita-hub
  version: "1.0.0"
---

# Code Review / Refactor Skill — La Sentadita Hub

## Review Checklist

### TypeScript Quality
- [ ] No `any` — use `unknown` + type guard, or proper generics
- [ ] No type assertions (`as SomeType`) unless unavoidable and commented
- [ ] Zod schemas derived types with `z.infer<>` — no duplicate type definitions
- [ ] Return types explicit on exported functions
- [ ] No unused imports (caught by `eslint-plugin-unused-imports`)
- [ ] Imports sorted correctly (caught by `eslint-plugin-simple-import-sort`)

### React / Next.js Quality
- [ ] No unnecessary `"use client"` — verify component actually needs it
- [ ] No `useEffect` for data fetching — use TanStack Query or Server Components
- [ ] No `any` in `useState<any>()` — type the state
- [ ] Keys in lists are stable IDs — not array indexes
- [ ] Images use `next/image`, internal links use `next/link`
- [ ] No direct `document` / `window` access without `typeof window !== 'undefined'` guard

### Code Simplicity
- [ ] Functions do one thing — extract if logic branches into multiple concerns
- [ ] No commented-out code
- [ ] No dead code / unreachable branches
- [ ] Early returns instead of deep nesting
- [ ] No magic numbers — use named constants
- [ ] Consistent naming: `is`/`has`/`can` for booleans, `handle` prefix for event handlers

### Duplication
- [ ] Extract repeated logic into a shared utility in `src/lib/`
- [ ] Repeated UI patterns → shared component in `src/components/`
- [ ] Repeated query patterns → shared hook in `src/hooks/`

### Error Handling
- [ ] Server Actions return typed `{ success, data?, error? }` — never throw
- [ ] API route handlers always return proper HTTP status codes
- [ ] User-facing errors are localized (Spanish)
- [ ] No silent catches — `catch (e) {}` must at minimum log the error

## Refactoring Patterns

### Extract complex conditions
```ts
// ❌ Hard to read
if (employee.role === 'manager' && schedule.status === 'draft' && !schedule.lockedAt) {

// ✅ Named predicate
const canEditSchedule = (e: Employee, s: Schedule) =>
  e.role === 'manager' && s.status === 'draft' && !s.lockedAt;
if (canEditSchedule(employee, schedule)) {
```

### Replace boolean flags with union types
```ts
// ❌ Flag soup
type Schedule = { isDraft: boolean; isPublished: boolean; isLocked: boolean };

// ✅ Discriminated union
type ScheduleStatus = 'draft' | 'published' | 'locked';
type Schedule = { status: ScheduleStatus };
```

### Flatten nested async
```ts
// ❌ Nested
async function getShifts() {
  const { data: employees } = await supabase.from('employees').select();
  if (employees) {
    const { data: shifts } = await supabase.from('shifts').select();
    if (shifts) { return combine(employees, shifts); }
  }
}

// ✅ Flat
async function getShifts() {
  const [{ data: employees }, { data: shifts }] = await Promise.all([
    supabase.from('employees').select(),
    supabase.from('shifts').select(),
  ]);
  if (!employees || !shifts) return null;
  return combine(employees, shifts);
}
```

### Remove prop drilling
- If props pass through 3+ components, move to Context or TanStack Query cache.
- Don't create context for data that changes per render — use props.

## Performance Review

- Check for unnecessary re-renders: `React.memo` on expensive pure components.
- Verify `useCallback` is used for callbacks passed to `React.memo`-ized children.
- Check for N+1 queries: batch DB calls, use Supabase joins.
- Verify `Suspense` boundaries isolate slow data fetches.

## Accessibility Review

- Interactive elements have accessible names (via label, aria-label, aria-labelledby).
- Color is not the only indicator of state.
- Focus order is logical.
- Error messages are associated with inputs (`aria-describedby`).
- Buttons vs links used correctly: buttons for actions, links for navigation.

## Run Before Approving

```bash
pnpm lint          # ESLint
pnpm lint:fix      # Auto-fix
pnpm test:unit     # Unit tests
pnpm test:vitest   # Integration tests
```
