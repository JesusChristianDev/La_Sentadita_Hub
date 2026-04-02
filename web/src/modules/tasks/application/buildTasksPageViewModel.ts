import 'server-only';

import { buildFrontendSessionView, type CurrentSession, type FrontendPageMode } from '@/modules/auth_users';

import type { TaskInstanceRecord } from '../domain/taskTypes';
import { listTaskInstances } from './taskService';

export type TasksPageViewModel = {
  canManage: boolean;
  initialTasks: TaskInstanceRecord[];
  mode: Extract<
    FrontendPageMode,
    'context_required' | 'forbidden' | 'restaurant_workspace' | 'self_service' | 'zone_workspace'
  >;
  restaurantId: string | null;
};

function resolveMode(session: CurrentSession): TasksPageViewModel['mode'] {
  const frontendSession = buildFrontendSessionView(session);

  if (!frontendSession.capabilities.tasks.view) {
    return 'forbidden';
  }

  if (!frontendSession.effectiveRestaurantId) {
    return 'context_required';
  }

  if (!frontendSession.capabilities.tasks.manage) {
    return 'self_service';
  }

  if (session.requestContext.systemRole === 'area_lead') {
    return 'zone_workspace';
  }

  return 'restaurant_workspace';
}

export async function buildTasksPageViewModel(
  session: CurrentSession,
): Promise<TasksPageViewModel> {
  const frontendSession = buildFrontendSessionView(session);
  const mode = resolveMode(session);

  if (mode === 'forbidden' || mode === 'context_required') {
    return {
      canManage: false,
      initialTasks: [],
      mode,
      restaurantId: frontendSession.effectiveRestaurantId,
    };
  }

  const today = new Date().toISOString().split('T')[0];
  const initialTasks = await listTaskInstances(frontendSession.effectiveRestaurantId!, today);

  return {
    canManage: frontendSession.capabilities.tasks.manage,
    initialTasks,
    mode,
    restaurantId: frontendSession.effectiveRestaurantId,
  };
}
