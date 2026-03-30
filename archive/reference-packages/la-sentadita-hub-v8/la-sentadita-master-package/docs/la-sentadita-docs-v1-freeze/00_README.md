# La Sentadita Hub — Documentation Pack (v1 Freeze)

## Objetivo del paquete
Este paquete sirve para dos usos:

1. **Fuente de verdad del producto y dominio** para el equipo humano.
2. **Contexto estructurado para un asistente IA de programación** que deba implementar el sistema sin inventar reglas.

## Formatos elegidos
- **Markdown (`.md`)** → mejor formato para especificación funcional, lectura humana, versionado en repo y consumo por IA.
- **YAML (`.yaml`)** → mejor formato para contexto estructurado y reglas compactas para asistentes IA.
- **JSON (`.json`)** → índice y metadatos del paquete.
- **ZIP (`.zip`)** → distribución completa descargable.

## Orden recomendado de lectura
1. `01_SYSTEM_OVERVIEW.md`
2. `02_DOMAIN_MODEL.md`
3. `03_GLOSSARY.md`
4. `04_ROLES_SCOPES_AND_ACL.md`
5. Módulos (`05` a `11`)
6. `12_AUDIT_AND_INVARIANTS.md`
7. `13_DATA_MODEL_BLUEPRINT.md`
8. `14_AI_IMPLEMENTATION_GUIDE.md`
9. `15_OPEN_QUESTIONS_AND_FUTURE.md`

## Uso recomendado con un asistente IA
Cuando pidas implementación de un módulo, adjunta como mínimo:
- `02_DOMAIN_MODEL.md`
- el documento del módulo correspondiente
- `04_ROLES_SCOPES_AND_ACL.md`
- `12_AUDIT_AND_INVARIANTS.md`
- `13_DATA_MODEL_BLUEPRINT.md`

## Estado del proyecto
**Core Architecture Freeze v1**
