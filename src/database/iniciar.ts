// Abertura do banco com proteção (RF-63, RF-66, RF-71).
// - Antes de migrar, lê os dados antigos para a memória; depois da migração
//   guarda uma cópia "antes de migrar".
// - Se o banco não abrir, o app NÃO começa do zero em silêncio: devolve o erro
//   (e os dados legíveis, se houver) para mostrar a tela de falha.
import Dexie from 'dexie';
import type { DataLocal } from '../types';
import { montarBackup, type ArquivoBackup, type DadosBackup } from '../services/backup';
import { guardarCopia, limparCopias } from './copias';
import type { BancoHabitos } from './db';
import { Operacoes } from './operacoes';

export type ResultadoAbertura =
  | { ok: true; migrou: boolean }
  | { ok: false; erro: string; dadosLegados: ArquivoBackup | null };

interface Legado {
  arquivo: ArquivoBackup;
  versao: number;
  temDados: boolean;
}

/** Lê o banco como está, sem migrar. Devolve null se ainda não existe. */
async function lerLegado(nome: string, versaoApp: string): Promise<Legado | null> {
  if (!(await Dexie.exists(nome))) return null;
  const legado = new Dexie(nome);
  try {
    await legado.open(); // abre com o formato que já está gravado
    const tabelas = new Set(legado.tables.map((t) => t.name));
    const ler = async <T>(n: string): Promise<T[]> => (tabelas.has(n) ? ((await legado.table(n).toArray()) as T[]) : []);
    const dados: DadosBackup = {
      habitos: await ler('habitos'),
      versoes: await ler('versoes'),
      registros: await ler('registros'),
      marcacoes: await ler('marcacoes'),
      dias: await ler('dias'),
      config: tabelas.has('config') ? ((await legado.table('config').get('config')) ?? null) : null,
    };
    const arquivo = await montarBackup(dados, versaoApp);
    return { arquivo, versao: legado.verno, temDados: dados.habitos.length > 0 || dados.registros.length > 0 };
  } finally {
    legado.close();
  }
}

export async function abrirBancoComSeguranca(
  db: BancoHabitos,
  versaoApp: string,
  hoje: DataLocal,
  agora: Date = new Date(),
): Promise<ResultadoAbertura> {
  let legado: Legado | null = null;
  try {
    legado = await lerLegado(db.name, versaoApp);
  } catch {
    legado = null; // não conseguiu ler antes; a abertura normal vai dizer se há problema
  }

  // Dados mais novos que este app (ex.: versão antiga do app em cache): não abre,
  // para nunca gravar com um formato velho em cima de dados novos.
  if (legado && legado.versao > db.verno) {
    return {
      ok: false,
      erro: 'Seus dados são de uma versão mais nova do app. Atualize o app e abra de novo.',
      dadosLegados: legado.arquivo,
    };
  }

  try {
    await db.open();
  } catch (e) {
    const versaoNova = e instanceof Error && /version/i.test(`${e.name} ${e.message}`);
    return {
      ok: false,
      erro: versaoNova
        ? 'Seus dados são de uma versão mais nova do app. Atualize o app e abra de novo.'
        : 'Não consegui abrir o banco de dados deste app.',
      dadosLegados: legado?.arquivo ?? null,
    };
  }

  const migrou = legado !== null && legado.versao < db.verno;
  try {
    if (migrou && legado?.temDados) {
      await guardarCopia(db, legado.arquivo, 'antes-migrar', hoje, agora);
    }
    await new Operacoes(db).garantirMeta();
    await limparCopias(db, agora);
  } catch {
    // Os dados já estão abertos e seguros; falha ao guardar a cópia não bloqueia o uso.
  }
  return { ok: true, migrou };
}
