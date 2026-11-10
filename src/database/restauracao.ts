// Restaurar com segurança (RF-64): validar → cópia do estado atual → substituir tudo.
import type { DataLocal } from '../types';
import { aplicarBackup, validarBackup, type ResumoBackup } from '../services/backup';
import { criarCopiaDeSeguranca } from './copias';
import type { BancoHabitos } from './db';

export type ResultadoRestauracao =
  | { ok: true; resumo: ResumoBackup; copiaDeSegurancaCriada: boolean }
  | { ok: false; erro: string };

/**
 * Restaura um backup (arquivo ou cópia interna). Se qualquer passo antes de
 * mexer nos dados falhar, nada é alterado. A troca em si é uma transação só.
 */
export async function restaurarComSeguranca(
  db: BancoHabitos,
  texto: string,
  versaoApp: string,
  hoje: DataLocal,
  agora: Date = new Date(),
): Promise<ResultadoRestauracao> {
  const validacao = await validarBackup(texto);
  if (!validacao.ok) return { ok: false, erro: validacao.erro };

  let copiaDeSegurancaCriada = false;
  try {
    copiaDeSegurancaCriada = (await criarCopiaDeSeguranca(db, 'antes-restaurar', versaoApp, hoje, agora)) !== null;
  } catch {
    return {
      ok: false,
      erro: 'Não consegui guardar a cópia de segurança dos seus dados atuais, então não restaurei nada.',
    };
  }

  try {
    await aplicarBackup(db, validacao.arquivo);
  } catch {
    return { ok: false, erro: 'A restauração falhou e nada foi alterado. Seus dados atuais continuam como estavam.' };
  }
  return { ok: true, resumo: validacao.resumo, copiaDeSegurancaCriada };
}
