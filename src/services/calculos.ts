// Regras de cálculo (RF-C1 a RF-C10). Funções puras: não acessam o banco.
import type {
  DataLocal,
  Dia,
  Habito,
  Marcacao,
  Registro,
  TipoHabito,
  VersaoHabito,
} from '../types';
import { diaDaSemana, diasDaSemana } from './datas';

export interface HabitoCompleto {
  habito: Habito;
  versoes: VersaoHabito[];
}

export type EstadoDia =
  | 'completo'
  | 'parcial'
  | 'semdados'
  | 'folga'
  | 'descanso'
  | 'futuro';

export interface EntradaDia {
  data: DataLocal;
  /** Data lógica de hoje (já considerando o início do dia configurado). */
  hoje: DataLocal;
  habitos: HabitoCompleto[];
  /** Pode conter registros de outros dias; só os de `data` entram na conta. */
  registros: Registro[];
  /** Deve incluir a semana inteira de `data` (para hábitos semanais). */
  marcacoes: Marcacao[];
  dia?: Dia;
  inicioSemana?: number;
}

export interface ResumoHabito {
  habitoId: string;
  tipo: TipoHabito | null;
  programado: boolean;
  entraNoPercentual: boolean;
  /** 0 a 1; null = fora da conta (ex.: limite com o dia ainda aberto). */
  fracao: number | null;
  total: number;
  meta: number;
  metaBatida: boolean;
  metaSuperada: boolean;
  /** Quanto passou da meta (quantidade). 0 se não passou. */
  alemDaMeta: number;
  statusLimite: 'dentro' | 'acima' | null;
  /** RF-14b: total exatamente igual ao valor proposto (check do hábito de limite). */
  limiteAtingido: boolean;
  marcadoNoDia: boolean;
  contagemSemana: number | null;
  metaSemanaBatida: boolean | null;
}

export interface ResumoDia {
  data: DataLocal;
  estado: EstadoDia;
  /** Inteiro de 0 a 100; null quando não se aplica (descanso, folga, futuro). */
  percentual: number | null;
  fechado: boolean;
  habitos: ResumoHabito[];
  /** "X de N concluídas": X. */
  concluidas: number;
  /** "X de N concluídas": N (hábitos que entram na conta). */
  totalNoPercentual: number;
  metasSuperadas: number;
  /** Hábitos programados que ficam "à parte" do percentual. */
  foraDoPercentual: string[];
}

/** Evita erros de ponto flutuante (0,1 + 0,2) em somas de registros. */
export function arredondar(valor: number): number {
  return Math.round(valor * 1e6) / 1e6;
}

/** RF-C11: todo hábito programado para o dia entra no percentual, de qualquer tipo. */
export function entraNoPercentualPadrao(_tipo: TipoHabito): boolean {
  return true;
}

/**
 * RF-C7: versão do hábito que vale numa data = a mais recente com
 * vigenteDesde <= data. Em caso de empate, vale a última da lista.
 */
export function versaoVigente(versoes: VersaoHabito[], data: DataLocal): VersaoHabito | undefined {
  let melhor: VersaoHabito | undefined;
  for (const v of versoes) {
    if (v.vigenteDesde <= data && (!melhor || v.vigenteDesde >= melhor.vigenteDesde)) {
      melhor = v;
    }
  }
  return melhor;
}

/** O hábito está programado nessa data? (descanso = não programado, RF-C6) */
export function estaProgramado(h: HabitoCompleto, data: DataLocal): boolean {
  const v = versaoVigente(h.versoes, data);
  if (!v) return false;
  const { habito } = h;
  if (habito.dataInicial && data < habito.dataInicial) return false;
  if (habito.dataFinal && data > habito.dataFinal) return false;
  if (habito.arquivadoEm && data >= habito.arquivadoEm) return false;
  if (v.tipo === 'semanal') return true; // semanal aparece todos os dias
  if (v.frequencia.tipo === 'todos') return true;
  return v.frequencia.dias.includes(diaDaSemana(data));
}

/** RF-C20/C4: dias anteriores a hoje são tratados como fechados. */
export function estaFechado(data: DataLocal, hoje: DataLocal, dia?: Dia): boolean {
  return data < hoje || dia?.fechado === true;
}

/** RF-C3 */
export function metaBatida(total: number, meta: number): boolean {
  return arredondar(total) >= meta;
}
export function metaSuperada(total: number, meta: number): boolean {
  return arredondar(total) > meta;
}

/** RF-C4: igual ao limite ainda é "dentro do limite". */
export function statusDoLimite(total: number, limite: number): 'dentro' | 'acima' {
  return arredondar(total) <= limite ? 'dentro' : 'acima';
}

/** RF-14b: o check do limite só aparece quando o total é EXATAMENTE o valor proposto. */
export function limiteAtingido(total: number, limite: number): boolean {
  return arredondar(total) === arredondar(limite);
}

/**
 * RF-C1 e RF-C11: fração de um hábito para o percentual do dia (sempre de 0 a 1).
 * Limite: sobe até o valor proposto; passou do valor, vira 0.
 */
export function fracaoDoHabito(versao: VersaoHabito, total: number, marcado: boolean): number {
  switch (versao.tipo) {
    case 'conclusao':
    case 'semanal':
      return marcado ? 1 : 0;
    case 'quantidade':
      return versao.meta > 0 ? Math.min(arredondar(total) / versao.meta, 1) : 0;
    case 'limite':
      if (versao.meta <= 0 || statusDoLimite(total, versao.meta) === 'acima') return 0;
      return arredondar(total) / versao.meta;
  }
}

/** RF-C2: média das frações, teto de 100, arredondada para inteiro. */
export function percentualDasFracoes(fracoes: number[]): number | null {
  if (fracoes.length === 0) return null;
  const media = fracoes.reduce((a, b) => a + b, 0) / fracoes.length;
  return Math.min(100, Math.round(media * 100 + 1e-9));
}

export function calcularDia(e: EntradaDia): ResumoDia {
  const inicioSemana = e.inicioSemana ?? 1;
  const fechado = estaFechado(e.data, e.hoje, e.dia);
  const semana = diasDaSemana(e.data, inicioSemana);
  const registrosDoDia = e.registros.filter((r) => r.data === e.data);
  const marcacoesDoDia = e.marcacoes.filter((m) => m.data === e.data);

  const resumos: ResumoHabito[] = e.habitos.map((h) => {
    const v = versaoVigente(h.versoes, e.data);
    const programado = estaProgramado(h, e.data);
    const vazio: ResumoHabito = {
      habitoId: h.habito.id,
      tipo: v?.tipo ?? null,
      programado,
      entraNoPercentual: false,
      fracao: null,
      total: 0,
      meta: v?.meta ?? 0,
      metaBatida: false,
      metaSuperada: false,
      alemDaMeta: 0,
      statusLimite: null,
      limiteAtingido: false,
      marcadoNoDia: false,
      contagemSemana: null,
      metaSemanaBatida: null,
    };
    if (!v || !programado) return vazio;

    const total = arredondar(
      registrosDoDia.filter((r) => r.habitoId === h.habito.id).reduce((s, r) => s + r.valor, 0),
    );
    const marcado = marcacoesDoDia.some((m) => m.habitoId === h.habito.id);
    const fracao = fracaoDoHabito(v, total, marcado);

    const r: ResumoHabito = {
      ...vazio,
      entraNoPercentual: v.entraNoPercentual,
      fracao,
      total,
      marcadoNoDia: marcado,
    };
    if (v.tipo === 'quantidade') {
      r.metaBatida = metaBatida(total, v.meta);
      r.metaSuperada = metaSuperada(total, v.meta);
      r.alemDaMeta = r.metaSuperada ? arredondar(total - v.meta) : 0;
    }
    if (v.tipo === 'limite') {
      r.statusLimite = statusDoLimite(total, v.meta);
      r.limiteAtingido = limiteAtingido(total, v.meta);
    }
    if (v.tipo === 'semanal') {
      const datasMarcadas = new Set(
        e.marcacoes
          .filter((m) => m.habitoId === h.habito.id && semana.includes(m.data))
          .map((m) => m.data),
      );
      r.contagemSemana = datasMarcadas.size;
      r.metaSemanaBatida = datasMarcadas.size >= v.meta;
    }
    return r;
  });

  const contados = resumos.filter((r) => r.programado && r.entraNoPercentual && r.fracao !== null);
  const fracoes = contados.map((r) => r.fracao as number);
  const concluidas = contados.filter((r) => (r.fracao as number) >= 1).length;
  const metasSuperadas = resumos.filter((r) => r.programado && r.metaSuperada).length;
  const foraDoPercentual = resumos
    .filter((r) => r.programado && !contados.includes(r))
    .map((r) => r.habitoId);

  const haDados = registrosDoDia.length > 0 || marcacoesDoDia.length > 0;

  let estado: EstadoDia;
  if (e.data > e.hoje) estado = 'futuro';
  else if (e.dia?.folga) estado = 'folga';
  else if (contados.length === 0) estado = 'descanso';
  else if (!haDados) estado = 'semdados';
  else if (concluidas === contados.length) estado = 'completo';
  else estado = 'parcial';

  const semPercentual = estado === 'futuro' || estado === 'folga' || estado === 'descanso';

  return {
    data: e.data,
    estado,
    percentual: semPercentual ? null : percentualDasFracoes(fracoes),
    fechado,
    habitos: resumos,
    concluidas,
    totalNoPercentual: contados.length,
    metasSuperadas,
    foraDoPercentual,
  };
}

// ---------- RF-C10: período, consistência e sequências ----------

export interface DiaComEstado {
  data: DataLocal;
  estado: EstadoDia;
}

export interface ResumoPeriodo {
  diasCompletos: number;
  /** M: dias já passados desde o primeiro registro, sem folga, descanso e futuro. */
  diasDoPeriodo: number;
  /** N ÷ M em %, inteiro; null se M = 0. Número secundário. */
  consistenciaPct: number | null;
  sequenciaAtual: number;
  melhorSequencia: number;
  diasParciais: number;
  diasSemDados: number;
  diasFolga: number;
}

export function resumoDoPeriodo(
  dias: DiaComEstado[],
  primeiraData: DataLocal | undefined,
  hoje: DataLocal,
): ResumoPeriodo {
  const ordenados = [...dias].sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0));

  let diasCompletos = 0;
  let diasDoPeriodo = 0;
  let diasParciais = 0;
  let diasSemDados = 0;
  let diasFolga = 0;
  let corrente = 0;
  let melhor = 0;

  for (const d of ordenados) {
    if (d.estado === 'futuro' || d.data > hoje) continue;

    if (d.estado === 'folga') diasFolga++;

    // Hoje, enquanto não está completo, ainda não terminou: não entra na conta.
    const hojeEmAberto = d.data === hoje && d.estado !== 'completo';
    const contaNoPeriodo =
      primeiraData !== undefined &&
      d.data >= primeiraData &&
      !hojeEmAberto &&
      (d.estado === 'completo' || d.estado === 'parcial' || d.estado === 'semdados');
    if (contaNoPeriodo) {
      diasDoPeriodo++;
      if (d.estado === 'completo') diasCompletos++;
      if (d.estado === 'parcial') diasParciais++;
      if (d.estado === 'semdados') diasSemDados++;
    }

    // Sequência: completo soma; folga e descanso são pulados;
    // parcial e sem dados encerram (menos o dia de hoje, que ainda não acabou).
    if (d.estado === 'completo') {
      corrente++;
      if (corrente > melhor) melhor = corrente;
    } else if (d.estado === 'parcial' || d.estado === 'semdados') {
      if (d.data !== hoje) corrente = 0;
    }
  }

  return {
    diasCompletos,
    diasDoPeriodo,
    consistenciaPct:
      diasDoPeriodo === 0 ? null : Math.round((diasCompletos / diasDoPeriodo) * 100 + 1e-9),
    sequenciaAtual: corrente,
    melhorSequencia: melhor,
    diasParciais,
    diasSemDados,
    diasFolga,
  };
}
