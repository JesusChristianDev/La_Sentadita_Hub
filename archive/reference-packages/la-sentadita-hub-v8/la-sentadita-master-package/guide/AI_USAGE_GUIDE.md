# AI Usage Guide

## Cómo usar este paquete con un asistente IA

## Objetivo
Hacer que la IA implemente código alineado con el sistema real y no con suposiciones.

## Contexto mínimo que debes darle
Siempre incluye:

1. `docs/la-sentadita-docs-v1-freeze/02_DOMAIN_MODEL.md`
2. `docs/la-sentadita-docs-v1-freeze/04_ROLES_SCOPES_AND_ACL.md`
3. `docs/la-sentadita-docs-v1-freeze/12_AUDIT_AND_INVARIANTS.md`
4. `docs/la-sentadita-docs-v1-freeze/13_DATA_MODEL_BLUEPRINT.md`
5. `backend/la_sentadita_backend_blueprint_v1.pdf`

Y además:
- el documento del módulo que vayas a implementar

## Prompt base recomendado
```text
Usa este paquete como fuente de verdad.
No inventes reglas fuera de los documentos.
Si detectas una decisión no cerrada, devuélvela como OPEN QUESTION.

Lee primero:
- 02_DOMAIN_MODEL.md
- 04_ROLES_SCOPES_AND_ACL.md
- 12_AUDIT_AND_INVARIANTS.md
- 13_DATA_MODEL_BLUEPRINT.md
- backend blueprint

Luego implementa solo el módulo pedido.
```

## Para SQL / migrations
Añade también:
- `sql/la-sentadita-sql-v1/01_schema.sql`
- `sql/la-sentadita-sql-v1/02_triggers_and_functions.sql`
- `sql/la-sentadita-sql-v1/03_rls_policies.sql`

## Para frontend
Añade:
- módulo funcional correspondiente
- ACL
- invariantes
- backend blueprint

## Regla importante
No uses resúmenes ligeros como si fueran la especificación completa.
