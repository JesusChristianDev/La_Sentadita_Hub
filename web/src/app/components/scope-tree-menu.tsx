'use client';

import { ChevronDown } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import type { BackendScopeType } from '@/modules/auth_users';

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

type ScopeTreeMenuProps = {
  action: (formData: FormData) => void;
  scopes: ScopeOption[];
  activeScopeId: string | null;
  activeScopeType: BackendScopeType;
  activeScopeLabel: string;
};

export function ScopeTreeMenu({
  action,
  scopes,
  activeScopeId,
  activeScopeType,
  activeScopeLabel,
}: ScopeTreeMenuProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const formRef = useRef<HTMLFormElement>(null);
  const scopeTypeInputRef = useRef<HTMLInputElement>(null);
  const scopeIdInputRef = useRef<HTMLInputElement>(null);

  const organizationScope = useMemo(
    () => scopes.find((s) => s.scopeType === 'organization') ?? null,
    [scopes],
  );

  const organizationScopeId = organizationScope?.scopeId ?? null;
  const organizationLabel = organizationScope?.label ?? 'Organizacion';

  const restaurantNodes = useMemo(() => {
    return scopes.filter((s) => s.scopeType === 'restaurant' && s.scopeId);
  }, [scopes]);

  const explicitCompanyNodes = useMemo(() => {
    return scopes.filter((s) => s.scopeType === 'company' && s.scopeId);
  }, [scopes]);

  const explicitChainNodes = useMemo(() => {
    return scopes.filter((s) => s.scopeType === 'chain' && s.scopeId);
  }, [scopes]);

  const showChains = explicitChainNodes.length > 0;

  const companyNodes = useMemo(() => {
    const byCompanyId = new Map<
      string,
      { id: string; label: string; chainId: string | null }
    >();

    const explicitById = new Map(
      explicitCompanyNodes.map((n) => [n.scopeId as string, n.label] as const),
    );

    for (const restaurant of restaurantNodes) {
      const companyId = restaurant.companyId;
      if (!companyId) continue;

      const existing = byCompanyId.get(companyId);
      if (existing) continue;

      byCompanyId.set(companyId, {
        id: companyId,
        label: explicitById.get(companyId) ?? restaurant.groupLabel ?? 'Empresa',
        chainId: restaurant.chainId ?? null,
      });
    }

    // Si el usuario tiene company scopes explícitos aunque no haya restaurantes derivados,
    // los incluimos para que no “desaparezca” la rama.
    for (const company of explicitCompanyNodes) {
      const companyId = company.scopeId;
      if (!companyId) continue;
      if (byCompanyId.has(companyId)) continue;

      byCompanyId.set(companyId, {
        id: companyId,
        label: company.label,
        chainId: null,
      });
    }

    return Array.from(byCompanyId.values());
  }, [explicitCompanyNodes, restaurantNodes]);

  const chainNodes = useMemo(() => {
    if (!showChains) return [];

    const companiesByChainId = new Map<string, string[]>();
    for (const company of companyNodes) {
      if (!company.chainId) continue;
      const list = companiesByChainId.get(company.chainId) ?? [];
      list.push(company.id);
      companiesByChainId.set(company.chainId, list);
    }

    return explicitChainNodes.map((chain) => ({
      id: chain.scopeId as string,
      label: chain.label,
      companyIds: companiesByChainId.get(chain.scopeId as string) ?? [],
    }));
  }, [companyNodes, explicitChainNodes, showChains]);

  const restaurantsByCompanyId = useMemo(() => {
    const byCompany = new Map<string, ScopeOption[]>();
    for (const r of restaurantNodes) {
      const companyId = r.companyId;
      if (!companyId) continue;
      const list = byCompany.get(companyId) ?? [];
      list.push(r);
      byCompany.set(companyId, list);
    }
    return byCompany;
  }, [restaurantNodes]);

  const derivedHoveredCompanyId = useMemo(() => {
    if (activeScopeType === 'company' && activeScopeId) return activeScopeId;
    if (activeScopeType === 'restaurant' && activeScopeId) {
      const restaurant = restaurantNodes.find((n) => n.scopeId === activeScopeId);
      return restaurant?.companyId ?? null;
    }
    return null;
  }, [activeScopeId, activeScopeType, restaurantNodes]);

  const derivedHoveredChainId = useMemo(() => {
    if (activeScopeType === 'chain' && activeScopeId) return activeScopeId;
    if (activeScopeType === 'restaurant' && activeScopeId) {
      const restaurant = restaurantNodes.find((n) => n.scopeId === activeScopeId);
      return restaurant?.chainId ?? null;
    }
    return null;
  }, [activeScopeId, activeScopeType, restaurantNodes]);

  const [hoveredChainId, setHoveredChainId] = useState<string | null>(() => derivedHoveredChainId);
  const [hoveredCompanyId, setHoveredCompanyId] = useState<string | null>(() => derivedHoveredCompanyId);
  const [previewOrganization, setPreviewOrganization] = useState(false);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;

      if (panelRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;

      setOpen(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('pointerdown', handlePointerDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [open]);

  const activeChainId = hoveredChainId ?? null;

  const companiesForHoveredChain = useMemo(() => {
    if (!previewOrganization && !activeChainId) return [];
    if (!showChains) return previewOrganization ? companyNodes : [];
    if (previewOrganization) return companyNodes;
    return companyNodes.filter((c) => c.chainId === activeChainId);
  }, [activeChainId, companyNodes, previewOrganization, showChains]);

  const effectiveHoveredCompanyId = hoveredCompanyId;

  const restaurantsForHoveredCompany = useMemo(() => {
    if (!effectiveHoveredCompanyId) return [];
    return restaurantsByCompanyId.get(effectiveHoveredCompanyId) ?? [];
  }, [effectiveHoveredCompanyId, restaurantsByCompanyId]);

  const submitScope = (scopeType: BackendScopeType, scopeId: string | null) => {
    if (!formRef.current || !scopeTypeInputRef.current || !scopeIdInputRef.current) return;

    scopeTypeInputRef.current.value = scopeType;
    scopeIdInputRef.current.value = scopeId ?? '';
    formRef.current.requestSubmit();
  };

  return (
    <div className="relative block">
      <form ref={formRef} action={action} className="hidden">
        <input ref={scopeTypeInputRef} type="hidden" name="scopeType" defaultValue={activeScopeType} />
        <input ref={scopeIdInputRef} type="hidden" name="scopeId" defaultValue={activeScopeId ?? ''} />
      </form>

      <button
        ref={triggerRef}
        type="button"
        className="flex h-10 min-w-[12rem] max-w-[16rem] items-center justify-between gap-2 rounded-full border border-transparent bg-surface-strong/80 px-4 text-sm font-medium text-foreground transition-colors hover:bg-surface-strong/90 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 xl:min-w-[14rem] xl:max-w-[22rem]"
        aria-expanded={open}
        onClick={() =>
          setOpen((current) => {
            const next = !current;
            if (next) {
              setHoveredChainId(derivedHoveredChainId);
              setHoveredCompanyId(derivedHoveredCompanyId);
              setPreviewOrganization(false);
            }
            return next;
          })
        }
      >
        <span className="min-w-0 truncate">{activeScopeLabel}</span>
        <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open ? (
        <div
          ref={panelRef}
          className="absolute right-0 top-[calc(100%+12px)] z-50 flex w-[760px] max-w-[92vw] flex-col gap-3 rounded-[1.5rem] border border-border bg-background/96 p-2 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.55)] backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-200"
        >
          <div className="flex items-center justify-between gap-2 px-2 pt-1">
            <p className="text-xs font-bold uppercase tracking-widest text-muted">
              Scope
            </p>
            <p className="text-xs text-muted">
              Click para cambiar. Hover para previsualizar.
            </p>
          </div>

          <div className={`grid ${showChains ? 'grid-cols-4' : 'grid-cols-3'} gap-2`}>
            <div className="max-h-[420px] overflow-y-auto rounded-[1.25rem] border border-border/40 bg-surface/30 p-2">
              <div className="text-xs font-bold uppercase tracking-widest text-muted px-1 mb-2">
                Organizacion
              </div>
              <div className="flex flex-col gap-1">
                <button
                  type="button"
                  className={`rounded-2xl border px-3 py-2 text-left transition-colors ${
                    activeScopeType === 'organization' || previewOrganization
                      ? 'border-accent/40 bg-accent/12 text-foreground'
                      : 'border-transparent text-muted hover:bg-surface-strong/60 hover:text-foreground'
                  }`}
                  onMouseEnter={() => {
                    setPreviewOrganization(true);
                    setHoveredChainId(null);
                    setHoveredCompanyId(null);
                  }}
                  onClick={() => {
                    setOpen(false);
                    submitScope('organization', organizationScopeId);
                  }}
                >
                  {organizationLabel}
                </button>
              </div>
            </div>

            {showChains ? (
              <div className="max-h-[420px] overflow-y-auto rounded-[1.25rem] border border-border/40 bg-surface/30 p-2">
                <div className="text-xs font-bold uppercase tracking-widest text-muted px-1 mb-2">
                  Cadena
                </div>
                <div className="flex flex-col gap-1">
                  {chainNodes.map((chain) => {
                    const active = activeScopeType === 'chain' && activeScopeId === chain.id;
                    const hovered = hoveredChainId === chain.id;
                    return (
                      <button
                        key={chain.id}
                        type="button"
                        className={`rounded-2xl border px-3 py-2 text-left transition-colors ${
                          active || hovered
                            ? 'border-accent/40 bg-accent/12 text-foreground'
                            : 'border-transparent text-muted hover:bg-surface-strong/60 hover:text-foreground'
                        }`}
                        onMouseEnter={() => {
                          setPreviewOrganization(false);
                          setHoveredChainId(chain.id);
                          setHoveredCompanyId(null);
                        }}
                        onClick={() => {
                          setOpen(false);
                          submitScope('chain', chain.id);
                        }}
                      >
                        {chain.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            <div className="max-h-[420px] overflow-y-auto rounded-[1.25rem] border border-border/40 bg-surface/30 p-2">
              <div className="text-xs font-bold uppercase tracking-widest text-muted px-1 mb-2">
                Empresa
              </div>
              <div className="flex flex-col gap-1">
                <button
                  type="button"
                  className={`rounded-2xl border px-3 py-2 text-left transition-colors ${
                    activeScopeType === 'organization'
                      ? 'border-accent/40 bg-accent/12 text-foreground'
                      : 'border-transparent text-muted hover:bg-surface-strong/60 hover:text-foreground'
                  }`}
                  onClick={() => {
                    setOpen(false);
                    submitScope('organization', organizationScopeId);
                  }}
                >
                  Todas las empresas de la organizacion
                </button>

                {companiesForHoveredChain.map((company) => {
                  const active = activeScopeType === 'company' && activeScopeId === company.id;
                  const hovered = effectiveHoveredCompanyId === company.id;
                  return (
                    <button
                      key={company.id}
                      type="button"
                      className={`rounded-2xl border px-3 py-2 text-left transition-colors ${
                        active || hovered
                          ? 'border-accent/40 bg-accent/12 text-foreground'
                          : 'border-transparent text-muted hover:bg-surface-strong/60 hover:text-foreground'
                      }`}
                      onMouseEnter={() => {
                        setPreviewOrganization(false);
                        setHoveredCompanyId(company.id);
                        setHoveredChainId(company.chainId ?? null);
                      }}
                      onClick={() => {
                        setOpen(false);
                        submitScope('company', company.id);
                      }}
                    >
                      {company.label}
                    </button>
                  );
                })}
                {companiesForHoveredChain.length === 0 ? (
                  <p className="px-2 py-6 text-sm text-muted">
                    Pasa el mouse por Organizacion o una Cadena.
                  </p>
                ) : null}
              </div>
            </div>

            <div className="max-h-[420px] overflow-y-auto rounded-[1.25rem] border border-border/40 bg-surface/30 p-2">
              <div className="text-xs font-bold uppercase tracking-widest text-muted px-1 mb-2">
                Restaurantes
              </div>
              <div className="flex flex-col gap-1">
                {restaurantsForHoveredCompany.map((restaurant) => {
                  const active = activeScopeType === 'restaurant' && activeScopeId === restaurant.scopeId;
                  return (
                    <button
                      key={restaurant.scopeId ?? restaurant.label}
                      type="button"
                      className={`rounded-2xl border px-3 py-2 text-left transition-colors ${
                        active
                          ? 'border-accent/40 bg-accent/12 text-foreground'
                          : 'border-transparent text-muted hover:bg-surface-strong/60 hover:text-foreground'
                      }`}
                      onClick={() => {
                        setOpen(false);
                        submitScope('restaurant', restaurant.scopeId);
                      }}
                    >
                      {restaurant.label}
                    </button>
                  );
                })}
                {restaurantsForHoveredCompany.length === 0 ? (
                  <p className="px-2 py-6 text-sm text-muted">
                    Pasa el mouse por una Empresa.
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

