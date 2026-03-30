# 09 — Catálogo de Notificaciones
## Eventos, canales predeterminados y destinatarios

---

## Principio

Cada evento de dominio tiene un canal predeterminado:
- **Push** → operativo urgente, requiere atención inmediata
- **Email** → administrativo/contractual, para registro y consulta posterior
- **Ambos** → crítico de seguridad o acceso

---

## BLOQUE — Acceso y ciclo de vida de persona

| Código | Evento | Canal | Destinatario |
|---|---|---|---|
| `person.activated` | Persona activada | Email | Persona activada |
| `access_status_changed` | Acceso suspendido/bloqueado/archivado | Email + Push | Persona afectada + admin |
| `system_role_changed` | Rol sistémico modificado | Email | Persona afectada + admin |

---

## BLOQUE — Requests (solicitudes laborales)

| Código | Evento | Canal | Destinatario |
|---|---|---|---|
| `request_created` | Nueva solicitud creada | Push | Aprobador correspondiente |
| `request_in_review` | Solicitud tomada en revisión | Push | Solicitante |
| `request_approved` | Solicitud aprobada | Email | Solicitante |
| `request_rejected` | Solicitud rechazada | Email + Push | Solicitante |
| `request_cancelled` | Solicitud cancelada | Push | Aprobador si estaba en revisión |
| `request_dates_updated` | Fechas modificadas | Push | Solicitante |

---

## BLOQUE — ShiftSwap

| Código | Evento | Canal | Destinatario |
|---|---|---|---|
| `shift_swap_request` | Swap propuesto por Empleado A | Push | Empleado B |
| `shift_swap_accepted` | Empleado B acepta | Push | Manager + Empleado A |
| `shift_swap_rejected` | Empleado B rechaza | Push | Empleado A |
| `shift_swap_pending_manager` | Esperando aprobación de manager | Push | Manager |
| `shift_swap_manager_approved` | Manager aprueba | Push | Empleado A + B |
| `shift_swap_manager_rejected` | Manager rechaza | Push | Empleado A + B |
| `shift_swap_expired` | Swap expirado sin respuesta | Push | Empleado A |

---

## BLOQUE — Schedule

| Código | Evento | Canal | Destinatario |
|---|---|---|---|
| `schedule_published` | Horario semanal publicado | Push | Todos los empleados del restaurante |
| `schedule_updated` | Turno individual modificado en publicado | Push | Empleado afectado |
| `schedule_lock_force_released` | Lock forzado liberado por manager | Push | Quien tenía el lock |

---

## BLOQUE — Incidents

| Código | Evento | Canal | Destinatario |
|---|---|---|---|
| `incident_created` — `operational` | Incidente operativo | Push | `manager` |
| `incident_created` — `hygiene` | Incidente de higiene | Push | `manager` |
| `incident_created` — `customer` | Incidente con cliente | Push | `manager` |
| `incident_created` — `maintenance` | Incidente de mantenimiento | Push | `office` |
| `incident_created` — `security` | Incidente de seguridad | Push + Email | `office` |
| `incident_created` — `technology` | Incidente tecnológico | Push | `office` |
| `incident_created` — `personnel` | Incidente de personal | Push | `office` |
| `incident_created` — `stock` | Incidente de stock | Push | `manager` + `office` |
| `incident_assigned` | Incidente tomado en revisión | Push | Creador del incidente |
| `incident_status_changed` | Estado cambiado | Push | Creador del incidente |
| `incident_resolved` | Incidente resuelto | Push | Creador del incidente |

---

## BLOQUE — Tasks

| Código | Evento | Canal | Destinatario |
|---|---|---|---|
| `task_assigned` | Tarea asignada | Push | Persona asignada |
| `task_needs_reassignment` | Tarea requiere reasignación | Push | Manager del restaurante |
| `task_overdue` | Tarea vencida sin completar | Push | Persona asignada + manager |
| `task_due_soon` | Tarea próxima a vencer | Push | Persona asignada |
| `task_cancelled` | Tarea cancelada | Push | Persona asignada |

---

## BLOQUE — DeliveryNotes

| Código | Evento | Canal | Destinatario |
|---|---|---|---|
| `delivery_note_submitted` | Albarán subido | Push | Office del restaurante |
| `delivery_note_confirmed` | Datos confirmados por empleado | Push | Office del restaurante |
| `delivery_note_rejected` | Albarán rechazado por office | Push | Quien subió el albarán |

---

## BLOQUE — Empleo y contrato

| Código | Evento | Canal | Destinatario |
|---|---|---|---|
| `employment_terminated` | Contrato terminado + días pendientes | Email | `office` con resumen de vacaciones |

---

## BLOQUE — Documentos

| Código | Evento | Canal | Destinatario |
|---|---|---|---|
| `document_uploaded` | Documento subido | Push | Destinatario del documento |
| `document_requires_signature` | Documento requiere firma | Push + Email | Persona destinataria |
| `document_superseded` | Documento reemplazado | Push | Quien lo creó |

---

## Reglas de entrega

1. Las notificaciones son **best-effort** — si fallan, no revierten la operación principal
2. Toda notificación queda registrada en `Notification` (`sent` / `failed`)
3. `notification_outbox` resuelve la entrega técnica asíncrona
4. Push solo si el destinatario tiene suscripción activa — nunca falla por ausencia de suscripción
5. `traceId` se propaga de la operación principal a la notificación

---

## OPEN QUESTION

- `OQ-003` — Preferencias de usuario por canal: configuración individual push vs email. Ver `10_OPEN_QUESTIONS.md`
