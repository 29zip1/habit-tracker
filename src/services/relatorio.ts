// Fase 7, Parte B (RF-51): contas, texto e CSV do relatório. Sem acesso ao banco nem à tela.
import type { DataLocal, TipoHabito } from '../types';
import { versaoVigente, type EntradaDia, type HabitoCompleto } from './calculos';
import { ehDataValida, inicioDaSemana } from './datas';
import { BOM, escapar, numeroPtBr } from './csv';
import {
  primeiroDiaDoMes,
  resumirPeriodo,
  resumosDosDias,
  somarMeses,
  ultimoDiaDoMes,
  mesDaData,
  type Intervalo,
} from './historico';
import { formatarNumero } from './textos';
import type { ResumoPeriodo } from './calculos';

export type TipoRelatorio = 'semana' | 'mes' | 'mesAnterior' | 'personalizado';

export const ROTULOS_RELATORIO: Record<TipoRelatorio, string> = {
  semana: 'Esta semana',
  mes: 'Este mês',
  mesAnterior: 'Mês anterior',
  personalizado: 'Datas personalizadas',
};

export const MAXIMO_DIAS_RELATORIO = 366;

export type ResultadoPeriodo = { ok: true; periodo: Intervalo } | { ok: false; erro: string };

const dataBr = (d: DataLocal) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;
const diasEntre = (a: DataLocal, b: DataLocal) =>
  Math.round((new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / 86_400_000);

/** Período do relatório. Nunca inclui dias futuros: o fim é cortado em hoje. */
export function periodoDoRelatorio(
  tipo: TipoRelatorio,
  hoje: DataLocal,
  inicioSemana = 1,
  personalizado?: { inicio: string; fim: string },
): ResultadoPeriodo {
  const corta = (i: Intervalo): Intervalo => ({ inicio: i.inicio, fim: i.fim > hoje ? hoje : i.fim });
  switch (tipo) {
    case 'semana':
      return { ok: true, periodo: { inicio: inicioDaSemana(hoje, inicioSemana), fim: hoje } };
    case 'mes':
      return { ok: true, periodo: { inicio: primeiroDiaDoMes(mesDaData(hoje)), fim: hoje } };
    case 'mesAnterior': {
      const m = somarMeses(mesDaData(hoje), -1);
      return { ok: true, periodo: { inicio: primeiroDiaDoMes(m), fim: ultimoDiaDoMes(m) } };
    }
    case 'personalizado': {
      const { inicio, fim } = personalizado ?? { inicio: '', fim: '' };
      if (!ehDataValida(inicio) || !ehDataValida(fim)) return { ok: false, erro: 'Escolha a data inicial e a data final.' };
      if (inicio > hoje) return { ok: false, erro: 'A data inicial não pode ser no futuro.' };
      if (fim < inicio) return { ok: false, erro: 'A data final não pode ser antes da data inicial.' };
      const periodo = corta({ inicio, fim });
      if (diasEntre(periodo.inicio, periodo.fim) + 1 > MAXIMO_DIAS_RELATORIO) {
        return { ok: false, erro: `O período pode ter no máximo ${MAXIMO_DIAS_RELATORIO} dias (cerca de 1 ano).` };
      }
      return { ok: true, periodo };
    }
  }
}

export interface LinhaHabito {
  habitoId: string;
  nome: string;
  tipo: TipoHabito;
  unidade: string;
  /** Apagado mantendo o histórico (RF-32b). */
  apagado: boolean;
  diasProgramados: number;
  diasFeitos: number;
  total: number;
  mediaPorDia: number | null;
  metasSuperadas: number;
  /** Só para hábito de limite; null nos outros tipos. */
  diasDentroDoLimite: number | null;
}

export interface NotaDoDia {
  data: DataLocal;
  texto: string;
}

export interface Relatorio {
  periodo: Intervalo;
  rotuloPeriodo: string;
  geradoEm: DataLocal;
  resumo: ResumoPeriodo;
  metasSuperadas: number;
  habitos: LinhaHabito[];
  notas: NotaDoDia[];
}

const arredondar = (n: number, casas: number) => Math.round(n * 10 ** casas) / 10 ** casas;

/**
 * Monta o relatório. `entradas` deve cobrir pelo menos o período (pode ter mais dias).
 * Dias futuros nunca entram; dia sem dados é "sem dados", nunca falha.
 */
export function montarRelatorio(
  entradas: EntradaDia[],
  habitos: HabitoCompleto[],
  periodo: Intervalo,
  rotuloPeriodo: string,
  primeiraData: DataLocal | undefined,
  hoje: DataLocal,
): Relatorio {
  const doPeriodo = entradas.filter((e) => e.data >= periodo.inicio && e.data <= periodo.fim);
  const geral = resumirPeriodo(resumosDosDias(doPeriodo, null), primeiraData, hoje, null);

  const linhas: LinhaHabito[] = [];
  for (const h of habitos) {
    const versao = versaoVigente(h.versoes, periodo.fim) ?? [...h.versoes].sort((a, b) => (a.vigenteDesde < b.vigenteDesde ? -1 : 1)).at(-1);
    if (!versao) continue;
    let diasProgramados = 0;
    let diasFeitos = 0;
    let total = 0;
    let metasSuperadas = 0;
    let dentro = 0;
    for (const r of resumosDosDias(doPeriodo, h.habito.id)) {
      const x = r.habitos[0];
      if (!x || !x.programado || r.estado === 'folga' || r.estado === 'futuro' || r.data > hoje) continue;
      if (primeiraData === undefined || r.data < primeiraData) continue;
      const feito = (x.fracao ?? 0) >= 1;
      if (r.data === hoje && !feito) continue; // hoje em aberto ainda não terminou
      diasProgramados++;
      if (feito) diasFeitos++;
      total += x.total;
      if (x.metaSuperada) metasSuperadas++;
      if (x.tipo === 'limite' && x.total > 0 && x.statusLimite === 'dentro') dentro++;
    }
    const apagado = h.habito.status === 'removido';
    if (diasProgramados === 0 && (apagado || h.habito.status === 'arquivado')) continue;
    linhas.push({
      habitoId: h.habito.id,
      nome: h.habito.nome,
      tipo: versao.tipo,
      unidade: versao.unidade,
      apagado,
      diasProgramados,
      diasFeitos,
      total: arredondar(total, 6),
      mediaPorDia: diasProgramados === 0 ? null : arredondar(total / diasProgramados, 2),
      metasSuperadas,
      diasDentroDoLimite: versao.tipo === 'limite' ? dentro : null,
    });
  }

  const notas = doPeriodo
    .filter((e) => (e.dia?.nota ?? '').trim() !== '')
    .map((e) => ({ data: e.data, texto: (e.dia?.nota ?? '').trim() }))
    .sort((a, b) => (a.data < b.data ? -1 : 1));

  return { periodo, rotuloPeriodo, geradoEm: hoje, resumo: geral.periodo, metasSuperadas: geral.metasSuperadas, habitos: linhas, notas };
}

const NOME_DO_TIPO: Record<TipoHabito, string> = {
  conclusao: 'sim ou não',
  quantidade: 'quantidade',
  limite: 'limite',
  semanal: 'vezes por semana',
};

const dias = (n: number) => `${formatarNumero(n)} ${n === 1 ? 'dia' : 'dias'}`;

/** Texto simples para colar numa mensagem ou nota. */
export function textoDoRelatorio(r: Relatorio): string {
  const p = r.resumo;
  const L: string[] = [];
  L.push('RELATÓRIO DO HABIT TRACKER');
  L.push(`Período: ${dataBr(r.periodo.inicio)} a ${dataBr(r.periodo.fim)} (${r.rotuloPeriodo})`);
  L.push(`Gerado em ${dataBr(r.geradoEm)}`);
  L.push('');
  L.push('RESUMO');
  L.push(
    p.diasDoPeriodo === 0
      ? 'Dias completos: sem dias para contar neste período'
      : `Dias completos: ${p.diasCompletos} de ${p.diasDoPeriodo} (${p.consistenciaPct}% dos dias do período)`,
  );
  L.push(`Dias parciais: ${p.diasParciais}`);
  L.push(`Dias sem dados: ${p.diasSemDados}`);
  L.push(`Dias de folga: ${p.diasFolga}`);
  if (r.periodo.fim >= r.geradoEm) L.push(`Sequência atual: ${dias(p.sequenciaAtual)}`);
  L.push(`Melhor sequência: ${dias(p.melhorSequencia)}`);
  L.push(`Metas superadas: ${r.metasSuperadas}`);
  L.push('');
  L.push('POR HÁBITO');
  if (r.habitos.length === 0) L.push('Nenhum hábito neste período.');
  for (const h of r.habitos) {
    L.push(`${h.nome}${h.apagado ? ' (apagado)' : ''} (${NOME_DO_TIPO[h.tipo]})`);
    L.push(h.diasProgramados === 0 ? '  Dias feitos: sem dias programados' : `  Dias feitos: ${h.diasFeitos} de ${h.diasProgramados}`);
    if (h.tipo === 'quantidade' || h.tipo === 'limite') {
      L.push(`  Total: ${formatarNumero(h.total)} ${h.unidade}`);
      L.push(`  Média por dia programado: ${h.mediaPorDia === null ? '—' : `${formatarNumero(h.mediaPorDia)} ${h.unidade}`}`);
    }
    if (h.tipo === 'quantidade') L.push(`  Metas superadas: ${h.metasSuperadas}`);
    if (h.tipo === 'limite') L.push(`  Dias dentro do limite: ${h.diasDentroDoLimite}`);
  }
  if (r.notas.length > 0) {
    L.push('');
    L.push('NOTAS');
    for (const n of r.notas) L.push(`${dataBr(n.data).slice(0, 5)} - ${n.texto}`);
  }
  L.push('');
  L.push('Dias sem dados não são falha; dias de folga não contam.');
  return L.join('\n') + '\n';
}

const linha = (campos: string[]) => campos.map(escapar).join(';');

/** CSV em três blocos separados por linha em branco: resumo, hábitos e notas. */
export function csvDoRelatorio(r: Relatorio): string {
  const p = r.resumo;
  const num = (n: number | null) => (n === null ? '' : numeroPtBr(n));
  const L: string[] = [];
  L.push(linha(['periodo_inicio', 'periodo_fim', 'dias_completos', 'dias_contados', 'consistencia_pct', 'dias_parciais', 'dias_sem_dados', 'dias_de_folga', 'sequencia_atual', 'melhor_sequencia', 'metas_superadas']));
  L.push(linha([r.periodo.inicio, r.periodo.fim, num(p.diasCompletos), num(p.diasDoPeriodo), num(p.consistenciaPct), num(p.diasParciais), num(p.diasSemDados), num(p.diasFolga), num(p.sequenciaAtual), num(p.melhorSequencia), num(r.metasSuperadas)]));
  L.push('');
  L.push(linha(['habito', 'tipo', 'unidade', 'apagado', 'dias_programados', 'dias_feitos', 'total', 'media_por_dia', 'metas_superadas', 'dias_dentro_do_limite']));
  for (const h of r.habitos) {
    L.push(
      linha([
        h.nome,
        NOME_DO_TIPO[h.tipo],
        h.unidade,
        h.apagado ? 'sim' : 'nao',
        num(h.diasProgramados),
        num(h.diasFeitos),
        h.tipo === 'quantidade' || h.tipo === 'limite' ? num(h.total) : '',
        h.tipo === 'quantidade' || h.tipo === 'limite' ? num(h.mediaPorDia) : '',
        h.tipo === 'quantidade' ? num(h.metasSuperadas) : '',
        num(h.diasDentroDoLimite),
      ]),
    );
  }
  L.push('');
  L.push(linha(['data', 'nota']));
  for (const n of r.notas) L.push(linha([n.data, n.texto]));
  return BOM + L.join('\r\n') + '\r\n';
}

/** Nomes dos arquivos exportados. */
export function nomeArquivoRelatorio(periodo: Intervalo, extensao: 'txt' | 'csv'): string {
  return `habit-tracker-relatorio-${periodo.inicio}-a-${periodo.fim}.${extensao}`;
}

