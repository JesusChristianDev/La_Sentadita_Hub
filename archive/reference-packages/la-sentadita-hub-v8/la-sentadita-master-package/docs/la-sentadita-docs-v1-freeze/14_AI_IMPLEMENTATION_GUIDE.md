# 14 — AI Implementation Guide

## Reglas para la IA
1. No inventar reglas fuera de esta documentación.
2. Si una decisión no está congelada, tratarla como `OPEN QUESTION`.
3. Separar siempre:
   - `system_role`
   - `job_title`
   - `scope`
4. Tratar Scheduling, Tasks y Procedures como módulos conectados.
5. Preservar histórico; no reescribir pasado silenciosamente.
6. Respetar los invariantes congelados.
7. Usar nombres consistentes con este pack.

## Prompt base recomendado
```text
Lee y usa como fuente de verdad:

- 02_DOMAIN_MODEL.md
- 04_ROLES_SCOPES_AND_ACL.md
- 05_PEOPLE_EMPLOYMENT.md
- 06_SCHEDULING.md
- 07_TASKS.md
- 08_PROCEDURES_AND_SHIFT_SWAP.md
- 09_INCIDENTS.md
- 10_DOCUMENTS_AND_SECURITY.md
- 12_AUDIT_AND_INVARIANTS.md
- 13_DATA_MODEL_BLUEPRINT.md

Implementa únicamente lo que esté congelado en esos documentos.
Si detectas una decisión no cerrada, devuélvela como OPEN QUESTION y no la inventes.
```
