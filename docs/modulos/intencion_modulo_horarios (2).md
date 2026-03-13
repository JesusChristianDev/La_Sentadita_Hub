# Módulo de Horarios — Documento de Intención

## ¿Qué es este módulo?

El módulo de Horarios permite gestionar la planificación semanal de los empleados de cada restaurante de La Sentadita. Es el corazón operativo de la plataforma, conectado directamente con el módulo de Trámites, Gestión de Empleados y el sistema de notificaciones.

---

## Estructura del horario

- El horario es **semanal**, de lunes a domingo.
- Cada restaurante gestiona sus horarios de forma independiente.
- Los roles globales (admin, oficina, jefes) pueden ver los horarios de todos los restaurantes.
- Se pueden visualizar y crear horarios de **semanas pasadas, la presente y la siguiente**.
- El horario es una **fuente de verdad única**: todos los roles ven el mismo horario en tiempo real.

---

## Estados del horario

- **Borrador**: en construcción, solo visible para quien lo crea.
- **Publicado**: visible para todos los empleados del restaurante.

Un horario publicado puede volver a borrador si necesita modificaciones. Al volver a publicarse, se notifica únicamente a los empleados cuyo horario haya cambiado.

**Validación al publicar:** no se puede publicar si hay celdas vacías.

**Restricción histórica:** un horario de semana pasada publicada no puede volver a borrador ni editarse directamente. Solo puede modificarse mediante el flujo de ajuste histórico.

---

## Estados de cada día por empleado

| Estado | Quién lo asigna | Descripción |
|---|---|---|
| **Trabajo continuo** | Encargado de zona o superior | Una sola franja horaria |
| **Trabajo partido** | Encargado de zona o superior | Dos franjas horarias |
| **Descanso** | Encargado de zona o superior | Día libre |
| **Ausente** | Gerente / Subgerente | Retroactivo. Puede evolucionar a baja si se justifica |
| **Vacaciones** | Automático desde Trámites | No editable manualmente |
| **Baja médica** | Automático desde Trámites | No editable manualmente |
| **No aplica** | Automático desde Gestión de Empleados | Días anteriores a la fecha de inicio del empleado |
| **Fin de contrato** | Automático desde Gestión de Empleados | Celdas bloqueadas desde la fecha de fin |

Las entradas con `source: auto` son de solo lectura. Para corregirlas hay que actuar desde el módulo de origen.

---

## ¿Quién puede hacer qué?

| Acción | Admin | Gerente | Subgerente | Encargado | Empleado |
|---|---|---|---|---|---|
| Crear horario global | ✅ | ✅ | ✅ | ❌ | ❌ |
| Editar horario de su zona | ✅ | ✅ | ✅ | ✅ | ❌ |
| Publicar horario | ✅ | ✅ | ✅ | ❌ | ❌ |
| Ajuste histórico | ✅ | ✅ | ❌ | ❌ | ❌ |
| Forzar liberación de bloqueo | ✅ | Sobre subgerente o inferior | Sobre encargado o inferior | ❌ | ❌ |
| Ver horario completo | ✅ | ✅ | ✅ | Solo su zona | ❌ |
| Ver su propio horario | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## Edición en tiempo real y bloqueo

### Sistema de bloqueo total
- Solo una persona puede editar el horario a la vez.
- Cuando alguien entra a editar, los demás ven un aviso: *"María está editando este horario ahora mismo"*.
- El bloqueo se libera automáticamente tras **10 minutos de inactividad**.
- También se libera al guardar, publicar o cerrar sesión.
- El frontend renueva el bloqueo cada 5 minutos mientras el usuario está activo.

### Adquisición atómica del bloqueo
El bloqueo se adquiere mediante la RPC `acquire_schedule_lock` que usa `ON CONFLICT` para garantizar atomicidad. Devuelve `acquired: true` si el bloqueo fue conseguido, o `acquired: false` con el nombre del usuario que lo tiene si está ocupado. Un bloqueo expirado puede ser adquirido por cualquier usuario.

### Jerarquía para forzar liberación
Admin > Gerente > Subgerente > Encargado de zona. Un rol superior puede forzar el bloqueo de un rol inferior. Todo queda registrado en el historial.

### Escrituras automáticas del sistema
Las escrituras desde Trámites y Gestión de Empleados ignoran el bloqueo siempre. Se registran en el historial con `source: auto` y `changed_by: null`.

---

## Historial de cambios

Todo cambio en el horario queda registrado: quién lo hizo, cuándo, valor anterior y nuevo valor. Incluye todos los campos: `day_type`, `start_time`, `end_time`, `split_start_time`, `split_end_time`, `zone_id`, `shift_template_id`. El historial es **inmutable**, nadie puede modificarlo ni eliminarlo. Los cambios manuales sin usuario autenticado son rechazados salvo que el ejecutor sea `service_role` o `postgres`.

---

## Concurrencia optimista (version)

Cada fila de `schedule_entries` tiene un campo `version integer`. El flujo de edición es:

1. La app lee la entrada y guarda su `version` actual.
2. Al guardar, el UPDATE incluye `WHERE id = X AND version = Y` y hace `version = version + 1`.
3. Si el UPDATE afecta 0 filas, significa que alguien más cambió esa celda primero. La app avisa al usuario y le pide que recargue.

Esto es la segunda línea de defensa tras el bloqueo total, especialmente útil tras un forzado de bloqueo.

---

## Soft delete

- `shift_templates` y `restaurant_zones`: se desactivan con `is_active = false`. Nunca se borran porque pueden estar referenciados en entradas históricas. Las entradas automáticas pueden referenciar zonas o plantillas desactivadas.
- `schedules` y `schedule_entries`: nunca se borran. El historial es inmutable.
- `schedule_entry_logs`, `schedule_entry_adjustments`, `schedule_lock_logs`: nunca se borran, son registros de auditoría.
- `push_subscriptions`: hard delete cuando el endpoint devuelve 404 o 410.
- `employee_restaurant_assignments`: nunca se borran, se cierran con `end_date`.
- `notification_outbox`: se marca con `processed_at` o `failed_at`, nunca se borra.

---

## Ajuste histórico

Los roles admin, oficina y gerente pueden corregir horarios de semanas pasadas publicadas mediante un flujo explícito y auditado a través de la RPC `apply_schedule_entry_adjustment`. El ajuste requiere un motivo obligatorio no vacío. No se pueden ajustar entradas con `source: auto`. Cada ajuste queda registrado en `schedule_entry_adjustments` con el antes y el después completos. El trigger de protección histórica solo permite edición directa cuando `app.adjustment_mode = on` y el ejecutor es `service_role` o `postgres`.

---

## Asignación de empleados a restaurantes

Los empleados pertenecen a la cadena, no a un restaurante concreto. Pueden ser transferidos entre restaurantes. La fuente de verdad para la asignación histórica es `employee_restaurant_assignments`, no `profiles.restaurant_id`. El trigger de validación verifica que el empleado estaba asignado al restaurante en la fecha exacta de la entrada.

### Fechas de inicio y fin
- Sin fecha de inicio: el empleado no aparece en ningún horario pero sus datos se conservan.
- Con fecha de inicio: aparece en el horario desde ese día. Por defecto es la fecha de creación.
- Con fecha de fin: al llegar a esa fecha el sistema desactiva al usuario y bloquea sus celdas como "Fin de contrato".

---

## Zonas de trabajo

Las zonas son completamente configurables por restaurante. Cada restaurante crea sus propias zonas con nombre personalizado. Cada empleado está asignado a una sola zona por día. Los días no laborables no tienen zona asignada.

---

## Turnos predefinidos

Cada restaurante puede crear sus propios turnos predefinidos. Los turnos pueden ser continuos o partidos. El encargado puede usar un predefinido o escribir directamente en la celda.

---

## Validaciones de turnos

### Turno continuo
- Horas entre 0 y 23.
- Inicio igual a fin: error.
- Fin menor que inicio: cruce de medianoche, válido.
- Duración mínima configurable por restaurante (por defecto 1 hora).

### Turno partido
- Las franjas desordenadas se reordenan automáticamente.
- Franjas iguales: error.
- Franjas solapadas: error.
- Primera franja cruza medianoche: no se permite segunda franja.
- Descanso mínimo entre franjas configurable por restaurante (por defecto 1 hora).

### Casos validados

| Caso | Resultado |
|---|---|
| `9-18` | ✅ Válido |
| `17-02` | ✅ Válido, cruza medianoche |
| `11-17 19-23` | ✅ Válido, turno partido |
| `19-23 11-17` | ✅ El sistema reordena |
| `9-18 17-22` | ❌ Franjas solapadas |
| `17-02 20-23` | ❌ Primera franja cruza medianoche |
| `9-9` | ❌ Duración 0 |
| `00-00` | ❌ Duración 0 |
| `25-18` | ❌ Hora imposible |
| `9-13 13-18` | ❌ Sin descanso entre franjas |

### Zonas horarias y DST
La zona horaria es configurable por restaurante en `schedule_config.timezone` (por defecto `Europe/Madrid`). Los turnos se guardan como `time` para display y como `timestamptz` para cálculos. El sistema detecta y rechaza mediante trigger en base de datos:
- Horas inexistentes (noche del cambio de marzo, gap 2:00-3:00).
- Horas ambiguas (noche del cambio de octubre, franja 2:00-3:00 se repite).

La validación cubre tramo principal y tramo partido, incluyendo cruce de medianoche en ambos días. El cálculo de horas siempre usa `EXTRACT(EPOCH FROM (end_ts - start_ts)) / 3600`.

---

## Horas y resúmenes

- Total de horas semanales visible en tiempo real en la tabla del horario.
- Sección separada de horas mensuales por empleado.
- El cálculo mensual filtra `schedule_entries` por fecha exacta dentro del mes.
- Vacaciones y bajas cuentan en el total pero se distinguen visualmente.

---

## Configuración del módulo por restaurante

Desde la pantalla de inicio el gerente puede configurar:
- Duración mínima de un turno (por defecto 1 hora).
- Descanso mínimo entre franjas de turno partido (por defecto 1 hora).
- Zona horaria del restaurante (por defecto `Europe/Madrid`).

---

## Horario de apertura del restaurante

Cada restaurante tiene configurado su horario de apertura y cierre por día de la semana. La hora de cierre se usa como hora de corte del día para turnos que cruzan medianoche.

---

## Row Level Security (RLS)

Filosofía: **RLS estricto**. La base de datos es la autoridad final. Ningún cliente autenticado puede acceder a datos fuera de su scope aunque lo intente directamente contra la API de Supabase.

### Reglas generales por rol
- `employee`: solo ve sus propios datos.
- `zone_lead`: solo ve su zona en su restaurante.
- `manager` y `submanager`: ven su restaurante completo.
- `admin` y `office`: ven todo.
- Logs, outbox y tablas de auditoría: solo lectura para clientes, escritura exclusiva del sistema via `SECURITY DEFINER`.
- Configuración (`restaurant_zones`, `restaurant_hours`, `schedule_config`, `shift_templates`): solo la modifica el manager o superior.

### Tablas con RLS activo
`schedule_entries`, `schedules`, `push_subscriptions`, `notification_outbox`, `schedule_entry_logs`, `schedule_lock_logs`, `schedule_entry_adjustments`, `restaurant_zones`, `restaurant_hours`, `schedule_config`, `shift_templates`.

---

## Usabilidad en escritorio — Pantalla de inicio

- Card semana actual: estado y acceso directo.
- Card semana siguiente: crear o editar.
- Card semana anterior: solo consulta.
- Card turnos predefinidos.
- Card horario del restaurante.
- Card configuración.
- Card resumen de horas.

---

## Usabilidad en escritorio — Vista de edición

- Tabla con todos los empleados como filas y los 7 días como columnas, ordenada por zona.
- Filtros por zona, empleado y tipo de turno.
- Columna de total de horas al final de cada fila, actualizada en tiempo real.
- Resumen de cobertura por zona y día.

### Cómo se rellena una celda
- `9-18` → turno continuo `9:00-18:00`.
- `11-17 19-23` → turno partido.
- `L` o vacío → descanso.

Las celdas automáticas (vacaciones, baja, no aplica, fin de contrato) tienen color diferente y no son editables.

### Drag and drop
El encargado puede arrastrar turnos predefinidos sobre celdas para asignarlos rápidamente.

---

## Copiar horario

Se copian turnos de trabajo y descansos de la semana anterior. Las entradas con `source: auto` no se copian.

---

## Vista en móvil (empleado)

### Navegación
Flechas izquierda y derecha con la fecha de la semana en el centro. Al pulsar una notificación, la app abre directamente la semana afectada.

### Vista de la semana
Lista vertical, un día por fila. Información: fecha, hora de entrada y salida (o dos franjas si es partido), y tareas del día. Total de horas semanales al final.

### Días especiales
Color e icono diferente con frase aleatoria:
- Descanso: "¡Que descanses!", "Tómatelo con calma hoy", "Día para recargar pilas".
- Vacaciones: "¡Disfruta tus vacaciones!", "Te lo has ganado", "Desconecta y recarga".
- Baja: "Recupérate pronto", "Lo más importante es tu salud".

### Sección de horas
Sección separada con horas mensuales, distinguiendo horas trabajadas de vacaciones y baja.

### Restricciones
El empleado solo ve su propio horario.

---

## Notificaciones

### Sistema push con VAPID
- PWA con Web Push nativo, sin dependencias externas.
- Notificaciones llegan aunque la app esté cerrada.
- Cada publicación genera sus propias notificaciones independientemente de la frecuencia.
- Cualquier cambio en cualquier campo del día de un empleado genera notificación.
- Mensaje de cambio: "Se ha cambiado tu horario, pulsa para ver".
- Recordatorio 1 hora antes del inicio de cada turno.

### Arquitectura anti-miss y anti-spam
- **Outbox transaccional**: las notificaciones se insertan en base de datos dentro de la misma transacción que la publicación.
- **`send_after`**: las notificaciones de recordatorio se insertan al publicar con `send_after = start_ts - 1 hora`. El worker solo procesa filas donde `send_after <= now()`.
- **Idempotencia por evento**: cada publicación crea un `schedule_publish_event`. El outbox tiene `UNIQUE(publish_event_id, employee_id)` con `ON CONFLICT DO NOTHING`.
- **Claim atómico**: el worker usa `FOR UPDATE SKIP LOCKED` para evitar envíos duplicados en paralelo.
- **`processing_since`**: si el worker muere durante el procesamiento, tras 5 minutos otro worker puede reclamar esas filas. Máximo 3 intentos antes de marcar como fallida.
- **Limpieza de suscripciones inválidas**: si Web Push responde 404 o 410, la suscripción se elimina automáticamente.

### Restricciones de notificación
Solo reciben notificación los empleados activos en esa semana. Los empleados sin fecha de inicio o con fin de contrato no reciben notificaciones.

---

## Integración con otros módulos

- **Trámites → Horarios**: vacaciones y bajas aprobadas se asignan automáticamente con `source: auto`. Ignoran el bloqueo de edición.
- **Gestión de Empleados → Horarios**: fechas de inicio y fin determinan celdas editables, "No aplica" o "Fin de contrato". Ignoran el bloqueo.
- **Notificaciones**: el módulo dispara notificaciones al publicar, al modificar un publicado y como recordatorio 1 hora antes del turno.

---

## Plan de construcción por fases

### Fase 1 — MVP
- Crear horario semanal por restaurante.
- Asignar turnos: trabajo continuo, partido, descanso y ausente.
- Estados borrador y publicado con validación.
- Validaciones completas de turnos incluyendo cruce de medianoche y DST.
- Sistema de bloqueo con adquisición atómica y liberación automática a los 10 minutos.
- Concurrencia optimista con `version`.
- Historial de cambios inmutable.
- Ajuste histórico con motivo obligatorio.
- RLS estricto en todas las tablas.
- Notificaciones push con VAPID y outbox transaccional.
- Recordatorio 1 hora antes del turno.
- Vista del empleado en móvil.
- Total de horas semanales.

### Fase 2 — Experiencia completa
- Drag and drop.
- Resumen de cobertura por zona y día.
- Copiar horario de semana anterior.
- Horas mensuales para empleado y gerente.
- Frases personalizadas en días especiales.
- Filtros en vista de escritorio.
- Pantalla de configuración del restaurante.

---

## Funcionalidades futuras

- Avisos sobre festivos nacionales y locales.
- Avisos sobre eventos importantes.
- Tests automáticos DST para fechas reales de cambio de hora (2026-03-29 y 2026-10-25).
- Zona horaria configurable por restaurante ya está preparada en BD, solo falta UI.

---

## Diseño de base de datos

### Cambios en `profiles`
```sql
ALTER TABLE public.profiles
  ADD COLUMN start_date date,
  ADD COLUMN end_date date;
```

### `employee_restaurant_assignments`
```sql
CREATE TABLE public.employee_restaurant_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.profiles(id),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id),
  start_date date NOT NULL,
  end_date date,
  assigned_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(employee_id, start_date)
);

ALTER TABLE public.employee_restaurant_assignments
  ADD CONSTRAINT era_dates_valid
  CHECK (end_date IS NULL OR end_date >= start_date);

CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE public.employee_restaurant_assignments
  ADD CONSTRAINT era_no_overlap
  EXCLUDE USING gist (
    employee_id WITH =,
    daterange(start_date, COALESCE(end_date, 'infinity'::date), '[]') WITH &&
  );

CREATE INDEX IF NOT EXISTS idx_era_lookup
  ON public.employee_restaurant_assignments (employee_id, restaurant_id, start_date, end_date);
```

### `restaurant_zones`
```sql
CREATE TABLE public.restaurant_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id),
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(restaurant_id, name)
);
```

### `restaurant_hours`
```sql
CREATE TABLE public.restaurant_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id),
  day_of_week smallint NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  is_open boolean NOT NULL DEFAULT true,
  open_time time,
  close_time time,
  crosses_midnight boolean NOT NULL DEFAULT false,
  UNIQUE(restaurant_id, day_of_week)
);
```

### `schedule_config`
```sql
CREATE TABLE public.schedule_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) UNIQUE,
  min_shift_duration interval NOT NULL DEFAULT '1 hour',
  min_split_break interval NOT NULL DEFAULT '1 hour',
  timezone text NOT NULL DEFAULT 'Europe/Madrid'
    CHECK (timezone IN (SELECT name FROM pg_timezone_names)),
  updated_by uuid REFERENCES public.profiles(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

### `shift_templates`
```sql
CREATE TABLE public.shift_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id),
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('continuous', 'split')),
  start_time time NOT NULL,
  end_time time NOT NULL,
  split_start_time time,
  split_end_time time,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

### `schedules`
```sql
CREATE TABLE public.schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id),
  week_start date NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  created_by uuid NOT NULL REFERENCES public.profiles(id),
  published_by uuid REFERENCES public.profiles(id),
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(restaurant_id, week_start)
);

ALTER TABLE public.schedules
  ADD CONSTRAINT chk_week_start_is_monday
  CHECK (EXTRACT(ISODOW FROM week_start) = 1) NOT VALID;

ALTER TABLE public.schedules
  VALIDATE CONSTRAINT chk_week_start_is_monday;
```

### `schedule_locks`
```sql
CREATE TABLE public.schedule_locks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id uuid NOT NULL REFERENCES public.schedules(id) UNIQUE,
  locked_by uuid NOT NULL REFERENCES public.profiles(id),
  locked_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);
```

### `schedule_lock_logs`
```sql
CREATE TABLE public.schedule_lock_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id uuid NOT NULL REFERENCES public.schedules(id),
  locked_by uuid NOT NULL REFERENCES public.profiles(id),
  locked_at timestamptz NOT NULL,
  released_by uuid REFERENCES public.profiles(id),
  release_type text NOT NULL CHECK (release_type IN ('natural', 'timeout', 'forced')),
  released_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.schedule_lock_logs
  ADD CONSTRAINT chk_lock_log_released_by_consistency
  CHECK (
    (release_type = 'timeout' AND released_by IS NULL) OR
    (release_type IN ('natural', 'forced') AND released_by IS NOT NULL)
  );

CREATE INDEX IF NOT EXISTS idx_lock_logs_lookup
  ON public.schedule_lock_logs (schedule_id, released_at DESC);
```

### `schedule_entries`
```sql
CREATE TABLE public.schedule_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id uuid NOT NULL REFERENCES public.schedules(id),
  employee_id uuid NOT NULL REFERENCES public.profiles(id),
  date date NOT NULL,
  day_type text NOT NULL CHECK (day_type IN (
    'work', 'rest', 'vacation', 'sick_leave',
    'absent', 'not_applicable', 'end_of_contract'
  )),
  shift_template_id uuid REFERENCES public.shift_templates(id),
  start_time time,
  end_time time,
  split_start_time time,
  split_end_time time,
  start_ts timestamptz,
  end_ts timestamptz,
  split_start_ts timestamptz,
  split_end_ts timestamptz,
  zone_id uuid REFERENCES public.restaurant_zones(id),
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'auto')),
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(schedule_id, employee_id, date)
);

ALTER TABLE public.schedule_entries
  ADD CONSTRAINT chk_schedule_entry_coherence
  CHECK (
    CASE day_type
      WHEN 'work' THEN
        start_time IS NOT NULL AND end_time IS NOT NULL AND
        start_time <> end_time AND zone_id IS NOT NULL AND
        (
          (split_start_time IS NULL AND split_end_time IS NULL) OR
          (split_start_time IS NOT NULL AND split_end_time IS NOT NULL
            AND split_start_time <> split_end_time)
        )
      ELSE
        start_time IS NULL AND end_time IS NULL AND
        split_start_time IS NULL AND split_end_time IS NULL AND
        zone_id IS NULL AND shift_template_id IS NULL
    END
  ) NOT VALID;

ALTER TABLE public.schedule_entries
  VALIDATE CONSTRAINT chk_schedule_entry_coherence;

-- Índices para queries frecuentes
CREATE INDEX IF NOT EXISTS idx_entries_schedule
  ON public.schedule_entries (schedule_id, date);

CREATE INDEX IF NOT EXISTS idx_entries_employee_date
  ON public.schedule_entries (employee_id, date);

CREATE INDEX IF NOT EXISTS idx_entries_schedule_zone
  ON public.schedule_entries (schedule_id, zone_id, date);
```

### `schedule_entry_logs`
```sql
CREATE TABLE public.schedule_entry_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_entry_id uuid NOT NULL REFERENCES public.schedule_entries(id),
  changed_at timestamptz NOT NULL DEFAULT now(),
  changed_by uuid REFERENCES public.profiles(id),
  change_source text NOT NULL CHECK (change_source IN ('manual', 'auto')),
  previous_day_type text,
  new_day_type text,
  previous_start_time time,
  new_start_time time,
  previous_end_time time,
  new_end_time time,
  previous_split_start_time time,
  new_split_start_time time,
  previous_split_end_time time,
  new_split_end_time time,
  previous_zone_id uuid REFERENCES public.restaurant_zones(id),
  new_zone_id uuid REFERENCES public.restaurant_zones(id),
  previous_shift_template_id uuid REFERENCES public.shift_templates(id),
  new_shift_template_id uuid REFERENCES public.shift_templates(id)
);

CREATE INDEX IF NOT EXISTS idx_entry_logs_lookup
  ON public.schedule_entry_logs (schedule_entry_id, changed_at DESC);
```

### `schedule_entry_adjustments`
```sql
CREATE TABLE public.schedule_entry_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_entry_id uuid NOT NULL REFERENCES public.schedule_entries(id),
  adjusted_by uuid NOT NULL REFERENCES public.profiles(id),
  adjusted_at timestamptz NOT NULL DEFAULT now(),
  reason text NOT NULL CHECK (length(trim(reason)) > 0),
  previous_day_type text,
  new_day_type text,
  previous_start_time time,
  new_start_time time,
  previous_end_time time,
  new_end_time time,
  previous_split_start_time time,
  new_split_start_time time,
  previous_split_end_time time,
  new_split_end_time time,
  previous_zone_id uuid REFERENCES public.restaurant_zones(id),
  new_zone_id uuid REFERENCES public.restaurant_zones(id),
  previous_shift_template_id uuid REFERENCES public.shift_templates(id),
  new_shift_template_id uuid REFERENCES public.shift_templates(id)
);

CREATE INDEX IF NOT EXISTS idx_adjustments_lookup
  ON public.schedule_entry_adjustments (schedule_entry_id, adjusted_at DESC);
```

### `push_subscriptions`
```sql
CREATE TABLE public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.profiles(id),
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  UNIQUE(employee_id, endpoint)
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_employee
  ON public.push_subscriptions(employee_id);
```

### `schedule_publish_events`
```sql
CREATE TABLE public.schedule_publish_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id uuid NOT NULL REFERENCES public.schedules(id),
  published_by uuid NOT NULL REFERENCES public.profiles(id),
  published_at timestamptz NOT NULL DEFAULT now(),
  prev_published_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_publish_events_schedule
  ON public.schedule_publish_events(schedule_id, published_at DESC);
```

### `notification_outbox`
```sql
CREATE TABLE public.notification_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.profiles(id),
  schedule_id uuid NOT NULL REFERENCES public.schedules(id),
  publish_event_id uuid REFERENCES public.schedule_publish_events(id),
  title text NOT NULL,
  body text NOT NULL,
  send_after timestamptz NOT NULL DEFAULT now(),
  processing_since timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  failed_at timestamptz,
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  UNIQUE(publish_event_id, employee_id)
);

CREATE INDEX IF NOT EXISTS idx_outbox_pending
  ON public.notification_outbox (send_after, created_at)
  WHERE processed_at IS NULL AND failed_at IS NULL AND attempts < 3;
```

---

## Decisiones de arquitectura clave

- `profiles.restaurant_id` ya no es fuente de verdad para asignación. La fuente es `employee_restaurant_assignments`.
- `source: auto` solo puede escribirlo `service_role`. Los usuarios autenticados solo pueden escribir `source: manual`.
- Las entradas con `source: auto` son inmutables para usuarios normales. Solo pueden corregirse desde el módulo de origen.
- Los horarios de semanas pasadas publicadas solo pueden modificarse mediante `apply_schedule_entry_adjustment`.
- El historial de cambios y ajustes es inmutable. Ningún rol puede modificarlos ni eliminarlos.
- El cálculo de horas siempre usa `timestamptz` (`*_ts`), nunca `time` directamente.
- La zona horaria es configurable por restaurante en `schedule_config.timezone`. Por defecto `Europe/Madrid`.
- Las horas inexistentes (DST marzo) y ambiguas (DST octubre, franja 02:00-03:00) son rechazadas por trigger en base de datos, incluyendo cruce de medianoche en tramo principal y partido.
- El sistema de notificaciones usa outbox transaccional + `send_after` + idempotencia por evento + claim atómico + `processing_since` para garantizar exactamente un envío por publicación por empleado con recuperación automática ante fallos del worker.
- `changed_by: null` siempre identifica al sistema en el historial.
- `release_type: timeout` permite `released_by: null` en `schedule_lock_logs`.
- `is_active = false` es el soft delete de `shift_templates` y `restaurant_zones`. El resto de tablas nunca se borran.
- La concurrencia optimista usa `version` en `schedule_entries`. El UPDATE debe incluir `WHERE version = X` y hacer `version = version + 1`. Si afecta 0 filas hay conflicto.
- RLS estricto en todas las tablas. La base de datos es la autoridad final, independientemente del código de la app.
