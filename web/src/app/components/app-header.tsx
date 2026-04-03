'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useEffect, useId, useRef, useState } from 'react';

import type { BackendScopeType } from '@/modules/auth_users';
import type { SystemRole } from '@/shared/authz';

import { ScopeSelector } from './scope-selector';
import { ScreenNav } from './screen-nav';
import { UserAvatar } from './user-avatar';

const MobileHeaderMenu = dynamic(() =>
  import('./mobile-header-menu').then((mod) => mod.MobileHeaderMenu),
);

type ScopeOption = {
  authorityTier: string | null;
  isDerived: boolean;
  label: string;
  scopeId: string | null;
  scopeType: BackendScopeType;
};

export type AppHeaderProps = {
  canSeeEmployees: boolean;
  canSeeDocuments?: boolean;
  canSeeIncidents?: boolean;
  canSeeNotifications?: boolean;
  canSeeRequests: boolean;
  canSeeProcurement?: boolean;
  canSeeSchedules: boolean;
  canSeeTasks: boolean;
  canSelectScope?: boolean;
  availableScopes?: ScopeOption[];
  activeScopeId?: string | null;
  activeScopeType?: BackendScopeType;
  activeScopeLabel?: string;
  isMobileDevice?: boolean;
  setActiveScopeAction?: (formData: FormData) => void;
  currentUserName?: string | null;
  currentUserRole?: SystemRole | null;
  currentUserAvatarUrl?: string | null;
};

export function AppHeader({
  canSeeEmployees,
  canSeeDocuments = false,
  canSeeIncidents = false,
  canSeeNotifications = false,
  canSeeRequests,
  canSeeProcurement = false,
  canSeeSchedules,
  canSeeTasks,
  canSelectScope = false,
  availableScopes = [],
  activeScopeId = null,
  activeScopeType = 'self',
  activeScopeLabel = 'Vista global',
  isMobileDevice = false,
  setActiveScopeAction,
  currentUserName = null,
  currentUserRole = null,
  currentUserAvatarUrl = null,
}: AppHeaderProps) {
  const shortName = currentUserName?.trim() || 'Cuenta';
  const [desktopMenuOpen, setDesktopMenuOpen] = useState(false);
  const desktopMenuId = useId();
  const desktopMenuRef = useRef<HTMLDivElement>(null);
  const isDesktopMenuVisible = desktopMenuOpen && !isMobileDevice;

  useEffect(() => {
    if (!isDesktopMenuVisible) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (!desktopMenuRef.current?.contains(target)) {
        setDesktopMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setDesktopMenuOpen(false);
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isDesktopMenuVisible]);

  if (isMobileDevice) {
    return (
      <header
        data-app-header
        className="pointer-events-none fixed inset-x-0 top-0 z-50 px-3 pt-[calc(env(safe-area-inset-top,0px)+0.55rem)]"
      >
        <div className="pointer-events-auto mx-auto flex w-full items-center gap-3 rounded-[1.45rem] border border-white/10 bg-[linear-gradient(180deg,rgba(23,23,29,0.94)_0%,rgba(11,11,15,0.97)_100%)] px-3.5 py-2.5 shadow-[0_28px_70px_-42px_rgba(0,0,0,0.96)] backdrop-blur-xl">
          <div className="min-w-0 flex-1">
            <Link
              href="/app"
              className="block truncate text-[0.7rem] font-semibold uppercase tracking-[0.34em] text-accent-strong/90"
            >
              La Sentadita Hub
            </Link>
          </div>

          <div className="shrink-0">
            <MobileHeaderMenu
              canSeeEmployees={canSeeEmployees}
              canSeeDocuments={canSeeDocuments}
              canSeeIncidents={canSeeIncidents}
              canSeeNotifications={canSeeNotifications}
              canSeeRequests={canSeeRequests}
              canSeeProcurement={canSeeProcurement}
              canSeeSchedules={canSeeSchedules}
              canSeeTasks={canSeeTasks}
              canSelectScope={canSelectScope}
              availableScopes={availableScopes}
              activeScopeId={activeScopeId}
              activeScopeType={activeScopeType}
              activeScopeLabel={activeScopeLabel}
              setActiveScopeAction={setActiveScopeAction}
              currentUserName={currentUserName}
              currentUserRole={currentUserRole}
              currentUserAvatarUrl={currentUserAvatarUrl}
            />
          </div>
        </div>
      </header>
    );
  }

  return (
    <>
      <header
        data-app-header
        className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/94 backdrop-blur-xl transition-shadow duration-300"
      >
        <div className="mx-auto flex min-h-[4.75rem] w-full max-w-[1840px] items-center gap-3 px-4 sm:px-6 lg:px-8 xl:px-10">
          <div className="flex min-w-0 flex-1 items-center gap-4 lg:gap-10">
            <Link
              href="/app"
              className="shrink-0 text-base font-extrabold tracking-[-0.03em] text-white transition-colors hover:text-accent sm:text-xl"
            >
              La Sentadita <span className="text-accent-strong">Hub</span>
            </Link>

            <div className="min-w-0 flex-1">
              <ScreenNav
                canSeeEmployees={canSeeEmployees}
                canSeeDocuments={canSeeDocuments}
                canSeeIncidents={canSeeIncidents}
                canSeeNotifications={canSeeNotifications}
                canSeeRequests={canSeeRequests}
                canSeeProcurement={canSeeProcurement}
                canSeeSchedules={canSeeSchedules}
                canSeeTasks={canSeeTasks}
                className="flex min-w-0 flex-1 items-center justify-center"
              />
            </div>
          </div>

          <div className="flex shrink-0 items-center justify-end gap-3 sm:gap-4 lg:gap-5">
            {canSelectScope && setActiveScopeAction ? (
              <ScopeSelector
                action={setActiveScopeAction}
                activeScopeId={activeScopeId}
                activeScopeType={activeScopeType}
                scopes={availableScopes}
                ariaLabel="Contexto activo"
                className="flex items-center gap-2 rounded-full border border-border/80 bg-surface/40 p-1.5 transition-colors hover:bg-surface/60"
                selectClassName="h-10 min-w-[12rem] max-w-[16rem] rounded-full border border-transparent bg-surface-strong/80 px-4 py-0 text-sm font-medium lg:max-w-[18rem] xl:max-w-[22rem]"
                submitClassName="h-10 rounded-full px-5 py-0 text-sm font-semibold shadow-lg shadow-accent/20"
              />
            ) : null}

            <div className="hidden min-w-[12rem] rounded-[1.25rem] border border-border/80 bg-surface/40 px-4 py-2 text-right xl:block">
              <p className="text-[0.6rem] font-bold uppercase tracking-[0.24em] text-muted">
                Contexto activo
              </p>
              <p className="truncate text-sm font-semibold text-foreground">
                {activeScopeLabel}
              </p>
            </div>

            <div ref={desktopMenuRef} className="relative block">
              <button
                type="button"
                className="group flex cursor-pointer items-center gap-2 rounded-full border border-border/80 bg-surface-strong/80 py-1 pl-1 pr-2 transition-all hover:border-muted hover:bg-surface-muted focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 xl:pr-4"
                aria-expanded={isDesktopMenuVisible}
                aria-controls={desktopMenuId}
                aria-label={isDesktopMenuVisible ? 'Cerrar menu de cuenta' : 'Abrir menu de cuenta'}
                onClick={() => setDesktopMenuOpen((open) => !open)}
              >
                <div className="relative">
                  <UserAvatar
                    fullName={currentUserName}
                    role={currentUserRole}
                    avatarUrl={currentUserAvatarUrl}
                    size="md"
                  />
                  <div className="absolute inset-0 rounded-full border border-white/10 group-hover:border-white/20 transition-colors" />
                </div>
                <span className="hidden max-w-[160px] truncate text-sm font-semibold text-foreground group-hover:text-white transition-colors xl:block">
                  {shortName}
                </span>
              </button>
              {isDesktopMenuVisible ? (
                <div
                  id={desktopMenuId}
                  className="absolute right-0 top-[calc(100%+12px)] z-50 flex min-w-[240px] flex-col gap-1 rounded-[1.5rem] border border-border bg-background/96 p-2 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.6)] backdrop-blur-2xl animate-in fade-in slide-in-from-top-2 duration-200"
                >
                  <div className="px-3 py-2 mb-1 border-b border-border/40">
                    <p className="text-xs font-bold uppercase tracking-widest text-muted">Cuenta</p>
                    <p className="truncate text-sm font-medium text-foreground">{currentUserName || 'Usuario'}</p>
                  </div>
                  <Link
                    href="/me"
                    className="flex w-full items-center rounded-xl px-4 py-3 text-sm font-medium text-foreground transition-all hover:bg-surface hover:text-white"
                    onClick={() => setDesktopMenuOpen(false)}
                  >
                    Mi perfil
                  </Link>
                  <Link
                    href="/api/auth/signout?next=/login"
                    className="flex w-full items-center rounded-xl px-4 py-3 text-sm font-medium text-danger transition-all hover:bg-danger/15 hover:text-danger"
                    onClick={() => setDesktopMenuOpen(false)}
                  >
                    Cerrar sesión
                  </Link>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </header>
    </>
  );
}
