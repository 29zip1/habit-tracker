import { expect, test, type Page } from '@playwright/test';

// RF-75 (dia fechado travado), RF-76 (Como instalar rola) e RF-77 (sem itens de teste em Ajustes).

async function comUmHabito(page: Page) {
  await page.goto('./');
  await page.getByLabel('Criar o hábito Cardio').check();
  await page.getByRole('button', { name: 'Criar 1 hábito' }).click();
  await expect(page.getByRole('button', { name: /Adicionar 10 min em Cardio/ })).toBeVisible();
  // O hábito novo só vale a partir de hoje; recua o início para os dias passados também o mostrarem.
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const abrir = indexedDB.open('habit-tracker');
        abrir.onerror = () => reject(abrir.error);
        abrir.onsuccess = () => {
          const bd = abrir.result;
          const tx = bd.transaction(['habitos', 'versoes'], 'readwrite');
          for (const nome of ['habitos', 'versoes']) {
            const loja = tx.objectStore(nome);
            loja.openCursor().onsuccess = (e) => {
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
  await expect(page.getByRole('button', { name: /Adicionar 10 min em Cardio/ })).toBeVisible();
}

const somar10 = (page: Page) => page.getByRole('button', { name: /Adicionar 10 min em Cardio/ });

test('RF-75: dia passado abre travado, reabre, e trava de novo ao sair', async ({ page }) => {
  await comUmHabito(page);

  const faixa = page.getByRole('group', { name: 'Últimos 7 dias' });
  await faixa.getByRole('button').first().click(); // 6 dias atrás

  // T-75c: travado
  await expect(page.getByText('Dia fechado. Para editar, toque em Reabrir dia.')).toBeVisible();
  await expect(somar10(page)).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Dia de folga' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Nota do dia' })).toBeDisabled();

  // T-75d: reabrir
  await page.getByRole('button', { name: 'Reabrir dia' }).first().click();
  await expect(page.getByText(/Editando/)).toBeVisible();
  await expect(somar10(page)).toBeEnabled();
  await somar10(page).click();
  await expect(page.getByText('Cardio +10 min').first()).toBeVisible();

  // Finalizar trava de novo
  await page.getByRole('button', { name: 'Finalizar dia' }).click();
  await expect(somar10(page)).toBeDisabled();

  // T-75d2: reabrir e sair da tela (trocar de aba) trava de novo
  await page.getByRole('button', { name: 'Reabrir dia' }).first().click();
  await expect(somar10(page)).toBeEnabled();
  const nav = page.getByRole('navigation', { name: 'Navegação principal' });
  await nav.getByRole('button', { name: /^Ajustes/ }).click();
  await nav.getByRole('button', { name: /^Hoje/ }).click();
  await expect(somar10(page)).toBeEnabled(); // voltou para HOJE (aberto)
  await faixa.getByRole('button').first().click();
  await expect(page.getByText('Dia fechado. Para editar, toque em Reabrir dia.')).toBeVisible();
  await expect(somar10(page)).toBeDisabled();

  // Reabrir e escolher outro dia, depois voltar: travado
  await page.getByRole('button', { name: 'Reabrir dia' }).first().click();
  await expect(somar10(page)).toBeEnabled();
  await faixa.getByRole('button').nth(1).click();
  await faixa.getByRole('button').first().click();
  await expect(somar10(page)).toBeDisabled();
});

test('RF-75: hoje finalizado trava e só reabre pelo botão', async ({ page }) => {
  await comUmHabito(page);
  await somar10(page).click();
  await page.getByRole('button', { name: 'Finalizar dia' }).click();
  await expect(page.getByText('Dia fechado. Para editar, toque em Reabrir dia.')).toBeVisible();
  await expect(somar10(page)).toBeDisabled();
  await page.reload();
  await expect(somar10(page)).toBeDisabled(); // continua travado depois de fechar e abrir
  await page.getByRole('button', { name: 'Reabrir dia' }).first().click();
  await expect(somar10(page)).toBeEnabled();
});

test('RF-76 e RF-77: Ajustes rola até Como instalar e não tem itens de teste', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('navigation').getByRole('button', { name: /^Ajustes/ }).click();

  // T-77a
  await expect(page.getByText('Dado de teste')).toHaveCount(0);
  await expect(page.getByText('Teste de salvar arquivo')).toHaveCount(0);

  // T-76a: a lista fica visível na tela depois do toque
  const passos = page.getByText('Abra este endereço no');
  await page.getByRole('button', { name: 'Como instalar no iPhone' }).click();
  await expect(passos).toBeInViewport({ ratio: 0.9 });
  // e a tela de fato rolou (a rolagem é suave: espera terminar)
  await expect
    .poll(() =>
      passos.evaluate((el) => {
        let pai: HTMLElement | null = el.parentElement;
        while (pai && pai.scrollHeight <= pai.clientHeight) pai = pai.parentElement;
        return pai ? pai.scrollTop : 0;
      }),
    )
    .toBeGreaterThan(0);
});
