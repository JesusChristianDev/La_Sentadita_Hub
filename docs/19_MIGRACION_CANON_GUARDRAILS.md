# Guardrails de Migración a Canon (PR1)

Objetivo: evitar que el canon se convierta en una segunda capa paralela encima del legacy.

## Reglas obligatorias en PR1

1. **No cambiar runtime de negocio**.
   - PR1 solo introduce contratos canónicos y restricciones.

2. **`Profile` es projection/view, no entidad canónica**.
   - Debe marcarse como deprecated para dominio.

3. **No exportar `Profile` como alias canónico desde `modules/people`**.
   - Consumidores nuevos deben usar contratos canónicos o `PersonProfile` explícita como read model.

4. **No crear bridges/adapters estables legacy->canon en PR1**.
   - Se permite coexistencia temporal de tipos, no una capa dual permanente.

5. **Catálogo canónico declarado explícitamente**.
   - Roles: `admin`, `owner`, `office`, `manager`, `area_lead`, `employee`.
   - Scopes: `organization`, `company`, `restaurant`, `zone`.

## Checklist de revisión PR1

- [ ] Existen contratos canónicos base (`CanonicalPerson`, `CanonicalEmploymentRelationship`, `CanonicalRoleScopeAssignment`, `AccessStatus`).
- [ ] `PersonProfile` está marcado como projection/view deprecated.
- [ ] `modules/people` no re-exporta `Profile` como alias canónico.
- [ ] No se añadieron reglas de negocio nuevas.
- [ ] No se añadieron adapters estables legacy/canon.

## Siguiente paso (PR2)

Reescribir `requestContext` y núcleo de authz para depender del catálogo canónico y retirar semántica heredada (`platform`, `self`, `sub_manager`, `chain_owner`).
