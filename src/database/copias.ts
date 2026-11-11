// Cópias automáticas internas (RF-69). Ficam no iPhone, junto com os dados:
// protegem de erros seus e do app, NÃO de o iOS apagar tudo (para isso existe o
// backup em arquivo). Só CÓPIAS são descartadas aqui; hábitos e registros nunca.
import type { Copia, DataLocal, MotivoCopia } from '../types';
import {
  lerDadosDoBanco,
  montarBackup,
  serializarBackup,
  validarBackup,
  type ArquivoBackup,
  type ResultadoValidacao,
} from '../services/backup';
import { somarDias } from '../services/datas';
import type { BancoHabitos } from './db';

export const MAXIMO_DE_COPIAS_DIARIAS = 14;
export const DIAS_DE_PROTECAO = 30;

export const ROTULO_MOTIVO: Record<MotivoCopia, string> = {
  diaria: 'Cópia diária',
  'antes-restaurar': 'Antes de restaurar',
  'antes-atualizar': 'Antes de atualizar o app',
  'antes-migrar': 'Antes de migrar o banco',
  'antes-excluir': 'Antes de excluir',
  'antes-importar': 'Antes de importar hábitos',
};

const novoId = () => crypto.randomUUID();

export async function bancoTemDados(db: BancoHabitos): Promise<boolean> {
  return (await db.habitos.count()) > 0 || (await db.registros.count()) > 0;
}

/** Guarda um arquivo de backup já montado como cópia interna. */
export async function guardarCopia(
  db: BancoHabitos,
  arquivo: ArquivoBackup,
  motivo: MotivoCopia,
  hoje: DataLocal,
  agora: Date = new Date(),
): Promise<Copia> {
  const copia: Copia = {
    id: novoId(),
    criadaEm: agora.toISOString(),
    data: hoje,
    motivo,
    habitos: arquivo.contagens.habitos,
    registros: arquivo.contagens.registros,
    integridade: arquivo.integridade,
    conteudo: serializarBackup(arquivo),
    protegidaAte:
      motivo === 'diaria'
        ? undefined
        : new Date(agora.getTime() + DIAS_DE_PROTECAO * 24 * 60 * 60 * 1000).toISOString(),
  };
  await db.copias.add(copia);
  return copia;
}

/**
 * Copia o estado atual do banco antes de uma ação perigosa (restaurar, atualizar,
 * excluir). Sem dados, não há o que proteger e devolve null.
 */
export async function criarCopiaDeSeguranca(
  db: BancoHabitos,
  motivo: Exclude<MotivoCopia, 'diaria'>,
  versaoApp: string,
  hoje: DataLocal,
  agora: Date = new Date(),
): Promise<Copia | null> {
  if (!(await bancoTemDados(db))) return null;
  const arquivo = await montarBackup(await lerDadosDoBanco(db), versaoApp, agora);
  return guardarCopia(db, arquivo, motivo, hoje, agora);
}

/**
 * Cópia diária: na primeira abertura do dia, se os dados mudaram desde a última
 * cópia. Depois mantém só as últimas 14 diárias.
 */
export async function criarCopiaDiaria(
  db: BancoHabitos,
  versaoApp: string,
  hoje: DataLocal,
  agora: Date = new Date(),
): Promise<Copia | null> {
  if (!(await bancoTemDados(db))) return null;
  const jaTemHoje = await db.copias.where('motivo').equals('diaria').filter((c) => c.data === hoje).count();
  if (jaTemHoje > 0) return null;

  const arquivo = await montarBackup(await lerDadosDoBanco(db), versaoApp, agora);
  const ultima = (await db.copias.orderBy('criadaEm').reverse().first()) ?? null;
  if (ultima && ultima.integridade === arquivo.integridade) return null; // nada mudou

  const copia = await guardarCopia(db, arquivo, 'diaria', hoje, agora);
  await limparCopias(db, agora);
  return copia;
}

/** Igual a criarCopiaDiaria, mas nunca lança erro: falha de cópia não pode atrapalhar o uso (T-69f). */
export async function criarCopiaDiariaSegura(
  db: BancoHabitos,
  versaoApp: string,
  hoje: DataLocal,
  agora: Date = new Date(),
): Promise<'criada' | 'pulada' | 'falhou'> {
  try {
    return (await criarCopiaDiaria(db, versaoApp, hoje, agora)) ? 'criada' : 'pulada';
  } catch {
    return 'falhou';
  }
}

/**
 * Descarta só cópias: diárias além das 14 mais recentes e cópias de segurança
 * com mais de 30 dias. Hábitos e registros nunca são tocados (RF-66).
 */
export async function limparCopias(db: BancoHabitos, agora: Date = new Date()): Promise<number> {
  const diarias = await db.copias.where('motivo').equals('diaria').toArray();
  diarias.sort((a, b) => (a.criadaEm < b.criadaEm ? 1 : -1));
  const sobra = diarias.slice(MAXIMO_DE_COPIAS_DIARIAS).map((c) => c.id);

  const iso = agora.toISOString();
  const vencidas = (await db.copias.filter((c) => c.motivo !== 'diaria' && !!c.protegidaAte && c.protegidaAte < iso).toArray()).map(
    (c) => c.id,
  );

  const apagar = [...sobra, ...vencidas];
  await db.copias.bulkDelete(apagar);
  return apagar.length;
}

export async function listarCopias(db: BancoHabitos): Promise<Copia[]> {
  const todas = await db.copias.toArray();
  return todas.sort((a, b) => (a.criadaEm < b.criadaEm ? 1 : -1));
}

/** Lê e valida o conteúdo de uma cópia (mesma validação do arquivo de backup). */
export async function validarCopia(copia: Copia): Promise<ResultadoValidacao> {
  return validarBackup(copia.conteudo);
}

/** Data de hoje menos N dias (utilitário para testes de rotação). */
export const diaAnterior = (hoje: DataLocal, n: number) => somarDias(hoje, -n);
