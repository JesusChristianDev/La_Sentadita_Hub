# 10 — Open Questions
## Decisiones pendientes con criterio de desbloqueo

---

## Regla de uso

Una `OPEN QUESTION` no se implementa ni se asume. Se bloquea la fase correspondiente hasta que quede cerrada. Cuando se cierra, la decisión se mueve a `01_CANON_DECISIONS.md`.

---

## OQ-001 — [cerrada] — TaskTemplate
**Cerrada en sesión del 1 de abril de 2026.** `TaskTemplate` entra en fase de lanzamiento como entidad propia dentro del módulo `tasks`, alineada con la tabla ya existente y con el flujo operativo actual. Ver [02_DOMAIN_MODEL.md](C:/la-sentadita-hub/canon/canon-v9/core/02_DOMAIN_MODEL.md) y [03_ACL_MATRIX.md](C:/la-sentadita-hub/canon/canon-v9/core/03_ACL_MATRIX.md).

---

## OQ-002 — [post-lanzamiento] — ShiftSwap con aprobación automática
**Pregunta:** ¿Configuración por restaurante para swaps automáticos sin aprobación de manager?

**Criterio de desbloqueo:** feedback de uso real tras lanzamiento.

**Fase que bloquea:** no bloquea.

---

## OQ-003 — [post-lanzamiento] — Preferencias de notificación por usuario
**Pregunta:** ¿Puede cada usuario configurar qué eventos recibe por push y cuáles por email?

**Criterio de desbloqueo:** feedback de uso real. No bloquea F10.

---

## OQ-005 — [F5] — Detección automática de late/no_show
**Pregunta:** ¿El sistema detecta automáticamente cuando un empleado llega tarde o no aparece?

**Contexto:** `time_records` con `qr_scan` ya captura la hora real de entrada. La detección automática compararía `clock_in` con el `start_time` del `ScheduleEntry` correspondiente. Si `clock_in > start_time + margen` → `late`. Si no hay `clock_in` al finalizar el turno → `no_show`.

**Opciones:**
- A — Detección automática con notificación al manager
- B — El manager registra manualmente como incidente
- C — Detección automática sin notificación — el manager lo ve en el dashboard

**Criterio de desbloqueo:** confirmar si el negocio necesita esta automatización desde el lanzamiento.

**Fase que bloquea:** F5 (Scheduling) si se elige A o C.

---

## OQ-006 — [post-lanzamiento] — Integración con Ágora POS
**Pregunta:** ¿Integración con el sistema POS Ágora para sincronizar fichajes o datos de ventas?

**Criterio de desbloqueo:** decisión de negocio post-lanzamiento.

**Fase que bloquea:** no bloquea.

---

## OQ-007 — [cerrada] — authority_tier en role_scope_assignments
**Cerrada en sesión de marzo 2026.** Ver D-131.

---

## OQ-008 — [cerrada] — Compatibilidad Company del empleo vs Restaurant operativo
**Cerrada en sesión de marzo 2026.** Todo `EmploymentRestaurantAssignment` debe permanecer dentro de la misma `Company` del `EmploymentRelationship`. Un cambio de `Company` requiere terminar el empleo vigente y crear otro nuevo. Ver D-034 e I-003.

---

## OQ-009 — [post-lanzamiento] — Transferencia estructural de Restaurant entre Company
**Pregunta:** ¿Quién puede ejecutar la transferencia excepcional de un `Restaurant` a otra `Company` y cuál es el protocolo operativo exacto?

**Contexto:** canónicamente el `Restaurant` puede cambiar de `Company` sin perder identidad, manteniendo unido su bloque operativo e histórico. Pero se considera una operación estructural de alto impacto, fuera del alcance inicial.

**Criterio de desbloqueo:** definir autorización, validaciones previas, auditoría reforzada y side effects sobre empleo, scopes y datos operativos antes de implementar el caso de uso.

**Fase que bloquea:** no bloquea el alcance actual. Solo bloquea la futura implementación del caso de uso de transferencia estructural.

---

## Cerradas en sesión de marzo 2026

| ID | Decisión cerrada |
|---|---|
| D-NEW-01 | Profile eliminado del modelo |
| D-NEW-02 | Núcleo duro definido |
| D-NEW-03 | ShiftTemplate como entidad propia |
| D-NEW-04 | Copiar semana anterior como operación |
| D-NEW-05 | Chain como agrupación comercial |
| D-NEW-06 | Zone como sección física intra-restaurante |
| D-NEW-07 | area_lead sin Zone no es válido |
| D-NEW-08 | Aprobación de Request por tipo |
| D-NEW-09 | ShiftSwap flujo doble validación |
| D-NEW-10 | Incident: cualquiera crea, sistema enruta |
| D-NEW-11 | DeliveryNote: cualquiera sube, office valida |
| D-NEW-12 | access_status: archived reversible solo por admin |
| D-NEW-13 | Notificaciones: canales predeterminados |
| D-NEW-14 | AuditLog Nivel 2 desde día 1 |
| D-NEW-15 | Archivado por entidad y rol |
| D-080..086 | Modelo de vacaciones completo |
| D-090..093 | Fichaje por QR + geolocalización |
| D-100..101 | Horario operativo y turno mañana/noche |
| D-110..111 | Enrutamiento de incidentes (OQ-004 cerrada) |
| D-120..123 | Schema platform y suscripciones |
| D-130..133 | Correcciones al canon original |
