import { redirect } from 'next/navigation';

import {
  buildRequestContextFromProfile,
  type RequestContext,
} from '@/modules/authz';
import type { PersonProfile } from '@/modules/people';
import { loadPersonProfileByIdWithClient } from '@/shared/db/persons';
import { createSupabaseServerClient } from '@/shared/supabase/server';

import { getEffectiveRestaurantId } from './getEffectiveRestaurantId';

export type CurrentSession = {
  person: PersonProfile;
  profile: PersonProfile;
  requestContext: RequestContext;
  userId: string;
};

export type UserContext = CurrentSession;

function buildCurrentSession(params: {
  person: PersonProfile;
  requestContext: RequestContext;
  userId: string;
}): CurrentSession {
  return {
    person: params.person,
    profile: params.person,
    requestContext: params.requestContext,
    userId: params.userId,
  };
}

export async function getCurrentUserContext(): Promise<UserContext | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) return null;

  const person = await loadPersonProfileByIdWithClient(supabase, data.user.id);

  if (person.is_archived || person.is_active === false) {
    redirect('/api/auth/signout?next=/login?e=disabled');
  }

  const effectiveRestaurantId = await getEffectiveRestaurantId(person);

  return buildCurrentSession({
    person,
    requestContext: buildRequestContextFromProfile(person, effectiveRestaurantId),
    userId: data.user.id,
  });
}
