import { redirect } from 'next/navigation';

import type { PersonProfile } from '@/modules/people';
import {
  buildRequestContextFromProfile,
  type RequestContext,
} from '@/shared/authz';

import type { BackendSession } from '../domain/backendSession';
import {
  loadBackendSession,
  projectPersonProfileFromBackendSession,
} from '../infrastructure/backendSessionRepository';

export type CurrentSession = {
  backendSession: BackendSession;
  person: PersonProfile;
  profile: PersonProfile;
  requestContext: RequestContext;
  userId: string;
};

export type UserContext = CurrentSession;

function buildCurrentSession(params: {
  backendSession: BackendSession;
  person: PersonProfile;
  requestContext: RequestContext;
  userId: string;
}): CurrentSession {
  return {
    backendSession: params.backendSession,
    person: params.person,
    profile: params.person,
    requestContext: params.requestContext,
    userId: params.userId,
  };
}

export async function getCurrentUserContext(): Promise<UserContext | null> {
  const backendSession = await loadBackendSession();
  if (!backendSession) return null;

  if (backendSession.person.accessStatus !== 'active') {
    redirect('/api/auth/signout?next=/login?e=disabled');
  }

  const person = projectPersonProfileFromBackendSession(backendSession);

  return buildCurrentSession({
    backendSession,
    person,
    requestContext: buildRequestContextFromProfile(
      person,
      backendSession.effectiveRestaurantId,
      backendSession.activeScope,
    ),
    userId: backendSession.userId,
  });
}
