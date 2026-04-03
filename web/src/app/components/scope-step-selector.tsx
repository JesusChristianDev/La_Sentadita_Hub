'use client';

import { useMemo, useState } from 'react';

import type { BackendScopeType } from '@/modules/auth_users';
import { Button, Select } from '@/shared/ui';

type ScopeOption = {
  authorityTier: string | null;
  isDerived: boolean;
  label: string;
  groupLabel?: string | null;
  companyId?: string | null;
  chainId?: string | null;
  scopeId: string | null;
  scopeType: BackendScopeType;
};

type ScopeStepSelectorProps = {
  action: (formData: FormData) => void;
  activeScopeId: string | null;
  activeScopeType: BackendScopeType;
  scopes: ScopeOption[];
  className?: string;
};

const LEVEL_ORDER: BackendScopeType[] = [
  'organization',
  'chain',
  'company',
  'restaurant',
  'zone',
  'self',
];

function serializeScope(scopeType: BackendScopeType, scopeId: string | null): string {
  return `${scopeType}:${scopeId ?? ''}`;
}

function deserializeScope(value: string): { scopeType: BackendScopeType; scopeId: string | null } {
  const [scopeType, ...rest] = value.split(':');
  const scopeId = rest.join(':');
  return {
    scopeType: scopeType as BackendScopeType,
    scopeId: scopeId.length ? scopeId : null,
  };
}

function levelLabel(level: BackendScopeType): string {
  switch (level) {
    case 'organization':
      return 'Organizacion';
    case 'chain':
      return 'Cadena';
    case 'company':
      return 'Empresa';
    case 'restaurant':
      return 'Restaurante';
    case 'zone':
      return 'Zona';
    case 'self':
      return 'Perfil';
  }
}

function scopeOptionLabel(scope: ScopeOption): string {
  if (scope.scopeType === 'restaurant' && scope.groupLabel) {
    return `${scope.groupLabel} - ${scope.label}`;
  }
  return scope.label;
}

export function ScopeStepSelector({
  action,
  activeScopeId,
  activeScopeType,
  scopes,
  className,
}: ScopeStepSelectorProps) {
  const levels = useMemo(() => {
    const found = new Set(scopes.map((s) => s.scopeType));
    return LEVEL_ORDER.filter((level) => found.has(level));
  }, [scopes]);

  const [selectedLevel, setSelectedLevel] = useState<BackendScopeType>(() =>
    levels.includes(activeScopeType) ? activeScopeType : (levels[0] ?? 'organization'),
  );

  const resolvedLevel = levels.includes(selectedLevel)
    ? selectedLevel
    : (levels[0] ?? 'organization');

  const scopesForLevel = useMemo(
    () =>
      scopes
        .filter((s) => s.scopeType === resolvedLevel)
        .sort((a, b) => scopeOptionLabel(a).localeCompare(scopeOptionLabel(b))),
    [resolvedLevel, scopes],
  );

  const [selectedScopeValue, setSelectedScopeValue] = useState(() =>
    serializeScope(activeScopeType, activeScopeId),
  );

  const selected = deserializeScope(selectedScopeValue);
  const selectedMatchesLevel = selected.scopeType === resolvedLevel;
  const selectedValueForSubmit = selectedMatchesLevel
    ? selectedScopeValue
    : (scopesForLevel[0]
        ? serializeScope(scopesForLevel[0].scopeType, scopesForLevel[0].scopeId)
        : serializeScope(resolvedLevel, null));
  const selectedForSubmit = deserializeScope(selectedValueForSubmit);

  return (
    <form
      action={action}
      className={`scope-step-selector relative flex h-11 w-full min-w-0 items-center gap-1 overflow-visible rounded-full border border-border/70 bg-surface/70 p-1.5 shadow-[0_18px_38px_-28px_rgba(0,0,0,0.7)] backdrop-blur ${className ?? ''}`}
      aria-label="Selector de contexto por pasos"
    >
      <input type="hidden" name="scopeType" value={selectedForSubmit.scopeType} />
      <input type="hidden" name="scopeId" value={selectedForSubmit.scopeId ?? ''} />

      <div className="w-[11.25rem] shrink-0">
        <Select
          aria-label="Nivel de contexto"
          className="h-8 w-full rounded-full !border-transparent bg-transparent px-2 py-0 text-[13px] font-medium !shadow-none"
          dropdownVariant="nav"
          value={resolvedLevel}
          disabled={levels.length <= 1}
          onChange={(event) => {
            const nextLevel = event.target.value as BackendScopeType;
            setSelectedLevel(nextLevel);
            const first = scopes
              .filter((s) => s.scopeType === nextLevel)
              .sort((a, b) => scopeOptionLabel(a).localeCompare(scopeOptionLabel(b)))[0];
            setSelectedScopeValue(
              first
                ? serializeScope(first.scopeType, first.scopeId)
                : serializeScope(nextLevel, null),
            );
          }}
        >
          {levels.map((level) => (
            <option key={level} value={level}>
              {levelLabel(level)}
            </option>
          ))}
        </Select>
      </div>

      <div className="min-w-0 flex-1">
        <Select
          aria-label="Contexto disponible"
          className="h-8 w-full rounded-full !border-transparent bg-transparent px-2.5 py-0 text-[13px] font-medium !shadow-none"
          dropdownVariant="nav"
          value={selectedValueForSubmit}
          onChange={(event) => setSelectedScopeValue(event.target.value)}
        >
          {scopesForLevel.map((scope) => (
            <option
              key={serializeScope(scope.scopeType, scope.scopeId)}
              value={serializeScope(scope.scopeType, scope.scopeId)}
            >
              {scopeOptionLabel(scope)}
            </option>
          ))}
        </Select>
      </div>

      <Button
        variant="secondary"
        className="h-8 w-[4.5rem] shrink-0 rounded-full px-2 py-0 text-[13px] font-medium"
        type="submit"
      >
        Aplicar
      </Button>
    </form>
  );
}

