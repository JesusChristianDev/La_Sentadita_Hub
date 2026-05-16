---
name: spec-planning
description: "Use for product planning, feature specification, and technical design. Triggers: designing new features, writing specs, planning sprints, breaking down requirements, creating technical designs, estimating complexity, defining acceptance criteria, planning database schema changes, mapping user flows."
metadata:
  author: la-sentadita-hub
  version: "1.0.0"
---

# Spec & Product Planning Skill — La Sentadita Hub

## Product Context

La Sentadita Hub is a workforce management SaaS for restaurant/hospitality businesses (La Sentadita brand). Core domains:

- **Employees:** Profiles, roles, contracts, skills
- **Schedule:** Weekly shift scheduling, draft → published → locked lifecycle
- **Auth:** Role-based access (admin, manager, employee)
- **Notifications:** Push notifications via Web Push API (web-push library)
- **Analytics:** Recharts dashboards for hours, costs, attendance

## Feature Spec Template

```markdown
# Feature: [Name]

## Problem
[1-2 sentences on the user pain point]

## Goal
[What success looks like — measurable if possible]

## Users & Roles
- **Admin:** [what they can do]
- **Manager:** [what they can do]
- **Employee:** [what they can do]

## User Flow
1. User navigates to [page]
2. [Action]
3. [Result/feedback]

## Acceptance Criteria
- [ ] [Specific testable condition]
- [ ] [Specific testable condition]

## Out of Scope
- [What this feature does NOT cover]

## Technical Design

### DB Changes
```sql
-- New tables or columns
```

### New Routes/Pages
- `app/(protected)/[route]/page.tsx`

### New Server Actions
- `createX(input): Promise<Result<X>>`

### API Contracts
```ts
type CreateXInput = z.infer<typeof CreateXSchema>;
type CreateXResult = { success: boolean; data?: X; error?: FormError };
```

### Components
- `XForm` — Client, uses react-hook-form
- `XList` — Server, fetches from DB directly
- `XCard` — Client, interactive

## Complexity Estimate
| Task | Points |
|------|--------|
| DB migration | 1 |
| Server Action | 2 |
| UI Components | 3 |
| Tests | 2 |
| **Total** | **8** |
```

## Technical Design Principles

### Before Writing Code
1. Define the DB schema change first — schema drives everything.
2. Define the Zod validation schema — it becomes the source of truth for types.
3. Define the Server Action contracts — what goes in, what comes out.
4. Then build UI.

### Schema Change Checklist
- [ ] RLS policies for new tables
- [ ] Indexes on foreign keys and frequently filtered columns
- [ ] Migration file: `supabase migration new <name>`
- [ ] TypeScript types regenerated: `supabase gen types typescript`

### Data Flow Design
```
User Input → Zod Schema → Server Action → DB → revalidatePath → Re-render
                ↓ error
          Form error state → User feedback
```

### Role-Based Access Design
Define access matrix before implementation:

| Action | Admin | Manager | Employee |
|--------|-------|---------|----------|
| View schedule | ✓ | ✓ | Own only |
| Create schedule | ✓ | ✓ | ✗ |
| Publish schedule | ✓ | ✓ | ✗ |
| Edit own profile | ✓ | ✓ | ✓ |

Enforce at: **RLS (DB level)** + **Server Action (app level)** + **UI (hide buttons)**.
All three layers — never rely on UI alone.

## Breaking Down Work

For a typical feature (e.g., "Employee vacation requests"):
1. **DB:** `vacation_requests` table + RLS migration (1 day)
2. **Types:** Zod schema + TypeScript types (0.5 day)
3. **Server Actions:** create, approve, reject (1 day)
4. **UI — Employee:** Request form + list view (1.5 days)
5. **UI — Manager:** Approval dashboard (1 day)
6. **Notifications:** Push on approval/rejection (0.5 day)
7. **Tests:** Unit + E2E (1 day)
8. **Total:** ~6.5 days

## Sprint Planning Format

```markdown
## Sprint N — [Theme]

### Goal
[One sentence on the sprint's primary objective]

### Features
- [ ] [Feature A] — [X pts]
- [ ] [Feature B] — [X pts]

### Tech Debt
- [ ] [Item] — [X pts]

### Capacity
[Team size × days × velocity] = [X pts]

### Done Definition
- All unit + integration tests pass
- E2E tests pass for new flows
- No new TypeScript errors
- No new ESLint warnings
- Deployed to staging and smoke-tested
```
