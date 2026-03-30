# Roadmap Sprint 1 (1 semana)

## Objetivo
Consolidar estabilidad de auth/sesion, blindar regresiones con CI E2E smoke y retomar avance funcional con control por rol.

## Tablero

### To Do

#### S1-04 UX por rol
- Descripcion: Revisar navegacion y visibilidad por rol (`admin`, `office`, `manager`, `sub_manager`, `employee`).
- Criterios de aceptacion:
  - No hay links/acciones visibles fuera de alcance por rol.
  - No hay duplicidad de destinos en menu/tabbar.
  - Vistas vacias tienen mensaje claro y accion sugerida.

#### S1-05 Hardening operativo
- Descripcion: Estandarizar captura de errores server-side y respuesta amigable en UI.
- Criterios de aceptacion:
  - Errores clave quedan trazados con contexto minimo (`ruta`, `usuario`, `accion`).
  - Fallos de acciones muestran mensaje util no tecnico.
  - Existe runbook corto de diagnostico en `docs/`.

#### S1-06 Backlog funcional
- Descripcion: Cerrar funcionalidad prioritaria de empleados/encargados con QA funcional.
- Criterios de aceptacion:
  - Flujo completo probado por al menos 2 roles.
  - Reglas de negocio de encargados validadas con datos reales.
  - Sin regresiones en login, `/app`, `/employees`, `/me`.

### Doing

#### S1-03 Calidad de tests E2E
- Descripcion: Separar smoke y auth-flow con convencion de entorno.
- Estado actual:
  - Suite E2E ampliada creada.
  - Smoke + auth-flow en verde en entorno local.
- Criterios de aceptacion:
  - `npm run test:e2e` ejecuta smoke siempre.
  - Auth-flow corre cuando existen `E2E_LOGIN_EMAIL` y `E2E_LOGIN_PASSWORD`.
  - README/nota de uso de variables actualizada.

### Done

#### S1-01 Estabilizacion y baseline
- Descripcion: Recuperar estabilidad en auth/sesion y definir baseline.
- Evidencia:
  - Flujo principal operativo validado (`/app`, `/employees`, `/me`).
  - Signout movido a `POST` para evitar logout accidental por prefetch.
  - Tag estable creado localmente (`stable-2026-02-18`).

#### S1-02 CI/Smoke base
- Descripcion: Definir pruebas minimas de no regresion.
- Evidencia:
  - Casos smoke implementados en E2E:
    - guards sin sesion (`/app`, `/employees`, `/me` -> `/login`)
    - login errores basicos
    - estado pending en submit de login
  - Casos auth-flow implementados:
    - navegar `/employees` y `/me`
    - cambio de sucursal (si aplica)
    - logout y bloqueo de privadas

## Orden de ejecucion recomendado
1. Cerrar S1-03 (documentacion de ejecucion E2E y convencion de entornos).
2. Ejecutar S1-04 (UX por rol) con lista corta de hallazgos y fixes.
3. Ejecutar S1-05 (hardening) y publicar runbook.
4. Cerrar S1-06 con QA funcional final y tag de release.
