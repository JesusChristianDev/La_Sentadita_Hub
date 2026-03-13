import { type Page, test } from '@playwright/test';

import { type E2EAuthRole, hasAuthCredentials, loginAsRole } from './helpers/auth';
import {
  expectEmployeeSchedulesShell,
  expectManagerSchedulesShell,
  expectOnSchedulesRoute,
} from './helpers/schedules';

async function openSchedulesModule(page: Page): Promise<void> {
  await page.goto('/horarios');
  await expectOnSchedulesRoute(page);
}

function requireRoleCredentials(role: Exclude<E2EAuthRole, 'default'>): void {
  const envByRole: Record<Exclude<E2EAuthRole, 'default'>, string> = {
    admin: 'E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD',
    employee: 'E2E_EMPLOYEE_EMAIL/E2E_EMPLOYEE_PASSWORD',
    manager: 'E2E_MANAGER_EMAIL/E2E_MANAGER_PASSWORD',
    office: 'E2E_OFFICE_EMAIL/E2E_OFFICE_PASSWORD',
    sub_manager: 'E2E_SUB_MANAGER_EMAIL/E2E_SUB_MANAGER_PASSWORD',
  };

  test.skip(
    !hasAuthCredentials(role),
    `Set ${envByRole[role]} to run the ${role} /horarios E2E checks.`,
  );
}

test.describe('/horarios route behavior', () => {
  test('employee renderiza la vista base del modulo si existe el fixture', async ({
    page,
  }) => {
    requireRoleCredentials('employee');

    await loginAsRole(page, 'employee');
    await openSchedulesModule(page);
    await expectEmployeeSchedulesShell(page);
  });

  test('manager renderiza la home base del modulo si existe el fixture', async ({
    page,
  }) => {
    requireRoleCredentials('manager');

    await loginAsRole(page, 'manager');
    await openSchedulesModule(page);
    await expectManagerSchedulesShell(page);
  });
});
