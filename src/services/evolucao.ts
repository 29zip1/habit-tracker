// Fase 7, Parte A (RF-50, RF-52): contas da tela Evolução. Sem acesso ao banco nem à tela.
import type { DataLocal } from '../types';
import type { EntradaDia, HabitoCompleto, ResumoDia } from './calculos';
import { diaDaSemana, inicioDaSemana, somarDias } from './datas';
import {
  diasNoMes,
  primeiroDiaDoMes,
  resumirPeriodo,
  resumosDosDias,
  somarMeses,
  ultimoDiaDoMes,
  mesDaData,
  type Intervalo,
  type MesRef,
} from './historico';

/** Últimas `n` semanas, a última sendo a semana de hoje (começando em `inicioSemana`). */
export function semanasRecentes(hoje: DataLocal, n: number, inicioSemana = 1): Intervalo[] {
  const atual = inicioDaSemana(hoje, inicioSemana);
  return Array.from({ length: n }, (_, i) => {
    const inicio = somarDias(atual, -7 * (n - 1 - i));
    return { inicio, fim: somarDias(inicio, 6) };
  });
}

/** Últimos `n` meses, o último sendo o mês de hoje. */
export function mesesRecentes(hoje: DataLocal, n: number): MesRef[] {
  const atual = mesDaData(hoje);
  return Array.from({ length: n }, (_, i) => somarMeses(atual, -(n - 1 - i)));
}

export const intervaloDoMes = (m: MesRef): Intervalo => ({ inicio: primeiroDiaDoMes(m), fim: ultimoDiaDoMes(m) });

const dentro = (r: ResumoDia, i: Intervalo) => r.data >= i.inicio && r.data <= i.fim;

/** Gráfico semanal: dias completos de cada semana (0 a 7). Futuro e hoje em aberto não contam. */
export function diasCompletosPorIntervalo(
  resumos: ResumoDia[],
  intervalos: Intervalo[],
  primeiraData: DataLocal | undefined,
  hoje: DataLocal,
): number[] {
  return intervalos.map(
    (i) => resumirPeriodo(resumos.filter((r) => dentro(r, i)), primeiraData, hoje, null).periodo.diasCompletos,
  );
}

/** Gráfico mensal: consistência (%) de cada mês; null quando o mês não tem dias contados. */
export function consistenciaPorIntervalo(
  resumos: ResumoDia[],
  intervalos: Intervalo[],
  primeiraData: DataLocal | undefined,
  hoje: DataLocal,
): (number | null)[] {
  return intervalos.map(
    (i) => resumirPeriodo(resumos.filter((r) => dentro(r, i)), primeiraData, hoje, null).periodo.consistenciaPct,
  );
}

/** Quantidade acumulada de UM hábito em cada intervalo (resumos já filtrados por esse hábito). */
export function totaisPorIntervalo(resumosDoHabito: ResumoDia[], intervalos: Intervalo[], hoje: DataLocal): number[] {
  return intervalos.map((i) => {
    const total = resumosDoHabito
      .filter((r) => dentro(r, i) && r.data <= hoje && r.estado !== 'futuro')
      .reduce((s, r) => s + (r.habitos[0]?.total ?? 0), 0);
    return Math.round(total * 1e6) / 1e6;
  });
}

export interface DesempenhoHabito {
  habitoId: string;
  nome: string;
  feitos: number;
  programados: number;
  /** 0 a 100, ou null se não houve dia programado. */
  pct: number | null;
}

/** Desempenho de cada hábito no período (RF-50): "N de M dias feitos". */
export function desempenhoPorHabito(
  entradas: EntradaDia[],
  habitos: HabitoCompleto[],
  periodo: Intervalo,
  primeiraData: DataLocal | undefined,
  hoje: DataLocal,
): DesempenhoHabito[] {
  const doPeriodo = entradas.filter((e) => e.data >= periodo.inicio && e.data <= periodo.fim);
  return habitos
    .filter((h) => h.habito.status !== 'removido')
    .map((h) => {
      const r = resumirPeriodo(resumosDosDias(doPeriodo, h.habito.id), primeiraData, hoje, h.habito.id).habito;
      const feitos = r?.diasFeitos ?? 0;
      const programados = r?.diasProgramados ?? 0;
      return {
        habitoId: h.habito.id,
        nome: h.habito.nome,
        feitos,
        programados,
        pct: programados === 0 ? null : Math.round((feitos / programados) * 100),
      };
    });
}

/**
 * Mapa de calor (RF-52): colunas = semanas, cada coluna com 7 células (dias da semana,
 * na ordem de `inicioSemana`). Vai de 1º de janeiro a 31 de dezembro do ano; células
 * `null` ficam antes de 1º de janeiro e depois de 31 de dezembro.
 */
export function grelhaDoAno(ano: number, inicioSemana = 1): (DataLocal | null)[][] {
  const primeiro: DataLocal = `${ano}-01-01`;
  const ultimo: DataLocal = `${ano}-12-31`;
  const vazios = (diaDaSemana(primeiro) - inicioSemana + 7) % 7;
  const dias: (DataLocal | null)[] = Array(vazios).fill(null);
  for (let d: DataLocal = primeiro; d <= ultimo; d = somarDias(d, 1)) dias.push(d);
  while (dias.length % 7 !== 0) dias.push(null);
  const colunas: (DataLocal | null)[][] = [];
  for (let i = 0; i < dias.length; i += 7) colunas.push(dias.slice(i, i + 7));
  return colunas;
}

/** Índice da coluna da grade que contém `data`; -1 se não está no ano. */
export function colunaDaData(grelha: (DataLocal | null)[][], data: DataLocal): number {
  return grelha.findIndex((c) => c.includes(data));
}

/** Se a coluna contém o dia 1 de algum mês, devolve o número do mês (1 a 12); senão null. */
export function mesQueComecaNaColuna(coluna: (DataLocal | null)[]): number | null {
  const d = coluna.find((x) => x !== null && x.endsWith('-01'));
  return d ? Number(d.slice(5, 7)) : null;
}

export { diasNoMes };
