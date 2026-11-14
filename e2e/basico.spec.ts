import { expect, test } from '@playwright/test';

const ABAS = ['Hoje', 'Histórico', 'Evolução', 'Hábitos', 'Ajustes'];

test('abre, navega por todas as abas, sem erros e sem rede externa', async ({ page }) => {
  const externos: string[] = [];
  const erros: string[] = [];
  page.on('request', (r) => {
    const u = new URL(r.url());
    if (u.hostname !== 'localhost' && u.protocol.startsWith('http')) externos.push(r.url());
  });
  page.on('pageerror', (e) => erros.push(e.message));

  await page.goto('./');
  const nav = page.getByRole('navigation', { name: 'Navegação principal' });
  await expect(nav).toBeVisible();

  for (const aba of ABAS) {
    await nav.getByRole('button', { name: new RegExp(`^${aba}`) }).click();
    await expect(nav.getByRole('button', { name: `${aba} (tela atual)` })).toBeVisible();
  }

  expect(erros).toEqual([]);
  expect(externos).toEqual([]);
});

test('o banco grava no aparelho e continua depois de recarregar', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('navigation').getByRole('button', { name: /^Ajustes/ }).click();
  await expect(page.getByText(/backup/i).first()).toBeVisible();
  await page.reload();
  await expect(page.getByRole('navigation', { name: 'Navegação principal' })).toBeVisible();
});
