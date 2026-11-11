import { useState } from 'react';
import { db } from '../database/db';
import { operacoes } from '../database/operacoes';
import { useArquivosBackup } from '../hooks/useArquivosBackup';
import { useLive } from '../hooks/useLive';
import { precisaAvisarBackup, textoAvisoBackup } from '../services/avisoBackup';
import { baixarArquivo, compartilharArquivo } from '../services/compartilhar';
import { CONFIG_PADRAO } from '../types';

interface Situacao {
  temRegistros: boolean;
  criadoEm?: string;
}

/** RF-62: faixa discreta no topo da tela Hoje quando o último backup está velho. */
export function FaixaBackup() {
  const config = useLive(() => operacoes.lerConfig(), [], CONFIG_PADRAO);
  const situacao = useLive(
    async (): Promise<Situacao> => ({
      temRegistros: (await db.registros.count()) > 0,
      criadoEm: (await db.meta.get('criadoEm'))?.valor as string | undefined,
    }),
    [],
    { temRegistros: false },
  );
  const fixo = config.avisoBackupFixo === true;
  // RF-62c: com o aviso fixo ligado, nada o dispensa; só o backup feito.
  const [dispensadaPorAgora, setDispensada] = useState(false);
  const dispensada = !fixo && dispensadaPorAgora;

  const agora = new Date();
  const precisa = precisaAvisarBackup({
    agora,
    ultimoBackup: config.ultimoBackup,
    criadoEm: situacao.criadoEm,
    limiteDias: config.avisoBackupDias,
    temRegistros: situacao.temRegistros,
  });
  const arquivos = useArquivosBackup(precisa && !dispensada);

  if (!precisa || dispensada) return null;

  async function salvar() {
    if (!arquivos) return;
    const r = await compartilharArquivo(arquivos.backup, 'Backup do Habit Tracker');
    if (r === 'indisponivel') baixarArquivo(arquivos.backup);
    if (r === 'compartilhado' || r === 'indisponivel') {
      await operacoes.salvarConfig({ ultimoBackup: new Date().toISOString() });
    }
  }

  return (
    <div
      role="status"
      className="mx-4 mb-3 flex items-center justify-between gap-2 rounded-2xl border border-laranja bg-laranja-claro py-1 pl-4 pr-1.5 text-[14px] text-laranja-texto"
    >
      <span className="py-2">{textoAvisoBackup({ agora, ultimoBackup: config.ultimoBackup })}</span>
      <div className="flex shrink-0 items-center">
        <button
          type="button"
          onClick={() => void salvar()}
          disabled={!arquivos}
          className="h-11 rounded-full border-0 bg-transparent px-3 text-[14px] font-bold text-laranja-texto underline"
        >
          Salvar backup
        </button>
        {!fixo && (
          <button
            type="button"
            aria-label="Dispensar aviso por agora"
            onClick={() => setDispensada(true)}
            className="h-11 rounded-full border-0 bg-transparent px-3 text-[14px] text-laranja-texto"
          >
            Depois
          </button>
        )}
      </div>
    </div>
  );
}
