'use client';

import { useState } from 'react';

import type { BackendScopeType } from '@/modules/auth_users';
import { Button, Select } from '@/shared/ui';

type ScopeOption = {
  authorityTier: string | null;
  isDerived: boolean;
  label: string;
  groupLabel?: string | null;
  scopeId: string | null;
  scopeType: BackendScopeType;
};

type ScopeSelectorProps = {
  action: (formData: FormData) => void;
  activeScopeId: string | null;
  activeScopeType: BackendScopeType;
  ariaLabel?: string;
  buttonLabel?: string;
  className?: string;
  dropdownVariant?: 'nav';
  scopes: ScopeOption[];
  selectClassName?: string;
  submitClassName?: string;
};

function serializeScope(scopeType: BackendScopeType, scopeId: string | null): string {
  return `${scopeType}:${scopeId ?? ''}`;
}

function deserializeScope(value: string): {
  scopeId: string | null;
  scopeType: BackendScopeType;
} {
  const [scopeType, ...scopeIdParts] = value.split(':');
  const scopeId = scopeIdParts.join(':');

  return {
    scopeId: scopeId.length > 0 ? scopeId : null,
    scopeType: scopeType as BackendScopeType,
  };
}

function buildOptionLabel(scope: ScopeOption): string {
  const typeLabel =
    scope.scopeType === 'organization'
      ? 'Organizacion'
      : scope.scopeType === 'chain'
        ? 'Cadena'
        : scope.scopeType === 'company'
          ? 'Empresa'
          : scope.scopeType === 'restaurant'
            ? null
            : scope.scopeType === 'zone'
              ? 'Zona'
              : 'Personal';

  // En la vista del dropdown agrupamos restaurantes por company, así que dentro del grupo
  // mostramos solo el nombre del restaurante.
  if (scope.scopeType === 'restaurant') {
    return scope.label;
  }

  return `${typeLabel} - ${scope.label}`;
}

export function ScopeSelector({
  action,
  activeScopeId,
  activeScopeType,
  ariaLabel = 'Contexto activo',
  buttonLabel = 'Aplicar',
  className,
  scopes,
  dropdownVariant,
  selectClassName,
  submitClassName,
}: ScopeSelectorProps) {
  const [selectedScopeValue, setSelectedScopeValue] = useState(
    serializeScope(activeScopeType, activeScopeId),
  );
  const selectedScope = deserializeScope(selectedScopeValue);

  const otherScopes = scopes.filter((s) => s.scopeType !== 'restaurant');
  const restaurantScopes = scopes.filter((s) => s.scopeType === 'restaurant');

  // Mantener el orden de llegada (ya viene ordenado desde el backend).
  const restaurantGroups = new Map<string, ScopeOption[]>();
  for (const scope of restaurantScopes) {
    const groupLabel = scope.groupLabel ?? 'Empresa';
    const current = restaurantGroups.get(groupLabel) ?? [];
    current.push(scope);
    restaurantGroups.set(groupLabel, current);
  }

  return (
    <form action={action} className={className}>
      <input type="hidden" name="scopeType" value={selectedScope.scopeType} />
      <input type="hidden" name="scopeId" value={selectedScope.scopeId ?? ''} />
      <Select
        aria-label={ariaLabel}
        className={selectClassName}
        value={selectedScopeValue}
        onChange={(event) => setSelectedScopeValue(event.target.value)}
        dropdownVariant={dropdownVariant}
      >
        {otherScopes.map((scope) => (
          <option
            key={serializeScope(scope.scopeType, scope.scopeId)}
            value={serializeScope(scope.scopeType, scope.scopeId)}
          >
            {buildOptionLabel(scope)}
          </option>
        ))}

        {Array.from(restaurantGroups.entries()).map(([groupLabel, groupScopes]) => (
          <optgroup key={groupLabel} label={groupLabel}>
            {groupScopes.map((scope) => (
              <option
                key={serializeScope(scope.scopeType, scope.scopeId)}
                value={serializeScope(scope.scopeType, scope.scopeId)}
              >
                {buildOptionLabel(scope)}
              </option>
            ))}
          </optgroup>
        ))}
      </Select>
      <Button className={submitClassName} type="submit">
        {buttonLabel}
      </Button>
    </form>
  );
}
