// Fase 5, Parte B (RF-34): importar hábitos de um arquivo. Só ACRESCENTA hábitos;
// nunca apaga nem troca nada do que já existe, e não traz registros.
import type { BancoHabitos } from '../database/db';
import { criarCopiaDeSeguranca } from '../database/copias';
import { validarVersao, type DadosVersao, type NovoHabito, type Operacoes } from '../database/operacoes';
import type { DataLocal, Frequencia, TipoHabito } from '../types';

export const FORMATO_HABITOS = 'habit-tracker-habitos';
export const VERSAO_ARQUIVO_HABITOS = 1;
const MAXIMO_HABITOS = 200;
const TIPOS: TipoHabito[] = ['conclusao', 'quantidade', 'limite', 'semanal'];

export interface HabitoImportado {
  nome: string;
  descricao?: string;
  icone: string;
  cor: string;
  categoria: string;
  tipo: TipoHabito;
  unidade: string;
  meta: number;
  blocos: number[];
  frequencia: Frequencia;
  entraNoPercentual: boolean;
  passoAjuste: number;
}

export interface ArquivoHabitos {
  formato: typeof FORMATO_HABITOS;
  versaoArquivo: number;
  habitos: HabitoImportado[];
}

export type ResultadoLeitura = { ok: true; habitos: HabitoImportado[] } | { ok: false; erro: string };

const ehObjeto = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const ehTexto = (x: unknown): x is string => typeof x === 'string';
const ehNumero = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);

function validarItem(x: unknown): string | HabitoImportado {
  if (!ehObjeto(x)) return 'não é um hábito';
  if (!ehTexto(x.nome) || !x.nome.trim() || x.nome.length > 60) return 'nome inválido';
  if (x.descricao !== undefined && (!ehTexto(x.descricao) || x.descricao.length > 100)) return 'descrição inválida';
  if (!ehTexto(x.icone) || x.icone.length > 40) return 'ícone inválido';
  if (!ehTexto(x.cor) || !/^#[0-9a-fA-F]{6}$/.test(x.cor)) return 'cor inválida';
  if (!ehTexto(x.categoria) || x.categoria.length > 30) return 'categoria inválida';
  if (!ehTexto(x.tipo) || !TIPOS.includes(x.tipo as TipoHabito)) return 'tipo inválido';
  if (!ehTexto(x.unidade) || x.unidade.length > 12) return 'unidade inválida';
  if (!ehNumero(x.meta)) return 'meta inválida';
  if (!Array.isArray(x.blocos) || !x.blocos.every(ehNumero)) return 'botões inválidos';
  if (!ehNumero(x.passoAjuste)) return 'passo inválido';
  if (typeof x.entraNoPercentual !== 'boolean') return 'opção de percentual inválida';
  const f = x.frequencia;
  if (!ehObjeto(f) || (f.tipo !== 'todos' && f.tipo !== 'dias')) return 'frequência inválida';
  if (f.tipo === 'dias' && (!Array.isArray(f.dias) || !f.dias.every((d) => Number.isInteger(d) && d >= 0 && d <= 6))) {
    return 'dias da semana inválidos';
  }
  const item: HabitoImportado = {
    nome: x.nome.trim(),
    descricao: x.descricao as string | undefined,
    icone: x.icone,
    cor: x.cor,
    categoria: x.categoria.trim() || 'Geral',
    tipo: x.tipo as TipoHabito,
    unidade: x.unidade,
    meta: x.meta,
    blocos: x.blocos as number[],
    frequencia: f.tipo === 'todos' ? { tipo: 'todos' } : { tipo: 'dias', dias: f.dias as number[] },
    entraNoPercentual: x.entraNoPercentual,
    passoAjuste: x.passoAjuste,
  };
  try {
    validarVersao(item as DadosVersao);
  } catch (e) {
    return e instanceof Error ? e.message.replace(/\.$/, '').toLowerCase() : 'configuração inválida';
  }
  if (!(item.passoAjuste > 0)) return 'passo inválido';
  return item;
}

/** Lê e valida o texto do arquivo. Qualquer problema recusa o arquivo inteiro. */
export function lerArquivoHabitos(texto: string): ResultadoLeitura {
  let obj: unknown;
  try {
    obj = JSON.parse(texto.replace(/^﻿/, ''));
  } catch {
    return { ok: false, erro: 'Este arquivo não é um arquivo de hábitos do Habit Tracker (não consegui ler).' };
  }
  if (!ehObjeto(obj) || obj.formato !== FORMATO_HABITOS) {
    return { ok: false, erro: 'Este arquivo não é um arquivo de hábitos do Habit Tracker.' };
  }
  if (!ehNumero(obj.versaoArquivo) || obj.versaoArquivo > VERSAO_ARQUIVO_HABITOS) {
    return { ok: false, erro: 'Este arquivo é de uma versão mais nova do app. Atualize o app e tente de novo.' };
  }
  if (!Array.isArray(obj.habitos) || obj.habitos.length === 0) {
    return { ok: false, erro: 'O arquivo não tem nenhum hábito.' };
  }
  if (obj.habitos.length > MAXIMO_HABITOS) {
    return { ok: false, erro: `O arquivo tem hábitos demais (o máximo é ${MAXIMO_HABITOS}).` };
  }
  const habitos: HabitoImportado[] = [];
  for (let i = 0; i < obj.habitos.length; i++) {
    const r = validarItem(obj.habitos[i]);
    if (typeof r === 'string') return { ok: false, erro: `Hábito ${i + 1}: ${r}.` };
    habitos.push(r);
  }
  return { ok: true, habitos };
}

export function serializarArquivoHabitos(habitos: HabitoImportado[]): string {
  const arquivo: ArquivoHabitos = { formato: FORMATO_HABITOS, versaoArquivo: VERSAO_ARQUIVO_HABITOS, habitos };
  return JSON.stringify(arquivo, null, 2);
}

const chaveNome = (n: string) => n.trim().toLowerCase();

export interface PreviaImportacao {
  novos: HabitoImportado[];
  jaExistem: HabitoImportado[];
}

/** Separa o que será criado do que já existe (mesmo nome, ignorando maiúsculas). */
export async function preverImportacao(db: BancoHabitos, habitos: HabitoImportado[]): Promise<PreviaImportacao> {
  const existentes = new Set((await db.habitos.toArray()).map((h) => chaveNome(h.nome)));
  const novos: HabitoImportado[] = [];
  const jaExistem: HabitoImportado[] = [];
  for (const h of habitos) {
    const k = chaveNome(h.nome);
    if (existentes.has(k)) jaExistem.push(h);
    else {
      existentes.add(k); // dois iguais no próprio arquivo: só o primeiro entra
      novos.push(h);
    }
  }
  return { novos, jaExistem };
}

/** Cria os hábitos novos (tudo ou nada) depois de guardar uma cópia de segurança. */
export async function aplicarImportacao(
  db: BancoHabitos,
  ops: Operacoes,
  habitos: HabitoImportado[],
  versaoApp: string,
  hoje: DataLocal,
): Promise<{ criados: number; puladosJaExistem: number }> {
  const { novos, jaExistem } = await preverImportacao(db, habitos);
  if (novos.length === 0) return { criados: 0, puladosJaExistem: jaExistem.length };
  await criarCopiaDeSeguranca(db, 'antes-importar', versaoApp, hoje);
  await db.transaction('rw', db.habitos, db.versoes, async () => {
    for (const h of novos) {
      const dados: NovoHabito = { ...h, vigenteDesde: hoje };
      await ops.criarHabito(dados);
    }
  });
  return { criados: novos.length, puladosJaExistem: jaExistem.length };
}
