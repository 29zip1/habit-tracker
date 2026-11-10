// Textos e formatação em português do Brasil para a tela Hoje.
// Ficam fora dos componentes para poderem ser testados sozinhos.
import type { DataLocal } from '../types';
import {
  arredondar,
  metaBatida,
  metaSuperada,
  statusDoLimite,
  type EstadoDia,
  type ResumoDia,
} from './calculos';
import { diaDaSemana, paraDate } from './datas';

const DIAS_LONGOS = ['DOMINGO', 'SEGUNDA-FEIRA', 'TERÇA-FEIRA', 'QUARTA-FEIRA', 'QUINTA-FEIRA', 'SEXTA-FEIRA', 'SÁBADO'];
const DIAS_CURTOS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const DIAS_NOME = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const MESES = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];

export const diaSemanaLongo = (data: DataLocal) => DIAS_LONGOS[diaDaSemana(data)];
export const diaSemanaCurto = (data: DataLocal) => DIAS_CURTOS[diaDaSemana(data)];
export const diaSemanaNome = (data: DataLocal) => DIAS_NOME[diaDaSemana(data)];
export const numeroDoDia = (data: DataLocal) => paraDate(data).getDate();

/** "10 NOV" */
export function dataCabecalho(data: DataLocal): string {
  const d = paraDate(data);
  return `${d.getDate()} ${MESES[d.getMonth()]}`;
}

/** "10/11" (para avisos como "Editando 09/11") */
export function dataCurta(data: DataLocal): string {
  const d = paraDate(data);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Números no padrão pt-BR: 2.000 e 2,5. */
export function formatarNumero(n: number): string {
  return arredondar(n).toLocaleString('pt-BR', { maximumFractionDigits: 3 });
}

function abreviarUnidade(unidade: string): string {
  return unidade === 'páginas' ? 'pág' : unidade;
}

/** Rótulo do botão de bloco: "+10 min" (um bloco) ou "+250" (vários blocos). */
export function rotuloBloco(valor: number, unidade: string, quantidadeDeBlocos: number): string {
  return quantidadeDeBlocos > 1
    ? `+${formatarNumero(valor)}`
    : `+${formatarNumero(valor)} ${abreviarUnidade(unidade)}`.trim();
}

export function textoQuantidade(total: number, meta: number, unidade: string): string {
  if (!metaBatida(total, meta)) return `${formatarNumero(total)} / ${formatarNumero(meta)} ${unidade}`;
  if (!metaSuperada(total, meta)) return `Meta batida · ${formatarNumero(total)} ${unidade}`;
  return `${formatarNumero(total)} ${unidade} · +${formatarNumero(total - meta)} além da meta`;
}

export function textoLimite(total: number, limite: number, unidade: string): string {
  const situacao = statusDoLimite(total, limite) === 'dentro' ? 'dentro do limite' : 'acima do limite';
  return `${formatarNumero(total)} de ${formatarNumero(limite)} ${unidade} · ${situacao}`;
}

export function textoSemanal(contagem: number, meta: number, marcadoNoDia: boolean, ehHoje: boolean): string {
  if (contagem >= meta) return `Meta da semana batida · ${meta} de ${meta}`;
  const feito = marcadoNoDia ? (ehHoje ? ' · hoje feito' : ' · feito neste dia') : '';
  return `${contagem} de ${meta} na semana${feito}`;
}

export function textoConclusao(marcado: boolean, ehHoje: boolean): string {
  if (!marcado) return 'Ainda não registrado';
  return ehHoje ? 'Concluído hoje' : 'Concluído neste dia';
}

export function etiquetaStatus(r: Pick<ResumoDia, 'estado' | 'percentual'>): string {
  switch (r.estado) {
    case 'completo':
      return 'Dia completo';
    case 'folga':
      return 'Dia de folga';
    case 'descanso':
      return 'Descanso';
    default:
      return r.percentual === 0 ? 'Não iniciado' : 'Em andamento';
  }
}

/** "treino e calorias", "a, b e c" */
export function listaComE(nomes: string[]): string {
  if (nomes.length <= 1) return nomes.join('');
  return `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}`;
}

/** Texto abaixo da barra de progresso (RF-01). */
export function textoConcluidas(r: ResumoDia, nomesForaDoPercentual: string[]): string {
  if (r.estado === 'completo') {
    const extra =
      r.metasSuperadas > 0
        ? ` · ${r.metasSuperadas} ${r.metasSuperadas === 1 ? 'meta superada' : 'metas superadas'}`
        : '';
    return `Dia completo${extra}`;
  }
  if (r.estado === 'folga') return 'Dia de folga · não entra nas contas';
  if (r.estado === 'descanso') return 'Nenhum hábito entra no percentual neste dia';
  const aParte =
    nomesForaDoPercentual.length > 0
      ? ` · ${listaComE(nomesForaDoPercentual.map((n) => n.toLowerCase()))} à parte`
      : '';
  return `${r.concluidas} de ${r.totalNoPercentual} concluídas${aParte}`;
}

export function textoRegistros(n: number): string {
  return `${n} ${n === 1 ? 'registro' : 'registros'}`;
}

/** Descrição falada da faixa de 7 dias (VoiceOver). */
export function descricaoEstado(estado: EstadoDia): string {
  switch (estado) {
    case 'completo':
      return 'dia completo';
    case 'parcial':
      return 'dia parcial';
    case 'semdados':
      return 'sem dados';
    case 'folga':
      return 'dia de folga';
    case 'descanso':
      return 'descanso';
    case 'futuro':
      return 'dia futuro';
  }
}
