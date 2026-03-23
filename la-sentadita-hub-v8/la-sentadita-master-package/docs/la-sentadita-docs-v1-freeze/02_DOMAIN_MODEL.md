# 02 — Domain Model

## Jerarquía organizativa
```text
Chain
└── Company
    └── Restaurant
        └── Zone
```

## Entidades principales
- `person`
- `employment_relationship`
- `role_scope_assignment`
- `shift_template`
- `schedule`
- `schedule_entry`
- `schedule_entry_adjustment`
- `schedule_entry_log`
- `schedule_publish_event`
- `task_template`
- `task_instance`
- `procedure`
- `shift_swap_request`
- `incident`
- `document`
- `notification`
- `notification_outbox`
- `audit_log`
- `supplier`
- `product`
- `supplier_product_alias`
- `delivery_note`
- `delivery_note_line`

## Distinciones críticas

### `system_role`
Permisos del sistema. Vive en `person.system_role`.
Es la única fuente de verdad del rol.
Una persona tiene un único `system_role` activo.

### `job_title`
Trabajo real que realiza la persona. Vive en `employment_relationship`.
No define permisos del sistema.

### `responsibility_level`
No es un campo independiente en v1; se deriva del `system_role`.

### `area_lead`
Es un `system_role` oficial del sistema, no una tabla separada.
Su scope de zona se materializa en `role_scope_assignments` con `scope_type = zone`.

## Fuente de verdad del rol — regla fija

```
person.system_role         → rol del sistema (fuente única)
employment_relationship    → contexto laboral y operativo (no define permisos)
role_scope_assignment      → scopes del rol activo (no introduce roles alternativos)
```

La autorización se resuelve siempre en este orden:
1. leer `person.system_role`
2. leer scopes activos desde `role_scope_assignment`
3. aplicar ACL por acción

## Conexión con Supabase Auth — Decisión v5

`persons.person_id` es el mismo UUID que `auth.users.id`.
La autenticación la gestiona Supabase Auth de forma nativa.
No existe join adicional entre auth y el modelo de negocio.

## Historial de cambios en scheduling — Decisión v5

Dos tablas dedicadas complementan el `audit_log` genérico:
- `schedule_entry_adjustments`: cambios manuales con razón obligatoria
- `schedule_entry_logs`: todos los cambios incluyendo automáticos

## Notificaciones push — Decisión v5

Dos capas separadas por propósito:
- `notifications`: notificaciones in-app, acceso directo
- `notification_outbox`: push con patrón outbox y reintentos automáticos

## Derivación de responsabilidad operativa
| system_role | responsibility_level |
|---|---|
| employee | staff |
| area_lead | zone_lead |
| sub_manager | restaurant_lead |
| manager | restaurant_lead |
| office | administrative |
| chain_owner | strategic |
| admin | platform |

## Módulo Albaranes — Decisiones v7

### OCR
Mindee Invoice API. Devuelve JSON estructurado de facturas sin configuración de plantillas.
`MINDEE_API_KEY` en variables de entorno controladas por `@t3-oss/env-nextjs`.

### Relación con Documents
Un albarán es un `document` con `document_type = delivery_note`.
El archivo vive en Supabase Storage vía el módulo Documents.
Los datos estructurados viven en `delivery_notes` + `delivery_note_lines`.

### Proveedores
`suppliers.scope_type` puede ser `chain` o `restaurant`.
Integridad referencial via trigger `validate_supplier_scope_id()`.

### Producto no reconocido
El empleado ve aviso pero puede enviar igualmente.
Oficina decide al confirmar si crea el producto o lo mapea a uno existente.
Campo `is_new_product = true` en la línea correspondiente.

### Aprendizaje
`supplier_product_aliases` registra mapeos texto → producto confirmados por oficina.
`confidence` y `times_confirmed` mejoran la extracción futura.

## OPEN QUESTIONS v5
- Departamentos dentro de oficina: pendiente de definir el papel exacto de cada persona de oficina.
  Cuando esté claro, se añadirá `department_id` en `persons` o una tabla `office_departments`.
  No implementado en v5.
