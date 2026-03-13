# Reporte de Analisis Integral del Proyecto

Fecha: 2026-02-12  
Repositorio: `C:\la-sentadita-hub`  
Analisis: estado actual del working tree (incluye cambios no committeados)

## 1) Alcance revisado
- Documentacion funcional y tecnica en `docs/*.md` y `docs/blocks/*.md`.
- Aplicacion `web/` completa: `app`, `modules`, `shared`, configuracion y scripts.
- Validaciones ejecutadas:
  - `npm run lint` (OK)
  - `npm run build` (OK)

## 2) Resumen ejecutivo
El proyecto tiene una base tecnica sana para MVP temprano: estructura modular clara, convenciones coherentes y pipeline minimo de calidad funcionando (`lint` + `build`).

El estado funcional real hoy cubre principalmente Auth + contexto de restaurante + gestion de empleados/perfil. La mayor brecha es de alcance: varios modulos marcados como MUST en la especificacion aun estan en placeholder (`export {}`).

El riesgo tecnico mas importante no es de compilacion, sino de consistencia de datos en operaciones de multiples pasos con Supabase Auth + `profiles` sin compensacion/rollback.

## 3) Hallazgos priorizados

### [HIGH] Riesgo de inconsistencias en operaciones Auth + Profile
Categoria: Consistency / Boundary Leakage  
Ubicacion:
- `web/src/modules/employees/application/createEmployee.ts:15`
- `web/src/modules/employees/application/createEmployee.ts:28`
- `web/src/modules/employees/application/updateEmployee.ts:16`
- `web/src/modules/employees/application/updateEmployee.ts:36`
- `web/src/modules/employees/application/deleteEmployee.ts:9`
- `web/src/modules/employees/application/deleteEmployee.ts:16`

Descripcion:
- `createEmployee` crea usuario en Auth y luego actualiza `profiles`; si falla el update de `profiles`, queda usuario creado parcialmente.
- `updateEmployee` actualiza `profiles` y despues Auth; si falla Auth, queda estado mixto.
- `deleteEmployee` ignora el resultado del update en `profiles` tras borrar/desactivar Auth.

Impacto:
- Datos divergentes entre Auth y dominio (`profiles`), soporte manual, mas casos borde en UI y autorizacion.

Sugerencia:
- Definir estrategia de compensacion explicita por caso (ej. en `createEmployee`, eliminar Auth si falla `profiles`; en `updateEmployee`, aplicar orden y rollback compensatorio; en `deleteEmployee`, no ignorar error de `profiles`).
- Centralizar estas operaciones en un unico servicio transaccional-orquestador.

### [HIGH] Degradacion y falsa clasificacion en login por escaneo paginado de usuarios
Categoria: KISS / Performance / Consistency  
Ubicacion:
- `web/src/app/login/actions.ts:9`
- `web/src/app/login/actions.ts:17`
- `web/src/app/login/actions.ts:58`

Descripcion:
En cada login fallido se ejecuta `isDisabledByEmail`, que pagina `listUsers` hasta 10 paginas de 1000. En volumen alto:
- Escala O(n) por intento fallido.
- Si el usuario cae fuera de las 10 paginas, se clasifica como `bad` aunque este desactivado.

Impacto:
- Costo innecesario y mensajes de error incorrectos bajo crecimiento.

Sugerencia:
- Sustituir por consulta directa al perfil por `email` normalizado en tabla indexada de dominio (o mantener un mapping id/email consultable sin escaneo completo).

### [MEDIUM] Deriva de contrato de roles entre documentacion y codigo
Categoria: Concept & Contract Drift  
Ubicacion:
- `docs/02_ROLES_Y_ALCANCE.md:3`
- `docs/02_ROLES_Y_ALCANCE.md:7`
- `web/src/modules/auth_users/domain/appRole.ts:1`

Descripcion:
`appRole` incluye `sub_manager`, pero el documento de roles base (`02_ROLES_Y_ALCANCE.md`) enumera solo 4 roles (sin `sub_manager`).

Impacto:
- Ambiguedad de reglas, onboarding mas lento y riesgo de aplicar permisos incompletos en nuevas features.

Sugerencia:
- Unificar fuente de verdad de roles y actualizar `02_ROLES_Y_ALCANCE.md` para reflejar exactamente el contrato vigente en codigo y SQL.

### [MEDIUM] Brecha entre MUST del spec y modulos implementados
Categoria: Migration Debt / Scope Drift  
Ubicacion:
- MUST definidos en `docs/06_SPEC_MAESTRO.md:29`
- MUST definidos en `docs/01_MODULOS.md:6`
- Placeholders en:
  - `web/src/modules/schedule/index.ts:1`
  - `web/src/modules/tasks/index.ts:1`
  - `web/src/modules/hours_reports/index.ts:1`
  - `web/src/modules/audit_log/index.ts:1`
  - `web/src/modules/requests/index.ts:1`
  - `web/src/modules/documents/index.ts:1`
  - `web/src/modules/incidents/index.ts:1`
  - `web/src/modules/notifications/index.ts:1`
  - `web/src/modules/announcements/index.ts:1`
  - `web/src/modules/policies/index.ts:1`

Descripcion:
Hay 10 modulos en estado placeholder (`export {}`), incluyendo varios que el spec marca MUST (schedule/tasks/hours/audit).

Impacto:
- Riesgo de sobreestimar avance MVP y de priorizar UI sin dominio backend suficiente.

Sugerencia:
- Publicar un mapa de avance por bloque (Bxx) y cerrar vertical slices MUST antes de ampliar UI superficial.

### [MEDIUM] Duplicacion de validaciones/reglas en server actions
Categoria: DRY  
Ubicacion:
- `web/src/app/employees/actions.ts:24`
- `web/src/app/employees/[id]/actions.ts:30`
- `web/src/app/me/actions.ts:9`
- `web/src/modules/area_leads/application/assignAreaLead.ts:5`
- `web/src/modules/area_leads/application/revokeAreaLead.ts:3`
- `web/src/shared/env.ts:1`
- `web/src/shared/env.server.ts:1`

Descripcion:
Hay funciones repetidas con misma semantica (`isValidEmail`, `isStrongPassword`, `parseRole`, `syncIsAreaLead`, `requireEnv`).

Impacto:
- Cambios futuros dispersos y riesgo de comportamiento divergente.

Sugerencia:
- Extraer validadores y utilidades compartidas por dominio (`modules/*/domain` o `shared/*`) y consolidar las rutas de uso.

### [LOW] Politica de proxy deja `/api` completo como publico por prefijo
Categoria: Security Posture / Consistency  
Ubicacion:
- `web/src/shared/supabase/proxy.ts:6`

Descripcion:
`PUBLIC_PATH_PREFIXES` incluye `/api`, por lo que cualquier ruta API futura no tendra gate de autenticacion por proxy (dependera 100% de cada handler).

Impacto:
- Facil introducir endpoints API sin proteccion por omision.

Sugerencia:
- Restringir prefijos publicos a rutas estrictamente anonimas (ej. `/api/auth/*`) o documentar y testear guard obligatorio por handler.

### [LOW] README principal de `web/` aun es plantilla generica
Categoria: Consistency / Documentation Hygiene  
Ubicacion:
- `web/README.md:1`

Descripcion:
No refleja arquitectura modular, reglas de permisos ni flujo de desarrollo real del repo.

Impacto:
- Onboarding mas lento, contexto parcial para contributors.

Sugerencia:
- Reemplazar por README de proyecto real (arquitectura, comandos, convenciones, modulos implementados, roadmap Bxx).

## 4) Estado de calidad tecnica actual
- Lint: OK (`npm run lint`)
- Build produccion: OK (`npm run build`)
- Tipado/compilacion: sin errores en estado actual

## 5) Estado funcional vs especificacion (alto nivel)

Implementado (parcial/real):
- Auth base + proteccion de rutas + logout.
- Perfil propio (email/password/avatar).
- Contexto multi-restaurante para `admin/office` con cookie `active_restaurant_id`.
- Gestion de empleados (listado/alta/edicion/estado) con guardas de rol y restaurante.

Pendiente o placeholder respecto a MUST:
- CSV import atomico.
- Schedule draft/publicado + locks + publish.
- Tasks integradas.
- Hours + reportes/export.
- Auditoria general y granular draft schedule.

## 6) Recomendacion de priorizacion (proximo bloque)
1. Cerrar consistencia Auth/Profile (hallazgo HIGH #1) antes de ampliar funcionalidades.
2. Implementar primer vertical MUST de negocio (Schedule o CSV) end-to-end con contratos y guards server-side.
3. Consolidar contrato de roles/documentacion y extraer validadores compartidos para reducir deuda de mantenimiento.

## 7) Conclusión
La base del proyecto es buena y compila limpia, pero aun esta en etapa de fundacion funcional. El mayor riesgo inmediato es la consistencia de datos en operaciones de usuarios; el mayor riesgo de roadmap es la distancia entre MUST definidos y modulos realmente implementados.

## 8) Acta de cierre
Fecha de cierre: 2026-02-12

Este reporte queda cerrado como linea base para iniciar la siguiente fase de ejecucion.

Acuerdos:
- Se acepta como estado base oficial del proyecto el diagnostico de este documento.
- Se reconoce que los hallazgos HIGH, MEDIUM y LOW quedan abiertos y priorizados segun el punto 3.
- No se abriran nuevos frentes funcionales antes de atender:
  - HIGH #1 (consistencia Auth/Profile).
  - Luego, el primer vertical MUST end-to-end.
- Este cierre no incluye cambios de codigo adicionales; solo formaliza priorizacion y criterio de arranque.

Definition of Done del cierre:
- Diagnostico revisado y confirmado.
- Prioridades y orden de ejecucion definidos.
- Alcance de inicio de fase siguiente establecido.
