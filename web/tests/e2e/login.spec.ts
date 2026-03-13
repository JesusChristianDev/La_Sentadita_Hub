import { expect, test } from '@playwright/test';

test.describe('Login', () => {
  const loginErrorNotice = 'p.notice.error';

  test('muestra error missing al enviar vacio', async ({ page }) => {
    await page.goto('/login');

    await page.getByRole('button', { name: 'Entrar' }).click();

    await expect(page).toHaveURL(/\/login\?e=missing/);
    await expect(page.locator(loginErrorNotice)).toContainText(
      'Escribe tu email y contrasena para continuar.',
    );
  });

  test('muestra mensaje para credenciales invalidas', async ({ page }) => {
    await page.goto('/login?e=bad');

    await expect(page.locator(loginErrorNotice)).toContainText(
      'Email o contrasena incorrectos. Verifica tus datos e intenta de nuevo.',
    );
  });

  test('muestra mensaje para usuario desactivado', async ({ page }) => {
    await page.goto('/login?e=disabled');

    await expect(page.locator(loginErrorNotice)).toContainText(
      'Tu usuario esta desactivado. Contacta a tu manager o al equipo de oficina.',
    );
  });

  test('muestra estado pending al enviar', async ({ page }) => {
    await page.goto('/login');

    await page.getByRole('button', { name: 'Entrar' }).click();

    const submitButton = page.getByRole('button', { name: 'Entrando...' });
    await expect(submitButton).toBeDisabled();
    await expect(submitButton).toHaveAttribute('aria-busy', 'true');
  });
});
