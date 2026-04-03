'use client';

import { useState } from 'react';

import type { BackendScopeType } from '@/modules/auth_users';
import { Button, Select } from '@/shared/ui';

type ScopeOption = {
  authorityTier: string | null;
  isDerived: boolean;
  label: string;
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
            ? 'Restaurante'
            : scope.scopeType === 'zone'
              ? 'Zona'
              : 'Personal';

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
  selectClassName,
  submitClassName,
}: ScopeSelectorProps) {
  const [selectedScopeValue, setSelectedScopeValue] = useState(
    serializeScope(activeScopeType, activeScopeId),
  );
  const selectedScope = deserializeScope(selectedScopeValue);

  return (
    <form action={action} className={className}>
      <input type="hidden" name="scopeType" value={selectedScope.scopeType} />
      <input type="hidden" name="scopeId" value={selectedScope.scopeId ?? ''} />
      <Select
        aria-label={ariaLabel}
        className={selectClassName}
        value={selectedScopeValue}
        onChange={(event) => setSelectedScopeValue(event.target.value)}
      >
        {scopes.map((scope) => (
          <option
            key={serializeScope(scope.scopeType, scope.scopeId)}
            value={serializeScope(scope.scopeType, scope.scopeId)}
          >
            {buildOptionLabel(scope)}
          </option>
        ))}
      </Select>
      <Button className={submitClassName} type="submit">
        {buttonLabel}
      </Button>
    </form>
  );
}
