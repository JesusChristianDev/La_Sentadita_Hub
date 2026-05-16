import type { SystemRole } from '@/shared/authz';

type DraftScopeContext = {
  systemRole: SystemRole;
  zoneId: string | null;
};

type ScopedEmployee = {
  id: string;
  zone_id: string | null;
};

export function filterEmployeesForDraftScope<T extends ScopedEmployee>(
  ctx: DraftScopeContext,
  employees: T[],
): T[] {
  if (ctx.systemRole !== 'area_lead' || !ctx.zoneId) {
    return employees;
  }

  return employees.filter((employee) => employee.zone_id === ctx.zoneId);
}
