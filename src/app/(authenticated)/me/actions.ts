'use server';

import { redirect } from 'next/navigation';

import { mePathWithError, mePathWithSuccess } from '@/shared/feedbackMessages';
import { createSupabaseAdminClient } from '@/shared/supabase/admin';
import { createSupabaseServerClient } from '@/shared/supabase/server';

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isStrongPassword(value: string): boolean {
  return value.length >= 8;
}

async function requireReauth(currentPassword: string): Promise<{
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  userId: string;
  email: string;
}> {
  const supabase = await createSupabaseServerClient();

  const { data: userData } = await supabase.auth.getUser();
  const email = userData.user?.email ?? null;
  const userId = userData.user?.id ?? null;

  if (!email || !userId) redirect('/login');

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password: currentPassword,
  });

  if (error) redirect(mePathWithError('bad_password'));

  return { supabase, userId, email };
}

export async function changeEmailAction(formData: FormData) {
  const newEmail = String(formData.get('newEmail') ?? '').trim();
  const password = String(formData.get('password') ?? '');

  if (!newEmail || !password) redirect(mePathWithError('missing'));
  if (!isValidEmail(newEmail)) redirect(mePathWithError('invalid_email'));

  const { supabase } = await requireReauth(password);

  const { error } = await supabase.auth.updateUser({ email: newEmail });

  if (error) redirect(mePathWithError('bad'));

  // Normalmente Supabase exige confirmación por email (según settings)
  redirect(mePathWithSuccess('email'));
}

export async function changePasswordAction(formData: FormData) {
  const currentPassword = String(formData.get('currentPassword') ?? '');
  const newPassword = String(formData.get('newPassword') ?? '');
  const confirm = String(formData.get('confirm') ?? '');

  if (!currentPassword || !newPassword || !confirm) redirect(mePathWithError('missing'));
  if (newPassword !== confirm) redirect(mePathWithError('password_mismatch'));
  if (!isStrongPassword(newPassword)) redirect(mePathWithError('weak_password'));

  const { supabase } = await requireReauth(currentPassword);

  const { error } = await supabase.auth.updateUser({ password: newPassword });

  if (error) redirect(mePathWithError('bad'));

  redirect(mePathWithSuccess('password'));
}

export async function changeAvatarAction(formData: FormData) {
  const password = String(formData.get('password') ?? '');
  const file = formData.get('avatar');

  if (!password) redirect(mePathWithError('missing'));
  if (!(file instanceof File)) redirect(mePathWithError('missing'));

  if (!file.type.startsWith('image/')) redirect(mePathWithError('bad_file'));
  if (file.size > 2_000_000) redirect(mePathWithError('file_too_large')); // 2MB

  const { userId } = await requireReauth(password);

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
