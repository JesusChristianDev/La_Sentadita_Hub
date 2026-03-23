# La Sentadita Hub — SQL Package v1

Base SQL para PostgreSQL / Supabase alineada con la documentación congelada del sistema.

## Contenido
- `00_README.md` → guía de uso
- `01_schema.sql` → enums, tablas, constraints, índices base
- `02_triggers_and_functions.sql` → helpers, updated_at, audit helpers
- `03_rls_policies.sql` → políticas RLS iniciales para Supabase
- `04_seed_reference.sql` → datos base opcionales de referencia
- `05_notes_and_limits.md` → límites conocidos y decisiones futuras

## Orden recomendado de ejecución
1. `01_schema.sql`
2. `02_triggers_and_functions.sql`
3. `03_rls_policies.sql`
4. `04_seed_reference.sql`

## Notas
- Está diseñado como **base sólida v1**, no como versión final cerrada de producción.
- Las políticas RLS dependen de que tu app inyecte claims/contexto en JWT o en funciones helper.
- Algunas decisiones futuras (por ejemplo manager multi-scope estándar, integración Agora POS) quedan fuera de este paquete.
