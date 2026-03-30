# 02 — Modelo de Dominio Canónico
## Entidades, relaciones y fuentes de verdad

---

## Mapa de entidades por capa

```
SCHEMA PLATFORM (solo platform_admin)
└── platform.subscriptions (suscripción SaaS por Organization)

BOUNDARY DE TENANT (schema public)
└── Organization (contenedor del tenant — tabla real con FK)

ESTRUCTURA ORGANIZATIVA (núcleo duro)
├── Chain (agrupación comercial/marca — opcional)
├── Company (entidad legal/fiscal — organization_id obligatorio)
├── Restaurant (raíz operativa — obligatoria)
└── Zone (sección física dentro de Restaurant — opcional)

IDENTIDAD Y ACCESO (núcleo duro)
├── Person (identidad humana persistente)
├── EmploymentRelationship (vínculo laboral mutable)
└── RoleScopeAssignment (materialización de alcance + authority_tier)

CONFIGURACIÓN OPERATIVA
├── RestaurantHours (horario operativo por día)
└── ScheduleConfig (configuración de scheduling por restaurante)

MÓDULOS OPERATIVOS — núcleo duro
├── Schedule
├── ScheduleEntry
├── ShiftTemplate
├── TaskInstance
└── Incident

MÓDULOS OPERATIVOS — núcleo ampliado
├── Request
├── ShiftSwapRequest
└── DeliveryNote / DeliveryNoteLine

FICHAJE Y PRESENCIA
└── TimeRecord (con QR + geolocalización)

VACACIONES
└── VacationEntitlement (historial anual por empleado)

SOPORTE TRANSVERSAL
├── Document
├── Notification
└── AuditLog

AUXILIARES DE DELIVERY
├── Supplier
├── Product
└── SupplierProductAlias
```

---

## Entidades — definición canónica

### Organization
- **Naturaleza:** boundary de tenant — contenedor del tenant SaaS
- **Tabla:** `public.organizations`
- **Función:** scope raíz para `RoleScopeAssignment`. FK obligatoria en `chains` y `companies`
- **No tiene:** empleados directos, schedules, tareas ni operaciones propias
- **Suscripción:** gestionada en `platform.subscriptions` vinculada por `organization_id`

### Chain
- **Naturaleza:** agrupación comercial/marca
- **Función:** agrupar `Company` bajo una misma marca. Scope para `owner` con autoridad de cadena
- **Cardinalidad:** un `Restaurant` puede pertenecer a 0 o 1 `Chain`. Una `Company` puede pertenecer a 0 o 1 `Chain`
- **No tiene:** empleados directos, operaciones propias
- **FK:** `organization_id` obligatorio

### Company
- **Naturaleza:** entidad legal y fiscal
- **Función:** dimensión legal del vínculo laboral. Todo `Restaurant` pertenece a exactamente 1 `Company`
- **Campos clave:** nombre legal, CIF, domicilio fiscal
- **FK:** `organization_id` obligatorio, `chain_id` nullable

### Restaurant
- **Naturaleza:** raíz operativa principal
- **Función:** unidad donde se cruza dimensión legal (Company) y comercial (Chain). Todos los módulos operativos cuelgan de aquí
- **Cardinalidad:** pertenece a exactamente 1 `Company`, opcionalmente a 1 `Chain`
- **Campos clave:** `name`, `timezone`, `company_id`, `chain_id?`, `latitude`, `longitude`, `checkin_radius_meters`, `qr_token`

### Zone
- **Naturaleza:** sección física dentro de un `Restaurant` (cocina, sala, barra, terraza, almacén)
- **Cardinalidad:** pertenece a exactamente 1 `Restaurant`. Un `Restaurant` tiene 0..N `Zone`
- **Restricción:** no puede existir sin `Restaurant`. `area_lead` requiere al menos 1 `Zone` activa

### Person
- **Naturaleza:** identidad humana persistente
- **Función:** fuente única de verdad para identidad, rol sistémico y estado de acceso
- **Campos clave:** `first_name`, `last_name`, `email`, `phone`, `system_role`, `access_status`
- **Invariante:** 1 `system_role` activo. 1 `EmploymentRelationship` activo máximo
- **No tiene:** `company_id`, `restaurant_id`, `zone_id`, `chain_id` como atributos fijos

### EmploymentRelationship
- **Naturaleza:** vínculo laboral mutable y contextual
- **Cardinalidad:** 0..1 activo por `Person`
- **Campos clave:** `person_id`, `company_id`, `restaurant_id`, `job_title`, `contract_type`, `start_date`, `end_date`
- **Invariante:** `company_id` debe coincidir con `Restaurant.company_id`
- **No tiene:** `system_role`, scopes, permisos

### RoleScopeAssignment
- **Naturaleza:** materialización de alcance para roles que lo requieren
- **Aplica a:** `admin`, `owner`, `office`, `manager`, `area_lead`
- **Campos clave:** `person_id`, `scope_type`, `scope_id`, `active`, `authority_tier`
- **authority_tier:** solo para `system_role = manager`. `primary` = manager principal, `secondary` = manager delegado (ex sub_manager)

### RestaurantHours
- **Naturaleza:** horario operativo continuo del restaurante por día
- **Una sola franja por día** — el horario es siempre continuo
- **Campos clave:** `restaurant_id`, `day_of_week` (0-6), `is_open`, `open_time`, `close_time`, `crosses_midnight`
- **Unique:** `(restaurant_id, day_of_week)`

### ScheduleConfig
- **Naturaleza:** configuración de scheduling por restaurante
- **Campos clave:** `restaurant_id`, `min_shift_duration`, `min_split_break`, `shift_boundary_time`, `shift_boundary_label_morning`, `shift_boundary_label_night`
- **shift_boundary_time:** hora de corte mañana/noche (default 15:00). Configurable por restaurante

### Schedule
- **Naturaleza:** horario semanal de un restaurante
- **Estados:** `draft` → `published` → `archived`
- **Edición retroactiva:** un schedule `published` puede editarse retroactivamente (ausencias, correcciones). El archivado es automático por cron job para semanas pasadas
- **Lock técnico:** `schedule_locks` controla concurrencia de edición — no es estado semántico

### ScheduleEntry
- **Naturaleza:** turno individual dentro de un schedule
- **Campos clave:** `schedule_id`, `employment_id`, `entry_date`, `day_type`, `start_time`, `end_time`, `zone_id?`, `source`
- **source:** indica el origen del entry — `manual`, `request_vacation`, `request_sick_leave`, `shift_swap`, `generated_template`, etc.

### ShiftTemplate
- **Naturaleza:** plantilla reutilizable de turno dentro de un restaurante
- **Tipos:** `continuous` (una franja) o `split` (dos franjas: mañana + tarde)
- **Campos clave:** `restaurant_id`, `name`, `type`, `start_time`, `end_time`, `split_start_time?`, `split_end_time?`
- **Operación especial:** "copiar semana anterior" es operación del `scheduleDraftService`, no una entidad

### TaskInstance
- **Naturaleza:** tarea concreta asignada a una persona
- **Invariante I-030:** no puede existir sin `assigned_employee_id`

### Request
- **Naturaleza:** solicitud laboral/administrativa del personal
- **Tipos:** `vacation`, `sick_leave`, `justified_absence`, `absence`
- **Estados:** `pending` → `in_review` → `approved` / `rejected` / `cancelled` / `expired`
- **Aprobación:** `manager` (operativas) / `office` (contractuales)
- **Invariante:** nadie puede autoaprobar su propia solicitud
- **Efecto:** cuando `approved` y tipo bloquea fechas → sobrescribe schedule automáticamente

### ShiftSwapRequest
- **Flujo:** A propone → B acepta → manager aprueba → schedule actualizado
- **Condiciones:** mismo restaurante, mismos activos, mismo `job_title`, mismo `responsibility_level`

### Incident
- **Categorías:** `operational`, `maintenance`, `hygiene`, `customer`, `security`, `stock`, `technology`, `personnel`
- **Enrutamiento por categoría** → ver D-110
- **Sensibilidad:** `normal` / `restricted` (restricted no visible para `area_lead`)
- **Estados:** `reported` → `in_review` → `resolved` → `closed`

### TimeRecord
- **Naturaleza:** registro de fichaje de entrada/salida
- **Fuentes:** `manual`, `qr_scan`, `agora_pos`, `import`
- **QR scan:** valida geolocalización. Si distancia ≤ `checkin_radius_meters` → `geolocation_valid = true`
- **Campos geo:** `clock_in_latitude`, `clock_in_longitude`, `clock_in_distance_meters`, análogos para clock_out

### VacationEntitlement
- **Naturaleza:** historial anual de vacaciones por empleado
- **Una fila por employment_id por year**
- **Campos clave:**
  - `days_accrued` — acumulado por prorrateo (30/365 × días trabajados)
  - `days_carried_over` — arrastrados del año anterior
  - `days_adjusted` — ajuste manual de `office`
  - `adjustment_note` — nota justificativa del ajuste
  - `days_used` — consumidos por requests aprobadas
  - `days_available` — columna generada: `accrued + carried_over + adjusted - used`
  - `is_settled` + `settled_at` — marcado al terminar contrato

### DeliveryNote
- **Flujo:** empleado sube → OCR propone → empleado confirma → office valida
- **Separación de funciones:** quien sube ≠ quien valida como office

### Document
- **Naturaleza:** soporte transversal de archivos para otros módulos
- **owner_type:** `person`, `employment_relationship`, `request`, `restaurant`, `delivery_note`

### Notification
- **Canales:** push (operativo urgente) / email (administrativo/contractual)
- **No equivale a:** AuditLog ni notification_outbox

### AuditLog
- **Nivel 2:** registra todo CREATE, UPDATE, DELETE desde el día 1
- **Campos:** `actor_user_id`, `actor_role`, `trace_id`, `entity_type`, `entity_id`, `previous_value_json`, `new_value_json`
- **Invariante I-032:** inmutable — solo INSERT permitido

---

## Relaciones clave

```
platform.subscriptions
  └── → Organization (1:1)

Organization
  ├── 0..N Chain → organization_id (FK obligatoria)
  └── 1..N Company → organization_id (FK obligatoria)
        └── 1..N Restaurant → company_id
              └── 0..N Zone

Chain (opcional)
  └── vínculo comercial con Company (chain_id nullable en companies)

Person
  ├── 1 system_role (fuente única de verdad)
  ├── 1 access_status
  ├── 0..1 EmploymentRelationship activo
  │         ├── → Company
  │         └── → Restaurant
  │               └── 0..N VacationEntitlement (por año)
  └── 0..N RoleScopeAssignment
            ├── authority_tier (primary/secondary — solo managers)
            └── → scope (Organization/Chain/Company/Restaurant/Zone)

Restaurant
  ├── → Company (obligatorio)
  ├── → Chain (opcional)
  ├── qr_token (único, para fichaje)
  ├── latitude + longitude + checkin_radius_meters
  ├── 0..7 RestaurantHours (una por día)
  ├── 1 ScheduleConfig
  ├── 0..N Zone
  ├── 0..N Schedule
  │         └── 0..N ScheduleEntry → EmploymentRelationship
  ├── 0..N ShiftTemplate
  ├── 0..N TaskInstance → Person
  ├── 0..N Request → Person
  ├── 0..N ShiftSwapRequest
  ├── 0..N Incident
  └── 0..N DeliveryNote
              ├── → Supplier (organization o restaurant scope)
              ├── 1..N DeliveryNoteLine → Product
              └── 0..1 Document

TimeRecord
  └── → EmploymentRelationship
```

---

## Fuentes de verdad por concepto

| Concepto | Fuente de verdad |
|---|---|
| Boundary de tenant | `organizations` |
| Suscripción SaaS | `platform.subscriptions` |
| Identidad de la persona | `persons` |
| Rol sistémico y permisos | `persons.system_role` |
| Estado de acceso | `persons.access_status` |
| Contexto laboral | `EmploymentRelationship` |
| Alcance de autoridad | `RoleScopeAssignment` |
| Jerarquía de manager | `RoleScopeAssignment.authority_tier` |
| Horario operativo del restaurante | `RestaurantHours` |
| Configuración de scheduling | `ScheduleConfig` |
| Corte mañana/noche | `ScheduleConfig.shift_boundary_time` |
| QR de fichaje | `restaurants.qr_token` |
| Radio de geolocalización | `restaurants.checkin_radius_meters` |
| Horario semanal | `Schedule` + `ScheduleEntry` |
| Días de vacaciones | `VacationEntitlement` |
| Fichajes | `TimeRecord` |
| Solicitudes laborales | `Request` |
| Cambios de turno | `ShiftSwapRequest` |
| Incidencias operativas | `Incident` |
| Recepción de mercancía | `DeliveryNote` + `DeliveryNoteLine` |
| Trazabilidad de toda operación | `AuditLog` |

---

## Enums canónicos

| Enum | Valores |
|---|---|
| `system_role_enum` | `employee`, `area_lead`, `manager`, `office`, `owner`, `admin` |
| `scope_type_enum` | `organization`, `chain`, `company`, `restaurant`, `zone` |
| `access_status_enum` | `pending_activation`, `active`, `suspended`, `archived`, `blocked` |
| `request_type_enum` | `vacation`, `sick_leave`, `justified_absence`, `absence` |
| `request_status_enum` | `pending`, `in_review`, `approved`, `rejected`, `cancelled`, `expired` |
| `schedule_status_enum` | `draft`, `published`, `archived` |
| `schedule_entry_source_enum` | `manual`, `request_vacation`, `request_sick_leave`, `request_justified_absence`, `request_absence`, `shift_swap`, `generated_template`, `generated_availability`, `generated_copy`, `import` |
| `supplier_scope_enum` | `organization`, `restaurant` |
| `task_reassignment_reason_enum` | `employment_change`, `request_conflict`, `shift_swap`, `manual_reassignment_required` |
