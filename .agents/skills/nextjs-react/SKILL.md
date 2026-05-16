---
name: nextjs-react
description: "Use for ANY task involving Next.js or React in this project. Triggers: App Router, Server Components, Client Components, Server Actions, Route Handlers, middleware, next.config.ts, layouts, pages, loading/error boundaries, React 19 features, hooks, context, TanStack Query data fetching, shadcn/ui components, Tailwind CSS v4, TypeScript strict mode, Zod validation, react-hook-form, recharts, lucide-react."
metadata:
  author: la-sentadita-hub
  version: "1.0.0"
---

# Next.js / React Skill — La Sentadita Hub

Stack: **Next.js 16 (App Router) · React 19 · TypeScript 5 · Tailwind CSS v4 · TanStack Query v5 · shadcn/ui · Zod v4 · react-hook-form v7**

## Architecture Rules

### Server vs Client Components
- Default to **Server Components** — never add `"use client"` unless required.
- Client component triggers: `useState`, `useEffect`, `useRef`, browser APIs, event handlers, `useFormState`, real-time subscriptions.
- Keep Client Components **leaf nodes** — push server data down as props, not fetched inside the client component.
- Never `import` a server-only module inside a client component (`import 'server-only'` guards this).

### Data Fetching Pattern
```ts
// ✅ Server Component — direct async/await
async function EmployeeList() {
  const employees = await getEmployees(); // server action or direct DB call
  return <EmployeeTable data={employees} />;
}

// ✅ Client Component — TanStack Query
"use client";
function ScheduleView() {
  const { data } = useQuery({ queryKey: ['schedule'], queryFn: fetchSchedule });
}
```

### Server Actions
- Always validate input with **Zod** before any DB operation.
- Return typed `{ success, data?, error? }` shapes — never throw from Server Actions.
- Mark files with `"use server"` at the top or annotate individual functions.

```ts
// ✅ Correct pattern
"use server";
export async function createEmployee(raw: unknown) {
  const parsed = CreateEmployeeSchema.safeParse(raw);
  if (!parsed.success) return { success: false, error: parsed.error.flatten() };
  // ... DB operation
  revalidatePath('/employees');
  return { success: true };
}
```

### Route Handlers
- Use `NextRequest`/`NextResponse` — don't use raw `Request`.
- Always authenticate via Supabase session before handling the request.
- Return proper HTTP status codes (401, 403, 404, 422, 500).

### Middleware
- Located at `src/middleware.ts`.
- Use Supabase `@supabase/ssr` for session refresh in middleware.
- Guard all protected routes — never rely solely on client-side redirects.

## Component Patterns

### Forms with react-hook-form + Zod
```tsx
const schema = z.object({ name: z.string().min(1) });
type FormData = z.infer<typeof schema>;

function MyForm() {
  const form = useForm<FormData>({ resolver: zodResolver(schema) });
  const onSubmit = form.handleSubmit(async (data) => {
    const result = await serverAction(data);
    if (!result.success) form.setError('root', { message: result.error });
  });
}
```

### shadcn/ui Components
- Use components from `@/components/ui/*` — don't install raw Radix primitives directly.
- `cn()` from `@/lib/utils` for conditional class merging (clsx + tailwind-merge).
- Follow existing component patterns in `src/components/`.

### Tables with TanStack Table
- Project already uses `@tanstack/react-table` — use it for any data table feature.
- Check `src/components/` for existing table components before creating new ones.

## Performance

- Use `next/image` for all images — never raw `<img>` tags.
- Prefer `next/link` over `<a>` for internal navigation.
- `React.memo` / `useMemo` / `useCallback` only when profiling shows it helps — don't add preemptively.
- Use `Suspense` boundaries with meaningful `fallback` UI for async Server Components.
- `loading.tsx` files for route-level skeleton states.

## TypeScript Rules

- `strict: true` is enabled — no `any`, no `as any`.
- Use `z.infer<typeof Schema>` to derive types from Zod schemas — don't duplicate type definitions.
- Prefer `interface` for object shapes, `type` for unions/intersections.
- Use `satisfies` operator to validate config objects against types without widening.

## Environment Variables

- Server-only vars: plain `VARIABLE_NAME` — never prefix with `NEXT_PUBLIC_`.
- Client vars: `NEXT_PUBLIC_VARIABLE_NAME` — anything here is public.
- Always validate with `@t3-oss/env-nextjs` in `src/env.ts` (or equivalent).

## Tailwind CSS v4

- Config is PostCSS-based (`postcss.config.mjs`) — no `tailwind.config.js`.
- Use `tw-animate-css` for animations — don't add custom keyframes unless necessary.
- `tailwind-merge` via `cn()` — always merge classes through `cn()`, never string concatenate.

## Common Pitfalls

- `cookies()` and `headers()` are async in Next.js 15+ — always `await` them.
- Never call `getUser()` in middleware — use `getSession()` for performance; validate user in Server Components.
- `revalidatePath()` and `revalidateTag()` only work in Server Actions and Route Handlers.
- `"use client"` propagates down — one client boundary makes all descendants client components.
