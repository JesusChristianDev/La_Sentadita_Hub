import { expect, type Page } from '@playwright/test';

const E2E_LOGIN_EMAIL = process.env.E2E_LOGIN_EMAIL?.trim() ?? '';
const E2E_LOGIN_PASSWORD = process.env.E2E_LOGIN_PASSWORD ?? '';

export function hasAuthCredentials(): boolean {
  return Boolean(E2E_LOGIN_EMAIL && E2E_LOGIN_PASSWORD);
}

export async function loginAsConfiguredUser(page: Page): Promise<void> {
  if (!hasAuthCredentials()) {
    throw new Error(
      'Missing E2E credentials: set E2E_LOGIN_EMAIL and E2E_LOGIN_PASSWORD.',
    );
  }

  await page.goto('/login');
  await page.getByLabel('Email').fill(E2E_LOGIN_EMAIL);
  await page.locator('input#password[name="password"]').fill(E2E_LOGIN_PASSWORD);
  await page.getByRole('button', { name: 'Entrar' }).click();

  await expect(page).toHaveURL(/\/app/);
  await expect(page.getByRole('heading', { name: 'Panel principal' })).toBeVisible();
}
