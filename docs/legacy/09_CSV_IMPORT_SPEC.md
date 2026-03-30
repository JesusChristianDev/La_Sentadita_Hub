# CSV Import — SPEC v0.1 (atómico)

Objetivo:
- Office importa empleados (role=employee) de forma atómica.
- Si hay 1 error -> se importa 0.
- Se crean auth.users + profiles + password temporal + outbox_messages (sin enviar dentro de transacción).

---

## 1) Formato de archivo
- Tipo: CSV
- Encoding: UTF-8
- Delimitador: coma (,)
- Cabecera: obligatoria
- EOL: CRLF/LLF aceptado

Límites:
- Tamaño máx: 5MB
- Filas máx: 2000

---

## 2) Columnas (MVP)
> En el MVP, SOLO se permite role=employee. No se importan managers.

### Requeridas
- email
- full_name
- restaurant_ref  (restaurant_code estable)
- position_ref   (position_name exacto, case-insensitive)

### Opcionales
- phone
- address_home
- emergency_phone
- vacation_initial_balance
- is_area_lead (true/false)  (solo válido si el área viene del puesto)
- hire_date (YYYY-MM-DD)

### Prohibidas / reglas especiales
- employee_code: se genera siempre (identity) y es inmutable
- role:
  - si viene, debe ser vacío o exactamente "employee"
  - cualquier otro valor => error

---

## 3) Reglas de validación (pre-validación)
Para cada fila:
- email:
  - formato válido
  - no duplicado dentro del CSV
  - NO puede existir ya en sistema (MVP = create-only)
- full_name: no vacío
- restaurant_ref:
  - debe mapear a Restaurant.restaurant_code existente
- position_ref:
  - debe mapear a Position.name existente (match case-insensitive)
- is_area_lead:
  - si true => Position.area debe estar en (barra|sala|cocina)
- formatos:
  - hire_date: ISO (YYYY-MM-DD) si viene
  - teléfonos: normalización server-side (permitir + y dígitos)

Si hay cualquier error:
- NO se permite pasar a confirmación
- se devuelve reporte descargable de errores

---

## 4) UX / Flujo (MVP)
### Paso 1 — Pre-validación
Office sube CSV:
- Server devuelve:
  - total filas
  - total válidas / inválidas
  - lista de errores por fila/columna
  - resumen: “se crearán N usuarios”

### Paso 2 — Confirmación
Office confirma:
- Server ejecuta transacción atómica:
  - create auth.users
  - create profiles
  - generate temporary password
  - set must_change_password=true
  - create outbox_messages para email onboarding

### Fuera de transacción
- Worker procesa outbox:
  - envía email
  - registra outcome
  - retries + dead-letter (max_retries=10)

---

## 5) Reporte de errores (formato)
- Descargable como CSV
- Debe incluir:
  - row_number (1-based)
  - column_name
  - error_code
  - error_message (humano)
  - raw_value

---

## 6) Ejemplo (válido)
email,full_name,restaurant_ref,position_ref,phone,is_area_lead,hire_date
ana@example.com,Ana Pérez,REST_001,Camarero,+34600111222,false,2026-02-01
juan@example.com,Juan Ruiz,REST_001,Cocinero,+34600333444,true,2026-02-03
