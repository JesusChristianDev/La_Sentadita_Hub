# UI — Pantallas MVP v0.1

Objetivo:
- Definir pantallas mínimas para que la IA no invente UI.
- Nota: “UI de auditoría” NO en MVP (solo registro).

---

## 1) Navegación mínima (MVP)
- Login
- (Office/Admin) Selector de restaurante
- Dashboard (resumen semanal + accesos)
- Horarios (published view + draft edit para manager/area_lead/admin)
- Tareas
- Horas (propias / restaurante / global según rol)
- Usuarios (solo office/admin; manager en modo limitado si aplica)
- Import CSV (solo office/admin)

Regla de scope:
- Manager NO es global: no tiene selector de restaurante y toda la UI está limitada a su restaurante.

Pantallas SHOULD (pos-MVP):
- Requests (vacaciones/baja) + aprobación
- Documentos
- Incidencias
- Anuncios/normas

---

## 2) Pantalla: Login
Campos:
- email
- password

Estados:
- must_change_password => forzar cambio
- forgot password

---

## 3) Pantalla: Selector restaurante (solo office/admin)
- dropdown/search de restaurantes
- restaurante actual visible en header

Regla:
- manager/employee NO tienen selector

---

## 4) Pantalla: Dashboard
Widgets mínimos:
- Semana actual (week_start_date, lunes)
- Botón: Horarios
- Botón: Tareas
- Botón: Horas/Reportes
- (office/admin) Botón: Import CSV
- (office/admin) Botón: Usuarios

---

## 5) Pantalla: Horarios — Vista Publicada (todos menos office)
Contenido:
- selector de semana (lunes como inicio)
- grid por empleado x día (o por día x empleado)
- indicador de tipo (continuous/split/day_off/vacation/etc)

Acciones:
- employee: solo lectura
- manager/area_lead/admin: botón “Editar draft” (si permisos)

---

## 6) Pantalla: Horarios — Editor Draft (manager/area_lead/admin; NO office)
Componentes:
- indicador de lock:
  - FREE / TOTAL (holder) / ZONE (holder+zona)
- autosave (<= 2s)
- validaciones server-side con mensajes claros

Acciones:
- Adquirir lock TOTAL (manager/admin)
- Adquirir lock ZONE (area_lead si no hay TOTAL; manager/admin también)
- Editar celdas:
  - turnos (start/end; split si aplica)
  - tipo de día (vacation, day_off, etc.)
- Publicar (solo manager/admin)

Reglas UI (no reemplazan server):
- si write falla por lock: mostrar 423 y refrescar
- si un día se marca no-trabajable: UI avisa que tareas se eliminarán
- manager no puede “cambiar restaurante”: no hay UI ni endpoint para ello

---

## 7) Modal: Publicar horario (solo manager/admin)
Requisitos:
- mostrar diff obligatorio (resumen de cambios):
  - empleados cambiados
  - días cambiados
  - cambios relevantes para notificar
- confirmación explícita

Acción:
- Publish => crea snapshot PUBLISHED (objetivo server-side p95 < 2s)

---

## 8) Pantalla: Tareas
Vistas:
- Mis tareas (employee)
- Tareas del restaurante por día y área (manager/area_lead)

Acciones:
- employee: marcar done
- area_lead: asignar dentro de su zona (si se permite)
- manager/admin: asignación completa

Regla visible:
- no permitir asignar si no hay turno compatible (y server lo revalida)

---

## 9) Pantalla: Horas
employee:
- planned_hours + adjustment_hours + actual_hours (propias)

manager:
- por restaurante (agregados + por empleado)

office:
- global/por restaurante SOLO números (agregados, sin turnos/rangos)

admin:
- todo

Export:
- manager/office/admin pueden exportar reportes

---

## 10) Pantalla: Usuarios + Import CSV (office/admin)
Usuarios:
- listado
- detalle
- asignar role=manager (solo office/admin)

Import CSV:
- upload
- pre-validación con reporte CSV
- confirmación (N usuarios)
- resultado + outbox generado (envío fuera de transacción)
