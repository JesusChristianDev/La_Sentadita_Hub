# 06 — Project Structure
## Árbol de archivos canónico con reglas de organización

---

## Estructura raíz del repositorio

```
la-sentadita-hub/
├── src/                          ← todo el código de la aplicación
├── public/                       ← assets públicos estáticos
├── tests/                        ← tests transversales (e2e, integración, smoke)
│   ├── e2e/
│   ├── integration/
│   ├── smoke/
│   └── support/
├── .env.local
├── .env.example
├── next.config.ts
├── tailwind.config.ts
├── components.json               ← shadcn/ui config
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
├── app/                          ← Next.js App Router (framework entry layer)
│   ├── layout.tsx                ← Root layout (PWA, Sentry, TanStack Provider)
│   ├── page.tsx                  ← Redirige a /app según auth
│   ├── globals.css               ← Variables CSS + tema amber dark/light
│   ├── manifest.ts               ← PWA manifest
│   │
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── layout.tsx
│   │
│   └── (app)/                    ← Rutas protegidas
│       ├── layout.tsx            ← App shell + navbar + auth guard
│       ├── dashboard/page.tsx
│       ├── schedule/
│       │   ├── page.tsx
│       │   └── [weekStart]/page.tsx
│       ├── tasks/page.tsx
│       ├── requests/page.tsx
│       ├── shift-swaps/page.tsx
│       ├── incidents/page.tsx
│       ├── documents/page.tsx
│       ├── delivery-notes/page.tsx
│       ├── people/page.tsx
│       ├── employment/page.tsx
│       ├── suppliers/page.tsx
│       ├── notifications/page.tsx
│       └── profile/page.tsx
│
├── modules/                      ← Dominios y capacidades canónicas
│   │
│   ├── people/
│   │   ├── index.ts              ← API pública del módulo (exports explícitos)
│   │   ├── domain/
│   │   │   └── personTypes.ts
│   │   ├── application/
│   │   │   ├── createPerson.ts
│   │   │   ├── updatePersonIdentity.ts
│   │   │   └── archivePerson.ts
│   │   ├── infrastructure/
│   │   │   └── personRepository.ts
│   │   ├── ui/
│   │   │   └── PersonForm.tsx
│   │   └── __tests__/
│   │       └── createPerson.test.ts
│   │
│   ├── employment/
│   │   ├── index.ts
│   │   ├── domain/
│   │   │   └── employmentTypes.ts
│   │   ├── application/
│   │   │   ├── createEmploymentRelationship.ts
│   │   │   ├── updateEmployment.ts
│   │   │   ├── terminateEmployment.ts
│   │   │   └── employeeMutationRules.ts
│   │   ├── infrastructure/
│   │   │   └── employmentRepository.ts
│   │   └── __tests__/
│   │       └── employeeMutationRules.test.ts
│   │
│   ├── restaurants/              ← Company + Restaurant + Chain + Zone
│   │   ├── index.ts
│   │   ├── domain/
│   │   │   └── restaurantTypes.ts
│   │   ├── application/
│   │   │   ├── createRestaurant.ts
│   │   │   ├── archiveRestaurant.ts
│   │   │   ├── createZone.ts
│   │   │   └── archiveZone.ts
│   │   ├── infrastructure/
│   │   │   └── restaurantRepository.ts
│   │   └── __tests__/
│   │
│   ├── schedule/
│   │   ├── index.ts
│   │   ├── domain/
│   │   │   └── scheduleTypes.ts
│   │   ├── application/
│   │   │   ├── scheduleDraftService.ts     ← MIGRADO del repo anterior
│   │   │   ├── scheduleDraftRules.ts       ← MIGRADO del repo anterior
│   │   │   ├── scheduleLockService.ts      ← MIGRADO + adaptado al canon v9
│   │   │   ├── schedulePublicationService.ts ← MIGRADO del repo anterior
│   │   │   ├── scheduleCalculations.ts     ← MIGRADO del repo anterior
│   │   │   ├── scheduleDates.ts            ← MIGRADO del repo anterior
│   │   │   ├── shiftValidation.ts          ← MIGRADO del repo anterior
│   │   │   ├── shiftTemplateService.ts     ← NUEVO en v9
│   │   │   └── copyPreviousWeek.ts         ← NUEVO en v9
│   │   ├── infrastructure/
│   │   │   └── scheduleRepository.ts
│   │   ├── ui/
│   │   │   └── WeeklyScheduleGrid.tsx      ← custom CSS Grid
│   │   └── __tests__/
│   │       ├── scheduleDraftRules.test.ts
│   │       ├── scheduleDraftService.test.ts
│   │       ├── scheduleLockService.test.ts
│   │       ├── schedulePublicationService.test.ts
│   │       ├── scheduleCalculations.test.ts
│   │       ├── scheduleDates.test.ts
│   │       ├── shiftValidation.test.ts
│   │       └── shiftTemplateService.test.ts
│   │
│   ├── tasks/
│   │   ├── index.ts
│   │   ├── domain/taskTypes.ts
│   │   ├── application/
│   │   │   ├── createTask.ts
│   │   │   ├── completeTask.ts
│   │   │   └── reassignTask.ts
│   │   └── __tests__/
│   │
│   ├── requests/                 ← sustituye a procedures
│   │   ├── index.ts
│   │   ├── domain/requestTypes.ts
│   │   ├── application/
│   │   │   ├── createRequest.ts
│   │   │   ├── approveRequest.ts
│   │   │   ├── rejectRequest.ts
│   │   │   ├── cancelRequest.ts
│   │   │   └── applyRequestToSchedule.ts
│   │   └── __tests__/
│   │       └── approveRequest.test.ts      ← test invariante autoaprobación
│   │
│   ├── shift-swaps/
│   │   ├── index.ts
│   │   ├── domain/shiftSwapTypes.ts
│   │   ├── application/
│   │   │   ├── proposeShiftSwap.ts
│   │   │   ├── respondToShiftSwap.ts       ← empleado acepta/rechaza
│   │   │   └── approveShiftSwap.ts         ← manager aprueba
│   │   └── __tests__/
│   │
│   ├── incidents/
│   │   ├── index.ts
│   │   ├── domain/incidentTypes.ts
│   │   ├── application/
│   │   │   ├── createIncident.ts
│   │   │   ├── routeIncident.ts            ← enrutamiento por categoría
│   │   │   ├── reviewIncident.ts
│   │   │   ├── resolveIncident.ts
│   │   │   └── closeIncident.ts
│   │   └── __tests__/
│   │
│   ├── delivery-notes/
│   │   ├── index.ts
│   │   ├── domain/deliveryNoteTypes.ts
│   │   ├── application/
│   │   │   ├── uploadDeliveryNote.ts
│   │   │   ├── extractWithOCR.ts           ← llama a Mindee API
│   │   │   ├── confirmExtraction.ts        ← empleado confirma datos
│   │   │   └── validateDeliveryNote.ts     ← office valida y cierra
│   │   ├── infrastructure/
│   │   │   └── mindeeClient.ts
│   │   └── __tests__/
│   │
│   ├── documents/
│   │   ├── index.ts
│   │   ├── domain/documentTypes.ts
│   │   └── application/
│   │       ├── uploadDocument.ts
│   │       └── archiveDocument.ts
│   │
│   ├── notifications/
│   │   ├── index.ts
│   │   ├── domain/notificationTypes.ts
│   │   └── application/
│   │       ├── sendNotification.ts
│   │       └── markAsRead.ts
│   │
│   └── audit/
│       ├── index.ts
│       ├── domain/auditTypes.ts
│       └── application/
│           └── writeAuditLog.ts
│
├── shared/                       ← Base transversal real y estable
│   ├── authz/
│   │   ├── index.ts
│   │   ├── systemRoles.ts        ← SystemRoleEnum, ScopeTypeEnum
│   │   ├── responsibilityLevel.ts ← deriveResponsibilityLevel()
│   │   ├── requestContext.ts     ← RequestContext type + builder
│   │   ├── can.ts                ← can(ctx, action, resource)
│   │   └── assertCan.ts          ← assertCan(ctx, action, resource)
│   ├── ui/                       ← UI transversal reusable
│   │   ├── Button.tsx
│   │   ├── DataTable.tsx
│   │   └── ...
│   ├── types/                    ← Tipos compartidos estrictos
│   │   └── common.ts
│   ├── utils/                    ← Utilidades puras transversales
│   │   └── formatDate.ts
│   ├── hooks/                    ← Solo hooks verdaderamente cross-domain
│   │   └── useCurrentPerson.ts
│   └── validation/               ← Schemas Zod transversales
│       └── commonSchemas.ts
│
├── lib/                          ← Integraciones y framework glue no dominiales
│   ├── supabase/
│   │   ├── client.ts             ← cliente browser
│   │   └── server.ts             ← cliente server
│   ├── sentry.ts
│   └── resend.ts
│
└── config/                       ← Configuración explícita de app y tooling
    └── env.ts                    ← @t3-oss/env-nextjs + Zod validation
```

---

## Reglas de organización

### app/ — solo entrada del framework
- ✅ Rutas, layouts, pages, loading, error, not-found
- ✅ Route handlers en `api/`
- ✅ Adaptadores de entrada mínimos que solo reciben y delegan
- ❌ Lógica de dominio
- ❌ Casos de uso
- ❌ Policies de negocio
- ❌ Utilidades transversales reutilizables

### modules/ — dominio canónico
- ✅ Un módulo por capacidad canónica
- ✅ Cada módulo expone `index.ts` como API pública explícita
- ✅ Capas: `domain/`, `application/`, `infrastructure/`, `ui/`, `__tests__/` (solo las necesarias)
- ❌ Imports cross-module a rutas internas (solo a través de `index.ts`)
- ❌ Lógica de dominio fuera de `modules/`

### shared/ — transversalidad real
- ✅ `authz/`, `ui/`, `types/`, `utils/`, `hooks/` (cross-domain), `validation/` (transversal)
- ❌ Dominios canónicos dentro de shared
- ❌ `lib/`, `config/` dentro de shared

### tests/ — solo pruebas transversales
- ✅ `e2e/`, `integration/`, `smoke/`, `support/`
- ✅ Tests entre módulos, flujos completos, rutas completas
- ❌ Tests unitarios de módulos (esos viven en `modules/X/__tests__/`)
- ❌ Carpetas por dominio dentro de tests/

---

## Convención de módulo

Cada módulo solo materializa las capas que necesita. No se crean carpetas vacías.

```
modules/X/
├── index.ts          ← OBLIGATORIO siempre
├── domain/           ← tipos, enums, value objects, reglas puras
├── application/      ← casos de uso (use cases)
├── infrastructure/   ← repositorios, clientes externos
├── ui/               ← componentes específicos del módulo
└── __tests__/        ← tests unitarios del módulo
```

---

## Imports permitidos entre capas

```
app/         → modules/X/index.ts   ✅
app/         → shared/              ✅
app/         → lib/                 ✅
modules/X/   → shared/              ✅
modules/X/   → lib/                 ✅
modules/X/   → modules/Y/index.ts   ✅ (acoplamiento legítimo)
modules/X/   → modules/Y/internal  ❌ PROHIBIDO
shared/      → lib/                 ✅
shared/      → modules/             ❌ PROHIBIDO
lib/         → shared/              ❌ PROHIBIDO
```
