import { expect, test, type Page } from '@playwright/test';

// RF-83 e RF-84: medida e observação opcionais por hábito (testes de interface, WebKit).
// Relógio fixo em sábado, 14/11/2026.

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date(2026, 10, 14, 12, 0, 0));
});

const aba = (page: Page, nome: string) => page.getByRole('navigation').getByRole('button', { name: new RegExp(`^${nome}`) });

async function criarHabitoSimOuNao(page: Page, nome: string, complementos: { medida?: boolean; observacao?: boolean }) {
  await aba(page, 'Hábitos').click();
  await page.getByRole('button', { name: /Novo hábito/ }).first().click();
  await page.getByPlaceholder('Ex.: Ler um livro').fill(nome);
  await page.getByRole('button', { name: /^Sim ou não/ }).click();
  if (complementos.medida) await page.getByLabel(/Anotar uma medida/).check();
  if (complementos.observacao) await page.getByLabel(/Anotar observação/).check();
  await page.getByRole('button', { name: 'Criar hábito' }).click();
  await expect(page.getByRole('heading', { name: 'Novo hábito' })).toHaveCount(0);
}

const lapis = (page: Page, nome: string) => page.getByRole('button', { name: `Anotar medida ou observação de ${nome}` });

test('T-83a/b e T-84b: o lápis só existe nos hábitos com complemento ligado', async ({ page }) => {
  await page.goto('./');
  await criarHabitoSimOuNao(page, 'Cardio', { medida: true, observacao: true });
  await criarHabitoSimOuNao(page, 'Leitura', {});
  await aba(page, 'Hoje').click();

  await expect(page.getByRole('button', { name: /Leitura: pendente/ })).toBeVisible();
  await expect(lapis(page, 'Cardio')).toHaveCount(1);
  await expect(lapis(page, 'Leitura')).toHaveCount(0);
  await expect(page.getByTestId('linha-complemento')).toHaveCount(0);
});

test('T-83d/e/f, T-84b/c: anotar, corrigir, remover; não marca o hábito', async ({ page }) => {
  await page.goto('./');
  await criarHabitoSimOuNao(page, 'Cardio', { medida: true, observacao: true });
  await aba(page, 'Hoje').click();

  await lapis(page, 'Cardio').click();
  let janela = page.getByRole('dialog', { name: /Cardio · hoje/ });
  await janela.getByLabel('Medida em min').fill('40');
  await janela.getByLabel('Observação do hábito').fill('esteira, treino forte');
  await janela.getByRole('button', { name: 'Salvar' }).click();

  await expect(page.getByTestId('linha-complemento')).toHaveText('40 min · esteira, treino forte');
  // salvar medida não marca o hábito
  await expect(page.getByRole('button', { name: /Cardio: pendente/ })).toBeVisible();

  // corrigir: o valor novo substitui (não soma)
  await lapis(page, 'Cardio').click();
  janela = page.getByRole('dialog', { name: /Cardio · hoje/ });
  await expect(janela.getByLabel('Medida em min')).toHaveValue('40');
  await janela.getByLabel('Medida em min').fill('25');
  await janela.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByTestId('linha-complemento')).toHaveText('25 min · esteira, treino forte');

  // valor inválido: mensagem e nada é salvo
  await lapis(page, 'Cardio').click();
  janela = page.getByRole('dialog', { name: /Cardio · hoje/ });
  await janela.getByLabel('Medida em min').fill('0');
  await janela.getByRole('button', { name: 'Salvar' }).click();
  await expect(janela.getByRole('alert')).toBeVisible();
  // medida vazia remove só a medida
  await janela.getByLabel('Medida em min').fill('');
  await janela.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByTestId('linha-complemento')).toHaveText('esteira, treino forte');
});

test('T-84a: a observação não passa de 140 caracteres', async ({ page }) => {
  await page.goto('./');
  await criarHabitoSimOuNao(page, 'Cardio', { observacao: true });
  await aba(page, 'Hoje').click();
  await lapis(page, 'Cardio').click();
  const janela = page.getByRole('dialog', { name: /Cardio · hoje/ });
  // só observação ligada: não há campo de medida
  await expect(janela.getByLabel(/Medida em/)).toHaveCount(0);
  await janela.getByLabel('Observação do hábito').fill('a'.repeat(200));
  await expect(janela.getByLabel('Observação do hábito')).toHaveValue('a'.repeat(140));
});

test('T-83l: dia fechado trava o lápis, mas a medida continua visível', async ({ page }) => {
  await page.goto('./');
  await criarHabitoSimOuNao(page, 'Cardio', { medida: true });
  await aba(page, 'Hoje').click();
  await lapis(page, 'Cardio').click();
  const janela = page.getByRole('dialog', { name: /Cardio · hoje/ });
  await janela.getByLabel('Medida em min').fill('40');
  await janela.getByRole('button', { name: 'Salvar' }).click();

  await page.getByRole('button', { name: 'Finalizar dia' }).click();
  await expect(lapis(page, 'Cardio')).toBeDisabled();
  await expect(page.getByTestId('linha-complemento')).toHaveText('40 min');
});

test('T-83q/r e relatório: Evolução lista o hábito com medida; Relatório mostra total, média e observações', async ({ page }) => {
  await page.goto('./');
  await criarHabitoSimOuNao(page, 'Cardio', { medida: true, observacao: true });
  await aba(page, 'Hoje').click();
  await lapis(page, 'Cardio').click();
  const janela = page.getByRole('dialog', { name: /Cardio · hoje/ });
  await janela.getByLabel('Medida em min').fill('40');
  await janela.getByLabel('Observação do hábito').fill('esteira');
  await janela.getByRole('button', { name: 'Salvar' }).click();
  await page.getByRole('button', { name: /Cardio: pendente/ }).click(); // marcar (há um primeiro registro)

  await aba(page, 'Evolução').click();
  await expect(page.getByRole('option', { name: 'Cardio' })).toHaveCount(1);
  await expect(page.getByText('Cardio: total por semana (min)').first()).toBeVisible();

  await page.getByRole('button', { name: 'Ver relatório' }).click();
  await expect(page.getByText('Medida anotada: 1 dia: total 40 min · média 40 min por dia anotado')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Observações dos hábitos' })).toBeVisible();
  await expect(page.getByText(/14\/11\/2026/).first()).toBeVisible();
});

test('T-83: quantidade e limite não oferecem a medida; a observação continua disponível', async ({ page }) => {
  await page.goto('./');
  await aba(page, 'Hábitos').click();
  await page.getByRole('button', { name: /Novo hábito/ }).first().click();
  await page.getByRole('button', { name: /^Quantidade/ }).click();
  await expect(page.getByLabel(/Anotar uma medida/)).toHaveCount(0);
  await expect(page.getByLabel(/Anotar observação/)).toHaveCount(1);
});
