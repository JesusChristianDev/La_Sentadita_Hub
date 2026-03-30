# 01 — Source of Truth

## Artefactos oficiales del proyecto

La fuente de verdad de La Sentadita Hub se compone de tres bloques:

### A. Freeze documental del dominio
Ruta:
`docs/la-sentadita-docs-v1-freeze/`

Contiene:
- visión del sistema
- modelo de dominio (v4: person.system_role como fuente única del rol)
- glosario
- roles, scopes y ACL
- people / employment (v4: sin system_role en employment_relationship)
- scheduling
- tasks
- procedures
- incidents
- documents
- notifications
- audit
- invariantes
- blueprint de datos (v4: alineado con model corregido)
- guía para IA

### B. SQL base del sistema
Ruta:
`sql/la-sentadita-sql-v1/`

Contiene:
- schema base v4 (person.system_role, sin system_role en employment_relationships ni role_scope_assignments)
- triggers y funciones
- RLS inicial
- seed de referencia
- notas y límites

### C. Blueprint backend
Ruta:
`backend/la_sentadita_backend_blueprint_v1.pdf`

## Prioridad entre artefactos

### Si hay conflicto aparente
1. prevalecen los **invariantes y reglas del freeze documental**
2. luego el **SQL base**
3. luego el **blueprint backend**
4. luego cualquier resumen o guía auxiliar

## Regla de oro
Las guías auxiliares sirven para orientar.
Los documentos fuente sirven para decidir e implementar.

## Qué hacer cuando falte una decisión
Si una decisión no está congelada:
- marcarla como `OPEN QUESTION`
- no inventarla
- no asumirla por conveniencia técnica
