import { expect, test, type Page } from '@playwright/test';

// RF-78: mais cores para o hábito (grade, personalizada, cor de outro hábito, ajuste de legibilidade).

async function abrirNovoHabito(page: Page) {
  await page.goto('./');
  await page.getByRole('navigation').getByRole('button', { name: /^Hábitos/ }).click();
  await page.getByRole('button', { name: /Novo hábito/ }).first().click();
  await expect(page.getByRole('heading', { name: 'Novo hábito' })).toBeVisible();
}

/** Cor de fundo do botão marcado da fileira de cores do formulário. */
async function corMarcada(page: Page) {
  return page.locator('button[aria-pressed="true"][aria-label^="Cor #"]').first().evaluate(
    (el) => getComputedStyle(el).backgroundColor,
  );
}

const rgb = (hex: string) => {
  const n = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return `rgb(${n.join(', ')})`;
};

test('T-78e: escolher uma cor da grade e usar', async ({ page }) => {
  await abrirNovoHabito(page);
  await page.getByRole('button', { name: '+ Mais cores' }).click();
  const janela = page.getByRole('dialog', { name: 'Mais cores' });
  await expect(janela).toBeVisible();
  const grade = janela.getByRole('tabpanel', { name: 'Cores prontas' });
  await expect(grade.getByRole('button')).toHaveCount(40);
  const escolhida = grade.getByRole('button').nth(13);
  const rotulo = (await escolhida.getAttribute('aria-label')) ?? '';
  const hex = rotulo.replace('Cor ', '');
  await escolhida.click();
  await janela.getByRole('button', { name: 'Usar esta cor' }).click();
  await expect(janela).toHaveCount(0);
  await expect(page.getByRole('button', { name: `Cor ${hex}`, pressed: true })).toBeVisible();
  expect(await corMarcada(page)).toBe(rgb(hex));
});

test('T-78f: código hexadecimal válido e inválido', async ({ page }) => {
  await abrirNovoHabito(page);
  await page.getByRole('button', { name: '+ Mais cores' }).click();
  const janela = page.getByRole('dialog', { name: 'Mais cores' });
  await janela.getByRole('tab', { name: 'Personalizada' }).click();
  const campo = janela.getByLabel('Código da cor');
  const usar = janela.getByRole('button', { name: 'Usar esta cor' });

  await campo.fill('#12');
  await expect(janela.getByRole('alert')).toContainText('Código inválido');
  await expect(usar).toBeDisabled();
  await campo.fill('#GGGGGG');
  await expect(usar).toBeDisabled();

  await campo.fill('1f6fb5');
  await expect(janela.getByRole('alert')).toHaveCount(0);
  await expect(usar).toBeEnabled();
  await usar.click();
  await expect(page.getByRole('button', { name: 'Cor #1F6FB5', pressed: true })).toBeVisible();
});

test('T-78h: cor clara demais é escurecida com aviso', async ({ page }) => {
  await abrirNovoHabito(page);
  await page.getByRole('button', { name: '+ Mais cores' }).click();
  const janela = page.getByRole('dialog', { name: 'Mais cores' });
  await janela.getByRole('tab', { name: 'Personalizada' }).click();
  await janela.getByLabel('Código da cor').fill('#FFFF00');
  await expect(janela.getByRole('status')).toContainText('Escurecemos um pouco');
  await janela.getByRole('button', { name: 'Usar esta cor' }).click();
  const usada = await corMarcada(page);
  expect(usada).not.toBe(rgb('#FFFF00'));
});

test('T-78g: pegar a cor de outro hábito e usar as barras', async ({ page }) => {
  // cria um hábito com cor personalizada
  await abrirNovoHabito(page);
  await page.getByPlaceholder('Ex.: Ler um livro').fill('Primeiro');
  await page.getByRole('button', { name: '+ Mais cores' }).click();
  let janela = page.getByRole('dialog', { name: 'Mais cores' });
  await janela.getByRole('tab', { name: 'Personalizada' }).click();
  await janela.getByLabel('Código da cor').fill('#2788CE');
  await janela.getByRole('button', { name: 'Usar esta cor' }).click();
  await page.getByRole('button', { name: 'Criar hábito' }).click();
  await expect(page.getByRole('heading', { name: 'Novo hábito' })).toHaveCount(0);

  // segundo hábito: aparece em "Cores dos meus hábitos" e na aba "De outro hábito"
  await page.getByRole('button', { name: /Novo hábito/ }).first().click();
  await expect(page.getByText('Cores dos meus hábitos')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Cor #2788CE' })).toBeVisible();
  await page.getByRole('button', { name: '+ Mais cores' }).click();
  janela = page.getByRole('dialog', { name: 'Mais cores' });
  await janela.getByRole('tab', { name: 'De outro hábito' }).click();
  await janela.getByRole('button', { name: 'Pegar a cor de Primeiro' }).click();
  await janela.getByRole('tab', { name: 'Personalizada' }).click();
  await expect(janela.getByLabel('Código da cor')).toHaveValue('#2788CE');

  // barras: mexer no matiz muda o código, e a claridade nunca passa do limite legível
  const antes = await janela.getByLabel('Código da cor').inputValue();
  await janela.getByLabel('Matiz').fill('300');
  await expect(janela.getByLabel('Código da cor')).not.toHaveValue(antes);
  await janela.getByLabel('Claridade').fill(String(await janela.getByLabel('Claridade').getAttribute('max')));
  await janela.getByRole('button', { name: 'Usar esta cor' }).click();
  await expect(page.getByRole('button', { pressed: true, name: /^Cor #/ })).toBeVisible();
});

test('Cancelar não muda a cor', async ({ page }) => {
  await abrirNovoHabito(page);
  const antes = await corMarcada(page);
  await page.getByRole('button', { name: '+ Mais cores' }).click();
  const janela = page.getByRole('dialog', { name: 'Mais cores' });
  await janela.getByRole('tab', { name: 'Personalizada' }).click();
  await janela.getByLabel('Código da cor').fill('#B4235A');
  await janela.getByRole('button', { name: 'Cancelar' }).click();
  expect(await corMarcada(page)).toBe(antes);
});
