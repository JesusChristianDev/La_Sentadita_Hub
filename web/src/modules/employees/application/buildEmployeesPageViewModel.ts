import 'server-only';

import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import {
  buildFrontendSessionView,
  type CurrentSession,
} from '@/modules/auth_users';
import type { EmploymentStatusFilter } from '@/modules/employment';
import type { RestaurantZoneSummary } from '@/modules/employment/infrastructure/employmentRepository';
import { loadEmployeesPageProjection } from '@/shared/db/employment';
import { roleLabel } from '@/shared/roleLabel';

type EmployeeRoleOption = {
  description: string;
  label: string;
  value: 'employee' | 'area_lead' | 'manager';
};

export type EmployeesListPageViewModel = {
  context: {
    canChangeContext: boolean;
    restaurantId: string | null;
  };
  createForm: null | {
    allowedRoles: EmployeeRoleOption[];
    defaultRole: 'employee';
    restaurantId: string;
    zoneOptions: RestaurantZoneSummary[];
  };
  emptyState: {
    description: string;
    title: string;
  };
  filters: {
    currentStatus: EmploymentStatusFilter;
  };
  mode:
    | 'forbidden'
    | 'context_required'
    | 'organization_overview'
    | 'company_overview'
    | 'ready';
  rows: Array<{
    avatarUrl: string | null;
    fullName: string;
    href: string;
    id: string;
    roleLabel: string;
  }>;
};

function buildAllowedRoles(session: CurrentSession): EmployeeRoleOption[] {
  const options: EmployeeRoleOption[] = [
    {
      description: 'Operacion diaria en un unico restaurante activo.',
      label: 'Empleado',
      value: 'employee',
    },
    {
      description: 'Responsable de una zona concreta del restaurante.',
      label: 'Encargado de zona',
      value: 'area_lead',
    },
  ];

  if (session.backendSession.person.systemRole !== 'manager') {
    options.push({
      description: 'Gestion operativa completa del restaurante.',
      label: 'Gerente',
      value: 'manager',
    });
  }

  return options;
}

function buildEmptyState(status: EmploymentStatusFilter) {
  switch (status) {
    case 'inactive':
      return {
        description: 'No hay empleados inactivos en este restaurante.',
        title: 'Sin empleados inactivos',
      };
    case 'all':
      return {
        description: 'Aun no hay empleados cargados para este restaurante.',
        title: 'Sin empleados registrados',
      };
    default:
      return {
        description: 'No hay empleados activos para este restaurante.',
        title: 'Sin empleados activos',
      };
  }
}

async function signAvatarUrls(
  avatarPaths: string[],
): Promise<Map<string, string>> {
  const admin = createSupabaseAdminClient();
  const signedUrls = new Map<string, string>();

  await Promise.all(
    avatarPaths.map(async (path) => {
      const { data } = await admin.storage.from('avatars').createSignedUrl(path, 60 * 60);
      if (data?.signedUrl) {
        signedUrls.set(path, data.signedUrl);
      }
    }),
  );

  return signedUrls;
}

export async function buildEmployeesPageViewModel(
  session: CurrentSession,
  status: EmploymentStatusFilter,
): Promise<EmployeesListPageViewModel> {
  const frontendSession = buildFrontendSessionView(session);
  const emptyState = buildEmptyState(status);

  if (!frontendSession.capabilities.employees.view) {
    return {
      context: {
        canChangeContext: frontendSession.capabilities.context.canSelectScope,
        restaurantId: frontendSession.effectiveRestaurantId,
      },
      createForm: null,
      emptyState,
      filters: { currentStatus: status },
      mode: 'forbidden',
      rows: [],
    };
  }

  if (!frontendSession.effectiveRestaurantId) {
    if (frontendSession.capabilities.context.isGlobalScope) {
      return {
        context: {
          canChangeContext: frontendSession.capabilities.context.canSelectScope,
          restaurantId: null,
        },
        createForm: null,
        emptyState: {
          description:
            'Vista agregada por organizacion/empresa aun sin datos. Selecciona un restaurante si necesitas bajar al detalle.',
          title: 'Vista global de empleados',
        },
        filters: { currentStatus: status },
        mode: frontendSession.capabilities.context.isCompanyScope
          ? 'company_overview'
          : 'organization_overview',
        rows: [],
      };
    }

    return {
      context: {
        canChangeContext: frontendSession.capabilities.context.canSelectScope,
        restaurantId: null,
      },
      createForm: null,
      emptyState,
      filters: { currentStatus: status },
      mode: 'context_required',
      rows: [],
    };
  }

  const projection = await loadEmployeesPageProjection(
    frontendSession.effectiveRestaurantId,
    status,
  );
  const avatarUrlByPath = await signAvatarUrls(
    [
      ...new Set(
        projection.employees
          .map((employee) => employee.avatar_path)
          .filter((path): path is string => Boolean(path)),
      ),
    ],
  );

  return {
    context: {
      canChangeContext: frontendSession.capabilities.context.canSelectRestaurant,
      restaurantId: frontendSession.effectiveRestaurantId,
    },
    createForm: frontendSession.capabilities.employees.create
      ? {
          allowedRoles: buildAllowedRoles(session),
          defaultRole: 'employee',
          restaurantId: frontendSession.effectiveRestaurantId,
          zoneOptions: projection.restaurantZones,
        }
      : null,
    emptyState,
    filters: {
      currentStatus: status,
    },
    mode: 'ready',
    rows: projection.employees.map((employee) => ({
      avatarUrl: employee.avatar_path
        ? (avatarUrlByPath.get(employee.avatar_path) ?? null)
        : null,
      fullName: employee.full_name || '(sin nombre)',
      href: `/employees/${employee.id}`,
      id: employee.id,
      roleLabel: roleLabel(employee.system_role),
    })),
  };
}
