# Canon de Negocio La Sentadita

Fecha de consolidacion: 2026-03-07
Estado: canon operativo propuesto para alinear producto, codigo y base de datos

## 1. Que es este producto

La Sentadita Hub es una PWA interna para una sola cadena de restaurantes.
No es un SaaS multiempresa.
No es una app para un solo local.

Modelo correcto:
- tenant unico: La Sentadita
- multi-restaurante: si
- multi-sucursal desde dia 1: si

En este sistema, `restaurants` significa `sucursales` de La Sentadita.

## 2. Objetivo real del producto

El producto debe ser muy bueno resolviendo la operacion diaria de la cadena:
- gestion de personal por sucursal
- horarios semanales
- publicacion y comunicacion de cambios
- tareas y horas
- tramites y documentos operativos

El centro del sistema es la operacion semanal de cada sucursal.
El modulo de horarios es el nucleo operativo.

## 3. Roles canonicos

Roles canonicos de autenticacion:
- `employee`
- `sub_manager`
- `manager`
- `office`
- `admin`

Capacidad adicional, no rol:
- `area_lead`

`area_lead` no sustituye el rol del usuario.
Un `area_lead` sigue siendo un `employee` con capacidad operativa adicional.

Precedencia canonica:
- `admin > office > manager > sub_manager > area_lead > employee`

## 4. Alcance por sucursal

Regla canonica:
- `employee`, `area_lead`, `sub_manager` y `manager` trabajan siempre dentro de una sola sucursal activa.
- `office` y `admin` son globales a nivel cadena y operan con selector de sucursal.

Corolarios obligatorios:
- no existe `manager` global
- no existe `sub_manager` global
- no existe selector de sucursal para `employee`, `area_lead`, `sub_manager` o `manager`

## 5. Regla canonica sobre horarios

Esta regla queda cerrada:
- `office` no ve ni gestiona horarios
- `office` solo ve horas agregadas, nunca turnos ni rangos

Permisos canonicos del modulo de horarios:
- `employee`: solo ve publicado de su sucursal
- `area_lead`: ve publicado de su sucursal y puede editar draft solo dentro de su area operativa cuando exista el modelo correcto de locks por area
- `sub_manager`: ve y edita draft completo de su sucursal
- `manager`: ve y edita draft completo de su sucursal y puede publicar
- `admin`: ve todo, puede editar y puede publicar
- `office`: sin acceso a horarios

Decision canonica de publicacion:
- publica `manager`
- `admin` puede publicar como override operativo
- `sub_manager` no publica
- `office` no publica

## 6. Draft y publicado

Semantica canonica:
- existe un solo draft compartido por semana y sucursal
- el publicado es la version visible para los empleados
- cada republicacion genera evento de publicacion y trazabilidad de cambios

Para MVP, el sistema debe comportarse como "snapshot publicado" a nivel de negocio.
La implementacion tecnica puede resolverse con eventos y auditoria inmutable mientras no exista una tabla de snapshots fisicos separada.

## 7. Estados del dia en horario

Estados manuales editables:
- `work`
- `rest`
- `absent`

Estados automaticos, no editables manualmente:
- `vacation`
- `sick_leave`
- `not_applicable`
- `end_of_contract`

Regla:
- si una celda tiene `source = auto`, es de solo lectura en Horarios
- la correccion se hace en el modulo origen

## 8. Empleados y asignacion a sucursal

Regla de negocio canonica:
- un empleado pertenece a la cadena, no a una sucursal para siempre
- puede ser transferido entre sucursales
- el sistema debe conservar el historial de asignaciones

Fuente de verdad canonica:
- `employee_restaurant_assignments` es la fuente de verdad de asignacion

Uso de `profiles.restaurant_id`:
- `profiles.restaurant_id` se permite como puntero a la asignacion actual
- no es la fuente de verdad historica
- debe mantenerse sincronizado con la asignacion activa

Consecuencia:
- autorizacion y UI pueden leer `profiles.restaurant_id` como acceso rapido
- reglas historicas y validaciones por fecha deben apoyarse en `employee_restaurant_assignments`

## 9. Area operativa vs zona de trabajo

Se cierran dos conceptos distintos:

### 9.1 Area operativa canonica
Taxonomia fija de cadena:
- `kitchen`
- `floor`
- `bar`

Esto se usa para:
- permisos de `area_lead`
- reglas operativas comunes
- agregados y filtros de alto nivel

### 9.2 Zona de trabajo de sucursal
`restaurant_zones` representa zonas configurables de cada sucursal.
Cada zona debe pertenecer a una `area_operativa`.

Ejemplos validos:
- zona "Terraza" -> area `floor`
- zona "Barra principal" -> area `bar`
- zona "Frio" -> area `kitchen`

Conclusion canonica:
- `area_operativa` y `restaurant_zone` no son lo mismo
- el sistema debe dejar de usar la palabra "zona" para referirse a ambos conceptos sin distincion

## 10. Regla canonica de area lead

`area_lead` es una capacidad asignada por sucursal y por area operativa.

Fuente de verdad canonica:
- `area_leads` es la fuente de verdad

Uso de `profiles.is_area_lead`:
- `profiles.is_area_lead` es solo bandera derivada o cache
- no debe ser la fuente principal de negocio

Consecuencia:
- alta/edicion de empleados no debe "inventar" un encargado solo escribiendo `is_area_lead = true`
- una asignacion valida de encargado debe crear o activar un registro en `area_leads`
- una revocacion valida debe cerrar o desactivar ese registro

## 11. Zona por defecto del empleado

`profiles.zone_id` puede existir como zona por defecto o referencia operativa actual.
No debe usarse como sustituto de:
- la asignacion historica a sucursal
- la capacidad de `area_lead`
- la zona real de cada celda del horario

La zona real de trabajo del dia vive en la entrada de horario.

## 12. Modelo canonico de autorizacion

Reglas cerradas:
- toda autorizacion real se aplica server-side
- la UI solo refleja permisos, no los define
- la base de datos debe reforzar el alcance con RLS o funciones seguras donde aplique

Reglas concretas:
- si rol in (`employee`, `sub_manager`, `manager`) -> acceso limitado a su sucursal activa
- si capacidad `area_lead` -> acceso limitado a su sucursal activa y a su area operativa cuando el recurso sea draft editable por area
- si rol in (`office`, `admin`) -> acceso global
- excepcion: `office` queda fuera de cualquier endpoint o pantalla de horarios

## 13. Lo que este proyecto NO es

Queda fuera del canon:
- multiempresa
- marketplace de restaurantes
- manager global
- oficina con acceso a horarios
- booleanos sueltos como fuente de verdad para capacidades operativas complejas

## 14. Consecuencias tecnicas inmediatas

Este canon implica los siguientes ajustes en el repo:

1. Bloquear `office` en todas las rutas y acciones de horarios.
2. Mantener `manager/admin` como unicos publicadores.
3. Tratar `employee_restaurant_assignments` como modelo canonico de asignacion, dejando `profiles.restaurant_id` como puntero actual sincronizado.
4. Separar formalmente `area_operativa` de `restaurant_zone`.
5. Hacer que `area_leads` sea la fuente de verdad y `profiles.is_area_lead` un derivado.
6. Alinear documentacion, esquema y codigo con estas decisiones antes de ampliar modulos.

## 15. Regla de uso de este documento

Si este documento contradice a otros documentos anteriores, este documento prevalece hasta consolidar el resto.

Documentos que necesitan consolidacion posterior:
- `02_ROLES_Y_ALCANCE.md`
- `03_DATOS_MINIMOS.md`
- `05_REGLAS_NO_NEGOCIABLES.md`
- `06_SPEC_MAESTRO.md`
- `08_PERMISOS_MATRIZ.md`
- `11_UI_MVP_PANTALLAS.md`
- `docs/modulos/intencion_modulo_horarios (2).md`
