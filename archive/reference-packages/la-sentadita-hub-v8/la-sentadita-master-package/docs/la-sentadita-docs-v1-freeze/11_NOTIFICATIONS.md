# 11 — Notifications v6

## Delivery Types
- `in_app`
- `push`

## Regla general de canal
**Push + in-app:** cuando el usuario necesita actuar o el evento afecta su jornada directamente.
**Solo in-app:** cuando es informativo y puede verlo cuando abra la app.

## Principio
Solo se notifican eventos relevantes para el usuario afectado o responsable directo.
Notificación ≠ auditoría (I19).

## Tabla completa de eventos — 29 eventos

### Scheduling
| Evento | Destinatario | Canal |
|---|---|---|
| `schedule_published` | Todos los empleados con entradas esa semana | Push + in-app |
| `schedule_updated` | El empleado cuya entrada cambió | Push + in-app |
| `schedule_lock_force_released` | El manager cuyo lock fue forzado | In-app |

### Tasks
| Evento | Destinatario | Canal |
|---|---|---|
| `task_assigned` | El empleado asignado | Push + in-app |
| `task_due_soon` | El empleado asignado | Push + in-app |
| `task_overdue` | El empleado asignado + su manager directo | Push + in-app |
| `task_needs_reassignment` | El manager del restaurante | In-app |
| `task_cancelled` | El empleado asignado si era personal | In-app |

### Procedures
| Evento | Destinatario | Canal |
|---|---|---|
| `procedure_created` | El manager o sub_manager que debe aprobarlo | Push + in-app |
| `procedure_approved` | El empleado solicitante | Push + in-app |
| `procedure_rejected` | El empleado solicitante | Push + in-app |
| `procedure_cancelled` | El manager si fue cancelado por el empleado | In-app |
| `procedure_in_review` | El empleado solicitante | In-app |
| `procedure_derived` | El manager al que se deriva | In-app |
| `procedure_dates_updated` | El empleado afectado | Push + in-app |

### Shift Swap
| Evento | Destinatario | Canal |
|---|---|---|
| `shift_swap_request` | El empleado target del intercambio | Push + in-app |
| `shift_swap_accepted` | El empleado solicitante | Push + in-app |
| `shift_swap_rejected` | El empleado solicitante | Push + in-app |
| `shift_swap_pending_manager` | El manager del restaurante | In-app |
| `shift_swap_manager_approved` | Ambos empleados | Push + in-app |
| `shift_swap_manager_rejected` | Ambos empleados | Push + in-app |
| `shift_swap_expired` | El empleado solicitante | In-app |

### Incidents
| Evento | Destinatario | Canal |
|---|---|---|
| `incident_created` | El manager del restaurante | Push + in-app |
| `incident_assigned` | El nuevo propietario | Push + in-app |
| `incident_status_changed` | El creador de la incidencia | In-app |
| `incident_resolved` | El creador de la incidencia | In-app |

### Documents
| Evento | Destinatario | Canal |
|---|---|---|
| `document_uploaded` | El propietario si es `employee_visible` | In-app |
| `document_requires_signature` | El propietario | Push + in-app |
| `document_superseded` | El propietario del documento anterior | In-app |

### People / Auth
| Evento | Destinatario | Canal |
|---|---|---|
| `system_role_changed` | La persona cuyo rol cambió | Push + in-app |
| `employment_terminated` | La persona cuya relación laboral termina | In-app |
| `password_must_change` | La persona afectada | Push + in-app |

### Sistema
| Evento | Destinatario | Canal |
|---|---|---|
| `push_device_registered` | La propia persona (confirmación) | In-app |

### Delivery Notes
| Evento | Destinatario | Canal |
|---|---|---|
| `delivery_note_submitted` | Oficina del restaurante | Push + in-app |
| `delivery_note_confirmed` | El empleado que subió el albarán | In-app |
| `delivery_note_rejected` | El empleado que subió el albarán | Push + in-app |

## Notas
- `task_confirmed` — NO genera notificación. Solo queda en audit log.
- `incident_restricted_marked` — Notifica solo al manager del restaurante, no al chain_owner.
