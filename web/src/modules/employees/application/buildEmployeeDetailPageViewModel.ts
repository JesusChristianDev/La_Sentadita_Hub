import 'server-only';

import type { CurrentSession } from '@/modules/auth_users';
import type { EditableEmploymentSystemRole } from '@/modules/employment';
import { can, deriveSystemRole } from '@/shared/authz';
import { loadEmployeeDetailPageProjection, loadRestaurantZonesMap } from '@/shared/db/employment';
import { roleLabel } from '@/shared/roleLabel';

type EmployeeRoleOption = {
  label: string;
  value: EditableEmploymentSystemRole;
};

type RestaurantOption = {
  id: string;
  name: string;
};

type ZoneOption = {
  id: string;
  name: string;
};

export type EmployeeDetailPageViewModel =
  | {
      backHref: '/employees';
      blockingReason: string;
      mode: 'global_profile_blocked' | 'not_found' | 'target_forbidden';
      title: string;
    }
  | {
      backHref: '/employees';
      form: {
        email: string;
        fieldLocks: {
          restaurant: boolean;
          role: boolean;
        };
        fullName: string;
        restaurantOptions: RestaurantOption[];
        roleOptions: EmployeeRoleOption[];
        selectedRestaurantId: string;
        selectedRole: EditableEmploymentSystemRole;
        selectedZoneId: string | null;
        zoneOptionsByRestaurant: Record<string, ZoneOption[]>;
      };
      mode: 'ready';
      status: {
        accessStatus: string;
        canArchive: boolean;
        canDeactivate: boolean;
        canReactivate: boolean;
        isActive: boolean;
      };
      summary: {
        roleLabel: string;
        title: string;
      };
    };

function buildRoleOptions(
  canChangeStructure: boolean,
  selectedRole: EditableEmploymentSystemRole,
): EmployeeRoleOption[] {
  if (!canChangeStructure) {
    return [
      {
        label: roleLabel(selectedRole),
        value: selectedRole,
      },
    ];
  }

  return [
    { label: 'Empleado', value: 'employee' },
    { label: 'Encargado de zona', value: 'area_lead' },
    { label: 'Gerente', value: 'manager' },
  ];
}

export async function buildEmployeeDetailPageViewModel(
  session: CurrentSession,
  personId: string,
): Promise<EmployeeDetailPageViewModel> {
  const detail = await loadEmployeeDetailPageProjection(personId).catch(() => null);
  const profile = detail?.profile ?? null;

  if (!profile) {
    return {
      backHref: '/employees',
      blockingReason: 'No se encontro el empleado solicitado.',
      mode: 'not_found',
      title: 'Empleado',
    };
  }

  const targetSystemRole = deriveSystemRole(profile);
  if (
    targetSystemRole === 'admin' ||
    targetSystemRole === 'owner' ||
    targetSystemRole === 'office'
  ) {
    return {
      backHref: '/employees',
      blockingReason: `Este usuario es ${roleLabel(targetSystemRole)} y se gestiona fuera del modulo Equipo.`,
      mode: 'global_profile_blocked',
      title: 'Usuario global',
    };
  }

  const canManageTarget = can(session.requestContext, 'employees.manage_target', {
    targetRestaurantId: profile.restaurant_id,
    targetSystemRole,
  });

  if (!canManageTarget) {
    return {
      backHref: '/employees',
      blockingReason:
        targetSystemRole === 'manager'
          ? 'Este gerente no puede gestionarse desde tu alcance actual.'
          : 'Este empleado no pertenece al alcance operativo actual.',
      mode: 'target_forbidden',
      title: 'Acceso restringido',
    };
  }

  const selectedRole =
    targetSystemRole === 'employee' ||
    targetSystemRole === 'area_lead' ||
    targetSystemRole === 'manager'
      ? targetSystemRole
      : 'employee';
  const canChangeStructure = session.requestContext.systemRole !== 'manager';
  const restaurantOptions = (
    canChangeStructure
      ? session.backendSession.visibleRestaurants.filter((restaurant) => restaurant.isActive)
      : session.backendSession.visibleRestaurants.filter(
          (restaurant) => restaurant.id === session.requestContext.effectiveRestaurantId,
        )
  ).map((restaurant) => ({
    id: restaurant.id,
    name: restaurant.name,
  }));

  const zoneOptionsByRestaurant = await loadRestaurantZonesMap(
    restaurantOptions.map((restaurant) => restaurant.id),
  );

  return {
    backHref: '/employees',
    form: {
      email: detail?.email ?? '',
      fieldLocks: {
        restaurant: !canChangeStructure,
        role: !canChangeStructure,
      },
      fullName: profile.full_name ?? '',
      restaurantOptions,
      roleOptions: buildRoleOptions(canChangeStructure, selectedRole),
      selectedRestaurantId:
        profile.restaurant_id ??
        restaurantOptions[0]?.id ??
        session.requestContext.effectiveRestaurantId ??
        '',
      selectedRole,
      selectedZoneId: profile.zone_id ?? null,
      zoneOptionsByRestaurant,
    },
    mode: 'ready',
    status: {
      accessStatus: profile.access_status,
      canArchive: true,
      canDeactivate: profile.access_status === 'active',
      canReactivate: profile.access_status !== 'active',
      isActive: profile.access_status === 'active',
    },
    summary: {
      roleLabel: roleLabel(targetSystemRole),
      title: 'Editar empleado',
    },
  };
}
