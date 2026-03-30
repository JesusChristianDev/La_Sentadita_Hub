# State Machines — v0.1

Objetivo:
- Definir estados cerrados y transiciones permitidas para evitar lógica “implícita”.

---

## 1) ScheduleWeek
Estados:
- DRAFT
- PUBLISHED

Modelo:
- DRAFT es único y compartido (no hay draft por usuario)
- PUBLISHED es snapshot inmutable del momento de publicación
- week_start_date: lunes (siempre)

Transiciones:
- (none) -> DRAFT: cuando se crea la semana (o al abrir si no existe)
- DRAFT -> PUBLISHED: publish (solo manager/admin)
- PUBLISHED -> DRAFT: NO es transición (se edita DRAFT y se vuelve a publicar)

Eventos importantes:
- schedule.draft.opened
- schedule.draft.saved
- schedule.published
- schedule.republished

Reglas:
- publish requiere “semana completa” + diff obligatorio
- objetivo p95 click publicar -> snapshot disponible < 2s (server-side)
- republish con adjustment_hours != 0 requiere warning + reset de ajustes (auditoría)

---

## 2) Draft Locks (Schedule)
Tipos:
- TOTAL
- ZONE (barra|sala|cocina)

Estados de lock:
- FREE
- HELD

TTL/Heartbeat (defaults MVP):
- TTL: 60s
- Heartbeat: cada 15s

Códigos HTTP:
- Conflicto de lock (sin lock válido / lock ajeno): 423 Locked
- Conflicto CAS / estado cambiado: 409 Conflict

Transiciones:
- FREE -> HELD(TOTAL) por manager/admin
- FREE -> HELD(ZONE) por area_lead/manager/admin
- HELD(*) -> FREE por:
  - release explícito
  - expiración TTL

Reglas:
- si existe TOTAL, nadie puede adquirir ZONE
- servidor rechaza escrituras sin lock válido (TOTAL/ZONE)

---

## 3) Request (vacation | sick_leave)
Estados cerrados:
- PENDING_MANAGER
- PENDING_OFFICE
- APPROVED
- REJECTED
- CANCELLED

Transiciones:
- (none) -> PENDING_MANAGER: employee crea request
- PENDING_MANAGER -> PENDING_OFFICE: manager aprueba step 1
- PENDING_MANAGER -> REJECTED: manager rechaza
- PENDING_OFFICE -> APPROVED: office aprueba step 2
- PENDING_OFFICE -> REJECTED: office rechaza
- PENDING_MANAGER -> CANCELLED: employee cancela (CAS)
- PENDING_OFFICE -> CANCELLED: employee cancela (CAS)
- APPROVED/REJECTED/CANCELLED -> (terminal)

CAS Cancel:
- Input: expected_status
- Si expected_status != estado real -> 409 + estado actual

Reglas extra:
- sick_leave requiere PDF obligatorio
- cierre de baja abierta solo office (si aplica como sub-estado futuro)

---

## 4) OutboxMessage
Estados:
- PENDING
- SENDING
- SENT
- FAILED
- DEAD

Transiciones:
- PENDING -> SENDING (worker pick)
- SENDING -> SENT (ok)
- SENDING -> FAILED (fail)
- FAILED -> PENDING (retry, backoff)
- FAILED -> DEAD (si supera max_retries=10)

Reglas:
- envío fuera de transacción
- DEAD => audit + alerta interna + acción manual
- métrica objetivo: pending->sent p95 < 15 min

---

## 5) TaskAssignment
Estados:
- TODO
- DONE

Transiciones:
- TODO -> DONE
- DONE -> TODO (permitido, con auditoría)

Reglas:
- no existe TaskAssignment si no hay turno compatible en {date, slot}
- si el día del usuario pasa a no-trabajable -> se eliminan tasks del día (auditoría)

---

## 6) Document Reconfirm Session (seguridad)
Estados:
- VALID
- EXPIRED

Reglas:
- TTL = 10 min
- scope: sesión/dispositivo
- acciones protegidas: abrir/descargar documento

Transiciones:
- VALID -> EXPIRED por TTL
- EXPIRED -> VALID tras re-autenticación/reconfirmación
