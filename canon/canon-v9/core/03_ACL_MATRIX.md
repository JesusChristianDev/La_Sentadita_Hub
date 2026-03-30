# 03 — ACL Matrix Canónica
## Roles × Módulos × Acciones

---

## Fórmula de acceso

```
access = system_role + scope_activo + condición_de_acceso + module_action_rule
```

- **system_role** → qué tipo de actor es la persona
- **scope_activo** → sobre qué parte del tenant puede actuar
- **condición de acceso** → `self` (acceso sobre sí mismo) no es scope, es condición
- **module_action_rule** → qué puede hacer en cada módulo

---

## Roles canónicos y su scope requerido

| Rol | Scope requerido | Descripción |
|---|---|---|
| `admin` | Organization (mínimo) | Tenant admin. Máxima autoridad dentro del tenant |
| `owner` | Company / Chain / Organization | Autoridad de negocio y control final |
| `office` | Company / Organization | Gestión administrativa y operativa transversal |
| `manager` | Restaurant (obligatorio) | Liderazgo operativo de un restaurante |
| `area_lead` | Zone (obligatorio) | Liderazgo de sección física en restaurante |
| `employee` | Derivado de EmploymentRelationship | Rol base de ejecución |

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

1. **scope** en las celdas significa que el acceso está limitado al scope activo del actor en `RoleScopeAssignment`
2. **su restaurante** significa que el `manager` solo accede a datos del restaurante donde tiene scope activo
3. Toda acción privilegiada queda registrada en `AuditLog`
4. La lógica de acceso vive en el backend — el frontend puede mostrar/ocultar UI pero nunca decide permisos
