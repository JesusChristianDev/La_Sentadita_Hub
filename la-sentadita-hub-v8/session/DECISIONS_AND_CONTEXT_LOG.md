# La Sentadita Hub — Decisions & Context Log
# Sesión de arquitectura y stack — Marzo 2026

---

## 1. Análisis de los artefactos de arquitectura

### 1.1 Documentación de dominio (la-sentadita-docs-v1-freeze)

Se analizó el paquete documental completo. Valoración: nivel profesional real, no de proyecto de estudiante.

**Lo que se identificó como sólido:**
- Separación correcta entre `person` y `employment_relationship` (la persona existe con independencia del contrato).
- Separación entre `system_role` (permisos del sistema) y `job_title` (puesto laboral real).
- El modelo de acceso `access = system_role + scope + action` es la forma correcta de diseñar ACL.
- Los invariantes I1–I20 están explícitos y numerados, lo que previene bugs graves en producción.
- El audit log con `previous_value`, `new_value`, `trace_id` y `actor_role` permite reconstruir exactamente qué pasó, quién lo hizo y desde qué contexto.
- El archivo `14_AI_IMPLEMENTATION_GUIDE.md` y `ai_context.yaml` diseñan el sistema para ser implementado con asistencia de IA, con reglas que evitan que la IA invente comportamientos.

**Lo que se identificó como riesgo o laguna:**
- Las preguntas abiertas del `15_OPEN_QUESTIONS_AND_FUTURE.md` (detección automática de `late`/`no_show`, integración con Ágora POS) pueden bloquear el lanzamiento si el negocio las necesita desde el día 1.
- El campo `availability_json` en `employment_relationship` es flexible pero difícil de consultar y validar sin un schema de validación definido.
- El módulo de notificaciones estaba comparativamente menos detallado que el resto.

---

### 1.2 SQL Package v1

**Lo que se identificó como sólido:**
- La traducción de documentación a SQL es casi perfecta. Los enums reflejan exactamente las entidades del dominio.
- 20+ enums cubriendo todos los estados posibles previenen datos basura desde el día 1.
- El invariante I6 ("una tarea no puede existir sin responsable") está implementado como `CHECK` en SQL real.
- El invariante I4 ("nadie autoaprueba") está como trigger activo en base de datos, no solo en la app.
- La tabla `schedule_locks` modela los bloqueos como filas con `expires_at` y `released_at`, lo que permite concurrencia y auditoría del lock.
- El trigger `set_updated_at` se aplica dinámicamente con un loop en lugar de 15 triggers manuales.
- Stack confirmado: Supabase/PostgreSQL. Las funciones `current_person_id()` y `current_system_role()` leen del JWT de forma canónica.

**Lo que se identificó como riesgo:**
- Las RLS policies están intencionalmente incompletas. La mayoría de tablas críticas tienen solo política `admin_all`. Toda la lógica de acceso por scope vive en el backend.
- `availability_json` sin schema de validación definido.
- Los solapamientos de horario no tienen prevención en base de datos.
- `documents.owner_id` es UUID sin FK real (patrón polimórfico, integridad referencial delegada a la app).

---

### 1.3 Backend Blueprint v1

**Lo que se identificó como sólido:**
- El patrón de caso de uso de 9 pasos es la secuencia que diferencia un backend amateur de uno profesional:
  1. construir RequestContext
  2. validar input
  3. cargar entidades
  4. assertCan(...)
  5. validar invariantes
  6. ejecutar operación
  7. aplicar side effects
  8. registrar auditoría
  9. emitir notificaciones
  10. devolver resultado
- `RequestContext` como contrato explícito con `personId`, `systemRole`, `activeScopeId` y `traceId`.
- El principio P6 "Frontend tonto, backend inteligente" es la decisión más importante del documento.
- El orden de fases es correcto: `authz → audit → repositorios base` antes de cualquier módulo de negocio.

**Lo que faltaba en el blueprint (añadido en governance package v2):**
- Tipos de error no estaban definidos. Se añadieron: `AuthorizationError`, `ValidationError`, `InvariantViolationError`, `ConflictError`, `NotFoundError`.
- El módulo `authz` estaba declarado (`can(ctx, action, resource)`) pero no diseñado internamente.

---

### 1.4 Architecture Package (descartado)

Se analizó un paquete adicional (`la_sentadita_architecture_package.zip`) y se descartó porque era una regresión respecto a los anteriores: SQL de 20 líneas, dominio reducido a 6 entidades con una línea cada una, 5 invariantes genéricos. Útil solo como índice de navegación rápida, no como fuente de verdad.

**Decisión:** No reemplazar los artefactos buenos con resúmenes ligeros. Las guías auxiliares sirven para orientar; los documentos fuente sirven para decidir e implementar.

---

### 1.5 Master Package v1

Se construyó el paquete maestro consolidado que preserva los tres artefactos completos e intactos y añade capas de navegación:
- `01_SOURCE_OF_TRUTH.md`: jerarquía de prioridad entre artefactos cuando hay conflicto.
- `AI_USAGE_GUIDE.md`: contexto mínimo a entregar a un asistente IA según el módulo a implementar.
- `IMPLEMENTATION_PLAYBOOK.md`: orden de construcción y tipos de error recomendados.
- `RECOMMENDED_READING_ORDER.md`: orden de lectura para humanos y para perfil técnico.

---

### 1.6 Governance Package v2

Añade tres documentos de ejecución:
- `BACKEND_FIRST_POLICY.md`: formaliza que el frontend puede mostrar, validar UX y lanzar acciones, pero no puede decidir permisos, aprobaciones, visibilidad, ownership ni planificación.
- `MINIMUM_TEST_MATRIX.md`: criterios de aceptación por módulo antes de darlo por terminado.
- `IMPLEMENTATION_TICKETS_v1.md`: orden obligatorio con Fase 0 (estructura, testing, observabilidad) antes de cualquier lógica de negocio.

---

## 2. Decisiones de stack tecnológico

### 2.1 Stack final — 26 herramientas

| Capa | Herramienta | Versión | Coste |
|---|---|---|---|
| Framework | Next.js | 16.1.6 | Gratis |
| Lenguaje | TypeScript | 5.9.3 | Gratis |
| Runtime | Node.js | 24.x LTS | Gratis |
| Package manager | pnpm | 10.x | Gratis |
| Base de datos | Supabase / PostgreSQL | última estable | Free / Pro $25/mes |
| Cliente DB | supabase-js | 2.x | Gratis |
| Auth en Next.js | @supabase/ssr | última estable | Gratis |
| Validación | Zod | 4.x | Gratis |
| UI Components | shadcn/ui | última estable | Gratis |
| Estilos | Tailwind CSS | 4.x | Gratis |
| Formularios | React Hook Form + @hookform/resolvers | última estable | Gratis |
| Estado cliente | TanStack Query | última estable | Gratis |
| Fechas | date-fns | última estable | Gratis |
| Email | Resend | última estable | Free 3.000/mes / Pro $20/mes |
| Email templates | @react-email/components | última estable | Gratis |
| Push notifications | web-push | última estable | Gratis |
| Imágenes cliente | browser-image-compression | última estable | Gratis |
| PWA | @ducanh2912/next-pwa | última estable | Gratis |
| Monitorización | Sentry (@sentry/nextjs) | última estable | Free 5.000 errores/mes / Team $26/mes |
| Cron jobs | Vercel Cron Jobs | — | Incluido en Vercel Pro |
| Variables de entorno | @t3-oss/env-nextjs | última estable | Gratis |
| Tests unitarios | Vitest | última estable | Gratis |
| Tests componentes | Testing Library | última estable | Gratis |
| Tests E2E | Playwright | última estable | Gratis |
| Deploy | Vercel | — | Hobby gratis (no comercial) / Pro $20/mes |
| Calidad código | Husky + lint-staged | última estable | Gratis |
| Bundle análisis | @next/bundle-analyzer | última estable | Gratis |

**Coste mínimo en desarrollo y MVP:** 0 €/mes — todo en free tiers.
**Coste mínimo en producción real:** ~45 €/mes (Vercel Pro $20 + Supabase Pro $25).

---

### 2.2 Herramientas evaluadas y descartadas con razón

| Herramienta | Razón del descarte |
|---|---|
| Prisma / Drizzle | El SQL está escrito y es complejo. supabase-js con service_role ya da acceso tipado directo. |
| bcrypt | Supabase Auth maneja el hashing internamente. |
| JWT manual | Supabase Auth emite y verifica los JWTs. Las funciones del SQL leen los claims directamente. |
| NextAuth / Clerk / Lucia | Supabase Auth ya es el sistema de autenticación. Duplicaría responsabilidades y crearía conflictos con las RLS. |
| Zustand / Redux Toolkit | App Router gestiona estado en servidor. TanStack Query cubre estado del servidor en cliente. |
| Axios | fetch nativo es suficiente. TanStack Query lo abstrae. |
| Formik | React Hook Form es mejor en rendimiento y tiene mejor integración con Zod. |
| Workbox / vite-plugin-pwa | Vite no está en el stack. @ducanh2912/next-pwa es la solución correcta para Next.js. |
| PlanetScale / Neon | Supabase ya elegido. |
| Netlify / Railway | Vercel es la elección natural para Next.js. |
| Inngest | Vercel Cron Jobs cubre las necesidades del proyecto. Añadir Inngest duplicaría responsabilidades. Reconsiderar si los workflows se complican en el futuro. |
| semantic-release | Diseñado para librerías publicadas en npm. La Sentadita Hub es una aplicación interna, no un paquete publicable. |

---

### 2.3 Decisiones específicas de stack

**pnpm vs npm:** Se eligió pnpm. Es 2–3x más rápido, guarda paquetes una sola vez en disco global, y es más estricto con dependencias no declaradas. Se instala una vez con `npm install -g pnpm` y ya no se vuelve a usar npm.

**Node.js 24 en lugar de 20:** Node 20 entra en fin de vida el 30 de abril de 2026. Arrancar un proyecto nuevo en Node 20 obligaría a una migración forzada a semanas de lanzarlo.

**Zod 4 en lugar de 3:** Ya estable. Breaking changes relevantes respecto a v3 en cómo se importa y usa. No usar v3 en proyectos nuevos.

**shadcn/ui:** No es una dependencia opaca. El código de cada componente se copia en el proyecto y el desarrollador lo controla. Elegido precisamente porque no añade peso de librería que no se usa.

**@ducanh2912/next-pwa:** El paquete `next-pwa` (sin el prefijo) está abandonado. Usar exclusivamente `@ducanh2912/next-pwa`.

---

### 2.4 Estrategia de versiones

El stack arranca con versiones exactas y fijas. Se actualiza de forma deliberada, nunca automáticamente en producción.

- **Parche** (16.1.6 → 16.1.7): actualizar en días. Solo bugs y vulnerabilidades. Usar `~` en package.json.
- **Minor** (16.1 → 16.2): actualizar cada 1–2 meses. Leer changelog, probar en local.
- **Major** (16 → 17): decisión deliberada. Guía de migración obligatoria. Rama separada. Nunca automático.

Rutina mensual: `pnpm outdated` para ver qué está desactualizado. La decisión de actualizar siempre es manual.

---

### 2.5 Imágenes y rendimiento

**next/image** (incluido en Next.js): convierte automáticamente a WebP/AVIF, redimensiona al tamaño necesario, lazy loading por defecto, previene layout shift.

**browser-image-compression**: comprime imágenes en el cliente antes del upload a Supabase Storage. Una foto de 8MB se reduce a 200–400KB. Conecta directamente con el campo `confirmation_photo_url` del SQL.

**Supabase Storage Transformations**: permite pedir versiones redimensionadas de cualquier imagen directamente en la URL (`?width=200&height=200&resize=cover`). Ideal para avatares.

**PWA (@ducanh2912/next-pwa)**: el Service Worker guarda en caché los recursos estáticos. La segunda visita carga desde el dispositivo sin red. Crítico para empleados de restaurante que abren la app cada turno desde el mismo móvil.

---

## 3. Análisis comparativo con OpenAI

Se comparó la valoración del paquete entre Claude (9.1/10) y OpenAI (7.8/10).

**Puntos donde OpenAI acertó:**
- La duplicidad entre `employment_relationship.system_role` y `role_scope_assignment.system_role` es un hueco real que hay que cerrar antes de construir el módulo `authz`.
- La diferencia entre auditoría "diseñada" y "sistematizada" es exactamente donde los proyectos acumulan deuda silenciosa.
- Las cuatro prioridades propuestas son correctas y están bien ordenadas: (1) fuente única de verdad para rol, (2) endurecer scheduling, (3) política de auditoría ejecutable, (4) historial de publicaciones.

**Puntos donde Claude discrepó de OpenAI:**
- La puntuación de 7.8 es conservadora porque juzga una especificación arquitectónica como si fuera un sistema cercano a producción, cambiando los criterios de evaluación a mitad del análisis.
- La crítica al patrón polimórfico de `documents` es válida pero no tiene alternativa limpia. Cuatro columnas nullable con FK individual tiene sus propios problemas.
- Señalar que `schedule_entries` puede quedarse corta si el negocio escala es correcto en abstracto, pero penaliza la v1 por no resolver problemas que todavía no tiene.

**Lo que OpenAI no vio:** la coherencia de punta a punta. El invariante I4 aparece en el dominio como regla, en el SQL como trigger activo, en el blueprint como paso obligatorio del caso de uso, y en la matriz de tests como criterio de aceptación. Esa cadena es más difícil de construir que cualquier elemento individual y no fue valorada.

---

## 4. Fix de fuente de verdad del rol (Role Source of Truth Fix)

### 4.1 El problema

El SQL original tenía `system_role` en tres lugares simultáneamente:
- `employment_relationships.system_role`
- `role_scope_assignments.system_role`
- (ausente en `persons`)

Esto creaba una ambigüedad estructural: si `employment_relationship` decía `sub_manager` y `role_scope_assignment` decía `manager`, no estaba definido cuál mandaba.

### 4.2 La decisión tomada

Se eligió una tercera opción más limpia que las dos que OpenAI proponía: mover `system_role` directamente a `person`.

**Razón:** el rol del sistema es un atributo de la persona como entidad global de la cadena, no de su relación laboral con un restaurante específico ni de la asignación de un scope. Una persona es `manager` con independencia de en qué restaurante trabaje.

**Separación de responsabilidades resultante:**
- `person`: porta la identidad global y el `system_role` (único, activo).
- `employment_relationship`: porta contexto laboral, contrato y vigencia. No interfiere en permisos.
- `role_scope_assignment`: materializa los scopes del rol activo. No introduce un segundo rol.

**RequestContext actualizado:**
```ts
type RequestContext = {
  personId: string
  systemRole: SystemRole
  activeScopes: Array<{ scopeType: ScopeType; scopeId: string | null }>
  traceId: string
  now: Date
}
```

El cambio de `activeScopeType`/`activeScopeId` como campos únicos a `activeScopes` como array es necesario porque `office` y `chain_owner` pueden tener múltiples scopes activos simultáneamente.

### 4.3 El parche SQL seguro (v1.1)

El parche original tenía un riesgo: eliminaba columnas sin verificar dependencias y sin migrar datos primero.

**Dependencias analizadas y resueltas:**
- Triggers `set_updated_at` en ambas tablas: genéricos, no referencian `system_role` por nombre. Sin cambios necesarios.
- Función `current_system_role()`: lee de `request.jwt.claim.system_role` (JWT), no de columnas de tabla. Sin cambios necesarios.
- Función `is_platform_admin()`: usa `current_system_role()` del JWT. Sin cambios necesarios.
- Función `insert_audit_log()`: usa `current_system_role()` del JWT. Sin cambios necesarios.
- Políticas RLS: usan `is_platform_admin()`. Sin cambios necesarios.
- `schedule_locks.holder_role`, `audit_logs.actor_role`, `task_templates.confirmation_role`, `task_instances.assigned_role`: usan `system_role_enum` como tipo, no como FK. Sin cambios necesarios.
- No existen índices sobre `employment_relationships.system_role` ni `role_scope_assignments.system_role`. `DROP COLUMN` es seguro.

**Orden de ejecución del parche seguro:**
1. Añadir `persons.system_role` como nullable.
2. Migrar datos desde `employment_relationships` usando `active_principal = true` como criterio.
3. Validación automática: bloque `DO` que aborta si hay personas activas sin `system_role` migrado.
4. Aplicar `NOT NULL` solo tras validación exitosa.
5. Añadir índice único para reforzar single active role.
6. `DROP COLUMN system_role` en `employment_relationships`.
7. `DROP COLUMN system_role` en `role_scope_assignments`.
8. Registrar evento en `audit_logs`.

**Queries de validación post-commit:** incluidas en el archivo SQL.

---

## 5. Estado del proyecto al cierre de esta sesión

```
Documentación de dominio          ████████████████████  ✅ Congelada
Modelo SQL                        ████████████████████  ✅ Implementado
Role source of truth              ████████████████████  ✅ Resuelto (patch v1.1)
Blueprint backend                 ████████████████████  ✅ Definido
Governance / tickets              ████████████████████  ✅ Definido
Stack tecnológico                 ████████████████████  ✅ Verificado y documentado
─────────────────────────────────────────────────────────────────────
Código: Fase 0 (estructura base)  ░░░░░░░░░░░░░░░░░░░░  ← Siguiente paso
Código: Fase 1 (authz + audit)    ░░░░░░░░░░░░░░░░░░░░
Código: Fase 2 (people + employment) ░░░░░░░░░░░░░░░░░░
...resto de módulos               ░░░░░░░░░░░░░░░░░░░░
```

**Próximo paso inmediato:** Fase 0 — estructura del proyecto, configuración del stack, testing base y observabilidad (Sentry). Una vez completada, arrancar Fase 1 con el módulo `authz` usando `person.system_role` como única fuente de verdad del rol.

---

*Documento generado en sesión de arquitectura — Marzo 2026*
*Todos los artefactos referenciados están incluidos en este ZIP.*

---

## 6. Consolidación v4 — integración del patch en el paquete maestro

### Problema identificado en v3
El ZIP v3 contenía simultáneamente:
- El master package original con el modelo antiguo (`employment_relationship.system_role`, `role_scope_assignment.system_role`, `person` sin `system_role`)
- Una carpeta `patches/` con la corrección, como apéndice separado

Esto generaba una fuente de verdad dividida: dos versiones del modelo coexistiendo sin un mecanismo claro de reconciliación. Un asistente IA o un desarrollador que leyera los documentos principales del master package sin leer los patches implementaría el modelo incorrecto.

### Decisiones tomadas para v4

**Duda 1 resuelta:** Eliminar la carpeta `patches/` completamente. El historial de la decisión queda preservado en `DECISIONS_AND_CONTEXT_LOG.md`.

**Duda 2 resuelta:** Producir un único `01_schema.sql` limpio con el modelo correcto desde el inicio. No se mantiene el schema antiguo como archivo separado. El proyecto todavía está en fase de diseño sin ninguna instancia activa en producción.

### Archivos modificados en v4

`02_DOMAIN_MODEL.md` — Añadida sección explícita "Fuente de verdad del rol — regla fija" que documenta la triada: `person.system_role` (fuente única), `employment_relationship` (contexto laboral), `role_scope_assignment` (scopes).

`05_PEOPLE_EMPLOYMENT.md` — Eliminado `system_role` de los campos de `employment_relationship`. Añadida sección `role_scope_assignment` con su propósito correcto. Nota explícita de que `employment_relationship` no define permisos.

`13_DATA_MODEL_BLUEPRINT.md` — `person` incluye `system_role`. `employment_relationship` no incluye `system_role`. `role_scope_assignment` no incluye `system_role`. Blueprint completamente alineado con el modelo corregido.

`sql/la-sentadita-sql-v1/01_schema.sql` — `persons` incluye `system_role public.system_role_enum not null`. `role_scope_assignments` no incluye `system_role`. `employment_relationships` no incluye `system_role`. Header actualizado a v4.

`00_README_START_HERE.md` — Actualizado a v4. Añadida nota explícita de que no existen patches separados: la corrección ya está integrada.

`01_SOURCE_OF_TRUTH.md` — Actualizado para reflejar el estado v4 de cada artefacto.

### Estado post-v4
El paquete tiene ahora una única fuente de verdad sin ambigüedad. La regla `person.system_role` como fuente única del rol está integrada coherentemente en docs, blueprint de datos y SQL.

---

## 7. Consolidación v5 — integración del sistema operativo anterior

### Contexto
Al revisar el repositorio real en GitHub y el schema de Supabase en producción, se identificó que el sistema operativo anterior había implementado varios patrones de ingeniería superiores a los del v4 en áreas específicas. El v5 fusiona ambos sistemas tomando lo mejor de cada uno.

### Lo que el sistema anterior hacía mejor que el v4

**notification_outbox** — Patrón outbox con reintentos, timestamps de procesamiento y registro de errores. El v4 tenía solo una tabla `notifications` sin mecanismo de resiliencia. En un entorno de restaurante con conectividad inestable, el patrón outbox es obligatorio para push.

**schedule_publish_events** — Historial real de publicaciones con `prev_published_at`. El v4 solo tenía un campo `publication_version` como contador sin historial. Esto resolvía una de las lagunas identificadas por OpenAI en el análisis del v4.

**schedule_entry_adjustments + schedule_entry_logs** — Historial detallado de cambios en entradas de horario con tipado específico. El v4 delegaba esto al `audit_log` genérico con JSON, menos específico y más difícil de consultar.

**shift_templates** — Plantillas reutilizables de turno por restaurante. Concepto ausente en el v4.

**schedule_config** — Configuración operativa por restaurante: duración mínima de turno, pausa mínima en turno partido, timezone. Concepto ausente en el v4.

**restaurant_hours** — Horario de apertura por día de la semana. Concepto ausente en el v4.

### Decisiones tomadas para v5

**Decisión 1 — Conexión con Supabase Auth:** Option A seleccionada. `persons.person_id` es el mismo UUID que `auth.users.id`. Sin join adicional, autenticación nativa de Supabase, máxima simplicidad operativa.

**Decisión 2 — area_leads:** La tabla `area_leads` queda eliminada. `area_lead` es ahora un `system_role` oficial del sistema, igual que `manager` o `employee`. Su scope de zona se materializa en `role_scope_assignments` con `scope_type = zone`.

**Decisión 3 — incident.severity:** Tipado con enum `(low, medium, high, critical)` en lugar de `text` libre. Resuelve la inconsistencia identificada en el análisis crítico del v3.

**Decisión 4 — Departamentos de oficina:** OPEN QUESTION. No implementado en v5. Cuando el papel de cada persona de oficina esté definido, se añadirá sin romper nada de lo construido.

### Archivos modificados en v5

`01_schema.sql` — Schema completo reescrito incorporando todos los patrones del sistema anterior más las correcciones del v4. Schema definitivo sin patches separados.

`02_DOMAIN_MODEL.md` — Actualizado con `area_lead` como rol (no tabla), conexión Auth, historial de scheduling, patrón de notificaciones y OPEN QUESTION de departamentos.

`13_DATA_MODEL_BLUEPRINT.md` — Blueprint completo de todas las entidades del sistema v5, incluyendo las nuevas tablas incorporadas del sistema anterior.

`DECISIONS_AND_CONTEXT_LOG.md` — Este documento.

### Estado post-v5
El schema es la fusión definitiva de ambos sistemas. No existen patches separados. No existe ambigüedad sobre qué tablas usar. El sistema está listo para implementar el backend.

---

## 8. Consolidación v6 — cierre de ambigüedades y hardening integrado

### Hardening integrado (B-01 a B-10)

Todos los bloques del archivo `la-sentadita-hardening-all-patches.sql` están integrados directamente en el `01_schema.sql` del v6. No existe archivo de patch separado.

**B-01:** `current_person_id()` usa `auth.uid()` nativo. `current_system_role()` y `is_platform_admin()` con `SECURITY DEFINER` y `search_path` fijo.
**B-02:** `UNIQUE (employment_id, entry_date)` en `schedule_entries`. I3 formalizado como invariante numerado.
**B-03:** Trigger `validate_document_owner_id()` para integridad polimórfica de `documents.owner_id`.
**B-04:** Trigger `validate_restaurant_chain_coherence()` en insert/update de `restaurants`.
**B-05:** Trigger `validate_role_scope_assignment_scope_id()` para integridad polimórfica de `role_scope_assignments.scope_id`.
**B-06:** Constraints `shift_templates_split_times_required` y `shift_templates_split_times_coherent`.
**B-07:** `audit_logs.actor_user_id` con `ON DELETE SET NULL`.
**B-08:** `max_attempts` en `notification_outbox` con constraint e índice dead letter.
**B-09:** Índices de rendimiento en todas las tablas de consulta frecuente.
**B-10:** Constraints `procedures_dates_required_by_type` y `procedures_dates_coherent`.

### Puntos adicionales del análisis de ChatGPT resueltos

**Huérfanos tras delete:** Soft delete en todas las entidades principales (`is_archived` + `deleted_at` en `chains`, `companies`, `restaurants`, `zones`, `persons`, `employment_relationships`, `shift_templates`, `task_templates`). `documents` usa `document_status = archived`. `procedures` e `incidents` usan sus propios estados finales.

**Coherencia chain bidireccional:** Trigger `validate_company_chain_id_change()` bloquea el cambio de `companies.chain_id` si existen restaurantes activos, empleados activos o documentos activos asociados. Más amplio que el bloqueo simple propuesto por ChatGPT.

**Migraciones:** Todo integrado en schema limpio. Migraciones numeradas cuando llegue producción real.

### Decisiones cerradas en sesión de preguntas abiertas

**Procedure override:** `publication_version` sube siempre. `schedule_publish_events.publish_type` distingue `manual` vs `auto`. Notificación `schedule_updated` obligatoria al empleado afectado en cualquier caso.

**Notificaciones:** 29 eventos con destinatario y canal explícitos. `task_confirmed` solo en audit. `incident_restricted_marked` solo al manager.

**Locks:** Cron Job cada 5 minutos + on-read como segunda capa.

**Source en schedule entries:** `schedule_entry_source_enum` con 10 valores: `manual`, `procedure_vacation`, `procedure_sick_leave`, `procedure_justified_absence`, `procedure_absence`, `shift_swap`, `generated_template`, `generated_availability`, `generated_copy`, `import`. El valor `auto` eliminado por ambiguo.

**Responsibility level:** Función pura `deriveResponsibilityLevel()` en `src/modules/authz/domain/responsibility-level.ts`. Primer filtro: `requires_schedule = true`.

### Decisiones del ACL cerradas

**Descarga de documentos:** Cada rol tiene visibilidad de descarga explícita.
**Cancelación de procedures por empleado:** `vacation` y `justified_absence` solo en `requested`. `sick_leave` y `absence` nunca.
**Edición de procedures:** `manager`, `office`, `admin` pueden editar fechas en `requested`, `approved`, `in_review`. Dispara recalculación + notificación `procedure_dates_updated`.
**Cierre de procedures:** `sub_manager` no puede cerrar `sick_leave`. Cada tipo tiene estado requerido antes del cierre.
**`area_lead` en Procedures:** Tratado igual que `employee`. Puede crear sus propios trámites.
**Reautenticación:** Flujo B (15 min) para `employee_visible` y `management_visible`. Flujo A (contraseña explícita) para `restricted_management` y `administrative_only`.
**Soft delete en ACL:** `persons` y `employment_relationships`: office + admin. `restaurants`: admin + chain_owner. `companies`: solo admin. `zones`, `shift_templates`, `task_templates`: manager + sub_manager + admin.
**MoveRestaurant:** admin + chain_owner. Datos operativos automáticos, jurídicos con confirmación.
**MoveCompany:** Solo admin. Restaurantes se mueven automáticamente, documentos legales quedan con la empresa original.

### I3 formalizado

**I3** — No solapamiento de turnos + un restaurante por día por empleado. Respaldado en DB por `UNIQUE (employment_id, entry_date)` en `schedule_entries`.

---

## 9. Módulo Albaranes — v7

### Decisiones tomadas

**Albaranes como documentos:** `delivery_note` añadido a `document_type_enum`. El archivo vive en el módulo Documents existente. Los datos estructurados viven en `delivery_notes` + `delivery_note_lines`. Un `document` apunta al `delivery_note_id` via `owner_type = delivery_note`.

**OCR:** Mindee Invoice API. Más robusto que OCR clásico para formatos distintos de cada proveedor. Devuelve JSON estructurado directamente. `MINDEE_API_KEY` al stack de variables de entorno. Alternativa gratuita a Claude API con capacidades equivalentes para facturas.

**Flujo:** empleado sube → Mindee extrae → empleado revisa y envía → oficina revisa y confirma → datos en BD.

**Producto no reconocido:** el empleado ve aviso pero puede enviar igualmente. `is_new_product = true` en la línea. Oficina decide al confirmar.

**Proveedores:** `scope_type = chain | restaurant`. Trigger `validate_supplier_scope_id()` para integridad referencial polimórfica.

**Aprendizaje:** `supplier_product_aliases` con `confidence` y `times_confirmed`. Se enriquece con cada confirmación de oficina.

**ACL:** `area_lead` puede subir albaranes (acción operativa de recepción, no administrativa). Oficina confirma. Managers y chain_owner pueden ver.

**Constraint de no auto-revisión:** quien sube no puede confirmar como oficina (`uploaded_by <> reviewed_by_office`).

**Nuevas notificaciones:** `delivery_note_submitted` (oficina, push), `delivery_note_confirmed` (empleado, in-app), `delivery_note_rejected` (empleado, push).

**Nuevos eventos de auditoría:** `delivery_note_uploaded`, `delivery_note_employee_reviewed`, `delivery_note_office_confirmed`, `delivery_note_office_rejected`, `supplier_created`, `product_created`.

**Usos de los datos:** historial por proveedor, comparativa de precios, stock, detección de subidas, exportación contable, productos más comprados, integración futura con Ágora POS (`product_id` preparado para enlazar con catálogo POS).

---

## 10. Decisiones de repo y UI — v8

### Nuevo repo desde cero
Decisión tomada: empezar de cero con base limpia alineada con v7. Sin deuda técnica.
Los 10 servicios de aplicación del repo anterior se migran, no se tiran.

### Stack de UI
- shadcn/ui como base de componentes con tema custom amber/dark + light
- CSS custom del repo anterior se convierte en variables de shadcn
- Recharts para gráficos del dashboard y módulo de albaranes
- @tanstack/react-table para tablas densas
- Horario semanal: componente custom sobre CSS Grid (ninguna librería encaja)
- shadcn/ui Calendar para date pickers

### Dispositivo por rol
- employee, area_lead: móvil primero (PWA)
- sub_manager, manager, office, chain_owner, admin: desktop primero, responsive

### Navegación
- Menú filtrado por rol — cada usuario ve solo sus módulos
- Perfil propio accesible desde cualquier pantalla
- Dashboard con métricas para managers y superiores
- Búsqueda global accesible desde el menú para todos los roles

### Servicios migrados del repo anterior
- scheduleDraftService, scheduleDraftRules, scheduleLockService,
  schedulePublicationService, scheduleCalculations, scheduleDates,
  shiftValidation → modules/schedule/application/
- employeeMutationRules, employeeMutationService → modules/employment/application/
- selfProfileMutationRules → modules/people/application/

### Cambios necesarios en servicios migrados
- is_area_lead: boolean → system_role === 'area_lead'
- AppRole → SystemRoleEnum
- employee_id → employment_id en schedule entries
- schedulePublicationService: añadir publish_type manual/auto
- getRoleSlotConflictCode: eliminar restricción manager/sub_manager (v7 no la tiene)
