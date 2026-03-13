# NFRs — Requisitos No Funcionales v0.1

## DECISIONES (defaults MVP)
- Disponibilidad objetivo: 99.5% mensual
- RPO: 15 min
- RTO: 60 min
- API p95:
  - Leer schedule publicado (1 semana): < 600 ms
  - Guardar draft (autosave): < 700 ms
  - Publicar schedule (server-side): < 2000 ms
- Locks:
  - TTL: 60 s
  - Heartbeat: 15 s
  - Conflicto por lock: HTTP 423 Locked
- PWA offline: NO (solo caché de assets)
- CSV:
  - Encoding: UTF-8
  - Delimitador: coma (,)
  - Límites: 5MB / 2000 filas
- PDFs: 10MB máx
- Outbox: max_retries=10; DEAD => audit + alerta
- Navegadores objetivo: Chrome/Edge (2 últimas versiones)
- Rate limit auth: 10 intentos/min/IP + backoff
- Backups: daily 7 días + weekly 4 semanas

---

## 1) Disponibilidad y fiabilidad
- Disponibilidad: 99.5% mensual
- RPO: 15 min
- RTO: 60 min

---

## 2) Rendimiento (latencias objetivo)
### API (p95)
- Auth/login: < 800ms
- Leer schedule week (published): < 600ms
- Guardar cambios draft (autosave): < 700ms
- Publicar schedule: < 2000ms
- Crear request: < 700ms
- Import CSV prevalidación: mostrar progreso (depende de N)
- Import CSV commit (transacción): < 10s para 500 users (objetivo)

### UI
- Autosave draft <= 2s (feedback visible)
- Feedback inmediato en conflictos de lock (423)

---

## 3) Concurrencia y locks
- Locks server-side obligatorios para draft schedule.
- TTL lock: 60s
- Heartbeats: cada 15s
- Si el cliente cae:
  - lock expira por TTL
  - otro editor puede adquirir lock

---

## 4) Seguridad
### Autenticación
- Verificación email + reset password + must_change_password
- 2FA: NO en MVP

### Autorización
- Enforce server-side (nunca confiar en UI)
- Matriz de permisos: ver 08_PERMISOS_MATRIZ.md

### Protección básica
- Rate limiting en auth: 10 intentos/min/IP + backoff
- Logs de seguridad:
  - login success/fail
  - password reset requested
  - role changes

---

## 5) Privacidad / datos sensibles
- Restricción clave:
  - office NO ve ni gestiona horarios
  - office sí ve horas como números (totales) pero no schedule detail

- Retención:
  - Audit logs: 2 años
  - Outbox: 90 días

---

## 6) Observabilidad
### Logging estructurado
- request_id / correlation_id
- actor_user_id, role, restaurant_id, resource, action, outcome

### Métricas
- publish_server_p95 < 2000ms
- outbox pending→sent p95 < 15 min
- retries/dead-letter rate
- conflictos lock por semana

### Alertas (defaults MVP)
- Outbox DEAD > 0 (alerta inmediata)
- Error rate API > 5% durante 5 min (alerta)

---

## 7) Backups y migraciones
- Backups: daily (retención 7 días) + weekly (retención 4 semanas)
- Migraciones DB:
  - versionadas y repetibles
  - rollback plan por cambio

---

## 8) Compatibilidad y soporte
- Navegadores: Chrome/Edge (2 últimas versiones)
- PWA offline:
  - MVP: NO offline real (solo caché de assets)

---

## 9) Límites (anti-abuso)
- Tamaño máximo CSV: 5MB
- Máx filas CSV: 2000
- Tamaño máximo documento PDF: 10MB
