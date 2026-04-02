# 01 — Canon de Decisiones Cerradas
## Fuente única de verdad para decisiones de arquitectura y dominio

---

## Regla de uso

Una decisión cerrada no se reabre salvo que aparezca una contradicción de dominio real. Si se reabre, se documenta la nueva decisión con referencia a la anterior y motivo del cambio.

Formato: `D-NNN — [ámbito] — Descripción`

---

## BLOQUE 1 — Modelo de dominio y entidades

### D-001 — [dominio] — Fuente de verdad del modelo
La verdad operativa principal estará en el modelo de dominio canónico. La base de datos, el runtime y la estructura del repositorio se alinean con el modelo, no al revés.

### D-002 — [dominio] — Entidades canónicas confirmadas
Las entidades canónicas del sistema son:
- **Núcleo estructural:** `Organization`, `Chain`, `Company`, `Restaurant`, `Zone`
- **Núcleo identitario:** `Person`, `EmploymentRelationship`, `RoleScopeAssignment`
- **Módulos operativos:** `Schedule`, `ScheduleEntry`, `ShiftTemplate`, `TaskInstance`, `Request`, `ShiftSwapRequest`, `Incident`, `Document`, `Notification`, `AuditLog`
- **Módulo delivery:** `DeliveryNote`, `DeliveryNoteLine`, `Supplier`, `Product`, `SupplierProductAlias`

### D-003 — [dominio] — Entidades eliminadas del modelo
`Profile` queda eliminado completamente. No existe como entidad, tipo, view ni concepto. Toda lectura de datos de identidad para UI se hace directamente desde `Person` seleccionando los campos necesarios.

### D-004 — [dominio] — Núcleo duro (Fase 0 obligatoria)
El núcleo duro que debe existir antes de cualquier módulo operativo es:
- `Person` + `EmploymentRelationship` + `RoleScopeAssignment`
- `Company` + `Restaurant` + `Chain` + `Zone`
- `AuditLog`

### D-005 — [dominio] — Organization como boundary
`Organization` no es entidad funcional del dominio. Es el boundary canónico superior de tenant/plataforma. No participa en reglas operativas del negocio pero sí como `scope_type` raíz en `RoleScopeAssignment`.

### D-006 — [dominio] — Chain vs Company son ortogonales
`Chain` representa la dimensión comercial/marca. `Company` representa la dimensión legal/fiscal. Son conceptos ortogonales. Su vínculo no se modela como relación directa obligatoria.

### D-007 — [dominio] — Restaurant como raíz operativa
`Restaurant` es la raíz operativa principal del día a día. Todos los módulos operativos cuelgan de `Restaurant`. `EmploymentRelationship` es contexto de persona dentro de esa operación, no eje operativo del sistema.

### D-008 — [dominio] — Restaurant absorbe Location
`Restaurant` y `Location` no existen como entidades separadas. La ubicación física se modela como atributos o value object dentro de `Restaurant`.

### D-009 — [dominio] — Zone es intra-restaurante
`Zone` es una sección física dentro de un `Restaurant` (cocina, sala, barra, terraza). Cuelga siempre de un `Restaurant`. Un `Restaurant` puede tener 0 o N `Zone`. `Zone` sin `Restaurant` no puede existir.

### D-010 — [dominio] — Chain como agrupación comercial
`Chain` agrupa `Company` bajo una misma marca comercial. Su función en el sistema es:
- Agrupar `Company` bajo una misma marca
- Actuar como scope en `RoleScopeAssignment` para `owner` con autoridad sobre toda la cadena
- No tiene operaciones propias — no tiene empleados directos, schedules ni tareas
- Una misma `Organization` puede mezclar `Company` dentro de `Chain` y `Company` sin `Chain`

### D-010B — [dominio] — Restaurant hereda Chain desde Company
`Restaurant` no almacena `chain_id` propio. Si una `Company` pertenece a una `Chain`, sus `Restaurant` pertenecen a esa misma `Chain` por derivación.
La relación `Restaurant → Chain` no se persiste como FK separada para evitar redundancia e incoherencias.

### D-010C — [dominio] — Restaurant puede cambiar de Company sin perder identidad
`Restaurant` puede cambiar de `Company` manteniendo su misma identidad (`restaurant_id`).
Es una operación estructural excepcional y de alto impacto, pero válida canónicamente.
No forma parte del alcance operativo inicial del sistema; su ejecución práctica queda diferida como aportación futura.
Cuando ocurre, el bloque operativo del restaurante permanece unido al mismo `Restaurant`: `Zone`, `Schedule`, historial, documentos y demás entidades operativas no se recrean.
La `Chain` efectiva del restaurante se recalcula por derivación desde la nueva `Company`.

### D-011 — [dominio] — ShiftTemplate como entidad propia
`ShiftTemplate` es una entidad propia dentro del módulo `schedule` con ciclo de vida independiente (crear, editar, archivar, aplicar). "Copiar semana anterior" es una operación del `scheduleDraftService`, no una entidad.

### D-012 — [dominio] — TaskTemplate como decisión inicial superada
La exclusión inicial de `TaskTemplate` quedó superada en la sesión del 1 de abril de 2026 por `D-043A`, que lo incorpora al lanzamiento como entidad propia del módulo `tasks`. Se conserva esta referencia solo por trazabilidad histórica interna del canon.

---

## BLOQUE 2 — Identidad y acceso

### D-020 — [acceso] — system_role como fuente única
El rol principal canónico vive en `Person` como `system_role`. Es la única fuente de verdad para permisos sistémicos. `EmploymentRelationship` no define permisos.

### D-021 — [acceso] — Catálogo canónico de system_role
El catálogo canónico mínimo de `system_role` dentro del tenant es:
`admin`, `owner`, `office`, `manager`, `area_lead`, `employee`

### D-022 — [acceso] — Roles de plataforma separados
La administración de plataforma usa `platform_admin` o `super_admin`. Son roles internos del SaaS operador, fuera del canon funcional del tenant. No aparecen en la UI del tenant.

### D-023 — [acceso] — Definición de cada rol
- `admin` — tenant admin. Máxima autoridad dentro de un tenant. Gestiona estructura, personas y accesos
- `owner` — autoridad de negocio y control final sobre la organización o sus unidades
- `office` — ejecución y gestión administrativa/operativa y documental del día a día
- `manager` — liderazgo operativo de un restaurante concreto
- `area_lead` — liderazgo de una sección física dentro de un restaurante
- `employee` — rol base de ejecución operativa

### D-024 — [acceso] — Scopes canónicos
La jerarquía de scopes en `RoleScopeAssignment` es: `Organization`, `Chain`, `Company`, `Restaurant`, `Zone`.
El acceso es jerárquico: un scope concede acceso a todo su subárbol estructural.
- `Organization` incluye `Chain`, `Company`, `Restaurant` y `Zone`
- `Chain` incluye sus `Company`, `Restaurant` y `Zone`
- `Company` incluye sus `Restaurant` y `Zone`
- `Restaurant` incluye sus `Zone`
- `Zone` solo incluye su propia zona
`self` es una condición de acceso, no un scope canónico.

### D-025 — [acceso] — Scope obligatorio por rol
- `admin` requiere al menos 1 scope `Organization` vigente. No usa scopes más bajos como fuente primaria de autoridad; el acceso a `Chain`, `Company`, `Restaurant` y `Zone` se deriva jerárquicamente desde `Organization`
- `owner` requiere al menos 1 scope vigente `Organization`, `Chain` o `Company`. No usa scope directo `Restaurant`; accede al restaurante por derivación vía `active_scope`
- `office` requiere al menos 1 scope vigente `Organization`, `Chain`, `Company` o `Restaurant`
- `manager` requiere al menos 1 scope `Restaurant` vigente
- `area_lead` requiere exactamente 1 scope `Zone` vigente
- `employee` no usa `RoleScopeAssignment`; deriva su acceso de su asignación operativa activa al restaurante

### D-026 — [acceso] — area_lead sin Zone no es válido
`area_lead` sin scope `Zone` activo no es canónicamente válido. Tampoco lo es con más de una `Zone` activa simultáneamente. Si un restaurante no tiene zonas definidas, no puede tener `area_lead`.

### D-027 — [acceso] — access_status como lifecycle completo
`access_status` vive en `Person`. El catálogo canónico es:
- `pending_activation` — creada pero aún no activada
- `active` — acceso habilitado
- `suspended` — acceso temporalmente deshabilitado, reversible
- `archived` — identidad conservada, acceso ya no operativo
- `blocked` — acceso denegado por condición de seguridad o política

### D-028 — [acceso] — Transiciones de access_status
| Transición | Quién puede |
|---|---|
| `pending_activation` → `active` | `office` o `admin` |
| `active` → `suspended` | `office` o `admin` |
| `suspended` → `active` | `office` o `admin` |
| `active` → `archived` | `admin` únicamente |
| `archived` → `pending_activation` | `admin` únicamente |
| `active` → `blocked` | `admin` únicamente |
| `blocked` → `active` | `admin` únicamente |

Toda transición queda registrada en `AuditLog`.

### D-029 — [acceso] — sub_manager y chain_owner anulados
`sub_manager` → absorbido en `manager` con `authority_tier` contextual (`primary`/`secondary`).
`chain_owner` → reemplazado por `owner` con scope `Chain`.

---

## BLOQUE 3 — Empleo y ámbito

### D-030 — [empleo] — Person y EmploymentRelationship separados
`Person` modela identidad humana persistente. `EmploymentRelationship` modela vínculo laboral mutable y contextual. Son entidades separadas con ciclos de vida independientes.

### D-031 — [empleo] — Cardinalidad de EmploymentRelationship
Una `Person` puede tener exactamente 0 o 1 `EmploymentRelationship` activo. Nunca más de uno simultáneo.

### D-032 — [empleo] — EmploymentRelationship se ancla a Company
`EmploymentRelationship` referencia explícitamente `Company`. `company_id` es obligatorio. `Organization` y `Chain` no son niveles de contratación y `Restaurant` no vive en esta entidad.
La `Company` contractual del empleo no limita por sí misma la autoridad de `admin`, `owner` u `office` cuando sus `RoleScopeAssignment` activos les conceden alcance superior sobre `Organization`, `Chain` o múltiples `Company`.

### D-033 — [empleo] — Qué vive en EmploymentRelationship
**Sí:** contexto laboral, vínculo contractual, vigencia, condiciones de trabajo, modalidad/jornada, `job_title`, anclaje a `Company`.
**No:** `system_role`, scopes, permisos, autoridad del sistema, `restaurant_id`, `zone_id`, reglas de acceso.
La vigencia canónica de negocio se modela con `valid_from` y `valid_to`, ambos con semántica inclusiva (`[]`).
Para integridad, solapamientos y consultas temporales en PostgreSQL, se deriva adicionalmente un `valid_during daterange` técnico en forma `[)` a partir de esas fechas.
Ejemplo: fin visible `2026-04-14` → `valid_from = 2026-04-01`, `valid_to = 2026-04-14` y `valid_during = [2026-04-01, 2026-04-15)`.

### D-034 — [empleo] — EmploymentRestaurantAssignment como destino operativo
`EmploymentRestaurantAssignment` modela el destino operativo histórico de un empleo dentro de un `Restaurant`. Aplica a `employee`, `manager` y `area_lead`, permite programación futura y guarda su vigencia de negocio en `valid_from` + `valid_to` inclusivos. `valid_during` se deriva como rango técnico. No sustituye a `RoleScopeAssignment`.
Todo `Restaurant` operativo asignado debe pertenecer a la misma `Company` del `EmploymentRelationship`.
`manager` puede tener varios `Restaurant` simultáneos solo si todos pertenecen a esa misma `Company`.
Si una persona pasa a operar bajo otra `Company`, el vínculo correcto es terminar el `EmploymentRelationship` vigente y crear uno nuevo en la nueva `Company`.
Un cambio futuro de `Restaurant` dentro de la misma `Company` puede programarse anticipadamente en `EmploymentRestaurantAssignment`.
Un cambio futuro hacia otra `Company` no se modela como asignación operativa futura: se modela como fin programado del empleo vigente y alta programada de un nuevo `EmploymentRelationship`.
En `manager`, la asignación futura de restaurante no equivale por sí sola al alcance de autoridad: la operación vive en `EmploymentRestaurantAssignment` y la autoridad vive en `RoleScopeAssignment`.

### D-035 — [empleo] — EmploymentZoneAssignment para area_lead
`EmploymentZoneAssignment` modela la zona operativa histórica de un `area_lead`. `area_lead` puede tener una única `Zone` activa simultáneamente y esa zona debe pertenecer al `Restaurant` activo de su asignación operativa.
`area_lead` también queda restringido a un único `Restaurant` operativo activo simultáneamente, sin excepciones.
Su vigencia sigue el mismo patrón: `valid_from` + `valid_to` inclusivos y `valid_during` derivado.

### D-036 — [acceso] — active_scope vive en sesión
`active_scope` es contexto de sesión, no autoridad persistida en `public`. Permite navegar y operar en `Organization`, `Chain`, `Company` o `Restaurant` según el alcance ya concedido. Nunca concede permisos por sí mismo.

### D-037 — [acceso] — Vista global por defecto para roles de alcance amplio
`admin`, `owner` y `office` entran por defecto en vista global agregada. Solo cuando seleccionan un `active_scope` concreto la sesión se enfoca a una parte del árbol.

### D-038 — [acceso] — No redundancia en RoleScopeAssignment
No se almacenan scopes redundantes para una misma `Person` y `system_role` cuando el scope inferior ya queda cubierto por un scope superior del mismo subárbol (`Organization` > `Chain` > `Company` > `Restaurant` > `Zone`).
Sí se permiten combinaciones de scopes no redundantes cuando cubren subárboles distintos, por ejemplo una `Chain` y una `Company` que queda fuera de esa `Chain`.
`RoleScopeAssignment` admite vigencia temporal programable para soportar cambios futuros de autoridad.
La vigencia activa de un scope se deriva de `valid_during`, calculado desde `valid_from` + `valid_to` inclusivos; no se persiste en un booleano `active`.

### D-039 — [acceso] — Manager y area_lead separan autoridad de operación
`manager` y `area_lead` combinan `RoleScopeAssignment` para autoridad con asignaciones operativas históricas para trabajo diario. `authority_tier` solo existe para `manager`.

---

## BLOQUE 4 — Módulos operativos

### D-040 — [módulos] — Núcleo duro operativo
`schedule`, `tasks`, `incidents` son el núcleo duro operativo. `shift_swaps`, `requests`, `delivery_notes` son el núcleo ampliado.

### D-041 — [módulos] — Requests sustituye a procedures
`requests` cubre solicitudes laborales/administrativas del personal: vacaciones, bajas, permisos, ausencias. `procedures` queda anulado como naming.

### D-042 — [módulos] — Aprobación de Request por tipo
- `manager` aprueba: `justified_absence`, `absence`, permisos puntuales operativos
- `office` aprueba: `vacation`, `sick_leave` y cualquier solicitud con impacto contractual
- Nadie puede autoaprobar su propia solicitud (invariante global)
- `area_lead` no puede aprobar ningún tipo de solicitud

### D-043 — [módulos] — Tipos de Request
`vacation`, `sick_leave`, `justified_absence`, `absence`

### D-043A — [módulos] — TaskTemplate entra en lanzamiento
`TaskTemplate` forma parte del módulo `tasks` desde la fase inicial. Es la plantilla reutilizable de tarea operativa por restaurante y puede generar `TaskInstance` recurrentes o servir de base a creación manual.

### D-043B — [módulos] — TaskInstance admite varios tipos de responsable
Una `TaskInstance` puede asignarse a una persona concreta, a un rol operativo o a una zona concreta. El invariante es “al menos un responsable operativo”, no “siempre una persona concreta”.

### D-044 — [módulos] — ShiftSwap flujo de doble validación
1. Empleado A propone swap a Empleado B
2. Empleado B acepta o rechaza
3. Si B acepta → `manager` aprueba o rechaza
4. Si aprobado → `Schedule` se actualiza automáticamente sin republicación manual

Condiciones de compatibilidad: mismo restaurante, ambos activos en esa fecha, mismo `job_title`, mismo `responsibility_level`.

### D-045 — [módulos] — Incident: creación y enrutamiento
Cualquier persona con acceso operativo al restaurante en ese momento puede crear un incidente. El sistema enruta automáticamente por categoría:
- `manager` recibe: `operational`, `hygiene`, `customer`, `stock`
- `office` recibe: `maintenance`, `security`, `technology`, `personnel`, `stock`
- `stock` notifica a ambos (dimensión operativa + administrativa)

Estados del workflow: `reported` → `in_review` → `resolved` → `closed`
Sensibilidad: `normal` / `restricted` (restricted no visible para `area_lead`)

### D-046 — [módulos] — DeliveryNote flujo
1. Cualquier persona con acceso operativo al restaurante puede subir el albarán físico
2. OCR extrae datos (propone, no decide)
3. Empleado revisa y confirma datos extraídos
4. `office` valida y cierra el albarán como confirmado
5. Separación de funciones: quien sube no puede ser quien confirma como `office`

### D-047 — [módulos] — Document como soporte transversal
`Document` almacena y vincula archivos que respaldan otros módulos. No es módulo operativo central. No puede ser raíz funcional de ningún flujo que ya tenga su propia entidad principal.

---

## BLOQUE 5 — Notificaciones y auditoría

### D-050 — [notificaciones] — Canales predeterminados por evento
- **Push** → eventos operativos urgentes (swap propuesto, turno modificado, incidente reportado)
- **Email** → eventos administrativos/contractuales (vacaciones aprobadas, acceso bloqueado)
- **Ambos** → eventos críticos de seguridad o acceso
Preferencias de usuario por canal: `OPEN QUESTION (futuro)`

### D-051 — [auditoría] — AuditLog Nivel 2
`AuditLog` registra toda escritura del sistema desde el día 1. Todo `CREATE`, `UPDATE`, `DELETE` sobre cualquier entidad queda registrado con: `actor_id`, `actor_role`, `trace_id`, `entity_type`, `entity_id`, `previous_value`, `new_value`, `timestamp`.

---

## BLOQUE 6 — Archivado y soft delete

### D-060 — [archivado] — Soft delete universal
Ninguna entidad se elimina físicamente. Patrón: `is_archived + deleted_at`.

### D-061 — [archivado] — Quién puede archivar cada entidad
| Entidad | Quién puede archivar |
|---|---|
| `Company` | Solo `admin` |
| `Chain` | Solo `admin` |
| `Restaurant` | `office` o `admin` |
| `Zone` | `office`, `manager` o `admin` |
| `ShiftTemplate` | `office`, `manager` o `admin` |
| `Person` | `admin` (transición `active` → `archived`) |

---

## BLOQUE 7 — Estructura y compatibilidad

### D-070 — [estructura] — Organización por dominio
Dentro de `web/`, la organización principal es por dominio/capacidad canónica. Las capas técnicas viven dentro de cada módulo.

### D-071 — [estructura] — Módulos canónicos iniciales
`people`, `employment`, `restaurants`, `schedule`, `tasks`, `incidents`, `shift_swaps`, `requests`, `delivery_notes`, `documents`, `notifications`, `audit`

### D-072 — [estructura] — authz en shared
`authz` no entra como módulo propio. Vive en `shared/authz/` como base mínima transversal de autorización.

### D-073 — [compatibilidad] — Compat temporal con fecha de muerte
Toda compatibilidad temporal (`adapters`, `aliases`, `bridges`, `re-exports`, `legacy mappers`) debe tener carácter transitorio y fecha de eliminación explícita. Ningún mecanismo de compatibilidad puede consolidarse como capa permanente.

---

## BLOQUE 8 — Vacaciones y entitlements

### D-080 — [vacaciones] — Ciclo anual
Las vacaciones se calculan por año natural. Los días no disfrutados se arrastran indefinidamente al año siguiente — nunca caducan.

### D-081 — [vacaciones] — Cálculo por prorrateo exacto
La acumulación es por prorrateo exacto de días trabajados: `días_acumulados = días_trabajados × (30 / 365)`. No por mes completo.

### D-082 — [vacaciones] — Acumulación durante baja
El sistema sigue acumulando días durante la baja laboral. Los días de baja cuentan como días trabajados a efectos de vacaciones.

### D-083 — [vacaciones] — Ajuste manual por office
`office` puede ajustar días manualmente con nota justificativa obligatoria (`adjustment_note`).

### D-084 — [vacaciones] — Fin de contrato
Al terminar un contrato el sistema calcula días pendientes y notifica a `office` con resumen completo. La liquidación económica es manual — el sistema informa, no liquida.

### D-085 — [vacaciones] — Historial anual
Una fila por empleado por año en `vacation_entitlements`. El historial es auditable y los días arrastrados del año anterior son visibles.

### D-086 — [vacaciones] — days_available calculado
`days_available` es columna generada: `days_accrued + days_carried_over + days_adjusted - days_used`. No se almacena manualmente.

---

## BLOQUE 9 — Fichaje y presencia

### D-090 — [fichaje] — QR permanente por restaurante
Cada restaurante tiene un QR único permanente (`qr_token` uuid) generado una vez. Solo `admin` puede regenerarlo.

### D-091 — [fichaje] — Validación por geolocalización
El fichaje requiere que el empleado esté físicamente a 50 metros o menos del restaurante. Radio configurable por restaurante (`checkin_radius_meters`, default 50).

### D-092 — [fichaje] — Flujo de fichaje
1. Empleado abre la app con sesión activa y escanea el QR
2. App solicita geolocalización
3. Backend recibe `qr_token` + coordenadas GPS
4. Backend verifica distancia con fórmula Haversine
5. Si ≤ `checkin_radius_meters` → registra fichaje con `geolocation_valid = true`
6. Si > radio → rechaza con error `GEOLOCATION_OUT_OF_RANGE`

### D-093 — [fichaje] — Doble escaneo
El primer escaneo del día registra `clock_in`. El segundo registra `clock_out`. El sistema detecta automáticamente cuál es cuál.

---

## BLOQUE 10 — Horario operativo del restaurante

### D-100 — [horario] — Horario continuo
El horario operativo del restaurante es siempre una franja continua por día. `restaurant_hours` tiene una sola fila por día con `open_time` y `close_time`. Soporta cruce de medianoche (`crosses_midnight`).

### D-101 — [horario] — Turno mañana y noche
La división mañana/noche es configuración del scheduling, no del horario del restaurante. `schedule_config.shift_boundary_time` define la hora de corte (default 15:00). Los turnos antes de esa hora son "turno mañana", los de después "turno noche". Los nombres son configurables por restaurante.

---

## BLOQUE 11 — Incidentes — enrutamiento definitivo

### D-110 — [incidents] — Enrutamiento por categoría
| Categoría | Responsable |
|---|---|
| `operational` | `manager` |
| `hygiene` | `manager` |
| `customer` | `manager` |
| `maintenance` | `office` |
| `security` | `office` |
| `technology` | `office` |
| `personnel` | `office` |
| `stock` | `manager` + `office` (ambos) |

### D-111 — [incidents] — Stock notifica a ambos
`stock` tiene dimensión operativa (`manager` actúa en el momento) y administrativa (`office` gestiona el proveedor y seguimiento). El sistema notifica a ambos simultáneamente.

---

## BLOQUE 12 — Schema platform

### D-120 — [platform] — Schema separado
La gestión de la plataforma SaaS vive en el schema `platform`, separado del schema `public` del tenant. Misma base de datos Supabase, schemas distintos.

### D-121 — [platform] — Suscripciones por Organization
`platform.subscriptions` está vinculada a `Organization`, no a `Chain`. Cubre todos los tipos de cliente (independientes, grupos, cadenas).

### D-122 — [platform] — Vista de solo lectura para el tenant
`public.my_subscription` es una vista derivada de `platform.subscriptions` que expone solo los campos que el tenant necesita ver: `plan_type`, `status`, `max_restaurants`, `max_users`, `trial_ends_at`. El tenant no puede modificar su suscripción.

### D-123 — [platform] — platform_admin como claim JWT
`platform_admin` vive como claim en `app_metadata` del JWT de Supabase Auth. No tiene tabla propia en `public`. La función `is_platform_admin()` lo lee del JWT.

---

## BLOQUE 13 — Correcciones al canon original

### D-130 — [corrección] — schedule_status sin locked
`schedule_status_enum` tiene `draft`, `published` y `archived`. No existe `locked` como estado semántico. El lock de edición concurrente es técnico y vive en `schedule_locks` como tabla separada. Un schedule publicado siempre puede editarse retroactivamente.

### D-131 — [corrección] — authority_tier en role_scope_assignments
`authority_tier` (`primary` / `secondary`) vive en `role_scope_assignments`, no en `persons`. Un manager puede ser `primary` en un restaurante y `secondary` en otro. Solo aplica cuando `system_role = 'manager'`.

### D-132 — [corrección] — Organization tiene tabla propia
`Organization` tiene tabla propia en `public.organizations` con FK en `chains.organization_id` y `companies.organization_id`. No es solo un scope abstracto — es una entidad real con FK obligatoria.

### D-133 — [corrección] — companies.chain_id es nullable
Una `Company` puede existir sin `Chain`. El vínculo con la cadena es opcional porque el SaaS soporta todos los tipos de organización: independientes, grupos sin marca y cadenas.

---

## Naming legacy anulado

| Legacy | Canónico | Motivo |
|---|---|---|
| `chain_owner` | `owner` | La autoridad depende del rol y scope, no de Chain |
| `sub_manager` | `manager` + `authority_tier` | No justifica system_role independiente |
| `platform` (scope) | `organization` | El alcance global correcto dentro del tenant es Organization |
| `procedures` | `requests` | Naming cajón de sastre reemplazado por semántica correcta |
| `Profile` | eliminado | Person cubre todo; Profile era redundante |
| `role` | `system_role` | Una única fuente de verdad para autoridad |
| `legacyRole` | `system_role` | Ídem |
| `active` / `is_active` | `access_status` | Un booleano no expresa el lifecycle completo |
| `must_change_password` | `access_status` | No modela lifecycle |
| `self` (scope) | `self` como condición de acceso | No es scope estructural |
| `Location` | atributos de `Restaurant` | No tiene identidad ni ciclo de vida propio |
