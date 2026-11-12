import { describe, expect, it } from 'vitest';
import type { EntradaDia } from '../src/services/calculos';
import {
  compararMeses,
  diasNoMes,
  gradeDoMes,
  mesDaData,
  nomeDoMes,
  periodoDe,
  resumirPeriodo,
  resumosDosDias,
  rotulosDaSemana,
  somarMeses,
  ultimoDiaDoMes,
} from '../src/services/historico';
import { intervaloDeDatas } from '../src/services/datas';
import { dia, habito, marca, reg } from './ajudas';

const HOJE = '2026-11-10'; // terça-feira

describe('T-40 · grade do calendário', () => {
  it('novembro de 2026 começa no domingo: com semana na segunda, 6 espaços antes do dia 1', () => {
    const g = gradeDoMes({ ano: 2026, mes: 11 }, 1);
    expect(g.every((s) => s.length === 7)).toBe(true);
    expect(g[0].slice(0, 6)).toEqual([null, null, null, null, null, null]);
    expect(g[0][6]).toBe('2026-11-01');
    expect(g).toHaveLength(6);
    expect(g.flat().filter((d) => d !== null)).toHaveLength(30);
    expect(g.flat().filter((d) => d !== null).at(-1)).toBe('2026-11-30');
  });

  it('com a semana começando no domingo, o dia 1 abre a primeira linha', () => {
    const g = gradeDoMes({ ano: 2026, mes: 11 }, 0);
    expect(g[0][0]).toBe('2026-11-01');
    expect(g).toHaveLength(5);
  });

  it('fevereiro de 2027 (28 dias, começa na segunda) cabe em 4 linhas; 2028 tem 29 dias', () => {
    expect(gradeDoMes({ ano: 2027, mes: 2 }, 1)).toHaveLength(4);
    expect(diasNoMes({ ano: 2027, mes: 2 })).toBe(28);
    expect(diasNoMes({ ano: 2028, mes: 2 })).toBe(29);
    expect(ultimoDiaDoMes({ ano: 2028, mes: 2 })).toBe('2028-02-29');
  });

  it('as datas da grade estão em ordem e cada dia aparece uma vez, em todos os meses de 2026 e 2027', () => {
    for (const ano of [2026, 2027]) {
      for (let mes = 1; mes <= 12; mes++) {
        for (const inicio of [0, 1]) {
          const dias = gradeDoMes({ ano, mes }, inicio).flat().filter((d): d is string => d !== null);
          expect(dias).toHaveLength(diasNoMes({ ano, mes }));
          expect([...dias].sort()).toEqual(dias);
          expect(new Set(dias).size).toBe(dias.length);
        }
      }
    }
  });

  it('rótulos da semana na ordem das colunas', () => {
    expect(rotulosDaSemana(1)).toEqual(['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom']);
    expect(rotulosDaSemana(0)).toEqual(['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']);
  });
});

describe('navegar entre meses', () => {
  it('passa de dezembro para janeiro e de janeiro para dezembro', () => {
    expect(somarMeses({ ano: 2026, mes: 12 }, 1)).toEqual({ ano: 2027, mes: 1 });
    expect(somarMeses({ ano: 2026, mes: 1 }, -1)).toEqual({ ano: 2025, mes: 12 });
    expect(somarMeses({ ano: 2026, mes: 11 }, -13)).toEqual({ ano: 2025, mes: 10 });
  });

  it('compara meses, lê o mês de uma data e escreve o nome', () => {
    expect(compararMeses({ ano: 2026, mes: 11 }, mesDaData('2026-11-30'))).toBe(0);
    expect(compararMeses({ ano: 2026, mes: 10 }, { ano: 2026, mes: 11 })).toBeLessThan(0);
    expect(compararMeses({ ano: 2027, mes: 1 }, { ano: 2026, mes: 12 })).toBe(1);
    expect(nomeDoMes({ ano: 2026, mes: 3 })).toBe('Março de 2026');
  });
});

describe('T-41 · períodos', () => {
  const mes = { ano: 2026, mes: 11 };
  it('mês: o mês inteiro do calendário', () => {
    expect(periodoDe('mes', mes, HOJE)).toEqual({ inicio: '2026-11-01', fim: '2026-11-30' });
  });
  it('30 e 90 dias terminam hoje e contam hoje', () => {
    const p30 = periodoDe('30', mes, HOJE);
    expect(p30).toEqual({ inicio: '2026-10-12', fim: HOJE });
    expect(intervaloDeDatas(p30.inicio, p30.fim)).toHaveLength(30);
    const p90 = periodoDe('90', mes, HOJE);
    expect(intervaloDeDatas(p90.inicio, p90.fim)).toHaveLength(90);
  });
  it('ano: de 1º de janeiro até hoje', () => {
    expect(periodoDe('ano', mes, HOJE)).toEqual({ inicio: '2026-01-01', fim: HOJE });
  });
  it('tudo: do primeiro registro até hoje (sem registros, só hoje)', () => {
    expect(periodoDe('tudo', mes, HOJE, '2026-09-15')).toEqual({ inicio: '2026-09-15', fim: HOJE });
    expect(periodoDe('tudo', mes, HOJE)).toEqual({ inicio: HOJE, fim: HOJE });
  });
});

/**
 * Cenário conferido à mão (hoje = 10/11, terça). Cardio 30 min/dia e Meditar (sim ou não):
 *  02 completo · 03 completo · 04 parcial (cardio 10) · 05 sem dados · 06 folga
 *  07 completo · 08 completo (cardio 45: meta superada) · 09 parcial (só meditar) · 10 hoje, nada ainda
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
  ];
  const marcacoes = ['2026-11-02', '2026-11-03', '2026-11-07', '2026-11-08', '2026-11-09'].map((d) => marca(meditar, d));
  const entradas: EntradaDia[] = intervaloDeDatas('2026-11-01', '2026-11-30').map((data) => ({
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

describe('T-40/T-41 · estados do calendário e números do resumo', () => {
  it('cada dia do calendário tem o estado certo', () => {
    const { entradas } = cenario();
    const r = resumosDosDias(entradas, null);
    const estado = (d: string) => r.find((x) => x.data === d)?.estado;
    expect(['02', '03', '04', '05', '06', '07', '08', '09', '10', '11'].map((d) => estado(`2026-11-${d}`))).toEqual([
      'completo', 'completo', 'parcial', 'semdados', 'folga', 'completo', 'completo', 'parcial', 'semdados', 'futuro',
    ]);
  });

  it('todos os hábitos: completos, consistência, sequência e metas superadas (conta à mão)', () => {
    const { entradas } = cenario();
    const res = resumirPeriodo(resumosDosDias(entradas, null), '2026-11-02', HOJE, null);
    // dias do período: 02,03,04,05,07,08,09 = 7 (folga e hoje em aberto ficam de fora); completos: 02,03,07,08 = 4
    expect(res.periodo.diasCompletos).toBe(4);
    expect(res.periodo.diasDoPeriodo).toBe(7);
    expect(res.periodo.consistenciaPct).toBe(57); // 4 ÷ 7
    expect(res.periodo.melhorSequencia).toBe(2);
    expect(res.periodo.sequenciaAtual).toBe(0); // 09 foi parcial
    expect(res.periodo.diasFolga).toBe(1);
    expect(res.metasSuperadas).toBe(1); // cardio 45 de 30, só em 08
    expect(res.habito).toBeUndefined();
  });

  it('só o Cardio: o calendário usa só os dados dele e o resumo conta os dias dele', () => {
    const { cardio, entradas } = cenario();
    const r = resumosDosDias(entradas, cardio.habito.id);
    const estado = (d: string) => r.find((x) => x.data === d)?.estado;
    // 09: só meditar foi feito, então para o Cardio é "sem dados" (não parcial)
    expect(['02', '04', '05', '06', '08', '09'].map((d) => estado(`2026-11-${d}`))).toEqual([
      'completo', 'parcial', 'semdados', 'folga', 'completo', 'semdados',
    ]);
    const res = resumirPeriodo(r, '2026-11-02', HOJE, cardio.habito.id);
    expect(res.habito).toEqual({ diasProgramados: 7, diasFeitos: 4, total: 145, mediaPorDia: 20.71 });
    expect(res.metasSuperadas).toBe(1);
  });

  it('só o Meditar: dias feitos e total zero', () => {
    const { meditar, entradas } = cenario();
    const res = resumirPeriodo(resumosDosDias(entradas, meditar.habito.id), '2026-11-02', HOJE, meditar.habito.id);
    expect(res.habito).toMatchObject({ diasProgramados: 7, diasFeitos: 5, total: 0 });
  });

  it('hoje feito entra na conta; hoje em aberto não', () => {
    const { cardio, meditar, entradas } = cenario();
    const comHoje = entradas.map((e) => ({
      ...e,
      registros: [...e.registros, reg(cardio, 30, HOJE)],
      marcacoes: [...e.marcacoes, marca(meditar, HOJE)],
    }));
    const res = resumirPeriodo(resumosDosDias(comHoje, null), '2026-11-02', HOJE, null);
    expect(res.periodo.diasDoPeriodo).toBe(8);
    expect(res.periodo.diasCompletos).toBe(5);
    expect(res.periodo.sequenciaAtual).toBe(1);
  });

  it('dias futuros ficam sem marcação e fora das contas', () => {
    const { entradas } = cenario();
    const r = resumosDosDias(entradas, null).filter((x) => x.data > HOJE);
    expect(r.length).toBe(20);
    expect(r.every((x) => x.estado === 'futuro' && x.percentual === null)).toBe(true);
  });

  it('sem nenhum dado: resumo vazio, sem dividir por zero', () => {
    const { cardio, meditar } = cenario();
    const vazias: EntradaDia[] = intervaloDeDatas('2026-11-01', '2026-11-30').map((data) => ({
      data, hoje: HOJE, habitos: [cardio, meditar], registros: [], marcacoes: [],
    }));
    const res = resumirPeriodo(resumosDosDias(vazias, null), undefined, HOJE, null);
    expect(res.periodo).toMatchObject({ diasCompletos: 0, diasDoPeriodo: 0, consistenciaPct: null });
  });
});
