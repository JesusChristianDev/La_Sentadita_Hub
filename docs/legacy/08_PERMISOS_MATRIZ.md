# Permisos — Matriz v0.1

Reglas globales:
- Precedencia: admin > office > manager > area_lead > employee
- Enforce SIEMPRE server-side
- Scope por restaurante:
  - manager y employee están ligados a 1 restaurante (profile.restaurant_id) y NO pueden operar fuera
  - office/admin son globales (con selector)
- office NO ve ni gestiona horarios (ni draft/published/pdf/ranges/cells)

Leyenda:
- R = Read (ver)
- C = Create
- U = Update
- D = Delete
- A = Approve (aprobación workflow)
- P = Publish (publicar schedule)
- I = Import (CSV)
- M = Manage (roles/permisos config)

---

## 1) Tabla resumida (rol x módulo)

| Módulo/Recurso | employee | area_lead | manager | office | admin |
|---|---:|---:|---:|---:|---:|
| Auth (login/reset/verify) | R/U(own) | R/U(own) | R/U(own) | R/U(own) | R/U(own) |
| Perfil propio | R/U(own) | R/U(own) | R/U(own) | R/U(own) | R/U(own) |
| Usuarios (listado) | NO | NO | R(rest propio) | R(global) | R(global) |
| Usuarios (crear/import) | NO | NO | NO | I/C(global) | I/C(global) |
| Usuarios (editar datos) | NO | NO | U(rest propio, limitado) | U(global, amplio) | U(global) |
| Roles (asignar manager) | NO | NO | NO | M | M |
| Positions / catálogo | R | R | R/U(rest propio?) | R/U(global) | R/U(global) |
| Multi-rest selector | NO | NO | NO | R | R |
| Schedule PUBLISHED (ver) | R(rest propio) | R(rest propio) | R(rest propio) | NO | R(global) |
| Schedule DRAFT (ver/editar) | NO | R/ZONA(rest propio) | R/TOTAL+ZONA(rest propio) | NO | R/U(global) |
| Schedule PUBLISH | NO | NO | P(rest propio) | NO | P |
| Tasks (ver) | R(own/rest propio según asignación) | R(rest propio) | R(rest propio) | R | R |
| Tasks (asignar/editar) | NO | U(ZONA rest propio) | C/U(rest propio) | U(global) | U(global) |
| Requests (crear) | C(own) | C(own) | NO | NO | C(any) |
| Requests (aprobar step 1) | NO | NO | A(step1 rest propio) | NO | A(any) |
| Requests (aprobar step 2) | NO | NO | NO | A(step2 global) | A(any) |
| Documents (ver propios) | R(own) | R(own) | R(own) | R(own) | R(any) |
| Documents (gestionar/subir) | NO | NO | NO | C/U(global) | C/U(global) |
| Incidents (crear) | C | C | C/U(rest propio) | C/U(global) | C/U(global) |
| Hours (ver propias) | R(own) | R(own) | R(rest propio) | R(global solo números) | R(global) |
| Reports/Export hours | NO | NO | R/Export(rest propio) | R/Export(global) | R/Export(global) |
| Auditoría (escritura logs) | auto | auto | auto | auto | auto |
| Auditoría UI | NO | NO | NO | NO | NO (MVP: NO UI) |

Notas:
- Scope manager: no hay selector, no hay endpoints cross-restaurant.
- "office hours solo números": no endpoints que permitan reconstruir turnos o rangos.
- area_lead:
  - puede editar draft SOLO si adquiere lock ZONE y no existe lock TOTAL
  - solo en su zona (barra/sala/cocina) y en su restaurante

---

## 2) Reglas finas (guards) obligatorias
- Guard-0: si role in (manager, employee, area_lead) -> forzar restaurant_id = profile.restaurant_id en todas las queries
- Guard-1: si role=office -> bloquear cualquier ruta /schedule/*
- Guard-2: publicar schedule solo manager o admin
- Guard-3: asignar role=manager o posiciones especiales solo office/admin
- Guard-4: escrituras draft requieren lock válido (TOTAL o ZONE)
- Guard-5: en hours endpoints para office: devolver solo agregados (por semana/empleado) sin rangos
