# La Sentadita Hub — Master Package v8

## Qué es este paquete
Paquete maestro consolidado. Versión v8: arquitectura v7 + estructura del repo
+ decisiones de UI/UX. Base oficial completa para implementación.

## Estructura

```text
la-sentadita-master-package/
  00_README_START_HERE.md
  01_SOURCE_OF_TRUTH.md
  docs/
    la-sentadita-docs-v1-freeze/   ← dominio, ACL, invariantes
    PROJECT_STRUCTURE_v1.md        ← estructura del repo ← NUEVO en v8
  sql/
    la-sentadita-sql-v1/           ← schema v7 completo
  backend/
    la_sentadita_backend_blueprint_v1.pdf
  guide/
```

## Tres bloques de verdad

### 1. Arquitectura y dominio
`docs/la-sentadita-docs-v1-freeze/` — qué construir y sus reglas

### 2. Estructura del repo
`docs/PROJECT_STRUCTURE_v1.md` — dónde va cada cosa y cómo

### 3. Base de datos
`sql/la-sentadita-sql-v1/01_schema.sql` — schema v7 completo y endurecido

## Stack UI decidido en v8
- shadcn/ui (tema amber dark/light)
- Recharts (gráficos)
- @tanstack/react-table (tablas)
- Horario semanal: componente custom CSS Grid
- lucide-react (iconos)

## Servicios migrados del repo anterior
Ver `docs/PROJECT_STRUCTURE_v1.md` sección "Archivos migrados"

## Estado
**Core Architecture Freeze v8 — LISTO PARA IMPLEMENTAR**
