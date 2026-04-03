import 'server-only';

import { buildFrontendSessionView, type CurrentSession } from '@/modules/auth_users';

import { type RequestRecord } from '../domain/requestTypes';
import { listMyRequests, listRestaurantRequests } from './requestService';

export type RequestsPageViewModel = {
  currentEmploymentId: string | null;
  currentRestaurantId: string | null;
  mode:
    | 'forbidden'
    | 'context_required'
    | 'self_service'
    | 'team_workspace'
    | 'team_scope_overview';
  myRequests: RequestRecord[];
  teamRequests: RequestRecord[];
};

export async function buildRequestsPageViewModel(
  session: CurrentSession,
): Promise<RequestsPageViewModel> {
  const frontendSession = buildFrontendSessionView(session);

  if (!frontendSession.capabilities.requests.view) {
    return {
      currentEmploymentId: null,
      currentRestaurantId: null,
      mode: 'forbidden',
      myRequests: [],
      teamRequests: [],
    };
  }

  const myRequests = await listMyRequests();
  const currentEmploymentId = session.backendSession.currentEmployment?.employmentId ?? null;
  const currentRestaurantId = frontendSession.effectiveRestaurantId;

  if (!frontendSession.capabilities.requests.manage) {
    return {
      currentEmploymentId,
      currentRestaurantId,
      mode: 'self_service',
      myRequests,
      teamRequests: [],
    };
  }

  if (!currentRestaurantId) {
    if (frontendSession.capabilities.context.isGlobalScope) {
      return {
        currentEmploymentId,
        currentRestaurantId: null,
        mode: 'team_scope_overview',
        myRequests,
        teamRequests: [],
      };
    }

    return {
      currentEmploymentId,
      currentRestaurantId: null,
      mode: 'context_required',
      myRequests,
      teamRequests: [],
    };
  }

  const teamRequests = await listRestaurantRequests(currentRestaurantId);

  return {
    currentEmploymentId,
    currentRestaurantId,
    mode: 'team_workspace',
    myRequests,
    teamRequests,
  };
}
