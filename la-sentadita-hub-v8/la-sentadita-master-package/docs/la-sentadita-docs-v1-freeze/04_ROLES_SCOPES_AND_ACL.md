# 04 — Roles, Scopes and ACL

## Roles oficiales
- `employee`
- `area_lead`
- `sub_manager`
- `manager`
- `office`
- `chain_owner`
- `admin`

## Reglas de roles
### Single active role rule v1
Cada persona tiene un único `system_role` activo.

### Multi-scope rule v1
Scopes múltiples permitidos por defecto para:
- `office`
- `chain_owner`
- `admin`

### Manager scope rule v1
En v1, `manager` tiene scope único. Se reserva una excepción futura controlada para múltiples scopes.

### Operational roles scope rule v1
En v1:
- `employee`
- `area_lead`
- `sub_manager`
tienen scope único.

## Scopes
- `platform`
- `chain`
- `company`
- `restaurant`
- `zone`

## Fórmula de acceso
`access = system_role + scope + module_action_rule`

## Resumen ACL por módulo

### People / Person
| Rol | Crear persona | Ver identidad | Editar identidad | Archivar |
|---|---:|---:|---:|---:|
| employee | No | Solo la suya | Teléfono/email/avatar propios | No |
| area_lead | No | Visibilidad mínima operativa | No | No |
| sub_manager | No | Empleados de su restaurante | No | No |
| manager | No | Empleados de su restaurante | No | No |
| office | Sí | Sí | Sí | Sí |
| chain_owner | No por defecto | Sí según scope | No por defecto | No |
| admin | Sí | Sí | Sí | Sí |

### Scheduling
| Rol | Ver draft | Editar draft | Publicar | Ver publicado | Forzar lock |
|---|---:|---:|---:|---:|---:|
| employee | No | No | No | Solo el suyo | No |
| area_lead | Su zona | Su zona | No | Scope operativo | No |
| sub_manager | Restaurante | Restaurante | Sí | Restaurante | Sí sobre area_lead |
| manager | Restaurante | Restaurante | Sí | Restaurante | Sí sobre sub_manager y area_lead |
| office | No por defecto | No | No | Supervisión opcional | No |
| chain_owner | No | No | No | Sí según scope | No |
| admin | Sí | Sí | Sí | Sí | Sí |

### Procedures
| Rol | Crear propio | Crear para otro | Aprobar/Rechazar | Cancelar | Cerrar | Derivar |
|---|---:|---:|---:|---:|---:|---:|
| employee | Sí | No | No | Propios si tipo/estado lo permite | No | No |
| area_lead | No por defecto | No | No | No | No | No |
| sub_manager | Sí | Sí en restaurante | Sí | Sí según tipo | Sí según tipo/política | Sí para absence |
| manager | Sí | Sí en restaurante | Sí | Sí según tipo | Sí según tipo/política | Sí para absence |
| office | Sí | Sí | Sí | Sí | Sí | Sí |
| chain_owner | No por defecto | No | No | No | No | No |
| admin | Sí | Sí | Sí | Sí | Sí | Sí |

### Documents
| Rol | Subir | Ver | Descargar | Archivar | Supersede |
|---|---:|---:|---:|---:|---:|
| employee | Propios permitidos | Propios visibles | Según política | No | No |
| area_lead | No por defecto | Propios | Según política | No | No |
| sub_manager | Operativos según scope | Operativos según scope + propios | Según política | No por defecto | No por defecto |
| manager | Operativos según scope | Operativos según scope + propios | Según política | No por defecto | No por defecto |
| office | Sí | Sí según scope/visibility | Sí | Sí | Sí |
| chain_owner | No por defecto | Estratégicos según scope + propios | Según política | No | No |
| admin | Sí | Sí | Sí | Sí | Sí |
