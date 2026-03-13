import { expect, type Page } from '@playwright/test';

export type E2EAuthRole =
  | 'admin'
  | 'default'
  | 'employee'
  | 'manager'
  | 'office'
  | 'sub_manager';

type Credentials = {
  email: string;
  password: string;
};

const AUTH_ENV_BY_ROLE: Record<
  Exclude<E2EAuthRole, 'default'>,
  { email: string; password: string }
> = {
  admin: {
    email: 'E2E_ADMIN_EMAIL',
    password: 'E2E_ADMIN_PASSWORD',
  },
  employee: {
    email: 'E2E_EMPLOYEE_EMAIL',
    password: 'E2E_EMPLOYEE_PASSWORD',
  },
  manager: {
    email: 'E2E_MANAGER_EMAIL',
    password: 'E2E_MANAGER_PASSWORD',
  },
  office: {
    email: 'E2E_OFFICE_EMAIL',
    password: 'E2E_OFFICE_PASSWORD',
  },
  sub_manager: {
    email: 'E2E_SUB_MANAGER_EMAIL',
    password: 'E2E_SUB_MANAGER_PASSWORD',
  },
};

function readCredentials(emailVar: string, passwordVar: string): Credentials | null {
  const email = process.env[emailVar]?.trim() ?? '';
  const password = process.env[passwordVar] ?? '';

  return email && password ? { email, password } : null;
}

function getCredentials(role: E2EAuthRole = 'default'): Credentials | null {
  if (role === 'default') {
    return readCredentials('E2E_LOGIN_EMAIL', 'E2E_LOGIN_PASSWORD');
  }

  const envNames = AUTH_ENV_BY_ROLE[role];
  return readCredentials(envNames.email, envNames.password);
}

export function hasAuthCredentials(role: E2EAuthRole = 'default'): boolean {
  return Boolean(getCredentials(role));
}

export async function loginAsConfiguredUser(page: Page): Promise<void> {
  if (!hasAuthCredentials('default')) {
    throw new Error(
      'Missing E2E credentials: set E2E_LOGIN_EMAIL and E2E_LOGIN_PASSWORD.',
    );
  }

  await loginWithCredentials(page, getCredentials('default')!);
}

export async function loginAsRole(page: Page, role: Exclude<E2EAuthRole, 'default'>) {
  const credentials = getCredentials(role);
  if (!credentials) {
    const envNames = AUTH_ENV_BY_ROLE[role];
    throw new Error(
      `Missing E2E credentials for ${role}: set ${envNames.email} and ${envNames.password}.`,
    );
  }

  await loginWithCredentials(page, credentials);
}

async function loginWithCredentials(page: Page, credentials: Credentials): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email').fill(credentials.email);
  await page.locator('input#password[name="password"]').fill(credentials.password);
  await page.getByRole('button', { name: 'Entrar' }).click();

  await expect(page).toHaveURL(/\/app/);
  await expect(page.getByRole('heading', { name: 'Panel principal' })).toBeVisible();
}
