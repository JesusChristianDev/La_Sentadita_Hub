import { roleLabel } from '@/shared/roleLabel';

import { buildFrontendSessionView } from './buildFrontendSessionView';
import type { CurrentSession } from './getCurrentUserContext';

export type MePageViewModel = {
  accessStatusLabel: string;
  contextLabel: string;
  displayName: string;
  displayRole: string;
  email: string;
  employeeCode: string;
  securityStatus: string;
};

function getAccessStatusLabel(accessStatus: CurrentSession['backendSession']['person']['accessStatus']) {
  switch (accessStatus) {
    case 'active':
      return 'Activo';
    case 'pending_activation':
      return 'Pendiente de activacion';
    case 'blocked':
      return 'Bloqueado';
    case 'suspended':
      return 'Suspendido';
    case 'archived':
      return 'Archivado';
  }
}

export function buildMePageViewModel(ctx: CurrentSession): MePageViewModel {
  const frontendSession = buildFrontendSessionView(ctx);
  const accessStatusLabel = getAccessStatusLabel(frontendSession.person.accessStatus);

  return {
    accessStatusLabel,
    contextLabel: frontendSession.activeScope.label,
    displayName: ctx.person.full_name?.trim() || 'Cuenta',
    displayRole: roleLabel(frontendSession.person.systemRole),
    email: ctx.backendSession.person.email ?? '',
    employeeCode: String(ctx.person.employee_code),
    securityStatus:
      ctx.person.access_status === 'pending_activation'
        ? 'Activacion pendiente'
        : 'Correcta',
  };
}
