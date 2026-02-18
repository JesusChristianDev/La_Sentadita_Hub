import { cookies } from 'next/headers';

import { listRestaurants } from '@/modules/restaurants';
import {
  getProfileErrorMessage,
  getProfileSuccessMessage,
  type ProfileErrorCode,
  type ProfileSuccessCode,
} from '@/shared/feedbackMessages';
import { canPickRestaurantHeader, canSeeEmployeesInNav } from '@/shared/headerPolicy';
import { createSupabaseAdminClient } from '@/shared/supabase/admin';
import { createSupabaseServerClient } from '@/shared/supabase/server';

import { setActiveRestaurant } from '../app/actions';
import { AppHeader } from '../components/app-header';
import { UserAvatar } from '../components/user-avatar';
import { changeAvatarAction, changeEmailAction, changePasswordAction } from './actions';

type SearchParams = { e?: ProfileErrorCode; ok?: ProfileSuccessCode };
type Props = { searchParams: Promise<SearchParams> };

export default async function MePage({ searchParams }: Props) {
  const sp = await searchParams;

  const supabase = await createSupabaseServerClient();
  const [{ data: authData }, { data: sessionData }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.auth.getSession(),
  ]);
  const authUser = authData.user ?? sessionData.session?.user ?? null;
  if (!authUser) {
    return (
      <main id="main-content" tabIndex={-1} className="app-shell stack rise-in">
        <section className="panel">
          <h1 className="page-title">Mi perfil</h1>
          <p className="notice error">
            No se detecto sesion en /me. Ve a login e intenta nuevamente.
          </p>
        </section>
      </main>
    );
  }

  const admin = createSupabaseAdminClient();

  const { data: currentProfile } = await admin
    .from('profiles')
    .select(
      'id, role, restaurant_id, employee_code, full_name, avatar_path, must_change_password, is_active',
    )
    .eq('id', authUser.id)
    .single();

  if (!currentProfile || currentProfile.is_active === false) {
    return (
      <main id="main-content" tabIndex={-1} className="app-shell stack rise-in">
        <section className="panel">
          <h1 className="page-title">Mi perfil</h1>
          <p className="notice error">
            No se encontro un perfil activo para este usuario.
          </p>
        </section>
      </main>
    );
  }

  const current = { userId: authUser.id, profile: currentProfile };
  const showSelector = canPickRestaurantHeader(current.profile.role);
  const restaurants = showSelector ? await listRestaurants() : [];
  const store = await cookies();
  const activeRestaurantId = store.get('active_restaurant_id')?.value ?? null;
  const effectiveRestaurantId = showSelector
    ? (activeRestaurantId ?? current.profile.restaurant_id)
    : current.profile.restaurant_id;
  const email = authUser.email ?? '';

  const { data: profile } = await admin
    .from('profiles')
    .select('avatar_path')
    .eq('id', current.userId)
    .single();

  let avatarUrl: string | null = null;
  if (profile?.avatar_path) {
    const { data } = await admin.storage
      .from('avatars')
      .createSignedUrl(profile.avatar_path, 60 * 60);
    avatarUrl = data?.signedUrl ?? null;
  }

  const msg = getProfileSuccessMessage(sp.ok) ?? getProfileErrorMessage(sp.e);

  return (
    <main id="main-content" tabIndex={-1} className="app-shell stack rise-in">
      <AppHeader
        canSeeEmployees={canSeeEmployeesInNav(current.profile.role)}
        canPickRestaurant={showSelector}
        restaurants={restaurants}
        effectiveRestaurantId={effectiveRestaurantId}
        setActiveRestaurantAction={setActiveRestaurant}
        currentUserName={current.profile.full_name}
        currentUserRole={current.profile.role}
        currentUserAvatarUrl={avatarUrl}
      />

      <section className="page-intro">
        <h1 className="page-title">Mi perfil</h1>
        <p className="subtitle">Actualiza tus datos de acceso y seguridad.</p>
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

      <section className="panel">
        <h2 className="panel-title">Foto de perfil</h2>
        <p className="panel-subtitle">La imagen se usa para tu identificacion dentro del sistema.</p>

        <div className="profile-media mt-3">
          <UserAvatar
            fullName={current.profile.full_name}
            role={current.profile.role}
            avatarUrl={avatarUrl}
            size="lg"
          />

          <form action={changeAvatarAction}>
            <input name="avatar" type="file" accept="image/*" className="input text-sm" />
            <input
              name="password"
              type="password"
              placeholder="Contrasena actual"
              className="input text-sm"
            />
            <button className="button" type="submit">
              Subir foto
            </button>
          </form>
        </div>
      </section>

      <section className="panel">
        <h2 className="panel-title">Email</h2>
        <p className="panel-subtitle">Al cambiarlo, se puede requerir confirmacion por correo.</p>
        <p className="mt-2 text-sm muted">Actual: {email || '(sin email)'}</p>

        <form action={changeEmailAction} className="mt-3 grid gap-3">
          <label className="field">
            <span>Nuevo email</span>
            <input name="newEmail" type="email" className="input" />
          </label>

          <label className="field">
            <span>Contrasena actual</span>
            <input name="password" type="password" className="input" />
          </label>

          <button className="button" type="submit">
            Cambiar email
          </button>
        </form>
      </section>

      <section className="panel">
        <h2 className="panel-title">Contrasena</h2>
        <p className="panel-subtitle">Usa una contrasena robusta y no reutilizada.</p>

        <form action={changePasswordAction} className="mt-3 grid gap-3">
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

          <button className="button" type="submit">
            Cambiar contrasena
          </button>
        </form>
      </section>
    </main>
  );
}
