import { redirect } from 'next/navigation';

import {
  buildRequestContextFromProfile,
  type RequestContext,
} from '@/modules/authz';
import type { Profile } from '@/modules/people';
import {
  isPersonAccessAllowed,
  loadPersonProfileByIdWithClient,
  loadRestaurantChainIdByIdWithClient,
} from '@/shared/db/persons';
import { createSupabaseServerClient } from '@/shared/supabase/server';

import { getEffectiveRestaurantId } from './getEffectiveRestaurantId';

export type CurrentSession = {
  person: Profile;
  profile: Profile;
  requestContext: RequestContext;
  userId: string;
};

export type UserContext = CurrentSession;

function buildCurrentSession(params: {
  person: Profile;
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

  if (!isPersonAccessAllowed(person.access_status)) {
    redirect('/api/auth/signout?next=/login?e=disabled');
  }

  const effectiveRestaurantId = await getEffectiveRestaurantId(person);
  const enrichedPerson =
    !person.chain_id && effectiveRestaurantId
      ? {
          ...person,
          chain_id: await loadRestaurantChainIdByIdWithClient(supabase, effectiveRestaurantId),
        }
      : person;

  return buildCurrentSession({
    person: enrichedPerson,
    requestContext: buildRequestContextFromProfile(enrichedPerson, effectiveRestaurantId),
    userId: data.user.id,
  });
}
