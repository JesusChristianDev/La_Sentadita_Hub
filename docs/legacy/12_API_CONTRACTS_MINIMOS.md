# API Contracts Mínimos v0.1

Objetivo:
- Definir contratos mínimos (endpoints + reglas) para implementar los 3 flujos críticos del MVP:
  1) Import CSV (atómico)
  2) Horarios draft + publicar (locks + snapshot)
  3) Vacaciones 2 pasos (CAS/409)

---

## 0) Convenciones generales

### Autenticación
- Authorization: Bearer <access_token>

### Correlation
- X-Request-Id: <uuid> (opcional; si no, el server genera)

### Idempotencia (recomendada en operaciones críticas)
- Idempotency-Key: <uuid> en:
  - confirm import
  - publish schedule
  - create request

### Formato de error estándar
Respuesta (ejemplo):
{
  "error": {
    "code": "LOCK_REQUIRED",
    "message": "Valid lock required to modify draft schedule",
    "details": { "expected": "TOTAL|ZONE", "current_lock": {...} }
  }
}

### Códigos HTTP (mínimos)
- 200 OK
- 201 Created
- 202 Accepted (si se usa job async)
- 400 Bad Request
- 401 Unauthorized
- 403 Forbidden
- 404 Not Found
- 409 Conflict (CAS / estado cambiado)
- 422 Unprocessable Entity (validación negocio)
- 423 Locked (conflicto de lock)

---

## 1) Scope por restaurante (REGLA CRÍTICA)

### Regla server-side obligatoria
- Si role in (employee, manager, area_lead):
  - restaurant_scope = profile.restaurant_id
  - si el path incluye /restaurants/{restaurantId} y restaurantId != profile.restaurant_id => 403/404
- Si role in (office, admin):
  - restaurant_scope = ANY (pueden operar con cualquier restaurantId)
- EXCEPCIÓN: office NO puede acceder a ningún endpoint de schedule (/schedule/*) => 403/404

---

## 2) Flujo 1 — Import CSV (atómico)

Roles permitidos:
- office, admin

### 2.1 Pre-validación
POST /imports/users/prevalidate
Content-Type: multipart/form-data
Body:
- file: <csv>

Response 200:
{
  "prevalidation_id": "pv_123",
  "total_rows": 120,
  "valid_rows": 118,
  "invalid_rows": 2,
  "errors_download_url": "/imports/users/prevalidate/pv_123/errors.csv",
  "summary": {
    "will_create_users": 118
  }
}

### 2.2 Descargar errores
GET /imports/users/prevalidate/{prevalidationId}/errors.csv
Response 200:
- CSV (row_number,column_name,error_code,error_message,raw_value)

### 2.3 Confirmar import (transacción atómica)
POST /imports/users/confirm
Body:
{
  "prevalidation_id": "pv_123"
}

Response 201:
{
  "import_id": "imp_456",
  "created_users": 118,
  "created_outbox_messages": 118
}

Reglas:
- Si existe cualquier error => no se permite confirmación.
- Create-only: si email ya existe => error en prevalidación (y no se importa nada).
- Outbox messages se crean en transacción; envío ocurre fuera de transacción.

---

## 3) Flujo 2 — Horarios (draft + locks + publicar snapshot)

Notas:
- office: prohibido (403/404) en TODO /schedule/*
- employee: solo lectura de PUBLISHED
- manager/admin: puede editar draft + publicar
- area_lead: puede editar draft SOLO con lock ZONE y sin lock TOTAL activo

### 3.1 Leer horario publicado (snapshot)
GET /restaurants/{restaurantId}/schedule/weeks/{weekStartDate}/published

Response 200:
{
  "restaurant_id": "rest_001",
  "week_start_date": "2026-02-09",
  "state": "PUBLISHED",
  "snapshot_id": "pub_abc",
  "cells": [
