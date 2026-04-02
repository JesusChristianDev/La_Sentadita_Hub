# La Sentadita Hub — Canon Ejecutable V9
## Paquete maestro oficial de implementación

---

## Qué es este paquete

El canon ejecutable v9 es la fuente de verdad única y completa para implementar La Sentadita Hub. Incorpora todas las decisiones arquitectónicas cerradas hasta marzo 2026, incluyendo la limpieza total de legacy, el modelo de vacaciones, el fichaje por QR con geolocalización, el schema platform separado y la alineación completa con la base de datos real.

**Cualquier contradicción entre este paquete y artefactos anteriores: este paquete gana.**

---

## Estructura del paquete

```
canon-v9/
├── 00_README.md                          ← estás aquí
│
├── core/
│   ├── 01_CANON_DECISIONS.md             ← todas las decisiones cerradas
│   ├── 02_DOMAIN_MODEL.md                ← entidades, relaciones, fuentes de verdad
│   ├── 03_ACL_MATRIX.md                  ← roles × módulos × acciones
│   └── 04_INVARIANTS.md                  ← reglas de negocio numeradas
│
├── implementation/
│   ├── 05_STACK.md                       ← stack completo con versiones
│   ├── 06_PROJECT_STRUCTURE.md           ← árbol de archivos con reglas
│   ├── 07_BACKEND_BLUEPRINT.md           ← patrón de caso de uso, RequestContext
│   ├── 08_IMPLEMENTATION_PHASES.md       ← gates, fases, done-when, matriz
│   ├── 11_SUPABASE_CONVERGENCE_PLAN.md   ← convergencia desde la base real al canon
│   └── 12_FRONTEND_BLUEPRINT.md          ← sesión, capacidades, navegación, modos UI
│
└── reference/
    ├── 09_NOTIFICATION_CATALOG.md        ← eventos, canales, destinatarios
    └── 10_OPEN_QUESTIONS.md              ← decisiones pendientes con criterio
```

---

## Jerarquía de prioridad entre artefactos

1. `04_INVARIANTS.md` — las reglas de negocio no se negocian
2. `01_CANON_DECISIONS.md` — las decisiones cerradas gobiernan
3. `02_DOMAIN_MODEL.md` — el modelo define la estructura
4. `03_ACL_MATRIX.md` — la ACL define el acceso
5. `07_BACKEND_BLUEPRINT.md` — el patrón define la implementación
6. `12_FRONTEND_BLUEPRINT.md` — el frontend traduce capacidades y modos, no permisos
7. `06_PROJECT_STRUCTURE.md` — la estructura define dónde va cada cosa
8. Cualquier artefacto histórico (v8 ZIP, canon v8, docs v1-freeze)

---

## Estado del schema de base de datos (abril 2026)

**Schema `public` — dominio del tenant:**
- 37 tablas canónicas, todas con RLS habilitado
- Todos los enums limpios de valores legacy
- `organizations` como entidad real con FK en `chains` y `companies`
- `requests` (renombrada desde `procedures`)
- `vacation_entitlements` con modelo de prorrateo exacto
- `time_records` con soporte QR + geolocalización
- `restaurants` con `qr_token`, `latitude`, `longitude`, `checkin_radius_meters`
- `restaurant_hours` con horario operativo continuo
- `schedule_config` con `shift_boundary_time` para corte mañana/noche
- `role_scope_assignments` con `authority_tier` para jerarquía de managers

**Schema `platform` — gestión SaaS:**
- `platform.subscriptions` vinculada a `Organization`
- Solo accesible por `platform_admin` (claim en JWT de Supabase Auth)
- `public.my_subscription` vista de solo lectura para el tenant

**Naming legacy eliminado:**
`sub_manager`, `chain_owner`, `platform` (scope), `procedures`, `profile`, `onboarding_status`, `chain_id` en persons

---

## Regla de oro

Si una decisión no está cerrada en este paquete:
- Marcarla como `OPEN QUESTION` en `10_OPEN_QUESTIONS.md`
- No inventarla
- No asumirla por conveniencia técnica

---

## Stack en una línea

Next.js 16 · TypeScript 5.9 · Node 24 LTS · pnpm 10 · Supabase/PostgreSQL · Zod 4 · Tailwind 4 · shadcn/ui · TanStack Query · Vitest · Playwright · Vercel

Ver detalle completo en `05_STACK.md`.

---

## Frontend

El frontend debe implementarse siguiendo `12_FRONTEND_BLUEPRINT.md`.

Ese documento fija:
- contrato de sesión frontend
- capacidades efectivas proyectadas desde backend
- modos de pantalla por módulo
- regla de “componentes tontos, view models explícitos”

---

## Estado

**Canon Ejecutable V9 — LISTO PARA IMPLEMENTAR**
Última actualización: abril 2026
