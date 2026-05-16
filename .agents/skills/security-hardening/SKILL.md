---
name: security-hardening
description: "ALWAYS use for any task touching authentication, authorization, database access, API routes, environment variables, user data, file uploads, or external integrations. Also triggers for: security reviews, RLS policies, CSRF protection, XSS prevention, SQL injection prevention, secrets management, session handling, permissions, role-based access control."
metadata:
  author: la-sentadita-hub
  version: "1.0.0"
---

# Security Hardening Skill — La Sentadita Hub

**CRITICAL: Apply this skill for any feature touching auth, data access, or user input.**

## Authentication Security (Supabase Auth)

### Session Handling
```ts
// ✅ Always use getUser() in Server Components/Actions — validates JWT server-side
const { data: { user }, error } = await supabase.auth.getUser();
if (!user || error) redirect('/login');

// ❌ Never trust getSession() for authorization — session may be stale
const { data: { session } } = await supabase.auth.getSession(); // only for reading, not authz
```

### Middleware Auth
```ts
// src/middleware.ts — refresh session on every request
export async function middleware(request: NextRequest) {
  const supabase = createServerClient(/* ... */);
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session && isProtectedRoute(request.nextUrl.pathname)) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
}
```

### JWT Claims Safety
- **NEVER** use `user_metadata` / `raw_user_meta_data` for authorization — users can self-edit these.
- Use `app_metadata` / `raw_app_meta_data` for roles and permissions — only server can write these.
- `auth.jwt() ->> 'user_metadata'` in RLS = **critical vulnerability**.

```sql
-- ❌ Dangerous — user can set their own role
CREATE POLICY "managers only" ON schedules
  USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'manager');

-- ✅ Safe — app_metadata is server-controlled
CREATE POLICY "managers only" ON schedules
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'manager');
```

## Database Security (RLS)

### RLS — Non-Negotiable Rules
1. **Enable RLS on every table** in the `public` schema.
2. **No table without at least one policy** — default deny all.
3. **Views bypass RLS** — use `security_invoker = true` or put in private schema.
4. **Functions default to `security definer`** — use `security invoker` or `SET search_path = ''`.

```sql
-- Enable RLS
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

-- ✅ Parameterized via auth.uid() — injection-safe
CREATE POLICY "employees_own_data" ON employees
  FOR ALL USING (auth.uid() = user_id);

-- ✅ Manager sees their org's employees
CREATE POLICY "manager_sees_org_employees" ON employees
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM employees WHERE user_id = auth.uid()
    )
  );
```

### SQL Injection Prevention
- **Never** concatenate user input into SQL — always use parameterized queries.
- Supabase client `.from().select().eq()` chain is parameterized — safe.
- For raw SQL via `supabase.rpc()`, use named parameters: `{ param: value }`.

```ts
// ✅ Safe — parameterized
const { data } = await supabase
  .from('employees')
  .select()
  .eq('organization_id', orgId); // orgId is parameterized

// ❌ Never do this — SQL injection
const { data } = await supabase.rpc('get_employees', {
  query: `WHERE org = '${userInput}'` // VULNERABLE
});
```

### Sensitive Columns
```sql
-- Restrict sensitive columns at DB level
CREATE POLICY "employees_read_basic" ON employees
  FOR SELECT USING (auth.uid() = user_id)
  WITH CHECK (true);

-- Employees cannot see their own salary column
GRANT SELECT (id, name, email, role) ON employees TO authenticated;
-- NOT GRANT SELECT ON employees — don't grant all columns if some are sensitive
```

## API Security (Route Handlers)

### Authentication on Every Route
```ts
// app/api/employees/route.ts
import { createServerClient } from '@supabase/ssr';

export async function GET(request: NextRequest) {
  const supabase = createServerClient(/* cookies */);
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  
  // Check role if needed
  const isManager = await checkManagerRole(supabase, user.id);
  if (!isManager) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  
  // ... handle request
}
```

### Input Validation
```ts
// Always validate at the boundary — Zod on every API route and Server Action
const schema = z.object({
  name: z.string().min(1).max(100).trim(),
  email: z.string().email(),
  hours: z.number().int().min(0).max(24),
});

const result = schema.safeParse(await request.json());
if (!result.success) {
  return NextResponse.json({ error: result.error.flatten() }, { status: 422 });
}
```

### CSRF Protection
- Next.js App Router Server Actions have built-in CSRF protection via `Origin` header check.
- For custom Route Handlers accepting mutations, verify `Origin` matches expected domain.
- Cookie `SameSite=Lax` (Supabase default) provides baseline CSRF protection.

### Rate Limiting
- Implement rate limiting on auth endpoints and sensitive operations.
- Use Vercel's Edge Middleware or an in-memory store for rate limits.
- Minimum: rate-limit login attempts (max 10/minute per IP).

## XSS Prevention

- React escapes HTML by default — never use `dangerouslySetInnerHTML`.
- If rendering user-provided content, sanitize with `DOMPurify` first.
- CSP headers via `next.config.ts`:

```ts
// next.config.ts
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-XSS-Protection', value: '1; mode=block' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];
```

## Secrets & Environment Variables

### Rules
- **No secrets in code** — not even in comments.
- **No secrets in git** — `.env*` files are in `.gitignore`.
- **`NEXT_PUBLIC_` = public** — anything with this prefix is sent to the browser.
- Service role key **never** in frontend code or `NEXT_PUBLIC_` vars.

### Safe vs Dangerous
```ts
// ✅ Safe — server only
process.env.SUPABASE_SERVICE_ROLE_KEY  // never starts with NEXT_PUBLIC_

// ❌ Dangerous — exposed to browser
process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY  // NEVER DO THIS
```

### Validation
```ts
// src/env.ts — validate at startup
import { createEnv } from '@t3-oss/env-nextjs';
export const env = createEnv({
  server: {
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
    RESEND_API_KEY: z.string().min(1),
    WEB_PUSH_PRIVATE_KEY: z.string().min(1),
  },
  client: {
    NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  },
});
```

## Web Push Security (web-push library)

- Store VAPID private key in server env only — never expose to client.
- Validate push subscription data before sending.
- Associate subscriptions with authenticated user IDs — reject subscriptions without auth.

## File Upload Security (if applicable)

- Validate MIME type on server — not just file extension.
- Limit file size at middleware level.
- Store in Supabase Storage with bucket RLS policies.
- Never execute uploaded files.

## Security Review Checklist

Run before every merge:

**Auth:**
- [ ] Every Server Action calls `getUser()` and checks authorization
- [ ] Every Route Handler authenticates before processing
- [ ] Middleware protects all `/protected` routes

**Database:**
- [ ] All new tables have RLS enabled
- [ ] All new tables have at least one policy
- [ ] No `user_metadata` in RLS policies
- [ ] No raw SQL with string concatenation

**Input:**
- [ ] All user input validated with Zod before use
- [ ] No `dangerouslySetInnerHTML` with user content

**Secrets:**
- [ ] No new env vars starting with `NEXT_PUBLIC_` that are secrets
- [ ] No secrets committed to git

**Headers:**
- [ ] Security headers configured in `next.config.ts`

## Incident Response

If a security issue is found:
1. **Assess:** Is user data exposed? Is there active exploitation?
2. **Contain:** Rotate compromised secrets, invalidate sessions if needed.
3. **Fix:** Apply the fix with proper review — don't rush.
4. **Verify:** Deploy, confirm the vulnerability is closed.
5. **Document:** ADR or postmortem in `docs/security/`.
