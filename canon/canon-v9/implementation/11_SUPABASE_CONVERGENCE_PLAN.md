# 11 — Plan de Convergencia Supabase
## Base real → schema canónico reproducible

---

## Objetivo

Recuperar un estado en el que:
- el canon vuelva a ser la única verdad funcional
- `supabase/migrations` vuelva a ser la única verdad ejecutable
- la base real pueda reconstruirse desde repo sin depender de cambios manuales no versionados

---

## Diagnóstico verificado a 1 de abril de 2026

- La base real tiene muchas más migraciones aplicadas que el repo local.
- El repo local no reproduce hoy el schema real de Supabase.
- El núcleo `EmploymentRelationship / EmploymentRestaurantAssignment / EmploymentZoneAssignment / RoleScopeAssignment` sigue mezclando modelo viejo y modelo canon-v9.
- La RLS y varias funciones helper siguen apoyándose en `employment_relationships.restaurant_id` y `restaurants.chain_id`.
- Existen tablas nuevas del canon (`employment_restaurant_assignments`, `employment_zone_assignments`), pero no gobiernan todavía la operación real.
- Los datos actuales son de prueba, por lo que la convergencia debe priorizar limpieza y reproducibilidad por encima de compatibilidad histórica.

---

## Principios de ejecución

- El canon manda; la base real se corrige hacia el canon, no al revés.
- Ningún cambio en Supabase debe quedar solo en remoto; todo cambio debe existir primero o inmediatamente en `supabase/migrations`.
- Mientras exista drift fuerte, no se construye backend nuevo sobre tablas o policies ambiguas.
- Dado que los datos actuales son descartables, se prefiere reconstrucción controlada sobre arrastrar legacy innecesario.

---

## Estrategia recomendada

### 1. Recuperar autoridad del repo

- Congelar cambios manuales adicionales en la base principal hasta que queden reflejados en repo.
- Tratar el estado vivo actual como input de auditoría, no como target final.
- Decidir explícitamente entre:
  - reconstrucción limpia desde cero
  - o recreación completa del historial de migraciones faltantes

**Criterio:** con datos de prueba y drift alto, la ruta preferida es reconstrucción limpia desde canon.

### 2. Rehacer el núcleo identitario y laboral

- `employment_relationships` debe quedar anclada a `company`, sin `restaurant_id`.
- La vigencia de negocio debe quedar en `valid_from` + `valid_to` inclusivos.
- `valid_during` debe existir como rango técnico derivado para exclusiones, solapamientos y consultas temporales.
- Deben desaparecer booleanos de vigencia (`active`, `is_active`) como fuente de verdad.
- `employment_restaurant_assignments` debe ser la fuente de verdad operativa para `employee`, `manager` y `area_lead`.
- `employment_zone_assignments` debe ser la fuente de verdad operativa de `area_lead` a nivel de `zone`.
- `role_scope_assignments` debe soportar vigencia temporal y no aplicar a `employee`.

### 3. Rehacer la jerarquía estructural

- `organization` sigue siendo el boundary superior.
- `chain` agrupa `company`.
- `restaurant` pertenece a `company`.
- `restaurants.chain_id` debe desaparecer del schema persistente; la cadena efectiva del restaurante se deriva desde `companies.chain_id`.

### 4. Reescribir funciones helper y RLS

- Ninguna policy debe depender de `employment_relationships.restaurant_id`.
- El acceso jerárquico debe resolverse por subárbol: `organization > chain > company > restaurant > zone`.
- `active_scope` debe seguir siendo contexto de sesión, no autoridad persistida.
- `owner` y `office` deben poder descender por jerarquía sin requerir duplicación de scopes redundantes.
- `employee` debe quedar fuera de `role_scope_assignments`.

### 5. Limpiar naming e invariantes legacy

- El schema final no debe conservar `sub_manager`, `chain_owner` ni columnas legacy equivalentes.
- Deben existir restricciones reales para:
  - empleo activo máximo por persona
  - coherencia `company` ↔ `restaurant`
  - unicidad operativa de `employee` y `area_lead`
  - unicidad de `zone` activa en `area_lead`
  - no redundancia de scopes por subárbol

### 6. Sembrar datos mínimos y validar

- Crear seed mínimo y pequeño para desarrollo.
- Validar RLS, funciones helper, constraints e índices con ese seed.
- Solo después abrir backend de casos de uso.

---

## Orden de ejecución

1. Cerrar canon y decisiones temporales/estructurales.
2. Definir el baseline SQL canónico en repo.
3. Reescribir funciones helper y RLS sobre ese baseline.
4. Ejecutar reconstrucción controlada en entorno reseteable.
5. Validar invariantes.
6. Empezar backend.
7. Ajustar frontend segun `12_FRONTEND_BLUEPRINT.md`.

## Estado actual del repo

- `017`, `018` y `019` describen el baseline canónico por bloques lógicos:
  - core identidad/empleo/scope
  - horarios/requests
  - tasks/swaps/incidents
- `020` aplica limpieza post-convergencia de bajo riesgo:
  - índices FK faltantes
  - consolidación de policies duplicadas
  - eliminación de índices y policies redundantes
- `021` elimina el remanente `admin_all` legacy en tablas núcleo donde ya existían políticas equivalentes explícitas.
- `022` completa la convergencia estructural y de procurement:
  - RLS canónica para `chains`, `companies`, `suppliers`, `products`, `supplier_product_aliases`, `delivery_notes` y `delivery_note_lines`
  - helpers jerárquicos genéricos por `scope`
  - eliminación del remanente `admin_all` en esos módulos
- `023` consolida el último `UPDATE` duplicado de `delivery_notes` en una policy única para cerrar el warning de `multiple_permissive_policies`.
- La base principal ya convergió aplicando `017` → `018` → `019` directamente.
- La propuesta `020_canon_v9_live_convergence` quedó supersedida por esa ejecución real y no forma parte del baseline reproducible del repo.
- `017` → `023` son ahora la ruta canónica de reconstrucción y cleanup del schema.

---

## Gates de salida de convergencia

- El repo puede levantar el schema completo sin depender de SQL manual externo.
- La base resultante no contiene `restaurant_id` en `employment_relationships`.
- La base resultante no contiene `restaurants.chain_id`.
- `role_scope_assignments` no usa booleano `active` como verdad de vigencia.
- Las entidades temporales usan `valid_from` / `valid_to` inclusivos y `valid_during` derivado.
- Las consultas de invariantes críticas devuelven cero violaciones.
- El backend ya puede programarse contra un schema estable.

---

## Siguiente paso inmediato

Congelar este baseline, activar en panel lo único que no resuelve SQL (`Leaked Password Protection`) y empezar el backend sobre el schema ya convergido.
