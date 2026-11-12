// Backup em arquivo (RF-61), validação (RF-64) e restauração.
// Regras: validar TUDO antes de mexer em qualquer coisa; restaurar em uma única
// transação (ou tudo, ou nada).
import type { BancoHabitos } from '../database/db';
import type { ConfigApp, DataLocal, Dia, Habito, Marcacao, Registro, VersaoHabito } from '../types';
import { CONFIG_PADRAO } from '../types';
import { ehDataValida, formatarData, formatarHorario } from './datas';

export const FORMATO_BACKUP = 'habit-tracker-backup';
export const VERSAO_BACKUP = 1;

export interface DadosBackup {
  habitos: Habito[];
  versoes: VersaoHabito[];
  registros: Registro[];
  marcacoes: Marcacao[];
  dias: Dia[];
  config: ConfigApp | null;
}

export interface ArquivoBackup {
  formato: typeof FORMATO_BACKUP;
  versaoBackup: number;
  versaoApp: string;
  criadoEm: string;
  contagens: { habitos: number; versoes: number; registros: number; marcacoes: number; dias: number };
  /** "sha256:..." do texto compacto de `dados`. Serve para recusar arquivo cortado ou alterado. */
  integridade: string;
  dados: DadosBackup;
}

export interface ResumoBackup {
  criadoEm: string;
  versaoApp: string;
  habitos: number;
  registros: number;
  marcacoes: number;
  periodo: { de: DataLocal; ate: DataLocal } | null;
}

export type ResultadoValidacao =
  | { ok: true; arquivo: ArquivoBackup; resumo: ResumoBackup }
  | { ok: false; erro: string };

// ---------- integridade ----------

export async function calcularIntegridade(texto: string): Promise<string> {
  const bytes = new TextEncoder().encode(texto);
  const subtle = globalThis.crypto?.subtle;
  if (subtle) {
    const digest = new Uint8Array(await subtle.digest('SHA-256', bytes));
    return 'sha256:' + Array.from(digest, (b) => b.toString(16).padStart(2, '0')).join('');
  }
  let h = 0x811c9dc5; // FNV-1a, só se o navegador não tiver SHA-256
  for (const b of bytes) {
    h ^= b;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return 'fnv1a:' + h.toString(16).padStart(8, '0');
}

// ---------- gerar ----------

export async function lerDadosDoBanco(db: BancoHabitos): Promise<DadosBackup> {
  const [habitos, versoes, registros, marcacoes, dias, config] = await Promise.all([
    db.habitos.orderBy('ordem').toArray(),
    db.versoes.toArray(),
    db.registros.toArray(),
    db.marcacoes.toArray(),
    db.dias.toArray(),
    db.config.get('config'),
  ]);
  return { habitos, versoes, registros, marcacoes, dias, config: config ?? null };
}

export async function montarBackup(
  dados: DadosBackup,
  versaoApp: string,
  agora: Date = new Date(),
): Promise<ArquivoBackup> {
  return {
    formato: FORMATO_BACKUP,
    versaoBackup: VERSAO_BACKUP,
    versaoApp,
    criadoEm: agora.toISOString(),
    contagens: {
      habitos: dados.habitos.length,
      versoes: dados.versoes.length,
      registros: dados.registros.length,
      marcacoes: dados.marcacoes.length,
      dias: dados.dias.length,
    },
    integridade: await calcularIntegridade(JSON.stringify(dados)),
    dados,
  };
}

export async function gerarBackup(db: BancoHabitos, versaoApp: string, agora = new Date()) {
  return montarBackup(await lerDadosDoBanco(db), versaoApp, agora);
}

export function serializarBackup(arquivo: ArquivoBackup): string {
  return JSON.stringify(arquivo, null, 2);
}

/** habit-tracker-backup-2026-11-10-1925.json */
export function nomeArquivoBackup(agora: Date = new Date(), extensao = 'json', prefixo = 'habit-tracker-backup'): string {
  return `${prefixo}-${formatarData(agora)}-${formatarHorario(agora).replace(':', '')}.${extensao}`;
}

// ---------- validar ----------

const ehObjeto = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const ehTexto = (v: unknown): v is string => typeof v === 'string';
const ehNumero = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const ehData = (v: unknown): v is string => ehTexto(v) && ehDataValida(v);
const ehIso = (v: unknown): v is string => ehTexto(v) && !Number.isNaN(Date.parse(v));
const HORARIO = /^([01]\d|2[0-3]):[0-5]\d$/;

function validarHabito(h: unknown): string | null {
  if (!ehObjeto(h)) return 'não é um objeto';
  if (!ehTexto(h.id) || h.id === '') return 'sem id';
  if (!ehTexto(h.nome) || h.nome.trim() === '') return 'sem nome';
  if (!ehTexto(h.icone) || !ehTexto(h.cor) || !ehTexto(h.categoria)) return 'ícone, cor ou categoria inválidos';
  if (!ehNumero(h.ordem)) return 'ordem inválida';
  if (h.status !== 'ativo' && h.status !== 'arquivado' && h.status !== 'removido') return 'status inválido';
  for (const campo of ['dataInicial', 'dataFinal', 'arquivadoEm'] as const) {
    if (h[campo] !== undefined && !ehData(h[campo])) return `${campo} inválida`;
  }
  if (!ehIso(h.criadoEm) || !ehIso(h.editadoEm)) return 'datas de criação/edição inválidas';
  return null;
}

function validarVersao(v: unknown): string | null {
  if (!ehObjeto(v)) return 'não é um objeto';
  if (!ehTexto(v.id) || v.id === '' || !ehTexto(v.habitoId)) return 'sem id ou hábito';
  if (!ehData(v.vigenteDesde)) return 'data de vigência inválida';
  if (!['conclusao', 'quantidade', 'limite', 'semanal'].includes(v.tipo as string)) return 'tipo inválido';
  if (!ehTexto(v.unidade)) return 'unidade inválida';
  if (!ehNumero(v.meta) || v.meta <= 0) return 'meta inválida';
  if (v.tipo === 'semanal' && (!Number.isInteger(v.meta) || v.meta > 7)) return 'meta semanal inválida';
  if (!Array.isArray(v.blocos) || v.blocos.length > 3 || v.blocos.some((b) => !ehNumero(b) || b <= 0)) {
    return 'blocos inválidos';
  }
  const f = v.frequencia;
  if (!ehObjeto(f)) return 'frequência inválida';
  if (f.tipo === 'dias') {
    if (!Array.isArray(f.dias) || f.dias.length === 0 || f.dias.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) {
      return 'dias da semana inválidos';
    }
  } else if (f.tipo !== 'todos') return 'frequência inválida';
  if (typeof v.entraNoPercentual !== 'boolean') return 'opção de percentual inválida';
  if (!ehNumero(v.passoAjuste) || v.passoAjuste <= 0) return 'passo inválido';
  return null;
}

function validarRegistro(r: unknown): string | null {
  if (!ehObjeto(r)) return 'não é um objeto';
  if (!ehTexto(r.id) || r.id === '' || !ehTexto(r.habitoId)) return 'sem id ou hábito';
  if (!ehNumero(r.valor) || r.valor <= 0) return 'valor inválido';
  if (!ehData(r.data)) return 'data inválida';
  if (!ehTexto(r.horario) || !HORARIO.test(r.horario)) return 'horário inválido';
  if (!['bloco', 'digitado', 'manual'].includes(r.origem as string)) return 'origem inválida';
  if (!ehIso(r.criadoEm) || !ehIso(r.editadoEm)) return 'datas de criação/edição inválidas';
  return null;
}

function validarMarcacao(m: unknown): string | null {
  if (!ehObjeto(m)) return 'não é um objeto';
  if (!ehTexto(m.id) || m.id === '' || !ehTexto(m.habitoId)) return 'sem id ou hábito';
  if (!ehData(m.data)) return 'data inválida';
  if (!ehIso(m.criadoEm)) return 'data de criação inválida';
  return null;
}

function validarDia(d: unknown): string | null {
  if (!ehObjeto(d)) return 'não é um objeto';
  if (!ehData(d.data)) return 'data inválida';
  if (typeof d.fechado !== 'boolean' || typeof d.folga !== 'boolean') return 'estado do dia inválido';
  if (d.nota !== undefined && (!ehTexto(d.nota) || d.nota.length > 280)) return 'nota inválida';
  return null;
}

function validarConfig(c: unknown): string | null {
  if (c === null) return null;
  if (!ehObjeto(c)) return 'não é um objeto';
  if (!['sistema', 'claro', 'escuro'].includes(c.tema as string)) return 'tema inválido';
  if (!ehNumero(c.inicioDoDiaHora) || c.inicioDoDiaHora < 0 || c.inicioDoDiaHora > 5) return 'início do dia inválido';
  if (!ehNumero(c.inicioSemana) || c.inicioSemana < 0 || c.inicioSemana > 6) return 'início da semana inválido';
  if (typeof c.dicaVisivel !== 'boolean') return 'opção da dica inválida';
  if (!ehNumero(c.avisoBackupDias) || c.avisoBackupDias < 1) return 'aviso de backup inválido';
  if (c.avisoBackupFixo !== undefined && typeof c.avisoBackupFixo !== 'boolean') return 'aviso fixo inválido';
  return null;
}

function checarLista(nome: string, lista: unknown, validar: (x: unknown) => string | null): string | null {
  if (!Array.isArray(lista)) return `A lista de ${nome} está faltando ou está errada.`;
  for (let i = 0; i < lista.length; i++) {
    const erro = validar(lista[i]);
    if (erro) return `${nome}, item ${i + 1}: ${erro}.`;
  }
  return null;
}

function idsRepetidos(lista: { id: string }[]): boolean {
  return new Set(lista.map((x) => x.id)).size !== lista.length;
}

/** Lê e valida um arquivo de backup. Nada é gravado aqui. */
export async function validarBackup(texto: string): Promise<ResultadoValidacao> {
  let bruto: unknown;
  try {
    bruto = JSON.parse(texto);
  } catch {
    return { ok: false, erro: 'Este arquivo não é um backup do Habit Tracker (não foi possível ler o conteúdo).' };
  }
  if (!ehObjeto(bruto) || bruto.formato !== FORMATO_BACKUP) {
    return { ok: false, erro: 'Este arquivo não é um backup do Habit Tracker.' };
  }
  if (!ehNumero(bruto.versaoBackup)) return { ok: false, erro: 'O arquivo não informa a versão do backup.' };
  if (bruto.versaoBackup > VERSAO_BACKUP) {
    return {
      ok: false,
      erro: 'Este backup foi feito por uma versão mais nova do app. Atualize o app e tente de novo.',
    };
  }
  if (!ehObjeto(bruto.dados) || !ehObjeto(bruto.contagens) || !ehTexto(bruto.integridade) || !ehIso(bruto.criadoEm)) {
    return { ok: false, erro: 'O arquivo está incompleto ou danificado.' };
  }

  const d = bruto.dados;
  for (const [nome, lista, validar] of [
    ['hábitos', d.habitos, validarHabito],
    ['versões dos hábitos', d.versoes, validarVersao],
    ['registros', d.registros, validarRegistro],
    ['marcações', d.marcacoes, validarMarcacao],
    ['dias', d.dias, validarDia],
  ] as const) {
    const erro = checarLista(nome, lista, validar);
    if (erro) return { ok: false, erro: `O arquivo está danificado. ${erro}` };
  }
  const erroConfig = validarConfig(d.config === undefined ? null : d.config);
  if (erroConfig) return { ok: false, erro: `O arquivo está danificado. Configurações: ${erroConfig}.` };

  const dados: DadosBackup = {
    habitos: d.habitos as Habito[],
    versoes: d.versoes as VersaoHabito[],
    registros: d.registros as Registro[],
    marcacoes: d.marcacoes as Marcacao[],
    dias: d.dias as Dia[],
    config: (d.config ?? null) as ConfigApp | null,
  };

  // contagens e integridade: arquivo cortado ou alterado é recusado
  const c = bruto.contagens;
  const contagensCertas =
    c.habitos === dados.habitos.length &&
    c.versoes === dados.versoes.length &&
    c.registros === dados.registros.length &&
    c.marcacoes === dados.marcacoes.length &&
    c.dias === dados.dias.length;
  if (!contagensCertas) {
    return { ok: false, erro: 'O arquivo parece incompleto: as quantidades não batem com o conteúdo.' };
  }
  if (bruto.integridade.startsWith('sha256:') && !globalThis.crypto?.subtle) {
    return { ok: false, erro: 'Este aparelho não consegue verificar o arquivo agora. Tente abrir o app pelo ícone.' };
  }
  if (bruto.integridade.startsWith('sha256:') || bruto.integridade.startsWith('fnv1a:')) {
    const esperado = await calcularIntegridade(JSON.stringify(dados));
    if (esperado !== bruto.integridade) {
      return { ok: false, erro: 'O arquivo foi alterado ou está danificado (a verificação de integridade falhou).' };
    }
  } else {
    return { ok: false, erro: 'O arquivo não tem a verificação de integridade esperada.' };
  }

  // ids únicos e referências
  if (
    idsRepetidos(dados.habitos) ||
    idsRepetidos(dados.versoes) ||
    idsRepetidos(dados.registros) ||
    idsRepetidos(dados.marcacoes)
  ) {
    return { ok: false, erro: 'O arquivo tem itens repetidos (mesmo identificador usado duas vezes).' };
  }
  if (new Set(dados.dias.map((x) => x.data)).size !== dados.dias.length) {
    return { ok: false, erro: 'O arquivo tem dias repetidos.' };
  }
  const chavesMarcacao = new Set(dados.marcacoes.map((m) => `${m.habitoId}|${m.data}`));
  if (chavesMarcacao.size !== dados.marcacoes.length) {
    return { ok: false, erro: 'O arquivo tem duas marcações do mesmo hábito no mesmo dia.' };
  }
  const idsHabitos = new Set(dados.habitos.map((h) => h.id));
  const orfao =
    dados.versoes.some((v) => !idsHabitos.has(v.habitoId)) ||
    dados.registros.some((r) => !idsHabitos.has(r.habitoId)) ||
    dados.marcacoes.some((m) => !idsHabitos.has(m.habitoId));
  if (orfao) {
    return { ok: false, erro: 'O arquivo tem registros ligados a hábitos que não existem nele.' };
  }
  const habitosComVersao = new Set(dados.versoes.map((v) => v.habitoId));
  if (dados.habitos.some((h) => !habitosComVersao.has(h.id))) {
    return { ok: false, erro: 'O arquivo tem hábitos sem configuração.' };
  }

  const arquivo: ArquivoBackup = {
    formato: FORMATO_BACKUP,
    versaoBackup: bruto.versaoBackup,
    versaoApp: ehTexto(bruto.versaoApp) ? bruto.versaoApp : 'desconhecida',
    criadoEm: bruto.criadoEm,
    contagens: c as unknown as ArquivoBackup['contagens'],
    integridade: bruto.integridade,
    dados,
  };
  return { ok: true, arquivo, resumo: resumirBackup(arquivo) };
}

export function resumirBackup(arquivo: ArquivoBackup): ResumoBackup {
  const datas = [
    ...arquivo.dados.registros.map((r) => r.data),
    ...arquivo.dados.marcacoes.map((m) => m.data),
    ...arquivo.dados.dias.map((d) => d.data),
  ].sort();
  return {
    criadoEm: arquivo.criadoEm,
    versaoApp: arquivo.versaoApp,
    habitos: arquivo.dados.habitos.length,
    registros: arquivo.dados.registros.length,
    marcacoes: arquivo.dados.marcacoes.length,
    periodo: datas.length > 0 ? { de: datas[0], ate: datas[datas.length - 1] } : null,
  };
}

// ---------- restaurar ----------

/**
 * Substitui TUDO pelo conteúdo do backup (decisão do usuário), em uma única
 * transação: se algo falhar no meio, nada muda. A cópia do estado atual deve
 * ser guardada ANTES, por quem chama (ver restauracao.ts).
 */
export async function aplicarBackup(db: BancoHabitos, arquivo: ArquivoBackup): Promise<void> {
  const { dados } = arquivo;
  await db.transaction(
    'rw',
    [db.habitos, db.versoes, db.registros, db.marcacoes, db.dias, db.config],
    async () => {
      await Promise.all([
        db.habitos.clear(),
        db.versoes.clear(),
        db.registros.clear(),
        db.marcacoes.clear(),
        db.dias.clear(),
        db.config.clear(),
      ]);
      await db.habitos.bulkAdd(dados.habitos);
      await db.versoes.bulkAdd(dados.versoes);
      await db.registros.bulkAdd(dados.registros);
      await db.marcacoes.bulkAdd(dados.marcacoes);
      await db.dias.bulkAdd(dados.dias);
      await db.config.put({
        ...CONFIG_PADRAO,
        ...(dados.config ?? {}),
        id: 'config',
        ultimoBackup: arquivo.criadoEm,
      });
    },
  );
}
