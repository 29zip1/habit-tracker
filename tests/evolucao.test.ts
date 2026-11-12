import { describe, expect, it } from 'vitest';
import type { EntradaDia } from '../src/services/calculos';
import { intervaloDeDatas } from '../src/services/datas';
import {
  colunaDaData,
  consistenciaPorIntervalo,
  desempenhoPorHabito,
  diasCompletosPorIntervalo,
  grelhaDoAno,
  intervaloDoMes,
  mesQueComecaNaColuna,
  mesesRecentes,
  semanasRecentes,
  totaisPorIntervalo,
} from '../src/services/evolucao';
import { resumosDosDias } from '../src/services/historico';
import { dia, habito, marca, reg } from './ajudas';

const HOJE = '2026-11-10'; // terça-feira

describe('T-50j · semanas e meses recentes', () => {
  it('8 semanas começando na segunda; a última é a semana de hoje', () => {
    const s = semanasRecentes(HOJE, 8, 1);
    expect(s).toHaveLength(8);
    expect(s[7]).toEqual({ inicio: '2026-11-09', fim: '2026-11-15' });
    expect(s[0]).toEqual({ inicio: '2026-09-21', fim: '2026-09-27' });
    for (let i = 1; i < 8; i++) expect(s[i].inicio > s[i - 1].fim).toBe(true);
  });

  it('com a semana começando no domingo', () => {
    expect(semanasRecentes(HOJE, 1, 0)[0]).toEqual({ inicio: '2026-11-08', fim: '2026-11-14' });
  });

  it('6 meses, o último é o de hoje, e atravessa a virada do ano', () => {
    expect(mesesRecentes(HOJE, 6)[0]).toEqual({ ano: 2026, mes: 6 });
    expect(mesesRecentes(HOJE, 6)[5]).toEqual({ ano: 2026, mes: 11 });
    const virada = mesesRecentes('2026-02-03', 6);
    expect(virada[0]).toEqual({ ano: 2025, mes: 9 });
    expect(virada[5]).toEqual({ ano: 2026, mes: 2 });
  });

  it('intervalo do mês', () => {
    expect(intervaloDoMes({ ano: 2028, mes: 2 })).toEqual({ inicio: '2028-02-01', fim: '2028-02-29' });
  });
});

describe('T-52b · grade do mapa de calor', () => {
  it('2026 (1º de janeiro numa quinta): com semana na segunda, 3 espaços antes e 53 colunas', () => {
    const g = grelhaDoAno(2026, 1);
    expect(g[0].slice(0, 3)).toEqual([null, null, null]);
    expect(g[0][3]).toBe('2026-01-01');
    expect(g).toHaveLength(53);
    expect(g.every((c) => c.length === 7)).toBe(true);
  });

  it('cada dia do ano aparece uma vez e em ordem (2026, 2027 e 2028 bissexto)', () => {
    for (const [ano, total] of [[2026, 365], [2027, 365], [2028, 366]] as const) {
      for (const inicio of [0, 1]) {
        const dias = grelhaDoAno(ano, inicio).flat().filter((d): d is string => d !== null);
        expect(dias).toHaveLength(total);
        expect([...dias].sort()).toEqual(dias);
        expect(dias[0]).toBe(`${ano}-01-01`);
        expect(dias.at(-1)).toBe(`${ano}-12-31`);
      }
    }
  });

  it('acha a coluna de hoje e os inícios de mês', () => {
    const g = grelhaDoAno(2026, 1);
    const col = colunaDaData(g, HOJE);
    expect(g[col]).toContain(HOJE);
    expect(g[col].indexOf(HOJE)).toBe(1); // terça = segunda linha com a semana na segunda
    expect(colunaDaData(g, '2025-12-31')).toBe(-1);
    expect(mesQueComecaNaColuna(g[0])).toBe(1);
    expect(mesQueComecaNaColuna(g[1])).toBeNull();
    const meses = g.map(mesQueComecaNaColuna).filter((m) => m !== null);
    expect(meses).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });
});

/**
 * Cenário conferido à mão (hoje = 10/11, terça). Cardio 30 min/dia e Meditar (sim ou não):
 *  02 completo · 03 completo · 04 parcial (cardio 10) · 05 sem dados · 06 folga
 *  07 completo · 08 completo (cardio 45) · 09 parcial (só meditar) · 10 hoje, nada ainda
 */
function cenario() {
  const cardio = habito({ tipo: 'quantidade', meta: 30, nome: 'Cardio', unidade: 'min' });
  const meditar = habito({ tipo: 'conclusao', nome: 'Meditar' });
  const registros = [
    reg(cardio, 30, '2026-11-02'),
    reg(cardio, 30, '2026-11-03'),
    reg(cardio, 10, '2026-11-04'),
    reg(cardio, 30, '2026-11-07'),
    reg(cardio, 45, '2026-11-08'),
    reg(cardio, 20, '2026-10-28'), // semana anterior, em outro mês
  ];
  const marcacoes = ['2026-11-02', '2026-11-03', '2026-11-07', '2026-11-08', '2026-11-09'].map((d) => marca(meditar, d));
  const entradas: EntradaDia[] = intervaloDeDatas('2026-10-01', '2026-11-30').map((data) => ({
    data,
    hoje: HOJE,
    habitos: [cardio, meditar],
    registros,
    marcacoes,
    dia: data === '2026-11-06' ? dia(data, { folga: true }) : undefined,
    inicioSemana: 1,
  }));
  return { cardio, meditar, entradas };
}

describe('T-50j · gráficos e indicadores contados à mão', () => {
  it('dias completos por semana: semana de 02 a 08 tem 4; a de hoje, 0', () => {
    const { entradas } = cenario();
    const r = resumosDosDias(entradas, null);
    const semanas = [
      { inicio: '2026-11-02', fim: '2026-11-08' },
      { inicio: '2026-11-09', fim: '2026-11-15' },
    ];
    expect(diasCompletosPorIntervalo(r, semanas, '2026-10-28', HOJE)).toEqual([4, 0]);
  });

  it('consistência por mês: novembro vem da conta à mão; mês futuro fica vazio', () => {
    const { entradas } = cenario();
    const r = resumosDosDias(entradas, null);
    const nov = intervaloDoMes({ ano: 2026, mes: 11 });
    const dez = intervaloDoMes({ ano: 2026, mes: 12 });
    // dias contados em novembro: 01 a 09 menos a folga (06) = 8; completos: 02, 03, 07, 08 = 4 → 50%
    expect(consistenciaPorIntervalo(r, [nov], '2026-10-28', HOJE)).toEqual([50]);
    expect(consistenciaPorIntervalo(r, [dez], '2026-10-28', HOJE)).toEqual([null]);
  });

  it('quantidade acumulada do Cardio por semana e por mês', () => {
    const { cardio, entradas } = cenario();
    const r = resumosDosDias(entradas, cardio.habito.id);
    const semanas = [
      { inicio: '2026-10-26', fim: '2026-11-01' },
      { inicio: '2026-11-02', fim: '2026-11-08' },
      { inicio: '2026-11-09', fim: '2026-11-15' },
    ];
    expect(totaisPorIntervalo(r, semanas, HOJE)).toEqual([20, 145, 0]);
    const meses = [intervaloDoMes({ ano: 2026, mes: 10 }), intervaloDoMes({ ano: 2026, mes: 11 })];
    expect(totaisPorIntervalo(r, meses, HOJE)).toEqual([20, 145]);
  });

  it('desempenho por hábito no período; hábito apagado mantendo histórico não aparece', () => {
    const { cardio, meditar, entradas } = cenario();
    const removido = habito({ tipo: 'conclusao', nome: 'Removido' });
    removido.habito.status = 'removido';
    const d = desempenhoPorHabito(
      entradas,
      [cardio, meditar, removido],
      { inicio: '2026-11-01', fim: '2026-11-30' },
      '2026-10-28',
      HOJE,
    );
    expect(d.map((x) => x.nome)).toEqual(['Cardio', 'Meditar']);
    expect(d[0]).toMatchObject({ feitos: 4, programados: 8, pct: 50 });
    expect(d[1]).toMatchObject({ feitos: 5, programados: 8, pct: 63 });
  });

  it('sem nenhum dia programado: percentual nulo, sem dividir por zero', () => {
    const { cardio, entradas } = cenario();
    const d = desempenhoPorHabito(entradas, [cardio], { inicio: '2026-11-20', fim: '2026-11-30' }, '2026-10-28', HOJE);
    expect(d[0]).toMatchObject({ feitos: 0, programados: 0, pct: null });
  });
});
