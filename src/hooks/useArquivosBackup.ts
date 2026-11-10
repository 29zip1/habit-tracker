import { useEffect, useState } from 'react';
import { liveQuery } from 'dexie';
import { db } from '../database/db';
import { gerarBackup, lerDadosDoBanco, nomeArquivoBackup, serializarBackup } from '../services/backup';
import { gerarCsvRegistros } from '../services/csv';

export interface ArquivosBackup {
  backup: File;
  csv: File;
  temDados: boolean;
}

/**
 * Mantém os arquivos de backup e CSV JÁ PRONTOS. No iPhone o compartilhamento só
 * abre se for chamado logo depois do toque; gerar o arquivo depois do toque
 * poderia perder essa permissão. Atualiza sozinho quando os dados mudam.
 */
export function useArquivosBackup(ativo = true): ArquivosBackup | null {
  const [arquivos, setArquivos] = useState<ArquivosBackup | null>(null);

  useEffect(() => {
    if (!ativo) return;
    const sub = liveQuery(async () => {
      const agora = new Date();
      const dados = await lerDadosDoBanco(db);
      const arquivo = await gerarBackup(db, __APP_VERSION__, agora);
      const csv = gerarCsvRegistros(dados.habitos, dados.versoes, dados.registros, dados.marcacoes);
      return {
        backup: new File([serializarBackup(arquivo)], nomeArquivoBackup(agora), { type: 'application/json' }),
        csv: new File([csv], nomeArquivoBackup(agora, 'csv', 'habit-tracker-registros'), {
          type: 'text/csv',
        }),
        temDados: dados.habitos.length > 0 || dados.registros.length > 0,
      };
    }).subscribe({ next: setArquivos, error: (e) => console.error('Erro ao preparar o backup', e) });
    return () => sub.unsubscribe();
  }, [ativo]);

  return arquivos;
}
