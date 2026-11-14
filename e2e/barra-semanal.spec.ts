import { expect, test, type Page } from '@playwright/test';

// RF-79: a barra do hábito semanal só enche depois de marcar hoje.
// Relógio fixo em sábado, 14/11/2026 (a semana começa na segunda, dia 9).

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date(2026, 10, 14, 12, 0, 0));
});

const barra = (page: Page) => page.getByRole('region', { name: 'Hábitos do dia' }).locator('.barra').first();
const largura = async (page: Page) => (await barra(page).evaluate((el) => (el as HTMLElement).style.width)) || '0%';

async function habitoSemanalComUmaMarcacaoEm11(page: Page) {
  await page.goto('./');
  await page.getByLabel('Criar o hábito Treino').check();
  await page.getByRole('button', { name: 'Criar 1 hábito' }).click();
  await expect(page.getByText(/de 5 na semana/)).toBeVisible();
  // recua o início do hábito para os dias passados também o mostrarem
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const abrir = indexedDB.open('habit-tracker');
        abrir.onerror = () => reject(abrir.error);
        abrir.onsuccess = () => {
          const bd = abrir.result;
          const tx = bd.transaction(['habitos', 'versoes'], 'readwrite');
          for (const nome of ['habitos', 'versoes']) {
            tx.objectStore(nome).openCursor().onsuccess = (e) => {
              const cur = (e.target as IDBRequest<IDBCursorWithValue | null>).result;
              if (!cur) return;
              const v = cur.value;
              if (nome === 'versoes') v.vigenteDesde = '2020-01-01';
              else delete v.dataInicial;
              cur.update(v);
              cur.continue();
            };
          }
          tx.oncomplete = () => {
            bd.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
  );
  await page.reload();

  // marca quarta-feira, dia 11 (dia passado: precisa reabrir)
  const faixa = page.getByRole('group', { name: 'Últimos 7 dias' });
  await faixa.getByRole('button').nth(3).click();
  await page.getByRole('button', { name: 'Reabrir dia' }).first().click();
  await page.getByRole('button', { name: /Treino: pendente/ }).click();
  await expect(page.getByText('1 de 5 na semana')).toBeVisible();
  await page.getByRole('button', { name: 'Voltar para hoje' }).click();
  return faixa;
}

test('T-79c: hoje não marcado tem barra vazia; marcar enche; desmarcar esvazia', async ({ page }) => {
  await habitoSemanalComUmaMarcacaoEm11(page);

  await expect(page.getByText('1 de 5 na semana')).toBeVisible();
  await expect.poll(() => largura(page)).toBe('0%');

  await page.getByRole('button', { name: /Treino: pendente/ }).click();
  await expect(page.getByText('2 de 5 na semana')).toBeVisible();
  await expect.poll(() => largura(page)).toBe('40%');
  await expect(page.getByText(/hoje feito/)).toHaveCount(0);

  await page.getByRole('button', { name: /Treino: feito/ }).click();
  await expect(page.getByText('1 de 5 na semana')).toBeVisible();
  await expect.poll(() => largura(page)).toBe('0%');
});

test('T-79d: dia passado mostra a barra da semana normalmente', async ({ page }) => {
  const faixa = await habitoSemanalComUmaMarcacaoEm11(page);

  // quinta, dia 12: não marcado nesse dia, mas a semana já tem 1 → barra com 1 de 5
  await faixa.getByRole('button').nth(4).click();
  await expect(page.getByText('1 de 5 na semana')).toBeVisible();
  await expect.poll(() => largura(page)).toBe('20%');
  await expect(page.getByText(/feito neste dia/)).toHaveCount(0);

  // terça, dia 10: a contagem é a da semana inteira (como já era), então também 1 de 5
  await faixa.getByRole('button').nth(2).click();
  await expect(page.getByText('1 de 5 na semana')).toBeVisible();
  await expect.poll(() => largura(page)).toBe('20%');
});
