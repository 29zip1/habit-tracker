import { describe, expect, it } from 'vitest';
import { gerarCsvRegistros } from '../src/services/csv';
import { precisaAvisarBackup, textoAvisoBackup } from '../src/services/avisoBackup';
import type { Medida, ObservacaoHabito } from '../src/types';
import { dia, habito, marca, reg } from './ajudas';

describe('T-61b · CSV dos registros', () => {
  const cardio = habito({ tipo: 'quantidade', meta: 30, nome: 'Cardio', unidade: 'min' });
  const treino = habito({ tipo: 'semanal', meta: 5, nome: 'Treino; "forte"', unidade: 'vezes' });
  const lista = (h: ReturnType<typeof habito>) => h.habito;

  const csv = gerarCsvRegistros(
    [cardio, treino].map(lista),
    [...cardio.versoes, ...treino.versoes],
    [reg(cardio, 5.5, '2026-11-10', '19:30'), reg(cardio, 10, '2026-11-09', '07:10')],
    [marca(treino, '2026-11-09')],
  );

  it('começa com BOM UTF-8 (acentos corretos no Excel) e usa linhas CRLF', () => {
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv.includes('\r\n')).toBe(true);
    expect(csv.endsWith('\r\n')).toBe(true);
  });

  it('tem cabeçalho e os registros ordenados por data e horário', () => {
    const linhas = csv.slice(1).trim().split('\r\n');
    expect(linhas[0]).toBe('data;horario;habito;valor;unidade;origem;observacao');
    expect(linhas).toHaveLength(4);
    expect(linhas[1].startsWith('2026-11-09;')).toBe(true);
    expect(linhas[3].startsWith('2026-11-10;19:30;')).toBe(true);
  });

  it('usa vírgula decimal e mostra a unidade da época', () => {
    expect(csv).toContain('2026-11-10;19:30;Cardio;5,5;min;bloco;');
  });

  it('protege ponto e vírgula e aspas dentro do nome do hábito', () => {
    expect(csv).toContain('"Treino; ""forte"""');
  });

  it('marcações entram como "feito"', () => {
    expect(csv).toContain('2026-11-09;;"Treino; ""forte""";1;feito;marcacao;');
  });

  it('sem nenhum registro: só o cabeçalho', () => {
    const vazio = gerarCsvRegistros([], [], [], []);
    expect(vazio.slice(1).trim()).toBe('data;horario;habito;valor;unidade;origem;observacao');
  });
});

const med = (h: ReturnType<typeof habito>, data: string, valor: number, unidade: string): Medida => ({
  id: 'm' + data + valor, habitoId: h.habito.id, data, valor, unidade, criadoEm: '', editadoEm: '',
});
const obs = (h: ReturnType<typeof habito>, data: string, texto: string): ObservacaoHabito => ({
  id: 'o' + data, habitoId: h.habito.id, data, texto, criadoEm: '', editadoEm: '',
});

describe('T-86 · CSV com medidas, observações e nota do dia (RF-86)', () => {
  const med1 = habito({ tipo: 'conclusao', nome: 'Meditar' });
  const todos = (h: ReturnType<typeof habito>[]) => h.map((x) => x.habito);
  const gerar = (m: Medida[], o: ObservacaoHabito[], d = [dia('2026-11-10', { nota: 'Dia "bom"; leve' })]) =>
    gerarCsvRegistros(todos([med1]), med1.versoes, [], [marca(med1, '2026-11-10')], m, o, d)
      .slice(1)
      .trim()
      .split('\r\n');

  it('T-86b/c: marcação com coluna vazia; medida com vírgula decimal e unidade anotada', () => {
    const l = gerar([med(med1, '2026-11-10', 1.5, 'h'), med(med1, '2026-11-09', 20, 'min')], []);
    expect(l).toContain('2026-11-10;;Meditar;1;feito;marcacao;');
    expect(l).toContain('2026-11-10;;Meditar;1,5;h;medida;');
    expect(l).toContain('2026-11-09;;Meditar;20;min;medida;');
  });

  it('T-86d: observação na sétima coluna, valor e unidade vazios', () => {
    expect(gerar([], [obs(med1, '2026-11-10', 'Me sinto melhor')])).toContain(
      '2026-11-10;;Meditar;;;observacao;Me sinto melhor',
    );
  });

  it('T-86e: nota do dia sem hábito; nota vazia não gera linha', () => {
    expect(gerar([], []).some((x) => x.startsWith('2026-11-10;;;;;nota_do_dia;'))).toBe(true);
    const sem = gerar([], [], [dia('2026-11-10', { nota: '  ' }), dia('2026-11-11')]);
    expect(sem.some((x) => x.includes('nota_do_dia'))).toBe(false);
  });

  it('T-86f: protege ponto e vírgula, aspas e quebra de linha', () => {
    expect(gerar([], [])).toContain('2026-11-10;;;;;nota_do_dia;"Dia ""bom""; leve"');
    expect(gerar([], [obs(med1, '2026-11-10', 'a\nb')]).join('|')).toContain('observacao;"a');
  });

  it('T-86g: BOM, CRLF e ordem por data', () => {
    const bruto = gerarCsvRegistros(todos([med1]), med1.versoes, [], [], [med(med1, '2026-11-12', 5, 'min'), med(med1, '2026-11-08', 3, 'min')], [], []);
    expect(bruto.charCodeAt(0)).toBe(0xfeff);
    expect(bruto.endsWith('\r\n')).toBe(true);
    const l = bruto.slice(1).trim().split('\r\n');
    expect(l[1].startsWith('2026-11-08')).toBe(true);
    expect(l[2].startsWith('2026-11-12')).toBe(true);
  });

  it('T-86h: hábito apagado mantendo histórico continua pelo nome', () => {
    const l = gerarCsvRegistros([med1.habito], med1.versoes, [], [], [med(med1, '2026-11-10', 2, 'min')], [obs(med1, '2026-11-10', 'ok')], []);
    expect(l).toContain('Meditar;2;min;medida;');
    expect(l).toContain('Meditar;;;observacao;ok');
  });

  it('T-86i: sem dados, só o cabeçalho de 7 colunas', () => {
    expect(gerarCsvRegistros([], [], [], [], [], [], []).slice(1).trim()).toBe(
      'data;horario;habito;valor;unidade;origem;observacao',
    );
  });
});

describe('T-62 · faixa de aviso de backup', () => {
  const agora = new Date('2026-11-10T12:00:00Z');
  const diasAtras = (n: number) => new Date(agora.getTime() - n * 86_400_000).toISOString();

  it('avisa quando passou de 7 dias do último backup', () => {
    expect(precisaAvisarBackup({ agora, ultimoBackup: diasAtras(8), limiteDias: 7, temRegistros: true })).toBe(true);
    expect(precisaAvisarBackup({ agora, ultimoBackup: diasAtras(7), limiteDias: 7, temRegistros: true })).toBe(false);
    expect(precisaAvisarBackup({ agora, ultimoBackup: diasAtras(2), limiteDias: 7, temRegistros: true })).toBe(false);
  });

  it('o limite é configurável', () => {
    expect(precisaAvisarBackup({ agora, ultimoBackup: diasAtras(4), limiteDias: 3, temRegistros: true })).toBe(true);
    expect(precisaAvisarBackup({ agora, ultimoBackup: diasAtras(20), limiteDias: 30, temRegistros: true })).toBe(false);
  });

  it('nunca houve backup: conta a partir da criação do banco', () => {
    expect(precisaAvisarBackup({ agora, criadoEm: diasAtras(10), limiteDias: 7, temRegistros: true })).toBe(true);
    expect(precisaAvisarBackup({ agora, criadoEm: diasAtras(3), limiteDias: 7, temRegistros: true })).toBe(false);
  });

  it('não avisa sem dados nem sem referência', () => {
    expect(precisaAvisarBackup({ agora, ultimoBackup: diasAtras(30), limiteDias: 7, temRegistros: false })).toBe(false);
    expect(precisaAvisarBackup({ agora, limiteDias: 7, temRegistros: true })).toBe(false);
  });

  it('texto do aviso', () => {
    expect(textoAvisoBackup({ agora, ultimoBackup: diasAtras(9) })).toBe('Faz 9 dias que você não salva um backup.');
    expect(textoAvisoBackup({ agora, ultimoBackup: diasAtras(1) })).toBe('Faz 1 dia que você não salva um backup.');
    expect(textoAvisoBackup({ agora })).toBe('Você ainda não salvou nenhum backup.');
  });
});
