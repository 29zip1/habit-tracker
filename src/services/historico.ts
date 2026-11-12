// Fase 6 (RF-40, RF-41): contas do Histórico. Sem acesso ao banco nem à tela.
import type { DataLocal } from '../types';
import {
  calcularDia,
  resumoDoPeriodo,
  type EntradaDia,
  type ResumoDia,
  type ResumoPeriodo,
} from './calculos';
import { diaDaSemana, somarDias } from './datas';

export interface MesRef {
  ano: number;
  /** 1 a 12 */
  mes: number;
}

export const NOMES_MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];
const ROTULOS_SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

const dois = (n: number) => String(n).padStart(2, '0');

export const mesDaData = (d: DataLocal): MesRef => ({ ano: Number(d.slice(0, 4)), mes: Number(d.slice(5, 7)) });

export function somarMeses(m: MesRef, delta: number): MesRef {
  const i = m.ano * 12 + (m.mes - 1) + delta;
  return { ano: Math.floor(i / 12), mes: (i % 12) + 1 };
}

/** Negativo se `a` é antes de `b`, 0 se é o mesmo mês. */
export const compararMeses = (a: MesRef, b: MesRef) => (a.ano - b.ano) * 12 + (a.mes - b.mes);

export const nomeDoMes = (m: MesRef) => `${NOMES_MESES[m.mes - 1]} de ${m.ano}`;
export const diasNoMes = (m: MesRef) => new Date(m.ano, m.mes, 0).getDate();
export const primeiroDiaDoMes = (m: MesRef): DataLocal => `${m.ano}-${dois(m.mes)}-01`;
export const ultimoDiaDoMes = (m: MesRef): DataLocal => `${m.ano}-${dois(m.mes)}-${dois(diasNoMes(m))}`;

/** Rótulos dos dias da semana na ordem das colunas (a semana começa em `inicioSemana`). */
export function rotulosDaSemana(inicioSemana = 1): string[] {
  return Array.from({ length: 7 }, (_, i) => ROTULOS_SEMANA[(inicioSemana + i) % 7]);
}

/**
 * Grade do calendário: linhas de 7 colunas. Células `null` são os espaços antes do dia 1
 * e depois do último dia do mês (nunca mostram dias de outros meses).
 */
export function gradeDoMes(m: MesRef, inicioSemana = 1): (DataLocal | null)[][] {
  const vazios = (diaDaSemana(primeiroDiaDoMes(m)) - inicioSemana + 7) % 7;
  const celulas: (DataLocal | null)[] = Array(vazios).fill(null);
  for (let d = 1; d <= diasNoMes(m); d++) celulas.push(`${m.ano}-${dois(m.mes)}-${dois(d)}`);
  while (celulas.length % 7 !== 0) celulas.push(null);
  const semanas: (DataLocal | null)[][] = [];
  for (let i = 0; i < celulas.length; i += 7) semanas.push(celulas.slice(i, i + 7));
  return semanas;
}

// ---------- períodos (RF-41) ----------

export type TipoPeriodo = 'mes' | '30' | '90' | 'ano' | 'tudo';

export const ROTULOS_PERIODO: Record<TipoPeriodo, string> = {
  mes: 'Mês',
  '30': '30 dias',
  '90': '90 dias',
  ano: 'Este ano',
  tudo: 'Tudo',
};

export interface Intervalo {
  inicio: DataLocal;
  fim: DataLocal;
}

/** Datas do período escolhido (no mês, o mês inteiro do calendário). */
export function periodoDe(
  tipo: TipoPeriodo,
  mes: MesRef,
  hoje: DataLocal,
  primeiraData?: DataLocal,
): Intervalo {
  switch (tipo) {
    case 'mes':
      // O mês inteiro; os dias que ainda não chegaram saem das contas pelo estado "futuro".
      return { inicio: primeiroDiaDoMes(mes), fim: ultimoDiaDoMes(mes) };
    case '30':
      return { inicio: somarDias(hoje, -29), fim: hoje };
    case '90':
      return { inicio: somarDias(hoje, -89), fim: hoje };
    case 'ano':
      return { inicio: `${hoje.slice(0, 4)}-01-01`, fim: hoje };
    case 'tudo':
      return { inicio: primeiraData && primeiraData < hoje ? primeiraData : hoje, fim: hoje };
  }
}

// ---------- filtro por hábito ----------

/** Deixa só o hábito escolhido na entrada do dia (null = todos). */
export function filtrarHabito(e: EntradaDia, habitoId: string | null): EntradaDia {
  if (habitoId === null) return e;
  // Registros e marcações dos outros hábitos também saem, senão contariam como "dia com dados".
  return {
    ...e,
    habitos: e.habitos.filter((h) => h.habito.id === habitoId),
    registros: e.registros.filter((r) => r.habitoId === habitoId),
    marcacoes: e.marcacoes.filter((m) => m.habitoId === habitoId),
  };
}

/** Estado de cada dia (com o filtro de hábito aplicado). */
export function resumosDosDias(entradas: EntradaDia[], habitoId: string | null): ResumoDia[] {
  return entradas.map((e) => calcularDia(filtrarHabito(e, habitoId)));
}

// ---------- resumos ----------

export interface ResumoHistorico {
  periodo: ResumoPeriodo;
  /** Quantas metas foram superadas no período (somando os dias). */
  metasSuperadas: number;
  /** Só com um hábito escolhido. */
  habito?: ResumoDoHabito;
}

export interface ResumoDoHabito {
  /** Dias já passados (e hoje, se já feito) em que o hábito estava programado. */
  diasProgramados: number;
  /** Desses, quantos o hábito ficou 100% (meta batida, marcado, limite atingido). */
  diasFeitos: number;
  /** Soma dos registros (quantidade e limite). */
  total: number;
  /** total ÷ dias programados, ou null se não há dias. */
  mediaPorDia: number | null;
}

/**
 * Números do período. `resumos` são os dias do período, em qualquer ordem.
 * `primeiraData` é o primeiro dia com algum registro (RF-C10).
 */
export function resumirPeriodo(
  resumos: ResumoDia[],
  primeiraData: DataLocal | undefined,
  hoje: DataLocal,
  habitoId: string | null,
): ResumoHistorico {
  const periodo = resumoDoPeriodo(
    resumos.map((r) => ({ data: r.data, estado: r.estado })),
    primeiraData,
    hoje,
  );
  const passados = resumos.filter((r) => r.estado !== 'futuro' && r.data <= hoje);
  const metasSuperadas = passados.reduce((s, r) => s + r.metasSuperadas, 0);
  const resumo: ResumoHistorico = { periodo, metasSuperadas };

  if (habitoId !== null) {
    let diasProgramados = 0;
    let diasFeitos = 0;
    let total = 0;
    for (const r of passados) {
      const h = r.habitos[0];
      // Dias antes do primeiro registro não contam (RF-C10), igual ao resumo geral.
      if (!h || !h.programado || r.estado === 'folga') continue;
      if (primeiraData === undefined || r.data < primeiraData) continue;
      const feito = (h.fracao ?? 0) >= 1;
      // Hoje em aberto ainda não terminou: só conta se já está feito.
      if (r.data === hoje && !feito) continue;
      diasProgramados++;
      if (feito) diasFeitos++;
      total += h.total;
    }
    resumo.habito = {
      diasProgramados,
      diasFeitos,
      total: Math.round(total * 1e6) / 1e6,
      mediaPorDia: diasProgramados === 0 ? null : Math.round((total / diasProgramados) * 100) / 100,
    };
  }
  return resumo;
}
