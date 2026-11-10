// RF-62: faixa de aviso quando o último backup é antigo.

const DIA_MS = 24 * 60 * 60 * 1000;

export function diasDesde(iso: string, agora: Date): number {
  return Math.floor((agora.getTime() - new Date(iso).getTime()) / DIA_MS);
}

export interface EntradaAviso {
  agora: Date;
  /** Quando o último backup foi salvo (ISO), se já houve. */
  ultimoBackup?: string;
  /** Quando o banco foi criado (ISO). Vale como referência se nunca houve backup. */
  criadoEm?: string;
  limiteDias: number;
  temRegistros: boolean;
}

/** Avisa se passaram mais de `limiteDias` dias do último backup (ou da criação, se nunca houve). */
export function precisaAvisarBackup(e: EntradaAviso): boolean {
  if (!e.temRegistros) return false;
  const referencia = e.ultimoBackup ?? e.criadoEm;
  if (!referencia) return false;
  return diasDesde(referencia, e.agora) > e.limiteDias;
}

export function textoAvisoBackup(e: Pick<EntradaAviso, 'agora' | 'ultimoBackup' | 'criadoEm'>): string {
  if (!e.ultimoBackup) return 'Você ainda não salvou nenhum backup.';
  const dias = diasDesde(e.ultimoBackup, e.agora);
  return `Faz ${dias} ${dias === 1 ? 'dia' : 'dias'} que você não salva um backup.`;
}
