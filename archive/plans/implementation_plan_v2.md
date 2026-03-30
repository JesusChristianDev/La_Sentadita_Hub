# Implementation Plan v2 for La Sentadita Hub v8

## Objetivo

Implementar la arquitectura `v8` sobre el repo actual sin romper la app existente en
`web/`, evitando un rewrite total y evitando renombres destructivos al inicio.

Este plan sustituye al borrador anterior en los puntos donde:

- confundia `auth_users` con `authz`
- mezclaba observabilidad con auditoria de negocio
- asumia Vitest cuando el repo actual usa `node --test`
- proponia borrar modulos legacy antes de tener reemplazo
- trataba `v8` como un template rigido de repo nuevo en vez de una arquitectura destino

## Decision central

La estrategia correcta no es "renombrar el repo actual para que se parezca a v8".
La estrategia correcta es:

1. tomar `v8` como arquitectura destino
2. mantener `web/` como raiz de la app mientras migramos
3. crear modulos nuevos compatibles con `v8`
4. adaptar codigo probado del repo actual
5. retirar codigo legacy solo cuando el reemplazo este en produccion y verificado

## Hechos de partida

- La app actual vive en `web/`.
- Hoy pasan `npm run lint`, `npm run build` y `npm run test:unit`.
- El dominio congelado y el SQL fuerte vienen de `la-sentadita-hub-v8/la-sentadita-master-package/`.
- El repo actual sigue usando un modelo legacy basado en `profiles.role`,
  `restaurant_id`, `zone_id` e `is_area_lead`.
- El modulo mas avanzado y reusable es `schedule`.
- `tasks`, `documents`, `notifications`, `incidents` y `audit_log` siguen casi vacios.

## Principios de trabajo

- `v8` manda en arquitectura destino.
- El freeze de dominio y el schema SQL mandan por encima de la estructura actual.
- No se elimina nada reusable hasta tener reemplazo funcionando.
- Los cambios de modelo se hacen con adapters temporales, no con big bang.
- La UI no se rediseña al principio si el backend y el modelo aun no estan alineados.
- La observabilidad no sustituye a la auditoria de negocio.

## Adopcion del stack v8

Tener el stack de `v8` si ayuda, pero no todo tiene la misma prioridad.

La regla es:

- adoptar ya lo que mejora base tecnica comun
- adoptar pronto lo que afecta a patrones compartidos de UI
- adoptar por demanda lo que depende de modulos concretos
- no cambiar de herramienta solo por parecerse mas al documento

### Prioridad alta - adoptar en Foundation

Estas piezas si conviene introducirlas al principio:

- `zod`
- `@t3-oss/env-nextjs`
- `@sentry/nextjs`

Motivo:

- validacion de inputs y contratos
- validacion fuerte de variables de entorno
- observabilidad real para la migracion

### Prioridad media - adoptar cuando se toque la base de UI

Estas piezas ayudan mucho, pero no bloquean `authz`, `audit` o `people/employment`:

- `shadcn/ui`
- `react-hook-form`
- `@hookform/resolvers`

Motivo:

- unifican formularios y componentes compartidos
- reducen deuda visual y de accesibilidad
- preparan la nueva shell y componentes reutilizables

### Prioridad por modulo - introducir solo cuando exista caso de uso

- `@tanstack/react-table` para tablas densas
- `recharts` para dashboard y reporting
- `@tanstack/react-query` si realmente se necesita cache cliente compleja
- `resend` para email
- `web-push` para push
- `mindee` para OCR de albaranes

Motivo:

- son utiles, pero meterlas sin modulo listo solo anade superficie tecnica

### Prioridad baja - decision de tooling, no de arquitectura

- `pnpm`
- `vitest`

Motivo:

- pueden mejorar DX
- no corrigen el gap principal de modelo y permisos
- deben entrar solo con plan de migracion concreto

## Lo que NO vamos a hacer

- No renombrar `auth_users` a `authz` como primer paso.
- No dividir `employees` en caliente sin capa de compatibilidad.
- No migrar a `pnpm` o a `vitest` el dia 1 solo porque `v8` los nombre.
- No borrar `restaurants`, `dashboard`, `hours_reports`, `policies` o `requests`
  sin decidir antes su papel en la arquitectura destino.
- No tocar `schedule` a fondo antes de cerrar `authz`, `audit` y el gap de schema.

## Arquitectura destino adaptada al repo real

La arquitectura `v8` se adopta dentro de `web/src`, no rehaciendo toda la raiz del repo.

### Regla practica

- Mantener `web/` como deploy root.
- Crear dentro de `web/src/modules/` los modulos destino de `v8`.
- Mantener rutas actuales mientras se migran servicios.
- Introducir nuevas rutas solo cuando el modelo y los casos de uso esten listos.

### Mapa actual -> destino

| Actual | Destino v2 | Nota |
|---|---|---|
| `auth_users` | `people` + `authz` + adapter temporal de sesion | No renombrar directo |
| `employees` | `employment` | Reusar reglas y servicios probados |
| `area_leads` | absorbido por `authz` y scopes | `area_lead` deja de ser tabla/logica separada |
| `audit_log` | `audit` | Nuevo modulo horizontal |
| `requests` | `procedures` o archivo temporal | Decidir despues de Fase 2 |
| `notifications` | `notifications` | Rehacer sobre outbox y catalogo real |
| `documents` | `documents` | Sigue casi vacio, se construye despues |
| `schedule` | `schedule` | Mantener y adaptar |
| `restaurants` | soporte compartido | No borrar |
| `dashboard` | feature de app, no modulo core de dominio | Mantener |

## Gates obligatorios antes de tocar modulos

### Gate A - Schema real

Antes de Fase 1 hay que confirmar si la base real ya esta alineada con el schema
congelado:

- `persons.person_id = auth.users.id`
- `persons.system_role` como unica fuente del rol
- `employment_relationships` sin `system_role`
- `role_scope_assignments` sin `system_role`
- `documents`, `audit_logs`, `notification_outbox` y `schedule_publish_events`
  disponibles como espera `v8`

Si esto no esta alineado, el plan de codigo debe partirse en dos:

1. migracion de schema
2. migracion de aplicacion

### Gate B - Topologia del repo

Asumimos por defecto:

- se mantiene `web/` como app root
- se mantiene `npm` en el corto plazo
- se mantiene `node --test` hasta que Vitest este realmente instalado y cableado

### Gate C - Compatibilidad funcional

Mientras migramos, deben seguir funcionando:

- login
- `/app`
- `/employees`
- `/employees/[id]`
- `/horarios`
- `/me`

## Fase 0 - Foundation realista

### Objetivo

Preparar base tecnica sin reventar la app actual.

### Tareas

1. Crear un documento de `schema-alignment` entre DB real y `v8`.
2. Definir un `migration glossary` de tipos:
   - `AppRole -> SystemRoleEnum`
   - `employee_id -> employment_id`
   - `is_area_lead -> system_role === 'area_lead'`
3. Adoptar stack base de alta prioridad:
   - `zod`
   - `@t3-oss/env-nextjs`
   - `@sentry/nextjs`
4. Decidir oficialmente:
   - `npm` temporal o salto a `pnpm`
   - `node --test` temporal o migracion a Vitest
5. Preparar `shared/errors/` y convenciones de resultado para servicios nuevos.
6. Definir una lista de adopcion posterior para:
   - `shadcn/ui`
   - `react-hook-form`
   - `@hookform/resolvers`
   - `@tanstack/react-table`
   - `recharts`
   - `resend`
   - `web-push`
   - `mindee`

### Entregables

- decision log de schema
- decision log de stack
- decision log de tooling
- capa comun de errores
- observabilidad lista o validada

### Salida de fase

- build verde
- lint verde
- tests actuales verdes
- schema real entendido

## Fase 1 - Authz + Audit

### Objetivo

Crear las dos capas horizontales que hoy faltan y que `v8` exige.

### Tareas

1. Crear `modules/authz/` con:
   - `domain/systemRoles.ts`
   - `domain/responsibilityLevel.ts`
   - `domain/aclRules.ts`
   - `application/requestContext.ts`
   - `application/can.ts`
   - `application/assertCan.ts`
2. Crear `modules/audit/` con:
   - `domain/auditActions.ts`
   - `application/writeAuditLog.ts`
3. Crear un adapter temporal:
   - `buildRequestContextFromLegacyProfile()`
   - toma `profiles.role`, `restaurant_id`, `zone_id`, `is_area_lead`
   - devuelve el shape destino de `RequestContext`
4. Cambiar checks nuevos para que pasen por `authz` en vez de por helpers dispersos.
5. No tocar aun rutas ni nombres publicos.

### Importante

`auth_users` no se renombra a `authz`.

`auth_users` hoy contiene:

- sesion
- lookup de perfil
- contexto de usuario

Eso se repartira despues entre:

- `people`
- `authz`
- adaptadores de sesion

### Salida de fase

- existe `RequestContext`
- existe `can/assertCan`
- existe `writeAuditLog`
- el codigo nuevo deja de depender de checks ad hoc

## Fase 2 - People + Employment

### Objetivo

Separar identidad global de relacion laboral sin romper la UI actual.

### Tareas

1. Crear `modules/people/`.
2. Crear `modules/employment/`.
3. Mover logica reusable:
   - `selfProfileMutationRules` -> `people/application/`
   - `employeeMutationRules` -> `employment/application/`
   - `employeeMutationService` -> `employment/application/`
4. Crear adapters desde el modelo actual al modelo destino.
5. Mantener las rutas actuales de empleados, pero hacerlas depender del servicio nuevo.
6. Desacoplar `area_leads` de tabla y de `is_area_lead` cuando el schema real lo permita.

### No hacer aun

- No borrar `employees/`.
- No borrar `auth_users/`.
- No renombrar URLs publicas a `/people` o `/employment` todavia.

### Salida de fase

- los casos de uso de people/employment existen
- la UI actual funciona sobre esos casos de uso
- el modelo legacy queda encapsulado en adapters

## Fase 3 - Schedule

### Objetivo

Aprovechar lo mejor del modulo actual y adaptarlo al modelo v8.

### Tareas

1. Mantener `modules/schedule/` como base.
2. Reusar y adaptar servicios ya probados:
   - `scheduleDraftService`
   - `scheduleDraftRules`
   - `scheduleLockService`
   - `schedulePublicationService`
   - `scheduleCalculations`
   - `scheduleDates`
   - `shiftValidation`
3. Cambios de modelo minimos obligatorios:
   - `employee_id -> employment_id`
   - `is_area_lead -> system_role === 'area_lead'`
   - `AppRole -> SystemRoleEnum`
   - añadir `publish_type` en publicacion
4. Extraer de `serverActions.ts` la orquestacion grande a casos de uso mas pequeños.
5. Hacer que permisos de horarios dependan de `authz`, no de helpers legacy.
6. Preservar historial, locks y publicacion ya existentes.

### Regla

No se "eliminan validaciones antiguas" sin mas.
Se conservan las reglas validas y se adaptan los tipos y dependencias.

### Salida de fase

- horarios siguen funcionando
- tests de schedule siguen verdes
- el modulo deja de depender del shape legacy de perfil

## Fase 4 - Rutas y naming

### Objetivo

Acercar rutas y nombres publicos a `v8` cuando ya exista backend estable.

### Tareas

1. Decidir si se mantienen aliases legacy:
   - `/app` -> dashboard
   - `/employees` -> employment o vista compuesta people/employment
   - `/horarios` -> schedule
   - `/me` -> profile
2. Normalizar naming UI:
   - Panel vs Dashboard
   - Equipo vs Personal
   - Documentos / Tramites segun superficie real
3. No vender modulos "proximamente" como si ya estuvieran operativos.

### Salida de fase

- nomenclatura consistente
- navegacion alineada con capacidades reales

## Fase 5 - Modulos de negocio aun no implementados

Estas fases solo arrancan cuando Fases 1-3 esten cerradas.

### Fase 4 oficial - Tasks

- crear `modules/tasks/`
- casos de uso minimos
- auditar acciones

### Fase 5 oficial - Procedures

- reemplazar gradualmente `requests`
- integrar reglas de ACL y estados del freeze

### Fase 6 oficial - Shift Swaps

- construir sobre `schedule` y `employment`

### Fase 7 oficial - Incidents

- visibilidad y severidad segun freeze

### Fase 8 oficial - Documents

- construir primero el backbone:
  - upload
  - view
  - archive
  - owner polymorphic
  - reglas de visibilidad

### Fase 9 oficial - Notifications

- consolidar catalogo de eventos
- crear servicios sobre `notification_outbox`
- email/push despues del outbox

### Fase 10 oficial - Delivery Notes + Suppliers

- solo despues de Documents
- Mindee OCR
- review de empleado
- confirmacion de oficina

## Testing strategy realista

### Hoy

El repo actual usa:

- `npm run lint`
- `npm run build`
- `npm run test:unit` con `node --test`
- `npm run test:e2e` con Playwright

### Decision recomendada

- Mantener la suite actual durante Fases 0-3.
- Introducir Vitest solo cuando:
  - exista `vitest.config.ts`
  - las dependencias esten instaladas
  - el equipo acepte migrar o convivir con ambas suites

## Stack rollout recomendado

### Wave 1 - inmediatamente

- `zod`
- `@t3-oss/env-nextjs`
- `@sentry/nextjs`

### Wave 2 - cuando se rehaga shell o formularios

- `shadcn/ui`
- `react-hook-form`
- `@hookform/resolvers`

### Wave 3 - por modulo

- `@tanstack/react-table` en people/employment, documents, suppliers
- `recharts` en dashboard y delivery-notes
- `resend` y `web-push` en notifications
- `mindee` en delivery-notes

### Wave 4 - si el equipo lo decide

- `pnpm`
- `vitest`

### Gate por fase

Despues de cada fase:

1. `npm run lint`
2. `npm run build`
3. `npm run test:unit`
4. smoke manual de login, dashboard, empleados, horarios y perfil

## Riesgos principales

- tocar codigo de `schedule` antes de cerrar `authz`
- mezclar Sentry con auditoria de negocio
- romper la app actual por renombres prematuros
- asumir schema `v8` sin verificar Supabase real
- migrar rutas publicas antes de migrar casos de uso

## Preguntas que deben resolverse antes de ejecutar

1. La base real de Supabase ya esta alineada con `v8` o sigue en modelo legacy.
2. Se mantiene `web/` como root de despliegue durante toda la migracion.
3. Se aprueba adoptar ya `zod`, `@t3-oss/env-nextjs` y `@sentry/nextjs`.
4. `npm` se mantiene temporalmente o se migra a `pnpm`.
5. `node --test` se mantiene temporalmente o se migra a Vitest.
6. Las rutas publicas actuales deben mantenerse por compatibilidad o se aceptan redirects.

## Recomendacion final

La secuencia correcta es:

1. schema y adapters
2. authz + audit
3. people + employment
4. schedule
5. rutas y naming
6. modulos nuevos

Si se intenta empezar por renombrar carpetas o por imponer la estructura final de `v8`
sin adapters, el proyecto se volvera mas fragil antes de mejorar.
