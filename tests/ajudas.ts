// Fábricas simples para montar hábitos e registros nos testes.
import type { Dia, Habito, Marcacao, Registro, TipoHabito, VersaoHabito, Frequencia } from '../src/types';
import type { HabitoCompleto } from '../src/services/calculos';

let contador = 0;
const id = (p: string) => `${p}-${++contador}`;

export interface OpcoesHabito {
  nome?: string;
  tipo: TipoHabito;
  meta?: number;
  unidade?: string;
  blocos?: number[];
  frequencia?: Frequencia;
  entra?: boolean;
  desde?: string;
  dataInicial?: string;
  dataFinal?: string;
  arquivadoEm?: string;
}

export function habito(o: OpcoesHabito): HabitoCompleto {
  const hid = id('h');
  const h: Habito = {
    id: hid,
    nome: o.nome ?? hid,
    icone: 'x',
    cor: '#0B7A43',
    categoria: 'geral',
    ordem: contador,
    status: o.arquivadoEm ? 'arquivado' : 'ativo',
    dataInicial: o.dataInicial,
    dataFinal: o.dataFinal,
    arquivadoEm: o.arquivadoEm,
    criadoEm: '2026-01-01T00:00:00.000Z',
    editadoEm: '2026-01-01T00:00:00.000Z',
  };
  const padraoEntra = o.tipo === 'conclusao' || o.tipo === 'quantidade';
  const v: VersaoHabito = {
    id: id('v'),
    habitoId: hid,
    vigenteDesde: o.desde ?? '2026-01-01',
    tipo: o.tipo,
    unidade: o.unidade ?? 'un',
    meta: o.meta ?? 1,
    blocos: o.blocos ?? [],
    frequencia: o.frequencia ?? { tipo: 'todos' },
    entraNoPercentual: o.entra ?? padraoEntra,
    passoAjuste: 1,
  };
  return { habito: h, versoes: [v] };
}

export function reg(hab: HabitoCompleto, valor: number, data: string, horario = '08:00'): Registro {
  return {
    id: id('r'),
    habitoId: hab.habito.id,
    valor,
    data,
    horario,
    origem: 'bloco',
    criadoEm: '2026-01-01T00:00:00.000Z',
    editadoEm: '2026-01-01T00:00:00.000Z',
  };
}

export function marca(hab: HabitoCompleto, data: string): Marcacao {
  return { id: id('m'), habitoId: hab.habito.id, data, criadoEm: '2026-01-01T00:00:00.000Z' };
}

export function dia(data: string, o: Partial<Dia> = {}): Dia {
  return { data, fechado: false, folga: false, ...o };
}
