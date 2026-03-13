# Header MVP — Matriz por rol (v0.1)

Objetivo:
- Evitar duplicidades de contenido en header.
- Congelar una politica simple y consistente para todas las pantallas actuales.
- Respetar alcance MVP y permisos vigentes.

---

## 1) Regla base del header
- El header es estructural y global.
- Incluye solo:
  - logo de la app
  - navegacion primaria (pantallas existentes)
  - bloque de cuenta (perfil + cerrar sesion)
  - selector de restaurante solo para office/admin
- El header NO incluye acciones de pantalla (crear, editar, filtros, etc.).

---

## 2) Matriz por rol

| Rol | Nav primaria | Selector restaurante | Cuenta |
|---|---|---|---|
| employee | Dashboard | NO | Mi perfil + Cerrar sesion |
| manager | Dashboard + Personal | NO | Mi perfil + Cerrar sesion |
| office | Dashboard + Personal | SI | Mi perfil + Cerrar sesion |
| admin | Dashboard + Personal | SI | Mi perfil + Cerrar sesion |

Notas:
- `Personal` apunta a `Usuarios/Equipo` en el estado actual del proyecto (`/employees`).
- `manager` no es global y no puede cambiar restaurante.
- `office/admin` son globales y usan selector en header.

---

## 3) Regla anti-duplicidad
- Debe existir una sola instancia visible del selector de restaurante por pantalla.
- Si el selector esta en header, no se duplica en contenido.
- No duplicar "Mi perfil" o "Cerrar sesion" en nav primaria y menu de cuenta al mismo tiempo.

---

## 4) Alcance MVP actual (header)
- Permitido en header:
  - Dashboard
  - Personal (si aplica por rol)
  - Mi perfil
  - Cerrar sesion
  - Selector de restaurante (office/admin)
- Fuera de header (hasta que se implementen de verdad):
  - reportes historicos
  - configuraciones avanzadas
  - manuales/documentacion operativa
  - accesos a modulos no implementados

---

## 5) Implementacion de referencia
- Politica centralizada en codigo:
  - `web/src/shared/headerPolicy.ts`
- Componente de header:
  - `web/src/app/components/app-header.tsx`
- Navegacion primaria:
  - `web/src/app/components/screen-nav.tsx`
- Navegacion movil:
  - `web/src/app/components/bottom-tab-bar.tsx`
