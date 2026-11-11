// Fase 5: regras do formulário de hábitos (criar e editar). Sem acesso ao banco.
import type { DadosVersao } from '../database/operacoes';
import type { DataLocal, Habito, TipoHabito, VersaoHabito } from '../types';
import { ehDataValida } from './datas';
import { formatarNumero } from './textos';

export const UNIDADES = ['min', 'h', 'páginas', 'ml', 'L', 'kcal', 'g', 'km', 'passos', 'copos', 'repetições', 'vezes'];
export const OUTRA_UNIDADE = '__outra__';

/** Paleta de 8 cores de meio-tom, legíveis nos temas claro e escuro. */
export const PALETA_CORES = ['#0B7A43', '#1F6FB5', '#7A4FC2', '#C2410C', '#B4235A', '#0E8A8A', '#8A6D00', '#5C6670'];

export const NOMES_DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

export const TIPOS: { tipo: TipoHabito; nome: string; ajuda: string }[] = [
  { tipo: 'conclusao', nome: 'Sim ou não', ajuda: 'Você marca quando fez. Ex.: meditar.' },
  { tipo: 'quantidade', nome: 'Quantidade', ajuda: 'Tem uma meta por dia e botões para somar. Ex.: água, páginas.' },
  { tipo: 'limite', nome: 'Limite', ajuda: 'Um valor que você quer atingir sem passar. Ex.: calorias.' },
  { tipo: 'semanal', nome: 'Vezes por semana', ajuda: 'Marca o dia; a meta é quantos dias na semana. Ex.: treino.' },
];

/** Estado do formulário: tudo como texto, do jeito que a pessoa digita. */
export interface FormHabito {
  nome: string;
  descricao: string;
  icone: string;
  cor: string;
  categoria: string;
  tipo: TipoHabito;
  /** Valor da lista, ou OUTRA_UNIDADE (aí vale `unidadeOutra`). */
  unidade: string;
  unidadeOutra: string;
  meta: string;
  blocos: string[];
  passo: string;
  /** null = todos os dias. */
  dias: number[] | null;
  dataInicial: string;
  dataFinal: string;
  entra: boolean;
}

export function formularioVazio(): FormHabito {
  return {
    nome: '',
    descricao: '',
    icone: 'target',
    cor: PALETA_CORES[0],
    categoria: 'geral',
    tipo: 'quantidade',
    unidade: 'min',
    unidadeOutra: '',
    meta: '30',
    blocos: ['10'],
    passo: '1',
    dias: null,
    dataInicial: '',
    dataFinal: '',
    entra: true,
  };
}

/** Texto de número no formato pt-BR ("2,5") ou com ponto. Vazio ou inválido = NaN. */
export function numeroDoTexto(texto: string): number {
  const limpo = texto.trim().replace(',', '.');
  if (limpo === '' || !/^\d*\.?\d*$/.test(limpo)) return NaN;
  return Number(limpo);
}

const comoTexto = (n: number) => String(n).replace('.', ',');

export function habitoParaFormulario(habito: Habito, v: VersaoHabito): FormHabito {
  const naLista = UNIDADES.includes(v.unidade);
  return {
    nome: habito.nome,
    descricao: habito.descricao ?? '',
    icone: habito.icone,
    cor: habito.cor,
    categoria: habito.categoria,
    tipo: v.tipo,
    unidade: v.unidade === '' || naLista ? v.unidade || 'min' : OUTRA_UNIDADE,
    unidadeOutra: naLista || v.unidade === '' ? '' : v.unidade,
    meta: comoTexto(v.meta),
    blocos: v.blocos.length > 0 ? v.blocos.map(comoTexto) : ['10'],
    passo: comoTexto(v.passoAjuste),
    dias: v.frequencia.tipo === 'dias' ? [...v.frequencia.dias] : null,
    dataInicial: habito.dataInicial ?? '',
    dataFinal: habito.dataFinal ?? '',
    entra: v.entraNoPercentual,
  };
}

export interface CamposHabito {
  nome: string;
  descricao?: string;
  icone: string;
  cor: string;
  categoria: string;
  dataInicial?: DataLocal;
  dataFinal?: DataLocal;
}

export type ResultadoForm = { ok: true; campos: CamposHabito; versao: DadosVersao } | { ok: false; erro: string };

/** Valida o formulário e converte para os dados do banco. Mensagens em português simples. */
export function lerFormulario(f: FormHabito): ResultadoForm {
  const nome = f.nome.trim();
  if (!nome) return { ok: false, erro: 'Dê um nome ao hábito.' };

  let unidade = '';
  if (f.tipo === 'semanal') unidade = 'vezes';
  else if (f.tipo !== 'conclusao') {
    unidade = (f.unidade === OUTRA_UNIDADE ? f.unidadeOutra : f.unidade).trim();
    if (!unidade) return { ok: false, erro: 'Escolha ou escreva a unidade (por exemplo, páginas).' };
  }

  let meta = 1;
  if (f.tipo !== 'conclusao') {
    meta = numeroDoTexto(f.meta);
    if (!(meta > 0)) return { ok: false, erro: 'A meta precisa ser um número maior que zero.' };
    if (f.tipo === 'semanal' && (!Number.isInteger(meta) || meta > 7)) {
      return { ok: false, erro: 'Vezes por semana: um número inteiro de 1 a 7.' };
    }
  }

  let blocos: number[] = [];
  if (f.tipo === 'quantidade' || f.tipo === 'limite') {
    const textos = f.blocos.map((b) => b.trim()).filter((b) => b !== '');
    blocos = textos.map(numeroDoTexto);
    if (blocos.length === 0) return { ok: false, erro: 'Coloque pelo menos 1 botão (bloco) para somar.' };
    if (blocos.length > 3) return { ok: false, erro: 'No máximo 3 botões (blocos).' };
    if (blocos.some((b) => !(b > 0))) return { ok: false, erro: 'Os botões (blocos) precisam ser números maiores que zero.' };
  }

  let passo = 1;
  if (f.tipo === 'quantidade' || f.tipo === 'limite') {
    passo = numeroDoTexto(f.passo);
    if (!(passo > 0)) return { ok: false, erro: 'O passo dos botões − e + precisa ser maior que zero.' };
  }

  if (f.tipo !== 'semanal' && f.dias !== null && f.dias.length === 0) {
    return { ok: false, erro: 'Escolha pelo menos um dia da semana.' };
  }

  const dataInicial = f.dataInicial.trim();
  const dataFinal = f.dataFinal.trim();
  if (dataInicial && !ehDataValida(dataInicial)) return { ok: false, erro: 'Data inicial inválida.' };
  if (dataFinal && !ehDataValida(dataFinal)) return { ok: false, erro: 'Data final inválida.' };
  if (dataInicial && dataFinal && dataFinal < dataInicial) {
    return { ok: false, erro: 'A data final não pode ser antes da data inicial.' };
  }

  return {
    ok: true,
    campos: {
      nome,
      descricao: f.descricao.trim() || undefined,
      icone: f.icone,
      cor: f.cor,
      categoria: f.categoria.trim() || 'geral',
      dataInicial: dataInicial || undefined,
      dataFinal: dataFinal || undefined,
    },
    versao: {
      tipo: f.tipo,
      unidade,
      meta,
      blocos,
      frequencia:
        f.tipo === 'semanal' || f.dias === null
          ? { tipo: 'todos' }
          : { tipo: 'dias', dias: [...f.dias].sort((a, b) => a - b) },
      entraNoPercentual: f.entra,
      passoAjuste: passo,
    },
  };
}

const mesmaLista = (a: number[], b: number[]) => a.length === b.length && a.every((x, i) => x === b[i]);

/** A configuração mudou de um jeito que exige "valer a partir de"? (RF-31) */
export function versaoMudou(atual: VersaoHabito, nova: DadosVersao): boolean {
  const freqAtual = atual.frequencia.tipo === 'dias' ? atual.frequencia.dias : null;
  const freqNova = nova.frequencia?.tipo === 'dias' ? nova.frequencia.dias : null;
  const freqIgual =
    freqAtual === null || freqNova === null ? freqAtual === freqNova : mesmaLista(freqAtual, freqNova);
  return !(
    atual.tipo === nova.tipo &&
    atual.unidade === nova.unidade &&
    atual.meta === nova.meta &&
    mesmaLista(atual.blocos, nova.blocos ?? []) &&
    freqIgual &&
    atual.entraNoPercentual === (nova.entraNoPercentual ?? true) &&
    // O passo só importa onde existe a janela de valor.
    (atual.tipo === 'quantidade' || atual.tipo === 'limite' ? atual.passoAjuste === nova.passoAjuste : true)
  );
}

/** Texto curto que descreve a configuração, para a lista da aba Hábitos. */
export function descreverVersao(v: VersaoHabito): string {
  let base: string;
  switch (v.tipo) {
    case 'conclusao':
      base = 'Sim ou não';
      break;
    case 'semanal':
      base = `${formatarNumero(v.meta)} ${v.meta === 1 ? 'vez' : 'vezes'} por semana`;
      break;
    case 'quantidade':
      base = `${formatarNumero(v.meta)} ${v.unidade} por dia`;
      break;
    case 'limite':
      base = `Até ${formatarNumero(v.meta)} ${v.unidade} por dia`;
      break;
  }
  if (v.blocos.length > 0) base += ` · botões ${v.blocos.map((b) => `+${formatarNumero(b)}`).join(' ')}`;
  if (v.frequencia.tipo === 'dias') base += ` · ${v.frequencia.dias.map((d) => NOMES_DIAS[d]).join(', ')}`;
  return base;
}
