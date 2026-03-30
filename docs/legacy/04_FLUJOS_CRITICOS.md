# Flujos críticos v0 (MVP)

## Flujo 1 — Import CSV (atómico)
1) Office sube CSV.
2) Paso 1: pre-validación (emails, duplicados, puesto existe, role solo employee, formatos).
3) Si hay errores -> no se importa nada + reporte descargable con errores.
4) Si todo OK -> confirmación (N usuarios, N emails).
5) Paso 2: transacción atómica (crear auth.users + profiles + passwords temporales + outbox_messages).
6) Worker procesa outbox (envía emails) fuera de la transacción.

## Flujo 2 — Horarios: editar draft compartido + publicar
1) Manager abre semana -> adquiere lock TOTAL; UI autosave <= 2s.
2) Area_lead puede adquirir lock ZONE si no existe TOTAL.
3) Servidor rechaza escrituras sin lock válido (TOTAL/ZONE).
4) Validaciones servidor: no tareas sin turno compatible; si día no-trabajable -> elimina tareas del día.
5) Publicar (solo manager): validación “semana completa” + diff obligatorio + confirmación.
6) Se genera snapshot publicado; notificaciones según cambios relevantes.

## Flujo 3 — Vacaciones (2 pasos)
1) Employee crea solicitud -> status PENDING_MANAGER (notifica manager).
2) Manager aprueba -> pasa a PENDING_OFFICE (notifica office) o rechaza (termina).
3) Office decide -> APPROVED/REJECTED (notifica employee).
4) Si APPROVED -> aplica bloqueo en horario (vacation/sick_leave) e impide publicación si choca con turnos/tareas.
5) Cancelación permitida solo si está en PENDING_* (CAS: compare-and-swap; si falla -> 409 con estado actual).
