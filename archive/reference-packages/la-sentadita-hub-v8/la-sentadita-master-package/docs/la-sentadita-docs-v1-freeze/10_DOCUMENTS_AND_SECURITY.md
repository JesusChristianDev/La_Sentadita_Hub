# 10 — Documents and Security

## Lifecycle
Un documento es un archivo estructurado con:
- tipo
- owner
- visibilidad
- estado
- versión

## Tipos v1
- `employment_contract`
- `contract_addendum`
- `payroll`
- `identity_document`
- `medical_certificate`
- `absence_justification`
- `policy_document`
- `internal_report`

## Owner Types
- `person`
- `employment_relationship`
- `procedure`
- `restaurant`

## Visibility
- `employee_visible`
- `management_visible`
- `restricted_management`
- `administrative_only`

## Estados
- `active`
- `superseded`
- `archived`

## Invariantes
### I17
Cada usuario puede ver siempre sus propios documentos, salvo documentos internos no destinados a él.

### No sobrescritura
Los documentos no se sobrescriben.

### No borrado físico en v1
Solo cambian de estado.

## Seguridad
### Acceso
Depende de:
- `system_role`
- `scope`
- `visibility`
- ownership

### Almacenamiento
- Storage privado tipo S3/Supabase
- URLs firmadas temporales
- HTTPS/TLS
- cifrado en reposo

### Reautenticación recomendada
Para:
- contratos
- nóminas
- identidad
- certificados médicos
