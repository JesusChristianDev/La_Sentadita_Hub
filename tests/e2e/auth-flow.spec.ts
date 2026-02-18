import { expect, test } from '@playwright/test';

import { hasAuthCredentials, loginAsConfiguredUser } from './helpers/auth';

test.describe('Authenticated flow', () => {
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
    await expect(page.getByRole('heading', { name: 'Equipo' })).toBeVisible();

    await page.goto('/me');
    await expect(page).toHaveURL(/\/me/);
    await expect(page.getByRole('heading', { name: 'Mi perfil' })).toBeVisible();
  });

  test('cambiar sucursal mantiene la vista cuando el rol lo permite', async ({
    page,
  }) => {
    await page.goto('/employees');
    await expect(page.getByRole('heading', { name: 'Equipo' })).toBeVisible();

    const restaurantSelect = page.locator(
      'form.header-restaurant-form select[name="restaurantId"]',
    );
    if (!(await restaurantSelect.isVisible())) {
      test.skip(true, 'El usuario autenticado no puede cambiar sucursal.');
    }

    const enabledOptionValues = await restaurantSelect
      .locator('option:not([disabled])')
      .evaluateAll((options) =>
        options
          .map((option) => (option as HTMLOptionElement).value)
          .filter(Boolean),
      );

    if (enabledOptionValues.length < 2) {
      test.skip(true, 'Se necesitan al menos dos sucursales activas para este test.');
    }

    const currentValue = await restaurantSelect.inputValue();
    const targetValue = enabledOptionValues.find((value) => value !== currentValue);
    if (!targetValue) {
      test.skip(true, 'No hay otra sucursal para cambiar en este entorno.');
    }

    await restaurantSelect.selectOption(targetValue);
    await page.locator('form.header-restaurant-form button[type="submit"]').click();

    await expect(page).toHaveURL(/\/employees/);
    await expect(page.getByRole('heading', { name: 'Equipo' })).toBeVisible();
  });

  test('cerrar sesion bloquea rutas privadas', async ({ page }) => {
    await page.goto('/app');
    await expect(page.getByRole('heading', { name: 'Panel principal' })).toBeVisible();

    await page.locator('summary.header-avatar').click();
    const logoutButton = page.locator(
      '.header-popover form[action="/api/auth/signout"] button[type="submit"]',
    );
    await expect(logoutButton).toBeVisible();
    await logoutButton.click();

    await expect(page).toHaveURL(/\/login/);

    await page.goto('/app');
    await expect(page).toHaveURL(/\/login/);
  });
});
