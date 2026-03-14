'use server';

import { redirect } from 'next/navigation';

import {
  validateEmailChangeInput,
  validatePasswordChangeInput,
} from '@/modules/auth_users/application/selfProfileMutationRules';
import { mePathWithError, mePathWithSuccess } from '@/shared/feedbackMessages';
import { createSupabaseAdminClient } from '@/shared/supabase/admin';
import { createSupabaseServerClient } from '@/shared/supabase/server';

async function requireAuthenticatedUser(): Promise<{
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  userId: string;
  email: string | null;
}> {
  const supabase = await createSupabaseServerClient();

  const { data: userData } = await supabase.auth.getUser();
  const email = userData.user?.email ?? null;
  const userId = userData.user?.id ?? null;

  if (!userId) redirect('/login');

  return { supabase, userId, email };
}

async function requireReauth(currentPassword: string): Promise<{
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  userId: string;
  email: string;
}> {
  const { supabase, userId, email } = await requireAuthenticatedUser();
  if (!email) redirect('/login');

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password: currentPassword,
  });

  if (error) redirect(mePathWithError('bad_password'));

  return { supabase, userId, email };
}

export async function changeEmailAction(formData: FormData) {
  const validated = validateEmailChangeInput({
    newEmail: String(formData.get('newEmail') ?? ''),
    password: String(formData.get('password') ?? ''),
  });

  if (!validated.ok) redirect(mePathWithError(validated.errorCode));

  const { supabase } = await requireReauth(validated.value.password);

  const { error } = await supabase.auth.updateUser({ email: validated.value.newEmail });

  if (error) redirect(mePathWithError('bad'));

  // Normalmente Supabase exige confirmación por email (según settings)
  redirect(mePathWithSuccess('email'));
}

export async function changePasswordAction(formData: FormData) {
  const validated = validatePasswordChangeInput({
    confirm: String(formData.get('confirm') ?? ''),
    currentPassword: String(formData.get('currentPassword') ?? ''),
    newPassword: String(formData.get('newPassword') ?? ''),
  });

  if (!validated.ok) redirect(mePathWithError(validated.errorCode));

  const { supabase } = await requireReauth(validated.value.currentPassword);

  const { error } = await supabase.auth.updateUser({
    password: validated.value.newPassword,
  });

  if (error) redirect(mePathWithError('bad'));

  redirect(mePathWithSuccess('password'));
}

export async function changeAvatarAction(formData: FormData) {
  const file = formData.get('avatar');

  if (!(file instanceof File) || file.size === 0) redirect(mePathWithError('missing'));

  if (!file.type.startsWith('image/')) redirect(mePathWithError('bad_file'));
  if (file.size > 2_000_000) redirect(mePathWithError('file_too_large')); // 2MB

  const { userId } = await requireAuthenticatedUser();

  const bytes = Buffer.from(await file.arrayBuffer());

  const admin = createSupabaseAdminClient();

  // Un archivo por usuario (simple): sobrescribe siempre
  const path = `${userId}/avatar`;

  const { error: uploadError } = await admin.storage.from('avatars').upload(path, bytes, {
    upsert: true,
    contentType: file.type,
  });

  if (uploadError) {
    throw new Error(`Failed to upload avatar: ${uploadError.message}`);
  }

  const { error: profileError } = await admin
    .from('profiles')
    .update({ avatar_path: path })
    .eq('id', userId);

  if (profileError) {
    throw new Error(`Failed to save avatar_path: ${profileError.message}`);
  }

  redirect(mePathWithSuccess('avatar'));
}
