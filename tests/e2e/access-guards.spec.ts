import { expect, test } from '@playwright/test';

test.describe('Access guards (sin sesion)', () => {
  test('redirecciona /app a /login', async ({ page }) => {
    await page.goto('/app');
    await expect(page).toHaveURL(/\/login/);
  });

  test('redirecciona /employees a /login', async ({ page }) => {
    await page.goto('/employees');
    await expect(page).toHaveURL(/\/login/);
  });

  test('redirecciona /me a /login', async ({ page }) => {
    await page.goto('/me');
    await expect(page).toHaveURL(/\/login/);
  });
});
