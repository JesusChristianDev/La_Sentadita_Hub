# La Sentadita Hub — Project Structure v1
# Estructura oficial del repositorio

---

## Stack

- Next.js 16 (App Router)
- TypeScript 5.9
- Node.js 24 LTS
- pnpm 10
- Supabase / PostgreSQL
- Zod 4
- Tailwind CSS 4
- shadcn/ui (tema custom amber/dark + light)
- React Hook Form + @hookform/resolvers
- TanStack Query
- Recharts
- @tanstack/react-table
- date-fns
- Resend + @react-email/components
- web-push
- Mindee (OCR albaranes)
- Sentry (@sentry/nextjs)
- @t3-oss/env-nextjs
- Vitest + Testing Library + Playwright

---

## Estructura raíz del repo

```
la-sentadita-hub/
├── src/
├── public/
├── tests/
│   └── e2e/
├── .env.local
├── .env.example
├── next.config.ts
├── tailwind.config.ts
├── components.json          ← shadcn/ui config
├── vitest.config.ts
├── playwright.config.ts
├── package.json
├── pnpm-lock.yaml
└── tsconfig.json
```

---

## Estructura de src/

```
src/
│
├── app/                          ← Next.js App Router
│   ├── layout.tsx                ← Root layout (PWA, Sentry, TanStack Provider)
│   ├── page.tsx                  ← Redirige a /app según auth
│   ├── globals.css               ← Variables CSS + tema amber dark/light
│   ├── manifest.ts               ← PWA manifest
│   │
│   ├── (auth)/                   ← Rutas de autenticación
│   │   ├── login/
│   │   │   └── page.tsx
│   │   └── layout.tsx
│   │
│   └── (app)/                    ← Rutas protegidas
│       ├── layout.tsx            ← App shell + navbar + auth guard
│       │
│       ├── dashboard/
│       │   └── page.tsx
│       │
│       ├── schedule/
│       │   ├── page.tsx
│       │   └── [weekStart]/
│       │       └── page.tsx
│       │
│       ├── tasks/
│       │   └── page.tsx
│       │
│       ├── procedures/
│       │   └── page.tsx
│       │
│       ├── shift-swaps/
│       │   └── page.tsx
│       │
│       ├── incidents/
│       │   └── page.tsx
│       │
│       ├── documents/
│       │   └── page.tsx
│       │
│       ├── delivery-notes/
│       │   └── page.tsx
│       │
│       ├── people/
│       │   └── page.tsx
│       │
│       ├── employment/
│       │   └── page.tsx
│       │
│       ├── suppliers/
│       │   └── page.tsx
│       │
│       ├── search/
│       │   └── page.tsx
│       │
│       ├── notifications/
│       │   └── page.tsx
│       │
│       └── profile/
│           └── page.tsx
│
├── modules/                      ← Módulos de dominio
│   │
│   ├── authz/                    ← Autorización — Fase 1
│   │   ├── index.ts
│   │   ├── domain/
│   │   │   ├── systemRoles.ts           ← SystemRoleEnum, ScopeTypeEnum
│   │   │   ├── responsibilityLevel.ts   ← deriveResponsibilityLevel()
│   │   │   └── aclRules.ts              ← reglas ACL por módulo y acción
│   │   ├── application/
│   │   │   ├── requestContext.ts        ← RequestContext type + builder
│   │   │   ├── can.ts                   ← can(ctx, action, resource)
│   │   │   └── assertCan.ts             ← assertCan(ctx, action, resource)
│   │   └── __tests__/
│   │       ├── can.test.ts
│   │       └── responsibilityLevel.test.ts
│   │
│   ├── audit/                    ← Auditoría — Fase 1
│   │   ├── index.ts
│   │   ├── domain/
│   │   │   └── auditActions.ts          ← AuditActionEnum
│   │   └── application/
│   │       └── writeAuditLog.ts         ← wraper de insert_audit_log()
│   │
│   ├── people/                   ← Personas — Fase 2
│   │   ├── index.ts
│   │   ├── domain/
│   │   │   └── personTypes.ts
│   │   ├── application/
│   │   │   ├── createPerson.ts
│   │   │   ├── updatePersonIdentity.ts
│   │   │   └── archivePerson.ts
│   │   └── __tests__/
│   │
│   ├── employment/               ← Empleo — Fase 2
│   │   ├── index.ts
│   │   ├── domain/
│   │   │   └── employmentTypes.ts
│   │   ├── application/
│   │   │   ├── createEmploymentRelationship.ts
│   │   │   ├── updateEmployment.ts
│   │   │   ├── terminateEmployment.ts
│   │   │   └── employeeMutationRules.ts  ← MIGRADO del repo anterior
│   │   └── __tests__/
│   │       └── employeeMutationRules.test.ts
│   │
│   ├── schedule/                 ← Horarios — Fase 3
│   │   ├── index.ts
│   │   ├── domain/
│   │   │   └── scheduleTypes.ts
│   │   ├── application/
│   │   │   ├── scheduleDraftService.ts    ← MIGRADO del repo anterior
│   │   │   ├── scheduleDraftRules.ts      ← MIGRADO del repo anterior
│   │   │   ├── scheduleLockService.ts     ← MIGRADO + adaptado a v7
│   │   │   ├── schedulePublicationService.ts ← MIGRADO del repo anterior
│   │   │   ├── scheduleCalculations.ts    ← MIGRADO del repo anterior
│   │   │   ├── scheduleDates.ts           ← MIGRADO del repo anterior
│   │   │   └── shiftValidation.ts         ← MIGRADO del repo anterior
│   │   └── __tests__/
│   │       ├── scheduleDraftRules.test.ts
│   │       ├── scheduleDraftService.test.ts
│   │       ├── scheduleLockService.test.ts
│   │       ├── schedulePublicationService.test.ts
│   │       ├── scheduleCalculations.test.ts
│   │       ├── scheduleDates.test.ts
│   │       └── shiftValidation.test.ts
│   │
│   ├── tasks/                    ← Tareas — Fase 4
│   │   ├── index.ts
│   │   ├── domain/
│   │   │   └── taskTypes.ts
│   │   └── application/
│   │       ├── createTask.ts
│   │       ├── completeTask.ts
│   │       └── reassignTask.ts
│   │
│   ├── procedures/               ← Trámites — Fase 5
│   │   ├── index.ts
│   │   ├── domain/
│   │   │   └── procedureTypes.ts
│   │   └── application/
│   │       ├── createProcedure.ts
│   │       ├── approveProcedure.ts
│   │       ├── rejectProcedure.ts
│   │       └── applyProcedureToSchedule.ts
│   │
│   ├── shift-swaps/              ← Cambios de turno — Fase 6
│   │   ├── index.ts
│   │   ├── domain/
│   │   │   └── shiftSwapTypes.ts
│   │   └── application/
│   │       ├── requestShiftSwap.ts
│   │       ├── acceptShiftSwapPeer.ts
│   │       └── approveShiftSwap.ts
│   │
│   ├── incidents/                ← Incidencias — Fase 7
│   │   ├── index.ts
│   │   ├── domain/
│   │   │   └── incidentTypes.ts
│   │   └── application/
│   │       ├── createIncident.ts
│   │       ├── assignIncident.ts
│   │       └── changeIncidentStatus.ts
│   │
│   ├── documents/                ← Documentos — Fase 8
│   │   ├── index.ts
│   │   ├── domain/
│   │   │   └── documentTypes.ts
│   │   └── application/
│   │       ├── uploadDocument.ts
│   │       ├── viewDocument.ts
│   │       └── archiveDocument.ts
│   │
│   ├── delivery-notes/           ← Albaranes — Fase 10
│   │   ├── index.ts
│   │   ├── domain/
│   │   │   └── deliveryNoteTypes.ts
│   │   └── application/
│   │       ├── uploadDeliveryNote.ts     ← Mindee OCR + guardar en documents
│   │       ├── reviewDeliveryNote.ts     ← Empleado revisa extracción
│   │       ├── confirmDeliveryNote.ts    ← Oficina confirma
│   │       └── rejectDeliveryNote.ts
│   │
│   ├── notifications/            ← Notificaciones — Fase 9
│   │   ├── index.ts
│   │   ├── domain/
│   │   │   └── notificationTypes.ts
│   │   └── application/
│   │       ├── createNotification.ts
│   │       └── sendPushNotification.ts
│   │
│   └── suppliers/                ← Proveedores (parte de albaranes)
│       ├── index.ts
│       ├── domain/
│       │   └── supplierTypes.ts
│       └── application/
│           ├── createSupplier.ts
│           └── createProduct.ts
│
├── shared/                       ← Código compartido
│   │
│   ├── env.ts                    ← @t3-oss/env-nextjs validación
│   │
│   ├── supabase/
│   │   ├── client.ts             ← Supabase browser client
│   │   ├── server.ts             ← Supabase server client (service role)
│   │   └── middleware.ts         ← Session refresh middleware
│   │
│   ├── db/                       ← Repositorios base
│   │   ├── persons.ts
│   │   ├── employment.ts
│   │   ├── schedules.ts
│   │   ├── tasks.ts
│   │   ├── procedures.ts
│   │   ├── incidents.ts
│   │   ├── documents.ts
│   │   ├── deliveryNotes.ts
│   │   ├── notifications.ts
│   │   └── audit.ts
│   │
│   ├── errors/                   ← Tipos de error del sistema
│   │   └── index.ts              ← AuthorizationError, ValidationError,
│   │                                InvariantViolationError, ConflictError,
│   │                                NotFoundError
│   │
│   ├── types/                    ← Tipos globales compartidos
│   │   └── index.ts
│   │
│   ├── utils/
│   │   ├── dates.ts              ← Helpers de date-fns para el proyecto
│   │   └── cn.ts                 ← className utility (clsx + tailwind-merge)
│   │
│   └── ui/                       ← Componentes UI compartidos
│       ├── index.ts              ← Barrel export
│       │
│       ├── shadcn/               ← Componentes generados por shadcn CLI
│       │   ├── button.tsx
│       │   ├── dialog.tsx
│       │   ├── input.tsx
│       │   ├── select.tsx
│       │   ├── badge.tsx
│       │   ├── calendar.tsx
│       │   ├── toast.tsx
│       │   └── ...
│       │
│       ├── layout/               ← Componentes de estructura
│       │   ├── AppShell.tsx
│       │   ├── Navbar.tsx
│       │   ├── PageIntro.tsx
│       │   └── Panel.tsx
│       │
│       ├── feedback/             ← Estados de UI
│       │   ├── Notice.tsx
│       │   ├── EmptyState.tsx
│       │   ├── LoadingSpinner.tsx
│       │   └── ErrorBoundary.tsx
│       │
│       ├── data/                 ← Componentes de datos
│       │   ├── DataTable.tsx     ← @tanstack/react-table wrapper
│       │   └── ChipFilter.tsx
│       │
│       └── pwa/                  ← PWA específico
│           ├── PwaRegister.tsx
│           └── InstallPwaButton.tsx
│
├── lib/                          ← Integraciones externas
│   ├── mindee.ts                 ← Mindee OCR client
│   ├── resend.ts                 ← Resend email client
│   ├── web-push.ts               ← web-push config
│   └── sentry.ts                 ← Sentry client config
│
└── middleware.ts                 ← Next.js middleware (session refresh)

```

---

## Convenciones de naming

### Archivos
- Componentes React: `PascalCase.tsx`
- Servicios y utilidades: `camelCase.ts`
- Tests: `camelCase.test.ts`
- Tipos de dominio: `camelCase.ts`

### Módulos
- Cada módulo tiene un `index.ts` que exporta solo lo público
- Las dependencias entre módulos van siempre a través del `index.ts`, nunca imports directos entre archivos internos de módulos distintos

### Patrón de servicios de aplicación
Todos los servicios siguen el patrón factory con dependency injection del repo anterior:

```typescript
type MyServiceDeps = {
  // dependencias externas inyectadas
}

export function createMyService(deps: MyServiceDeps) {
  async function doSomething(params: ...): Promise<Result<T>> {
    // lógica
  }

  return { doSomething }
}
```

### Patrón Result<T>
```typescript
type Result<T> =
  | { ok: true; value: T }
  | { ok: false; errorCode: MyErrorCode }
```

---

## Archivos de servicios migrados del repo anterior

Los siguientes archivos tienen lógica de negocio validada con tests que se migra al nuevo repo:

| Archivo original | Destino en nuevo repo | Cambios necesarios |
|---|---|---|
| `scheduleDraftService.ts` | `modules/schedule/application/` | `employee_id` → `employment_id` |
| `scheduleDraftRules.ts` | `modules/schedule/application/` | Revisar tipos |
| `scheduleLockService.ts` | `modules/schedule/application/` | `is_area_lead` → `system_role === 'area_lead'` |
| `schedulePublicationService.ts` | `modules/schedule/application/` | Añadir `publish_type` |
| `scheduleCalculations.ts` | `modules/schedule/application/` | Revisar tipos |
| `scheduleDates.ts` | `modules/schedule/application/` | Sin cambios |
| `shiftValidation.ts` | `modules/schedule/application/` | Sin cambios |
| `employeeMutationRules.ts` | `modules/employment/application/` | `AppRole` → `SystemRoleEnum` |
| `employeeMutationService.ts` | `modules/employment/application/` | `AppRole` → `SystemRoleEnum` |
| `selfProfileMutationRules.ts` | `modules/people/application/` | Revisar tipos |

---

## Variables de entorno requeridas (.env.example)

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Sentry
NEXT_PUBLIC_SENTRY_DSN=

# Resend
RESEND_API_KEY=

# Web Push (VAPID)
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=

# Mindee
MINDEE_API_KEY=
```

---

## Orden de implementación

```
Fase 0  — Setup: repo, deps, env, shadcn, Sentry, Vitest
Fase 1  — authz + audit
Fase 2  — people + employment (+ migración servicios existentes)
Fase 3  — schedule (+ migración servicios existentes)
Fase 4  — tasks
Fase 5  — procedures
Fase 6  — shift-swaps
Fase 7  — incidents
Fase 8  — documents
Fase 9  — notifications + push
Fase 10 — delivery-notes + suppliers
```
