import { expect, type Page, test } from '@playwright/test';

import { hasAuthCredentials, loginAsConfiguredUser } from './helpers/auth';

async function ensureActiveRestaurant(page: Page) {
  const restaurantSelect = page.locator('header select[name="restaurantId"]');
  if (!(await restaurantSelect.count())) return false;

  const enabledOptionValues = await restaurantSelect.locator('option:not([disabled])').evaluateAll(
    (options) =>
      options.map((option) => (option as HTMLOptionElement).value).filter(Boolean),
  );
  if (!enabledOptionValues.length) return false;

  const currentValue = await restaurantSelect.inputValue();
  if (currentValue) return true;

  await restaurantSelect.selectOption(enabledOptionValues[0]);
  await page.locator('header form').getByRole('button', { name: 'Aplicar' }).click();
  return true;
}

test.describe('Authenticated flow', () => {
  test.describe.configure({ mode: 'serial' });

  test.skip(
    !hasAuthCredentials(),
    'Set E2E_LOGIN_EMAIL and E2E_LOGIN_PASSWORD to run authenticated E2E tests.',
  );

  test.beforeEach(async ({ page }) => {
    await loginAsConfiguredUser(page);
  });

  test('abre /employees y /me sin perder sesion', async ({ page }) => {
    await page.goto('/employees');
    await expect(page).toHaveURL(/\/employees/);
    await expect(page.getByRole('heading', { name: 'Equipo', exact: true })).toBeVisible();

    await page.goto('/me');
    await expect(page).toHaveURL(/\/me/);
    await expect(page.getByRole('heading', { name: 'Resumen de cuenta' })).toBeVisible();
  });

  test('cambiar sucursal mantiene la vista cuando el rol lo permite', async ({
    page,
  }) => {
    await page.goto('/employees');
    await expect(page.getByRole('heading', { name: 'Equipo', exact: true })).toBeVisible();

    const restaurantSelect = page.locator('header select[name="restaurantId"]');
    if (!(await restaurantSelect.count())) {
      test.skip(true, 'El usuario autenticado no puede cambiar sucursal.');
    }

    await ensureActiveRestaurant(page);

    const enabledOptionValues = await restaurantSelect
      .locator('option:not([disabled])')
      .evaluateAll((options) =>
        options.map((option) => (option as HTMLOptionElement).value).filter(Boolean),
      );

    if (enabledOptionValues.length < 2) {
      test.skip(true, 'Se necesitan al menos dos sucursales activas para este test.');
    }

    const currentValue = await restaurantSelect.inputValue();
    const targetValue = enabledOptionValues.find((value) => value !== currentValue);
    if (!targetValue) {
      test.skip(true, 'No hay otra sucursal para cambiar en este entorno.');
      return;
    }

    await restaurantSelect.selectOption(targetValue);
    await page.locator('header form').getByRole('button', { name: 'Aplicar' }).click();

    await expect(page).toHaveURL(/\/employees/);
    await expect(page.getByRole('heading', { name: 'Equipo', exact: true })).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Selecciona una sucursal para desbloquear equipo.' }),
    ).toHaveCount(0);
  });

  test('cerrar sesion bloquea rutas privadas', async ({ page }) => {
    await page.goto('/app');
    await expect(page.getByRole('heading', { name: 'Panel principal', exact: true })).toBeVisible();

    await page
      .locator('header')
      .getByRole('button', { name: /Abrir menu de cuenta|Cerrar menu de cuenta/i })
      .click();
    const logoutLink = page.locator('header').getByRole('link', { name: /Cerrar sesion/i });
    await expect(logoutLink).toBeVisible();
    await logoutLink.click();

    await expect(page).toHaveURL(/\/login/);

    await page.goto('/app');
    await expect(page).toHaveURL(/\/login/);
  });
});
