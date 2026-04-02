# 03 — ACL Matrix Canónica
## Roles × Módulos × Acciones

---

## Fórmula de acceso

```
access = system_role + authority_scope_assignments + active_scope + condición_de_acceso + module_action_rule
```

- **system_role** → qué tipo de actor es la persona
- **authority_scope_assignments** → alcance real concedido por `RoleScopeAssignment`
- **active_scope** → contexto de sesión seleccionado dentro del alcance ya concedido
- **condición de acceso** → `self` (acceso sobre sí mismo) no es scope, es condición
- **module_action_rule** → qué puede hacer en cada módulo

---

## Roles canónicos y su scope requerido

| Rol | Scope requerido | Descripción |
|---|---|---|
| `admin` | Organization (mínimo) | Tenant admin. Máxima autoridad dentro del tenant. Puede enfocar sesión a `Chain`, `Company` o `Restaurant` |
| `owner` | Company / Chain / Organization | Autoridad de negocio y control final. No usa scope directo `Restaurant`; puede enfocar sesión a `Restaurant` derivado |
| `office` | Restaurant / Company / Chain / Organization | Gestión administrativa y operativa transversal con alcance variable según asignación |
| `manager` | Restaurant (1..N) | Liderazgo operativo de uno o varios restaurantes. `authority_tier` por restaurante |
| `area_lead` | Zone (exactamente 1 activa) | Liderazgo de sección física en restaurante. Restaurante operativo derivado |
| `employee` | Derivado de `EmploymentRestaurantAssignment` activo | Rol base de ejecución sin `RoleScopeAssignment` |

---

## People / Person

| Acción | `admin` | `owner` | `office` | `manager` | `area_lead` | `employee` |
|---|---|---|---|---|---|---|
| Crear persona | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Ver identidad completa | ✅ | ✅ scope | ✅ scope | Solo su restaurante | Visibilidad mínima | Solo la suya |
| Editar identidad | ✅ | ❌ | ✅ scope | ❌ | ❌ | Teléfono/email/avatar propios |
| Cambiar system_role | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Cambiar access_status | ✅ | ❌ | `pending→active`, `active↔suspended` | ❌ | ❌ | ❌ |
| Archivar persona | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Desarchivar persona | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Bloquear/desbloquear | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

---

## Employment

| Acción | `admin` | `owner` | `office` | `manager` | `area_lead` | `employee` |
|---|---|---|---|---|---|---|
| Crear EmploymentRelationship | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Ver vínculo laboral | ✅ | ✅ scope | ✅ scope | Solo su restaurante | ❌ | Solo el propio |
| Editar vínculo laboral | ✅ | ❌ | ✅ scope | ❌ | ❌ | ❌ |
| Terminar vínculo laboral | ✅ | ❌ | ✅ scope | ❌ | ❌ | ❌ |
| Asignar restaurante operativo | ✅ | ❌ | ✅ scope | ❌ | ❌ | ❌ |
| Programar cambio de restaurante | ✅ | ❌ | ✅ scope | ❌ | ❌ | ❌ |
| Asignar zona operativa (`area_lead`) | ✅ | ❌ | ✅ scope | ❌ | ❌ | ❌ |

---

## Structure (Company / Restaurant / Zone)

| Acción | `admin` | `owner` | `office` | `manager` | `area_lead` | `employee` |
|---|---|---|---|---|---|---|
| Crear Company | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Archivar Company | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Crear Restaurant | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Archivar Restaurant | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Crear Zone | ✅ | ❌ | ✅ | ✅ su restaurante | ❌ | ❌ |
| Archivar Zone | ✅ | ❌ | ✅ | ✅ su restaurante | ❌ | ❌ |
| Crear Chain | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Archivar Chain | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

---

## Scheduling

| Acción | `admin` | `owner` | `office` | `manager` | `area_lead` | `employee` |
|---|---|---|---|---|---|---|
| Ver draft | ✅ | ✅ scope | Supervisión opcional | ✅ su restaurante | Solo su zona | ❌ |
| Crear draft | ✅ | ❌ | ❌ | ✅ su restaurante | ❌ | ❌ |
| Editar draft | ✅ | ❌ | ❌ | ✅ su restaurante | Solo su zona | ❌ |
| Publicar schedule | ✅ | ❌ | ❌ | ✅ su restaurante | ❌ | ❌ |
| Ver schedule publicado | ✅ | ✅ scope | Supervisión opcional | ✅ su restaurante | Su zona | Solo el propio |
| Forzar lock | ✅ | ❌ | ❌ | ✅ sobre area_lead | ❌ | ❌ |
| Crear ShiftTemplate | ✅ | ❌ | ✅ | ✅ su restaurante | ❌ | ❌ |
| Archivar ShiftTemplate | ✅ | ❌ | ✅ | ✅ su restaurante | ❌ | ❌ |
| Copiar semana anterior | ✅ | ❌ | ❌ | ✅ su restaurante | ❌ | ❌ |

---

## Requests (solicitudes laborales)

| Acción | `admin` | `owner` | `office` | `manager` | `area_lead` | `employee` |
|---|---|---|---|---|---|---|
| Crear solicitud propia | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Crear solicitud para otro | ✅ | ❌ | ✅ | ✅ su restaurante | ❌ | ❌ |
| Aprobar `vacation` / `sick_leave` | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Aprobar `justified_absence` / `absence` | ✅ | ❌ | ✅ | ✅ su restaurante | ❌ | ❌ |
| Rechazar cualquier tipo | ✅ | ❌ | ✅ | ✅ operativas | ❌ | ❌ |
| Cancelar propia | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ si estado lo permite |
| Ver solicitudes de otros | ✅ | ✅ scope | ✅ | Su restaurante | ❌ | ❌ |

**Invariante global:** nadie puede autoaprobar su propia solicitud.

---

## ShiftSwap

| Acción | `admin` | `owner` | `office` | `manager` | `area_lead` | `employee` |
|---|---|---|---|---|---|---|
| Proponer swap | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Aceptar/rechazar swap recibido | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Aprobar swap (paso final) | ✅ | ❌ | ❌ | ✅ su restaurante | ❌ | ❌ |
| Ver swaps del restaurante | ✅ | ✅ scope | Supervisión | ✅ su restaurante | ❌ | Solo los propios |

---

## Tasks

| Acción | `admin` | `owner` | `office` | `manager` | `area_lead` | `employee` |
|---|---|---|---|---|---|---|
| Ver tareas del restaurante | ✅ | ✅ scope | ✅ | ✅ su restaurante | Su zona / asignadas | Solo las propias / asignadas |
| Crear `TaskTemplate` | ✅ | ❌ | ✅ | ✅ su restaurante | ❌ | ❌ |
| Editar / archivar `TaskTemplate` | ✅ | ❌ | ✅ | ✅ su restaurante | ❌ | ❌ |
| Crear `TaskInstance` | ✅ | ❌ | ✅ | ✅ su restaurante | ❌ | ❌ |
| Reasignar / cancelar `TaskInstance` | ✅ | ❌ | ✅ | ✅ su restaurante | ❌ | ❌ |
| Completar `TaskInstance` | ✅ | ❌ | ✅ | ✅ su restaurante | Las asignadas a su zona / rol / persona | Las asignadas a su rol / persona |
| Confirmar `TaskInstance` | ✅ | ❌ | ✅ | ✅ su restaurante | ❌ | ❌ |

---

## Incidents

| Acción | `admin` | `owner` | `office` | `manager` | `area_lead` | `employee` |
|---|---|---|---|---|---|---|
| Crear incidente | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Ver incidente `normal` | ✅ | ✅ scope | ✅ | Su restaurante | Su zona | Solo los propios |
| Ver incidente `restricted` | ✅ | ✅ scope | ✅ | ✅ su restaurante | ❌ | Solo si es el creador (detalle limitado) |
| Tomar en revisión | ✅ | ❌ | ✅ categorías office | ✅ categorías manager | ❌ | ❌ |
| Marcar como resuelto | ✅ | ❌ | ✅ | ✅ su restaurante | ❌ | ❌ |
| Cerrar formalmente | ✅ | ❌ | ✅ | ✅ su restaurante | ❌ | ❌ |

---

## DeliveryNotes (Albaranes)

| Acción | `admin` | `owner` | `office` | `manager` | `area_lead` | `employee` |
|---|---|---|---|---|---|---|
| Subir albarán | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ |
| Confirmar datos extraídos por OCR | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ |
| Validar y cerrar como office | ✅ | ❌ | ✅ (≠ quien subió) | ❌ | ❌ | ❌ |
| Ver albaranes del restaurante | ✅ | ✅ scope | ✅ | ✅ su restaurante | ❌ | ❌ |

---

## Documents

| Acción | `admin` | `owner` | `office` | `manager` | `area_lead` | `employee` |
|---|---|---|---|---|---|---|
| Subir documento | ✅ | ❌ | ✅ | Operativos scope | ❌ | Propios permitidos |
| Ver documento | ✅ | Estratégicos scope | ✅ scope | Operativos scope + propios | Propios | Propios visibles |
| Descargar | ✅ | Según política | ✅ | Según política | Según política | Según política |
| Archivar | ✅ | ❌ | ✅ | ❌ por defecto | ❌ | ❌ |

---

## AuditLog

| Acción | `admin` | `owner` | `office` | `manager` | `area_lead` | `employee` |
|---|---|---|---|---|---|---|
| Ver audit log completo | ✅ | ❌ | ✅ scope | Solo su restaurante | ❌ | ❌ |
| Exportar audit log | ✅ | ❌ | ✅ scope | ❌ | ❌ | ❌ |

---

## Notas de implementación

1. **scope** en las celdas significa que el acceso está limitado por los `RoleScopeAssignment` vigentes del actor y, si existe, por el `active_scope` de sesión
2. **active_scope** nunca concede autoridad nueva; solo enfoca la operación dentro del árbol ya autorizado
3. El acceso por scope es jerárquico y siempre incluye los descendientes estructurales del subárbol autorizado
4. **su restaurante** significa que el acceso operativo del actor está acotado al restaurante activo de sesión o a su asignación operativa vigente
5. `employee` no usa `RoleScopeAssignment`; su acceso sale de `EmploymentRestaurantAssignment`
6. Toda acción privilegiada queda registrada en `AuditLog`
7. La lógica de acceso vive en el backend — el frontend puede mostrar/ocultar UI pero nunca decide permisos
