import {
  Camera,
  KeyRound,
  type LucideIcon,
  Mail,
  ShieldCheck,
} from 'lucide-react';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { buildMePageViewModel, getCurrentUserContext } from '@/modules/auth_users';
import {
  getProfileErrorMessage,
  getProfileSuccessMessage,
  type ProfileErrorCode,
  type ProfileSuccessCode,
} from '@/shared/feedbackMessages';

import { UserAvatar } from '../../components/user-avatar';
import { changeAvatarAction, changeEmailAction, changePasswordAction } from './actions';

type SearchParams = { e?: ProfileErrorCode; ok?: ProfileSuccessCode };
type Props = { searchParams: Promise<SearchParams> };

function MePanel({
  children,
  icon: Icon,
  subtitle,
  title,
}: {
  children: ReactNode;
  icon: LucideIcon;
  subtitle: string;
  title: string;
}) {
  return (
    <section className="panel">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[1rem] border border-border/70 bg-surface-muted/60 text-accent-strong">
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h2 className="panel-title">{title}</h2>
          <p className="panel-subtitle">{subtitle}</p>
        </div>
      </div>

      <div className="mt-4">{children}</div>
    </section>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <article className="meta-item">
      <p className="meta-label">{label}</p>
      <p className="meta-value break-words">{value}</p>
    </article>
  );
}

export default async function MePage({ searchParams }: Props) {
  const sp = await searchParams;

  const ctx = await getCurrentUserContext();
  if (!ctx) redirect('/login');

  const admin = createSupabaseAdminClient();
  let avatarUrl: string | null = null;
  if (ctx.person.avatar_path) {
    const { data } = await admin.storage
      .from('avatars')
      .createSignedUrl(ctx.person.avatar_path, 60 * 60);
    avatarUrl = data?.signedUrl ?? null;
  }

  const viewModel = buildMePageViewModel(ctx);
  const msg = getProfileSuccessMessage(sp.ok) ?? getProfileErrorMessage(sp.e);

  return (
    <main id="main-content" tabIndex={-1} className="app-shell stack rise-in">
      <section className="dashboard-message-hero">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center">
            <div className="flex shrink-0 justify-center">
              <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-3 shadow-[0_22px_54px_-36px_rgba(0,0,0,0.85)]">
                <UserAvatar
                  fullName={ctx.person.full_name}
                  role={ctx.requestContext.systemRole}
                  avatarUrl={avatarUrl}
                  size="lg"
                />
              </div>
            </div>

            <div className="dashboard-message-copy min-w-0">
              <h1 className="dashboard-message-title">{viewModel.displayName}</h1>
              <p className="dashboard-message-body break-all">
                {viewModel.email || '(sin email)'}
              </p>
            </div>
          </div>

          <div className="w-full max-w-[34rem]">
            <div className="meta-grid">
              <MetaItem label="Rol" value={viewModel.displayRole} />
              <MetaItem label="Contexto" value={viewModel.contextLabel} />
              <MetaItem label="Estado" value={viewModel.accessStatusLabel} />
              <MetaItem label="Seguridad" value={viewModel.securityStatus} />
            </div>
          </div>
        </div>
      </section>

      {msg ? (
        <p
          className={`notice ${sp.e ? 'error' : 'ok'}`}
          role={sp.e ? 'alert' : 'status'}
          aria-live={sp.e ? 'assertive' : 'polite'}
        >
          {msg}
        </p>
      ) : null}

      <section className="grid gap-5 xl:grid-cols-[minmax(0,0.88fr)_minmax(0,1.12fr)]">
        <div className="stack">
          <MePanel
            icon={Camera}
            title="Foto de perfil"
            subtitle="Se usa en tu cuenta y en los modulos internos."
          >
            <div className="grid gap-4 md:grid-cols-[auto,minmax(0,1fr)] md:items-start">
              <div className="rounded-[1.5rem] border border-border/70 bg-surface-muted/45 p-4">
                <div className="flex flex-col items-center gap-3 text-center">
                  <UserAvatar
                    fullName={ctx.person.full_name}
                    role={ctx.requestContext.systemRole}
                    avatarUrl={avatarUrl}
                    size="lg"
                  />
                  <div>
                    <p className="m-0 text-sm font-semibold text-foreground">Imagen actual</p>
                    <p className="mt-1 text-xs text-muted">
                      JPG, PNG o WEBP. Tamano maximo: 2 MB.
                    </p>
                  </div>
                </div>
              </div>

              <form action={changeAvatarAction} className="grid gap-3">
                <label className="field">
                  <span>Nueva imagen</span>
                  <input
                    name="avatar"
                    type="file"
                    accept="image/*"
                    className="input text-sm"
                  />
                </label>

                <p className="rounded-[1rem] border border-border/70 bg-surface-muted/35 px-4 py-3 text-sm text-muted">
                  Esta accion no pide contrasena. Solo necesitas seleccionar la imagen
                  y guardar.
                </p>

                <button className="button w-full sm:w-fit" type="submit">
                  Actualizar foto
                </button>
              </form>
            </div>
          </MePanel>

          <MePanel
            icon={ShieldCheck}
            title="Resumen de cuenta"
            subtitle="Datos que describen tu acceso actual dentro del sistema."
          >
            <div className="meta-grid">
              <MetaItem label="Email actual" value={viewModel.email || '(sin email)'} />
              <MetaItem label="Codigo interno" value={viewModel.employeeCode} />
              <MetaItem label="Contexto" value={viewModel.contextLabel} />
              <MetaItem label="Estado de acceso" value={viewModel.accessStatusLabel} />
            </div>
          </MePanel>
        </div>

        <div className="stack">
          <MePanel
            icon={Mail}
            title="Email de acceso"
            subtitle="Al cambiarlo, puede requerirse confirmacion por correo."
          >
            <p className="text-sm muted">Actual: {viewModel.email || '(sin email)'}</p>

            <form action={changeEmailAction} className="mt-4 grid gap-3">
              <label className="field">
                <span>Nuevo email</span>
                <input name="newEmail" type="email" className="input" />
              </label>

              <label className="field">
                <span>Contrasena actual</span>
                <input name="password" type="password" className="input" />
              </label>

              <button className="button w-full sm:w-fit" type="submit">
                Cambiar email
              </button>
            </form>
          </MePanel>

          <MePanel
            icon={KeyRound}
            title="Contrasena"
            subtitle="Usa una contrasena robusta y distinta a la anterior."
          >
            <form action={changePasswordAction} className="grid gap-3">
              <label className="field">
                <span>Contrasena actual</span>
                <input name="currentPassword" type="password" className="input" />
              </label>

              <label className="field">
                <span>Nueva contrasena</span>
                <input name="newPassword" type="password" className="input" />
              </label>

              <label className="field">
                <span>Confirmar nueva contrasena</span>
                <input name="confirm" type="password" className="input" />
              </label>

              <button className="button w-full sm:w-fit" type="submit">
                Cambiar contrasena
              </button>
            </form>
          </MePanel>
        </div>
      </section>
    </main>
  );
}
