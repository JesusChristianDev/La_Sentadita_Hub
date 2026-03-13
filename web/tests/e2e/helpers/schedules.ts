import { expect, type Locator, type Page } from '@playwright/test';

function desktopSchedulesLink(page: Page): Locator {
  return page
    .getByRole('navigation', { name: 'Navegacion principal de pantallas' })
    .getByRole('link', { name: 'Horarios' });
}

function mobileSchedulesLink(page: Page): Locator {
  return page
    .getByRole('navigation', { name: 'Navegacion operativa' })
    .getByRole('link', { name: 'Horarios' });
}

export async function expectOnSchedulesRoute(page: Page): Promise<void> {
  await expect(page).toHaveURL(/\/horarios(?:\?.*)?$/);

  const desktopLink = desktopSchedulesLink(page);
  if ((await desktopLink.count()) > 0) {
    await expect(desktopLink).toBeVisible();
    await expect(desktopLink).toHaveAttribute('aria-current', 'page');
    return;
  }

  const mobileLink = mobileSchedulesLink(page);
  await expect(mobileLink).toBeVisible();
  await expect(mobileLink).toHaveAttribute('aria-current', 'page');
}

export async function expectManagerSchedulesShell(page: Page): Promise<void> {
  await expect(page.getByRole('heading', { level: 1, name: 'Horarios' })).toBeVisible();
  await expect(page.getByText('Centro operativo del horario semanal.')).toBeVisible();
  await expect(
    page.getByRole('button', { name: /Crear semana|Abrir semana/ }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { level: 2, name: 'Herramientas relacionadas' }),
  ).toBeVisible();
}

export async function expectEmployeeSchedulesShell(page: Page): Promise<void> {
  await expect(page.getByRole('heading', { level: 1, name: 'Mi horario' })).toBeVisible();
  await expect(page.getByText(/Vista publicada para/i)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Historial' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Semana actual' })).toBeVisible();
}
